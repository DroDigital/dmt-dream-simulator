// A small wave-function-collapse solver for grid layouts. Realms rebuild
// their paths, rooms and heights from modular pieces every run.
import { PCG32 } from '../core/rng';

export interface Tile {
  id: string;
  weight: number;
  /** edge sockets: [north, east, south, west] */
  edges: [string, string, string, string];
}

const OPP = [2, 3, 0, 1];
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export interface WfcResult { grid: string[][]; ok: boolean }

export function solveWfc(tiles: Tile[], w: number, h: number, rng: PCG32, fixed: Record<string, string> = {}, maxTries = 12): WfcResult {
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const r = attemptSolve(tiles, w, h, rng, fixed);
    if (r) return { grid: r, ok: true };
  }
  // fall back: fill with the heaviest tile
  const best = [...tiles].sort((a, b) => b.weight - a.weight)[0].id;
  return { grid: Array.from({ length: h }, () => Array(w).fill(best)), ok: false };
}

function attemptSolve(tiles: Tile[], w: number, h: number, rng: PCG32, fixed: Record<string, string>): string[][] | null {
  const n = tiles.length;
  const compat: boolean[][][] = tiles.map((a) => [0, 1, 2, 3].map((d) => tiles.map((b) => a.edges[d] === b.edges[OPP[d]])));
  const cells: boolean[][] = Array.from({ length: w * h }, () => Array(n).fill(true));
  const collapsed = new Array(w * h).fill(false);

  const propagate = (start: number): boolean => {
    const stack = [start];
    while (stack.length) {
      const c = stack.pop()!;
      const cx = c % w, cy = Math.floor(c / w);
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        let changed = false;
        for (let t = 0; t < n; t++) {
          if (!cells[ni][t]) continue;
          let ok = false;
          for (let s = 0; s < n; s++) if (cells[c][s] && compat[s][d][t]) { ok = true; break; }
          if (!ok) { cells[ni][t] = false; changed = true; }
        }
        if (changed) {
          if (!cells[ni].some(Boolean)) return false;
          stack.push(ni);
        }
      }
    }
    return true;
  };

  for (const [k, id] of Object.entries(fixed)) {
    const [x, y] = k.split(',').map(Number);
    const i = y * w + x;
    const ti = tiles.findIndex((t) => t.id === id);
    if (ti < 0) continue;
    cells[i] = cells[i].map((_, j) => j === ti);
    collapsed[i] = true;
    if (!propagate(i)) return null;
  }

  for (;;) {
    let best = -1, bestE = Infinity;
    for (let i = 0; i < w * h; i++) {
      if (collapsed[i]) continue;
      let sum = 0, cnt = 0;
      for (let t = 0; t < n; t++) if (cells[i][t]) { sum += tiles[t].weight; cnt++; }
      if (cnt === 0) return null;
      const e = cnt + rng.next() * 0.1 - sum * 0.001;
      if (e < bestE) { bestE = e; best = i; }
    }
    if (best < 0) break;
    const opts = cells[best].map((ok, t) => (ok ? tiles[t].weight : 0));
    const pick = rng.weighted(opts);
    if (pick < 0) return null;
    cells[best] = cells[best].map((_, t) => t === pick);
    collapsed[best] = true;
    if (!propagate(best)) return null;
  }
  const grid: string[][] = [];
  for (let y = 0; y < h; y++) {
    grid.push([]);
    for (let x = 0; x < w; x++) grid[y].push(tiles[cells[y * w + x].findIndex(Boolean)].id);
  }
  return grid;
}
