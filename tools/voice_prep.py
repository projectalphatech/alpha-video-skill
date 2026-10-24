"""Voice-only reel prep (mode A2): tighten long pauses, clean + level the voice, remap word times.

usage (from the project root, after reel/scripts/py/transcribe.py wrote raw_words.json):
  python -I voice_prep.py <audio> <raw_words.json> [--out-audio assets/audio/voice.wav]
         [--out-words assets/words.json] [--fixes fixes.json] [--lufs -15] [--min-gap 0.4]

fixes.json: {"misheard": "right", ...}; a value of "" drops the word from captions (stutters).
Rules (learned on reel 01, 2026-10-25):
  - silencedetect can print a negative first start (-0.0006): parse the sign.
  - drop words that start inside the final silence: whisper invents "اشتركوا في القناة" there.
  - keep 0.2 s after the voice drops and 0.08 s before it returns; 30 ms fades on every cut.
  - whisper stretches a word back across the pause before it: snap its start to the pause end.
"""
import argparse, json, re, subprocess, sys

sys.stdout.reconfigure(encoding="utf-8")
ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("raw")
ap.add_argument("--out-audio", default="assets/audio/voice.wav")
ap.add_argument("--out-words", default="assets/words.json")
ap.add_argument("--fixes", default=None)
ap.add_argument("--lufs", type=float, default=-15)
ap.add_argument("--min-gap", type=float, default=0.40)
a = ap.parse_args()
KEEP_AFTER, KEEP_BEFORE = 0.20, 0.08

dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.src]))
log = subprocess.run(["ffmpeg", "-hide_banner", "-i", a.src, "-af", "silencedetect=n=-38dB:d=0.25", "-f", "null", "-"],
                     capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
ss = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", log)]
se = [float(x) for x in re.findall(r"silence_end: (-?[\d.]+)", log)]
words = json.load(open(a.raw, encoding="utf-8"))
fixes = json.load(open(a.fixes, encoding="utf-8")) if a.fixes else {}

last_voice = max([s for s in ss if s < dur - 0.2] or [dur])
words = [w for w in words if w["start"] < last_voice - 0.02]

segs, cur = [], 0.0
if ss and ss[0] < 0.05 and se[0] > 0.2:  # leading silence: the hook must start at once
    cur = max(0.0, se[0] - 0.1)
for s0, s1 in zip(ss, se):
    if s0 < 0.3 or s1 > dur - 0.05 or s1 - s0 < a.min_gap:
        continue
    segs.append((cur, s0 + KEEP_AFTER)); cur = s1 - KEEP_BEFORE
segs.append((cur, min(dur, last_voice + 0.7)))

parts = "".join(f"[0:a]atrim={x:.3f}:{y:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st={y - x - 0.03:.3f}:d=0.03[s{i}];" for i, (x, y) in enumerate(segs))
chain = ("highpass=f=80,afftdn=nf=-28,acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=2,"
         f"equalizer=f=3500:t=q:w=1.2:g=2,loudnorm=I={a.lufs}:TP=-1.5:LRA=7,aresample=48000")
fc = parts + "".join(f"[s{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=0:a=1,{chain}[out]"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.src, "-filter_complex", fc, "-map", "[out]", "-ac", "2", a.out_audio], check=True)


def remap(t):
    off = 0.0
    for x, y in segs:
        if t < x:
            return round(off, 3)
        if t <= y:
            return round(off + t - x, 3)
        off += y - x
    return round(off, 3)


out = []
for w in words:
    w = dict(w)
    txt = fixes.get(w["text"], w["text"])
    if txt == "":
        continue
    w["text"] = txt
    for s0, s1 in zip(ss, se):
        if w["start"] - 0.1 < s0 and s1 < w["end"]:
            w["start"] = s1
    w["start"], w["end"] = remap(w["start"]), remap(w["end"])
    out.append(w)
for k, w in enumerate(out):
    w["id"] = f"w{k}"
json.dump(out, open(a.out_words, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{len(segs)} segments, {dur:.2f}s -> {sum(y - x for x, y in segs):.2f}s, {len(out)} words -> {a.out_audio}, {a.out_words}")
