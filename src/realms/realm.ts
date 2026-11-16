import * as THREE from 'three/webgpu';
import type RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from '../core/physics';
import type { Tag, RealmId } from '../data/types';
import type { GameHooks, RealmContext, LinkSpecial, DreamerView } from '../core/types';
import { TextureBank, type TexKind } from '../render/textures';
import { G, lofi, makeSky, uniqueClone, clearMaterialCache, type LoFiOptions, type LoFiMaterial, type SkyUniforms } from '../render/materials';
import { Shape, batchStatic, poisson } from './kit';
import { PCG32 } from '../core/rng';
import { mixHex } from '../render/palettes';
import { REALMS } from '../data/realms';

export interface Linkable {
  id: string;
  kind: string;
  tags: Tag[];
  object: THREE.Object3D;
  colliders: RAPIER.Collider[];
  meshes: THREE.Mesh[];
  chorus?: number;
  special?: LinkSpecial;
  noLink?: boolean;
  lantern?: boolean; // touching a Lanternfolk pushes Bright
  lastDest?: { key: string; realm: RealmId; time: number; linkIndex: number };
  origMats?: THREE.Material[];
  thin?: boolean; // echo spot
}

export interface Env {
  skyTop: string; skyHorizon: string; skyBottom: string;
  fog: string; fogNear: number; fogFar: number; fogHeight: number; fogBase: number;
  sunDir: [number, number, number]; sunColor: string; skyAmb: string; groundAmb: string;
  bloom: number; bloomThreshold: number; godrays: number; glyph: number; glyphCell: number; glyphRow: number;
  trail: number; kaleido: number; tape: number; wobble: number; stars: number; mandala: number;
  fringe: number; vignette: number; grade: number; affine: number; levels: number; wind: number;
}

export const DEFAULT_ENV: Env = {
  skyTop: '#2a3a7a', skyHorizon: '#ffc8a8', skyBottom: '#1a1428',
  fog: '#c8c0d8', fogNear: 25, fogFar: 160, fogHeight: 0, fogBase: 0,
  sunDir: [0.3, 0.5, -0.8], sunColor: '#fff0d8', skyAmb: '#8a90b8', groundAmb: '#4a4050',
  bloom: 0.9, bloomThreshold: 0.72, godrays: 0, glyph: 0, glyphCell: 8, glyphRow: 0,
  trail: 0.55, kaleido: 0.22, tape: 0, wobble: 0, stars: 0.5, mandala: 0.6,
  fringe: 1, vignette: 0.45, grade: 0.5, affine: 0.7, levels: 6, wind: 1,
};

export interface Entity {
  kind: string;
  object: THREE.Object3D;
  tick(dt: number, realm: Realm, hooks: GameHooks): void;
  dispose?(): void;
  /** Watcher etc. can be faced by Dream Law */
  facing?: boolean;
}

export interface QuietPlace { pos: THREE.Vector3; radius: number }

export abstract class Realm {
  readonly id: RealmId;
  readonly scene = new THREE.Scene();
  readonly physics = new Physics();
  readonly bank: TextureBank;
  readonly rng: PCG32;
  linkables = new Map<number, Linkable>();
  linkList: Linkable[] = [];
  linkMeshes: THREE.Object3D[] = [];
  entities: Entity[] = [];
  spawn = { pos: new THREE.Vector3(0, 1, 0), yaw: 0 };
  killY = -40;
  quiet: QuietPlace | null = null;
  landmark: THREE.Object3D | null = null;
  thinSpots: THREE.Vector3[] = [];
  phones: THREE.Object3D[] = [];
  mutables: THREE.Object3D[] = [];
  env: Env = { ...DEFAULT_ENV };
  sky: { mesh: THREE.Mesh; u: SkyUniforms };
  root = new THREE.Group();
  dynamic = new THREE.Group();
  time = 0;
  /** extra per-frame post overrides from events/visions */
  overrides: Partial<Env> & { hueShift?: number; mono?: number; invert?: number } = {};
  flatSunscreen = new THREE.Vector2(0.5, 0.3);
  private keep = new Set<THREE.Object3D>();
  private matCount = 0;
  private remembered = new Map<THREE.Material, THREE.Material>();
  hooks!: GameHooks;
  private nextId = 0;
  outOfView = new Map<THREE.Object3D, number>();
  mutationsThisMinute = 0;
  mutationClock = 0;
  built = false;

