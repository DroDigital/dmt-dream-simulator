import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { Realm } from './realm';
import { M, vending, linked } from './props';
import { Shape } from './kit';
import { G, filmColor } from '../render/materials';
import { causticLayer } from './water';
import { Drifters } from '../entities/common';
import { dress } from './dress';

const T: any = TSL;
const { Fn, vec3, vec4, float, abs, max, min, length, normalize, dot, sin, cos, positionWorld, cameraPosition, mix, smoothstep, Loop, If, Break, exp, uniform, fract } = T;

/** Kaleidoscopic IFS distance estimator, ray-marched inside a bounding sphere. */
function reefSkyMaterial(colA: string, colB: string, colC: string) {
  const mat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false });
  mat.fog = false;
  const A = uniform(new THREE.Color(colA)), B = uniform(new THREE.Color(colB)), C = uniform(new THREE.Color(colC));
  const de = Fn(([p0]: any[]) => {
    const p = p0.toVar();
    const scale = float(1.0).toVar();
    const t = G.time.mul(0.05);
    Loop(7, () => {
      p.assign(abs(p));
      If(p.x.lessThan(p.y), () => { p.assign(p.yxz); });
      If(p.x.lessThan(p.z), () => { p.assign(p.zyx); });
      If(p.y.lessThan(p.z), () => { p.assign(p.xzy); });
      p.assign(p.mul(1.9).sub(vec3(1.0, 0.9 + 0.1, 0.6).mul(0.9)));
      p.assign(vec3(p.x.mul(cos(t)).sub(p.z.mul(sin(t))), p.y, p.x.mul(sin(t)).add(p.z.mul(cos(t)))));
      scale.mulAssign(1.9);
    });
    return length(p).sub(1.2).div(scale);
  });
  mat.colorNode = Fn(() => {
    const ro = cameraPosition.mul(0.02).add(vec3(0.0, 0.0, G.time.mul(0.02)));
    const rd = normalize(positionWorld.sub(cameraPosition));
    const d = float(0.6).toVar();
    const glow = float(0.0).toVar();
    const hit = float(0.0).toVar();
    Loop(40, () => {
      const p = ro.add(rd.mul(d));
      const pr = fract(p.mul(0.25)).sub(0.5).mul(4.0); // repeat space: coral forever
      const h = de(pr);
      glow.addAssign(exp(h.mul(-30.0)).mul(0.03));
      If(h.lessThan(0.002), () => { hit.assign(1.0); Break(); });
      d.addAssign(max(h, 0.004));
      If(d.greaterThan(12.0), () => { Break(); });
    });
    const fog = smoothstep(0.0, 12.0, d);
    const irid = filmColor(d.mul(0.3).add(G.time.mul(0.02)));
    let col = mix(mix(A, B, irid.x), C, irid.z).mul(hit).mul(fog.oneMinus().mul(0.9).add(0.1));
    col = mix(col, vec3(0.05, 0.02, 0.12), fog.mul(0.7));
    return col.add(C.mul(glow)).add(B.mul(smoothstep(0.3, 1.0, rd.y).mul(0.3)));
  })();
  return mat;
}

