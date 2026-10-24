"""ElevenLabs from the command line: voiceover, generated sound effects, generated music.

Key: ELEVENLABS_API_KEY (and ELEVENLABS_VOICE_ID for the default voice) from the environment
or from ~/.alpha-video/.env (KEY=value lines). Never commit the key.

usage:
  python eleven.py tts "النص هنا" out.mp3 [--voice <id>] [--model eleven_multilingual_v2]
  python eleven.py tts @script.txt out.mp3
  python eleven.py sfx "glass whoosh, short, clean" out.mp3 [--sec 2] [--influence 0.4]
  python eleven.py music "warm lo-fi bed, no vocals, 90 bpm" out.mp3 [--sec 30]
  python eleven.py voices                      list voices on the account

After every tts: transcribe the file back (reel/scripts/py/transcribe.py) and check brand
names are read correctly before using the line.
"""
import argparse, json, os, sys, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
envf = os.path.join(os.path.expanduser("~"), ".alpha-video", ".env")
if os.path.exists(envf):
    for line in open(envf, encoding="utf-8"):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.strip().split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))
KEY = os.environ.get("ELEVENLABS_API_KEY")
if not KEY:
    sys.exit("Set ELEVENLABS_API_KEY (environment or ~/.alpha-video/.env).")
BASE = "https://api.elevenlabs.io/v1"


def call(path, body=None, out=None):
    req = urllib.request.Request(BASE + path, method="POST" if body is not None else "GET",
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"xi-api-key": KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs {e.code}: {e.read().decode(errors='replace')[:400]}")
    if out:
        open(out, "wb").write(data)
        print("wrote", out, f"({len(data) // 1024} KB)")
    return data


ap = argparse.ArgumentParser()
ap.add_argument("cmd", choices=["tts", "sfx", "music", "voices"])
ap.add_argument("text", nargs="?")
ap.add_argument("out", nargs="?")
ap.add_argument("--voice", default=os.environ.get("ELEVENLABS_VOICE_ID"))
ap.add_argument("--model", default="eleven_multilingual_v2")
ap.add_argument("--sec", type=float, default=None)
ap.add_argument("--influence", type=float, default=0.4)
a = ap.parse_args()

text = a.text
if text and text.startswith("@"):
    text = open(text[1:], encoding="utf-8").read().strip()

if a.cmd == "voices":
    for v in json.loads(call("/voices"))["voices"]:
        print(v["voice_id"], "-", v["name"], "-", v.get("labels", {}))
elif a.cmd == "tts":
    if not a.voice:
        sys.exit("Need --voice or ELEVENLABS_VOICE_ID.")
    call(f"/text-to-speech/{a.voice}?output_format=mp3_44100_128",
         {"text": text, "model_id": a.model, "voice_settings": {"stability": 0.5, "similarity_boost": 0.8}}, a.out)
elif a.cmd == "sfx":
    body = {"text": text, "prompt_influence": a.influence}
    if a.sec:
        body["duration_seconds"] = a.sec
    call("/sound-generation", body, a.out)
elif a.cmd == "music":
    call("/music", {"prompt": text, "music_length_ms": int((a.sec or 30) * 1000)}, a.out)
