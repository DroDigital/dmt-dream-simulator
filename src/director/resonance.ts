import type { Resonance, RealmId } from '../data/types';
import { quadrantOf } from '../data/types';
import { QUADRANT_START } from '../data/realms';

export const CHART_MIN = -4, CHART_MAX = 4;

export type PushReason =
  | 'lanternfolk' | 'vision' | 'climb' | 'fall' | 'watcher' | 'still' | 'rush' | 'samerealm' | 'reunion' | 'chorus';

export const PUSHES: Record<PushReason, Resonance> = {
  lanternfolk: { x: 0, y: 1 },
  vision: { x: 2, y: 2 },
  climb: { x: 0, y: 0.5 },
  fall: { x: 0, y: -1 },
  watcher: { x: 0, y: -2 },
  still: { x: -1, y: 0 },
  rush: { x: 2, y: 0 },
  samerealm: { x: -1, y: 0 },
  reunion: { x: 0, y: 1 },
  chorus: { x: 1, y: 0.5 },
};

export function push(r: Resonance, d: Resonance, scale = 1): Resonance {
  return {
    x: Math.min(CHART_MAX, Math.max(CHART_MIN, r.x + d.x * scale)),
    y: Math.min(CHART_MAX, Math.max(CHART_MIN, r.y + d.y * scale)),
  };
}

/** Grid cell (0..8, 0..8) for a position. */
export function cellOf(r: Resonance): { cx: number; cy: number } {
  return { cx: Math.round(r.x) + 4, cy: Math.round(r.y) + 4 };
}

/** depth: 0 at full Bright, 1 at full Deep */
export function depthOf(r: Resonance): number {
  return (CHART_MAX - r.y) / (CHART_MAX - CHART_MIN);
}

export function startRealmFor(r: Resonance): RealmId {
  if (Math.abs(r.x) < 0.75 && Math.abs(r.y) < 0.75) return 'stair';
  return QUADRANT_START[quadrantOf(r)];
}

export function average(rs: Resonance[]): Resonance {
  if (!rs.length) return { x: 0, y: 0 };
  return { x: rs.reduce((a, r) => a + r.x, 0) / rs.length, y: rs.reduce((a, r) => a + r.y, 0) / rs.length };
}

export function chebyshev(a: Resonance, b: Resonance) {
  const A = cellOf(a), B = cellOf(b);
  return Math.max(Math.abs(A.cx - B.cx), Math.abs(A.cy - B.cy));
}

export interface ChartDot { night: number; x: number; y: number; colour?: string }

/** Dots fade after 60 nights, so the chart can never be completely filled. */
export function liveDots(dots: ChartDot[], night: number): ChartDot[] {
  return dots.filter((d) => night - d.night < 60);
}

/**
 * The chart secret. Painting a particular picture with your chart dots opens
 * a hidden 13th realm. Never hinted in-game: a closed ring of eight dots
 * around any one empty cell (an "eye"), all live at once.
 */
export function chartSecret(dots: ChartDot[], night: number): boolean {
  const live = liveDots(dots, night);
  const occ = new Set(live.map((d) => { const c = cellOf(d); return c.cx * 9 + c.cy; }));
  for (let cx = 1; cx <= 7; cx++) for (let cy = 1; cy <= 7; cy++) {
    if (occ.has(cx * 9 + cy)) continue;
    let ring = true;
    for (let dx = -1; dx <= 1 && ring; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      if (!occ.has((cx + dx) * 9 + cy + dy)) { ring = false; break; }
    }
    if (ring) return true;
  }
  return false;
}
