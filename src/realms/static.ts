import * as THREE from 'three/webgpu';
import { Realm } from './realm';
import { M, busStop, linked } from './props';
import { Shape } from './kit';
import { signalMaterial } from './portal';
import { DREAM_REALMS, type RealmId } from '../data/types';
import { dress } from './dress';

/** 8 · Static Field: a meadow at dusk where old TVs grow like flowers, each showing another realm. */
export class StaticField extends Realm {
  antennaLight!: THREE.Object3D;
  build() {
    const deep = this.ctx.deep;
    this.env = {
      ...this.env,
      skyTop: '#1a1430', skyHorizon: deep ? '#3a2040' : '#a07a8a', skyBottom: '#141020',
      fog: deep ? '#1a1424' : '#6a5a70', fogNear: 20, fogFar: 150, sunDir: [-0.6, 0.12, -0.7], sunColor: '#e0a080',
      skyAmb: '#7a7090', groundAmb: '#40384a', bloom: 0.8, trail: 0.6, tape: 0.35, kaleido: 0.15, stars: 0.6,
    };
    const m = M(this);
    const grass = this.mat('sf-grass', { map: this.tex('grass'), color: '#9aa890', repeat: [60, 60], wind: 0.5 });
    const geo = new THREE.PlaneGeometry(260, 260, 40, 40).rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, Math.sin(x * 0.04) * 1.5 + Math.cos(z * 0.05) * 1.2 + Math.sin((x + z) * 0.11) * 0.4);
    }
    geo.computeVertexNormals();
    this.ground(geo, grass);
    // tall grass tufts
    const tuft = this.mat('sf-tuft', { map: this.tex('grass'), color: '#b8c0a0', wind: 2, side: THREE.DoubleSide });
    const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.15, 0.9, 3, 1, true).translate(0, 0.45, 0), tuft, 1500);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < 1500; i++) {
      const x = this.rng.range(-100, 100), z = this.rng.range(-100, 100);
      mm.makeTranslation(x, Math.sin(x * 0.04) * 1.5 + Math.cos(z * 0.05) * 1.2 + Math.sin((x + z) * 0.11) * 0.4 - 0.1, z);
      tufts.setMatrixAt(i, mm);
    }
    this.root.add(tufts);
    // TVs growing like flowers on stalks, each tuned to another realm
    const pts = this.scatter(160, 160, 7, 0, 0, Math.round(110 * this.density));
    const others = DREAM_REALMS.filter((r) => r !== 'static');
    const stalk = this.mat('sf-stalk', { color: '#6a8a5a', wind: 1 });
    const casing = this.mat('sf-case', { map: this.tex('plain'), color: '#c8b898' });
    const lamps: THREE.Vector3[] = [];
    const screens = new Map<RealmId, THREE.Material>();
    pts.forEach(([x, z], i) => {
      if (Math.hypot(x, z) < 5) return;
      const target = others[i % others.length];
      if (!screens.has(target)) screens.set(target, signalMaterial(target));
      const s = new Shape();
      const h = this.rng.range(0.4, 1.6);
      const sc = this.rng.range(0.7, 1.3);
      s.cyl(stalk, 0.04, 0.06, h, 0, h / 2, 0, { seg: 4 });
      s.box(stalk, 0.5, 0.03, 0.2, 0.2, h * 0.5, 0, { rz: 0.4 });
      s.box(casing, 0.7 * sc, 0.55 * sc, 0.5 * sc, 0, h + 0.27 * sc, 0);
      s.box(screens.get(target)!, 0.54 * sc, 0.4 * sc, 0.02, 0, h + 0.28 * sc, 0.26 * sc);
      const tv = s.build();
      const y = this.heightAt(x, z);
      this.place(tv, x, y, z, this.rng.next() * 6);
      tv.rotation.z = this.rng.range(-0.15, 0.15);
      this.link(tv, ['machine', 'glyph'], { kind: 'tv', special: { type: 'realm', realm: target }, thin: true });
      if (i % 5 === 0) lamps.push(new THREE.Vector3(x, y + h + 0.3, z));
    });
    // landmark: the antenna with a blinking light
    const ant = new Shape();
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; ant.box(m.metal, 0.15, 40, 0.15, Math.cos(a) * 1.4, 20, Math.sin(a) * 1.4, { color: '#c03030', rz: Math.cos(a) * 0.03, rx: -Math.sin(a) * 0.03 }); }
    for (let y = 4; y < 40; y += 4) ant.box(m.metal, 2.8 - y * 0.05, 0.1, 0.1, 0, y, 0, { color: '#e0e0e0' });
    this.landmark = linked(this, ant.build(), 50, this.heightAt(50, -60), -60, 0, ['machine'], 'antenna').object;
    const lightS = new Shape(); lightS.sphere(m.lamp, 0.5, 0, 0, 0);
    this.antennaLight = this.place(lightS.build(), 50, this.heightAt(50, -60) + 41, -60);
    this.dyn(this.antennaLight);
    // mundane anchor: a bus stop in a field; quiet place: an armchair facing the sunset
    linked(this, busStop(this, m), -12, this.heightAt(-12, 8), 8, 0.4, ['machine', 'paper'], 'busstop');
    const ch = new Shape();
    ch.box(m.fabric, 1, 0.5, 0.9, 0, 0.25, 0, { color: '#8a5a6a' });
    ch.box(m.fabric, 1, 0.9, 0.2, 0, 0.75, -0.4, { color: '#8a5a6a' });
    ch.box(m.fabric, 0.2, 0.35, 0.9, -0.45, 0.6, 0, { color: '#8a5a6a' }); ch.box(m.fabric, 0.2, 0.35, 0.9, 0.45, 0.6, 0, { color: '#8a5a6a' });
    const chair = this.place(ch.build(), 18, this.heightAt(18, 20), 20, Math.PI * 0.8);
    this.solid(chair);
    this.quiet = { pos: new THREE.Vector3(18, chair.position.y, 20), radius: 2 };
    this.spawn.pos.set(0, this.heightAt(0, 0) + 0.2, 0);
    this.spawn.yaw = 0;
    this.killY = -20;
    dress(this, {
      lamps, phone: { pos: new THREE.Vector3(-10, this.heightAt(-10, 5), 5), yaw: 0.5 },
      lf: { centre: new THREE.Vector3(0, 0, 0), radius: 25, count: 2 },
      kite: new THREE.Vector3(0, 14, -24), woman: { pos: new THREE.Vector3(-30, this.heightAt(-30, -30), -30), yaw: 2 }, nestedAt: new THREE.Vector3(3, this.heightAt(3, 3), 3),
    });
  }
  update() {
    this.antennaLight.visible = Math.sin(this.time * 3) > 0;
  }
}
