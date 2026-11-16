// Thin wrapper around Rapier: it only collides. Character feel and link
// triggers are ours.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three/webgpu';

let ready: Promise<void> | null = null;
export function initPhysics(): Promise<void> {
  if (!ready) ready = RAPIER.init();
  return ready;
}
export { RAPIER };

export class Physics {
  world: RAPIER.World;
  dirty = true;
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.world.timestep = 1 / 60;
  }

  fixedBox(hx: number, hy: number, hz: number, pos: THREE.Vector3, quat?: THREE.Quaternion): RAPIER.Collider {
    const d = RAPIER.ColliderDesc.cuboid(Math.max(0.01, hx), Math.max(0.01, hy), Math.max(0.01, hz)).setTranslation(pos.x, pos.y, pos.z);
    if (quat) d.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
    this.dirty = true; return this.world.createCollider(d);
  }
  fixedBall(r: number, pos: THREE.Vector3): RAPIER.Collider {
    this.dirty = true; return this.world.createCollider(RAPIER.ColliderDesc.ball(r).setTranslation(pos.x, pos.y, pos.z));
  }
  fixedCylinder(halfH: number, r: number, pos: THREE.Vector3, quat?: THREE.Quaternion): RAPIER.Collider {
    const d = RAPIER.ColliderDesc.cylinder(halfH, r).setTranslation(pos.x, pos.y, pos.z);
    if (quat) d.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
    this.dirty = true; return this.world.createCollider(d);
  }
  /** Static triangle mesh from a world-transformed geometry. */
  fixedMesh(mesh: THREE.Mesh): RAPIER.Collider {
    mesh.updateWorldMatrix(true, false);
    const g = mesh.geometry.index ? mesh.geometry : mesh.geometry;
    const pos = g.getAttribute('position');
    const v = new Float32Array(pos.count * 3);
    const tmp = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      tmp.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      v[i * 3] = tmp.x; v[i * 3 + 1] = tmp.y; v[i * 3 + 2] = tmp.z;
    }
    let idx: Uint32Array;
    if (g.index) idx = new Uint32Array(g.index.array);
    else { idx = new Uint32Array(pos.count); for (let i = 0; i < pos.count; i++) idx[i] = i; }
    this.dirty = true; return this.world.createCollider(RAPIER.ColliderDesc.trimesh(v, idx));
  }
  /** Moving thing (train, door). */
  kinematicBox(hx: number, hy: number, hz: number, pos: THREE.Vector3): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    this.dirty = true;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z));
    const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);
    return { body, collider };
  }
  kinematicBall(r: number, pos: THREE.Vector3): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    this.dirty = true;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z));
    const collider = this.world.createCollider(RAPIER.ColliderDesc.ball(r), body);
    return { body, collider };
  }

  step() { this.world.step(); this.dirty = false; }

  castDown(x: number, y: number, z: number, maxToi = 200): number | null {
    if (this.dirty) this.step();
    const ray = new RAPIER.Ray({ x, y, z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, maxToi, true);
    return hit ? y - hit.timeOfImpact : null;
  }

  dispose() { this.world.free(); }
}
