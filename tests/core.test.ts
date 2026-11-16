import { describe, it, expect } from 'vitest';
import { PCG32, nightSeed, visitSeed, hash32 } from '../src/core/rng';
import { Spring, AngleSpring } from '../src/core/spring';
import { encodeDreamCode, decodeDreamCode } from '../src/director/dreamcode';
import { push, cellOf, chartSecret, startRealmFor, depthOf, liveDots, PUSHES } from '../src/director/resonance';
import { baseTagTable, rollTagTable, realmWeights, chooseDestination } from '../src/director/linktable';
import { solveWfc, type Tile } from '../src/realms/wfc';
import { combinedEffects, LAWS } from '../src/data/laws';
import { EVENTS } from '../src/data/events';
import { DIARY } from '../src/data/diary';
import { VISIONS } from '../src/data/visions';
import { ACHIEVEMENTS } from '../src/data/achievements';
import { composePoem } from '../src/journal/poems';
import { Layout } from '../src/core/layout';
import { isFullMoon, dailySeed, moonAge } from '../src/director/calendar';
import { quadrantWeights, quadrantOf } from '../src/data/types';

describe('PCG32', () => {
  it('is deterministic for a seed', () => {
    const a = new PCG32(42), b = new PCG32(42);
    for (let i = 0; i < 100; i++) expect(a.nextU32()).toBe(b.nextU32());
  });
  it('differs between seeds and stays in range', () => {
    const a = new PCG32(1), b = new PCG32(2);
    expect(a.nextU32()).not.toBe(b.nextU32());
    for (let i = 0; i < 1000; i++) { const v = a.next(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('weighted picks respect zero weights', () => {
    const r = new PCG32(9);
    for (let i = 0; i < 200; i++) expect(r.weighted([0, 1, 0])).toBe(1);
    expect(r.weighted([0, 0])).toBe(-1);
  });
  it('derives night and visit seeds stably', () => {
    expect(nightSeed(123, 5)).toBe(nightSeed(123, 5));
    expect(nightSeed(123, 5)).not.toBe(nightSeed(123, 6));
    expect(visitSeed(nightSeed(1, 1), 3)).toBe(visitSeed(nightSeed(1, 1), 3));
    expect(hash32(1, 2)).not.toBe(hash32(2, 1));
  });
});

describe('springs', () => {
  it('converge without overshoot', () => {
    const s = new Spring(0, 0.1);
    let max = 0;
    for (let i = 0; i < 240; i++) max = Math.max(max, s.update(1 / 60, 1));
    expect(s.value).toBeCloseTo(1, 3);
    expect(max).toBeLessThanOrEqual(1.0001);
  });
  it('angle springs take the short way', () => {
    const s = new AngleSpring(3, 0.1);
    for (let i = 0; i < 240; i++) s.update(1 / 60, -3);
    expect(Math.abs(Math.atan2(Math.sin(s.value + 3), Math.cos(s.value + 3)))).toBeLessThan(0.01);
    expect(s.value).toBeGreaterThan(3);
  });
});

describe('dream codes', () => {
  it('round-trips seed, laws, start and deep', () => {
    const c = { seed: 0xdeadbeef, laws: ['feather', 'mirror'], start: 2, deep: true };
    const code = encodeDreamCode(c);
    expect(code).toHaveLength(12);
    expect(decodeDreamCode(code)).toEqual(c);
  });
  it('rejects typos via checksum', () => {
    const code = encodeDreamCode({ seed: 7, laws: [], start: 4, deep: false });
    const bad = (code[0] === 'A' ? 'B' : 'A') + code.slice(1);
    expect(decodeDreamCode(bad)).toBeNull();
    expect(decodeDreamCode('short')).toBeNull();
  });
});

describe('resonance chart', () => {
  it('clamps pushes to the 9×9 chart', () => {
    let r = { x: 0, y: 0 };
    for (let i = 0; i < 10; i++) r = push(r, PUSHES.vision);
    expect(r).toEqual({ x: 4, y: 4 });
    expect(cellOf(r)).toEqual({ cx: 8, cy: 8 });
    expect(depthOf({ x: 0, y: -4 })).toBe(1);
  });
  it('picks quadrant starting realms', () => {
    expect(startRealmFor({ x: 0, y: 0 })).toBe('stair');
    expect(startRealmFor({ x: -3, y: 3 })).toBe('orchard');
    expect(startRealmFor({ x: 3, y: 3 })).toBe('market');
    expect(startRealmFor({ x: -3, y: -3 })).toBe('library');
    expect(startRealmFor({ x: 3, y: -3 })).toBe('reef');
  });
  it('fades dots after 60 nights', () => {
    const dots = [{ night: 1, x: 0, y: 0 }, { night: 50, x: 1, y: 1 }];
    expect(liveDots(dots, 70)).toHaveLength(1);
  });
  it('the chart secret is a ring of eight dots round an empty cell', () => {
    const ring = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([x, y], i) => ({ night: 100 + i, x: x + 1, y: y + 1 }));
    expect(chartSecret(ring, 110)).toBe(true);
    expect(chartSecret(ring.slice(1), 110)).toBe(false);
    expect(chartSecret([...ring, { night: 109, x: 1, y: 1 }], 110)).toBe(false);
    expect(chartSecret(ring, 200)).toBe(false); // faded
  });
  it('quadrant weights sum to 1', () => {
    const w = quadrantWeights({ x: 1.3, y: -2 });
    expect(w.halo + w.bloom + w.hush + w.undertow).toBeCloseTo(1, 6);
    expect(quadrantOf({ x: 1, y: -1 })).toBe('undertow');
  });
});

describe('link table', () => {
  it('never links to the current realm', () => {
    const w = realmWeights({ tags: ['water'], current: 'stair', resonance: { x: 0, y: 0 }, lastSeenNight: {}, night: 1, table: baseTagTable() });
    expect(w.stair).toBe(0);
    expect(w.library).toBeGreaterThan(w.cathedral);
  });
  it('is deterministic per run and differs between runs', () => {
    const a = rollTagTable(1), b = rollTagTable(1), c = rollTagTable(2);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    const inp = { tags: ['paper' as const], current: 'suburb' as const, resonance: { x: 1, y: 1 }, lastSeenNight: {}, night: 3, table: a };
    expect(chooseDestination(inp, new PCG32(5))).toBe(chooseDestination(inp, new PCG32(5)));
  });
});

describe('wave-function collapse', () => {
  const tiles: Tile[] = [
    { id: 'a', weight: 1, edges: ['x', 'x', 'x', 'x'] },
    { id: 'b', weight: 1, edges: ['y', 'y', 'y', 'y'] },
  ];
  it('produces a consistent grid', () => {
    const { grid, ok } = solveWfc(tiles, 6, 6, new PCG32(3));
    expect(ok).toBe(true);
    const first = grid[0][0];
    for (const row of grid) for (const c of row) expect(c).toBe(first); // a and b can't touch
  });
  it('honours fixed cells', () => {
    const { grid } = solveWfc(tiles, 4, 4, new PCG32(3), { '2,2': 'b' });
    expect(grid[2][2]).toBe('b');
  });
});

describe('content data', () => {
  it('has the promised amounts', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(200);
    expect(LAWS.length).toBeGreaterThanOrEqual(40);
    expect(VISIONS.length).toBe(20);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(45);
    expect(DIARY.length).toBeGreaterThanOrEqual(100);
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
  });
  it('combines law effects multiplicatively', () => {
    const fx = combinedEffects(['feather', 'long']);
    expect(fx.gravity).toBeCloseTo(0.3);
    expect(fx.timer).toBe(2);
  });
  it('composes three-line poems deterministically', () => {
    const p = composePoem(['water', 'water', 'light'], 99);
    expect(p).toHaveLength(3);
    expect(composePoem(['water', 'water', 'light'], 99)).toEqual(p);
  });
});

describe('split-screen layout', () => {
  it('splits 2 and 4 dreamers and keeps panes ≥ 20%', () => {
    const l = new Layout();
    let r = l.update(1 / 60, 2, [1, 1], false);
    expect(r[0].w + r[1].w).toBeCloseTo(1);
    for (let i = 0; i < 600; i++) r = l.update(1 / 60, 4, [5, 0.1, 0.1, 0.1], true);
    for (const x of r) { expect(x.w).toBeGreaterThanOrEqual(0.199); expect(x.h).toBeGreaterThanOrEqual(0.199); }
  });
});

describe('calendar', () => {
  it('knows a real full moon and a stable daily seed', () => {
    expect(isFullMoon(new Date(Date.UTC(2024, 0, 25, 18)))).toBe(true); // 25 Jan 2024 full moon
    expect(isFullMoon(new Date(Date.UTC(2024, 0, 11, 12)))).toBe(false); // new moon
    expect(moonAge(new Date())).toBeLessThan(29.6);
    const d = new Date(Date.UTC(2026, 10, 15, 12));
    expect(dailySeed(d)).toBe(dailySeed(new Date(Date.UTC(2026, 10, 15, 3))));
  });
});
