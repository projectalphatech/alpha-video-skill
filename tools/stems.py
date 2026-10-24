"""Split any audio/video into voice and the rest with Demucs (htdemucs, CPU).

Uses:
  - clean a voice recorded over music, TV or street noise before the reel cut
  - remove the voice from a track to get a music bed
  - pull the music out of a reference video to study its beat

usage: python stems.py <input> [--out <dir>] [--model htdemucs]
writes <dir>/<name>.vocals.wav and <dir>/<name>.rest.wav (44.1 kHz stereo).
Takes about 1x-2x real time on this PC's CPU. First run downloads the model (~80 MB).
"""
import argparse, os, subprocess, sys

import numpy as np
import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("--out", default=None)
ap.add_argument("--model", default="htdemucs")
a = ap.parse_args()

out = a.out or os.path.dirname(os.path.abspath(a.src))
os.makedirs(out, exist_ok=True)
base = os.path.join(out, os.path.splitext(os.path.basename(a.src))[0])

model = get_model(a.model)
model.eval()
sr = model.samplerate
# decode with ffmpeg so any video/audio format works (no torchaudio I/O)
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", a.src, "-f", "f32le", "-ac", "2", "-ar", str(sr), "-"],
                     capture_output=True, check=True).stdout
wav = torch.from_numpy(np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.copy())
ref = wav.mean(0)
mean, std = ref.mean(), ref.std() + 1e-8
with torch.no_grad():
    stems = apply_model(model, ((wav - mean) / std)[None], device="cpu", split=True, overlap=0.25, progress=True)[0]
stems = stems * std + mean
names = model.sources  # e.g. drums, bass, other, vocals
v = names.index("vocals")
vocals = stems[v]
rest = stems.sum(0) - vocals
sf.write(base + ".vocals.wav", vocals.T.numpy(), sr)
sf.write(base + ".rest.wav", rest.T.numpy(), sr)
print("wrote", base + ".vocals.wav", "and", base + ".rest.wav", file=sys.stderr)
