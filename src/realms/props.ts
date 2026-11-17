import * as THREE from 'three/webgpu';
import type { Realm } from './realm';
import type { Tag } from '../data/types';
import { Shape } from './kit';

// Kit props shared by realms. Each returns a Group of 1–3 merged meshes.

export function M(r: Realm) {
  return {
    paper: r.mat('p-paper', { map: r.tex('paper') }),
    plaster: r.mat('p-plaster', { map: r.tex('plaster') }),
    wall: r.mat('p-wallpaper', { map: r.tex('wallpaper') }),
    wood: r.mat('p-wood', { map: r.tex('wood') }),
    metal: r.mat('p-metal', { map: r.tex('metal') }),
    brick: r.mat('p-brick', { map: r.tex('brick') }),
    stone: r.mat('p-stone', { map: r.tex('stone') }),
    marble: r.mat('p-marble', { map: r.tex('marble') }),
    tile: r.mat('p-tile', { map: r.tex('tile') }),
    fabric: r.mat('p-fabric', { map: r.tex('fabric') }),
    roof: r.mat('p-roof', { map: r.tex('roof') }),
    leaf: r.mat('p-leaf', { map: r.tex('leaf'), wind: 1 }),
    bark: r.mat('p-bark', { map: r.tex('bark') }),
    books: r.mat('p-books', { map: r.tex('books') }),
    screen: r.mat('p-screen', { map: r.tex('screen'), emissive: r.c(2, 0.3), emissiveIntensity: 0.9, glyphy: true }),
    glass: r.mat('p-glass', { map: r.tex('stained'), emissive: '#ffffff', emissiveIntensity: 0.25, film: 0.4 }),
    window: r.mat('p-window', { map: r.tex('window'), emissive: r.c(4, 0.2), emissiveIntensity: 0.9 }),
    lamp: r.mat('p-lamp', { emissive: '#ffe2a8', emissiveIntensity: 2.2, unlit: true }),
    lantern: r.mat('p-lantern', { map: r.tex('lantern'), emissive: r.c(4, 0.35), emissiveIntensity: 1.6, unlit: true }),
    dark: r.mat('p-dark', { color: '#2a2630' }),
    white: r.mat('p-white', { color: '#f4f0e8' }),
    plain: r.mat('p-plain', { map: r.tex('plain') }),
  };
}
export type Mats = ReturnType<typeof M>;

export function lamppost(r: Realm, m: Mats, h = 4.5) {
  const s = new Shape();
  s.cyl(m.metal, 0.07, 0.1, h, 0, h / 2, 0, { seg: 6, color: '#606070' });
  s.box(m.metal, 0.12, 0.12, 0.9, 0, h, 0.4, { color: '#606070' });
  s.box(m.lamp, 0.3, 0.12, 0.3, 0, h - 0.08, 0.8);
  return s.build();
}

export function bench(r: Realm, m: Mats) {
  const s = new Shape();
  s.box(m.wood, 1.8, 0.08, 0.45, 0, 0.45, 0, { uv: 1 });
  s.box(m.wood, 1.8, 0.4, 0.06, 0, 0.75, -0.22, { uv: 1 });
  for (const x of [-0.8, 0.8]) s.box(m.metal, 0.06, 0.45, 0.4, x, 0.22, 0, { color: '#404048' });
  return s.build();
}

export function vending(r: Realm, m: Mats, colour = r.c(1)) {
  const s = new Shape();
  s.box(m.metal, 1.0, 1.9, 0.8, 0, 0.95, 0, { color: colour });
  s.box(m.window, 0.65, 0.9, 0.04, -0.1, 1.25, 0.41);
  s.box(m.lamp, 0.15, 0.6, 0.04, 0.35, 1.2, 0.41);
  s.box(m.dark, 0.6, 0.18, 0.05, -0.1, 0.4, 0.41);
  return s.build();
}

export function busStop(r: Realm, m: Mats) {
  const s = new Shape();
  s.box(m.metal, 0.08, 2.4, 0.08, -1.4, 1.2, -0.5, { color: '#505060' });
  s.box(m.metal, 0.08, 2.4, 0.08, 1.4, 1.2, -0.5, { color: '#505060' });
  s.box(m.glass, 2.9, 1.8, 0.04, 0, 1.3, -0.55);
  s.box(m.metal, 3.1, 0.08, 1.4, 0, 2.45, 0, { color: '#505060' });
  s.box(m.wood, 2.2, 0.06, 0.35, 0, 0.5, -0.3);
  s.cyl(m.metal, 0.04, 0.04, 2.6, 1.9, 1.3, 0.3, { seg: 5 });
  s.box(m.lamp, 0.5, 0.5, 0.05, 1.9, 2.5, 0.3);
  return s.build();
}

