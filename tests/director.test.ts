import { describe, it, expect } from 'vitest';
import { Director } from '../src/director/director';
import { freshSave } from '../src/core/save';
import { DREAM_REALMS } from '../src/data/types';

const fixedNow = () => new Date(Date.UTC(2026, 10, 15, 22));

describe('Dream Director', () => {
  it('begins night 1 at the Tidal Stair and advances the count at waking', () => {
    const s = freshSave(1234);
    const d = new Director(s, fixedNow);
    const n = d.beginNight('normal', 1);
    expect(n.night).toBe(1);
    expect(n.start).toBe('stair');
    expect(n.duration).toBe(6 * 60 * (n.fx.timer ?? 1));
    const rec = d.wake(['#fff'], ['stair'], ['stair']);
    expect(rec.night).toBe(1);
    expect(s.night).toBe(2);
    expect(s.nights).toHaveLength(1);
    expect(s.dots).toHaveLength(1);
  });

  it('the same seed and the same links give the same dream (Afterimage)', () => {
    const run = () => {
      const s = freshSave(77);
      const d = new Director(s, fixedNow);
      d.beginNight('normal', 1);
      const out: string[] = [];
      let cur = d.night.start;
      for (let i = 0; i < 6; i++) {
        const r = d.link(0, cur, { id: 'obj-' + i, kind: 'vending', tags: ['machine'] });
        out.push(r.realm + ':' + r.transition + ':' + r.seed);
        cur = r.realm;
      }
      return { out, laws: d.night.laws, seed: d.night.seed };
    };
    const a = run(), b = run();
    expect(a).toEqual(b);
  });

  it('replays a recorded night from its seed', () => {
    const s = freshSave(5);
    const d = new Director(s, fixedNow);
    d.beginNight('normal', 1);
    d.link(0, d.night.start, { id: 'x', kind: 'tree', tags: ['paper'] });
    const rec = d.wake(['#fff'], [d.night.start], [d.night.start]);
    const n = d.beginNight('afterimage', 1, { record: rec });
    expect(n.seed).toBe(rec.seed);
    expect(n.laws).toEqual(rec.laws);
    const before = s.night;
    d.wake(['#fff'], [n.start], [n.start]);
    expect(s.night).toBe(before); // Afterimage doesn't advance the count
  });

  it('dream codes reproduce seed and laws', () => {
    const s = freshSave(9);
    const d = new Director(s, fixedNow);
    const n = d.beginNight('normal', 1);
    const d2 = new Director(freshSave(1), fixedNow);
    const n2 = d2.beginNight('code', 1, { code: n.code });
    expect(n2.seed).toBe(n.seed);
    expect(n2.laws).toEqual(n.laws);
  });

  it('rolls the Watcher at most once per night', () => {
    const s = freshSave(3);
    s.resonance = { x: 4, y: -4 }; // fully Deep: 8% per visit
    const d = new Director(s, fixedNow);
    d.beginNight('normal', 1);
    let watchers = 0;
    for (let i = 0; i < 200; i++) if (d.visit('veins', i, 0, 1, new Set()).watcher) watchers++;
    expect(watchers).toBe(1);
  });

  it('draws 1–3 events per visit, respecting realm and co-op limits', () => {
    const s = freshSave(11);
    const d = new Director(s, fixedNow);
    d.beginNight('normal', 1);
    for (let i = 0; i < 30; i++) {
      const ctx = d.visit('desert', i, 0, 1, new Set());
      expect(ctx.events.length).toBeGreaterThanOrEqual(1);
      expect(ctx.events.length).toBeLessThanOrEqual(3);
      for (const e of ctx.events) { if (e.realms) expect(e.realms).toContain('desert'); expect(e.coop ?? 0).toBeLessThanOrEqual(1); }
    }
  });

  it('a rush (5 links in 60 s) pushes Alive', () => {
    const s = freshSave(13);
    const d = new Director(s, fixedNow);
    d.beginNight('normal', 1);
    const x0 = d.night.resonance[0].x;
    let cur = d.night.start;
    for (let i = 0; i < 5; i++) { d.tick(2); cur = d.link(0, cur, { id: 'o' + i, kind: 'k', tags: ['light'] }).realm; }
    expect(d.night.resonance[0].x).toBeGreaterThan(x0);
  });

  it('opens the Threshold on night 365 once all realms are seen', () => {
    const s = freshSave(21);
    s.night = 365;
    s.seenRealms = [...DREAM_REALMS];
    const d = new Director(s, fixedNow);
    expect(d.beginNight('normal', 1).start).toBe('threshold');
  });

  it('divergent co-op nights start dreamers apart', () => {
    const s = freshSave(31);
    const d = new Director(s, fixedNow);
    d.beginNight('normal', 2);
    d.night.resonance = [{ x: -4, y: 4 }, { x: 4, y: -4 }];
    d.wake(['#f00', '#0f0'], ['stair', 'stair'], ['stair', 'stair']);
    expect(s.divergent).not.toBeNull();
    const n = d.beginNight('normal', 2);
    expect(n.starts[0]).not.toBe(n.starts[1]);
  });
});
