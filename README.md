# DMT: Dream Simulator — *Dream Memory Transit*

A first-person "playable dream" for 1 to 4 dreamers on one screen: 365 nights, each 3 to 10 minutes, where touching almost anything carries you somewhere else. No engine: TypeScript on three.js (WebGPU + TSL, with a WebGL 2 fallback) and Rapier, plus a few small libraries. Everything you see and hear is generated in code at runtime: geometry, textures, music and sound effects.

The design lives in [`briefs/dmt-dream-simulator.md`](briefs/dmt-dream-simulator.md); the Glyph Suite milestone in [`briefs/dmt-glyph-suite.md`](briefs/dmt-glyph-suite.md).

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173 and click **Sleep?**. Add `?webgl` to force the WebGL 2 backend (Settings → Picture → Renderer does the same).

```bash
npm run build
```

`dist/` is a static site (the web demo / itch.io build).

### Controls

| Action | Keyboard and mouse | Gamepad |
| --- | --- | --- |
| Walk | WASD | Left stick |
| Look (smoothed) | Mouse | Right stick |
| Drift faster | Shift | L3 |
| Float (slows a fall) | Hold Space | Hold A |
| Quick 90° turn | Q / E | LB / RB |
| Interact (hold hands, carry, answer the phone, use things in the Flat) | Left click / Enter | X |
| Photo mode | F | View |
| Menu | Esc | Start |
| Leave (co-op) | Hold Backspace 2 s | Hold Start 2 s |

The design doc put both Interact and the right-hand quick turn on **E**; Interact moved to the mouse button so Q/E can stay the turns. Pads join by pressing any button in the Lantern Flat. Lie down on a futon to sleep; the night begins when every dreamer is lying down.

### Useful URL parameters (testing)

`?auto` skips the title, `&fresh` uses a throwaway save, `&realm=desert` starts a night in a realm, `&flat` stays in the Lantern Flat, `&players=2..4` adds bot dreamers for split-screen, `&law=glyphnight` forces a Dream Law, `&vision=whale` / `&event=e012` / `&watcher` trigger set pieces, `&night=120` sets the night count, `&short` makes nights 45 s. F1 opens a Tweakpane dev panel in dev builds.

## What's in the game

- **The night loop.** Sleep at the Lantern Flat → start realm picked from yesterday's Resonance → link realm to realm by touch (and, from night 10, by a 3 s gaze) → the sky brightens with the hidden breath timer → wake: the camera rises, the world dissolves, and a journal page is written.
- **The Dream Director** (`src/director/`). Night seed = hash(save seed, night); realm-visit seed = hash(night seed, link index). It uses PCG32 for all randomness. The tag → realm table is re-rolled per run. Destinations are weighted `T · A(resonance) · N(novelty) · [r ≠ current]`. Rushes, the once-per-night Watcher roll (2% + 6% × depth), Visions (1 in 40 links, 1 in 25 from night 100), dream codes (12 chars, checksummed), Afterimage replay, the Daily Dream, divergent co-op nights, the chart secret, the Threshold on night 365, cycles (New Dream+) and Endless mode.
- **16 realm builds** (`src/realms/`): the Lantern Flat hub (a window onto a parallax city, futons, journal, chart, atlas, calendar, phone, mirror, souvenirs), the 12 dream realms (Cloud Orchard, Lantern Market, Prism Cathedral, Evening Suburb, Tidal Stair, Origami Metro, Drowned Library, Static Field, Fractal Reef, The Veins, Glyph Desert, Night School), the Threshold, the hidden Orrery and the co-op Chorus Room. Each has a landmark, a quiet place, a mundane anchor, a telephone, 4 texture moods × 4 eras × palette moods, and a Deep variant. Layouts use wave-function collapse (Metro, Library, School), Poisson-disk dressing, endless wrapping (Suburb, Cathedral, School), and peripheral mutation (out-of-view objects change, at most 3 a minute).
- **Entities** (`src/entities/`): Lanternfolk (procedural, tumbling, with lantern trails), the Watcher (a walking hole of inverted static, never turns), Lantern Woman, the night train with its Paper Conductor, Drifters, Book-fish boids, the Moth Choir, the red kite, dreamer figures (Moth, Kite, Bell, Crane) and the Whale of Light.
- **Content as data** (`src/data/`): 43 Dream Laws, a 212-event deck (34 behaviours), 20 Visions, 50 achievements, 114 Dream Diary fragments and a ~460-entry Dream Atlas.
- **Lucid Lo-Fi rendering** (`src/render/`): a 480×270-class scene pass with PS1 vertex snapping, affine texture wobble, Gouraud light and fog in TSL materials. A per-pane post chain adds palette quantise + Bayer dither, bloom, god rays, eight link-transition masks, feedback trails, kaleidoscopic edge breathing, four Resonance-blended 3D LUTs, chromatic fringe, worn-tape and Watcher static, and a gentle-mode luminance clamp. A split-screen compositor draws soft seams in each dreamer's colour, an optional bubble-pane layout on springs, and the sky mandala in the empty quarter.
- **The Glyph Suite** (`src/render/glyph/`, milestone M2G): edge-aware characters, a stable per-cell history, depth-sized cells, living text, Paper-shader ports, 18 presets and the Glyph Lab. See below.
- **Local co-op for 1–4:** shared seed and timer; each dreamer links alone; follow by touching the same thing within 10 s; holding hands; chorus links; reunions; echoes in thin places; the shared telephone; per-pane audio panning; Watcher contact sends only that dreamer to a sleeping pane.
- **Generative audio** (`src/audio/`): a drone per pane tuned to the realm's root, motifs from the night's 4–6 note theme, and instruments whose mode, tempo and level blend continuously with the chart (Lydian / Mixolydian / Dorian / Phrygian). Every link family has its own synthesized sound, plus the one fixed two-note telephone ring, the Watcher's closing low-pass, quiet-place pieces and the waking room tone.
- **Journal and UI** (`src/journal/`, `src/ui/`): polaroids chosen by scoring contrast, saturation and motion once a second, printed in the `journal-print` glyph style. Also: 3-line poems from tag-keyed phrase tables, a hand-drawn chart, PNG export, the Atlas, settings, dream codes, photo mode and the photosensitivity warning.
- **Saves** in IndexedDB (`idb-keyval`): every night's seed, laws, link log, chart dots and journal page.

