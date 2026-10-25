"""Remove filler words (um, uh, اممم, آآ, يعني...) and silence gaps from a talking-head video,
with a browser review step before anything is rendered. The source file is never changed.

  declutter.py plan   <video> [--dir D] [--lang ar] [--model large-v3] [--prompt "names"]
                      [--threshold 0.04] [--margin 0.2] [--min-silence 0.3] [--fillers "x,y"]
  declutter.py review <dir>             browser page: tick cuts on/off, preview the edit, Save
  declutter.py render <dir> [-o out.mp4]

plan:   whisper-timestamped (detect_disfluencies) finds fillers as [*] tokens plus words from the filler
        list; auto-editor finds silences by loudness. Writes <dir>/plan.json and words.json.
review: serves the page on 127.0.0.1 only. Save writes plan.json back.
render: auto-editor cuts every ticked range in one pass -> <dir>/clean.mp4.
Then feed clean.mp4 to `reel init` as usual (the reel cut step adds 30 ms fades and loudness).
Needs in the venv: pip install auto-editor whisper-timestamped (reel setup installs them).
"""
import argparse, http.server, json, os, re, subprocess, sys, tempfile, webbrowser
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
BIN = Path(sys.executable).parent
AE = str(BIN / ("auto-editor.exe" if os.name == "nt" else "auto-editor"))

# Fillers after normalize(): letters de-accented, alef forms unified, repeated letters collapsed.
FILLERS = {"ام", "ا", "م", "ه", "um", "uh", "uhm", "erm", "er", "ah", "eh", "hm", "m"}
# Real words too (آه = "yes" in Egyptian): listed in review but start unticked.
MAYBE = {"يعني", "اه", "like", "so"}
# Whisper drops fillers unless the prompt shows them being written out.
FILLER_PROMPT = {"ar": "اممم، يعني، آآ، اه، ", "en": "Um, uh, so, uh, I mean, "}


def normalize(t):
    t = re.sub(r"[ً-ْـ]", "", t.lower())  # tashkeel + tatweel
    t = re.sub(r"[أإآٱ]", "ا", t)
    t = re.sub(r"[^\w]", "", t)
    return re.sub(r"(.)\1+", r"\1", t)


def run_ae(*args):
    subprocess.run([AE, *args, "--no-open", "--progress", "none"], check=True)


def silences(video, threshold, margin, min_sil):
    """auto-editor's own loudness edit, exported as a v1 timeline at 100 ticks/s."""
    with tempfile.TemporaryDirectory() as td:
        out = Path(td, "tl.json")
        run_ae(video, "--edit", f"audio:threshold={threshold}", "--margin", f"{margin}sec", "-tb", "100",
               "--export", "v1", "-o", str(out))
        chunks = json.loads(out.read_text(encoding="utf-8"))["chunks"]
    return [(a / 100, b / 100) for a, b, speed in chunks if speed != 1.0 and (b - a) / 100 >= min_sil]


def transcribe(video, lang, model, prompt):
    import whisper_timestamped as wt
    m = wt.load_model(model, device="cpu")
    audio = wt.load_audio(video)
    r = wt.transcribe(m, audio, language=lang, detect_disfluencies=True, beam_size=5, best_of=5,
                      temperature=(0.0, 0.2, 0.4, 0.6, 0.8, 1.0),
                      initial_prompt=FILLER_PROMPT.get(lang, "") + (prompt or ""))
    return [{"text": w["text"].strip(), "start": round(w["start"], 3), "end": round(w["end"], 3),
             "p": round(w.get("confidence", 1), 2)} for s in r["segments"] for w in s["words"]]


def filler_cuts(words, fillers, maybe, pad=0.03):
    cuts = []
    for i, w in enumerate(words):
        n = normalize(w["text"])
        kind = "disfluency" if w["text"] == "[*]" else "filler" if n in fillers else "maybe" if n in maybe else None
        if not kind:
            continue
        # pad a little, but never into the neighbouring real words
        lo = words[i - 1]["end"] if i else 0
        hi = words[i + 1]["start"] if i + 1 < len(words) else w["end"] + pad
        a, b = max(lo, w["start"] - pad), min(hi, w["end"] + pad)
        if b - a >= 0.05:
            cuts.append({"kind": kind, "start": round(a, 3), "end": round(b, 3), "text": w["text"], "on": kind != "maybe"})
    return cuts


def plan(a):
    video = Path(a.video).resolve()
    d = Path(a.dir or video.with_name(video.stem + "_declutter"))
    d.mkdir(parents=True, exist_ok=True)
    fillers = FILLERS | {normalize(x) for x in (a.fillers or "").split(",") if x.strip()}
    print("[declutter] transcribing (whisper-timestamped, CPU)...")
    words = transcribe(str(video), a.lang, a.model, a.prompt)
    (d / "words.json").write_text(json.dumps(words, ensure_ascii=False, indent=1), encoding="utf-8")
    print("[declutter] finding silences (auto-editor)...")
    cuts = filler_cuts(words, fillers, MAYBE - fillers)
    for s, e in silences(str(video), a.threshold, a.margin, a.min_silence):
        # soft speech can read as silence: a gap that overlaps a word starts unticked
        hit = [w["text"] for w in words if w["text"] != "[*]" and w["start"] < e - 0.05 and w["end"] > s + 0.05]
        cuts.append({"kind": "silence", "start": round(s, 3), "end": round(e, 3), "on": not hit,
                     "text": f"{e - s:.2f}s" + (f" ⚠ inside: {' '.join(hit)}" if hit else "")})
    cuts.sort(key=lambda c: c["start"])
    for i, c in enumerate(cuts):
        c["id"] = i
    (d / "plan.json").write_text(json.dumps({"source": str(video), "cuts": cuts}, ensure_ascii=False, indent=1),
                                 encoding="utf-8")
    n = {k: sum(c["kind"] == k for c in cuts) for k in ("filler", "disfluency", "maybe", "silence")}
    print(f"[declutter] {n} -> {d / 'plan.json'}. Next: declutter.py review {d}")


