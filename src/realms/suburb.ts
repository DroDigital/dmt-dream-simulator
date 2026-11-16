import * as THREE from 'three/webgpu';
import { Realm } from './realm';
import { M, house, vending, busStop, bicycle, laundryLine, tree, lamppost, bench, linked } from './props';
import { Shape } from './kit';
import { dress } from './dress';

/** 4 · Evening Suburb: an ordinary street at 6 p.m. that never ends. */
export class EveningSuburb extends Realm {
  period = 128;
  wrap = { axis: 'z' as const, period: 128 };

  build() {
    const deep = this.ctx.deep;
    this.env = {
      ...this.env,
      skyTop: deep ? '#2a1a3a' : '#3a5a9a', skyHorizon: deep ? '#c0603a' : '#ffb070', skyBottom: '#402a30',
      fog: deep ? '#8a4a4a' : '#f0b890', fogNear: 30, fogFar: 170, sunDir: [-0.85, 0.18, -0.3], sunColor: '#ffb070',
      skyAmb: '#8a90c0', groundAmb: '#7a5040', bloom: 0.55, bloomThreshold: 0.85, godrays: 0.25, kaleido: 0.1, trail: 0.35, grade: 0.4, stars: 0.15,
    };
    const m = M(this);
    const P = this.period;
    const asphalt = this.mat('asphalt', { map: this.tex('asphalt'), color: '#c0b8c0' });
    const pave = this.mat('pave', { map: this.tex('tile'), color: '#d8ccc0' });
    const grass = this.mat('grass', { map: this.tex('grass') });
    const shadow = this.mat('shadow', { color: '#000000', transparent: true, opacity: 0.32, unlit: true, noFog: true, depthWrite: false });
    const wire = this.mat('wire', { color: '#202028', unlit: true });
    const ground = new Shape();
    ground.box(asphalt, 10, 0.1, P * 3, 0, -0.05, 0, { uv: 8 });
    for (const x of [-7, 7]) ground.box(pave, 4, 0.2, P * 3, x, 0, 0, { uv: 2 });
    for (const x of [-30, 30]) ground.box(grass, 42, 0.1, P * 3, x, -0.02, 0, { uv: 4 });
    const g = ground.build(); this.root.add(g);
    for (const c of g.children) this.physics.fixedMesh(c as THREE.Mesh);

    // one period of lots per side, repeated three times: houses repeat a little too often
    const lots = 16;
    const types = ['house', 'house', 'house', 'garden', 'alley', 'shop', 'vacant'];
    const seqs: string[][] = [[], []];
    for (const side of [0, 1]) {
      for (let i = 0; i < lots; i++) {
        let t = this.rng.pick(types);
        const prev = seqs[side][i - 1];
        if ((t === 'alley' || t === 'shop') && prev === t) t = 'house';
        if (i % 4 === 0) t = 'cross';
        seqs[side].push(t);
      }
    }
    const lamps: THREE.Vector3[] = [];
    const houseVariant = this.rng.int(0, 5);
    const sunX = -0.85, sunZ = -0.3;
    const addShadow = (x: number, z: number, w: number, d: number, len: number) => {
      const s = new Shape();
      s.plane(shadow, len, d, 0, 0, 0, { rx: -Math.PI / 2 });
      const o = s.build();
      o.position.set(x - sunX * len * 0.5, 0.11, z - sunZ * len * 0.5);
      o.rotation.y = Math.atan2(sunZ, -sunX) * 0 ;
      this.root.add(o);
    };
    for (let copy = -1; copy <= 1; copy++) {
      for (const side of [0, 1]) {
        const sx = side ? 1 : -1;
        const ry = side ? -Math.PI / 2 : Math.PI / 2;
        for (let i = 0; i < lots; i++) {
          const z = copy * P - P / 2 + i * 8 + 4;
          const t = seqs[side][i];
          const vr = this.rng.fork(`lot${side}-${i}`); // same per copy → exact repeats
          const x = sx * 15;
          if (t === 'house' || t === 'shop') {
            const w = vr.range(6, 7.5), fl = vr.int(1, 2);
            const col = vr.pick([this.c(3), '#f4e4d0', '#e8d0c0', this.c(0, 0.2), '#d0dce8']);
            const h = house(this, m, w, 7, fl, col, houseVariant + vr.int(0, 2));
            linked(this, h, x, 0, z, ry, ['paper', 'machine'], t === 'shop' ? 'shop' : 'house');
            addShadow(x, z, w, 7, fl * 5);
            if (t === 'shop') {
              const s = new Shape(); s.box(m.window, 5, 2, 0.1, 0, 1.2, 0); s.box(m.fabric, 5.5, 0.1, 1.4, 0, 2.6, 0.6, { rx: 0.25, color: this.c(1) });
              this.place(s.build(), sx * 11.4, 0, z, ry);
              lamps.push(new THREE.Vector3(sx * 11, 2.5, z));
            }
          } else if (t === 'garden') {
            linked(this, tree(this, m, vr.range(4, 6), vr.int(0, 2)), x, 0, z - 1, 0, ['paper'], 'tree', 'cyl');
            linked(this, laundryLine(this, m, 5), sx * 13, 0, z + 2, Math.PI / 2, ['paper'], 'laundry');
          } else if (t === 'alley') {
            linked(this, vending(this, m, vr.pick([this.c(1), this.c(2), '#e04040'])), sx * 10.5, 0, z, ry, ['machine', 'light'], 'vending');
            lamps.push(new THREE.Vector3(sx * 10.5, 1.6, z));
          } else if (t === 'vacant') {
            linked(this, bicycle(this, m), sx * 9.8, 0, z, ry + 0.3, ['machine'], 'bicycle');
          } else if (t === 'cross' && side === 0) {
            const lp = lamppost(this, m);
            linked(this, lp, 9.5, 0, z, -Math.PI / 2, ['light', 'machine'], 'streetlamp', 'cyl');
            lamps.push(new THREE.Vector3(8.7, 4.4, z));
          }
        }
        // power poles + wires every 16 m
        for (let i = 0; i < lots / 2; i++) {
          const z = copy * P - P / 2 + i * 16;
          const pole = new Shape(); pole.cyl(m.wood, 0.12, 0.16, 8, 0, 4, 0, { seg: 6 }); pole.box(m.wood, 1.6, 0.12, 0.12, 0, 7.4, 0);
          const p = this.place(pole.build(), sx * 10, 0, z);
          this.solid(p, 'cyl');
          addShadow(sx * 10, z, 0.3, 0.3, 9);
          const w = new Shape(); w.box(wire, 0.02, 0.02, 16, 0, 0, 0); w.box(wire, 0.02, 0.02, 16, 0.6, 0, 0);
          this.place(w.build(), sx * 10 - 0.3, 7.3, z + 8);
        }
      }
      // bus stop (mundane anchor, the quiet place) and the water tower landmark, once per period
      const bz = copy * P + 12;
      linked(this, busStop(this, m), -8.4, 0.1, bz, Math.PI / 2, ['machine', 'paper'], 'busstop');
      const wt = new Shape();
      for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) wt.box(m.metal, 0.3, 16, 0.3, x, 8, z, { color: '#7a7a8a' });
      wt.cyl(m.metal, 4, 4, 5, 0, 18, 0, { seg: 12, color: this.c(3) });
      wt.cone(m.roof, 4.3, 2.4, 0, 21.7, 0, { seg: 12 });
      const tower = this.place(wt.build(), -46, 0, copy * P - 30);
      if (copy === 0) this.landmark = tower;
    }
    this.thinSpots.push(new THREE.Vector3(9, 1, 0)); // shop windows
    this.spawn.pos.set(0, 0.1, 0);
    this.spawn.yaw = Math.PI;
    this.quiet = { pos: new THREE.Vector3(-8.4, 0, 12), radius: 2 };
    this.killY = -20;
    dress(this, {
      lamps, lf: { centre: new THREE.Vector3(0, 0, 0), radius: 30, count: 2 },
      phone: { pos: new THREE.Vector3(-9.5, 0.1, 20), yaw: Math.PI / 2 },
      kite: new THREE.Vector3(6, 12, -20), woman: { pos: new THREE.Vector3(11.6, 0.1, 36), yaw: -Math.PI / 2 },
      nestedAt: new THREE.Vector3(-7, 0.1, 30),
    });
    // bench at the bus stop
    this.place(bench(this, m), -8.6, 0.1, 14.5, Math.PI / 2);
  }
}
