import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { Realm } from './realm';
import { M, bookshelf, lanternStand } from './props';
import { Shape } from './kit';
import { G } from '../render/materials';
import { dress } from './dress';
import { Telephone } from '../entities/common';

const T: any = TSL;
const { Fn, vec2, vec3, float, floor, fract, hash, mix, smoothstep, step, max, abs, sin, cos, length, positionWorld, cameraPosition, uniform, normalize, Loop, If } = T;

/** The window onto an impossible city, parallax-correct by layered ray tests. */
function cityWindowMaterial(seed: number, skyA: string, skyB: string) {
  const mat = new THREE.MeshBasicNodeMaterial();
  mat.fog = false;
  const s = uniform(seed % 1000);
  const ca = uniform(new THREE.Color(skyA)), cb = uniform(new THREE.Color(skyB));
  mat.colorNode = Fn(() => {
    const rd = normalize(positionWorld.sub(cameraPosition));
    let col = mix(ca, cb, smoothstep(-0.1, 0.6, rd.y)).toVar();
    // a huge pale moon and a slowly turning mandala
    const md = length(vec2(rd.x.sub(0.25), rd.y.sub(0.35)));
    col.addAssign(vec3(1.0, 0.95, 0.85).mul(smoothstep(0.09, 0.085, md)).mul(0.8));
    const hit = float(0).toVar();
    // four layers of buildings, far to near
    for (let k = 3; k >= 0; k--) {
      const depth = 6 + k * 14;
      const t = float(depth).div(max(abs(rd.z), 0.001));
      const hx = positionWorld.x.add(rd.x.mul(t));
      const hy = positionWorld.y.add(rd.y.mul(t));
      const dens = 0.9 - k * 0.15;
      const id = floor(hx.mul(dens).add(s));
      const h = hash(id.add(k * 31)).mul(10 + k * 9).add(2.0).sub(4.0);
      const floating = step(0.85, hash(id.add(77 + k))); // some buildings float
      const base = floating.mul(h.mul(0.6).add(3.0)).sub(6.0);
      const inside = step(hy, h).mul(step(base, hy));
      const wx = fract(hx.mul(dens).mul(5.0)), wy = fract(hy.mul(1.6));
      const lit = step(0.55, hash(floor(hx.mul(dens * 5)).add(floor(hy.mul(1.6)).mul(57.0)).add(k)));
      const win = step(0.25, wx).mul(step(wx, 0.75)).mul(step(0.3, wy)).mul(step(wy, 0.8)).mul(lit);
      const bc = mix(vec3(0.05, 0.05, 0.12), vec3(0.18, 0.12, 0.25), float(k).div(4.0).oneMinus());
      const wc = mix(vec3(1.0, 0.8, 0.5), vec3(0.6, 0.9, 1.0), hash(id));
      const c = mix(bc, wc.mul(1.4), win);
      col.assign(mix(col, mix(c, col, float(k).mul(0.12)), inside));
    }
    return col;
  })();
  return mat;
}

export class LanternFlat extends Realm {
  futons: THREE.Object3D[] = [];
  clockHand!: THREE.Object3D;
  souvenirSpots: THREE.Vector3[] = [];

