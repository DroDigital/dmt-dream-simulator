import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import type { Realm, Entity, Linkable } from '../realms/realm';
import type { GameHooks } from '../core/types';
import { G, makeLoFi, type LoFiMaterial } from '../render/materials';
import { Shape } from '../realms/kit';
import { PCG32 } from '../core/rng';
import { DREAMER_COLOURS } from '../render/palettes';

const T: any = TSL;
const { Fn, vec3, vec4, float, sin, cos, fract, hash, mix, screenCoordinate, uniform, smoothstep, abs, dot, normalView, positionViewDirection, oneMinus, pow, instanceIndex, positionLocal, floor } = T;

const tmpV = new THREE.Vector3();

function nearestDreamer(realm: Realm, p: THREE.Vector3) {
  let best: ReturnType<Realm['dreamers']>[number] | null = null, bd = Infinity;
  for (const d of realm.dreamers()) {
    const dd = d.position.distanceTo(p);
    if (dd < bd) { bd = dd; best = d; }
  }
  return { d: best, dist: bd };
}

// ── Lanternfolk ─────────────────────────────────────────────────────────
export class Lanternfolk implements Entity {
  kind = 'lanternfolk';
  object = new THREE.Group();
  body: THREE.Object3D;
  head: THREE.Object3D;
  home: THREE.Vector3;
  target = new THREE.Vector3();
  vel = new THREE.Vector3();
  state: 'wander' | 'sort' | 'follow' | 'sit' = 'wander';
  stateT = 0;
  followSlot = -1;
  touches = new Map<number, number>();
  kin: ReturnType<Realm['physics']['kinematicBall']>;
  link: Linkable;
  rng: PCG32;
  carrying: THREE.Mesh;
  trail: THREE.InstancedMesh;
  trailIdx = 0;
  trailClock = 0;
  facing = true;
  radius: number;
  y0: number;

