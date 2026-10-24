# alpha-video

One agent skill for making videos in code: your own recording (video or voice note) into a finished vertical reel, or a full motion-graphics video from nothing. It works with **Claude Code, Codex and Gemini CLI**.

It bundles a reel engine (cuts, captions, scenes, music, verified render) and tools for transcription (Whisper), voice/SFX/music (ElevenLabs), free CC0 sound effects and images (Openverse/Freesound), voice-music separation (Demucs), sound search by description (CLAP) and 3D titles (Blender). Rendering uses [HyperFrames](https://github.com/heygen-com/hyperframes).

Made by [Project Alpha](https://projectalpha.tech).

## Install

Clone it into your agent's skills folder:

```bash
# Claude Code
git clone https://github.com/projectalphatech/alpha-video-skill ~/.claude/skills/alpha-video
# Codex
git clone https://github.com/projectalphatech/alpha-video-skill ~/.codex/skills/alpha-video
# Gemini CLI
git clone https://github.com/projectalphatech/alpha-video-skill ~/.gemini/skills/alpha-video
```

One-time setup. It needs ffmpeg, Node 20+ and Python 3.10-3.12, and downloads about 1.5 GB of models:

```bash
node ~/.claude/skills/alpha-video/reel/scripts/reel.mjs setup
```

Optional: install Blender for 3D titles. For ElevenLabs, put these lines in `~/.alpha-video/.env`:

```
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
```

## Use

Ask your agent, for example:
- "Make a reel from `my-recording.m4a`"
- "Edit this talking-head video into a vertical reel with captions"
- "Make a 20 s launch video for https://example.com"

Or call the skill by name: `/alpha-video` in Claude Code, `$alpha-video` in Codex.

## Layout

| Folder | What |
|---|---|
| `reel/` | Reel engine: cut, captions, scenes, music, render, verify |
| `tools/` | Openverse, ElevenLabs, Demucs, CLAP |
| `studio/scripts/` | Beat grid, procedural beat-locked SFX |
| `blender/` | Headless Blender 3D title renderer |
| `references/` | Lessons, 3D recipes, tool reviews |

## Licence

MIT (see `LICENSE`).
- Readex Pro font: SIL OFL 1.1.
- `studio/scripts/sfx.py`: from [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) (MIT).
- Bundled SFX: CC0 from Freesound (`reel/assets/sfx/CREDITS.md`).
