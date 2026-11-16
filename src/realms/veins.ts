import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { Realm } from './realm';
import { M, vending, linked } from './props';
import { Shape } from './kit';
import { G, makeLoFi } from '../render/materials';
import { dress } from './dress';

const T: any = TSL;
const { positionLocal, normalLocal, sin, float, uniform, max, pow } = T;

/** 10 · The Veins: warm iridescent tubes that pulse with light, half organism, half pipe organ. */
export class TheVeins extends Realm {
  beat = uniform(0);
  organ: THREE.Object3D[] = [];
  build() {
    const deep = this.ctx.deep;
    this.env = {
      ...this.env,
      skyTop: '#1e0610', skyHorizon: '#5a1028', skyBottom: '#100208',
      fog: deep ? '#140208' : '#4a0e22', fogNear: 8, fogFar: 70, sunDir: [0, 1, 0], sunColor: '#ff7aa2',
      skyAmb: '#c04070', groundAmb: '#40081a', bloom: 1.3, bloomThreshold: 0.6, trail: 0.7, kaleido: 0.35, wobble: 0.5, stars: 0, mandala: 0,
    };
    const m = M(this);
    // pulsing displacement synced to the heartbeat
    const tubeMat = (name: string, col: string, glow: string) => {
      const mt = makeLoFi({ map: this.tex('flesh'), color: col, emissive: glow, emissiveIntensity: 0.5, film: 1.0 });
      mt.positionNode = positionLocal.add(normalLocal.mul(this.beat.mul(0.12)).mul(sin(positionLocal.y.mul(0.5).add(G.time.mul(3.0))).mul(0.5).add(0.5)));
      return mt;
    };
    const flesh = tubeMat('a', this.c(1), this.c(2));
    const flesh2 = tubeMat('b', this.c(3), this.c(1));
    // the chamber: a warm cave of lathe walls
    const cave = new THREE.LatheGeometry(Array.from({ length: 12 }, (_, i) => new THREE.Vector2(38 + Math.sin(i * 0.9) * 4 - (i > 8 ? (i - 8) * 8 : 0), i * 2.4)), 24);
    const caveMat = makeLoFi({ map: this.tex('flesh', 1), color: this.c(1), emissive: this.c(0), emissiveIntensity: 0.4, side: THREE.BackSide, film: 0.4 });
    const caveMesh = new THREE.Mesh(cave, caveMat);
    this.root.add(caveMesh);
    this.physics.fixedMesh(caveMesh);
    const floorGeo = new THREE.CircleGeometry(40, 32).rotateX(-Math.PI / 2);
    const fp = floorGeo.getAttribute('position');
    for (let i = 0; i < fp.count; i++) fp.setY(i, Math.sin(fp.getX(i) * 0.3) * Math.cos(fp.getZ(i) * 0.25) * 0.6);
    floorGeo.computeVertexNormals();
    this.ground(floorGeo, makeLoFi({ map: this.tex('flesh'), color: this.c(1, 0.2), emissive: this.c(0), emissiveIntensity: 0.3 }));
    // tubes arching across the chamber
    for (let i = 0; i < Math.round(22 * this.density); i++) {
      const a = this.rng.next() * Math.PI * 2, r = this.rng.range(8, 32);
      const p0 = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      const b = a + this.rng.range(1, 2.6);
      const p2 = new THREE.Vector3(Math.cos(b) * this.rng.range(8, 32), 0, Math.sin(b) * this.rng.range(8, 32));
      const p1 = p0.clone().add(p2).multiplyScalar(0.5).setY(this.rng.range(4, 16));
      const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
      const tube = new THREE.TubeGeometry(curve, 20, this.rng.range(0.4, 1.4), 7, false);
      const s = new Shape(); s.add(this.rng.chance(0.5) ? flesh : flesh2, tube);
      const obj = s.build(); this.root.add(obj);
      this.link(obj, ['flesh', 'machine'], { kind: 'vein', collide: 'mesh' });
    }
    // landmark: the heart organ, pipes that breathe with the beat
    const organ = new THREE.Group();
    for (let i = 0; i < 15; i++) {
      const h = 6 + Math.sin(i / 14 * Math.PI) * 14;
      const s = new Shape();
      s.cyl(i % 2 ? flesh : flesh2, 0.55, 0.65, h, 0, h / 2, 0, { seg: 8 });
      s.sphere(m.lamp, 0.3, 0, h + 0.2, 0);
      const pipe = s.build();
      pipe.position.set((i - 7) * 1.4, 0, Math.abs(i - 7) * 0.3);
      organ.add(pipe);
      this.organ.push(pipe);
    }
    this.landmark = linked(this, organ, 0, 0, -28, 0, ['flesh', 'machine'], 'heart-organ').object;
    this.dyn(organ);
    // mundane anchor: a radiator and a vending machine, half grown over
    linked(this, vending(this, m, '#a04050'), 14, 0, 10, -2.2, ['machine', 'flesh'], 'vending');
    const rad = new Shape(); for (let i = 0; i < 8; i++) rad.box(m.metal, 0.12, 0.8, 0.2, i * 0.18, 0.5, 0, { color: '#e8e0d8' });
    linked(this, rad.build(), -12, 0, 14, 0.8, ['machine'], 'radiator');
    // quiet place: a warm alcove
    this.quiet = { pos: new THREE.Vector3(-20, 0, -18), radius: 3 };
    const al = new Shape(); al.sphere(flesh2, 3, 0, 0, 0, { w: 10, h: 6, sy: 0.8 });
    this.place(al.build(), -23, 0, -21);
    this.spawn.pos.set(0, 0.6, 10);
    this.spawn.yaw = 0;
    this.killY = -15;
    dress(this, {
      lamps: this.organ.map((o) => new THREE.Vector3(o.position.x, 8, -28)).slice(0, 6), lf: { centre: new THREE.Vector3(0, 0, 0), radius: 15, count: 1 },
      phone: { pos: new THREE.Vector3(5, 0, 12), yaw: 3 }, woman: { pos: new THREE.Vector3(18, 0, -14), yaw: -1 }, nestedAt: new THREE.Vector3(-4, 0, 8),
    });
  }
  update() {
    // a slow heartbeat: lub-dub
    const t = (this.time * 1.1) % 1;
    const b = Math.exp(-((t - 0.05) ** 2) / 0.002) + 0.6 * Math.exp(-((t - 0.25) ** 2) / 0.002);
    this.beat.value = b;
    this.overrides.bloom = 1.3 + b * 0.4;
    if (Math.floor(this.time * 1.1) !== Math.floor((this.time - 1 / 60) * 1.1)) this.hooks?.sfx('heartbeat', this.spawn.pos, this.key, 0.5);
  }
}