def review(a):
    d = Path(a.dir).resolve()
    plan_f = d / "plan.json"
    source = Path(json.loads(plan_f.read_text(encoding="utf-8"))["source"])
    page = (Path(__file__).with_name("declutter_review.html")).read_bytes()

    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *x): pass

        def send(self, code, body, ctype):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/":
                return self.send(200, page, "text/html; charset=utf-8")
            if self.path == "/plan.json":
                return self.send(200, plan_f.read_bytes(), "application/json")
            if self.path != "/video":
                return self.send(404, b"", "text/plain")
            # <video> seeking needs HTTP Range support
            size = source.stat().st_size
            m = re.match(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
            a0 = int(m.group(1) or 0) if m else 0
            b0 = min(int(m.group(2)) if m and m.group(2) else size - 1, a0 + (8 << 20) - 1, size - 1)
            self.send_response(206 if m else 200)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(b0 - a0 + 1))
            if m:
                self.send_header("Content-Range", f"bytes {a0}-{b0}/{size}")
            self.end_headers()
            with open(source, "rb") as f:
                f.seek(a0)
                try:
                    self.wfile.write(f.read(b0 - a0 + 1))
                except ConnectionError:
                    pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            p = json.loads(plan_f.read_text(encoding="utf-8"))
            on = {c["id"]: bool(c["on"]) for c in body["cuts"]}
            for c in p["cuts"]:
                c["on"] = on.get(c["id"], c["on"])
            plan_f.write_text(json.dumps(p, ensure_ascii=False, indent=1), encoding="utf-8")
            self.send(200, b"saved", "text/plain")
            if self.path == "/done":
                srv.shutdown_flag = True

    http.server.ThreadingHTTPServer.allow_reuse_address = False  # on Windows reuse lets two servers share a port
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", a.port), H)
    srv.shutdown_flag = False
    url = f"http://127.0.0.1:{srv.server_address[1]}/"
    print(f"[declutter] review at {url} - press 'Save & finish' when done", flush=True)
    webbrowser.open(url)
    while not srv.shutdown_flag:
        srv.handle_request()
    on = [c for c in json.loads(plan_f.read_text(encoding="utf-8"))["cuts"] if c["on"]]
    print(f"[declutter] saved: {len(on)} cuts on. Next: declutter.py render {d}")


def render(a):
    d = Path(a.dir).resolve()
    p = json.loads((d / "plan.json").read_text(encoding="utf-8"))
    cuts = [c for c in p["cuts"] if c["on"]]
    out = Path(a.out or d / "clean.mp4")
    args = [p["source"], "--edit", "none"]
    for c in cuts:
        args += ["--cut-out", f"{c['start']}sec,{c['end']}sec"]
    # auto-editor's default bitrate is low (~1 Mbps): keep the source detail
    run_ae(*args, "-c:v", "libx264", "-b:v", "16M", "-b:a", "256k", "-o", str(out))
    removed = sum(c["end"] - c["start"] for c in cuts)  # overlaps count twice: rough
    print(f"[declutter] {len(cuts)} cuts, ~{removed:.1f}s removed -> {out}")


def selftest(_):
    assert normalize("اممم،") == "ام" and normalize("آآآ") == "ا" and normalize("Umm,") == "um" and normalize("يَعْنِي") == "يعني"
    w = [{"text": "أنا", "start": 0, "end": 0.5}, {"text": "اممم", "start": 0.52, "end": 0.9},
         {"text": "يعني", "start": 0.95, "end": 1.2}, {"text": "[*]", "start": 1.3, "end": 1.6}, {"text": "تمام", "start": 1.62, "end": 2}]
    c = filler_cuts(w, FILLERS, MAYBE)
    assert [(x["kind"], x["on"]) for x in c] == [("filler", True), ("maybe", False), ("disfluency", True)], c
    assert c[0]["start"] == 0.5 and c[2]["end"] == 1.62, c  # padding stops at neighbour words
    print("selftest ok")


ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
sub = ap.add_subparsers(dest="cmd", required=True)
p = sub.add_parser("plan"); p.add_argument("video"); p.add_argument("--dir")
p.add_argument("--lang", default="ar"); p.add_argument("--model", default="large-v3"); p.add_argument("--prompt", default="")
p.add_argument("--threshold", type=float, default=0.04, help="auto-editor loudness threshold (0-1)")
p.add_argument("--margin", type=float, default=0.2, help="seconds of air kept around speech")
p.add_argument("--min-silence", type=float, default=0.3, help="ignore shorter silences")
p.add_argument("--fillers", help="extra words to always cut, comma separated (e.g. يعني)")
r = sub.add_parser("review"); r.add_argument("dir"); r.add_argument("--port", type=int, default=0)
o = sub.add_parser("render"); o.add_argument("dir"); o.add_argument("-o", "--out")
sub.add_parser("selftest")
a = ap.parse_args()
{"plan": plan, "review": review, "render": render, "selftest": selftest}[a.cmd](a)