  constructor(public ctx: RealmContext) {
    this.id = ctx.id;
    this.rng = ctx.rng;
    this.bank = new TextureBank({ palette: ctx.palette, mood: ctx.textureMood, era: ctx.era, seed: ctx.seed });
    this.sky = makeSky();
    this.scene.add(this.sky.mesh, this.root, this.dynamic);
  }

  get meta() { return REALMS[this.id]; }
  get key() { return this.ctx.key; }
  get pal() { return this.ctx.palette; }
  get laws() { return this.ctx.laws; }
  /** density multiplier from Dream Laws */
  get density() { return this.laws.crowded ? 1.6 : this.laws.empty ? 0.25 : 1; }

  abstract build(): void;

  init(hooks: GameHooks) {
    this.hooks = hooks;
    this.build();
    batchStatic(this.root, this.keep);
    this.scene.updateMatrixWorld(true);
    this.physics.step();
    this.built = true;
  }

  // ── materials and textures ────────────────────────────────────────────
  tex(kind: TexKind, variant = 0) { return this.bank.get(kind, variant); }
  mat(name: string, o: LoFiOptions): LoFiMaterial {
    return lofi(`${this.key}|${name}`, o);
  }
  /** colour from the realm palette, i = 0..4, optionally mixed with accent */
  c(i: number, accent = 0): string {
    const base = this.pal[((i % 5) + 5) % 5];
    return accent ? mixHex(base, this.ctx.accent, accent) : base;
  }

  // ── geometry helpers ───────────────────────────────────────────────────
  shape() { return new Shape(); }

  place(obj: THREE.Object3D, x: number, y: number, z: number, ry = 0, s = 1): THREE.Object3D {
    obj.position.set(x, y, z);
    obj.rotation.y = ry;
    obj.scale.setScalar(s);
    this.root.add(obj);
    obj.updateMatrixWorld(true);
    return obj;
  }

