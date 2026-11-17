import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Kit pieces are built from primitives merged per material, with vertex
// colours for tints and world-scaled UVs so textures keep their size.

export interface PartOpts {
  rx?: number; ry?: number; rz?: number;
  color?: THREE.ColorRepresentation;
  uv?: number; // metres per texture repeat (0 = stretch 0..1)
  sx?: number; sy?: number; sz?: number;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export function prep(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation = 0xffffff): THREE.BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.getAttribute('uv')) {
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  }
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}

/** Box with UVs scaled so one repeat = `uv` metres. */
export function boxGeo(w: number, h: number, d: number, uv = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (uv > 0) {
    const a = g.getAttribute('uv');
    // faces: +x,-x,+y,-y,+z,-z each 4 verts
    const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      a.setXY(i, a.getX(i) * dims[f][0] / uv, a.getY(i) * dims[f][1] / uv);
    }
  }
  return g;
}

export function scaleUV(g: THREE.BufferGeometry, su: number, sv: number): THREE.BufferGeometry {
  const a = g.getAttribute('uv');
  for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * su, a.getY(i) * sv);
  return g;
}

export class Shape {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(mat: THREE.Material, geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, o: PartOpts = {}): this {
    _e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    _q.setFromEuler(_e);
    _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    _p.set(x, y, z);
    _m.compose(_p, _q, _s);
    const g = prep(geo, o.color ?? 0xffffff);
    g.applyMatrix4(_m);
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat)!.push(g);
    return this;
  }
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, o: PartOpts = {}) {
    return this.add(mat, boxGeo(w, h, d, o.uv ?? 0), x, y, z, o);
  }
  cyl(mat: THREE.Material, rt: number, rb: number, h: number, x: number, y: number, z: number, o: PartOpts & { seg?: number; open?: boolean } = {}) {
    const g = new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 8, 1, !!o.open);
    if (o.uv) scaleUV(g, (Math.PI * 2 * Math.max(rt, rb)) / o.uv, h / o.uv);
    return this.add(mat, g, x, y, z, o);
  }
  sphere(mat: THREE.Material, r: number, x: number, y: number, z: number, o: PartOpts & { w?: number; h?: number } = {}) {
    return this.add(mat, new THREE.SphereGeometry(r, o.w ?? 8, o.h ?? 6), x, y, z, o);
  }
  ico(mat: THREE.Material, r: number, x: number, y: number, z: number, o: PartOpts & { detail?: number } = {}) {
    return this.add(mat, new THREE.IcosahedronGeometry(r, o.detail ?? 0), x, y, z, o);
  }
  cone(mat: THREE.Material, r: number, h: number, x: number, y: number, z: number, o: PartOpts & { seg?: number } = {}) {
    return this.add(mat, new THREE.ConeGeometry(r, h, o.seg ?? 8), x, y, z, o);
  }
  plane(mat: THREE.Material, w: number, h: number, x: number, y: number, z: number, o: PartOpts = {}) {
    const g = new THREE.PlaneGeometry(w, h);
    if (o.uv) scaleUV(g, w / o.uv, h / o.uv);
    return this.add(mat, g, x, y, z, o);
  }
  torus(mat: THREE.Material, r: number, tube: number, x: number, y: number, z: number, o: PartOpts & { arc?: number } = {}) {
    return this.add(mat, new THREE.TorusGeometry(r, tube, 6, 16, o.arc ?? Math.PI * 2), x, y, z, o);
  }
  oct(mat: THREE.Material, r: number, x: number, y: number, z: number, o: PartOpts = {}) {
    return this.add(mat, new THREE.OctahedronGeometry(r, 0), x, y, z, o);
  }
  dodeca(mat: THREE.Material, r: number, x: number, y: number, z: number, o: PartOpts = {}) {
    return this.add(mat, new THREE.DodecahedronGeometry(r, 0), x, y, z, o);
  }
  get empty() { return this.buckets.size === 0; }

  build(): THREE.Group {
    const g = new THREE.Group();
    for (const [mat, geos] of this.buckets) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      g.add(mesh);
    }
    return g;
  }
}

/** Merge every non-linkable mesh under root that shares a material (draw-call budget). */
export function batchStatic(root: THREE.Object3D, keep: Set<THREE.Object3D>): void {
  const groups = new Map<THREE.Material, THREE.Mesh[]>();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as any).isInstancedMesh || m.userData.dynamic) return;
    let p: THREE.Object3D | null = m;
    while (p) { if (keep.has(p) || p.userData.dynamic) return; p = p.parent; }
    const mat = m.material as THREE.Material;
    if (Array.isArray(mat)) return;
    if (!groups.has(mat)) groups.set(mat, []);
    groups.get(mat)!.push(m);
  });
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  for (const [mat, meshes] of groups) {
    if (meshes.length < 2) continue;
    const geos = meshes.map((m) => {
      const g = m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      return prepCompat(g);
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    for (const m of meshes) m.parent?.remove(m);
    const big = new THREE.Mesh(merged, mat);
    big.frustumCulled = true;
    root.add(big);
  }
}

function prepCompat(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (g.index) g = g.toNonIndexed();
  if (!g.getAttribute('color')) prep(g);
  if (!g.getAttribute('uv')) prep(g);
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}

/** Poisson-disk sampling in a rectangle (Bridson), deterministic via rng(). */
export function poisson(w: number, h: number, r: number, rng: () => number, k = 20, max = 2000): [number, number][] {
  const cell = r / Math.SQRT2;
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const grid = new Int32Array(gw * gh).fill(-1);
  const pts: [number, number][] = [];
  const active: number[] = [];
  const addPt = (x: number, y: number) => {
    pts.push([x, y]); active.push(pts.length - 1);
    grid[Math.floor(y / cell) * gw + Math.floor(x / cell)] = pts.length - 1;
  };
  addPt(rng() * w, rng() * h);
  while (active.length && pts.length < max) {
    const ai = Math.floor(rng() * active.length);
    const [px, py] = pts[active[ai]];
    let found = false;
    for (let i = 0; i < k; i++) {
      const a = rng() * Math.PI * 2, d = r * (1 + rng());
      const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      let ok = true;
      for (let yy = Math.max(0, gy - 2); yy <= Math.min(gh - 1, gy + 2) && ok; yy++)
        for (let xx = Math.max(0, gx - 2); xx <= Math.min(gw - 1, gx + 2); xx++) {
          const j = grid[yy * gw + xx];
          if (j >= 0) { const dx = pts[j][0] - x, dy = pts[j][1] - y; if (dx * dx + dy * dy < r * r) { ok = false; break; } }
        }
      if (ok) { addPt(x, y); found = true; break; }
    }
    if (!found) active.splice(ai, 1);
  }
  return pts;
}
