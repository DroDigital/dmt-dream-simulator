import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { G } from '../render/materials';
import { REALM_PALETTES } from '../render/palettes';
import type { RealmId } from '../data/types';
import { sharedAtlas } from '../render/glyph/atlas';
import { preset } from '../render/glyph/styles';
import { MODE_TABLE, ATLAS_ROWS, ATLAS_COLS } from '../render/glyph/modes';

const T: any = TSL;
const { Fn, uv, vec2, vec3, sin, cos, fract, floor, hash, mix, smoothstep, length, atan, abs, step, uniform } = T;

const PATTERNS: Partial<Record<RealmId, number>> = {
  orchard: 0, market: 1, cathedral: 2, suburb: 3, stair: 4, metro: 5, library: 6, static: 7, reef: 8, veins: 9, desert: 10, school: 11,
};

/**
 * A screen that shows another realm: a procedural "signal" in that realm's
 * palette, with VHS noise and scanlines. Used by Static Field TVs and Night
 * School doors.
 */
export function signalMaterial(target: RealmId, strength = 1): THREE.MeshBasicNodeMaterial {
  const pal = REALM_PALETTES[target].map((h) => new THREE.Color(h));
  const pat = PATTERNS[target] ?? 0;
  const a = uniform(pal[1]), b = uniform(pal[2]), c = uniform(pal[4]), d = uniform(pal[0]);
  const mat = new THREE.MeshBasicNodeMaterial();
  mat.fog = false;
  const tv = preset('tv-static');
  const atlas = T.texture(sharedAtlas().texture);
  const row = MODE_TABLE[tv.mode].row;
  const signal = Fn(([p0]: any[]) => {
    const p = p0.toVar();
    const t = G.time;
    const row = floor(p.y.mul(60.0));
    p.x.addAssign(hash(row.add(floor(t.mul(12.0)))).sub(0.5).mul(0.03));
    const q = p.sub(0.5);
    let v: any;
    switch (pat) {
      case 0: v = smoothstep(0.2, 0.18, length(q.sub(vec2(sin(t.mul(0.5)).mul(0.2), 0.05)))).add(step(0.0, q.y.negate()).mul(0.4)); break;
      case 1: v = step(0.6, hash(floor(p.mul(vec2(12.0, 8.0))).dot(vec2(1.0, 31.0)).add(floor(t.mul(2.0))))); break;
      case 2: v = abs(sin(atan(q.y, q.x).mul(6.0).add(t))).mul(smoothstep(0.5, 0.1, length(q))); break;
      case 3: v = step(fract(p.x.mul(5.0)), 0.7).mul(step(p.y, 0.55)).mul(step(0.25, p.y)); break;
      case 4: v = smoothstep(0.02, 0.0, abs(p.y.sub(0.4).sub(sin(p.x.mul(20.0).add(t.mul(2.0))).mul(0.03)))).add(step(p.y, 0.4).mul(0.5)); break;
      case 5: v = step(0.5, fract(p.x.mul(6.0).add(t.mul(0.5)))).mul(step(fract(p.y.mul(4.0)), 0.8)); break;
      case 6: v = step(0.5, fract(p.y.mul(10.0))).mul(step(0.3, hash(floor(p.x.mul(20.0))))); break;
      case 7: v = hash(floor(p.mul(80.0)).dot(vec2(1.0, 97.0)).add(t.mul(60.0))); break;
      case 8: v = abs(sin(length(q).mul(30.0).sub(t.mul(2.0)))); break;
      case 9: v = smoothstep(0.3, 0.0, abs(q.y.sub(sin(q.x.mul(9.0)).mul(0.1)))).mul(sin(t.mul(5.0)).mul(0.3).add(0.7)); break;
      case 10: v = step(0.55, hash(floor(p.mul(vec2(16.0, 10.0)).add(vec2(t.mul(2.0), 0.0))).dot(vec2(1.0, 57.0)))); break;
      default: v = step(0.9, fract(p.x.mul(8.0))).add(step(0.9, fract(p.y.mul(6.0)))); break;
    }
    let col = mix(d, mix(a, b, p.y), v).add(c.mul(v.mul(0.3)));
    const scan = sin(p.y.mul(400.0)).mul(0.5).add(0.5);
    const gp = floor(p.mul(300.0));
    col = col.mul(scan.mul(0.25).add(0.75)).add(vec3(hash(gp.x.add(gp.y.mul(157.0)).add(floor(t.mul(30.0)).mul(7.0))).mul(0.12)));
    return col.mul(1.3 * strength);
  });
  // the screen passes through the tv-static glyph style: blocks, mono, scanlines
  mat.colorNode = Fn(() => {
    const cells = vec2(28.0, 20.0);
    const cell = floor(uv().mul(cells));
    const local = fract(uv().mul(cells));
    const c = signal(cell.add(0.5).div(cells));
    const l = T.clamp(T.luminance(c).sub(tv.black).div(tv.white - tv.black), 0.0, 0.999);
    const idx = floor(l.mul(10.0));
    const mask = atlas.sample(vec2(idx.add(local.x).div(ATLAS_COLS), T.float(row).add(local.y).div(ATLAS_ROWS))).x;
    const scan = step(0.5, fract(uv().y.mul(cells.y).mul(2.0))).mul(tv.scanlines ?? 0.5).mul(0.35);
    return mix(c.mul(0.08), mix(c, b.mul(l.add(0.2)), 0.6), mask).mul(T.float(1.0).sub(scan));
  })();
  return mat;
}