  /** Static collider from an object's local bounding box (yaw-only OBB). */
  solid(obj: THREE.Object3D, kind: 'box' | 'cyl' | 'ball' | 'mesh' = 'box'): RAPIER.Collider[] {
    obj.updateMatrixWorld(true);
    if (kind === 'mesh') {
      const out: RAPIER.Collider[] = [];
      obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(this.physics.fixedMesh(o as THREE.Mesh)); });
      return out;
    }
    const box = new THREE.Box3();
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      box.union(b);
    });
    if (box.isEmpty()) return [];
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const ws = new THREE.Vector3(); const wq = new THREE.Quaternion(); const wp = new THREE.Vector3();
    obj.matrixWorld.decompose(wp, wq, ws);
    size.multiply(ws);
    const c = centre.clone().applyMatrix4(obj.matrixWorld);
    if (kind === 'ball') return [this.physics.fixedBall(Math.max(size.x, size.y, size.z) / 2, c)];
    if (kind === 'cyl') return [this.physics.fixedCylinder(size.y / 2, Math.max(size.x, size.z) / 2, c, wq)];
    return [this.physics.fixedBox(size.x / 2, size.y / 2, size.z / 2, c, wq)];
  }

  /** Register an object as linkable: touching it carries you on. */
  link(obj: THREE.Object3D, tags: Tag[], o: { kind: string; collide?: 'box' | 'cyl' | 'ball' | 'mesh' | 'none'; colliders?: RAPIER.Collider[]; chorus?: number; special?: LinkSpecial; noLink?: boolean; lantern?: boolean; thin?: boolean; mutable?: boolean } ): Linkable {
    const colliders = o.colliders ?? (o.collide === 'none' ? [] : this.solid(obj, o.collide ?? 'box'));
    const meshes: THREE.Mesh[] = [];
    obj.traverse((m) => { if ((m as THREE.Mesh).isMesh) meshes.push(m as THREE.Mesh); });
    const l: Linkable = { id: `${o.kind}-${this.nextId++}`, kind: o.kind, tags, object: obj, colliders, meshes, chorus: o.chorus, special: o.special, noLink: o.noLink, lantern: o.lantern, thin: o.thin };
    for (const c of colliders) this.linkables.set(c.handle, l);
    this.linkList.push(l);
    obj.userData.linkable = l;
    this.keep.add(obj);
    if (!o.noLink || o.special) this.linkMeshes.push(obj);
    if (o.mutable !== false && !o.special && obj.parent === this.root) this.mutables.push(obj);
    if (this.ctx.memory.has(o.kind) && !o.noLink) this.remember(l);
    if (o.thin) this.thinSpots.push(obj.getWorldPosition(new THREE.Vector3()));
    return l;
  }

  /** Things remember: a kind you touched before glows faintly. */
  remember(l: Linkable) {
    for (const m of l.meshes) {
      const src = m.material as LoFiMaterial;
      if (!src.userData?.opts) continue;
      let r = this.remembered.get(src);
      if (!r) {
        const c = uniqueClone(src, src.userData.opts);
        c.uRemember.value = 1;
        this.remembered.set(src, c);
        r = c;
      }
      m.material = r;
    }
  }

  /** Mark something as moving so static batching leaves it alone. */
  dyn<T extends THREE.Object3D>(o: T): T { o.userData.dynamic = true; this.keep.add(o); return o; }

  addEntity(e: Entity) {
    this.entities.push(e);
    if (!e.object.parent) this.dynamic.add(e.object);
    this.keep.add(e.object);
  }

  removeEntity(e: Entity) {
    this.entities = this.entities.filter((x) => x !== e);
    e.object.parent?.remove(e.object);
    e.dispose?.();
  }

  removeLinkable(l: Linkable) {
    for (const c of l.colliders) { this.linkables.delete(c.handle); this.physics.world.removeCollider(c, false); }
    l.colliders = [];
    this.linkList = this.linkList.filter((x) => x !== l);
    this.linkMeshes = this.linkMeshes.filter((x) => x !== l.object);
    this.mutables = this.mutables.filter((x) => x !== l.object);
  }

  /** Flat ground with a trimesh collider; returns mesh. */
  ground(geo: THREE.BufferGeometry, m: THREE.Material, collide = true): THREE.Mesh {
    const s = new Shape().add(m, geo).build();
    const mesh = s.children[0] as THREE.Mesh;
    this.root.add(mesh);
    mesh.updateMatrixWorld(true);
    if (collide) this.physics.fixedMesh(mesh);
    return mesh;
  }

  scatter(w: number, h: number, r: number, cx = 0, cz = 0, max = 400): [number, number][] {
    return poisson(w, h, r, () => this.rng.next(), 20, max).map(([x, z]) => [x - w / 2 + cx, z - h / 2 + cz]);
  }

  heightAt(x: number, z: number, from = 200): number {
    return this.physics.castDown(x, from, z, 400) ?? 0;
  }

  // ── per-tick ───────────────────────────────────────────────────────────
  tick(dt: number) {
    this.time += dt * (this.laws.backwards ? -1 : 1);
    for (const e of [...this.entities]) e.tick(dt, this, this.hooks);
    this.update(dt);
  }

  /** realm-specific animation */
  update(_dt: number) {}

  /** Peripheral mutation: things out of view for 8 s may change, ≤ 3/min. */
  mutate(dt: number, cameras: THREE.Camera[]) {
    if (!this.mutables.length || !cameras.length) return;
    this.mutationClock += dt;
    if (this.mutationClock > 60) { this.mutationClock = 0; this.mutationsThisMinute = 0; }
    if (this.mutationsThisMinute >= 3) return;
    const frus = cameras.map((c) => new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse)));
    const sph = new THREE.Sphere();
    // check a handful each tick
    for (let k = 0; k < 4; k++) {
      const o = this.mutables[Math.floor(this.rng.next() * this.mutables.length)];
      if (!o || !o.visible) continue;
      sph.center.setFromMatrixPosition(o.matrixWorld);
      sph.radius = 3 * Math.max(o.scale.x, 1);
      const seen = frus.some((f) => f.intersectsSphere(sph));
      if (seen) { this.outOfView.delete(o); continue; }
      const t = (this.outOfView.get(o) ?? 0) + dt * 15; // sampled ~1/15 as often
      this.outOfView.set(o, t);
      if (t > 8 && this.rng.chance(0.08)) {
        this.applyMutation(o);
        this.outOfView.delete(o);
        this.mutationsThisMinute++;
        return;
      }
    }
  }

  applyMutation(o: THREE.Object3D) {
    const r = this.rng.next();
    if (r < 0.4) {
      // swap places with another mutable
      const other = this.mutables[Math.floor(this.rng.next() * this.mutables.length)];
      if (other && other !== o) {
        const p = o.position.clone(); o.position.copy(other.position); other.position.copy(p);
        o.updateMatrixWorld(true); other.updateMatrixWorld(true);
        this.syncColliders(o); this.syncColliders(other);
      }
    } else if (r < 0.75) {
      o.rotation.y += Math.PI * (this.rng.chance(0.5) ? 0.5 : 1);
      o.scale.multiplyScalar(this.rng.range(0.8, 1.25));
      o.updateMatrixWorld(true);
    } else {
      o.visible = false; // quietly disappear
      const l = o.userData.linkable as Linkable | undefined;
      if (l) for (const c of l.colliders) c.setEnabled(false);
    }
  }

  syncColliders(o: THREE.Object3D) {
    const l = o.userData.linkable as Linkable | undefined;
    if (!l || !l.colliders.length) return;
    for (const c of l.colliders) { this.linkables.delete(c.handle); this.physics.world.removeCollider(c, false); }
    l.colliders = this.solid(o);
    for (const c of l.colliders) this.linkables.set(c.handle, l);
  }

  dreamers(): DreamerView[] { return this.hooks.dreamersIn(this.key); }

  /** Push G uniforms + sky for this realm before drawing it. */
  applyEnv(nightProgress: number, nightOfYear: number) {
    const e = { ...this.env, ...this.overrides };
    const f = this.laws.fog ?? 1;
    G.fogColor.value.set(e.fog);
    G.fogNear.value = e.fogNear * f;
    G.fogFar.value = e.fogFar * f;
    G.fogHeight.value = e.fogHeight;
    G.fogBase.value = e.fogBase;
    G.sunDir.value.set(...e.sunDir).normalize();
    G.sunColor.value.set(e.sunColor);
    G.skyAmb.value.set(e.skyAmb);
    G.groundAmb.value.set(e.groundAmb);
    G.wind.value = e.wind;
    G.affine.value = e.affine;
    G.glass.value = this.laws.glass ? 0.85 : 0;
    G.paper.value = this.laws.paper ? 0.8 : 0;
    G.backwards.value = this.laws.backwards ? -1 : 1;
    G.dawn.value = this.laws.duskForever ? 0 : Math.max(0, nightProgress - 0.6) / 0.4;
    G.time.value = this.time;
    const s = this.sky.u;
    s.top.value.set(e.skyTop); s.horizon.value.set(e.skyHorizon); s.bottom.value.set(e.skyBottom);
    s.stars.value = e.stars; s.mandala.value = e.mandala;
    s.mandalaRot.value = (nightOfYear / 365) * Math.PI * 2;
    s.close.value = nightOfYear >= 365 ? Math.min(1, nightProgress * 1.2) : 0;
    // the two moons slowly trade places over the 365 nights
    let t = (nightOfYear % 365) / 365;
    if (this.laws.moonSwap) t = 1 - t;
    const a1 = -0.6 + t * 1.2, a2 = 0.6 - t * 1.2;
    s.moonA.value.set(Math.sin(a1), 0.45 + Math.sin(t * Math.PI) * 0.15, -Math.cos(a1)).normalize();
    s.moonB.value.set(Math.sin(a2), 0.35, -Math.cos(a2)).normalize();
    s.moon3.value = this.ctx.realLife.fullMoon ? 1 : 0;
    s.sun.value.set(...e.sunDir).normalize();
    s.sunColor.value.set(e.sunColor);
    this.sky.mesh.scale.y = this.laws.skyFlip ? -1 : 1;
  }

  dispose() {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry?.dispose();
    });
    for (const e of this.entities) e.dispose?.();
    for (const m of this.remembered.values()) m.dispose();
    clearMaterialCache(this.key + '|');
    this.bank.dispose();
    this.physics.dispose();
  }
}