/** 9 · Fractal Reef: ray-marched coral that breathes and branches forever. */
export class FractalReef extends Realm {
  coral: { obj: THREE.Object3D; ph: number }[] = [];
  build() {
    const deep = this.ctx.deep;
    this.env = {
      ...this.env,
      skyTop: '#12061e', skyHorizon: '#3a1060', skyBottom: '#05020a',
      fog: deep ? '#08020f' : '#2a0c40', fogNear: 10, fogFar: 90, fogHeight: 0.4, fogBase: 4, sunDir: [0.2, 1, 0.1], sunColor: '#ff6fc0',
      skyAmb: '#8a40c0', groundAmb: '#2a0a3a', bloom: 1.4, bloomThreshold: 0.55, trail: 0.75, kaleido: 0.45, wobble: 0.6, stars: 0, mandala: 0.1,
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), reefSkyMaterial(this.c(1), this.c(2), this.c(3)));
    sky.renderOrder = -9; sky.frustumCulled = false;
    this.dyn(sky);
    this.scene.add(sky);
    this.sky.mesh.visible = false;
    const m = M(this);
    const sand = this.mat('reef-sand', { map: this.tex('coral'), color: '#6a3a8a', repeat: [40, 40] });
    const geo = new THREE.PlaneGeometry(200, 200, 32, 32).rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, Math.sin(x * 0.08) * Math.cos(z * 0.07) * 1.5); }
    geo.computeVertexNormals();
    this.ground(geo, sand);
    { const cl = causticLayer(this, 200, 200, '#ff9ff0', 0.3); cl.position.y = 1.6; this.dynamic.add(cl); }
    // branching coral: recursive geometric fronds (linked: flesh/water)
    const coralMat = this.mat('coral', { map: this.tex('coral'), emissive: this.c(1), emissiveIntensity: 0.35, film: 0.9, wind: 0.4 });
    const coralMat2 = this.mat('coral2', { map: this.tex('flesh'), emissive: this.c(2), emissiveIntensity: 0.45, film: 0.8, wind: 0.4 });
    const branch = (s: Shape, mat: THREE.Material, x: number, y: number, z: number, len: number, rx: number, rz: number, depth: number) => {
      const dx = Math.sin(rz) * len, dy = Math.cos(rx) * Math.cos(rz) * len, dz = Math.sin(rx) * len;
      s.cyl(mat, len * 0.08, len * 0.12, len, x + dx / 2, y + dy / 2, z + dz / 2, { rx, rz: -rz, seg: 5 });
      if (depth <= 0) { s.sphere(mat, len * 0.18, x + dx, y + dy, z + dz, { w: 5, h: 4 }); return; }
      for (let i = 0; i < 3; i++) branch(s, mat, x + dx, y + dy, z + dz, len * 0.68, rx + this.rng.range(-0.7, 0.7), rz + this.rng.range(-0.7, 0.7), depth - 1);
    };
    const pts = this.scatter(150, 150, 9, 0, 0, Math.round(70 * this.density));
    for (const [x, z] of pts) {
      if (Math.hypot(x, z) < 6) continue;
      const s = new Shape();
      branch(s, this.rng.chance(0.5) ? coralMat : coralMat2, 0, 0, 0, this.rng.range(1.2, 2.6), 0, 0, 3);
      const l = linked(this, s.build(), x, this.heightAt(x, z), z, this.rng.next() * 6, ['flesh', 'water'], 'coral', 'cyl');
      this.dyn(l.object);
      this.coral.push({ obj: l.object, ph: this.rng.next() * 6 });
    }
    // landmark: the spiral
    const sp = new Shape();
    for (let i = 0; i < 80; i++) {
      const a = i * 0.35, r = 2 + i * 0.12;
      sp.sphere(i % 2 ? coralMat : coralMat2, 0.6 + i * 0.02, Math.cos(a) * r, i * 0.45, Math.sin(a) * r, { w: 6, h: 4 });
    }
    this.landmark = linked(this, sp.build(), -30, 0, -40, 0, ['flesh', 'water'], 'spiral').object;
    this.dyn(this.landmark);
    // quiet place: a giant pearl in an open shell
    const pearl = new Shape();
    pearl.sphere(this.mat('pearl', { color: '#fff0f8', film: 1.2, emissive: '#ffd8f0', emissiveIntensity: 0.4 }), 0.8, 0, 0.9, 0, { w: 12, h: 8 });
    pearl.sphere(coralMat2, 1.6, 0, 0.3, 0, { w: 10, h: 4, sy: 0.25 });
    const po = this.place(pearl.build(), 22, this.heightAt(22, 18), 18);
    this.solid(po, 'ball');
    this.quiet = { pos: po.position.clone(), radius: 2.5 };
    // mundane anchor: a vending machine, sunk and humming
    linked(this, vending(this, m, '#3a8aa0'), 8, this.heightAt(8, -8) - 0.4, -8, 0.6, ['machine', 'water'], 'vending').object.rotation.z = 0.2;
    this.addEntity(new Drifters(this, new THREE.Vector3(0, 6, 0), Math.round(30 * this.density), 50, 14));
    this.spawn.pos.set(0, this.heightAt(0, 0) + 0.2, 0);
    this.spawn.yaw = 0;
    this.killY = -20;
    dress(this, {
      lamps: [new THREE.Vector3(22, 2, 18)], lf: { centre: new THREE.Vector3(0, 0, 0), radius: 15, count: 2 },
      phone: { pos: new THREE.Vector3(-4, this.heightAt(-4, 3), 3), yaw: 1 },
      woman: { pos: new THREE.Vector3(-26, this.heightAt(-26, -34), -34), yaw: 3 }, nestedAt: new THREE.Vector3(3, this.heightAt(3, 3), 3),
    });
  }
  update() {
    for (const c of this.coral) { const k = 1 + Math.sin(this.time * 0.8 + c.ph) * 0.06; c.obj.scale.set(k, 1 / k, k); }
    if (this.landmark) this.landmark.rotation.y = this.time * 0.03;
  }
}
