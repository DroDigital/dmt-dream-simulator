import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { remapBrightness, cellHash, cellCovered, edgeBin, EDGE_GLYPHS, blendStyles, validate, DEFAULT_STYLE, rampIndex, lucid, gentle, type GlyphStyle } from '../src/render/glyph/schema';

describe('Glyph Suite maths', () => {
  it('remaps brightness with black/white/gamma and an S-curve', () => {
    expect(remapBrightness(0.02, 0.04, 0.9, 1, 0)).toBe(0);
    expect(remapBrightness(0.95, 0.04, 0.9, 1, 0)).toBe(1);
    expect(remapBrightness(0.47, 0.04, 0.9, 1, 0)).toBeCloseTo(0.5, 5);
    // contrast pushes values away from the middle, monotonically
    expect(remapBrightness(0.3, 0, 1, 1, 1)).toBeLessThan(0.3);
    expect(remapBrightness(0.7, 0, 1, 1, 1)).toBeGreaterThan(0.7);
    let prev = -1;
    for (let l = 0; l <= 1; l += 0.01) { const v = remapBrightness(l, 0.04, 0.9, 0.9, 0.8); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
    expect(remapBrightness(0.2, 0, 1, 1, 0, true)).toBeCloseTo(0.8);
    expect(remapBrightness(0.5, 0, 1, 2, 0)).toBeCloseTo(0.25);
  });

  it('coverage hash is stable per cell and covers the right share', () => {
    expect(cellHash(12, 34)).toBe(cellHash(12, 34));
    expect(cellHash(12, 34)).not.toBe(cellHash(34, 12));
    let n = 0;
    for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) if (cellCovered(x, y, 0.6)) n++;
    expect(n / 10000).toBeGreaterThan(0.55);
    expect(n / 10000).toBeLessThan(0.65);
    for (let i = 0; i < 50; i++) expect(cellCovered(i, 7, 1)).toBe(true);
  });

  it('quantises edge direction into | / _ \\', () => {
    const g = (gx: number, gy: number) => EDGE_GLYPHS[edgeBin(gx, gy)];
    expect(g(1, 0)).toBe('|'); // brightness changes left→right: a vertical edge
    expect(g(-1, 0)).toBe('|');
    expect(g(0, 1)).toBe('_'); // changes top→bottom (y down): a horizontal edge
    expect(g(0, -1)).toBe('_');
    expect(g(1, 1)).toBe('/'); // gradient down-right: edge rises
    expect(g(-1, 1)).toBe('\\');
    // within-bin stability around the bin centres
    expect(g(1, 0.3)).toBe('|');
    expect(g(0.3, 1)).toBe('_');
  });

  it('ramp index honours shadow lift', () => {
    expect(rampIndex(0, 10, false)).toBe(0);
    expect(rampIndex(0, 10, true)).toBe(1);
    expect(rampIndex(1, 10, false)).toBe(9);
  });

  it('blends styles numerically and switches enums at the midpoint', () => {
    const a: GlyphStyle = { ...DEFAULT_STYLE, coverage: 0, contrast: 0, mode: 'ascii', cellSizes: [12, 8, 6] };
    const b: GlyphStyle = { ...DEFAULT_STYLE, coverage: 1, contrast: 1, mode: 'blocks', cellSizes: [16, 10, 8], wind: { speed: 2, dir: [1, 0] } };
    const m = blendStyles(a, b, 0.25);
    expect(m.coverage).toBeCloseTo(0.25);
    expect(m.mode).toBe('ascii');
    expect(blendStyles(a, b, 0.75).mode).toBe('blocks');
    expect(blendStyles(a, b, 0.5).cellSizes).toEqual([14, 9, 7]);
    expect(blendStyles(a, b, 0).coverage).toBe(0);
    expect(blendStyles(a, b, 1).coverage).toBe(1);
  });

  it('lucidity calms and gentle mode softens', () => {
    const l = lucid(DEFAULT_STYLE, 2);
    expect(l.cellPx).toBe(DEFAULT_STYLE.cellPx - 2);
    expect(l.hysteresis).toBeCloseTo(DEFAULT_STYLE.hysteresis * 2.25);
    expect(l.scramble).toBe(0.25);
    const g = gentle({ ...DEFAULT_STYLE, wind: { speed: 2, dir: [1, 0] }, paper: { aberration: 0.9, flutedGlass: 0 } });
    expect(g.ripples).toBe(false);
    expect(g.wind!.speed).toBe(1);
    expect(g.paper.aberration).toBe(0.3);
  });
});

describe('glyph presets', () => {
  const dir = 'data/glyph-styles';
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  it('ships at least 16 presets including the required ones', () => {
    expect(files.length).toBeGreaterThanOrEqual(16);
    for (const req of ['desert-day', 'desert-night', 'tv-static', 'journal-print', ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => `glyph-night-${i}`)]) expect(files).toContain(req + '.json');
    expect(files.some((f) => f.startsWith('photo-'))).toBe(true);
  });
  for (const f of files) it(`${f} passes the schema`, () => {
    expect(validate(JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')))).toEqual([]);
  });
  it('the schema rejects bad presets', () => {
    expect(validate({ ...DEFAULT_STYLE, mode: 'emoji' }).length).toBeGreaterThan(0);
    expect(validate({ ...DEFAULT_STYLE, coverage: 2 }).length).toBeGreaterThan(0);
    expect(validate({ ...DEFAULT_STYLE, extra: 1 }).length).toBeGreaterThan(0);
    const { cellPx, ...missing } = DEFAULT_STYLE; void cellPx;
    expect(validate(missing).length).toBeGreaterThan(0);
  });
});
