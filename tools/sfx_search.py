"""Find the right sound by describing it, across every local SFX folder (LAION CLAP).

usage:
  python sfx_search.py "soft glass ping when a card appears" [--k 5] [--dirs d1 d2 ...]
Default folders: this skill's reel/assets/sfx, HyperFrames media-use SFX, ~/.alpha-video/sfx
(put downloaded Openverse/ElevenLabs sounds there to grow the library).
Embeddings are cached in ~/.alpha-video/clap-index.npz and refreshed when files change.
First run downloads laion/clap-htsat-unfused (~600 MB).
"""
import argparse, os, subprocess, sys

import numpy as np
import torch
from transformers import ClapModel, ClapProcessor

sys.stdout.reconfigure(encoding="utf-8")
HOME = os.path.expanduser("~")
SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DIRS = [os.path.join(SKILL, "reel", "assets", "sfx"),
                os.path.join(HOME, ".claude", "skills", "media-use", "audio", "assets", "sfx"),
                os.path.join(HOME, ".alpha-video", "sfx")]
CACHE = os.path.join(HOME, ".alpha-video", "clap-index.npz")
EXT = (".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aiff")
MODEL = "laion/clap-htsat-unfused"

ap = argparse.ArgumentParser()
ap.add_argument("query")
ap.add_argument("--k", type=int, default=5)
ap.add_argument("--dirs", nargs="*", default=DEFAULT_DIRS)
a = ap.parse_args()

files = sorted(os.path.join(r, f) for d in a.dirs if os.path.isdir(d)
               for r, _, fs in os.walk(d) for f in fs if f.lower().endswith(EXT))
if not files:
    sys.exit("no sound files found in: " + ", ".join(a.dirs))
stamp = [f"{f}|{os.path.getmtime(f):.0f}" for f in files]

model, proc = ClapModel.from_pretrained(MODEL).eval(), ClapProcessor.from_pretrained(MODEL)


def load(path):  # 48 kHz mono, first 10 s
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-t", "10", "-f", "f32le", "-ac", "1", "-ar", "48000", "-"],
                         capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def vec(x):  # transformers 5 returns an output object, 4.x a tensor
    return x if torch.is_tensor(x) else x.pooler_output


cached = {}
if os.path.exists(CACHE):
    z = np.load(CACHE, allow_pickle=True)
    cached = dict(zip(z["keys"], z["emb"]))
todo = [s for s in stamp if s not in cached]
with torch.no_grad():
    for i in range(0, len(todo), 8):
        batch = todo[i:i + 8]
        inp = proc(audio=[load(s.split("|")[0]) for s in batch], sampling_rate=48000, return_tensors="pt", padding=True)
        emb = vec(model.get_audio_features(**inp))
        emb = torch.nn.functional.normalize(emb, dim=-1).numpy()
        cached.update(zip(batch, emb))
    if todo:
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        np.savez(CACHE, keys=np.array(stamp), emb=np.stack([cached[s] for s in stamp]))
    t = proc(text=[a.query], return_tensors="pt", padding=True)
    q = torch.nn.functional.normalize(vec(model.get_text_features(**t)), dim=-1).numpy()[0]

E = np.stack([cached[s] for s in stamp])
score = E @ q
for i in np.argsort(-score)[:a.k]:
    print(f"{score[i]:.3f}  {files[i]}")
