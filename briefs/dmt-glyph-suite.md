# Follow-up brief: DMT Glyph Suite

This extends `briefs/dmt-dream-simulator.md`. Everything there still applies: no engine, TypeScript + three (WebGPU/TSL, pinned), no new runtime dependencies unless named here, one milestone at a time.

Run this as **milestone M2G**, after M2 is approved and before M3. Stop when M2G's verification passes, report, and wait.

---

## 1. Goal

Upgrade the basic glyph pass from M2 into a **glyph suite**: a set of real-time stylisation effects good enough that a still frame looks hand-made, at least as good as ASCII Magic's offline image filters, while running every frame on a moving 3D world at 60 fps.

**Success test:** show 5 people a mix of DMT glyph frames and offline-filtered images. At least 3 of 5 can't reliably tell which ones are real-time. Separately, a slow camera pan shows no visible character flicker.

---

## 2. Non-goals

- No dependency on ascii-magic.com or any online service.
- No new npm runtime packages. Paper shaders are **ported** into TSL (§3.9), not installed.
- No UI framework for the lab; Tweakpane only (already a dev dependency).
- No per-object glyph materials yet. The suite is a post-process per pane; a material version can come later.
- **Deferred:** extra looks (halftone, CMYK print, mosaic, brick studs, cell-scale dither modes) and the CMYK Drops Paper shader. Keep the mode switch extensible so they can be added later without refactoring.

---

## 3. Features (implement all)

All parameters live in a `GlyphStyle` object (§4) and are uniforms, so styles can blend and animate without recompiling. Work at **cell resolution** wherever possible: 8 px cells at 1080p is only 240 × 135 cells, which keeps the cost low.

### 3.1 Edge-aware characters

Shapes must keep their outlines instead of turning into noise.

- Per cell, run a Sobel filter on **linear depth** and on **normals** from the scene pass MRT, plus a difference-of-Gaussians on luminance for edges painted inside textures.
- Edge strength = max(depth edge × `edgeDepthWeight`, normal edge × `edgeNormalWeight`, DoG × `edgeLumaWeight`).
- If strength > `edgeThreshold`: compute the gradient angle, rotate 90° to get the edge direction, and quantise to 4 bins → `|` `/` `_` `\`. Otherwise use the brightness ramp.
- Atlas layout: row 0 = fill ramp, row 1 = edge glyphs, row 2+ = alternate sets (braille, blocks, custom). Build it at load from a canvas with the chosen font (VT323 by default, OFL licence).
- `edgeThickness` (1–2 cells) dilates edges by one cell when 2.

### 3.2 Blurred backdrop

A soft glow behind the characters, so the image is lush instead of black between glyphs.

- Blur the full-res scene colour at quarter resolution: dual Kawase, 4 passes, or the TSL `gaussianBlur` node, whichever is cheaper on the pinned version.
- Composite: `out = mix(backdrop × backdropStrength, glyphColour, glyphMask × glyphOpacity)`.
- `backdropMode`: `blurred` | `black` | `original` | `transparent` (alpha 0 behind glyphs, used for UI and the journal).
- `backdropStrength` 0–1, `backdropBlur` radius in cells.

### 3.3 Colour modes

`colourMode`:
- `full`: the cell's average scene colour
- `mono`: one palette key colour × brightness
- `duotone`: blend two palette colours by brightness
- `palette`: nearest of the realm's 32 palette colours
- `phosphor`: green or amber with a slight glow

`colourSaturation`, `colourBoost` and the palette colours come from the realm's current Resonance LUT, so glyph colour shifts with the dream's mood.

### 3.4 Coverage and contrast

Match ASCII Magic's intensity controls.

- Brightness remap: `l' = pow(clamp((l − black) / (white − black)), gamma)`, then an S-curve with `contrast`.
- `coverage` 0–1: the share of cells allowed to draw a glyph. Cells below the coverage threshold (by a stable per-cell hash) stay blank or backdrop-only.
- `invert` swaps the brightness mapping.
- `shadowLift` raises the darkest glyph from blank to the first ramp character, so dark areas keep texture.

### 3.5 Stable characters (no flicker)

This matters most for smoothness.

