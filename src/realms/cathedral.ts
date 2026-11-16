import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { Realm } from './realm';
import { M, column, vending, linked } from './props';
import { Shape } from './kit';
import { G, makeLoFi, filmColor } from '../render/materials';
import { dress } from './dress';

const T: any = TSL;
const { vec3, sin, positionWorld, smoothstep, fract, abs, float, mix } = T;

/** 3 · Prism Cathedral: an endless stained-glass nave where light shafts turn into rainbows. */
export class PrismCathedral extends Realm {
  wrap = { axis: 'z' as const, period: 96 };
  shafts: THREE.Object3D[] = [];
  build() {
    const deep = this.ctx.deep;
    this.env = {
      ...this.env,
      skyTop: '#d8d0ff', skyHorizon: '#fff4e8', skyBottom: '#c0b0e0',
      fog: deep ? '#3a2a5a' : '#e8e0ff', fogNear: 25, fogFar: 140, sunDir: [0.4, 0.8, -0.3], sunColor: '#fff0e0',
      skyAmb: '#d8d0f0', groundAmb: '#a898c8', bloom: 1.3, bloomThreshold: 0.62, godrays: 1.2, trail: 0.55, kaleido: 0.35, mandala: 0.3,
    };
    const m = M(this);
    const P = 96;
    const stone = this.mat('cath-stone', { map: this.tex('marble'), color: '#f0ecff' });
    // rainbow caustics laid across the floor where shafts land
    const floorMat = makeLoFi({ map: this.tex('tile'), repeat: [8, 96], color: '#e8e4f8' });
    const baseColor = floorMat.colorNode;
    const band = fract(positionWorld.z.mul(0.0625).add(positionWorld.x.mul(0.02)));
    const shaftMask = smoothstep(0.06, 0.0, abs(band.sub(0.5)).sub(0.12));
    const rainbow = filmColor(positionWorld.x.mul(0.15).add(G.time.mul(0.05)));
    floorMat.colorNode = (baseColor as any).add(rainbow.mul(shaftMask).mul(0.55));
    this.ground(new THREE.PlaneGeometry(16, P * 3).rotateX(-Math.PI / 2), floorMat);
    const W = 16, H = 22;
    const nave = new Shape();
    nave.box(stone, 1, H, P * 3, -W / 2 - 0.5, H / 2, 0, { uv: 4 });
    nave.box(stone, 1, H, P * 3, W / 2 + 0.5, H / 2, 0, { uv: 4 });
    const naveObj = nave.build(); this.root.add(naveObj);
    for (const c of naveObj.children) this.physics.fixedMesh(c as THREE.Mesh);
    // vaulted ribs, columns and tall stained windows, repeated down an endless nave
    const lamps: THREE.Vector3[] = [];
    for (let z = -P * 1.5 + 4; z < P * 1.5; z += 8) {
      for (const x of [-W / 2 + 1.2, W / 2 - 1.2]) {
        const col = this.place(column(this, stone, H - 4, 0.55), x, 0, z);
        this.solid(col, 'cyl');
      }
      const rib = new Shape(); rib.torus(stone, W / 2, 0.35, 0, H - 4, 0, { arc: Math.PI }); this.place(rib.build(), 0, 0, z);
      for (const sx of [-1, 1]) {
        const win = new Shape();
        win.box(m.glass, 0.1, 9, 3, 0, 0, 0);
        win.cyl(m.glass, 1.5, 1.5, 0.1, 0, 4.5, 0, { rz: Math.PI / 2, seg: 10 });
        const wo = this.place(win.build(), sx * (W / 2 - 0.05), 9, z + 4);
        if (Math.abs(z) < 40) this.link(wo, ['glass', 'light'], { kind: 'stained-window', collide: 'box', thin: true });
      }
    }
    // light shafts: additive slanted boxes
    const shaftMat = this.mat('shaft', { emissive: '#fff4e0', emissiveIntensity: 0.18, unlit: true, additive: true, noFog: true });
    for (let z = -P * 1.5 + 8; z < P * 1.5; z += 16) {
      const s = new Shape(); s.box(shaftMat, 2.6, 24, 3, 0, 0, 0);
      const o = this.place(s.build(), -2, 10, z, 0);
      o.rotation.z = 0.5;
      this.dyn(o);
      this.shafts.push(o);
    }
    // pews (quiet place) and statues
    for (let z = -30; z <= 30; z += 3) for (const x of [-4, 4]) {
      if (Math.abs(z) < 4) continue;
      const pew = new Shape(); pew.box(m.wood, 4.5, 0.1, 0.6, 0, 0.5, 0); pew.box(m.wood, 4.5, 0.9, 0.08, 0, 0.9, -0.3);
      if (this.rng.chance(0.85 * this.density)) linked(this, pew.build(), x, 0, z, 0, ['paper', 'glass'], 'pew');
    }
    const statue = (x: number, z: number) => {
      const s = new Shape();
      s.box(stone, 1.4, 1.2, 1.4, 0, 0.6, 0);
      s.cone(stone, 0.55, 2.4, 0, 2.4, 0, { seg: 7 });
      s.sphere(stone, 0.3, 0, 3.9, 0);
      s.box(stone, 1.6, 0.1, 0.3, 0, 3.2, 0, { rz: 0.3 });
      s.torus(m.lamp, 0.35, 0.03, 0, 4.4, 0, { rx: Math.PI / 2 });
      return linked(this, s.build(), x, 0, z, x > 0 ? -Math.PI / 2 : Math.PI / 2, ['glass', 'light'], 'statue');
    };
    for (let i = 0; i < 6; i++) { statue(-W / 2 + 2.6, -40 + i * 16); statue(W / 2 - 2.6, -32 + i * 16); }
    // landmark: the rose window at the far end
    const rose = new Shape();
    rose.cyl(this.mat('rose', { map: this.tex('stained', 1), emissive: '#ffffff', emissiveIntensity: 0.9, film: 0.5 }), 7, 7, 0.3, 0, 0, 0, { rx: Math.PI / 2, seg: 24 });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; rose.box(stone, 0.25, 7, 0.4, Math.cos(a) * 3.5, Math.sin(a) * 3.5, 0, { rz: a + Math.PI / 2 }); }
    rose.torus(stone, 7, 0.4, 0, 0, 0);
    this.landmark = this.place(rose.build(), 0, 13, -P * 1.5 + 2);
    this.dyn(this.landmark);
    // mundane anchor: a vending machine in a side alcove, a mop bucket
    linked(this, vending(this, m, this.c(1)), W / 2 - 1.2, 0, 12, -Math.PI / 2, ['machine', 'light'], 'vending');
    const bucket = new Shape(); bucket.cyl(m.metal, 0.3, 0.25, 0.45, 0, 0.22, 0, { color: '#e0c040' }); bucket.cyl(m.wood, 0.03, 0.03, 1.4, 0.1, 0.9, 0, { rz: 0.2, seg: 4 });
    linked(this, bucket.build(), -W / 2 + 1.6, 0, 20, 0, ['water'], 'bucket', 'cyl');
    this.spawn.pos.set(0, 0.1, 30);
    this.spawn.yaw = 0;
    this.quiet = { pos: new THREE.Vector3(4, 0, -12), radius: 1.8 };
    this.killY = -20;
    this.flatSunscreen.set(0.5, 0.15);
    dress(this, {
      lamps, lf: { centre: new THREE.Vector3(0, 0, 0), radius: 5, count: 4 },
      phone: { pos: new THREE.Vector3(-W / 2 + 1.5, 0, 6), yaw: Math.PI / 2 },
      woman: { pos: new THREE.Vector3(0, 0, -44), yaw: Math.PI }, nestedAt: new THREE.Vector3(0, 0, 4),
    });
  }
  update() {
    for (let i = 0; i < this.shafts.length; i++) this.shafts[i].rotation.z = 0.5 + Math.sin(this.time * 0.1 + i) * 0.05;
    if (this.landmark) this.landmark.rotation.z = this.time * 0.02;
  }
}
