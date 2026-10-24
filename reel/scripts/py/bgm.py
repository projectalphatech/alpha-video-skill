"""Local background music with MusicGen (facebook/musicgen-small, CPU).

usage: bgm.py <out.wav> "<prompt>" [seconds<=28] [seed]
Generates one seed clip; reel.mjs loops/crossfades it to the video length.
"""
import sys
import soundfile as sf, torch
from transformers import AutoProcessor, MusicgenForConditionalGeneration

out, prompt = sys.argv[1], sys.argv[2]
secs = float(sys.argv[3]) if len(sys.argv) > 3 else 28
seed = int(sys.argv[4]) if len(sys.argv) > 4 else 7
torch.manual_seed(seed)
proc = AutoProcessor.from_pretrained("facebook/musicgen-small")
model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small")
inputs = proc(text=[prompt], padding=True, return_tensors="pt")
audio = model.generate(**inputs, do_sample=True, guidance_scale=3.0, max_new_tokens=int(min(secs, 28) * 50))[0, 0].numpy()
sr = model.config.audio_encoder.sampling_rate
sf.write(out, audio, sr)
print("wrote", out, round(len(audio) / sr, 2), "s")
