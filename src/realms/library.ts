import * as THREE from 'three/webgpu';
import { Realm } from './realm';
import { M, bookshelf, desk, linked } from './props';
import { Shape } from './kit';
import { BookFish, Drifters } from '../entities/common';
import { causticLayer } from './water';
import { solveWfc, type Tile } from './wfc';
import { dress } from './dress';

const TILES: Tile[] = [
  { id: 'aisle', weight: 3, edges: ['o', 'o', 'o', 'o'] },
  { id: 'shelf-ns', weight: 2, edges: ['o', 's', 'o', 's'] },
  { id: 'shelf-ew', weight: 2, edges: ['s', 'o', 's', 'o'] },
  { id: 'pool', weight: 0.6, edges: ['o', 'o', 'o', 'o'] },
  { id: 'reading', weight: 0.5, edges: ['o', 'o', 'o', 'o'] },
];

/** 7 · Drowned Library: sunken stacks where books swim like fish; slow, green light. */
export class DrownedLibrary extends Realm {
  build() {
    const deep = this.ctx.deep;
    this.env = {
      ...this.env,
      skyTop: '#06201e', skyHorizon: '#1a5a4a', skyBottom: '#031010',
      fog: deep ? '#02100e' : '#1a4a40', fogNear: 6, fogFar: 70, fogHeight: 0.7, fogBase: 2, sunDir: [0.1, 1, 0.2], sunColor: '#8fd8b0',
      skyAmb: '#5aa890', groundAmb: '#204a40', bloom: 1.0, bloomThreshold: 0.6, godrays: 0.5, trail: 0.7, kaleido: 0.2, wobble: 0.8, stars: 0, mandala: 0.15,
    };
    const m = M(this);
    const N = 9, S = 6;
    const floor = this.mat('lib-floor', { map: this.tex('tile'), color: '#6a9a88', repeat: [30, 30] });
    this.ground(new THREE.PlaneGeometry(N * S + 20, N * S + 20).rotateX(-Math.PI / 2), floor);
    this.dynamic.add(Object.assign(causticLayer(this, N * S + 20, N * S + 20, '#9fffd8', 0.35), { position: new THREE.Vector3(0, 0.03, 0) }));
    const wall = this.mat('lib-wall', { map: this.tex('books', 1), color: '#a8c8b8' });
    const walls = new Shape();
    const L = N * S + 6;
    for (const [x, z, w, d] of [[0, -L / 2, L, 1], [0, L / 2, L, 1], [-L / 2, 0, 1, L], [L / 2, 0, 1, L]] as const) walls.box(wall, w, 14, d, x, 7, z, { uv: 3 });
    walls.box(this.mat('lib-ceil', { color: '#0a2a26', emissive: '#1a5a4a', emissiveIntensity: 0.15 }), L, 0.5, L, 0, 14, 0);
    const wo = walls.build(); this.root.add(wo);
    for (const c of wo.children) this.physics.fixedMesh(c as THREE.Mesh);
    const { grid } = solveWfc(TILES, N, N, this.rng.fork('lib'), { '4,4': 'reading' });
    const lamps: THREE.Vector3[] = [];
    const water = this.mat('lib-pool', { map: this.tex('water'), color: '#5ae0c0', emissive: '#2a8a70', emissiveIntensity: 0.6, film: 0.3 });
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const cx = (x - N / 2 + 0.5) * S, cz = (y - N / 2 + 0.5) * S;
      const t = grid[y][x];
      if (t === 'shelf-ns' || t === 'shelf-ew') {
        const ry = t === 'shelf-ns' ? Math.PI / 2 : 0;
        const tilt = this.rng.range(-0.06, 0.06);
        const b = bookshelf(this, m, 5.6, this.rng.range(3.5, 6.5));
        const l = linked(this, b, cx, 0, cz, ry, ['paper', 'water'], 'bookshelf');
        l.object.rotation.z = tilt;
      } else if (t === 'pool') {
        const s = new Shape(); s.box(water, S - 0.6, 0.1, S - 0.6, 0, 0.05, 0);
        this.link(this.place(s.build(), cx, 0, cz), ['water'], { kind: 'pool', thin: true });
      } else if (t === 'reading' && !(x === 4 && y === 4)) {
        linked(this, desk(this, m), cx, 0, cz, this.rng.next() * 6, ['paper'], 'desk');
      }
    }
    // landmark: the great reading lamp in the centre, with the reading desk (quiet place)
    const lamp = new Shape();
    lamp.box(m.wood, 4, 0.9, 2, 0, 0.45, 0);
    lamp.cyl(m.metal, 0.12, 0.2, 9, 0, 4.5, -0.5, { seg: 6, color: '#7a8a40' });
    lamp.cone(this.mat('lib-shade', { color: '#2a8a50', emissive: '#40c080', emissiveIntensity: 0.6, side: THREE.DoubleSide }), 2.2, 1.6, 0, 9.2, -0.5, { seg: 10 });
    lamp.sphere(m.lamp, 0.6, 0, 8.6, -0.5);
    this.landmark = linked(this, lamp.build(), 0, 0, 0, 0, ['light', 'paper'], 'reading-lamp').object;
    lamps.push(new THREE.Vector3(0, 8.6, -0.5));
    // mundane anchor: a card catalogue and a photocopier
    const cat = new Shape();
    cat.box(m.wood, 1.8, 1.4, 0.7, 0, 0.7, 0);
    for (let i = 0; i < 12; i++) cat.box(m.white, 0.25, 0.1, 0.02, -0.6 + (i % 4) * 0.4, 0.3 + Math.floor(i / 4) * 0.4, 0.36);
    linked(this, cat.build(), 3, 0, 4, Math.PI, ['paper', 'machine'], 'catalogue');
    const pc = new Shape(); pc.box(m.plain, 1, 1, 0.7, 0, 0.5, 0, { color: '#c8c8c0' }); pc.box(m.lamp, 0.7, 0.03, 0.5, 0, 1.01, 0);
    linked(this, pc.build(), -L / 2 + 2, 0, L / 2 - 3, 0, ['machine', 'light'], 'photocopier');
    this.addEntity(new BookFish(this, new THREE.Vector3(0, 1, 0), Math.round(70 * this.density), L / 2 - 4));
    if (!this.laws.empty) this.addEntity(new Drifters(this, new THREE.Vector3(0, 4, 0), 8, 20, 8));
    this.spawn.pos.set(0, 0.1, 6);
    this.spawn.yaw = 0;
    this.quiet = { pos: new THREE.Vector3(0, 0, 1.6), radius: 1.6 };
    this.killY = -20;
    dress(this, {
      lamps, lf: { centre: new THREE.Vector3(0, 0, 0), radius: 18, count: 3 },
      phone: { pos: new THREE.Vector3(2.6, 0, 1.2), yaw: Math.PI, stand: true },
      woman: { pos: new THREE.Vector3(0, 0, -L / 2 + 1.2), yaw: Math.PI }, nestedAt: new THREE.Vector3(-3, 0, 4),
    });
  }
}
