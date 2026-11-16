import * as THREE from 'three/webgpu';
import { Realm } from './realm';
import { M, desk, locker, door, piano, linked } from './props';
import { Shape } from './kit';
import { solveWfc, type Tile } from './wfc';
import { signalMaterial } from './portal';
import { DREAM_REALMS, type RealmId } from '../data/types';
import { dress } from './dress';

const CW = 1.6;
/** [dx, dz, door yaw facing inward] for N, E, S, W */
const SIDES: [number, number, number][] = [[0, -1, 0], [1, 0, -Math.PI / 2], [0, 1, Math.PI], [-1, 0, Math.PI / 2]];

const TILES: Tile[] = [
  { id: 'ns', weight: 3, edges: ['c', 'w', 'c', 'w'] },
  { id: 'ew', weight: 3, edges: ['w', 'c', 'w', 'c'] },
  { id: 'x', weight: 1, edges: ['c', 'c', 'c', 'c'] },
  { id: 'ne', weight: 1, edges: ['c', 'c', 'w', 'w'] },
  { id: 'es', weight: 1, edges: ['w', 'c', 'c', 'w'] },
  { id: 'sw', weight: 1, edges: ['w', 'w', 'c', 'c'] },
  { id: 'wn', weight: 1, edges: ['c', 'w', 'w', 'c'] },
  { id: 'room', weight: 1.4, edges: ['w', 'w', 'w', 'w'] },
];