  constructor(realm: Realm, pos: THREE.Vector3, radius = 12) {
    this.rng = realm.rng.fork('lf' + pos.x.toFixed(1));
    this.home = pos.clone();
    this.radius = radius;
    this.y0 = pos.y;
    const paper = realm.mat('lf-paper', { map: realm.tex('paper'), color: '#fff8ee' });
    const glow = realm.mat('lf-glow', { map: realm.tex('lantern'), emissive: realm.c(4, 0.3), emissiveIntensity: 1.6, unlit: true });
    const face = realm.mat('lf-face', { color: '#201810', unlit: true });
    const s = new Shape();
    const kind = this.rng.int(0, 2);
    if (kind === 0) s.oct(paper, 0.42, 0, 0.5, 0, { sy: 1.25 });
    else if (kind === 1) s.dodeca(paper, 0.4, 0, 0.5, 0, { sy: 1.15 });
    else s.ico(paper, 0.42, 0, 0.5, 0, { sy: 1.2 });
    this.body = s.build();
    const h = new Shape();
    h.cyl(glow, 0.22, 0.25, 0.42, 0, 0, 0, { seg: 6 });
    h.box(face, 0.2, 0.025, 0.02, 0, 0.02, 0.24);
    this.head = h.build();
    this.head.position.y = 1.0;
    this.carrying = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), realm.mat('lf-orb', { emissive: realm.c(2, 0.5), emissiveIntensity: 2, unlit: true }));
    this.carrying.position.set(0, 0.75, 0.35);
    this.carrying.visible = false;
    this.object.add(this.body, this.head, this.carrying);
    this.object.position.copy(pos);
    this.object.scale.setScalar(this.rng.range(0.9, 1.25));
    this.kin = realm.physics.kinematicBall(0.45, pos.clone().add(new THREE.Vector3(0, 0.6, 0)));
    this.link = realm.link(this.object, ['light', 'paper'], { kind: 'lanternfolk', colliders: [this.kin.collider], lantern: true, mutable: false });
    realm.dyn(this.object);
    const trailMat = realm.mat('lf-trail', { emissive: realm.c(4, 0.2), emissiveIntensity: 1.5, unlit: true, additive: true, noFog: true });
    this.trail = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.06, 0), trailMat, 24);
    this.trail.frustumCulled = false;
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 24; i++) this.trail.setMatrixAt(i, hide);
    realm.dynamic.add(this.trail);
    this.pickTarget();
  }

  pickTarget() {
    const a = this.rng.next() * Math.PI * 2, r = this.rng.next() * this.radius;
    this.target.set(this.home.x + Math.cos(a) * r, this.y0, this.home.z + Math.sin(a) * r);
  }

  touched(slot: number) {
    this.touches.set(slot, (this.touches.get(slot) ?? 0) + 1);
    let best = -1, bc = 0;
    for (const [s, c] of this.touches) if (c > bc) { bc = c; best = s; }
    this.followSlot = best;
    this.state = 'follow';
    this.stateT = 20;
  }

  tick(dt: number, realm: Realm, hooks: GameHooks) {
    this.stateT -= dt;
    const p = this.object.position;
    const { d, dist } = nearestDreamer(realm, p);
    if (this.state === 'wander') {
      if (p.distanceTo(this.target) < 0.8) {
        if (this.rng.chance(0.4)) { this.state = 'sort'; this.stateT = this.rng.range(2, 5); }
        this.pickTarget();
      }
      if (d && dist < 5 && this.rng.chance(0.004)) { this.state = 'follow'; this.followSlot = d.slot; this.stateT = 6; }
    } else if (this.state === 'sort' && this.stateT <= 0) { this.state = 'wander'; }
    else if (this.state === 'follow') {
      const f = realm.dreamers().find((x) => x.slot === this.followSlot);
      if (f) this.target.set(f.position.x, this.y0, f.position.z).addScaledVector(tmpV.set(Math.sin(f.yaw), 0, Math.cos(f.yaw)), 2.2);
      if (this.stateT <= 0 || !f) { this.state = 'wander'; this.pickTarget(); }
    } else if (this.state === 'sit' && this.stateT <= 0) this.state = 'wander';

    const desired = tmpV.copy(this.target).sub(p).setY(0);
    const len = desired.length();
    const speed = this.state === 'follow' ? 2.2 : this.state === 'wander' ? 0.9 : 0;
    if (len > 0.5 && speed > 0) desired.multiplyScalar(speed / len); else desired.set(0, 0, 0);
    this.vel.lerp(desired, 1 - Math.exp(-3 * dt));
    p.addScaledVector(this.vel, dt);
    const sp = this.vel.length();
    // tumble rather than walk
    this.body.rotation.x += sp * dt * 2.2;
    this.body.rotation.y = Math.atan2(this.vel.x, this.vel.z);
    const sit = this.state === 'sit' ? -0.3 : 0;
    this.body.position.y = Math.abs(Math.sin(this.body.rotation.x * 2)) * 0.08 + sit;
    this.head.position.y = 1.0 + Math.sin(realm.time * 2 + p.x) * 0.05 + sit;
    if (realm.laws.watchersFace && d) this.object.rotation.y = Math.atan2(d.position.x - p.x, d.position.z - p.z) + (Math.sin(realm.time * 0.3) > 0.6 ? Math.PI : 0);
    else if (sp > 0.1) this.object.rotation.y = Math.atan2(this.vel.x, this.vel.z);
    if (this.state === 'sort') { this.head.rotation.y += dt * 3; this.carrying.visible = true; this.carrying.rotation.y += dt * 4; }
    else this.head.rotation.y *= 0.9;
    // glow intensity carries emotion
    const m = this.head.children[0] as THREE.Mesh;
    if (m) (m.material as LoFiMaterial).uEmissiveI.value = 1.4 + (this.state === 'follow' ? 0.6 : 0) + Math.sin(realm.time * 1.3) * 0.15;
    this.kin.body.setNextKinematicTranslation({ x: p.x, y: p.y + 0.6, z: p.z });
    // lantern trail for whoever they follow
    this.trailClock += dt;
    if (this.followSlot >= 0 && this.trailClock > 0.15 && sp > 0.3) {
      this.trailClock = 0;
      const mm = new THREE.Matrix4().makeTranslation(p.x, p.y + 1.0, p.z);
      this.trail.setMatrixAt(this.trailIdx++ % 24, mm);
      this.trail.instanceMatrix.needsUpdate = true;
    }
  }
}

