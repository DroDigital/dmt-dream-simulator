import type { Quadrant, RealmId } from '../data/types';

export const QUADRANT_PALETTES: Record<Quadrant, string[]> = {
  halo: ['#FFF4E6', '#FFC9DE', '#BDE7FF', '#D9C8FF', '#FFE7A3'],
  bloom: ['#FF3D7F', '#FFB000', '#00E0C6', '#7A5CFF', '#FFF27A'],
  hush: ['#0E1A24', '#2E5E6E', '#8FB8B0', '#C9D6D2', '#E8C27A'],
  undertow: ['#0A0614', '#FF2E9A', '#19F0FF', '#6B1FFF', '#B6FF3B'],
};

/** Colour-blind-safe alternatives (Okabe–Ito derived), chosen in settings. */
export const CB_PALETTES: Record<Quadrant, string[]> = {
  halo: ['#FFF4E6', '#F0E442', '#56B4E9', '#CC79A7', '#E69F00'],
  bloom: ['#E69F00', '#F0E442', '#0072B2', '#56B4E9', '#FFFFFF'],
  hush: ['#0E1A24', '#0072B2', '#56B4E9', '#C9D6D2', '#E69F00'],
  undertow: ['#0A0614', '#D55E00', '#56B4E9', '#0072B2', '#F0E442'],
};

/** Each realm's own base palette (5 colours) that quadrant moods tint. */
export const REALM_PALETTES: Record<RealmId, string[]> = {
  flat: ['#3a2c3f', '#e9c9a0', '#f6e7cf', '#9f6a5a', '#ffb86b'],
  orchard: ['#fff6ec', '#ffd3e6', '#bfe8ff', '#cdb8ff', '#b9f2c7'],
  market: ['#26123a', '#ff5d8f', '#ffb347', '#3de0c8', '#fff27a'],
  cathedral: ['#efe8ff', '#b7a6ff', '#ffd6a5', '#9fe2ff', '#ff9fd1'],
  suburb: ['#f5b77a', '#d86d5b', '#5b6c9a', '#f3e3c3', '#8fb37a'],
  stair: ['#f7f7fb', '#9fd8ff', '#4f78c9', '#1d2558', '#ffe9b0'],
  metro: ['#f4eee0', '#e04d4d', '#2d3e5e', '#e9c46a', '#8ab0c4'],
  library: ['#0f2a2c', '#2f6b5f', '#9cc9b4', '#d9c27a', '#6d4a3a'],
  static: ['#2a2238', '#7a6a8a', '#c9b98a', '#8fb39a', '#e3d6c1'],
  reef: ['#12061e', '#ff3fa4', '#2ff3ff', '#7b2cff', '#c4ff4a'],
  veins: ['#1e0610', '#b3173c', '#ff7aa2', '#ffd1a1', '#6b1fff'],
  desert: ['#0b0a10', '#d9b26a', '#f7e6c4', '#7a5c3a', '#38f0c0'],
  school: ['#1b2030', '#5b6a80', '#d7d2c0', '#8a7a5a', '#f0d27a'],
  threshold: ['#ffffff', '#fff6e0', '#e0f0ff', '#ffe0f0', '#f0e0ff'],
  orrery: ['#1a1408', '#c99a3a', '#ffe8a8', '#5a3a8a', '#9fe0ff'],
  chorus: ['#fdf6ff', '#ffd0ef', '#c7e3ff', '#ffe9a8', '#d7c8ff'],
};

export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** Rotate a hex colour's hue by deg degrees (night palette drift). */
export function rotateHue(hex: string, deg: number): string {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0; const l = (max + min) / 2; const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex([r1 + m, g1 + m, b1 + m]);
}

/** OKLCH-ish accent: a harmony of the palette's most saturated colour. */
export function accentFrom(palette: string[], rot: number): string {
  let best = palette[0], bestS = -1;
  for (const p of palette) {
    const [r, g, b] = hexToRgb(p);
    const s = Math.max(r, g, b) - Math.min(r, g, b);
    if (s > bestS) { bestS = s; best = p; }
  }
  return rotateHue(best, 150 + rot);
}

export const DREAMER_COLOURS = ['#ffd27a', '#7ae0ff', '#ff8ad8', '#b6ff7a'];
