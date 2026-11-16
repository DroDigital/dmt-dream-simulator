import * as THREE from 'three/webgpu';
import type { Realm } from '../realms/realm';
import type { GameHooks } from '../core/types';
import { VISIONS } from '../data/visions';
import { Shape } from '../realms/kit';
import { M, vending } from '../realms/props';
import { Mover, Precip, Kite, LanternWoman, NightTrain } from './common';
import { makeThing } from './events';
import { PCG32 } from '../core/rng';

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Whale of Light: a point-cloud whale made of constellations, built from code. */
function whale(r: Realm): THREE.Object3D {
  const pts: number[] = [];
  const rng = new PCG32(77);
  for (let i = 0; i < 2400; i++) {
    const u = rng.next();
    const x = (u - 0.5) * 200;
    const prof = Math.sin(u * Math.PI) * (u < 0.85 ? 22 : 8) * (1 - Math.max(0, u - 0.7) * 1.5);
    const a = rng.next() * Math.PI * 2;
    pts.push(x, Math.sin(a) * prof * 0.7, Math.cos(a) * prof);
    if (u > 0.85 && rng.chance(0.4)) pts.push(x, Math.sin(a) * 25 * (u - 0.85) * 6, (rng.next() - 0.5) * 50);
  }
  const g = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.6, 0), r.mat('whale', { emissive: '#bfe8ff', emissiveIntensity: 2.2, unlit: true, additive: true, noFog: true }), pts.length / 3);
  const m = new THREE.Matrix4();
  for (let i = 0; i < pts.length / 3; i++) { m.makeTranslation(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); g.setMatrixAt(i, m); }
  g.frustumCulled = false;
  return g;
}