// ── The Watcher ─────────────────────────────────────────────────────────
export class Watcher implements Entity {
  kind = 'watcher';
  object = new THREE.Group();
  dir = new THREE.Vector3();
  life = 0;
  waiting = false;
  done = false;
  private reported = new Set<number>();
  constructor(realm: Realm, start: THREE.Vector3, dir: THREE.Vector3, public speed = 0.9, waiting = false) {
    this.dir.copy(dir).setY(0).normalize();
    this.waiting = waiting;
    const mat = new THREE.MeshBasicNodeMaterial();
    mat.fog = false;
    const sc = screenCoordinate.xy;
    mat.colorNode = Fn(() => {
      const n = hash(floor(sc.div(2.0)).dot(T.vec2(1.0, 113.0)).add(floor(G.time.mul(24.0)).mul(17.0)));
      const inv = vec3(1.0).sub(G.fogColor);
      const rim = pow(oneMinus(abs(dot(normalView, positionViewDirection))), 3.0);
      return mix(inv.mul(0.8), vec3(n), 0.55).add(vec3(rim.mul(0.4)));
    })();
    const s = new Shape();
    s.cyl(mat as any, 0.22, 0.48, 1.7, 0, 0.85, 0, { seg: 7 }); // long coat
    s.cyl(mat as any, 0.2, 0.22, 0.5, 0, 1.85, 0, { seg: 6 }); // shoulders
    s.sphere(mat as any, 0.16, 0, 2.25, 0, { w: 6, h: 5 }); // head
    s.box(mat as any, 0.09, 0.9, 0.09, -0.3, 1.45, 0, { rz: 0.05 });
    s.box(mat as any, 0.09, 0.9, 0.09, 0.3, 1.45, 0, { rz: -0.05 });
    this.object.add(s.build());
    this.object.position.copy(start);
    this.object.rotation.y = Math.atan2(this.dir.x, this.dir.z);
    realm.dyn(this.object);
  }
  tick(dt: number, realm: Realm, hooks: GameHooks) {
    this.life += dt;
    if (!this.waiting) this.object.position.addScaledVector(this.dir, this.speed * dt);
    // he never turns. He walks past one dreamer.
    let nearest = Infinity;
    for (const d of realm.dreamers()) {
      if (!d.awake) continue;
      const dist = tmpV.copy(d.position).sub(this.object.position).setY(0).length();
      nearest = Math.min(nearest, dist);
      if (dist < 0.75 && !this.reported.has(d.slot)) {
        this.reported.add(d.slot);
        hooks.wake(d.slot, 'watcher');
      }
    }
    hooks.musicDuck(Math.max(0, 1 - (nearest - 1) / 22), realm.key);
    this.object.position.y = realm.heightAt(this.object.position.x, this.object.position.z, this.object.position.y + 3);
    if (this.life > 160) { this.done = true; hooks.musicDuck(0, realm.key); realm.removeEntity(this); }
  }
}

// ── Lantern Woman ───────────────────────────────────────────────────────
export class LanternWoman implements Entity {
  kind = 'lanternwoman';
  object = new THREE.Group();
  head: THREE.Object3D;
  baseYaw: number;
  facing = true;
  constructor(realm: Realm, pos: THREE.Vector3, yaw: number) {
    const dress = realm.mat('lw-dress', { map: realm.tex('fabric'), color: '#e8e0d8' });
    const skin = realm.mat('lw-skin', { color: '#d8c0a8' });
    const lamp = realm.mat('lw-lamp', { map: realm.tex('lantern'), emissive: '#ffd890', emissiveIntensity: 1.8, unlit: true });
    const s = new Shape();
    s.cone(dress, 0.42, 1.25, 0, 0.62, 0, { seg: 8 });
    s.cyl(dress, 0.14, 0.2, 0.3, 0, 1.35, 0, { seg: 6 });
    s.box(skin, 0.07, 0.55, 0.07, -0.2, 1.1, 0, { rz: 0.1 });
    s.box(skin, 0.07, 0.55, 0.07, 0.2, 1.1, 0, { rz: -0.1 });
    this.object.add(s.build());
    const h = new Shape();
    h.cyl(lamp, 0.17, 0.2, 0.38, 0, 0, 0, { seg: 8 });
    h.cyl(lamp, 0.06, 0.06, 0.06, 0, 0.22, 0, { seg: 6 });
    this.head = h.build();
    this.head.position.y = 1.72;
    this.object.add(this.head);
    this.object.position.copy(pos);
    this.baseYaw = yaw;
    this.object.rotation.y = yaw;
    realm.dyn(this.object);
    realm.link(this.object, ['light', 'paper'], { kind: 'lanternwoman', collide: 'cyl', mutable: false });
  }
  tick(dt: number, realm: Realm, hooks: GameHooks) {
    // Always facing away. Turns toward you only on the brightest nights.
    const d = nearestDreamer(realm, this.object.position).d;
    const bright = realm.ctx.resonance.y > 3.2 || realm.laws.watchersFace;
    let target = this.baseYaw;
    if (d && bright) target = Math.atan2(d.position.x - this.object.position.x, d.position.z - this.object.position.z);
    let diff = target - this.object.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.object.rotation.y += diff * (1 - Math.exp(-0.5 * dt));
    this.head.rotation.z = Math.sin(realm.time * 0.4) * 0.03;
    if (d && d.position.distanceTo(this.object.position) < 8) hooks.atlas('entity:lanternwoman');
  }
}

