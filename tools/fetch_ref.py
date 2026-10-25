"""Download a reference video (or our own posted reel) with yt-dlp and study its pacing.

Works with YouTube, Instagram, TikTok, Facebook, X and ~1000 other sites.

usage:
  python fetch_ref.py <url> [<url> ...] [--out refs] [--audio] [--subs] [--cookies chrome] [--no-study]

Per URL it writes into <out>/<site>-<id>/:
  video.mp4 (or audio.wav with --audio), info.json (title, uploader, duration, url),
  subtitles if --subs, and unless --no-study: cuts.txt (shot change times) + sheet.jpg (one frame per shot).
It appends one line per download to <out>/SOURCES.md.

Other people's videos are for study only: never put their footage or music in a published reel.
Instagram/Facebook often need a login: --cookies chrome reads the browser's cookies (use a secondary account).
"""
import argparse, json, os, re, shutil, subprocess, sys

sys.stdout.reconfigure(encoding="utf-8")

ap = argparse.ArgumentParser()
ap.add_argument("urls", nargs="+")
ap.add_argument("--out", default="refs")
ap.add_argument("--audio", action="store_true", help="audio only, as WAV (for Demucs / Whisper / CLAP)")
ap.add_argument("--subs", action="store_true", help="also save subtitles / auto captions (ar, en)")
ap.add_argument("--cookies", default="", help="browser to read login cookies from: chrome, edge, firefox")
ap.add_argument("--no-study", action="store_true", help="skip cut detection and contact sheet")
ap.add_argument("--scene", type=float, default=0.3, help="scene-change threshold for cut detection")
a = ap.parse_args()

ytdlp = [shutil.which("yt-dlp")] if shutil.which("yt-dlp") else [sys.executable, "-m", "yt_dlp"]
os.makedirs(a.out, exist_ok=True)


def study(video, d):
    """Shot changes via ffmpeg scene score: gives cut times, average shot length and a contact sheet."""
    log = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", video, "-vf", f"select='gt(scene,{a.scene})',showinfo",
         "-an", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    cuts = [float(t) for t in re.findall(r"pts_time:([\d.]+)", log)]
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video],
                               capture_output=True, text=True).stdout.strip() or 0)
    shots = len(cuts) + 1
    with open(os.path.join(d, "cuts.txt"), "w", encoding="utf-8") as f:
        f.write(f"duration {dur:.2f}s, {shots} shots, avg shot {dur / shots:.2f}s\n")
        f.write("\n".join(f"{t:.2f}" for t in cuts) + "\n")
    # one frame from each shot (first frame + every cut), max 40 tiles
    cols = 5
    rows = max(1, min(8, (shots + cols - 1) // cols))
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", video, "-vf",
                    f"select='eq(n,0)+gt(scene,{a.scene})',scale=216:-2,tile={cols}x{rows}:padding=4",
                    "-frames:v", "1", "-fps_mode", "vfr", os.path.join(d, "sheet.jpg")], check=False)
    return f"{shots} shots, avg {dur / shots:.2f}s"


failed = 0
for url in a.urls:
    # Node solves YouTube's JS challenge (yt-dlp only tries deno by default)
    base = [*ytdlp, "--no-playlist", "--no-progress", "--no-update", "--js-runtimes", "node"]
    if a.cookies:
        base += ["--cookies-from-browser", a.cookies]
    info = subprocess.run([*base, "-J", url], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if info.returncode:
        print(f"FAIL {url}\n  {info.stderr.strip().splitlines()[-1] if info.stderr.strip() else 'no output'}")
        if not a.cookies and re.search(r"login|cookies|private|rate", info.stderr, re.I):
            print("  try again with --cookies chrome")
        failed += 1
        continue
    meta = json.loads(info.stdout)
    d = os.path.join(a.out, f"{meta.get('extractor_key', 'web').lower()}-{meta.get('id', 'clip')}")
    os.makedirs(d, exist_ok=True)

    if a.audio:
        fmt = ["-f", "bestaudio/best", "-x", "--audio-format", "wav", "-o", os.path.join(d, "audio.%(ext)s")]
    else:  # H.264/AAC mp4 up to 1080p: plays everywhere and ffmpeg/HyperFrames read it directly
        fmt = ["-f", "bv*[height<=1080][vcodec^=avc1]+ba[acodec^=mp4a]/bv*[height<=1080]+ba/b[height<=1080]/b",
               "-S", "vcodec:h264,res:1080", "--merge-output-format", "mp4", "--remux-video", "mp4",
               "-o", os.path.join(d, "video.%(ext)s")]
    r = subprocess.run([*base, *fmt, url])
    if r.returncode:
        print(f"FAIL download {url}")
        failed += 1
        continue
    if a.subs:  # separate call: a missing or throttled caption track must not cost the video
        # original-language tracks only; the machine-translated ones (ar-en, ...) trigger HTTP 429
        s = subprocess.run([*base, "--skip-download", "--write-subs", "--write-auto-subs",
                            "--sub-langs", "ar,en,ar-orig,en-orig", "--convert-subs", "srt",
                            "-o", os.path.join(d, "subs.%(ext)s"), url])
        if s.returncode:
            print("  subtitles failed (video kept)")

    keep = {k: meta.get(k) for k in ("title", "uploader", "channel", "upload_date", "duration", "width", "height",
                                      "view_count", "like_count", "webpage_url", "description")}
    with open(os.path.join(d, "info.json"), "w", encoding="utf-8") as f:
        json.dump(keep, f, ensure_ascii=False, indent=1)

    note = ""
    video = os.path.join(d, "video.mp4")
    if not a.audio and not a.no_study and os.path.exists(video):
        note = study(video, d)
    with open(os.path.join(a.out, "SOURCES.md"), "a", encoding="utf-8") as f:
        f.write(f"- `{os.path.basename(d)}`: {keep['title']} by {keep['uploader']} ({keep['webpage_url']}). "
                f"Study only unless it is ours.\n")
    print(f"OK {d}  {keep['title']!r}  {note}")

sys.exit(1 if failed else 0)
