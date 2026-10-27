# Toolbox: every repo and tool we checked (2026-10-24)

Stars and dates drift, so re-check a tool before relying on it. The licence decides whether we may use its code or assets in client work.
Verdict: **IN** = wired into this skill. **ENGINE** = installed plugin this skill drives. **REF** = ideas only, nothing copied. **OPT** = usable, needs a paid key or the owner's OK.

## Tools reviewed

| # | Tool | Licence | Verdict | How we use it |
|---|---|---|---|---|
| 1 | [leejersey/OneTake](https://github.com/leejersey/OneTake) (209★) | **none** | REF | A Chinese auto-edit system (ASR, auto cuts, Docker). Mode A's `reel cut` already does this better for Arabic. Copy no code. |
| 2 | [pyang5166/gbro-collage-broll](https://github.com/pyang5166/gbro-collage-broll) (1.5k★) | MIT | OPT | Turns script lines into paper-collage B-roll via Gemini, with 3 approval gates. Use for voiceover/talking-head B-roll when he wants an editorial look. Needs `GEMINI_API_KEY` (paid per clip). English fork: MegaTroll222/VOX-COLLAGE-BROLL. |
| 3 | [JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) (1.7k★) | MIT | REF / OPT | A p5.js + p5.brush hand-painted cartoon kit. Borrow the technique for explainer scenes. **Never use the Clawd character** (Anthropic's mascot). Use NORA or our own characters. |
| 4 | [lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) (6.4k★) | MIT code, CC BY 4.0 guides | ENGINE + IN | 59 film styles and director guides (plugin `lemo-opuscar@lemolab`). Its procedural `sfx.py` is vendored in `studio/scripts/`. Credit Lemomo when reusing guides. |
| 5 | Whisper: [openai/whisper](https://github.com/openai/whisper) (111k★) and [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) (26k★) | MIT | IN | We run **faster-whisper** large-v3 (same model, 4x faster on CPU, word timestamps): `reel/scripts/py/transcribe.py`. We do not need the original openai package. |
| 6 | [LAION-AI/CLAP](https://github.com/LAION-AI/CLAP) (2.3k★) | CC0 | IN | Text-to-audio matching. `tools/sfx_search.py` finds the right SFX in our library from a description. It runs through `transformers` (`laion/clap-htsat-unfused`), with no extra package. |
| 7 | Demucs: [adefossez/demucs](https://github.com/adefossez/demucs) (maintained fork; facebookresearch/demucs is archived) | MIT | IN | Voice/music separation. `tools/stems.py` cleans voice recorded over noise, makes a music bed from a song, or studies a reference edit's music. |
| 8/12 | Blender 5.2 LTS (installed) | GPL (output is ours) | IN | `blender/logo3d.py`: an extruded 3D title or SVG logo with studio light and an orbit, push or spin move, rendered as a transparent PNG sequence. For complex 3D devices, prefer Three.js inside HyperFrames (`3d-device-recipes.md`): it is faster to iterate and deterministic per frame. |
| 9 | [Openverse API](https://api.openverse.org) ([WordPress/openverse](https://github.com/WordPress/openverse), MIT) | per item: CC0 / CC BY / ... | IN | `tools/openverse.py`: free real SFX (Freesound), music and images. No key needed (about 100 requests a day anonymous). CC BY items need credit, which goes in `CREDITS.md` automatically. |
| 10 | "Real SFX" | - | IN | No single repo is worth it (the GitHub hits had 0 stars). Real recorded SFX come from Openverse/Freesound CC0 (#9). Save them in `~/.alpha-video/sfx` so CLAP indexes them. Generated SFX come from ElevenLabs. Synthetic SFX come from `sfx.py`. |
| - | [0xS4N4TG/papercut-explainer](https://github.com/0xS4N4TG/papercut-explainer) (90★) | MIT | IN (ported) | Remotion cut-paper explainer kit. Its camera moves and paper cuts are ported to GSAP in `studio/blocks/pa-motion.js` (notice kept in the file header), and its QA sheet idea became `reel.mjs qa`. The Remotion library itself is not used. See `camera-and-cuts.md`. |
| 13 | [WyattBlue/auto-editor](https://github.com/WyattBlue/auto-editor) | Unlicense | IN | `tools/declutter.py`: finds silences by loudness (any language) and renders the final cut list in one pass (`--edit none --cut-out a,b ...`). The pip package downloads its own binary on first run. |
| 14 | [linto-ai/whisper-timestamped](https://github.com/linto-ai/whisper-timestamped) | GPL-3.0 (we only call it, nothing vendored) | IN | `tools/declutter.py`: `detect_disfluencies=True` marks hesitations as `[*]` words. Plain Whisper drops ums, so this plus an Arabic/English filler list finds them. Uses openai-whisper weights (large-v3, ~3 GB, separate from faster-whisper's). |
| - | nyrahealth/CrisperWhisper | MIT code, **non-commercial weights** | REF | Best published filler capture, but client reels are commercial use. Arabic not proven. |
| - | louisedesadeleer/cut-video, b2bvic/declip | MIT | REF | Ideas taken: browser review before render, never pad a cut into the next word. English-only fillers, macOS-first. |
| 15 | [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp) (+ `yt-dlp-ejs` YouTube solver, Node runtime) | Unlicense | IN | `tools/fetch_ref.py` (added 2026-10-26): downloads reference reels and our own posted videos from YouTube/Instagram/TikTok/Facebook/X as H.264 mp4. It then measures shot changes with ffmpeg (`cuts.txt`, `sheet.jpg`) so we can match the pacing. Third-party videos are study-only. Sites change often, so update monthly with `pip install -U "yt-dlp[default]"`. |
| 16 | [Leonxlnx/earshot](https://github.com/Leonxlnx/earshot) (2.9k★, v0.4.0) | MIT | IN | Added 2026-10-27. Lets the agent hear audio, on CPU only. Installed at `~/.alpha-video/earshot` (Python 3.11 venv; models ~1.1 GB in `.cache/hf`). Run it with `~/.alpha-video/earshot/.venv/Scripts/python -m earshot <cmd>`. See "earshot for reels" below. |
| 17 | [lumian2015/opus-5-5-video-templates](https://github.com/lumian2015/opus-5-5-video-templates) | MIT code, fonts under their own licences (`licenses/fonts`) | REF / OPT | Added 2026-10-27. 30 HyperFrames templates remade from viral Opus 5.5 videos; all copy and colours are variables. Use as **16:9 promo starters** for client launch films, product demos and logo reveals: read `catalog.md`, copy one with `node scripts/new-video.mjs <id> <folder>`, list variables with `node scripts/vars.mjs <folder>`. Pinned to `hyperframes@0.8.96`. Only #17 and #25 are 9:16, so not for talking-head reels. Arabic font support and a local render are not tested yet. Not vendored (35 MB). |
| 11 | ElevenLabs API | paid account | IN | `tools/eleven.py`: TTS (multilingual v2), sound generation and music. The key goes in `~/.alpha-video/.env`. |

### earshot for reels

- **SFX from code (no models, seconds):** `earshot sfx list` shows the 252-sound bank. `earshot sfx render whoosh_fast/crisp -o hit.wav --seed N --dur 0.6 --apex 0.3` renders one. A new `--seed` gives a new take of the same sound, which fits the fresh-SFX-per-video rule. `earshot kit init --preset launch` and then `kit render` render a whole film's set, with measured onset and peak times for placing on cuts.
- **Check sync before posting:** `earshot timeline final.mp4` lists sound events next to the picture cuts and flags hits that land late. `earshot sheet final.mp4 -o sheet.png` draws the same as one image to read.
- **Score a finished reel:** `earshot critique final.mp4` compares it with 7 professional launch films and gives timestamped fixes. That profile is for music-led launch films. For talking-head reels, treat its loudness and sync notes as useful and ignore the "launch style" ones.
- **Pick between downloads:** `earshot rank "a soft paper swish" a.wav b.wav c.wav` sorts Openverse or ElevenLabs candidates. It overlaps with `tools/sfx_search.py`. Use sfx_search to search our library and earshot to choose between a few files.
- Each CLI call takes 20-40 s to load the models, except `sfx`, `kit` and `measure`, which load none. For more than a few calls, run one Python script with `from earshot import api`, or add `earshot mcp` as an MCP server.

## Engines and helpers already installed (driven by this skill)

| Tool | What it is |
|---|---|
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) plugin: `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `slideshow`, `remotion-to-hyperframes` | HTML to deterministic MP4. It is the render engine for both modes, with ~450 blocks, media and grading. |
| `brag`, `brag-slim` skills | A website or project into a launch video |
| HyperFrames registry `vfx-iphone-device` | Real GLTF iPhone 15 Pro Max + MacBook models |
| MusicGen small (`reel/scripts/py/bgm.py`) | Free local music bed |

## Other repos seen, not adopted

| Repo | Licence | Why not |
|---|---|---|
| [billyhetech/awesome-opus5-5-videos](https://github.com/billyhetech/awesome-opus5-5-videos) | MIT (prompts belong to their posters) | **Prompt library** (updated 2026-10-27): 2,668 Opus 5.5 video prompts in `data/videos.json`, each with `category` (motion, games-interactive, 3d-scenes, explainer, long-form, music-videos), `tech_tags`, `prompt` and the original post. Search it for a format before Mode B work, then adapt the prompt. It replaces yihui-dev/awesome-opus5-5-videos (703 prompts, same format) as our main list. |
| [prompt-motion.com](https://prompt-motion.com/) | prompts belong to their posters | **Reference gallery** (added 2026-10-25): ~230 Claude-made motion videos, each with its prompt, model, effort and category tags. Look at it before Mode B work; adapt prompts, never repost others' videos. |
| [wide-trace/open-higgsfield](https://github.com/wide-trace/open-higgsfield) | none | A UI over paid AI video models. Reference only. Call the model APIs directly if live-action AI shots are ever needed. |
| browser-use/video-use | MIT | Needs an ElevenLabs key for transcription. We borrowed its rules (30 ms fades, self-check at every cut). |
| pycodebr/heditor | - | Reel style names. Use it as a source of ideas only. |

## Higgsfield-style camera grammar

- Use named camera moves, not the word "cinematic": dolly push (reveal), crash zoom (hit), slow orbit (hero), whip pan (between scenes), crane (scale), bullet time (frozen moment).
- Keep one fixed style block and a numbered shot list. Change one variable at a time.
- Cut on action, and keep the product centred with the background blurred.
