import * as THREE from 'three/webgpu';
import { Realm } from './realm';
import { M, vending, bench, lamppost } from './props';
import { Shape } from './kit';
import { seaMesh } from './water';
import { Drifters } from '../entities/common';
import { dress } from './dress';

/** 5 · Tidal Stair: a white staircase descending forever into a glowing sea under two moons. */
export class TidalStair extends Realm {
  build() {
    const deep = this.ctx.deep;
    this.env = {
      ...this.env,
      skyTop: deep ? '#05061a' : '#141c4a', skyHorizon: deep ? '#3a2a6a' : '#9fb8ff', skyBottom: '#0a1030',
      fog: deep ? '#1a1640' : '#7a90d8', fogNear: 40, fogFar: 260, sunDir: [0.4, 0.35, -0.8], sunColor: '#d8e4ff',
      skyAmb: '#a8b8ff', groundAmb: '#405088', bloom: 1.1, bloomThreshold: 0.65, godrays: 0.6, stars: 1, mandala: 0.8, trail: 0.6,
    };
    const m = M(this);
    const white = this.mat('stair-white', { map: this.tex('marble'), color: '#f8f8ff' });
    const rail = this.mat('stair-rail', { color: '#e8ecff', emissive: '#9fb8ff', emissiveIntensity: 0.2 });
    // the sea
    const sea = seaMesh(this, 900, this.c(2), this.c(1, 0.3), 0.9);
    this.dynamic.add(sea);
    const seaCol = this.physics.fixedBox(450, 0.5, 450, new THREE.Vector3(0, -1.3, 0));
    const seaObj = new THREE.Object3D(); seaObj.position.set(0, -1, 0); this.root.add(seaObj);
    this.link(seaObj, ['water'], { kind: 'sea', colliders: [seaCol], collide: 'none', thin: true, mutable: false });

    // the staircase: landings every 20 steps, descending from y=48 into the sea
    const W = 6, rise = 0.2, run = 0.4;
    const top = 48;
    let y = top, z = 0;
    const steps = new Shape();
    const lamps: THREE.Vector3[] = [];
    for (let flight = 0; flight < 14; flight++) {
      for (let i = 0; i < 20; i++) {
        steps.box(white, W, 0.2, run, 0, y - 0.1, z, { uv: 2 });
        steps.box(white, W, Math.max(0.2, y + 2) , run, 0, y - 0.1 - Math.max(0.2, y + 2) / 2, z, { uv: 2 });
        y -= rise; z -= run;
      }
      // landing
      steps.box(white, W + 2, 0.3, 4, 0, y - 0.15, z - 1.8, { uv: 2 });
      steps.box(rail, 0.15, 1.0, 4, -(W / 2 + 0.9), y + 0.5, z - 1.8);
      steps.box(rail, 0.15, 1.0, 4, W / 2 + 0.9, y + 0.5, z - 1.8);
      lamps.push(new THREE.Vector3(W / 2 + 0.9, y + 4.5, z - 1.8));
      if (flight % 2 === 0 && y > 0) this.place(lamppost(this, m, 4.5), W / 2 + 0.9, y, z - 1.8, Math.PI / 2);
      z -= 3.6;
    }
    // side rails
    const railS = new Shape();
    const len = -z;
    railS.box(rail, 0.12, 0.12, len, -W / 2 - 0.1, 0, 0);
    const railObj = railS.build();
    railObj.rotation.x = Math.atan2(top, len) * 0.85;
    const stairObj = steps.build();
    this.root.add(stairObj);
    for (const c of stairObj.children) this.physics.fixedMesh(c as THREE.Mesh);
    // the top platform
    const plat = new Shape();
    plat.box(white, 16, 1, 14, 0, top - 0.5, 7, { uv: 3 });
    for (const x of [-7, 7]) for (const zz of [1, 13]) plat.cyl(white, 0.4, 0.45, 6, x, top + 3, zz, { seg: 8 });
    plat.box(white, 16, 0.6, 14, 0, top + 6.2, 7, { uv: 3 });
    const pl = plat.build(); this.root.add(pl);
    for (const c of pl.children) this.physics.fixedMesh(c as THREE.Mesh);
    // mundane anchor: a vending machine and a bench on the landing
    this.link(this.place(vending(this, m, this.c(3)), 5.5, top, 10, -Math.PI / 2), ['machine', 'light'], { kind: 'vending' });
    this.link(this.place(bench(this, m), -5, top, 11, Math.PI / 2), ['paper'], { kind: 'bench' });
    // floating lanterns on the water (link: light/water)
    const lantern = this.mat('stair-lantern', { map: this.tex('lantern'), emissive: this.c(4, 0.4), emissiveIntensity: 2, unlit: true });
    for (let i = 0; i < 26 * this.density; i++) {
      const s = new Shape(); s.cyl(lantern, 0.3, 0.4, 0.5, 0, 0.25, 0, { seg: 6 }); s.box(m.wood, 0.9, 0.08, 0.9, 0, 0, 0);
      const o = s.build();
      const px = this.rng.range(-40, 40), pz = z + this.rng.range(-80, 60);
      this.place(o, px, -0.6, pz);
      this.link(o, ['light', 'water'], { kind: 'float-lantern' });
      this.dyn(o);
      lamps.push(new THREE.Vector3(px, 0.4, pz));
    }
    // white doors standing on random landings
    for (let i = 0; i < 3; i++) {
      const dz = -20 - i * 34;
      const s = new Shape(); s.box(white, 1.6, 2.8, 0.2, 0, 1.4, 0); s.box(this.mat('door-light', { emissive: '#fff8e0', emissiveIntensity: 1.4, unlit: true }), 1.2, 2.5, 0.22, 0, 1.25, 0);
      const d = s.build();
      const ly = top + dz * (rise / run) * 0.82;
      this.place(d, (i % 2 ? -1 : 1) * 1.8, this.heightAt((i % 2 ? -1 : 1) * 1.8, dz, top + 5), dz, 0);
      this.link(d, ['light', 'glass'], { kind: 'door' });
      void ly;
    }
    // landmark: a pale obelisk rising out of the sea beneath the two moons
    const ob = new Shape();
    ob.cyl(white, 2, 3.5, 60, 0, 30, 0, { seg: 4 }); ob.cone(white, 2, 6, 0, 63, 0, { seg: 4 });
    this.landmark = this.place(ob.build(), -60, -2, z - 120);
    this.drifts = new Drifters(this, new THREE.Vector3(0, 6, z / 2), Math.round(30 * this.density), 50, 20);
    this.addEntity(this.drifts);
    this.spawn.pos.set(0, top + 0.1, 8);
    this.spawn.yaw = 0;
    this.quiet = { pos: new THREE.Vector3(0, top - 20 * 3 * rise, -3 * (20 * run + 3.6) - 1.8), radius: 3 };
    this.killY = -30;
    dress(this, {
      lamps, lf: { centre: new THREE.Vector3(0, top, 8), radius: 6, count: 3 },
      phone: { pos: new THREE.Vector3(-6.5, top, 4), yaw: Math.PI / 2 },
      kite: new THREE.Vector3(0, top + 10, -10), woman: { pos: new THREE.Vector3(0, top, 13.5), yaw: 0 },
      nestedAt: new THREE.Vector3(3, top, 4),
    });
  }
  drifts!: Drifters;
  update() {
    // floating lanterns bob on the swell
    for (const l of this.linkList) if (l.kind === 'float-lantern') l.object.position.y = -0.6 + Math.sin(this.time * 0.9 + l.object.position.x) * 0.35;
  }
}