// ── Drifters: jellyfish of soft light ───────────────────────────────────
export class Drifters implements Entity {
  kind = 'drifters';
  object: THREE.InstancedMesh;
  pos: THREE.Vector3[] = [];
  vel: THREE.Vector3[] = [];
  scale: number[] = [];
  centre: THREE.Vector3;
  m = new THREE.Matrix4();
  q = new THREE.Quaternion();
  constructor(realm: Realm, centre: THREE.Vector3, count: number, spread = 40, height = 12) {
    this.centre = centre.clone();
    const geo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const tent = new THREE.CylinderGeometry(0.05, 0.01, 1.6, 4, 4, true).translate(0, -0.8, 0);
    const s = new Shape();
    const mat = realm.mat('drifter', { emissive: realm.c(2, 0.4), emissiveIntensity: 1.2, unlit: true, additive: true, film: 0.6, bob: 0.6, side: THREE.DoubleSide, noFog: false });
    s.add(mat, geo).add(mat, tent, 0.4, 0, 0).add(mat, tent.clone(), -0.4, 0, 0).add(mat, tent.clone(), 0, 0, 0.4).add(mat, tent.clone(), 0, 0, -0.4);
    const merged = (s.build().children[0] as THREE.Mesh).geometry;
    this.object = new THREE.InstancedMesh(merged, mat, count);
    this.object.frustumCulled = false;
    const rng = realm.rng.fork('drift');
    for (let i = 0; i < count; i++) {
      this.pos.push(new THREE.Vector3(centre.x + rng.range(-spread, spread), centre.y + rng.range(2, height), centre.z + rng.range(-spread, spread)));
      this.vel.push(new THREE.Vector3(rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3)));
      this.scale.push(rng.range(0.25, 2));
    }
    realm.dyn(this.object);
  }
  tick(dt: number, realm: Realm) {
    const ds = realm.dreamers();
    for (let i = 0; i < this.pos.length; i++) {
      const p = this.pos[i], v = this.vel[i];
      v.y = Math.sin(realm.time * 0.6 + i) * 0.25;
      // part around you
      for (const d of ds) {
        tmpV.copy(p).sub(d.eye);
        const l = tmpV.length();
        if (l < 4 + this.scale[i]) v.addScaledVector(tmpV.normalize(), dt * 2.5);
      }
      tmpV.copy(this.centre).sub(p).setY(0);
      if (tmpV.length() > 45) v.addScaledVector(tmpV.normalize(), dt * 0.3);
      v.multiplyScalar(0.995);
      p.addScaledVector(v, dt);
      const s = this.scale[i] * (1 + Math.sin(realm.time * 1.5 + i) * 0.12);
      this.m.compose(p, this.q, tmpV.set(s, s * 0.8, s));
      this.object.setMatrixAt(i, this.m);
    }
    this.object.instanceMatrix.needsUpdate = true;
  }
}

// ── Moth Choir ──────────────────────────────────────────────────────────
export class MothChoir implements Entity {
  kind = 'moths';
  object: THREE.InstancedMesh;
  base: THREE.Vector3[] = [];
  off: THREE.Vector3[] = [];
  burstT = 0;
  m = new THREE.Matrix4();
  q = new THREE.Quaternion();
  constructor(realm: Realm, lamps: THREE.Vector3[], perLamp = 30) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.06, 0, 0, 0.06, 0, 0, 0, 0.03, 0.05, -0.06, 0, 0, 0, 0.03, 0.05, 0.06, 0, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(12), 2));
    geo.computeVertexNormals();
    const mat = realm.mat('moth', { color: '#f4ecd8', emissive: '#fff4d0', emissiveIntensity: 0.6, bob: 0.25, side: THREE.DoubleSide });
    const n = Math.min(900, lamps.length * perLamp);
    this.object = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    this.object.frustumCulled = false;
    const rng = realm.rng.fork('moth');
    for (let i = 0; i < n; i++) {
      const l = lamps[i % lamps.length];
      this.base.push(l.clone().add(new THREE.Vector3(rng.range(-0.6, 0.6), rng.range(-0.4, 0.6), rng.range(-0.6, 0.6))));
      this.off.push(new THREE.Vector3(rng.range(-1, 1), rng.range(0.2, 1.5), rng.range(-1, 1)).normalize().multiplyScalar(rng.range(3, 9)));
    }
    this.update(0);
    realm.dyn(this.object);
  }
  burst() { this.burstT = 3; }
  update(t: number) {
    const k = Math.sin(Math.min(1, t / 3) * Math.PI);
    for (let i = 0; i < this.base.length; i++) {
      tmpV.copy(this.base[i]).addScaledVector(this.off[i], k);
      this.q.setFromEuler(new THREE.Euler(0, i * 2.3 + t * 3, 0));
      this.m.compose(tmpV, this.q, new THREE.Vector3(1, 1, 1));
      this.object.setMatrixAt(i, this.m);
    }
    this.object.instanceMatrix.needsUpdate = true;
  }
  tick(dt: number, realm: Realm, hooks: GameHooks) {
    if (this.burstT > 0) { this.burstT -= dt; this.update(3 - Math.max(0, this.burstT)); }
    const d = this.base.length ? nearestDreamer(realm, this.base[0]) : null;
    if (d && d.dist < 6 && Math.floor(realm.time * 0.25) !== Math.floor((realm.time - dt) * 0.25)) hooks.sfx('mothchord', this.base[0], realm.key, 0.5);
  }
}

