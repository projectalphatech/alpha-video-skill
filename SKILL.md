---
name: alpha-video
description: One skill for making videos with an AI coding agent, fully in code. (A) Your own recording - a talking-head video OR a voice-only audio note, Arabic or English - becomes a finished vertical reel with tight cuts, word-by-word captions, animated scenes synced to your words, SFX and music. (B) A video from nothing - motion graphics, launch videos, explainers, slideshows, 3D device shots, Blender 3D titles - rendered with HyperFrames. Includes tools for transcription (Whisper), voiceover/SFX/music (ElevenLabs), free real sound effects and images (Openverse/Freesound), voice/music separation (Demucs), finding sounds by description (CLAP) and Blender. Use whenever the user wants a video, reel, edit, captions, B-roll, motion graphic, launch video, voiceover, sound effects, a music bed or a 3D title - even if they only paste a file path or a URL.
---

# alpha-video

Pick the mode, then follow the shared pipeline. `SKILL` = this folder. Python tools use one env: `PY=~/.alpha-reel/venv/Scripts/python.exe` (Windows) or `~/.alpha-reel/venv/bin/python`.
First time on a machine: `node SKILL/reel/scripts/reel.mjs setup` (needs ffmpeg, Node 20+, Python 3.10-3.12).

## Step 0: which mode?

| The user gives | Mode |
|---|---|
| A video of themselves talking | **A1. Talking head**: the `reel/` engine |
| An audio file of their voice (voice note, podcast clip) | **A2. Voice only**: full-screen scenes driven by the words |
| A website, product or idea, with no footage | **B. Code only**: HyperFrames |

Before building any video, write a 5-line brief: goal, hook, proof, call to action, format. Then confirm the plan with the user. **Understand the recording first**: transcribe it, read every line and map it to beats before designing anything.

## Mode A1: talking head

`node SKILL/reel/scripts/reel.mjs <step> --dir <project>`. Per-video choices live in the project's `reel.config.mjs`. Worked example: `reel/templates/reel.config.mjs`.

0. Long or messy take (ums, اممم, آآ, long pauses)? Declutter it first, then use `clean.mp4` as the video:
   `PY -I SKILL/tools/declutter.py plan <video>`, then `review <video>_declutter` (the user ticks cuts in the browser and presses Save & finish; run it in the background and wait), then `render <video>_declutter`. Never render before the user saves the review.
   Whisper cannot spell English words inside Arabic speech, so `[*]` "hesitations" can be real words ("AI agent" was cut once). Play every `[*]` in review. Silences that overlap a word start unticked.
   Always ask for the original phone file (sent as a document). WhatsApp copies are ~464 px wide and look soft once zoomed into the split screen.
   Graphics on top, speaker at the bottom: `layout: "camBottom"` in the config. A take with few jump cuts gets its zoom rhythm from `zoomCuts: (h, B) => [...]`. Use `grade.denoise: false` on phone footage.
1. Run `init "<video>" <projectDir>`. Then set `face: {x, y}` from `assets/face-check.jpg`.
2. Run `transcribe`. Read `transcript.md`: the transcript is the script. Add `fixes` and `merges` for misheard words.
3. Plan the beats and one scene per beat with the user. Write the config.
4. Run `cut`, then `music`, then `build`, then `check` (0 errors), then `snap`. Read the contact sheets and fix.
5. Preview with `npx hyperframes preview`. Once the user approves, run `render`. It verifies loudness, true peak and pops at cuts.

## Mode A2: voice only

1. Transcribe with a `--prompt` that lists the English names in the speech (tools, brands). Whisper drops or mishears them inside Arabic otherwise.
2. Drop words that start inside the final silence (Whisper invents "subscribe to the channel" there).
3. Tighten pauses over 0.4 s down to ~0.28 s: keep 0.2 s after the voice drops, plus 30 ms fades. Snap word starts that Whisper stretched into a pause to the pause end.
4. Voice chain: high-pass 80 Hz, light FFT denoise, compressor 3:1, presence +2 dB at 3.5 kHz, loudnorm -15 LUFS.
   Steps 2-4 in one command: `python -I SKILL/tools/voice_prep.py <audio> raw_words.json --fixes fixes.json`.