- Pick characters from a lightly pre-blurred (3 × 3) cell-brightness buffer, never raw pixels; lo-fi jitter and dither otherwise cause flicker.
- Keep a per-cell **history** (WebGPU: storage texture; WebGL 2 fallback: ping-pong render targets) holding the last glyph index and brightness.
- Only change a cell's glyph when `|l − lastL| > hysteresis` (default 0.06), or after the new choice has persisted for `holdFrames` (default 3).
- Edge glyphs use the same rule on edge direction.
- Reset history on link transitions and camera cuts.

### 3.6 Depth-sized cells

Bigger characters up close, finer ones in the distance, for depth.

- Three cell sizes (defaults 12 / 8 / 6 px) chosen by linear-depth bands (`depthNear`, `depthFar`).
- Compute all three glyph layers at their own cell resolutions and pick per pixel by depth, with a 4 × 4 Bayer-dithered boundary so the bands blend.
- Option `depthCells: false` uses one size.

### 3.7 Living text

The characters behave like part of the dream.

- **Wind:** in flagged zones (e.g. Glyph Desert sky and dunes), glyph indices cycle by `noise(cell, time × windSpeed)` within ±2 ramp steps, and the pattern scrolls along the wind direction.
- **Footstep ripples:** project each dreamer's footfalls to screen. Each spawns a ring (radius grows 0 → 6 cells over 0.6 s) where glyphs briefly scramble to random characters, then settle.
- **Gaze settle:** cells within 6° of screen centre that stay there 0.5 s get extra contrast and hysteresis ×2, so what you look at becomes calm and legible.
- **Drifting letters:** sparse characters fall slowly through the Glyph Desert sky as GPU particles rendered into the glyph layer. Not a falling-code-rain imitation: slow, sparse, wind-carried.
- Strength scales with lucidity: more lucid means calmer, sharper, fewer scrambles.

### 3.8 Modes in scope

Three character modes, sharing every feature above: `ascii`, `braille`, `blocks`. Implement the mode as a switch inside the pass so more modes can be added later (see Non-goals).

### 3.9 Ported Paper shaders

ASCII Magic's own licences page says its Aberration, Fluted Glass and CMYK Drops modes use shaders from `@paper-design/shaders` under the **Apache License 2.0**. We can use those same open shaders. This milestone ports **Aberration and Fluted Glass** only; CMYK Drops is deferred.