// ── Book-fish: boids in the Drowned Library ─────────────────────────────
export class BookFish implements Entity {
  kind = 'bookfish';
  object: THREE.InstancedMesh;
  p: THREE.Vector3[] = [];
  v: THREE.Vector3[] = [];
  m = new THREE.Matrix4();
  q = new THREE.Quaternion();
  centre: THREE.Vector3;
  constructor(realm: Realm, centre: THREE.Vector3, count = 60, public bounds = 22) {
    this.centre = centre.clone();
    const s = new Shape();
    const cover = realm.mat('book-cover', { map: realm.tex('books'), color: realm.c(1) });
    const page = realm.mat('book-page', { map: realm.tex('paper'), emissive: '#e8f0d8', emissiveIntensity: 0.25 });
    s.box(cover, 0.32, 0.02, 0.42, -0.15, 0, 0, { rz: 0.5 });
    s.box(cover, 0.32, 0.02, 0.42, 0.15, 0, 0, { rz: -0.5 });
    s.box(page, 0.28, 0.06, 0.38, 0, 0.02, 0);
    const geo = new THREE.BufferGeometry();
    const built = s.build();
    const geos = built.children.map((c) => (c as THREE.Mesh).geometry);
    // two materials → keep cover only for instancing simplicity, pages via emissive tint
    this.object = new THREE.InstancedMesh(geos[0], cover, count);
    this.object.add(new THREE.InstancedMesh(geos[1] ?? geo, page, count));
    this.object.frustumCulled = false;
    (this.object.children[0] as THREE.InstancedMesh).frustumCulled = false;
    const rng = realm.rng.fork('fish');
    for (let i = 0; i < count; i++) {
      this.p.push(centre.clone().add(new THREE.Vector3(rng.range(-8, 8), rng.range(1, 6), rng.range(-8, 8))));
      this.v.push(new THREE.Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize());
    }
    realm.dyn(this.object);
  }
  tick(dt: number, realm: Realm) {
    const n = this.p.length;
    const ds = realm.dreamers();
    const sep = new THREE.Vector3(), ali = new THREE.Vector3(), coh = new THREE.Vector3();
    const inner = this.object.children[0] as THREE.InstancedMesh;
    for (let i = 0; i < n; i++) {
      sep.set(0, 0, 0); ali.set(0, 0, 0); coh.set(0, 0, 0);
      let cnt = 0;
      for (let j = 0; j < n; j += 2) {
        if (j === i) continue;
        tmpV.copy(this.p[i]).sub(this.p[j]);
        const d2 = tmpV.lengthSq();
        if (d2 < 9) { cnt++; ali.add(this.v[j]); coh.add(this.p[j]); if (d2 < 0.8) sep.addScaledVector(tmpV, 1 / Math.max(0.05, d2)); }
      }
      const v = this.v[i];
      if (cnt) { ali.divideScalar(cnt).sub(v).multiplyScalar(0.6); coh.divideScalar(cnt).sub(this.p[i]).multiplyScalar(0.3); v.addScaledVector(ali, dt).addScaledVector(coh, dt); }
      v.addScaledVector(sep, dt * 0.8);
      // scatter when a dreamer runs close
      for (const d of ds) {
        tmpV.copy(this.p[i]).sub(d.eye);
        const l = tmpV.length();
        const fast = d.velocity.length() > 4;
        if (l < (fast ? 7 : 2.5)) v.addScaledVector(tmpV.normalize(), dt * (fast ? 8 : 3));
      }
      tmpV.copy(this.centre).sub(this.p[i]);
      if (tmpV.length() > this.bounds) v.addScaledVector(tmpV.normalize(), dt * 2);
      if (this.p[i].y < this.centre.y + 0.6) v.y += dt * 2;
      if (this.p[i].y > this.centre.y + 9) v.y -= dt * 2;
      const sp = v.length();
      if (sp > 3.5) v.multiplyScalar(3.5 / sp); else if (sp < 0.8) v.multiplyScalar(0.8 / Math.max(0.01, sp));
      this.p[i].addScaledVector(v, dt);
      const flap = 1 + Math.sin(realm.time * 8 + i) * 0.35;
      this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tmpV.copy(v).normalize());
      this.m.compose(this.p[i], this.q, new THREE.Vector3(flap, 1, 1));
      this.object.setMatrixAt(i, this.m);
      inner.setMatrixAt(i, this.m);
    }
    this.object.instanceMatrix.needsUpdate = true;
    inner.instanceMatrix.needsUpdate = true;
  }
}

