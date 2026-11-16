import * as THREE from 'three/webgpu';
import { createNoise2D } from 'simplex-noise';
import { Realm } from './realm';
import { M, vending, linked } from './props';
import { Shape } from './kit';
import { dress } from './dress';

const WORDS = ['here', 'again', 'almost', 'door', 'home', 'sleep', 'remember', 'nowhere', 'soft', 'light', 'still', 'you', 'later', 'under', 'kite', 'moon'];

/** 11 · Glyph Desert: dunes, sky and wind drawn entirely in moving characters. */
export class GlyphDesert extends Realm {
  footprints: THREE.Mesh[] = [];
  footIdx = 0;
  lastFoot = new Map<number, THREE.Vector3>();
  wordTex: THREE.CanvasTexture[] = [];
  noise = createNoise2D(() => this.rng.next());
  build() {
    const deep = this.ctx.deep;
    this.env = {
      ...this.env,
      skyTop: '#05040a', skyHorizon: deep ? '#2a1a10' : '#6a5030', skyBottom: '#0a0806',
      fog: deep ? '#0a0806' : '#6a5038', fogNear: 40, fogFar: 240, sunDir: [0.6, 0.35, -0.5], sunColor: '#ffd8a0',
      skyAmb: '#8a7a6a', groundAmb: '#3a2a1a', bloom: 0.9, glyph: 1, glyphCell: 9, trail: 0.4, kaleido: 0.1, stars: 1.2, mandala: 0.9, grade: 0.4,
    };
    const m = M(this);
    const sand = this.mat('sand', { map: this.tex('sand'), color: '#e8c890', repeat: [60, 60] });
    const geo = new THREE.PlaneGeometry(320, 320, 64, 64).rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const ridge = 1 - Math.abs(this.noise(x * 0.012, z * 0.02));
      pos.setY(i, ridge * ridge * 9 + this.noise(x * 0.05, z * 0.05) * 0.8 - 3 + Math.min(0, Math.hypot(x, z) - 6) * 0);
    }
    geo.computeVertexNormals();
    this.ground(geo, sand);
    // landmark: the letter obelisk, covered in drifting characters
    const glyphMat = this.mat('obelisk', { map: this.tex('glyph'), emissive: this.c(4), emissiveIntensity: 0.7, glyphy: true, repeat: [2, 8] });
    const ob = new Shape();
    ob.box(glyphMat, 4, 34, 4, 0, 17, 0); ob.cone(glyphMat, 3, 5, 0, 36.5, 0, { seg: 4, ry: Math.PI / 4 });
    const oy = this.heightAt(0, -70);
    this.landmark = linked(this, ob.build(), 0, oy - 1, -70, 0.3, ['glyph'], 'obelisk').object;
    // standing stones of letters
    const stone = this.mat('glyph-stone', { map: this.tex('glyph', 1), emissive: this.c(1), emissiveIntensity: 0.35 });
    const pts = this.scatter(220, 220, 18, 0, 0, Math.round(40 * this.density));
    for (const [x, z] of pts) {
      if (Math.hypot(x, z) < 8) continue;
      const s = new Shape();
      const h = this.rng.range(1.5, 5);
      s.box(stone, this.rng.range(0.6, 1.4), h, this.rng.range(0.3, 0.8), 0, h / 2, 0);
      const l = linked(this, s.build(), x, this.heightAt(x, z) - 0.3, z, this.rng.next() * 6, ['glyph'], 'glyph-stone');
      l.object.rotation.z = this.rng.range(-0.2, 0.2);
    }
    // mundane anchor: a lone vending machine and a phone box in the dunes
    linked(this, vending(this, m, '#d9b26a'), 12, this.heightAt(12, -12), -12, -0.7, ['machine', 'glyph'], 'vending');
    // footprints are words
    for (const w of WORDS) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 32;
      const ctx = c.getContext('2d')!; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 128, 32);
      ctx.fillStyle = '#fff'; ctx.font = '26px VT323, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(w, 64, 17);
      const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
      this.wordTex.push(t);
    }
    const fpGeo = new THREE.PlaneGeometry(0.9, 0.22).rotateX(-Math.PI / 2);
    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshBasicNodeMaterial({ map: this.wordTex[i % this.wordTex.length], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(this.c(4)) });
      const fp = new THREE.Mesh(fpGeo, mat);
      fp.visible = false;
      this.dyn(fp);
      this.dynamic.add(fp);
      this.footprints.push(fp);
    }
    this.quiet = { pos: new THREE.Vector3(30, this.heightAt(30, 30), 30), radius: 3 };
    this.spawn.pos.set(0, this.heightAt(0, 0) + 0.3, 0);
    this.spawn.yaw = 0;
    this.killY = -30;
    dress(this, {
      lf: { centre: new THREE.Vector3(0, 0, 0), radius: 25, count: 1 },
      phone: { pos: new THREE.Vector3(-14, this.heightAt(-14, -6), -6), yaw: 0.8 },
      kite: new THREE.Vector3(0, 18, -30), woman: { pos: new THREE.Vector3(-20, this.heightAt(-20, -50), -50), yaw: 3 }, nestedAt: new THREE.Vector3(4, this.heightAt(4, 4), 4),
    });
  }
  update() {
    for (const d of this.dreamers()) {
      const last = this.lastFoot.get(d.slot);
      if (!last || last.distanceTo(d.position) > 1.1) {
        const fp = this.footprints[this.footIdx++ % this.footprints.length];
        fp.visible = true;
        fp.position.set(d.position.x, d.position.y + 0.04, d.position.z);
        fp.rotation.y = d.yaw;
        fp.userData.age = 0;
        this.lastFoot.set(d.slot, d.position.clone());
        this.hooks?.sfx('step-glyph', d.position, this.key, 0.3);
      }
    }
    for (const fp of this.footprints) {
      if (!fp.visible) continue;
      fp.userData.age = (fp.userData.age ?? 0) + 1 / 60;
      if (fp.userData.age > 20) fp.visible = false;
    }
  }
  dispose() { this.wordTex.forEach((t) => t.dispose()); super.dispose(); }
}
