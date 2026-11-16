import * as THREE from 'three/webgpu';
import { RAPIER } from './core/physics';
import type { Realm, Linkable } from './realms/realm';
import type { PlayerInput, DeviceId } from './core/input';
import type { PlayerProfile, Settings } from './core/settings';
import type { LawEffects } from './data/laws';
import type { DreamerView } from './core/types';
import { Spring, AngleSpring, clamp } from './core/spring';
import { makeDreamerFigure } from './entities/common';
import { uniqueClone, type LoFiMaterial } from './render/materials';
import { DREAMER_COLOURS } from './render/palettes';

const UP = { x: 0, y: 1, z: 0 };
const DREAMER_GROUP = (0x0002 << 16) | 0xfffd;

export class Dreamer implements DreamerView {
  realm: Realm | null = null;
  camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 2400);
  position = new THREE.Vector3();
  prev = new THREE.Vector3();
  eye = new THREE.Vector3();
  velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  yawS = new AngleSpring(0, 0.08);
  pitchS = new Spring(0, 0.08);
  roll = new Spring(0, 0.25);
  fovS = new Spring(75, 0.3);
  turnTarget = 0;
  grounded = false;
  stillTime = 0;
  stillPushed = 0;
  quietDone = false;
  climbPushed = false;
  spawnY = 0;
  awake = true;
  frozen = false;
  holdingHands: number | null = null;
  carrying: string | null = null;
  carryLinks = 0;
  gazeTarget: Linkable | null = null;
  gazeTime = 0;
  lookTarget: Linkable | null = null;
  private body: RAPIER.RigidBody | null = null;
  private collider: RAPIER.Collider | null = null;
  private controller: RAPIER.KinematicCharacterController | null = null;
  private sticky = new Map<Linkable, number>();
  private ray = new THREE.Raycaster();
  private figures = new Map<string, THREE.Group>();
  private pulseMats = new Map<THREE.Material, LoFiMaterial>();
  private pulsed: { l: Linkable; orig: THREE.Material[] } | null = null;
  tickCount = 0;
  joinedAt = 0;
  apartSince = 0;
  lastTogether = 0;
  scale = 1;
  realmKey = '';

  constructor(public slot: number, public device: DeviceId, public profile: PlayerProfile) {
    this.camera.layers.enableAll();
    this.camera.layers.disable(1 + slot);
  }

  get colour() { return DREAMER_COLOURS[this.slot]; }
  get dreamer() { return this.profile.dreamer; }

  /** Move into a realm's physics world. */
  enter(realm: Realm, pos?: THREE.Vector3, yaw?: number, fx: LawEffects = {}) {
    this.leave();
    this.realm = realm;
    this.realmKey = realm.key;
    this.scale = clamp(fx.scale ?? 1, 0.1, 8);
    const p = (pos ?? realm.spawn.pos).clone();
    const r = 0.32 * clamp(this.scale, 0.15, 2), hh = 0.55 * clamp(this.scale, 0.15, 2);
    this.body = realm.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y + hh + r, p.z));
    this.collider = realm.physics.world.createCollider(RAPIER.ColliderDesc.capsule(hh, r).setCollisionGroups(DREAMER_GROUP), this.body);
    this.controller = realm.physics.world.createCharacterController(0.03);
    this.controller.setUp(UP);
    this.controller.enableAutostep(0.45 * clamp(this.scale, 0.3, 3), 0.2, true);
    this.controller.enableSnapToGround(0.4);
    this.controller.setMaxSlopeClimbAngle((58 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((62 * Math.PI) / 180);
    this.controller.setSlideEnabled(true);
    this.position.copy(p);
    this.prev.copy(p);
    this.velocity.set(0, 0, 0);
    if (yaw !== undefined) { this.yaw = yaw; this.turnTarget = yaw; this.yawS.snap(yaw); }
    this.pitch = 0; this.pitchS.snap(0);
    this.spawnY = p.y;
    this.climbPushed = false;
    this.quietDone = false;
    this.sticky.clear();
    this.gazeTarget = null; this.gazeTime = 0;
    // others see you as a soft glowing figure
    if (!this.figures.has(realm.key)) {
      const fig = makeDreamerFigure(realm, this.slot, this.profile.dreamer);
      realm.dynamic.add(fig);
      this.figures.set(realm.key, fig);
    }
  }

  leave() {
    this.clearPulse();
    if (this.realm && this.body) {
      try { this.realm.physics.world.removeRigidBody(this.body); } catch { /* realm disposed */ }
      try { if (this.controller) this.realm.physics.world.removeCharacterController(this.controller); } catch { /* */ }
    }
    if (this.realm) {
      const f = this.figures.get(this.realm.key);
      if (f) { f.parent?.remove(f); this.figures.delete(this.realm.key); }
    }
    this.body = null; this.collider = null; this.controller = null;
  }

  ownsCollider(h: number) { return this.collider?.handle === h; }

  /** One fixed 60 Hz step. Returns linkables touched this step. */
  tick(dt: number, inp: PlayerInput, fx: LawEffects, settings: Settings, nightNo: number): { touched: Linkable[]; gazeLink: Linkable | null; interact: Linkable | null } {
    const out = { touched: [] as Linkable[], gazeLink: null as Linkable | null, interact: null as Linkable | null };
    const realm = this.realm;
    if (!realm || !this.controller || !this.collider || !this.body) return out;
    this.tickCount++;
    this.prev.copy(this.position);
    const active = this.awake && !this.frozen;
    // look
    if (active) {
      this.turnTarget -= inp.lookX;
      if (inp.turnLeft) this.turnTarget += Math.PI / 2;
      if (inp.turnRight) this.turnTarget -= Math.PI / 2;
      this.pitch = clamp(this.pitch - inp.lookY, -1.35, 1.35);
    }
    // (mouse look feeds turnTarget negatively: right = clockwise)
    // move
    const speedMul = fx.speed ?? 1;
    const run = inp.drift ? 7.2 : 4.0;
    const sp = run * speedMul * (this.scale > 1 ? Math.sqrt(this.scale) : Math.max(0.3, this.scale * 2.5));
    const f = active ? inp.moveY : 0, s = active ? inp.moveX : 0;
    const yaw = this.yawS.value;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const desired = fwd.multiplyScalar(f).addScaledVector(right, s);
    if (desired.lengthSq() > 1) desired.normalize();
    desired.multiplyScalar(sp);
    if (fx.drift) desired.x += 1.1;
    const k = 1 - Math.exp(-(this.grounded ? 9 : 2.5) * dt);
    this.velocity.x += (desired.x - this.velocity.x) * k;
    this.velocity.z += (desired.z - this.velocity.z) * k;
    const g = 18 * (fx.gravity ?? 1);
    if (this.grounded && this.velocity.y < 0) this.velocity.y = -1;
    else this.velocity.y -= g * dt;
    if (inp.float && active) {
      // float: slows a fall (and with Feather, lifts)
      if (this.velocity.y < -1.4) this.velocity.y += (-1.4 - this.velocity.y) * (1 - Math.exp(-6 * dt));
      if (fx.floatLift) this.velocity.y += fx.floatLift * 6 * dt;
    }
    this.velocity.y = Math.max(this.velocity.y, -40);
    const move = this.velocity.clone().multiplyScalar(dt);
    this.controller.computeColliderMovement(this.collider, move, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, DREAMER_GROUP);
    const m = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();
    const t = this.body.translation();
    const np = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z };
    this.body.setNextKinematicTranslation(np);
    // hit a ceiling: stop rising
    if (m.y < move.y - 1e-3 && move.y > 0) this.velocity.y = 0;
    const r = 0.32 * clamp(this.scale, 0.15, 2), hh = 0.55 * clamp(this.scale, 0.15, 2);
    this.position.set(np.x, np.y - hh - r, np.z);
    // wrapping realms (endless street, nave, looping corridors)
    const wrap = (realm as any).wrap as { axis: 'z' | 'xz'; period: number } | undefined;
    if (wrap && wrap.period > 0) {
      const P = wrap.period;
      const shift = new THREE.Vector3();
      if (this.position.z > P / 2) shift.z = -P; else if (this.position.z < -P / 2) shift.z = P;
      if (wrap.axis === 'xz') { if (this.position.x > P / 2) shift.x = -P; else if (this.position.x < -P / 2) shift.x = P; }
      if (shift.lengthSq()) {
        this.position.add(shift); this.prev.add(shift);
        this.body.setTranslation({ x: np.x + shift.x, y: np.y, z: np.z + shift.z }, true);
        this.body.setNextKinematicTranslation({ x: np.x + shift.x, y: np.y, z: np.z + shift.z });
      }
    }
    // contacts → links
    const seen = new Set<Linkable>();
    const n = this.controller.numComputedCollisions();
    for (let i = 0; i < n; i++) {
      const c = this.controller.computedCollision(i);
      const col = c?.collider;
      if (!col) continue;
      const l = realm.linkables.get(col.handle);
      if (!l || seen.has(l)) continue;
      seen.add(l);
    }
    for (const l of seen) {
      if (fx.sticky && !l.special) {
        const tt = (this.sticky.get(l) ?? 0) + dt;
        this.sticky.set(l, tt);
        if (tt >= 2) out.touched.push(l);
      } else out.touched.push(l);
    }
    for (const l of [...this.sticky.keys()]) if (!seen.has(l)) this.sticky.delete(l);
    // stillness
    const moving = Math.abs(f) + Math.abs(s) > 0.05 || Math.abs(inp.lookX) > 0.002 || !this.grounded;
    this.stillTime = moving ? 0 : this.stillTime + dt;
    // gaze & look targets every 4 ticks
    if (this.tickCount % 4 === 0) this.updateGaze(realm, nightNo, dt * 4, out);
    else if (this.gazeTarget && nightNo >= 10) { this.gazeTime += dt; }
    if (this.gazeTarget && this.gazeTime >= 3 && nightNo >= 10 && !this.gazeTarget.noLink) { out.gazeLink = this.gazeTarget; this.gazeTime = 0; }
    this.applyPulse();
    if (inp.interactPressed && this.lookTarget) out.interact = this.lookTarget;
    // figure follows
    const fig = this.figures.get(realm.key);
    if (fig) {
      fig.position.copy(this.position);
      fig.rotation.y = this.yawS.value + Math.PI;
      fig.scale.setScalar(this.scale);
      fig.visible = this.awake;
    }
    return out;
  }

  private updateGaze(realm: Realm, nightNo: number, dt: number, out: any) {
    this.ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.ray.far = 26 * Math.max(1, this.scale);
    this.ray.layers.set(0);
    const hits = this.ray.intersectObjects(realm.linkMeshes, true);
    let hitL: Linkable | null = null, dist = Infinity;
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.linkable) o = o.parent;
      if (o && o.visible) { hitL = o.userData.linkable; dist = h.distance; break; }
    }
    this.lookTarget = hitL && dist < 3.2 * Math.max(1, this.scale) && (hitL.special?.type === 'interact' || hitL.special?.type === 'phone' || hitL.special?.type === 'futon') ? hitL : null;
    if (hitL && hitL === this.gazeTarget) this.gazeTime += dt;
    else { this.gazeTarget = hitL && !hitL.noLink ? hitL : null; this.gazeTime = 0; }
  }

  /** Gazed-at objects pulse, then pull you in; interactables glow when looked at. */
  private applyPulse() {
    const target = this.lookTarget ?? (this.gazeTarget && this.gazeTime > 0.6 ? this.gazeTarget : null);
    if (this.pulsed && this.pulsed.l !== target) this.clearPulse();
    if (!target) return;
    if (!this.pulsed) {
      const orig = target.meshes.map((m) => m.material as THREE.Material);
      target.meshes.forEach((m) => {
        const src = m.material as LoFiMaterial;
        if (!src.userData?.opts) return;
        let p = this.pulseMats.get(src);
        if (!p) { p = uniqueClone(src, src.userData.opts); p.uRemember.value = src.uRemember?.value ?? 0; this.pulseMats.set(src, p); }
        m.material = p;
      });
      this.pulsed = { l: target, orig };
    }
    const amt = this.lookTarget ? 0.25 : Math.min(1, (this.gazeTime - 0.6) / 2.4) * 0.8;
    for (const m of target.meshes) { const mm = m.material as LoFiMaterial; if (mm.uPulse) mm.uPulse.value = amt; }
  }

  clearPulse() {
    if (!this.pulsed) return;
    this.pulsed.l.meshes.forEach((m, i) => (m.material = this.pulsed!.orig[i]));
    this.pulsed = null;
  }

  /** Smooth camera, interpolated between sim states. */
  updateCamera(alpha: number, dt: number, settings: Settings, fx: LawEffects, time: number) {
    this.yaw = this.yawS.update(dt, this.turnTarget);
    const pitch = this.pitchS.update(dt, this.pitch);
    const p = this.prev.clone().lerp(this.position, alpha);
    const eyeH = 1.58 * this.scale;
    const bob = this.grounded ? Math.sin(time * 7) * Math.min(1, Math.hypot(this.velocity.x, this.velocity.z) / 4) * 0.025 * this.scale : 0;
    this.eye.set(p.x, p.y + eyeH + bob, p.z);
    this.camera.position.copy(this.eye);
    const yawVel = this.yawS.velocity;
    const rollTarget = settings.roll && !this.profile.gentle ? clamp(-yawVel * 0.02, -0.052, 0.052) : 0;
    const roll = this.roll.update(dt, rollTarget);
    this.camera.rotation.set(pitch, this.yaw, roll, 'YXZ');
    const base = fx.fov ?? this.profile.fov;
    const breathe = settings.breathing && !settings.gentle && !this.profile.gentle ? Math.sin(time * Math.PI * 2 * 0.2) * 1.5 : 0;
    this.camera.fov = this.fovS.update(dt, base + breathe + (this.velocity.length() > 6 ? 4 : 0));
    this.camera.near = 0.05 * Math.min(1, this.scale * 2);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
  }
}