// ── Night train with the Paper Conductor ────────────────────────────────
export class NightTrain implements Entity {
  kind = 'train';
  object = new THREE.Group();
  cars: { obj: THREE.Object3D; kin: ReturnType<Realm['physics']['kinematicBox']> }[] = [];
  arm!: THREE.Object3D;
  t = 0;
  constructor(realm: Realm, public path: THREE.Curve<THREE.Vector3>, public speed = 9, cars = 4, chorus = 0, linkToMetro = true) {
    const body = realm.mat('train-body', { map: realm.tex('metal'), color: realm.c(1) });
    const win = realm.mat('train-win', { map: realm.tex('window'), emissive: '#ffe8b0', emissiveIntensity: 1.3 });
    const paper = realm.mat('conductor', { map: realm.tex('paper'), color: '#fffaf0' });
    const cap = realm.mat('cap', { color: '#2d3e5e' });
    for (let i = 0; i < cars; i++) {
      const s = new Shape();
      s.box(body, 2.6, 2.6, 8, 0, 1.6, 0, { uv: 2 });
      for (let k = -3; k <= 3; k += 1.5) { s.box(win, 0.05, 1, 1.1, 1.31, 2, k); s.box(win, 0.05, 1, 1.1, -1.31, 2, k); }
      s.box(body, 2.2, 0.3, 7.6, 0, 3.0, 0);
      const obj = s.build();
      if (i === 0) {
        const c = new Shape();
        c.cone(paper, 0.3, 0.8, 0, 0, 0, { seg: 4 });
        c.oct(paper, 0.18, 0, 0.55, 0);
        c.cyl(cap, 0.16, 0.18, 0.12, 0, 0.72, 0, { seg: 6 });
        const cond = c.build();
        cond.position.set(0.9, 3.55, 3);
        obj.add(cond);
        const a = new Shape(); a.box(paper, 0.08, 0.45, 0.08, 0, 0.22, 0);
        this.arm = a.build(); this.arm.position.set(1.2, 3.75, 3); obj.add(this.arm);
      }
      this.object.add(obj);
      const kin = realm.physics.kinematicBox(1.3, 1.6, 4, new THREE.Vector3(0, -100, 0));
      this.cars.push({ obj, kin });
      realm.link(obj, ['paper', 'machine'], { kind: 'train', colliders: [kin.collider], chorus: chorus || undefined, special: linkToMetro && realm.id !== 'metro' ? { type: 'realm', realm: 'metro' } : undefined, mutable: false });
    }
    if (!this.arm) this.arm = new THREE.Object3D();
    realm.dyn(this.object);
  }
  tick(dt: number, realm: Realm) {
    this.t += dt * this.speed * (realm.laws.backwards ? -1 : 1);
    const L = this.path.getLength();
    this.cars.forEach((c, i) => {
      let u = ((this.t - i * 8.6) / L) % 1;
      if (u < 0) u += 1;
      const p = this.path.getPointAt(u);
      const tan = this.path.getTangentAt(u);
      c.obj.position.copy(p);
      c.obj.rotation.y = Math.atan2(tan.x, tan.z);
      c.kin.body.setNextKinematicTranslation({ x: p.x, y: p.y + 1.6, z: p.z });
      const q = new THREE.Quaternion().setFromEuler(c.obj.rotation);
      c.kin.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    });
    // the conductor waves when it passes
    const d = nearestDreamer(realm, this.cars[0].obj.position);
    this.arm.rotation.z = d.dist < 25 ? Math.sin(realm.time * 8) * 0.6 + 2.4 : 0.2;
  }
}

