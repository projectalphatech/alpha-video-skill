# Lessons from the first reel (NORA "two problems", 2026-10-24)

Each lesson is something that went wrong, how it was found, and the fix now built into `reel.mjs`.

## Audio cuts
- **Cut at -33 dB with 0.1 s of air.** It clipped word endings, and listeners heard missing letters. Fix: detect silence at -36 dB, keep 0.2 s after (`cut.post`), and fail loudly if any removed gap peaks above -40 dB.
- **Last word lost its "ك".** The final consonant came as a separate quiet burst 0.2-0.3 s after the vowel, so it sat after the detected silence start. Fix: never trim after the last word, and keep `lastWord.end + 0.7 s`.
- **A 0.3 s tail dropped most jump cuts.** Short pauses (0.3-0.45 s) can no longer be cut at that length. 0.2 s plus the gap check is the balance.
- **Whisper's word end times are unreliable around pauses.** The word before a pause stretches to the next word's start. Using them as cut limits removed almost all cuts. They are only trusted within 0.35 s of a detected silence.
- **Use 30 ms audio fades at every cut** (video-use rule). 12 ms worked, but 30 ms is safer against pops.
- **ffmpeg rejects `-af` on a stream fed from `-filter_complex`.** Put the voice chain inside the graph. The graph is now written to a file and passed with `-filter_complex_script`, which also avoids Windows command-line length limits.

## Transcription
- The bundled `hyperframes transcribe` needs whisper.cpp, which is not installed here. Use faster-whisper large-v3 (CPU int8, about 2 min for 44 s) in `~/.alpha-reel/venv` (Python 3.10).
- Windows: creating a venv under the long scratchpad path fails with WinError 206 (path too long). Keep the venv at a short path.
- Windows console: printing Arabic needs `sys.stdout.reconfigure(encoding="utf-8")`.
- An initial prompt with brand terms (نورا، Project Alpha Tech، واتساب) fixes their spelling.
- Typical mishearings in Egyptian Arabic: بتبيع→بيبيع, اشترى→اشتراك, ناوية→نوعية, بيحفظ→بيحافظ. "AI" comes out as "اي اي" (merge the two). "تسأله" came out as "تسألته" and was never confirmed by ear.

## Composition / HyperFrames
- **Scene lookups grabbed the wrong word.** "العميل" appears in problem 1 and again at 24 s. `at()` found the first one, and the whole chat card animated 20 s too early, so the scene was empty. Fix: `h.at()` searches only from the scene's own beat.
- **Hosts need `data-composition-id`**, or check fails with `host_missing_composition_id`.
- **Text that wraps into a second line collided** with the "١ ٢" badges. Use `white-space:nowrap` with a smaller size for the hook title.
- **content_overlap errors on purpose-built overlaps** (a stamp over dimmed bubbles, an AI card over a bot card). Either fade the lower layer fully to 0 or mark the top element `data-layout-allow-overlap`.
- The `media-treatment` grade (WebGL) worked in the preview, but the render stalled for 30+ min with software GPU, and the encoder got no frames. Baking the grade with ffmpeg rendered in 8.5 min.
- `snapshot`, `check` and `render` time out with GPU capture on this Ryzen APU. Always pass `--no-browser-gpu`.
- `hyperframes media-use` is missing from CLI 0.8.46. Use `npx -y hyperframes@latest media-use resolve --type sfx --local-only` for the bundled SFX (now copied into the skill's `assets/sfx`).

## Look
- Backlit webcam: face Y 72, curtain Y 131. A global lift blows out the curtain. The oval face light (mask centred on the face, about 400×480 px Gaussian) got the face to 112-118 and the curtain to 176.
- In ffmpeg `eq`, contrast above about 1.1 pulls mid-tones (faces) down, and gamma above 1 lifts them. Tune gamma for the face, contrast lightly.
- Raising the black point (curves `0.07/0.045`) removes the grey haze a lift leaves.

## Music
- No HeyGen sign-in, so music comes from MusicGen-small on CPU: about 5 min for 28 s. Loop it with a 2 s crossfade to the length, fade in 0.25 s, fade out 1.6 s.
- The bed sits at gain 0.22 under a -15 LUFS voice. The final mix measured -15.6 LUFS.
- AI music was never listened to by Claude. Always ask the user to check it by ear.

## Process
- He asked for the script, then read it in his own words. Plan from the transcript.
- He gave feedback in small rounds: cut accuracy, the mascot, the last letter, brightness. Keep build fast (seconds) and the render last.
- Render takes about 8.5 min. Tell him the ETA up front, and never leave a stalled render running. Check that the encoder is getting frames (`video-only.mp4` should grow).
## Voice-only reel 01 (2026-10-25)

- **English names inside Arabic speech** (Claude Code, Codex, Gemini, install): Whisper dropped them until `--prompt` listed them.
- **Final-silence invention**: Whisper added "اشتركوا في القناة" over the last 0.5 s of silence. Drop words that start inside the final silence.
- **`silencedetect` can print a negative first start** (`-0.000583`). A `[\d.]+` regex then misaligns starts and ends, and no pause gets cut. Parse the sign.
- **Snap stretched word starts**: when a pause sits inside a word's whisper span, the word starts at the pause end. "وهتكون" was 0.35 s early.
- **RTL captions flip multi-word Latin names** ("Code Claude"). Merge them into one caption token.
- **Vertical safe band**: text stays between y 168 and 1330 px. Captions sit at y 1150. Below 1330 only decoration, here a live editor-timeline strip.
- **`hyperframes check` runtime "Navigation timeout of 10000 ms"**: pass `--timeout 30000`.
- **Layout overlap opt-outs don't inherit**: put `data-layout-allow-overlap` on the text elements themselves, not only on the card.
- **Pixabay SFX can't be redistributed** as files. The public repo ships CC0 Freesound sounds instead.
- **Openverse throttles bursts (429)**: `openverse.py` now backs off and retries.
- **Blender fails on paths over 260 characters** on Windows. Keep `--out` short.
