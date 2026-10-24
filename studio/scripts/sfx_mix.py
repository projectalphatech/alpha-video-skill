# Builds the whole SFX layer as one stereo track (assets/audio/sfx.wav), every sound on its cue.
# Recipes follow lemo-opuscar's glass-product sound palette: glass shimmer on light sweeps,
# whooshes on camera whips, a noise riser into the end card, an 808-style hit on the price.
# Usage (project root, with work/cues.json): work/.venv/Scripts/python -I <skill>/scripts/sfx_mix.py
# Template from reel 2: edit the cue section to match your film.
import json, sys, pathlib
import numpy as np
import soundfile as sf
sys.path.insert(0, str(pathlib.Path(__file__).parent))  # sfx.py sits next to this script
import sfx as S  # vendored from lemo-opuscar (MIT)

C = json.load(open("work/cues.json", encoding="utf-8"))
SR = S.SR
buf = np.zeros((int(C["duration"] * SR), 2), dtype=np.float64)


def shimmer(d=1.0, v=1.0, f0=1760):
    """Glass shimmer: band-passed air + inharmonic glass partials (x2.76, x5.4), swelling then fading."""
    tt = S.t_(d)
    air = S.bp(S.noise(d), 4000, 11000) * np.sin(np.pi * tt / d) ** 2 * .35
    tone = sum(a * np.sin(2 * np.pi * f0 * k * tt + p) * S.env_exp(d, tau)
               for k, a, tau, p in [(1, 1, .5, 0), (2.76, .55, .32, 1.3), (5.4, .3, .18, 2.1)])
    tone *= np.minimum(1, tt / .02)  # soft attack, no click
    return S.norm(air + tone * .6) * v


def riser(d=1.0, v=1.0):
    """Noise + saw riser: band-pass sweeps up, level grows exponentially, cut dead at the end."""
    tt = S.t_(d); n = S.noise(d); out = np.zeros_like(n)
    for i in range(0, len(n), 480):
        hi = min(len(n), i + 480); f = 400 + 5600 * (i / len(n)) ** 2
        out[i:hi] = S.bp(n[max(0, i - 2000):hi], f * .7, f * 1.4)[-(hi - i):]
    saw = 2 * ((np.cumsum(180 + 900 * (tt / d) ** 2) / SR) % 1) - 1
    return S.norm((out + .25 * S.lp(saw, 3000)) * (tt / d) ** 2.2) * v


def hit808(v=1.0, f=52):
    """Bass hit: sine with a pitch drop, soft saturation, plus a thump transient."""
    d = .9; tt = S.t_(d)
    sub = np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f * (1 + 1.6 * np.exp(-tt / .03))) / SR)) * S.env_exp(d, .32)
    th = np.zeros_like(sub); k = S.thump(1, 70); th[:len(k)] = k[:len(sub)]
    return S.norm(sub + .6 * th) * v


# hook: punchy thump + pop on frame 0
S.add(buf, S.thump(1.0, 60), C["hook"] + .02, .55)
S.add(buf, S.pop(1.0), C["hook"] + .05, .25)
# glass shimmer on every light sweep, panned with the strip (right to left)
for i, t in enumerate(C["sweeps"]):
    S.add(buf, shimmer(1.1, 1.0, 1760 if i % 2 == 0 else 1975), t, .22, pan=.35)
# label chips: soft ding as the "Live" badge pops
for t in C["labels"]:
    S.add(buf, S.ding(1.0), t + .3, .12, pan=-.2)
    S.add(buf, S.click(1.2, 1.0), t, .18)
# camera whips: whoosh across the move, panned in travel direction
for a, b in C["whips"]:
    S.add(buf, S.whoosh(b - a, 1.0), a, .5, pan=.4)
# finale pull-back: long low whoosh
a, b = C["finale"]
S.add(buf, S.lp(S.whoosh(1.4, 1.0), 2500), a, .45)
# riser into the end card, cut dead on the downbeat, then the 808 + price slam
a, b = C["riser"]
S.add(buf, riser(b - a, 1.0), a, .32)
S.add(buf, S.thump(1.0, 55), C["endcard"], .45)
S.add(buf, hit808(1.0), C["price_hit"], .7)
S.add(buf, S.click(.9, 1.0), C["price_hit"], .35)
S.add(buf, shimmer(1.4, 1.0, 1568), C["sample"], .14, pan=-.3)
# CTA: click + ding
S.add(buf, S.click(1.0, 1.0), C["cta"], .3)
S.add(buf, S.ding(1.0), C["cta"] + .05, .14)

out = np.stack([S.limit(buf[:, ch] * .9) for ch in (0, 1)], axis=1)  # limiter is 1-D: per channel
pathlib.Path("assets/audio").mkdir(parents=True, exist_ok=True)
sf.write("assets/audio/sfx.wav", np.clip(out, -1, 1), SR, subtype="PCM_16")
print("sfx.wav", round(len(buf) / SR, 2), "s, peak", round(float(np.abs(out).max()), 3))