export function runVision(id: string, r: Realm, hooks: GameHooks, onEnd: () => void): number {
  const def = VISIONS.find((v) => v.id === id) ?? VISIONS[0];
  const d = r.dreamers()[0];
  const a = d ? d.position.clone() : r.spawn.pos.clone();
  const f = d ? v3(-Math.sin(d.yaw), 0, -Math.cos(d.yaw)) : v3(0, 0, -1);
  const side = v3(f.z, 0, -f.x);
  const rng = new PCG32(r.ctx.seed, id.length);
  const m = M(r);
  hooks.sfx('vision', a, r.key, 1);
  hooks.atlas('vision:' + id);
  r.overrides.tape = def.tape ? 0.75 : r.overrides.tape;
  const add = (obj: THREE.Object3D, fn: Mover['fn']) => { r.dynamic.add(obj); r.addEntity(new Mover('vision', obj, fn, def.duration)); };
  const k = (t: number) => Math.sin(Math.min(1, t / def.duration) * Math.PI);
  switch (id) {
    case 'whale': { const w = whale(r); add(w, (t, o) => { o.position.copy(a).addScaledVector(side, -260 + t * 15).add(v3(0, 70 + Math.sin(t * 0.3) * 8, 0)).addScaledVector(f, 80); o.rotation.y = Math.atan2(side.x, side.z) - Math.PI / 2; o.rotation.z = Math.sin(t * 0.4) * 0.1; if (Math.floor(t / 8) !== Math.floor((t - 1 / 60) / 8)) hooks.sfx('whale', o.position, r.key, 1); }); break; }
    case 'unzip': add(new THREE.Object3D(), (t) => { r.overrides.skyTop = t < def.duration * 0.8 ? '#ff80c0' : r.env.skyTop; r.overrides.kaleido = k(t) * 1.2; r.overrides.stars = 3 * k(t); }); break;
    case 'cranes': {
      const things = r.mutables.slice(0, 40);
      add(new THREE.Object3D(), (t) => { const h = t > 4 && t < def.duration - 4; things.forEach((o) => (o.visible = !h)); r.overrides.glyph = 0; });
      for (let i = 0; i < 60; i++) { const c = makeThing(r, 'crane', r.c(i)); const off = v3(rng.range(-20, 20), 0, rng.range(-20, 20)); add(c, (t, o) => { o.position.copy(a).add(off).add(v3(Math.sin(t + i) * 2, Math.max(0, t - 4) * 1.5, 0)); o.rotation.y = t + i; }); }
      break;
    }
    case 'lanternrise': for (let i = 0; i < 120; i++) { const l = makeThing(r, 'lantern'); const off = v3(rng.range(-40, 40), 0, rng.range(-40, 40)); const sp = rng.range(0.6, 1.6); add(l, (t, o) => { o.position.copy(a).add(off).add(v3(0, t * sp, 0)); }); } r.overrides.bloom = 1.8; break;
    case 'mandala': add(new THREE.Object3D(), (t) => { r.overrides.mandala = 1 + k(t) * 6; r.overrides.kaleido = k(t) * 0.9; r.overrides.trail = 0.8; }); break;
    case 'trainsky': { const pts: THREE.Vector3[] = []; for (let i = 0; i < 16; i++) { const an = (i / 16) * Math.PI * 2; pts.push(v3(a.x + Math.cos(an) * 30, a.y + 9, a.z + Math.sin(an) * 30)); } const tr = new NightTrain(r, new THREE.CatmullRomCurve3(pts, true), 12, 6); r.addEntity(tr); setTimeout(() => r.removeEntity(tr), def.duration * 1000); break; }
    case 'prism': add(new THREE.Object3D(), (t) => { r.overrides.godrays = 2.5 * k(t); r.overrides.hueShift = t * 0.6; r.overrides.bloom = 1 + k(t); }); r.addEntity(new Precip(r, a, 'star', '#ffffff', 500, 25, 20, 3, def.duration)); break;
    case 'moonseye': add(new THREE.Object3D(), (t) => { r.sky.u.moonA.value.lerp(r.sky.u.moonB.value, 0.01); r.overrides.vignette = 0.45 + k(t) * 0.4; if (t > def.duration - 3) r.sky.mesh.visible = Math.sin(t * 20) > 0; else r.sky.mesh.visible = true; }); break;
    case 'dancehouses': { const things = r.mutables.slice(0, 40); add(new THREE.Object3D(), (t) => { things.forEach((o, i) => { o.rotation.z = Math.sin(t * 4 + i) * 0.15; o.scale.y = 1 + Math.sin(t * 8 + i) * 0.08; }); if (t > def.duration - 0.1) things.forEach((o) => { o.rotation.z = 0; o.scale.y = 1; }); }); break; }
    case 'sunface': { const s = makeThing(r, 'sun'); add(s, (t, o) => { o.position.copy(a).addScaledVector(f, 150).add(v3(0, -20 + k(t) * 70, 0)); o.lookAt(a); o.scale.setScalar(1 + Math.sin(t * 3) * 0.05); }); hooks.sfx('choir', a, r.key, 1); break; }
    case 'vendingchoir': for (let i = 0; i < 8; i++) { const vm = vending(r, m, r.c(i)); add(vm, (t, o) => { const an = (i / 8) * Math.PI * 2 + t * 0.3; o.position.copy(a).add(v3(Math.cos(an) * 8, 1 + Math.sin(t * 2 + i) * 0.6, Math.sin(an) * 8)); o.lookAt(a.x, o.position.y, a.z); }); } hooks.sfx('choir', a, r.key, 1); break;
    case 'tvgarden': for (let i = 0; i < 40; i++) { const tv = makeThing(r, 'tv'); const off = v3(rng.range(-14, 14), 0, rng.range(-14, 14)); add(tv, (t, o) => { o.position.copy(a).add(off); o.position.y = a.y - 1.5 + Math.min(1.5, t * 0.5); o.lookAt(a.x, o.position.y, a.z); }); } break;
    case 'kitechase': { const kt = new Kite(r, a.clone().addScaledVector(f, 4).add(v3(0, 3, 0))); r.addEntity(kt); hooks.achieve('kite'); setTimeout(() => r.removeEntity(kt), def.duration * 1000); break; }
    case 'bloomflowers': { const fl = r.mat('vision-flower', { emissive: r.c(1), emissiveIntensity: 0.6, color: r.c(1), film: 0.4, side: THREE.DoubleSide }); for (let i = 0; i < 14; i++) { const s = new Shape(); s.cyl(m.leaf, 0.3, 0.4, 14, 0, 7, 0, { seg: 6 }); for (let p = 0; p < 6; p++) s.box(fl, 2.5, 0.1, 6, Math.cos(p) * 2.5, 14, Math.sin(p) * 2.5, { ry: -p, rx: 0.4 }); const o = s.build(); const an = (i / 14) * Math.PI * 2; add(o, (t, ob) => { ob.position.copy(a).add(v3(Math.cos(an) * 18, 0, Math.sin(an) * 18)); ob.scale.setScalar(Math.min(1, t / 6)); }); } break; }
    case 'starfall': r.addEntity(new Precip(r, a, 'glyph', '#fff4a0', 700, 30, 30, 2, def.duration)); r.overrides.stars = 3; break;
    case 'flood': { const w = r.mat('flood', { color: r.c(2), emissive: r.c(2), emissiveIntensity: 0.6, transparent: true, opacity: 0.55, film: 0.4 }); const s = new Shape(); s.plane(w, 400, 400, 0, 0, 0, { rx: -Math.PI / 2 }); add(s.build(), (t, o) => { o.position.set(a.x, a.y + k(t) * 1.3, a.z); }); break; }
    case 'womanturns': { const pos = a.clone().addScaledVector(f, 10); const lw = new LanternWoman(r, pos, Math.atan2(f.x, f.z)); r.addEntity(lw); add(new THREE.Object3D(), (t) => { if (t > 6) lw.object.rotation.y += 0.01; r.overrides.bloom = 1 + Math.max(0, t - 10) * 0.15; r.overrides.skyHorizon = t > 10 ? '#ffe0a0' : r.env.skyHorizon; }); hooks.achieve('woman-turn'); break; }
    case 'sleeper': { const face = r.mat('sleeper', { color: '#f0d8c8', emissive: '#806060', emissiveIntensity: 0.3 }); const s = new Shape(); s.sphere(face, 60, 0, 0, 0, { w: 16, h: 12 }); s.box(m.dark, 12, 1, 2, -20, 10, 58); s.box(m.dark, 12, 1, 2, 20, 10, 58); s.box(m.dark, 18, 1.5, 2, 0, -20, 58); add(s.build(), (t, o) => { o.position.copy(a).addScaledVector(f, 260).add(v3(0, -60 + k(t) * 70, 0)); o.lookAt(a); o.scale.setScalar(1 + Math.sin(t * 0.5) * 0.03); if (Math.floor(t / 4) !== Math.floor((t - 1 / 60) / 4)) hooks.sfx('breath', o.position, r.key, 1); }); break; }
    case 'glasscathedral': for (let i = 0; i < 24; i++) { const s = new Shape(); s.box(m.glass, 0.2, 16, 4, 0, 8, 0); const o = s.build(); const an = (i / 24) * Math.PI * 2; add(o, (t, ob) => { ob.position.copy(a).add(v3(Math.cos(an) * 14, -16 + Math.min(16, t * 3), Math.sin(an) * 14)); ob.rotation.set(0, -an, 0.2); }); } r.overrides.godrays = 1.6; break;
    case 'unwritten': add(new THREE.Object3D(), (t) => { r.overrides.glyph = k(t); r.overrides.glyphCell = 6 + k(t) * 10; }); break;
  }
  const until = performance.now() + def.duration * 1000;
  setTimeout(() => {
    for (const key of ['tape', 'glyph', 'glyphCell', 'kaleido', 'bloom', 'godrays', 'mandala', 'stars', 'skyTop', 'skyHorizon', 'hueShift', 'vignette', 'trail'] as const) delete (r.overrides as any)[key];
    r.sky.mesh.visible = r.id !== 'reef';
    onEnd();
  }, def.duration * 1000);
  return until;
}
