import * as THREE from 'three/webgpu';
import { Realm } from './realm';
import { M, linked } from './props';
import { Shape } from './kit';
import { Drifters, Lanternfolk } from '../entities/common';
import { dress } from './dress';

/** The Threshold: a single doorway of white light on the mandala's centre. Night 365. */
export class Threshold extends Realm {
  build() {
    this.env = {
      ...this.env,
      skyTop: '#ffffff', skyHorizon: '#fff4e8', skyBottom: '#f0e8ff',
      fog: '#fffaf4', fogNear: 20, fogFar: 160, sunDir: [0, 0.6, -1], sunColor: '#ffffff',
      skyAmb: '#ffffff', groundAmb: '#e8e0f0', bloom: 1.8, bloomThreshold: 0.5, godrays: 1.5, glyph: 0.25, trail: 0.8, kaleido: 0.6, wobble: 0.6, mandala: 1.5, stars: 0,
    };
    const m = M(this);
    const white = this.mat('th-white', { map: this.tex('marble'), color: '#ffffff', film: 0.6 });
    // a long path of floating stones towards the door
    for (let i = 0; i < 40; i++) {
      const s = new Shape(); s.cyl(white, 1.6, 1.2, 0.5, 0, -0.25, 0, { seg: 8 });
      const o = this.place(s.build(), Math.sin(i * 0.3) * 2, i * 0.15, -i * 3.2);
      this.solid(o, 'cyl');
    }
    const door = new Shape();
    door.box(white, 3.4, 6, 0.6, 0, 3, 0);
    door.box(this.mat('th-light', { emissive: '#ffffff', emissiveIntensity: 3, unlit: true }), 2.6, 5.4, 0.7, 0, 2.7, 0);
    this.landmark = linked(this, door.build(), Math.sin(39 * 0.3) * 2, 39 * 0.15, -39 * 3.2 - 1, 0, ['light'], 'threshold-door').object;
    (this.landmark.userData.linkable as any).special = { type: 'threshold' };
    this.addEntity(new Drifters(this, new THREE.Vector3(0, 5, -60), 40, 50, 20));
    this.spawn.pos.set(0, 0.2, 0);
    this.spawn.yaw = Math.PI;
    this.killY = -40;
    this.quiet = { pos: new THREE.Vector3(0, 0, 0), radius: 2 };
    void m;
  }
}

/** The Orrery: the hidden 13th realm, opened by the chart secret. A brass solar system you walk inside. */
export class Orrery extends Realm {
  planets: { obj: THREE.Object3D; r: number; s: number; ph: number }[] = [];
  build() {
    this.env = {
      ...this.env,
      skyTop: '#0a0806', skyHorizon: '#3a2a10', skyBottom: '#050403',
      fog: '#1a1408', fogNear: 30, fogFar: 160, sunDir: [0, 1, 0], sunColor: '#ffd890',
      skyAmb: '#c99a3a', groundAmb: '#3a2a10', bloom: 1.3, godrays: 0.9, trail: 0.6, stars: 1.4, mandala: 1.2,
    };
    const m = M(this);
    const brass = this.mat('brass', { map: this.tex('metal'), color: '#e0b060', film: 0.3 });
    const disc = new Shape(); disc.cyl(brass, 60, 60, 0.6, 0, -0.3, 0, { seg: 48, uv: 6 });
    for (let r = 10; r < 60; r += 10) disc.torus(m.lamp, r, 0.08, 0, 0.05, 0, { rx: Math.PI / 2 });
    const d = this.place(disc.build(), 0, 0, 0); this.solid(d, 'mesh');
    const sun = new Shape(); sun.sphere(this.mat('brass-sun', { emissive: '#ffcc66', emissiveIntensity: 2, unlit: true }), 5, 0, 8, 0, { w: 16, h: 10 });
    for (let i = 0; i < 8; i++) sun.box(brass, 0.3, 8, 0.3, Math.cos(i) * 2, 4, Math.sin(i) * 2);
    this.landmark = linked(this, sun.build(), 0, 0, 0, 0, ['light', 'glass'], 'brass-sun').object;
    for (let i = 0; i < 7; i++) {
      const r = 12 + i * 7;
      const s = new Shape();
      s.box(brass, 0.15, 0.15, r, 0, 6, -r / 2);
      s.sphere(i % 2 ? brass : this.mat(`pl${i}`, { emissive: this.c(i), emissiveIntensity: 0.6, film: 0.8 }), 1 + (i % 3) * 0.6, 0, 6, -r, { w: 12, h: 8 });
      if (i === 3) s.torus(m.lamp, 2.4, 0.08, 0, 6, -r, { rx: 1.2 });
      const o = this.place(s.build(), 0, 0, 0);
      this.dyn(o);
      this.planets.push({ obj: o, r, s: 0.05 / (1 + i * 0.4), ph: i * 1.7 });
    }
    this.spawn.pos.set(0, 0.2, 40); this.spawn.yaw = Math.PI;
    this.quiet = { pos: new THREE.Vector3(0, 0, 58), radius: 2 };
    this.killY = -30;
    dress(this, { lf: { centre: new THREE.Vector3(0, 0, 30), radius: 15, count: 3 }, phone: { pos: new THREE.Vector3(3, 0, 44), yaw: 0 } });
  }
  update() { for (const p of this.planets) p.obj.rotation.y = this.time * p.s + p.ph; }
}

