# Camera moves and cuts

Pick a move by the story beat, never at random. Each scene gets one camera move. Each cut gets its own SFX.

Two sources:

- **`PA.*`**: `studio/blocks/pa-motion.js`. GSAP helpers ported from [papercut-explainer](https://github.com/0xS4N4TG/papercut-explainer) (MIT) and restyled in our pink/yellow/lime look. The reel engine inlines this file into every scene, so scene `js` can call `PA.*` with its own `tl`. In a Mode B project, copy the file next to `index.html` and load it with `<script src="pa-motion.js">` after GSAP.
- **Registry**: `npx hyperframes add <name>`. Paper-Cut's other moves already exist there, so they are not ported. Read the snippet header after you add one.

Demo of every `PA` block: `studio/blocks/demo.html`. Copy it as `index.html`, with `pa-motion.js`, into a blank HyperFrames project.

## Camera moves

Signature: `PA.move(tl, el, at, opts)`, with times in seconds. It returns `{ at, sfx }`: put a sound matching `sfx` at `at`. Each move sets transforms or filters on `el`. To stack two moves, give each its own wrapper div.

| Beat | Move | Call |
|---|---|---|
| A number or joke lands | snap zoom: 4-frame punch-in, blur, shake, roll | `PA.snapZoom(tl, el, at, {x, y, to: 1.25})` |
| Scale reveal, "meanwhile, below" | crane through a tall set, vertical motion blur | `PA.crane(tl, world, at, {dur, height, mode: "drop" or "rise", layers: [{el, z}]})` |
| Things going wrong | dutch tilt with judder | `PA.dutchTilt(tl, el, at, {deg: 10, dur, back: true})` |
| "A tiny world", miniature | tilt shift: blurred bands over the scene | `PA.tiltShift(tl, host, at, {focus: 0.5, band: 0.3})` |
| Emphasis without moving | focus pulse | `PA.focusPulse(tl, el, at, {dur: 0.6})` |
| Reveal of a key number | focus hunt: hard push-in while the lens hunts | `PA.focusHunt(tl, el, at, {dur, amount, x, y})` |
| Scene change in one set, depth | foreground pass: blurred leaf, card or bar wipes the lens | `PA.foregroundPass(tl, host, at, {kind: "leaf"})` |
| Spying, privacy, "your competitor" | POV mask: keyhole, lens, binoculars or phone | `PA.povMask(tl, host, at, {kind, target: el, dur})` |
| Establishing shot, layered set | parallax orbit | `PA.orbit(tl, [{el, z: 0}, {el, z: 0.5}, {el, z: 1}], at, {dur, yaw: 16, push: 1.08})` |
| Slow push for focus | registry `push-in` | |
| Show scale from a detail | registry `pull-back-reveal` | |
| "Oh no" realisation | registry `camera-dolly-zoom` | |
| Pull focus between two planes | registry `rack-focus`, `focus-rack` | |
| Tense or handheld scene | registry `camera-shake` | |
| List, lineup, comparison | registry `pan-stations` | |
| Meme freeze | registry `freeze-frame-dressing`, `beat-freeze-cut` | |
| Speed ramp | registry `beat-freeze-cut` | |

## Cuts

Signature: `PA.cut(tl, out, inn, at, opts)`. `out` and `inn` are full-frame siblings in one composition. `inn` is transparent before the cut and `out` after it. The blocks use opacity, never visibility: a child set to `visibility: visible` shows through its hidden HyperFrames clip.

| Beat | Cut | Call / item |
|---|---|---|
| Default cut | tape pull: a taped strip yanks the scene off | `PA.tapePull(tl, out, inn, at, {label: "NEXT"})`, SFX tape peel |
| Verdict, approval, "done" | stamp cut: a stamp slams and its ink window opens onto the next scene | `PA.stampCut(tl, out, inn, at, {x, y})`, SFX stamp |
| Next step, new chapter | page turn | `PA.pageTurn(tl, out, inn, at, {from: "right"})`, SFX page flip |
| Fast topic switch | registry `whip-pan-cut` (or the `whip-pan` shader) | SFX whip |
| Going inside a screen | registry `zoom-through-transition`, `parallax-device-dive` | SFX zoom |
| Something breaks, "ripped off" | registry `torn-paper-rip` | SFX rip |
| Sneaking in, heist | registry `iris-reveal`, `sdf-iris` | SFX click |
| Burn it down | registry `ridged-burn` | SFX burn |

Not ported (too heavy for what they add): Paper-Cut's `infiniteZoom` (Droste), `popUpBook`, `TimeRamp` clock remap.

In the reel engine scenes do not overlap. Inside one scene, put the cut between two divs of that scene's stage.

## QA pass (from papercut-qa)

1. `node SKILL/reel/scripts/reel.mjs qa <from>-<to> [step] --dir <project>` gives a time-labelled contact sheet. It works on any HyperFrames project.
   - For a cut, check every frame around it: `qa 22.4-22.9 0.033`.
   - For a scene, use its range with step about length / 6.
   - Read `snapshots/qa-<from>-<to>/contact-sheet*.jpg`. Keep fixes to two rounds per scene.
2. Check:
   - [ ] Every scene has one camera move that fits its beat, and something always moves (no dead frames).
   - [ ] A visual event lands on every stressed word, about one every 0.4-0.8 s.
   - [ ] Every cut has its SFX on the returned `at`. Use at most one page turn or tear per video. Use a tape pull or whip into the CTA.
   - [ ] No move pushes key text out of y 168-1330 or under the captions.
   - [ ] Shakes, tilts and orbits never show an uncovered edge (look at the frames right after the hit).
   - [ ] Frame 0 shows the hook mid-action, never an empty set.
