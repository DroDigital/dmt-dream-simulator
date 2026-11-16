import * as THREE from 'three/webgpu';
import { Realm } from './realm';
import { M, bench, vending, linked } from './props';
import { Shape } from './kit';
import { NightTrain } from '../entities/common';
import { solveWfc, type Tile } from './wfc';
import { dress } from './dress';

const TILES: Tile[] = [
  { id: 'road-ns', weight: 2, edges: ['r', 'b', 'r', 'b'] },
  { id: 'road-ew', weight: 2, edges: ['b', 'r', 'b', 'r'] },
  { id: 'cross', weight: 1, edges: ['r', 'r', 'r', 'r'] },
  { id: 'tall', weight: 3, edges: ['b', 'b', 'b', 'b'] },
  { id: 'low', weight: 3, edges: ['b', 'b', 'b', 'b'] },
  { id: 'park', weight: 1, edges: ['b', 'b', 'b', 'b'] },
  { id: 'tee-n', weight: 0.6, edges: ['r', 'r', 'b', 'r'] },
  { id: 'tee-s', weight: 0.6, edges: ['b', 'r', 'r', 'r'] },
];

/** 6 · Origami Metro: a paper city that folds and unfolds around a night train. */
export class OrigamiMetro extends Realm {
  folding: { obj: THREE.Object3D; phase: number; h: number }[] = [];
  outline!: THREE.Material;
  build() {
    const deep = this.ctx.deep;
    this.env = {
      ...this.env,
      skyTop: deep ? '#0a0a1a' : '#1a2448', skyHorizon: deep ? '#3a2030' : '#e0a080', skyBottom: '#101020',
      fog: deep ? '#2a2030' : '#c8b0a0', fogNear: 30, fogFar: 180, sunDir: [-0.5, 0.4, -0.6], sunColor: '#ffd8b0',
      skyAmb: '#c0c8e0', groundAmb: '#7a6a70', bloom: 0.8, trail: 0.5, kaleido: 0.15,
    };
    const m = M(this);
    const paper = this.mat('metro-paper', { map: this.tex('paper'), color: '#f6f0e4' });
    const paper2 = this.mat('metro-paper2', { map: this.tex('paper', 1), color: this.c(3) });
    this.outline = this.mat('metro-outline', { color: '#1a1820', unlit: true, side: THREE.BackSide, noFog: false });
    const G0 = 10, N = 12;
    this.ground(new THREE.PlaneGeometry(G0 * N + 60, G0 * N + 60).rotateX(-Math.PI / 2), this.mat('metro-ground', { map: this.tex('paper', 2), color: '#d8d0c0', repeat: [30, 30] }));
    const { grid } = solveWfc(TILES, N, N, this.rng.fork('wfc'), { '6,6': 'cross' });
    const lamps: THREE.Vector3[] = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = grid[y][x];
      const cx = (x - N / 2 + 0.5) * G0, cz = (y - N / 2 + 0.5) * G0;
      if (t === 'tall' || t === 'low') {
        const n = t === 'tall' ? 1 : 2;
        for (let k = 0; k < n * n; k++) {
          const ox = n === 1 ? 0 : (k % 2 ? 2.4 : -2.4), oz = n === 1 ? 0 : (k < 2 ? 2.4 : -2.4);
          const h = t === 'tall' ? this.rng.range(14, 30) : this.rng.range(4, 9);
          const w = t === 'tall' ? this.rng.range(5, 7) : 3.6;
          const s = new Shape();
          s.box(this.rng.chance(0.5) ? paper : paper2, w, h, w, 0, h / 2, 0, { uv: 3 });
          s.box(this.outline, w * 1.04, h * 1.01, w * 1.04, 0, h / 2, 0);
          for (let f = 1; f < h / 3; f++) if (this.rng.chance(0.4)) s.box(m.window, w * 0.3, 1, 0.05, this.rng.range(-w * 0.3, w * 0.3), f * 3, w / 2 + 0.03);
          const roof = new THREE.ConeGeometry(w * 0.72, 2.5, 4);
          s.add(paper, roof, 0, h + 1.25, 0, { ry: Math.PI / 4 });
          const l = linked(this, s.build(), cx + ox, 0, cz + oz, 0, ['paper', 'machine'], 'paper-building');
          this.dyn(l.object);
          this.folding.push({ obj: l.object, phase: this.rng.next() * 6.28, h });
        }
      } else if (t === 'park') {
        const s = new Shape();
        for (let i = 0; i < 5; i++) s.cone(paper2, 0.9, 3, this.rng.range(-3, 3), 1.5, this.rng.range(-3, 3), { seg: 4, color: '#a8d0a0' });
        this.place(s.build(), cx, 0, cz);
      } else {
        lamps.push(new THREE.Vector3(cx + 3, 3, cz + 3));
      }
    }
    // the night train on an elevated loop
    const R = 46;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * R, 7, Math.sin(a) * R * 0.8)); }
    const path = new THREE.CatmullRomCurve3(pts, true);
    const track = new Shape();
    for (let i = 0; i < 96; i++) {
      const p = path.getPointAt(i / 96), tn = path.getTangentAt(i / 96);
      track.box(m.metal, 3.2, 0.3, 3.4, p.x, 6.8, p.z, { ry: Math.atan2(tn.x, tn.z), color: '#505060' });
      if (i % 6 === 0) track.box(m.metal, 0.5, 6.8, 0.5, p.x, 3.4, p.z, { color: '#505060' });
    }
    const trackObj = track.build(); this.root.add(trackObj);
    for (const c of trackObj.children) this.physics.fixedMesh(c as THREE.Mesh);
    this.train = new NightTrain(this, path, 10, 5, this.ctx.coop >= 2 && this.ctx.chorusOk ? 2 : 0, false);
    this.addEntity(this.train);
    // station platform with stairs up (the quiet place: the platform bench)
    const plat = new Shape();
    plat.box(m.tile, 14, 0.4, 4, 0, 6.8, 0, { uv: 1.5 });
    for (let i = 0; i < 17; i++) plat.box(m.tile, 2.5, 0.4 * (i + 1), 0.6, 8.4, 0.2 * (i + 1), -1.4 + i * 0.4 * 0 + 0, { uv: 1 });
    const st = new Shape();
    for (let i = 0; i < 17; i++) st.box(m.tile, 2.4, 0.4, 0.55, 0, 0.4 * i + 0.2, i * 0.55, { uv: 1 });
    const platObj = this.place(plat.build(), R - 4.5, 0, 0, 0);
    this.solid(platObj, 'mesh');
    const stairs = this.place(st.build(), R - 4.5 - 9, 0, -9.3, 0);
    this.solid(stairs, 'mesh');
    this.place(bench(this, m), R - 6, 7, -1.2, 0);
    linked(this, vending(this, m, this.c(1)), R - 1, 7, -1.4, 0, ['machine', 'light'], 'vending');
    lamps.push(new THREE.Vector3(R - 4.5, 9, 0));
    // landmark: the folding tower
    const tw = new Shape();
    for (let i = 0; i < 9; i++) tw.box(i % 2 ? paper : paper2, 6 - i * 0.5, 4, 6 - i * 0.5, 0, 2 + i * 4, 0, { ry: i * 0.3 });
    tw.cone(paper, 1.5, 6, 0, 39, 0, { seg: 4 });
    this.landmark = linked(this, tw.build(), 0, 0, 0, 0, ['paper'], 'folding-tower').object;
    this.dyn(this.landmark);
    this.spawn.pos.set(R - 6, 7.3, 1);
    this.spawn.yaw = Math.PI / 2;
    this.quiet = { pos: new THREE.Vector3(R - 6, 7, -1), radius: 2 };
    this.killY = -20;
    dress(this, {
      lamps, lf: { centre: new THREE.Vector3(R - 15, 0, 0), radius: 20, count: 4 },
      phone: { pos: new THREE.Vector3(R - 9, 7, 1.2), yaw: Math.PI },
      kite: new THREE.Vector3(R - 10, 22, 0), woman: { pos: new THREE.Vector3(10, 0, 10), yaw: 0 }, nestedAt: new THREE.Vector3(R - 2, 7, 0.5),
    });
  }
  train!: NightTrain;
  update() {
    // the city folds and unfolds
    for (const f of this.folding) {
      const k = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this.time * 0.25 + f.phase));
      f.obj.scale.y = k;
      f.obj.rotation.y = Math.sin(this.time * 0.1 + f.phase) * 0.15;
    }
    if (this.landmark) this.landmark.rotation.y = this.time * 0.05;
  }
}