## The Glyph Suite (M2G)

The pipeline runs per pane, at the "realm effects" stage. The scene pass writes colour + view normals (MRT) + depth.

1. **cells** — at cell resolution: brightness from a 3×3 pre-blurred buffer; edges from a depth Laplacian, normal Sobel and luminance DoG; the gradient direction quantised to `_ \ | /`; and the cell colour in `full | mono | duotone | palette | phosphor`.
2. **history** — ping-pong targets: a glyph changes only past `hysteresis` or after `holdFrames`, edges included, and dark↔bright flips are limited to one per 0.34 s (≤ 3/s). It resets on links.
3. **compose** — three cell sizes (12/8/6) picked by depth band with a Bayer-dithered boundary. Then: stable coverage hash, wind zones, footstep ripples, gaze settle, drifting letters, lucidity calming, and `blurred | black | original | transparent` backdrops.
4. **Paper** — Fluted Glass ported to TSL from `@paper-design/shaders` (Apache-2.0, NOTICE in `src/render/paper/`). That package version has no Aberration shader, so Aberration is an original implementation of the same idea.

Presets are in `data/glyph-styles/*.json`; `npx tsx tools/validate-data.ts` checks them against the JSON Schema it writes to `data/glyph-style.schema.json`. The suite is used by Glyph Desert (`desert-*` by quadrant), the Glyph night and Braille night laws (a seeded `glyph-night-*`), the glyph link transition, TV and classroom-door screens (`tv-static`), photo mode (every preset, with coverage/contrast/cell sliders) and journal polaroids (`journal-print`).

**Glyph Lab** (dev only): `npm run dev`, then open `/glyph-lab.html` (`?ab` split view, `&scene=cube`, `&preset=…`). It has a Tweakpane panel with every field, preset dropdown, shuffle, save-as-JSON, A/B split and a frame-time readout.

## Tests

```bash
npm test
```

Vitest: PCG32, springs, dream codes, the chart and its secret, the link table, WFC, the Director (replay, codes, Watcher once per night, events, rush, Threshold, divergent co-op), layout, calendar, and the Glyph Suite maths and preset schema.

```bash
node tools/glyph-verify.mjs
```

Playwright + pixel read-back against the dev server: the edge test, stability test, photosensitivity test, per-preset snapshot baselines (`tests/baselines/glyph/`) and a frame-time log. `node tools/realms.mjs` screenshots every realm at a fixed seed.

## Deviations from the design doc, stated plainly

- **No downloaded assets.** Every mesh, texture and sound is procedural. The CC0 packs (Kenney, Quaternius, Poly Haven…) are unneeded, so there is no import pipeline or asset manifest yet; the credits list the libraries and fonts.
- **Post-processing uses a hand-built QuadMesh chain** rather than `RenderPipeline`. It is the same TSL node approach, with explicit control of the per-pane split-screen targets.
- **Not yet built:** Tone.js (raw Web Audio is used instead), bitECS (the entity counts don't need it), GPU compute particles (moths, drifters and book-fish are instanced, CPU- or vertex-driven), the Electron + steamworks.js desktop shell, the in-game F1 *level editor* (F1 is a tuning panel), Gaussian-splat memory scenes, real HRTF panning (panning is per pane and bearing-based), and "gravity is a suggestion" slope rotation.
- **The Dream Diary has 114 fragments**, cycled in a per-run shuffled order over 365 nights; the rest are meant to come from the community, as the doc plans.
- **Verified on WebGL 2 only.** Headless WebGPU in this container starts but cannot present frames, so all screenshots and pixel tests ran on the WebGL 2 backend (SwiftShader). The same TSL compiles to WGSL; check the WebGPU path on real hardware.
- **Licensing and naming risks** (the "DMT" title, trademarks) are out of scope for code. See the doc's risk table.