5. Build a HyperFrames 1080x1920 project: one scene per beat, each element timed to its word, plus one captions host.
6. Run `npx hyperframes check --json --timeout 30000` (0 errors), then snapshots, then preview, then render.
7. RTL captions: merge multi-word Latin names (e.g. "Claude Code") into one token, or their order flips.

## Mode B: code only (HyperFrames)

Engine: [HyperFrames](https://github.com/heygen-com/hyperframes) (`npx hyperframes`). Install its agent skills too: they hold the render contract.
- Launch video from a site: `npx hyperframes capture <url>`, then build.
- 3D phone/laptop with real screens: `references/3d-device-recipes.md`.
- 3D title or logo: Blender, below.
- Film looks: [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) styles.
- References before building: [prompt-motion.com](https://prompt-motion.com/) is a gallery of Claude-made motion videos with the prompt behind each one. Filter by category (Product UI, Phone, Charts, Diagrams, Kinetic type, Particles, Code...), watch 2-3 close to the brief, then adapt their prompts. Each page is server-rendered: `curl -sL https://prompt-motion.com/<slug>` holds the prompt text; the home page lists every `/<slug>`.

Pipeline: story, then look, then build, then voice, then music, then beat grid, then SFX on cues, then check/snap, then the user's OK, then render (-14 LUFS).
Use named camera moves instead of the word "cinematic": dolly push, crash zoom, slow orbit, whip pan.

## Toolbox

| Need | Command (from SKILL) |
|---|---|
| Transcribe, word timings | `PY reel/scripts/py/transcribe.py <media> words.json transcript.md --lang ar --prompt "names"` |
| Cut fillers + silences (review first) | `PY -I tools/declutter.py plan <video> --prompt "names"`, then `review <dir>`, then `render <dir>`. `--fillers "يعني"` always cuts a word |
| Voiceover | `PY tools/eleven.py tts @script.txt voice.mp3`. Transcribe it back to check names |
| Generated SFX / music | `PY tools/eleven.py sfx "glass whoosh" out.mp3 --sec 2` / `music "<prompt>" bed.mp3 --sec 30` |
| Free real SFX (CC0) | `python tools/openverse.py audio "camera shutter" --cc0 --max-sec 4 --get 1 --out ~/.alpha-video/sfx` |
| Free images (CC) | `python tools/openverse.py image "<query>" --get 2 --out assets/img`. Credits go to `CREDITS.md` |
| Find a sound by description | `PY tools/sfx_search.py "soft pop when a card appears"` (CLAP) |
| Local music bed | `PY reel/scripts/py/bgm.py out.wav "<prompt>" 28` (MusicGen, ~5 min CPU) |
| Beat grid / procedural SFX | `PY studio/scripts/beats.py <music>` gives `cues.json`; `studio/scripts/sfx_mix.py` |
| Split voice and music | `PY tools/stems.py <file>` (Demucs) |
| 3D title | `blender -b --factory-startup -P blender/logo3d.py -- --text "..." --out <short dir>`, then a VP9-alpha webm |

Keys (optional) live in `~/.alpha-video/.env`: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`. Never commit them.

## Rules

- Never cut a word's tail. Cut on audio level, not on Whisper word ends.
- No invented numbers, testimonials or names on screen.
- Use only licensed assets: MIT/CC0/CC BY/OFL, or your own generated ones. Credit CC BY.
- Look at frames around every cut before the final render. A fast effect can fall between frames.
- Vertical text stays between y 168 and 1330 px, because the app's UI covers the rest.
- On Windows, render with `--no-browser-gpu` if GPU capture times out. Keep Blender output paths short (under 260 characters).

More: `references/reel-lessons.md` (why each reel rule exists), `references/toolbox.md` (every tool reviewed, with licences).
