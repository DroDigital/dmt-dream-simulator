import * as THREE from 'three/webgpu';
import { Realm } from './realm';
import { M, tree, busStop, linked } from './props';
import { Shape } from './kit';
import { Drifters } from '../entities/common';
import { dress } from './dress';

/** 1 · Cloud Orchard: pastel trees whose fruit are tiny ringed planets, on islands of cloud. */
export class CloudOrchard extends Realm {
  puffs!: THREE.InstancedMesh;
  build() {
    const deep = this.ctx.deep;
    this.env = {
      ...this.env,
      skyTop: deep ? '#6a5a9a' : '#a8d8ff', skyHorizon: deep ? '#e0a0c0' : '#fff0f6', skyBottom: '#ffe8f0',
      fog: '#fff0f8', fogNear: 30, fogFar: 220, sunDir: [0.3, 0.7, -0.5], sunColor: '#fff4e0',
      skyAmb: '#dce8ff', groundAmb: '#ffd8e8', bloom: 1.0, bloomThreshold: 0.78, trail: 0.5, kaleido: 0.3, stars: 0.1, mandala: 0.9, fogHeight: 0.6, fogBase: -10,
    };
    const m = M(this);
    const cloud = this.mat('cloud', { map: this.tex('cloud'), color: '#ffffff', emissive: '#fff0f8', emissiveIntensity: 0.25 });
    const planet = this.mat('planet', { map: this.tex('marble'), emissive: this.c(3), emissiveIntensity: 0.4, film: 0.7 });
    const ring = this.mat('ring', { color: this.c(4), emissive: this.c(4), emissiveIntensity: 0.8, side: THREE.DoubleSide, unlit: true });
    const islands: { x: number; y: number; z: number; r: number }[] = [{ x: 0, y: 0, z: 0, r: 16 }];
    const n = 9;
    for (let i = 1; i < n; i++) {
      const prev = islands[this.rng.int(0, i - 1)];
      const a = this.rng.next() * Math.PI * 2;
      const r = this.rng.range(7, 14);
      const d = prev.r + r + this.rng.range(1.5, 5);
      islands.push({ x: prev.x + Math.cos(a) * d, y: prev.y + this.rng.range(-3, 6), z: prev.z + Math.sin(a) * d, r });
    }
    const puffs: THREE.Matrix4[] = [];
    const lamps: THREE.Vector3[] = [];
    islands.forEach((is, idx) => {
      const s = new Shape();
      s.cyl(cloud, is.r, is.r * 0.75, 2.4, 0, -1.2, 0, { seg: 12, uv: 4 });
      s.sphere(cloud, is.r * 0.7, 0, -2.5, 0, { w: 10, h: 6, sy: 0.5 });
      const o = this.place(s.build(), is.x, is.y, is.z);
      this.solid(o, 'mesh');
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        const mm = new THREE.Matrix4().compose(new THREE.Vector3(is.x + Math.cos(a) * is.r * 0.95, is.y - 0.6 + this.rng.range(-0.5, 0.6), is.z + Math.sin(a) * is.r * 0.95), new THREE.Quaternion(), new THREE.Vector3().setScalar(this.rng.range(1.6, 3)));
        puffs.push(mm);
      }
      // pastel trees with ringed-planet fruit
      const trees = Math.round((is.r / 4) * this.density);
      for (let t = 0; t < trees; t++) {
        const a = this.rng.next() * Math.PI * 2, d = this.rng.next() * is.r * 0.7;
        const tx = is.x + Math.cos(a) * d, tz = is.z + Math.sin(a) * d;
        const tr = tree(this, m, this.rng.range(3.5, 6), 2, planet);
        linked(this, tr, tx, is.y, tz, this.rng.next() * 6, ['light', 'glass'], 'planet-tree', 'cyl');
        if (this.rng.chance(0.5)) {
          const rr = new Shape(); rr.torus(ring, 0.32, 0.02, 0, 0, 0, { rx: 1.2 });
          this.dyn(this.place(rr.build(), tx + 1, is.y + 4, tz));
        }
      }
      // glass bells hanging from cloud arches
      if (idx % 3 === 1) {
        const b = new Shape();
        b.torus(cloud, 3, 0.4, 0, 3, 0, { arc: Math.PI });
        b.cone(m.glass, 0.45, 0.8, 0, 5.4, 0, { seg: 8 });
        linked(this, b.build(), is.x, is.y, is.z, this.rng.next() * 3, ['glass', 'light'], 'bell-arch');
        lamps.push(new THREE.Vector3(is.x, is.y + 5.4, is.z));
      }
    });
    // bridges of cloud between some islands
    for (let i = 1; i < islands.length; i++) {
      if (!this.rng.chance(0.6)) continue;
      const a = islands[i], b = islands[i - 1];
      const dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
      const len = Math.hypot(dx, dz);
      const s = new Shape();
      s.box(cloud, 2.6, 0.6, len, 0, 0, 0, { uv: 3 });
      const o = s.build();
      o.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.3, (a.z + b.z) / 2);
      o.rotation.set(0, Math.atan2(dx, dz), 0);
      o.rotateX(-Math.atan2(dy, len));
      this.root.add(o);
      o.updateMatrixWorld(true);
      this.solid(o, 'mesh');
    }
    this.puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), cloud, puffs.length);
    puffs.forEach((mm, i) => this.puffs.setMatrixAt(i, mm));
    this.root.add(this.puffs);
    // landmark: the ringed tree
    const big = new Shape();
    big.cyl(m.bark, 0.9, 1.6, 14, 0, 7, 0, { seg: 8 });
    big.sphere(m.leaf, 7, 0, 16, 0, { w: 10, h: 7, sy: 0.7 });
    big.sphere(planet, 2.2, 0, 24, 0, { w: 12, h: 8 });
    big.torus(ring, 3.6, 0.12, 0, 24, 0, { rx: 1.25 });
    this.landmark = linked(this, big.build(), islands[0].x + 6, islands[0].y, islands[0].z - 6, 0, ['light', 'glass'], 'ringed-tree', 'cyl').object;
    // mundane anchor: a bus stop on a cloud
    const far = islands[islands.length - 1];
    linked(this, busStop(this, m), far.x, far.y, far.z, this.rng.next() * 6, ['machine', 'paper'], 'busstop');
    // quiet place: a swing hanging from nothing
    const sw = new Shape();
    sw.box(m.white, 0.02, 4, 0.02, -0.4, 2.4, 0); sw.box(m.white, 0.02, 4, 0.02, 0.4, 2.4, 0); sw.box(m.wood, 0.9, 0.06, 0.35, 0, 0.45, 0);
    const swing = this.place(sw.build(), islands[1].x, islands[1].y, islands[1].z);
    this.dyn(swing);
    this.swing = swing;
    this.quiet = { pos: new THREE.Vector3(islands[1].x, islands[1].y, islands[1].z), radius: 2.5 };
    this.addEntity(new Drifters(this, new THREE.Vector3(0, 4, 0), Math.round(24 * this.density), 60, 16));
    this.spawn.pos.set(0, 0.2, 6);
    this.spawn.yaw = 0;
    this.killY = -30;
    dress(this, {
      lamps, lf: { centre: new THREE.Vector3(0, 0, 0), radius: 10, count: 3 },
      phone: { pos: new THREE.Vector3(-8, 0, 3), yaw: Math.PI / 2 },
      kite: new THREE.Vector3(4, 12, -16), woman: { pos: new THREE.Vector3(islands[2].x, islands[2].y, islands[2].z), yaw: 0 },
      nestedAt: new THREE.Vector3(5, 0, 5),
    });
  }
  swing!: THREE.Object3D;
  update() {
    this.swing.rotation.x = Math.sin(this.time * 0.9) * 0.25;
    this.puffs.rotation.y = Math.sin(this.time * 0.02) * 0.01;
  }
}