  build() {
    this.env = {
      ...this.env,
      skyTop: '#101028', skyHorizon: '#403060', skyBottom: '#080810',
      fog: '#2a2030', fogNear: 30, fogFar: 80, sunDir: [0.2, 0.9, 0.3], sunColor: '#5a4a40',
      skyAmb: '#ffcf9f', groundAmb: '#8a5a50', bloom: 0.7, bloomThreshold: 0.8, trail: 0.3, kaleido: 0.08, grade: 0.35, affine: 0.5,
    };
    const m = M(this);
    const W = 9, D = 7, H = 3;
    const floorMat = this.mat('flat-floor', { map: this.tex('wood'), color: '#c8a080' });
    const tatami = this.mat('flat-tatami', { map: this.tex('fabric'), color: '#d8d0a0' });
    const wallMat = this.mat('flat-wall', { map: this.tex('wallpaper'), color: '#f0e0d0' });
    const ceil = this.mat('flat-ceil', { map: this.tex('plaster'), color: '#e8d8c8' });
    this.ground(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorMat);
    const s = new Shape();
    s.box(tatami, 4.2, 0.02, 3.2, -1.8, 0.01, 1.2, { uv: 1.5 });
    s.box(ceil, W, 0.1, D, 0, H + 0.05, 0, { uv: 3 });
    // walls (leave a window opening in the north wall)
    s.box(wallMat, W, H, 0.2, 0, H / 2, D / 2 + 0.1, { uv: 2 });
    s.box(wallMat, 0.2, H, D, -W / 2 - 0.1, H / 2, 0, { uv: 2 });
    s.box(wallMat, 0.2, H, D, W / 2 + 0.1, H / 2, 0, { uv: 2 });
    s.box(wallMat, 2.2, H, 0.2, -3.4, H / 2, -D / 2 - 0.1, { uv: 2 });
    s.box(wallMat, 2.2, H, 0.2, 3.4, H / 2, -D / 2 - 0.1, { uv: 2 });
    s.box(wallMat, 4.6, 0.7, 0.2, 0, 0.35, -D / 2 - 0.1, { uv: 2 });
    s.box(wallMat, 4.6, 0.5, 0.2, 0, H - 0.25, -D / 2 - 0.1, { uv: 2 });
    const room = s.build();
    this.root.add(room);
    for (const c of room.children) this.physics.fixedMesh(c as THREE.Mesh);
    // the window onto an impossible city — the landmark
    const city = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.8), cityWindowMaterial(this.ctx.seed, this.c(0, 0.3), '#0a0a20'));
    city.position.set(0, 1.6, -D / 2 - 0.15);
    this.dyn(city);
    this.root.add(city);
    const frame = new Shape();
    frame.box(m.wood, 4.7, 0.08, 0.12, 0, 0.7, 0); frame.box(m.wood, 4.7, 0.08, 0.12, 0, 2.5, 0);
    frame.box(m.wood, 0.08, 1.8, 0.12, 0, 1.6, 0); frame.box(m.wood, 0.08, 1.8, 0.12, -1.15, 1.6, 0); frame.box(m.wood, 0.08, 1.8, 0.12, 1.15, 1.6, 0);
    this.place(frame.build(), 0, 0, -D / 2 - 0.05);
    this.landmark = city;
    this.physics.fixedBox(2.3, 0.9, 0.1, new THREE.Vector3(0, 1.6, -D / 2 - 0.05));

    // futons: up to four dreamers
    for (let i = 0; i < 4; i++) {
      const f = new Shape();
      f.box(m.fabric, 1.0, 0.16, 2.1, 0, 0.08, 0, { color: ['#f0e0f0', '#e0f0f8', '#f8f0d8', '#e8f8e0'][i] });
      f.box(m.white, 0.7, 0.12, 0.35, 0, 0.22, -0.8);
      f.box(m.fabric, 1.02, 0.06, 1.3, 0, 0.18, 0.35, { color: ['#d8a0c8', '#90c0e0', '#e8c880', '#a8d898'][i] });
      const obj = f.build();
      this.place(obj, -3.3 + i * 1.15, 0.02, 1.4);
      this.link(obj, [], { kind: 'futon', special: { type: 'futon' }, noLink: true });
      obj.userData.futonIndex = i;
      this.futons.push(obj);
    }
    // desk with the Dream Journal
    const desk = new Shape();
    desk.box(m.wood, 1.6, 0.06, 0.7, 0, 0.72, 0);
    for (const x of [-0.75, 0.75]) for (const z of [-0.3, 0.3]) desk.box(m.wood, 0.06, 0.72, 0.06, x, 0.36, z);
    this.place(desk.build(), 3.4, 0, -1.6, -Math.PI / 2);
    this.solid(this.root.children[this.root.children.length - 1]);
    const jr = new Shape();
    jr.box(m.paper, 0.45, 0.06, 0.32, 0, 0, 0, { color: '#f4e6c8' });
    jr.box(m.fabric, 0.47, 0.03, 0.34, 0, -0.035, 0, { color: '#7a3a4a' });
    const journal = jr.build();
    this.place(journal, 3.4, 0.78, -1.6, 0.2);
    this.link(journal, [], { kind: 'journal', collide: 'none', special: { type: 'interact', interact: 'journal' }, noLink: true });
    // the chart on the wall
    const chart = new Shape();
    chart.box(m.paper, 1.2, 1.2, 0.03, 0, 0, 0, { color: '#f6ecd8' });
    for (let i = 0; i <= 9; i++) { chart.box(m.dark, 1.08, 0.008, 0.01, 0, -0.54 + i * 0.12, 0.02); chart.box(m.dark, 0.008, 1.08, 0.01, -0.54 + i * 0.12, 0, 0.02); }
    const ch = chart.build();
    this.place(ch, W / 2 - 0.02, 1.7, 1.0, -Math.PI / 2);
    this.link(ch, [], { kind: 'chart', collide: 'none', special: { type: 'interact', interact: 'chart' }, noLink: true });
    // the Dream Atlas on a bookshelf
    const bs = bookshelf(this, m, 1.6, 2.2);
    this.place(bs, -W / 2 + 0.3, 0, -2.2, Math.PI / 2);
    this.link(bs, [], { kind: 'atlas', special: { type: 'interact', interact: 'atlas' }, noLink: true });
    // calendar: the Daily Dream
    const cal = new Shape();
    cal.box(m.paper, 0.5, 0.7, 0.02, 0, 0, 0, { color: '#fffaf0' });
    cal.box(m.fabric, 0.5, 0.15, 0.025, 0, 0.28, 0.005, { color: '#c0392b' });
    const calObj = cal.build();
    this.place(calObj, -W / 2 + 0.02, 1.8, 0.9, Math.PI / 2);
    this.link(calObj, [], { kind: 'calendar', collide: 'none', special: { type: 'interact', interact: 'daily' }, noLink: true });
    // telephone + notepad: dream codes
    const tel = new Telephone(this, new THREE.Vector3(-1.6, 0, -D / 2 + 0.45), 0);
    this.addEntity(tel);
    (this as any).telephone = tel;
    tel.link.special = { type: 'interact', interact: 'code' };
    // mirror: Afterimage (unlocked night 20)
    const mir = new Shape();
    mir.box(m.wood, 0.8, 1.7, 0.06, 0, 0, 0);
    mir.box(this.mat('mirror', { color: '#a8b8c8', film: 0.6, emissive: '#405060', emissiveIntensity: 0.4 }), 0.68, 1.56, 0.02, 0, 0, 0.04);
    const mirror = mir.build();
    this.place(mirror, W / 2 - 0.05, 1.2, -1.0 + 3.6, -Math.PI / 2);
    this.link(mirror, [], { kind: 'mirror', special: { type: 'interact', interact: 'afterimage' }, noLink: true, thin: true });
    // the door (settings live behind it)
    const dr = new Shape();
    dr.box(m.wood, 1.0, 2.1, 0.08, 0, 1.05, 0, { color: '#8a6a5a' });
    dr.sphere(m.metal, 0.05, 0.38, 1.0, 0.06);
    const doorObj = dr.build();
    this.place(doorObj, 2.2, 0, D / 2 - 0.02, Math.PI);
    this.link(doorObj, [], { kind: 'door', special: { type: 'interact', interact: 'settings' }, noLink: true });
    // paper lanterns
    const lamps: THREE.Vector3[] = [];
    for (let i = 0; i < 6; i++) {
      const x = -3.2 + (i % 3) * 3.2, z = -1.5 + Math.floor(i / 3) * 3;
      const l = new Shape();
      l.cyl(m.lantern, 0.22, 0.25, 0.5, 0, 0, 0, { seg: 8, color: this.c(i) });
      l.cyl(m.dark, 0.005, 0.005, 0.5, 0, 0.5, 0, { seg: 3 });
      const lo = l.build();
      this.place(lo, x, H - 0.7, z);
      this.dyn(lo);
      lamps.push(new THREE.Vector3(x, H - 0.7, z));
    }
    this.place(lanternStand(this, m), 3.8, 0, 2.6);
    // clock
    const clock = new Shape();
    clock.cyl(m.white, 0.28, 0.28, 0.05, 0, 0, 0, { rx: Math.PI / 2, seg: 16 });
    this.place(clock.build(), -1.6, 2.3, -D / 2 + 0.03);
    const hand = new Shape(); hand.box(m.dark, 0.02, 0.22, 0.01, 0, 0.1, 0);
    this.clockHand = hand.build(); this.place(this.clockHand, -1.6, 2.3, -D / 2 + 0.07); this.dyn(this.clockHand);
    // souvenir shelf
    const shelf = new Shape(); shelf.box(m.wood, 2.4, 0.05, 0.3, 0, 0, 0);
    this.place(shelf.build(), 1.8, 1.3, D / 2 - 0.2);
    for (let i = 0; i < 12; i++) this.souvenirSpots.push(new THREE.Vector3(0.75 + (i % 6) * 0.42, 1.36 + Math.floor(i / 6) * 0.0, D / 2 - 0.2 - Math.floor(i / 6) * 0.12));

    this.spawn.pos.set(0, 0.05, 1.2);
    this.spawn.yaw = Math.PI; // facing the window
    this.quiet = { pos: new THREE.Vector3(-1.6, 0, 1.4), radius: 1.5 };
    this.killY = -10;
    dress(this, { lamps });
  }

  /** Small souvenirs from your nights pile up in the room. */
  setSouvenirs(items: string[]) {
    const m = M(this);
    const old = this.root.getObjectByName('souvenirs');
    if (old) this.root.remove(old);
    const s = new Shape();
    items.slice(-12).forEach((it, i) => {
      const p = this.souvenirSpots[i];
      const col = this.c(i + 1);
      if (it === 'crane' || it === 'paper') s.cone(m.paper, 0.08, 0.14, p.x, p.y + 0.07, p.z, { seg: 4, color: col });
      else if (it === 'ticket') s.box(m.paper, 0.14, 0.01, 0.07, p.x, p.y + 0.01, p.z, { color: '#f2e4b0' });
      else if (it === 'shell' || it === 'stone') s.sphere(m.marble, 0.06, p.x, p.y + 0.05, p.z, { sy: 0.6 });
      else if (it === 'lantern') s.cyl(m.lantern, 0.06, 0.07, 0.14, p.x, p.y + 0.07, p.z, { seg: 6 });
      else if (it === 'tv') s.box(m.screen, 0.12, 0.1, 0.1, p.x, p.y + 0.05, p.z);
      else if (it === 'book') s.box(m.books, 0.1, 0.14, 0.04, p.x, p.y + 0.07, p.z);
      else s.ico(m.glass, 0.06, p.x, p.y + 0.06, p.z, { color: col });
    });
    if (!s.empty) { const g = s.build(); g.name = 'souvenirs'; this.root.add(g); }
  }

  update(dt: number) {
    this.clockHand.rotation.z = -(this.time / 60) * Math.PI * 2;
  }
}