// ── Dreamer figures (how others see you) ────────────────────────────────
export function makeDreamerFigure(realm: Realm, slot: number, dreamer: number): THREE.Group {
  const colour = DREAMER_COLOURS[slot];
  const glow = realm.mat(`dreamer-${slot}`, { color: '#ffffff', emissive: colour, emissiveIntensity: 1.1, film: 0.3 });
  const soft = realm.mat(`dreamer-soft-${slot}`, { emissive: colour, emissiveIntensity: 0.6, unlit: true, additive: true, side: THREE.BackSide, noFog: true });
  const s = new Shape();
  if (dreamer === 0) { // Moth: pale coat that opens into wings
    s.cone(glow, 0.35, 1.3, 0, 0.75, 0, { seg: 6 }); s.sphere(glow, 0.17, 0, 1.55, 0);
    s.box(glow, 0.9, 0.6, 0.03, -0.45, 1.15, -0.1, { rz: 0.4 }); s.box(glow, 0.9, 0.6, 0.03, 0.45, 1.15, -0.1, { rz: -0.4 });
  } else if (dreamer === 1) { // Kite: diamond head, ribbon tail
    s.cyl(glow, 0.18, 0.28, 1.1, 0, 0.6, 0, { seg: 6 }); s.oct(glow, 0.3, 0, 1.5, 0, { sy: 1.3 });
    for (let i = 0; i < 5; i++) s.box(glow, 0.12, 0.02, 0.35, 0, 1.3 - i * 0.18, -0.25 - i * 0.3, { rx: 0.3 });
  } else if (dreamer === 2) { // Bell: bell-shaped cloak
    s.add(glow, new THREE.LatheGeometry([new THREE.Vector2(0.55, 0), new THREE.Vector2(0.5, 0.2), new THREE.Vector2(0.3, 0.8), new THREE.Vector2(0.2, 1.3), new THREE.Vector2(0.0, 1.4)], 10));
    s.sphere(glow, 0.15, 0, 1.55, 0);
  } else { // Crane: paper crane mask, folded cape
    s.cone(glow, 0.38, 1.3, 0, 0.7, -0.05, { seg: 4 }); s.oct(glow, 0.18, 0, 1.5, 0);
    s.cone(glow, 0.06, 0.45, 0, 1.52, 0.3, { rx: Math.PI / 2, seg: 4 });
  }
  s.sphere(soft, 0.75, 0, 0.9, 0, { sy: 1.4 });
  const g = s.build();
  g.traverse((o) => o.layers.set(1 + slot));
  realm.dyn(g);
  return g;
}

// ── Telephone: rings in every realm, same tone ──────────────────────────
export class Telephone implements Entity {
  kind = 'telephone';
  object: THREE.Group;
  ringing = false;
  ringT = 0;
  link: Linkable;
  handset: THREE.Object3D;
  constructor(realm: Realm, pos: THREE.Vector3, yaw = 0, stand = true) {
    const body = realm.mat('phone', { color: '#b0242a' });
    const metal = realm.mat('phone-metal', { map: realm.tex('metal') });
    const s = new Shape();
    if (stand) s.cyl(metal, 0.04, 0.06, 0.95, 0, 0.47, 0, { seg: 6 }).box(metal, 0.4, 0.04, 0.3, 0, 0.95, 0);
    s.box(body, 0.26, 0.14, 0.22, 0, 1.05, 0);
    s.cyl(body, 0.06, 0.06, 0.02, 0, 1.13, 0.04, { rx: 0.3, seg: 10 });
    this.object = s.build();
    const h = new Shape(); h.box(body, 0.32, 0.06, 0.07, 0, 0, 0); h.box(body, 0.08, 0.08, 0.1, -0.13, -0.03, 0); h.box(body, 0.08, 0.08, 0.1, 0.13, -0.03, 0);
    this.handset = h.build(); this.handset.position.set(0, 1.16, -0.04);
    this.object.add(this.handset);
    this.object.position.copy(pos); this.object.rotation.y = yaw;
    realm.root.add(this.object);
    realm.dyn(this.object);
    this.link = realm.link(this.object, ['machine'], { kind: 'telephone', special: { type: 'phone' }, noLink: true, mutable: false });
    realm.phones.push(this.object);
  }
  tick(dt: number, realm: Realm, hooks: GameHooks) {
    const want = realm.laws.phones ? Math.sin(realm.time * 0.2) > -0.3 : this.ringing;
    if (want) {
      this.ringT += dt;
      // the game's one fixed sound: two notes, 2 s on, 4 s off
      const ph = this.ringT % 6;
      this.handset.position.y = 1.16 + (ph < 2 ? Math.abs(Math.sin(this.ringT * 40)) * 0.015 : 0);
      if (ph < dt) hooks.sfx('phone', this.object.position, realm.key, 1);
    }
  }
}