export function house(r: Realm, m: Mats, w = 7, d = 7, floors = 2, wallCol = '#ffffff', variant = 0) {
  const s = new Shape();
  const h = floors * 2.8;
  s.box(variant % 2 ? m.brick : m.plaster, w, h, d, 0, h / 2, 0, { uv: 2.5, color: wallCol });
  // roof
  if (variant % 3 === 2) s.box(m.roof, w + 0.4, 0.3, d + 0.4, 0, h + 0.15, 0, { uv: 2 });
  else {
    const roof = new THREE.CylinderGeometry(0.01, (Math.max(w, d) / 2) * 1.2, 2.2, 4, 1);
    s.add(m.roof, roof, 0, h + 1.1, 0, { ry: Math.PI / 4, sx: w / Math.max(w, d), sz: d / Math.max(w, d) });
  }
  // windows + door on the front (+z)
  for (let f = 0; f < floors; f++) for (const x of [-w / 4, w / 4]) {
    if (f === 0 && x > 0) continue;
    s.box(m.window, 1.1, 1.2, 0.06, x, 1.5 + f * 2.8, d / 2 + 0.02);
  }
  s.box(m.wood, 1.0, 2.0, 0.08, w / 4, 1.0, d / 2 + 0.03, { color: r.c(1) });
  s.box(m.lamp, 0.15, 0.15, 0.12, w / 4 + 0.75, 2.2, d / 2 + 0.06);
  return s.build();
}

export function tree(r: Realm, m: Mats, h = 5, kind = 0, fruit?: THREE.Material) {
  const s = new Shape();
  s.cyl(m.bark, 0.18, 0.3, h * 0.55, 0, h * 0.27, 0, { seg: 6 });
  if (kind === 0) { s.ico(m.leaf, h * 0.32, 0, h * 0.7, 0, { detail: 0 }); s.ico(m.leaf, h * 0.22, h * 0.18, h * 0.85, 0.2); }
  else if (kind === 1) { s.cone(m.leaf, h * 0.3, h * 0.6, 0, h * 0.72, 0, { seg: 7 }); }
  else { s.sphere(m.leaf, h * 0.3, 0, h * 0.72, 0, { w: 7, h: 5, sy: 0.8 }); }
  if (fruit) for (let i = 0; i < 6; i++) {
    const a = i * 1.05;
    s.sphere(fruit, 0.18, Math.cos(a) * h * 0.3, h * (0.62 + (i % 3) * 0.08), Math.sin(a) * h * 0.3, { w: 6, h: 4 });
  }
  return s.build();
}

export function bookshelf(r: Realm, m: Mats, w = 2.4, h = 3.2) {
  const s = new Shape();
  s.box(m.wood, w, h, 0.5, 0, h / 2, 0, { uv: 1.5 });
  s.box(m.books, w - 0.15, h - 0.2, 0.05, 0, h / 2, 0.24, { uv: 1.2 });
  return s.build();
}

export function crt(r: Realm, m: Mats, s0 = 1) {
  const s = new Shape();
  s.box(m.plain, 0.7 * s0, 0.6 * s0, 0.6 * s0, 0, 0.3 * s0, 0, { color: '#c8c0b0' });
  s.box(m.screen, 0.52 * s0, 0.42 * s0, 0.03, 0, 0.32 * s0, 0.3 * s0);
  s.cyl(m.metal, 0.01, 0.01, 0.5 * s0, -0.12 * s0, 0.8 * s0, 0, { rz: 0.4, seg: 3 });
  s.cyl(m.metal, 0.01, 0.01, 0.5 * s0, 0.12 * s0, 0.8 * s0, 0, { rz: -0.4, seg: 3 });
  return s.build();
}

export function column(r: Realm, mat: THREE.Material, h = 10, rad = 0.6) {
  const s = new Shape();
  s.box(mat, rad * 2.6, 0.5, rad * 2.6, 0, 0.25, 0);
  s.cyl(mat, rad, rad * 1.1, h - 1, 0, h / 2, 0, { seg: 8, uv: 2 });
  s.box(mat, rad * 2.6, 0.5, rad * 2.6, 0, h - 0.25, 0);
  return s.build();
}

export function stall(r: Realm, m: Mats, colour: string) {
  const s = new Shape();
  s.box(m.wood, 2.6, 1.0, 1.2, 0, 0.5, 0, { uv: 1 });
  for (const x of [-1.2, 1.2]) for (const z of [-0.5, 0.5]) s.box(m.wood, 0.08, 2.4, 0.08, x, 1.2, z);
  s.box(m.fabric, 3.0, 0.08, 1.8, 0, 2.45, 0.15, { rx: 0.18, color: colour });
  s.box(m.lantern, 0.3, 0.4, 0.3, -0.9, 2.0, 0.6);
  s.box(m.lantern, 0.3, 0.4, 0.3, 0.9, 2.0, 0.6);
  for (let i = 0; i < 5; i++) s.ico(m.lantern, 0.12, -1 + i * 0.5, 1.12, 0.2, { color: r.c(i) });
  return s.build();
}