- Read the package's source (GitHub / npm). If it contains plain GLSL fragment code, **port** these two to TSL under `src/render/paper/`. If it doesn't, implement equivalents from scratch using the same ideas: RGB channel offset along a radial direction; vertical lens strips with refraction offset and slight blur.
- Add `NOTICE` text to `src/render/paper/NOTICE` and the in-game credits: "Paper Shaders, Copyright 2026 Paper" (or whatever the package's own notice says), with the Apache-2.0 licence text in `licenses/`.
- Do not add the npm package as a runtime dependency.

---

## 4. Style system

```ts
interface GlyphStyle {
  mode: 'ascii' | 'braille' | 'blocks';           // extensible later
  font: string; ramp: string; cellPx: number; depthCells: boolean;
  depthNear: number; depthFar: number; cellSizes: [number, number, number];
  edgeThreshold: number; edgeDepthWeight: number; edgeNormalWeight: number;
  edgeLumaWeight: number; edgeThickness: 1 | 2;
  backdropMode: 'blurred' | 'black' | 'original' | 'transparent';
  backdropStrength: number; backdropBlur: number;
  colourMode: 'full' | 'mono' | 'duotone' | 'palette' | 'phosphor';
  colourSaturation: number; colourBoost: number;
  black: number; white: number; gamma: number; contrast: number;
  coverage: number; invert: boolean; shadowLift: boolean;
  hysteresis: number; holdFrames: number;
  wind: { speed: number; dir: [number, number] } | null;
  ripples: boolean; gazeSettle: boolean;
  paper: { aberration: number; flutedGlass: number };
  glyphOpacity: number;
}
```

- Presets live in `data/glyph-styles/*.json`, validated by JSON Schema in `tools/validate-data`.
- `blendStyles(a, b, t)` interpolates numeric fields and crossfades between modes over 0.6 s (render both, mix). This is used by the glyph link transition.
- Ship **at least 16 curated presets**, including:

| Preset | Use |
|---|---|
| `desert-day` | Glyph Desert default: edge-aware ASCII, blurred backdrop, full colour, wind |
| `desert-night` | Glyph Desert, Hush quadrant: phosphor amber, low coverage |
| `tv-static` | Static Field screens: blocks, mono, scanlines |
| `glyph-night-1` … `-8` | Picked at random for the Glyph night Dream Law |
| `journal-print` | Mono ink-coloured ASCII over a transparent backdrop, laid on the journal's paper texture |
| `photo-*` | Photo-mode filters (every preset is selectable in photo mode) |

- **Lucidity link:** each frame, lerp toward a calmer variant as lucidity rises: cell size −1 px per level, hysteresis ×1.5, scramble strength ×0.5.

---

## 5. Where the suite is used

- **Glyph Desert:** whole realm, `desert-*` presets by quadrant.
- **Glyph night** (Dream Law): every realm, a random `glyph-night-*` preset per night (seeded).
- **Glyph link transition:** the departing realm blends into a glyph style, characters dissolve, and the arriving realm resolves out of them.
- **Static Field TVs and Night School screens:** render-to-texture portals pass through `tv-static`.
- **Photo mode:** every preset as a filter, with live sliders for coverage, contrast and cell size.
- **Journal:** polaroids get `journal-print`.

---

## 6. Tech and performance

- Implement in `src/render/glyph/`: `atlas.ts`, `cells.ts` (brightness + edges at cell res), `history.ts`, `compose.ts`, `modes/*.ts`, `living.ts`, `styles.ts`; Paper ports in `src/render/paper/`.
- Hook into the existing per-pane `RenderPipeline` at the "realm effects" stage (§9.2 step 6 of the main brief).
- **Budget:** full suite ≤ 1.0 ms GPU per 1080p pane on the minimum tier (Iris Xe / M1 class) with edges, backdrop, history and living text all on. ≤ 0.6 ms in the 4-player preset (cells 1 size larger, ripples off).
- Gentle mode: ripples and scrambles off, wind halved, Paper aberration capped at 0.3.
- Never exceed the photosensitivity limit: no cell may flip between near-black and near-white more than 3 times per second (enforced in `history.ts`).

---

## 7. Glyph Lab (dev tool)

Route `/glyph-lab` in dev builds:

- Test scene: a slowly turning statue (CC0 Smithsonian or Quaternius model), a Kenney room, one Poly Haven HDRI, and a scripted camera pan.
- Tweakpane panel with every `GlyphStyle` field, a preset dropdown, "shuffle" (random preset), "save preset as JSON", A/B split view (left: raw scene, right: styled), and a frame-time readout.

---

## 8. Milestone M2G: acceptance

1. All features in §3 work and are toggleable in the Glyph Lab.
2. 16+ presets ship and pass schema validation.
3. Glyph Desert, Glyph night, the glyph transition, TV screens, photo mode and journal polaroids use the suite.
4. Budget in §6 met (Inspector timeline screenshot for solo and 4-player).
5. Paper shaders ported (or reimplemented) with NOTICE and licence text in credits.
6. A 20-second capture: the Glyph Lab cycling through 8 presets, then Evening Suburb dissolving through the glyph transition into Glyph Desert with wind and footstep ripples.

## 9. Verification

- **Edge test (Playwright + pixel read-back):** render a lit cube against a flat background with `desert-day`. ≥ 90% of silhouette cells must use an edge glyph matching the silhouette direction (within one bin).
- **Stability test:** render 120 frames of the scripted slow pan with living text off. On average < 3% of cells change glyph per frame; with hysteresis off the same scene must show > 3× as many changes (proves the history works).
- **Photosensitivity test:** over the same 120 frames, no cell exceeds 3 dark↔bright flips per second.
- **Snapshot tests:** one screenshot per preset in the Glyph Lab, compared against approved baselines.
- **Unit tests (Vitest):** brightness remap, coverage hash stability, edge-direction quantisation, `blendStyles`, preset schema.
- **Performance capture:** frame-time log for the pan in solo and 4-player presets.

## 10. Open questions (defaults)

| Question | Default |
|---|---|
| Default glyph font | VT323 (OFL); add a second, more delicate font for braille/halftone presets if VT323 looks heavy |
| Edge glyph set | `\| / _ \\` plus `+` at corners where two directions meet |
| Should the lab ship in release builds? | No, dev only; its presets ship as photo-mode filters |
