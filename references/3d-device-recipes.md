# Recipes (proven on reel 2, 2026-10-24)

Source: our proof-gallery reel. Three.js r147 (vendored in the project `assets/js`), HyperFrames 0.8.192.

## 3D devices with real sites on screen

- Models: HyperFrames registry block `vfx-iphone-device` (`npx hyperframes add vfx-iphone-device`) ships `models/iphone.glb` and `models/macbook.glb` (no Draco, fully offline).
- Screen content: full-page **screenshots** as textures, not live HTML. Playwright at 390 px @3x (mobile) and 1440x900 @2x (desktop), resized to 780x6400 / 1920x1200 (safe GPU texture size). Script: `work/shoot.py`.
- Scroll = animate `texture.offset.y` from timeline time; `repeat.y = screenH/W ÷ pageH/W`.
- Screen mesh `front-glass*` (iPhone) / `display` (MacBook): replace its UVs with planar UVs from the bounding box (shipped UVs tile), `MeshBasicMaterial({map, toneMapped:false})` so the site keeps true colours.
- Orientation: registry's `alignScreenToMinusZ` + wrapper `rotation.y = PI` → screen faces the camera.

## Camera and motion (Higgsfield vocabulary, done in code)

- **Whip** between subjects: x on an expo in-out over 2 beats, plus a bump (`sin(pi*k)`) that pulls the camera back (+3 z), up (+0.7 y) and rolls it (0.07 rad).
- **Hero spin**: each new device adds `2*PI*(1-ease(k))` to its yaw as it arrives (1.25 s).
- **Finale**: devices fan (middle forward), MacBook rises behind, slow orbit.
- Every move starts/ends on the beat grid (`cues.json`).

## Depth of field and image quality

- `EffectComposer` → `RenderPass` → `BokehPass` → `GammaCorrectionShader` (r147 render targets skip the output sRGB step; without the gamma pass colours go dark).
- HalfFloat render target, renderer `NoToneMapping` on this path, pixel ratio 1.5 (supersampling).
- Focus = distance camera → active device; aperture ~0.007, maxblur ~0.026; wider during whips, smaller in the group shot.
- BokehPass outputs opaque pixels: draw the background as `scene.background` (CanvasTexture, `sRGBEncoding`), not CSS.
- Fallback: request `webgl2` explicitly; if only WebGL1 without `OES_standard_derivatives`, swap standard/physical materials for Lambert and skip post (`LITE` flag). Studio preview browsers hit this.

## Brand-blue studio (our pick, replaces white)

- Background texture: vertical `#1a6dff → #1f7bff → #1560e8`, radial light-blue key glow behind the subject, cyan floor bounce, faint amber corner.
- White text pills with blue text; white cards with deep navy shadow; props white/amber/cyan/light-blue (never brand blue on blue).
- Hex colours in r147 are read as linear: `new THREE.Color(hex).convertSRGBToLinear()` or props wash out to pastel.
- Hemisphere ground colour blue (`0x3d86ff`), shadow catcher opacity ~0.24.

## Reflective floor (keynote stage)

- `THREE.Reflector` (examples/js/objects) 80x80 at the floor, **low-res target 540x960** (soft reflection), colour `0x8aa6d6`.
- Over it a full-size fade plane: radial canvas gradient in the studio blue, alpha 0.62 centre → 1 at 40% radius, `transparent, depthWrite:false`, renderOrder below the shadow catcher. Without the full-size fade the mirror shows a hard bright band.

## Light sweep / glint (glass-product method, lemo-opuscar)

- Build a tiny **env scene**: dim blue dome (`lin(0x2a6fe0, 0.22)`), top softbox, two tall back strips, a far horizon strip, and one **sweep strip** (4.4 x 40, intensity 8, tilted 0.36 rad for a diagonal glint).
- Every frame: move the sweep strip on an arc behind the camera, `pmrem.fromScene(envScene, 0, .1, 100)`, dispose the previous target, set `scene.environment`.
- Sweep cues on the beat (2 beats each), azimuth −0.95 → +0.55.
- Screens are MeshBasic (no reflections), so add a **glass layer**: same geometry as child, `MeshPhysicalMaterial({color:0x000000, roughness:.09, envMapIntensity:1.3, transparent, AdditiveBlending, depthWrite:false, polygonOffset})` → only the reflection is added.
- **Lesson**: with roughness 0.04 and a 2.6-wide strip the glint crossed in ~0.03 s and fell between snapshot frames; with roughness 0.2 and a 7-wide strip it washed the whole screen. 0.09 / 4.4 / intensity 8 reads as a glint for ~0.1 s. Always snapshot every 0.08 s across a sweep.

## Beat sync

- `scripts/beats.py music.mp3` (librosa) → tempo, beat times, downbeat phase → `work/beats.json`.
- Snap hits to the nearest beat within ±0.3 s; keep voice lines fixed. Write all hits in `work/cues.json`; visuals (GSAP times, 3D segment bounds) and the SFX mix read the same numbers.

## Sound design (procedural)

- `scripts/sfx.py` (lemo-opuscar, MIT): whoosh, thump, ding, click, pop, limit, add(buf, x, at, gain, pan).
- `scripts/sfx_mix.py` adds: **glass shimmer** (air + inharmonic partials ×2.76, ×5.4) on sweeps, whooshes on whips, a long low whoosh on the pull-back, a **noise+saw riser** cut dead into the end card, an **808 hit** (pitch-drop sine, tanh) on the price, click+ding on badges/CTA.
- Limiter is 1-D: apply per channel. One `<audio id="sfx">` track replaces many clips.
- Voice ~10 dB over music; music `data-volume` ~0.18; master -14 LUFS.

## Voice (ElevenLabs NORA, `eleven_v4`, `language_code: ar`)

- Generate each brand name in 3-4 spellings, transcribe each with ElevenLabs `scribe_v1` (en and ar), keep the one read back correctly. Found: "كوين" → "Queen Block"; Latin "Coin Block" ✓. "إي إم" → "AM"; "E M" ✓.
- Measure durations with ffprobe and set `data-duration` from them.

## HyperFrames pitfalls met

- The Studio preview rewrites `index.html` with `data-hf-id` attributes: patch with regex, not exact strings; re-read before editing.
- `npx hyperframes` inside a project may resolve an old pinned CLI: use `npx --yes hyperframes@<version>`; `upgrade --project` bumps pins.
- `capture` gives only desktop frames: use Playwright for tall mobile screenshots.
