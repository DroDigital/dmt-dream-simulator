import { Spring } from './spring';

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Split-screen layout: 1 full, 2 side by side, 3–4 in quarters (three leaves
 * the fourth quarter to the sky mandala). Bubble panes grow with Visions and
 * chorus links and shrink when a dreamer stands still or wakes, on springs
 * over ~1.5 s, never below 20%.
 */
export class Layout {
  weights = [0, 1, 2, 3].map(() => new Spring(1, 0.45));
  colSplit = new Spring(0.5, 0.45);
  rowSplit = new Spring(0.5, 0.45);

  update(dt: number, n: number, targets: number[], bubble: boolean): Rect[] {
    const w = this.weights.map((s, i) => s.update(dt, bubble ? targets[i] ?? 1 : 1));
    if (n <= 1) return [{ x: 0, y: 0, w: 1, h: 1 }];
    if (n === 2) {
      const split = this.colSplit.update(dt, clampSplit(w[0] / (w[0] + w[1])));
      return [{ x: 0, y: 0, w: split, h: 1 }, { x: split, y: 0, w: 1 - split, h: 1 }];
    }
    const w3 = n === 3 ? 0.6 : w[3];
    const col = this.colSplit.update(dt, clampSplit((w[0] + w[2]) / (w[0] + w[1] + w[2] + w3)));
    const row = this.rowSplit.update(dt, clampSplit((w[0] + w[1]) / (w[0] + w[1] + w[2] + w3)));
    const rects = [
      { x: 0, y: 0, w: col, h: row },
      { x: col, y: 0, w: 1 - col, h: row },
      { x: 0, y: row, w: col, h: 1 - row },
      { x: col, y: row, w: 1 - col, h: 1 - row },
    ];
    return rects.slice(0, n);
  }
}

export function clampSplit(v: number) { return Math.min(0.8, Math.max(0.2, v)); }
