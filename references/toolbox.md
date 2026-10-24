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
| 11 | ElevenLabs API | paid account | IN | `tools/eleven.py`: TTS (multilingual v2), sound generation and music. The key goes in `~/.alpha-video/.env`. |

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
| [yihui-dev/awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos) | MIT | Kept as an **idea bank**: search its `data/videos.json` (703 prompts) for a format, then adapt it. |
| [wide-trace/open-higgsfield](https://github.com/wide-trace/open-higgsfield) | none | A UI over paid AI video models. Reference only. Call the model APIs directly if live-action AI shots are ever needed. |
| browser-use/video-use | MIT | Needs an ElevenLabs key for transcription. We borrowed its rules (30 ms fades, self-check at every cut). |
| WyattBlue/auto-editor | Unlicense | A silence-cut CLI that `reel cut` covers. |
| pycodebr/heditor | - | Reel style names. Use it as a source of ideas only. |

## Higgsfield-style camera grammar

- Use named camera moves, not the word "cinematic": dolly push (reveal), crash zoom (hit), slow orbit (hero), whip pan (between scenes), crane (scale), bullet time (frozen moment).
- Keep one fixed style block and a numbered shot list. Change one variable at a time.
- Cut on action, and keep the product centred with the background blurred.