/** Chorus Room: a co-op-only round hall behind chorus links. */
export class ChorusRoom extends Realm {
  bell!: THREE.Object3D;
  build() {
    this.env = {
      ...this.env,
      skyTop: '#fdf6ff', skyHorizon: '#ffd0ef', skyBottom: '#c7e3ff',
      fog: '#f8eaff', fogNear: 15, fogFar: 80, sunDir: [0.2, 1, 0.1], sunColor: '#fff0f8',
      skyAmb: '#ffe8f8', groundAmb: '#d8c8ff', bloom: 1.4, godrays: 0.8, trail: 0.7, kaleido: 0.5,
    };
    const m = M(this);
    const wall = this.mat('ch-wall', { map: this.tex('marble'), color: '#fff8ff', film: 0.5 });
    const room = new Shape();
    room.cyl(wall, 18, 18, 0.4, 0, -0.2, 0, { seg: 32, uv: 4 });
    room.add(wall, new THREE.CylinderGeometry(18, 18, 14, 32, 1, true).scale(-1, 1, 1), 0, 7, 0);
    const ro = this.place(room.build(), 0, 0, 0); this.solid(ro, 'mesh');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const w = new Shape(); w.box(m.glass, 0.1, 8, 3, 0, 0, 0);
      this.link(this.place(w.build(), Math.cos(a) * 17.8, 7, Math.sin(a) * 17.8, -a), ['glass', 'light'], { kind: 'chorus-window', thin: true });
    }
    const b = new Shape();
    b.add(this.mat('ch-bell', { map: this.tex('metal'), color: '#ffd890', film: 0.6 }), new THREE.LatheGeometry([new THREE.Vector2(1.8, 0), new THREE.Vector2(1.6, 0.3), new THREE.Vector2(1.0, 1.6), new THREE.Vector2(0.9, 2.6), new THREE.Vector2(0, 2.8)], 16));
    b.cyl(m.metal, 0.05, 0.05, 6, 0, 5.8, 0, { seg: 4 });
    this.bell = linked(this, b.build(), 0, 3, 0, 0, ['light', 'glass'], 'big-bell').object;
    (this.bell.userData.linkable as any).chorus = 2;
    this.dyn(this.bell);
    for (let i = 0; i < 6; i++) this.addEntity(new Lanternfolk(this, new THREE.Vector3(Math.cos(i) * 10, 0, Math.sin(i) * 10), 6));
    this.spawn.pos.set(0, 0.2, 12); this.spawn.yaw = Math.PI;
    this.quiet = { pos: new THREE.Vector3(0, 0, 4), radius: 2 };
    this.killY = -20;
  }
  update() { this.bell.rotation.z = Math.sin(this.time * 0.8) * 0.06; }
}
