import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { G, makeLoFi } from '../render/materials';
import type { Realm } from './realm';

const T: any = TSL;
const { vec2, vec3, sin, cos, dot, positionLocal, float, fract, floor, hash, min, length, Fn, smoothstep, positionWorld, abs, vec4 } = T;

/** Sum of 6 Gerstner waves as a TSL position offset (local y is up). */
export function gerstner(amp = 1) {
  const waves: [number, number, number, number][] = [
    [1, 0.3, 0.32, 0.6], [0.7, 1, 0.21, 0.9], [-0.4, 1, 0.17, 1.3], [0.9, -0.6, 0.11, 1.7], [-1, -0.2, 0.08, 2.3], [0.2, -1, 0.06, 3.1],
  ];
  let off = vec3(0, 0, 0);
  waves.forEach(([dx, dz, a, f], i) => {
    const d = vec2(dx, dz).normalize();
    const k = f * 0.25;
    const ph = dot(d, positionLocal.xz).mul(k).add(G.time.mul(Math.sqrt(9.8 * k)).add(i));
    const A = a * amp;
    off = off.add(vec3(d.x.mul(cos(ph)).mul(A * 0.6), sin(ph).mul(A), d.y.mul(cos(ph)).mul(A * 0.6)));
  });
  return off;
}

/** Animated Voronoi caustic intensity at a world xz. */
export const caustic = Fn(([p, t]: any[]) => {
  const q = p.mul(0.35);
  const i = floor(q), f = fract(q);
  let md = float(8.0);
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
    const g = vec2(x, y);
    const h = vec2(hash(i.add(g).dot(vec2(1.0, 57.0))), hash(i.add(g).dot(vec2(13.0, 7.0))));
    const o = vec2(0.5).add(vec2(sin(t.add(h.x.mul(6.28))), cos(t.mul(0.8).add(h.y.mul(6.28)))).mul(0.4));
    md = min(md, length(g.add(o).sub(f)));
  }
  return smoothstep(0.05, 0.0, abs(md.sub(0.45)).sub(0.02)).add(md.mul(md).mul(0.25));
});

export function seaMesh(r: Realm, size: number, colour: string, glow: string, amp = 1, segs = 72): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size, segs, segs).rotateX(-Math.PI / 2);
  const mat = makeLoFi({ map: r.tex('water'), repeat: [size / 6, size / 6], color: colour, emissive: glow, emissiveIntensity: 0.55, film: 0.25 });
  mat.positionNode = positionLocal.add(gerstner(amp));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.dynamic = true;
  return mesh;
}

/** A flat additive caustic layer laid over a floor. */
export function causticLayer(r: Realm, w: number, d: number, colour: string, strength = 0.5): THREE.Mesh {
  const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  mat.fog = false;
  const c = new THREE.Color(colour);
  mat.colorNode = vec3(c.r, c.g, c.b).mul(caustic(positionWorld.xz, G.time.mul(0.9))).mul(strength);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat);
  m.userData.dynamic = true;
  m.renderOrder = 2;
  return m;
}