export function desk(r: Realm, m: Mats) {
  const s = new Shape();
  s.box(m.wood, 1.2, 0.05, 0.6, 0, 0.75, 0);
  for (const x of [-0.55, 0.55]) for (const z of [-0.25, 0.25]) s.box(m.metal, 0.04, 0.75, 0.04, x, 0.37, z);
  s.box(m.wood, 0.45, 0.04, 0.45, 0, 0.45, 0.6);
  s.box(m.wood, 0.45, 0.5, 0.04, 0, 0.7, 0.82);
  return s.build();
}

export function locker(r: Realm, m: Mats, n = 4) {
  const s = new Shape();
  for (let i = 0; i < n; i++) {
    s.box(m.metal, 0.48, 1.9, 0.5, i * 0.5, 0.95, 0, { color: r.c(2) });
    s.box(m.dark, 0.3, 0.04, 0.02, i * 0.5, 1.6, 0.26);
  }
  return s.build();
}

export function door(r: Realm, m: Mats, colour = r.c(1), glow = false) {
  const s = new Shape();
  s.box(m.wood, 1.3, 2.3, 0.15, 0, 1.15, 0, { color: '#d0c8b8' });
  s.box(glow ? m.lamp : m.wood, 1.0, 2.1, 0.1, 0, 1.05, 0.05, { color: colour });
  s.sphere(m.metal, 0.05, 0.38, 1.05, 0.12);
  return s.build();
}

export function piano(r: Realm, m: Mats) {
  const s = new Shape();
  s.box(m.dark, 1.5, 1.3, 0.6, 0, 0.65, 0);
  s.box(m.white, 1.4, 0.05, 0.25, 0, 0.75, 0.4);
  for (let i = 0; i < 10; i++) s.box(m.dark, 0.05, 0.04, 0.14, -0.6 + i * 0.13, 0.79, 0.35);
  s.box(m.dark, 0.6, 0.45, 0.35, 0, 0.22, 1.0);
  return s.build();
}

export function bicycle(r: Realm, m: Mats, colour = r.c(1)) {
  const s = new Shape();
  s.torus(m.dark, 0.32, 0.03, -0.55, 0.34, 0, { ry: Math.PI / 2 });
  s.torus(m.dark, 0.32, 0.03, 0.55, 0.34, 0, { ry: Math.PI / 2 });
  s.box(m.metal, 1.1, 0.05, 0.05, 0, 0.6, 0, { color: colour });
  s.box(m.metal, 0.05, 0.5, 0.05, -0.2, 0.55, 0, { color: colour, rz: 0.3 });
  s.box(m.dark, 0.25, 0.05, 0.12, -0.25, 0.85, 0);
  s.box(m.metal, 0.05, 0.05, 0.5, 0.45, 0.95, 0, { color: '#999' });
  return s.build();
}

export function laundryLine(r: Realm, m: Mats, len = 6) {
  const s = new Shape();
  s.cyl(m.metal, 0.04, 0.04, 2.4, -len / 2, 1.2, 0, { seg: 4 });
  s.cyl(m.metal, 0.04, 0.04, 2.4, len / 2, 1.2, 0, { seg: 4 });
  s.box(m.white, len, 0.01, 0.01, 0, 2.3, 0);
  const n = Math.floor(len / 0.9);
  for (let i = 0; i < n; i++) s.box(m.fabric, 0.6, r.rng.range(0.5, 0.9), 0.02, -len / 2 + 0.6 + i * 0.9, 1.95, 0, { color: r.c(i + 1) });
  return s.build();
}

export function lanternStand(r: Realm, m: Mats, h = 2.2) {
  const s = new Shape();
  s.cyl(m.wood, 0.04, 0.05, h, 0, h / 2, 0, { seg: 5 });
  s.box(m.wood, 0.5, 0.04, 0.04, 0.2, h, 0);
  s.cyl(m.lantern, 0.18, 0.2, 0.42, 0.42, h - 0.3, 0, { seg: 8 });
  return s.build();
}

export function stairs(r: Realm, mat: THREE.Material, steps: number, w: number, rise = 0.2, run = 0.35) {
  const s = new Shape();
  for (let i = 0; i < steps; i++) s.box(mat, w, rise * (i + 1), run, 0, (rise * (i + 1)) / 2, -i * run, { uv: 1 });
  return s.build();
}

/** Place + link a prop in one go. */
export function linked(r: Realm, obj: THREE.Object3D, x: number, y: number, z: number, ry: number, tags: Tag[], kind: string, collide: 'box' | 'cyl' | 'ball' | 'mesh' = 'box', s = 1) {
  r.place(obj, x, y, z, ry, s * (r.laws.bigProps ? r.rng.range(1.2, 2.2) : 1));
  return r.link(obj, tags, { kind, collide });
}

/** Place a non-linking solid prop. */
export function solidProp(r: Realm, obj: THREE.Object3D, x: number, y: number, z: number, ry = 0, collide: 'box' | 'cyl' | 'mesh' | 'none' = 'box', s = 1) {
  r.place(obj, x, y, z, ry, s);
  if (collide !== 'none') r.solid(obj, collide);
  return obj;
}
