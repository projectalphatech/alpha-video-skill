# Beat grid from a music file -> work/beats.json (tempo, beat times, downbeat phase).
# Needs librosa (use a venv: python -m venv work/.venv && work/.venv/Scripts/pip install librosa soundfile).
# Usage: work/.venv/Scripts/python -I <skill>/scripts/beats.py assets/music.mp3 [seconds]
import json, sys
import numpy as np
import librosa

path = sys.argv[1]
dur = float(sys.argv[2]) if len(sys.argv) > 2 else 60
y, sr = librosa.load(path, sr=22050, mono=True, duration=dur)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
tempo = float(np.atleast_1d(tempo)[0])
on = librosa.onset.onset_strength(y=y, sr=sr)
times = librosa.times_like(on, sr=sr)
strength = [float(on[np.argmin(abs(times - b))]) for b in beats]
phase = max(range(4), key=lambda k: np.mean(strength[k::4]))  # strongest of 4 offsets = downbeats
out = {"tempo": tempo, "beats": [round(float(b), 3) for b in beats], "downbeat_phase": phase,
       "bars": [round(float(b), 3) for b in beats[phase::4]]}
json.dump(out, open("work/beats.json", "w"), indent=1)
print("tempo", round(tempo, 2), "| bars", out["bars"][:12])
