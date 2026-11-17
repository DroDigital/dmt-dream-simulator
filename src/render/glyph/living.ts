import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';

// Living text: wind in flagged zones, footstep ripples that scramble glyphs,
// gaze settle, and sparse letters drifting through the sky.

const T: any = TSL;
const { uniform, vec2, float, floor, fract, sin, cos, hash, mix, smoothstep, abs, length, step, max, min } = T;

export const MAX_RIPPLES = 8;

export interface LivingUniforms {
  time: any; windSpeed: any; windDir: any; windZone: any; // 0 none, 1 sky, 2 everywhere
  ripples: any[]; rippleOn: any; scramble: any; drift: any; driftZone: any;
}

export function makeLivingUniforms(): LivingUniforms {
  return {
    time: uniform(0), windSpeed: uniform(0), windDir: uniform(new THREE.Vector2(1, 0)), windZone: uniform(0),
    ripples: Array.from({ length: MAX_RIPPLES }, () => uniform(new THREE.Vector4(0, 0, -10, 0))),
    rippleOn: uniform(1), scramble: uniform(1), drift: uniform(0), driftZone: uniform(1),
  };
}

/** Value noise in TSL (for wind). */
export function vnoise(p: any) {
  const i = floor(p), f = fract(p);
  const h = (o: any) => hash(i.add(o).dot(vec2(1.0, 57.0)));
  const a = h(vec2(0, 0)), b = h(vec2(1, 0)), c = h(vec2(0, 1)), d = h(vec2(1, 1));
  const u = f.mul(f).mul(vec2(3.0).sub(f.mul(2.0)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/** Wind: glyph index offset within ±2 ramp steps, the pattern scrolling downwind. */
export function windOffset(L: LivingUniforms, cell: any, zone: any) {
  const p = cell.mul(0.18).sub(L.windDir.mul(L.time.mul(L.windSpeed).mul(2.0)));
  const n = vnoise(p).mul(2.0).sub(1.0);
  return floor(n.mul(2.5).add(0.5)).mul(zone).mul(step(0.001, L.windSpeed));
}

/** Ripples: rings 0 → 6 cells over 0.6 s where glyphs briefly scramble. */
export function rippleMask(L: LivingUniforms, cellPos: any, cellPx: any, paneSize: any) {
  let m: any = float(0);
  for (const r of L.ripples) {
    const age = L.time.sub(r.z);
    const live = step(0.0, age).mul(step(age, 0.6));
    const radius = age.div(0.6).mul(6.0);
    const centreCells = r.xy.mul(paneSize).div(cellPx);
    const d = length(cellPos.sub(centreCells));
    const ring = smoothstep(1.2, 0.0, abs(d.sub(radius)));
    m = max(m, ring.mul(live).mul(r.w));
  }
  return m.mul(L.rippleOn).mul(L.scramble);
}

/** Drifting letters: slow, sparse, wind-carried glyphs falling through the sky. */
export function driftLetter(L: LivingUniforms, cell: any, rows: any) {
  const col = cell.x.add(floor(L.time.mul(L.windDir.x).mul(L.windSpeed).mul(0.6)));
  const has = step(hash(col.mul(1.37)), 0.12);
  const speed = hash(col.add(9.1)).mul(0.03).add(0.02);
  const y = fract(hash(col.add(3.3)).add(L.time.mul(speed))).mul(rows);
  const on = step(abs(cell.y.sub(floor(y))), 0.5).mul(has);
  const glyph = floor(hash(col.add(floor(L.time.mul(0.5)))).mul(8.0)).add(2.0);
  return { on: on.mul(L.drift), glyph };
}