// ── The red kite, always just out of reach ──────────────────────────────
export class Kite implements Entity {
  kind = 'kite';
  object = new THREE.Group();
  pos = new THREE.Vector3();
  constructor(realm: Realm, pos: THREE.Vector3) {
    const red = realm.mat('kite', { color: '#d8202a', emissive: '#801010', emissiveIntensity: 0.5, side: THREE.DoubleSide });
    const s = new Shape();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.7, 0, -0.45, 0, 0, 0, -0.9, 0, 0, 0.7, 0, 0, -0.9, 0, 0.45, 0, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(12), 2));
    g.computeVertexNormals();
    s.add(red, g);
    for (let i = 0; i < 6; i++) s.box(red, 0.16, 0.05, 0.02, 0, -1.1 - i * 0.35, 0, { rz: (i % 2 ? 1 : -1) * 0.5 });
    this.object.add(s.build());
    this.pos.copy(pos);
    this.object.position.copy(pos);
    realm.dyn(this.object);
  }
  tick(dt: number, realm: Realm, hooks: GameHooks) {
    const { d, dist } = nearestDreamer(realm, this.pos);
    if (d) {
      const reach = 6.5;
      tmpV.copy(this.pos).sub(d.eye);
      const l = tmpV.length();
      if (l < reach) this.pos.addScaledVector(tmpV.normalize(), (reach - l) * dt * 2);
      if (dist < 9) hooks.atlas('entity:kite');
    }
    this.object.position.set(this.pos.x + Math.sin(realm.time * 0.7) * 0.6, this.pos.y + Math.sin(realm.time * 1.1) * 0.4, this.pos.z);
    this.object.rotation.z = Math.sin(realm.time * 0.9) * 0.3;
  }
}

// ── Precipitation and falling things (rain, snow, umbrellas…) ───────────
export class Precip implements Entity {
  kind = 'precip';
  object: THREE.InstancedMesh;
  constructor(realm: Realm, centre: THREE.Vector3, item: string, colour: string, count = 600, area = 60, height = 30, speed = 6, life = Infinity) {
    let geo: THREE.BufferGeometry;
    if (item === 'rain') geo = new THREE.BoxGeometry(0.02, 0.6, 0.02);
    else if (item === 'snow' || item === 'petal' || item === 'feather' || item === 'star') geo = new THREE.OctahedronGeometry(item === 'snow' ? 0.06 : 0.1, 0);
    else if (item === 'umbrella') geo = new THREE.ConeGeometry(0.5, 0.3, 8, 1, true);
    else if (item === 'glyph' || item === 'letter' || item === 'ticket' || item === 'photo') geo = new THREE.PlaneGeometry(0.3, 0.2);
    else if (item === 'moon' || item === 'marble' || item === 'coin' || item === 'button') geo = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 10);
    else if (item === 'leaf' || item === 'crane' || item === 'fish') geo = new THREE.TetrahedronGeometry(0.18, 0);
    else geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const mat = makeLoFi({ color: colour, emissive: colour, emissiveIntensity: item === 'rain' ? 0.6 : 0.35, side: THREE.DoubleSide, transparent: item === 'rain', opacity: 0.6 });
    // GPU-driven fall: base position from the instance matrix, wrapped by time
    const spd = float(speed);
    const H = float(height);
    const ph = hash(instanceIndex.toFloat()).mul(H);
    const fall = fract(G.time.mul(spd).add(ph).div(H)).mul(H);
    const sway = item === 'rain' ? vec3(0) : vec3(sin(G.time.mul(1.3).add(ph)).mul(0.6), 0, cos(G.time.add(ph)).mul(0.6));
    mat.positionNode = positionLocal.add(vec3(0, fall.negate(), 0)).add(sway);
    this.object = new THREE.InstancedMesh(geo, mat, count);
    this.object.frustumCulled = false;
    const rng = realm.rng.fork('precip' + item);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      m.makeRotationFromEuler(new THREE.Euler(rng.range(0, 6), rng.range(0, 6), item === 'rain' ? 0 : rng.range(0, 6)));
      m.setPosition(centre.x + rng.range(-area, area), centre.y + height, centre.z + rng.range(-area, area));
      this.object.setMatrixAt(i, m);
    }
    this.life = life;
    realm.dyn(this.object);
  }
  life: number;
  tick(dt: number, realm: Realm) {
    this.life -= dt;
    if (this.life < 0) { realm.removeEntity(this); this.object.geometry.dispose(); }
  }
}

/** Simple animated prop driven by a function (vehicles, giants, suns…). */
export class Mover implements Entity {
  object: THREE.Object3D;
  t = 0;
  constructor(public kind: string, obj: THREE.Object3D, public fn: (t: number, o: THREE.Object3D, realm: Realm, hooks: GameHooks) => boolean | void, public duration = 30) {
    this.object = obj;
    obj.userData.dynamic = true;
  }
  tick(dt: number, realm: Realm, hooks: GameHooks) {
    this.t += dt;
    const stop = this.fn(this.t, this.object, realm, hooks);
    if (stop === true || this.t > this.duration) realm.removeEntity(this);
  }
}