/** 12 · Night School: corridors that loop, classroom doors onto other realms, a piano somewhere. */
export class NightSchool extends Realm {
  wrap = { axis: 'xz' as const, period: 0 };
  clockHand!: THREE.Object3D;
  build() {
    const deep = this.ctx.deep;
    this.env = {
      ...this.env,
      skyTop: '#0a0c18', skyHorizon: '#1a2030', skyBottom: '#05060a',
      fog: deep ? '#05060c' : '#1a2030', fogNear: 6, fogFar: 55, sunDir: [-0.7, 0.3, 0.6], sunColor: '#8090c0',
      skyAmb: '#6a7898', groundAmb: '#2a3040', bloom: 0.7, bloomThreshold: 0.8, trail: 0.4, kaleido: 0.08, grade: 0.4, stars: 0.4,
    };
    const m = M(this);
    const N = 8, S = 8, H = 3.4;
    const P = N * S;
    this.wrap.period = P;
    const floorMat = this.mat('school-floor', { map: this.tex('tile'), color: '#b8b0a0' });
    const wall = this.mat('school-wall', { map: this.tex('plaster'), color: '#d0ccc0' });
    const ceil = this.mat('school-ceil', { map: this.tex('tile', 1), color: '#a8a8a0' });
    const { grid } = solveWfc(TILES, N, N, this.rng.fork('school'), { '0,0': 'x' });
    const others = DREAM_REALMS.filter((r) => r !== 'school');
    const screens = new Map<RealmId, THREE.Material>();
    const lamps: THREE.Vector3[] = [];
    // three copies in each direction so the loop is seamless
    for (let cy = -1; cy <= 1; cy++) for (let cx = -1; cx <= 1; cx++) {
      const s = new Shape();
      const props = cx === 0 && cy === 0;
      s.box(floorMat, P, 0.1, P, cx * P, -0.05, cy * P, { uv: 2 });
      s.box(ceil, P, 0.1, P, cx * P, H + 0.05, cy * P, { uv: 2 });
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const t = grid[y][x];
        const ox = cx * P + (x - N / 2 + 0.5) * S, oz = cy * P + (y - N / 2 + 0.5) * S;
        const open = TILES.find((tt) => tt.id === t)!.edges.map((e) => e === 'c');
        const half = S / 2, cw = CW;
        if (t === 'room') { s.box(wall, S, H, S, ox, H / 2, oz, { uv: 2 }); continue; }
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const bw = half - cw;
          s.box(wall, bw, H, bw, ox + sx * (cw + bw / 2), H / 2, oz + sz * (cw + bw / 2), { uv: 2 });
        }
        SIDES.forEach(([dx, dz], i) => {
          if (open[i]) return;
          const bw = half - cw;
          s.box(wall, dx ? bw : 2 * cw, H, dz ? bw : 2 * cw, ox + dx * (cw + bw / 2), H / 2, oz + dz * (cw + bw / 2), { uv: 2 });
        });
        if (props && (x + y) % 2 === 0) lamps.push(new THREE.Vector3(ox, H - 0.2, oz));
      }
      const g = s.build();
      this.root.add(g);
      for (const c of g.children) this.physics.fixedMesh(c as THREE.Mesh);
    }
    // ceiling strip lights
    const light = new Shape();
    for (const p of lamps) light.box(m.lamp, 0.3, 0.05, 1.6, p.x, H - 0.03, p.z);
    this.root.add(light.build());
    // classroom doors onto other realms on closed corridor walls; lockers, desks
    let di = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = grid[y][x];
      if (t === 'room') continue;
      const ox = (x - N / 2 + 0.5) * S, oz = (y - N / 2 + 0.5) * S;
      const open = TILES.find((tt) => tt.id === t)!.edges.map((e) => e === 'c');
      SIDES.forEach(([dx, dz, ry], i) => {
        if (open[i]) return;
        const r = this.rng.next();
        const px = ox + dx * (CW - 0.02), pz = oz + dz * (CW - 0.02);
        if (r < 0.45) {
          const target = others[di++ % others.length];
          if (!screens.has(target)) screens.set(target, signalMaterial(target, 0.8));
          const d = door(this, m, this.c(1));
          const pane = new Shape(); pane.box(screens.get(target)!, 0.45, 0.6, 0.03, 0, 1.55, 0.12);
          d.add(pane.build());
          this.place(d, px, 0, pz, ry);
          this.link(d, ['paper', 'glass'], { kind: 'classroom-door', special: { type: 'realm', realm: target }, thin: true });
        } else if (r < 0.65) {
          const lk = locker(this, m, 4);
          lk.position.set(-0.75, 0, 0);
          const g = new THREE.Group(); g.add(lk);
          linked(this, g, px - dx * 0.25, 0, pz - dz * 0.25, ry, ['machine', 'paper'], 'lockers');
        } else if (r < 0.75) {
          const fc = new Shape(); fc.box(m.metal, 0.6, 1.2, 0.4, 0, 0.6, 0, { color: '#c0c8d0' }); fc.box(m.lamp, 0.3, 0.2, 0.05, 0, 1.0, 0.21);
          linked(this, fc.build(), px - dx * 0.25, 0, pz - dz * 0.25, ry, ['water', 'machine'], 'water-fountain');
        }
      });
      if (t === 'x' && this.rng.chance(0.3)) linked(this, desk(this, m), ox + 0.8, 0, oz + 0.8, this.rng.next() * 6, ['paper'], 'desk');
    }
    // landmark: the clock at the first crossing; the quiet place: the music room piano
    const ck = new Shape(); ck.cyl(m.white, 0.6, 0.6, 0.1, 0, 0, 0, { rx: Math.PI / 2, seg: 20 }); ck.torus(m.dark, 0.6, 0.05, 0, 0, 0);
    const clockObj = this.place(ck.build(), (0 - N / 2 + 0.5) * S, 2.6, (0 - N / 2 + 0.5) * S - CW + 0.05);
    this.landmark = clockObj;
    const hand = new Shape(); hand.box(m.dark, 0.04, 0.45, 0.02, 0, 0.2, 0);
    this.clockHand = this.place(hand.build(), clockObj.position.x, 2.6, clockObj.position.z + 0.07);
    this.dyn(this.clockHand);
    const pianoPos = this.findTile(grid, N, S, ['ew', 'ns']);
    linked(this, piano(this, m), pianoPos.x, 0, pianoPos.z, 0, ['paper', 'machine'], 'piano', 'box', 0.8);
    this.quiet = { pos: pianoPos.clone(), radius: 2 };
    const sp = (0 - N / 2 + 0.5) * S;
    this.spawn.pos.set(sp, 0.1, sp + 1);
    this.spawn.yaw = Math.PI;
    this.killY = -10;
    dress(this, {
      lamps, lf: { centre: new THREE.Vector3(sp, 0, sp), radius: 2, count: 1 },
      phone: { pos: new THREE.Vector3(sp - 1.3, 0, sp + 1.3), yaw: Math.PI / 2 },
      woman: { pos: new THREE.Vector3(sp + 8, 0, sp), yaw: Math.PI / 2 }, nestedAt: new THREE.Vector3(sp, 0, sp - 1),
    });
  }
  findTile(grid: string[][], N: number, S: number, ids: string[]) {
    for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) if (ids.includes(grid[y][x])) return new THREE.Vector3((x - N / 2 + 0.5) * S, 0, (y - N / 2 + 0.5) * S);
    return new THREE.Vector3(0, 0, 0);
  }
  update() {
    this.clockHand.rotation.z = -(this.time / 12) * Math.PI * 2;
    if (Math.floor(this.time / 9) !== Math.floor((this.time - 1 / 60) / 9) && this.quiet) this.hooks?.sfx('piano', this.quiet.pos, this.key, 0.6);
  }
}
