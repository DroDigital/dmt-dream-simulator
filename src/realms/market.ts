import * as THREE from 'three/webgpu';
import { Realm } from './realm';
import { M, stall, vending, lanternStand, linked } from './props';
import { Shape } from './kit';
import { dress } from './dress';

/** 2 · Lantern Market: a night bazaar of floating stalls run by Lanternfolk. */
export class LanternMarket extends Realm {
  lanterns!: THREE.InstancedMesh;
  stalls: THREE.Object3D[] = [];
  build() {
    const deep = this.ctx.deep;
    const party = this.ctx.realLife.lanternParty;
    this.env = {
      ...this.env,
      skyTop: '#0a0620', skyHorizon: deep ? '#401040' : '#6a2a6a', skyBottom: '#05030f',
      fog: deep ? '#200a28' : '#3a1840', fogNear: 20, fogFar: 140, sunDir: [0, 1, 0], sunColor: '#2a1a30',
      skyAmb: '#ff9ac0', groundAmb: '#6a3060', bloom: party ? 1.6 : 1.25, bloomThreshold: 0.6, trail: 0.65, kaleido: 0.25, stars: 0.8,
    };
    const m = M(this);
    const ground = this.mat('market-ground', { map: this.tex('stone'), color: '#b8a0b0' });
    this.ground(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), this.mat('market-ground-big', { map: this.tex('stone'), color: '#9a8090', repeat: [50, 50] }));
    void ground;
    const lamps: THREE.Vector3[] = [];
    // stalls float a little above the ground on a grid of lanes
    const cols = ['#ff5d8f', '#ffb347', '#3de0c8', '#7a5cff', '#fff27a'];
    for (let gx = -4; gx <= 4; gx++) for (let gz = -5; gz <= 4; gz++) {
      if (gx === 0 || gz === 0) continue; // main lanes
      if (!this.rng.chance(0.62 * this.density)) continue;
      const x = gx * 9 + this.rng.range(-1, 1), z = gz * 8 + this.rng.range(-1, 1);
      const s = stall(this, m, this.rng.pick(cols));
      const l = linked(this, s, x, 0.6 + this.rng.range(0, 0.6), z, (gx < 0 ? 1 : -1) * Math.PI / 2 + this.rng.range(-0.2, 0.2), ['light', 'paper'], 'stall');
      this.dyn(l.object);
      this.stalls.push(l.object);
      lamps.push(new THREE.Vector3(x, 2.4, z));
    }
    // 2,000 instanced lanterns strung overhead
    const lanternMat = this.mat('market-lanterns', { map: this.tex('lantern'), emissive: this.c(4, 0.3), emissiveIntensity: 1.8, unlit: true, bob: 0.25 });
    const N = Math.round((party ? 3000 : 2000) * Math.min(1.3, this.density));
    this.lanterns = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.26, 0.45, 6), lanternMat, N);
    const col = new THREE.Color();
    const mm = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const strand = i % 40;
      const t = Math.floor(i / 40) / (N / 40);
      const ax = -45 + strand * 2.3, az = -45 + t * 90;
      const sag = Math.sin(t * Math.PI * 6) * 1.2;
      mm.makeTranslation(ax + this.rng.range(-0.6, 0.6), 6 + sag + this.rng.range(0, 3) + (i % 7) * 0.3, az);
      this.lanterns.setMatrixAt(i, mm);
      this.lanterns.setColorAt(i, col.set(cols[i % 5]));
    }
    this.root.add(this.lanterns);
    // landmark: the market gate, a ring of lanterns on two pillars
    const gate = new Shape();
    for (const x of [-5, 5]) gate.cyl(m.wood, 0.5, 0.6, 9, x, 4.5, 0, { seg: 8, color: '#c0302a' });
    gate.box(m.wood, 13, 0.8, 1, 0, 9.2, 0, { color: '#c0302a' });
    gate.torus(m.lantern, 3.6, 0.35, 0, 5, 0);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; gate.cyl(m.lantern, 0.3, 0.3, 0.6, Math.cos(a) * 3.6, 5 + Math.sin(a) * 3.6, 0, { seg: 6 }); }
    this.landmark = linked(this, gate.build(), 0, 0, -44, 0, ['light', 'paper'], 'market-gate').object;
    lamps.push(new THREE.Vector3(0, 5, -44));
    // mundane anchor
    linked(this, vending(this, m, '#3de0c8'), 4.5, 0, 30, Math.PI, ['machine', 'light'], 'vending');
    for (let i = 0; i < 10; i++) linked(this, lanternStand(this, m), this.rng.range(-3, 3), 0, -40 + i * 8, this.rng.next() * 6, ['light', 'paper'], 'lantern-stand', 'cyl');
    // quiet place: a closed stall with its shutters down
    const cs = new Shape();
    cs.box(m.wood, 2.6, 2.4, 1.4, 0, 1.2, 0, { uv: 1, color: '#806070' });
    this.place(cs.build(), 40, 0, 36, Math.PI);
    this.solid(this.root.children[this.root.children.length - 1]);
    this.quiet = { pos: new THREE.Vector3(40, 0, 34), radius: 2.2 };
    this.spawn.pos.set(0, 0.1, 30);
    this.spawn.yaw = 0;
    this.killY = -20;
    dress(this, {
      lamps, lf: { centre: new THREE.Vector3(0, 0, 0), radius: 36, count: party ? 22 : 14 },
      phone: { pos: new THREE.Vector3(-2.5, 0, 22), yaw: 0 },
      kite: new THREE.Vector3(0, 14, -20), woman: { pos: new THREE.Vector3(-40, 0, -30), yaw: Math.PI },
      nestedAt: new THREE.Vector3(2, 0, 20),
    });
  }
  update() {
    for (let i = 0; i < this.stalls.length; i++) {
      const s = this.stalls[i];
      s.position.y = 0.9 + Math.sin(this.time * 0.7 + i) * 0.25;
    }
  }
}
