import * as THREE from 'three/webgpu';
import type { Realm } from '../realms/realm';
import type { GameHooks } from '../core/types';
import type { DreamEvent } from '../data/events';
import { Shape } from '../realms/kit';
import { M, vending, bicycle, door, crt } from '../realms/props';
import { Mover, Precip, Kite, LanternWoman, Watcher, NightTrain, Lanternfolk } from './common';
import { PCG32 } from '../core/rng';

// Turns event-deck entries into things that happen in a realm.

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** A small, readable stand-in for any named thing. */
export function makeThing(r: Realm, kind: string, colour = '#e0d0b0'): THREE.Group {
  const m = M(r);
  const tint = r.mat(`thing-${colour}`, { map: r.tex('plain'), color: colour });
  const glow = r.mat(`thing-glow-${colour}`, { emissive: colour, emissiveIntensity: 1.2, unlit: true });
  const s = new Shape();
  switch (kind) {
    case 'bus': case 'tram': case 'van': case 'taxi': case 'sleigh': {
      const L = kind === 'bus' || kind === 'tram' ? 9 : kind === 'sleigh' ? 3 : 4.5;
      s.box(tint, 2.4, kind === 'taxi' || kind === 'sleigh' ? 1.4 : 2.6, L, 0, 1.5, 0);
      for (let z = -L / 2 + 1; z < L / 2 - 0.5; z += 1.4) { s.box(m.window, 0.05, 0.8, 1, 1.21, 2, z); s.box(m.window, 0.05, 0.8, 1, -1.21, 2, z); }
      if (kind !== 'sleigh') for (const z of [-L / 2 + 1, L / 2 - 1]) for (const x of [-1.1, 1.1]) s.cyl(m.dark, 0.45, 0.45, 0.3, x, 0.45, z, { rz: Math.PI / 2, seg: 10 });
      s.box(m.lamp, 0.4, 0.2, 0.05, 0.7, 1.2, L / 2); s.box(m.lamp, 0.4, 0.2, 0.05, -0.7, 1.2, L / 2);
      break;
    }
    case 'boat': s.box(tint, 1.4, 0.5, 3.4, 0, 0.3, 0); s.box(m.wood, 0.05, 2, 0.05, 0, 1.4, 0); s.box(m.white, 0.02, 1.4, 1.2, 0, 1.6, 0.6); break;
    case 'bicycle': return bicycle(r, m, colour);
    case 'horse': s.box(tint, 0.5, 0.6, 1.6, 0, 1.2, 0); s.box(tint, 0.3, 0.7, 0.4, 0, 1.7, 0.8, { rx: -0.4 }); for (const [x, z] of [[-0.2, -0.6], [0.2, -0.6], [-0.2, 0.6], [0.2, 0.6]]) s.box(tint, 0.12, 0.9, 0.12, x, 0.45, z); s.cyl(m.metal, 0.03, 0.03, 4, 0, 2.5, 0, { seg: 4 }); break;
    case 'tv': return crt(r, m, 1.2);
    case 'vending': return vending(r, m, colour);
    case 'door': return door(r, m, colour, true);
    case 'cat': s.box(tint, 0.3, 0.3, 0.6, 0, 0.3, 0); s.sphere(tint, 0.18, 0, 0.55, 0.3); s.cone(tint, 0.06, 0.12, -0.08, 0.72, 0.3); s.cone(tint, 0.06, 0.12, 0.08, 0.72, 0.3); s.cone(glow, 0.15, 0.2, 0, 0.82, 0.3); break;
    case 'duck': s.sphere(m.white, 0.25, 0, 0.25, 0, { sy: 0.8 }); s.sphere(m.white, 0.14, 0, 0.5, 0.18); s.cone(glow, 0.05, 0.12, 0, 0.5, 0.33, { rx: Math.PI / 2 }); break;
    case 'chair': s.box(m.wood, 0.45, 0.05, 0.45, 0, 0.45, 0); s.box(m.wood, 0.45, 0.5, 0.05, 0, 0.7, -0.2); for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) s.box(m.wood, 0.04, 0.45, 0.04, x, 0.22, z); break;
    case 'clock': s.cyl(m.white, 0.3, 0.3, 0.1, 0, 0.6, 0, { rx: Math.PI / 2, seg: 14 }); s.box(m.dark, 0.03, 0.22, 0.02, 0, 0.66, 0.06); s.box(m.dark, 0.05, 0.6, 0.05, -0.12, 0.3, 0); s.box(m.dark, 0.05, 0.6, 0.05, 0.12, 0.3, 0); break;
    case 'mailbox': s.box(tint, 0.5, 0.7, 0.4, 0, 0.9, 0); s.cyl(tint, 0.25, 0.25, 0.4, 0, 1.25, 0, { rx: Math.PI / 2, seg: 8 }); s.box(m.dark, 0.08, 0.55, 0.08, 0, 0.27, 0); break;
    case 'snowman': s.sphere(m.white, 0.5, 0, 0.5, 0); s.sphere(m.white, 0.35, 0, 1.2, 0); s.sphere(m.white, 0.22, 0, 1.7, 0); s.cone(glow, 0.04, 0.2, 0, 1.7, 0.25, { rx: Math.PI / 2 }); break;
    case 'mannequin': s.cyl(tint, 0.18, 0.12, 0.8, 0, 1.3, 0, { seg: 6 }); s.sphere(tint, 0.13, 0, 1.85, 0); s.box(tint, 0.1, 0.8, 0.1, -0.1, 0.45, 0); s.box(tint, 0.1, 0.8, 0.1, 0.1, 0.45, 0); break;
    case 'paper': case 'shadow': case 'dreamers': s.cone(kind === 'shadow' ? m.dark : m.paper, 0.25, 0.9, 0, 0.45, 0, { seg: 4 }); s.oct(kind === 'shadow' ? m.dark : m.paper, 0.15, 0, 1.0, 0); break;
    case 'lantern': s.cyl(m.lantern, 0.2, 0.25, 0.5, 0, 0.8, 0, { seg: 6 }); s.box(m.paper, 0.04, 0.5, 0.04, -0.1, 0.25, 0); s.box(m.paper, 0.04, 0.5, 0.04, 0.1, 0.25, 0); break;
    case 'teacup': s.cyl(tint, 0.5, 0.35, 0.5, 0, 0.25, 0, { seg: 12 }); s.torus(tint, 0.15, 0.04, 0.55, 0.28, 0, { rz: Math.PI / 2 }); s.cyl(tint, 0.7, 0.7, 0.03, 0, 0, 0, { seg: 14 }); break;
    case 'spoon': s.box(tint, 0.06, 0.02, 0.8, 0, 0.05, 0); s.sphere(tint, 0.14, 0, 0.06, 0.45, { sy: 0.3 }); break;
    case 'glasses': s.torus(m.dark, 0.18, 0.02, -0.22, 0.2, 0); s.torus(m.dark, 0.18, 0.02, 0.22, 0.2, 0); s.box(m.dark, 0.1, 0.02, 0.02, 0, 0.22, 0); break;
    case 'shoe': s.box(tint, 0.3, 0.25, 0.7, 0, 0.12, 0); s.box(tint, 0.3, 0.3, 0.3, 0, 0.3, -0.2); break;
    case 'phone': s.box(tint, 0.6, 0.3, 0.5, 0, 0.15, 0); s.box(tint, 0.7, 0.12, 0.15, 0, 0.36, 0); break;
    case 'crane': s.cone(m.paper, 0.4, 0.6, 0, 0.3, 0, { seg: 4, rx: Math.PI / 2 }); s.box(m.paper, 1.2, 0.02, 0.3, 0, 0.35, 0, { rz: 0.3 }); break;
    case 'cake': s.cyl(m.white, 0.35, 0.35, 0.3, 0, 0.15, 0, { seg: 12 }); s.cyl(tint, 0.36, 0.36, 0.06, 0, 0.3, 0, { seg: 12 }); break;
    case 'candle': s.cyl(m.white, 0.05, 0.05, 0.3, 0, 0.15, 0, { seg: 6 }); s.sphere(m.lamp, 0.05, 0, 0.36, 0); break;
    case 'suitcase': s.box(tint, 0.7, 0.5, 0.25, 0, 0.25, 0); s.box(m.dark, 0.25, 0.06, 0.05, 0, 0.53, 0); break;
    case 'balloon': s.sphere(tint, 0.4, 0, 0, 0, { sy: 1.2 }); s.box(m.white, 0.01, 1.2, 0.01, 0, -1, 0); break;
    case 'fish': s.sphere(tint, 0.2, 0, 0, 0, { sx: 0.5, sz: 1.2 }); s.cone(tint, 0.15, 0.2, 0, 0, -0.3, { rx: -Math.PI / 2 }); break;
    case 'sun': s.sphere(glow, 6, 0, 0, 0, { w: 16, h: 10 }); s.box(m.dark, 0.6, 0.6, 0.2, -2, 1.5, 5.8); s.box(m.dark, 0.6, 0.6, 0.2, 2, 1.5, 5.8); s.torus(m.dark, 2.2, 0.25, 0, -0.5, 5.6, { arc: Math.PI, rz: Math.PI }); break;
    case 'giant': s.cone(tint, 3, 18, 0, 9, 0, { seg: 6 }); s.sphere(tint, 1.6, 0, 19.5, 0); break;
    default: s.box(tint, 0.6, 0.6, 0.6, 0, 0.3, 0); s.box(glow, 0.2, 0.2, 0.2, 0, 0.7, 0);
  }
  return s.build();
}

function anchor(r: Realm): THREE.Vector3 {
  const d = r.dreamers()[0];
  return d ? d.position.clone() : r.spawn.pos.clone();
}
function forward(r: Realm): THREE.Vector3 {
  const d = r.dreamers()[0];
  return d ? v3(-Math.sin(d.yaw), 0, -Math.cos(d.yaw)) : v3(0, 0, -1);
}

export function runEvent(r: Realm, ev: DreamEvent, hooks: GameHooks) {
  const rng = new PCG32(r.ctx.seed ^ ev.id.length * 7919, ev.id.charCodeAt(1));
  const p = ev.params;
  const a = anchor(r), f = forward(r);
  const side = v3(f.z, 0, -f.x);
  hooks.eventSeen(ev);
  const addMover = (kind: string, obj: THREE.Object3D, fn: Mover['fn'], dur: number) => {
    r.dynamic.add(obj);
    r.addEntity(new Mover(kind, obj, fn, dur));
  };
  switch (ev.behaviour) {
    case 'vehicle': {
      const obj = makeThing(r, p.kind, p.colour);
      const start = a.clone().addScaledVector(side, -40).addScaledVector(f, 10);
      const stop = a.clone().addScaledVector(f, 10);
      obj.rotation.y = Math.atan2(side.x, side.z);
      let rang = false;
      addMover('vehicle', obj, (t, o) => {
        // arrive, stop, wait (doors open), leave. Nobody gets off.
        const k = t < 6 ? 1 - Math.pow(1 - t / 6, 2) : t < 14 ? 1 : 1 + Math.pow((t - 14) / 6, 2);
        o.position.copy(start).lerp(stop, k);
        o.position.y = r.heightAt(o.position.x, o.position.z, o.position.y + 5);
        if (t > 6 && t < 14 && !rang && p.kind === 'bus') { rang = true; hooks.sfx('bell', o.position, r.key, 0.5); }
        if (t > 9 && t < 10) { const d = r.dreamers()[0]; if (d && d.stillTime > 5) hooks.achieve('bus-leave'); }
      }, 26);
      if (p.tune) hooks.sfx('lullaby', stop, r.key, 0.6);
      break;
    }
    case 'followLamps': {
      const lamps = r.linkList.filter((l) => /lamp|lantern-stand|streetlamp/.test(l.kind)).map((l) => l.object);
      addMover('follow', new THREE.Object3D(), (t) => {
        const d = r.dreamers()[0];
        if (!d) return;
        for (const o of lamps) {
          const want = Math.atan2(d.position.x - o.position.x, d.position.z - o.position.z) + (p.bow ? 0 : Math.PI / 2);
          o.rotation.y += (want - o.rotation.y) * 0.02;
          if (p.bow) o.rotation.x = Math.sin(t) * 0.1;
        }
      }, 40);
      break;
    }
    case 'gift': {
      const lf = r.entities.find((e) => e.kind === 'lanternfolk') as Lanternfolk | undefined;
      const d = r.dreamers()[0];
      if (lf && d) { lf.state = 'follow'; lf.followSlot = d.slot; lf.stateT = 12; setTimeout(() => hooks.giveItem(d.slot, p.item ?? 'lantern'), 6000); }
      else if (d) hooks.giveItem(d.slot, p.item ?? 'lantern');
      break;
    }
    case 'bigSun': {
      const obj = makeThing(r, 'sun');
      const dir = r.env.sunDir;
      addMover('sun', obj, (t, o) => {
        const k = (t % 5) / 5;
        const up = 1 - k;
        o.position.set(a.x + dir[0] * 220, a.y + up * 60 - 10, a.z + (dir[2] || -1) * 220);
        o.lookAt(a);
        if (t > 5 * (p.repeat ?? 1)) return true;
      }, 20);
      break;
    }
    case 'watcherWaits': {
      const stop = r.linkList.find((l) => l.kind === 'busstop');
      const pos = stop ? stop.object.position.clone().add(v3(0.5, 0, 0.5)) : a.clone().addScaledVector(f, 25);
      r.addEntity(new Watcher(r, pos, f, 0, true));
      break;
    }
    case 'rainOf': r.addEntity(new Precip(r, a, p.item, p.colour ?? '#ffffff', 400, 35, 25, p.item === 'snow' ? 1.2 : 2.2, 40)); break;
    case 'giantWalker': {
      const obj = makeThing(r, p.cat ? 'cat' : 'giant', p.colour);
      if (p.cat) obj.scale.setScalar(40);
      const c = a.clone().addScaledVector(f, 160);
      addMover('giant', obj, (t, o) => { o.position.copy(c).addScaledVector(side, -120 + t * 4); o.rotation.y = Math.atan2(side.x, side.z); o.position.y = -2 + Math.abs(Math.sin(t * 1.2)) * 0.8; }, 60);
      break;
    }
    case 'procession': {
      const n = p.count ?? 6;
      for (let i = 0; i < n; i++) {
        const obj = makeThing(r, p.kind === 'lanternfolk' ? 'paper' : p.kind, r.c(i));
        const start = a.clone().addScaledVector(f, 7).addScaledVector(side, -18 - i * 1.6);
        addMover('procession', obj, (t, o) => {
          o.position.copy(start).addScaledVector(side, t * 1.3);
          o.position.y = r.heightAt(o.position.x, o.position.z, o.position.y + 4) + Math.abs(Math.sin(t * 6 + i)) * 0.1;
          o.rotation.y = Math.atan2(side.x, side.z);
        }, 32);
      }
      break;
    }
    case 'swarm': case 'airFish': {
      const n = Math.min(60, p.count ?? 12);
      const item = ev.behaviour === 'airFish' ? 'fish' : p.item ?? 'crane';
      for (let i = 0; i < n; i++) {
        const obj = makeThing(r, item === 'moth' || item === 'drifter' ? 'crane' : item, r.c(i));
        const off = v3(rng.range(-6, 6), rng.range(4, 10), rng.range(-6, 6));
        addMover('swarm', obj, (t, o) => {
          o.position.copy(a).add(off).addScaledVector(side, -30 + t * 3).add(v3(0, Math.sin(t * 2 + i) * 0.5, Math.cos(t + i) * 0.5));
          o.rotation.y = Math.atan2(side.x, side.z);
        }, 22);
      }
      break;
    }
    case 'glowObject': {
      const obj = makeThing(r, p.item, r.c(4));
      const pos = a.clone().addScaledVector(f, 6).addScaledVector(side, rng.range(-3, 3));
      pos.y = r.heightAt(pos.x, pos.z, pos.y + 4) + (p.item === 'candle' ? 1.4 : 0);
      obj.position.copy(pos);
      r.dynamic.add(obj);
      const l = r.link(obj, ['light'], { kind: 'event-' + p.item, collide: 'box', mutable: false });
      r.addEntity(new Mover('glow', obj, (t, o) => { o.rotation.y = t * 0.3; if (t > 59) r.removeLinkable(l); }, 60));
      break;
    }
    case 'sound': hooks.sfx(p.kind ?? 'chime', a.clone().addScaledVector(f, 12), r.key, 0.8); break;
    case 'shadow': {
      const sh = r.mat('event-shadow', { color: '#000', transparent: true, opacity: 0.5, unlit: true, noFog: true, depthWrite: false });
      const s = new Shape(); s.plane(sh, 14, 6, 0, 0, 0, { rx: -Math.PI / 2 });
      const obj = s.build();
      addMover('shadow', obj, (t, o) => { o.position.copy(a).addScaledVector(side, -30 + t * 6); o.position.y = a.y + 0.06; }, 12);
      break;
    }
    case 'floatUp': {
      const things = r.mutables.slice(0, 20);
      const base = things.map((o) => o.position.y);
      addMover('float', new THREE.Object3D(), (t) => {
        const k = Math.sin(Math.min(1, t / 30) * Math.PI);
        things.forEach((o, i) => { o.position.y = base[i] + k * (2 + (i % 5)); o.rotation.y += 0.002; });
        if (t >= 30) { things.forEach((o, i) => (o.position.y = base[i])); return true; }
      }, 31);
      break;
    }
    case 'resize': {
      if (p.item === 'near') {
        const near = r.mutables.filter((o) => o.position.distanceTo(a) < 15);
        near.forEach((o) => o.scale.multiplyScalar(p.scale));
      } else {
        const obj = makeThing(r, p.item, r.c(2));
        obj.scale.setScalar(p.scale ?? 20);
        obj.position.copy(a).addScaledVector(f, 120).addScaledVector(side, rng.range(-40, 40));
        obj.position.y = r.heightAt(obj.position.x, obj.position.z, 200) - 1;
        r.dynamic.add(obj);
      }
      break;
    }
    case 'colourShift': {
      const to = p.to;
      addMover('shift', new THREE.Object3D(), (t) => {
        const k = Math.sin(Math.min(1, t / 20) * Math.PI);
        if (to === 'sepia' || to === 'red') r.overrides.mono = k * 0.7;
        else if (to === 'dark') r.overrides.vignette = 0.45 + k * 0.5;
        else if (to === 'sky') r.overrides.kaleido = 0.2 + k * 0.8;
        else r.overrides.hueShift = k * (to === 'pink' ? 0.6 : to === 'blue' ? -1.2 : to === 'green' ? 1.8 : 3.1);
        if (t >= 20) { delete r.overrides.mono; delete r.overrides.hueShift; delete r.overrides.vignette; delete r.overrides.kaleido; return true; }
      }, 21);
      break;
    }
    case 'door': {
      const obj = makeThing(r, 'door', r.c(1));
      const pos = a.clone().addScaledVector(f, 9);
      pos.y = r.heightAt(pos.x, pos.z, pos.y + 4);
      r.place(obj, pos.x, pos.y, pos.z, Math.atan2(-f.x, -f.z));
      r.link(obj, ['light', 'paper'], { kind: 'lone-door', mutable: false });
      break;
    }
    case 'screensOn': r.overrides.tape = 0.6; setTimeout(() => delete r.overrides.tape, 12000); hooks.sfx('radio', a, r.key, 0.6); break;
    case 'phoneRing': hooks.ringPhone(r.key, true); break;
    case 'kite': r.addEntity(new Kite(r, a.clone().addScaledVector(f, 10).add(v3(0, 8, 0)))); break;
    case 'skyTrain': {
      const R = 90;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 16; i++) { const an = (i / 16) * Math.PI * 2; pts.push(v3(a.x + Math.cos(an) * R, a.y + 40 + Math.sin(an * 2) * 6, a.z + Math.sin(an) * R)); }
      const tr = new NightTrain(r, new THREE.CatmullRomCurve3(pts, true), 18, 6);
      r.addEntity(tr);
      setTimeout(() => r.removeEntity(tr), 40000);
      break;
    }
    case 'lanternWoman': {
      const pos = a.clone().addScaledVector(f, 14);
      pos.y = r.heightAt(pos.x, pos.z, pos.y + 4);
      r.addEntity(new LanternWoman(r, pos, Math.atan2(f.x, f.z)));
      break;
    }
    case 'moonBlink': {
      addMover('blink', new THREE.Object3D(), (t) => { r.sky.mesh.visible = !(t % 3 < 0.15); if (t > 9) { r.sky.mesh.visible = true; return true; } }, 10);
      break;
    }
    case 'footsteps': {
      let n = 0;
      addMover('steps', new THREE.Object3D(), (t) => {
        const d = r.dreamers()[0];
        if (!d) return;
        if (d.stillTime < 0.2 && Math.floor(t * 2) !== n) { n = Math.floor(t * 2); hooks.sfx('step', d.position.clone().addScaledVector(forward(r), -4), r.key, 0.8); }
      }, 30);
      break;
    }
    case 'starer': {
      const n = p.many ? 7 : 1;
      for (let i = 0; i < n; i++) {
        const obj = makeThing(r, 'mannequin', '#202028');
        const pos = a.clone().addScaledVector(f, 45 + i * 3).addScaledVector(side, (i - n / 2) * 4);
        pos.y = r.heightAt(pos.x, pos.z, pos.y + 6);
        obj.position.copy(pos);
        addMover('starer', obj, (t, o) => { o.lookAt(a.x, o.position.y, a.z); }, 50);
      }
      break;
    }
    case 'spin': {
      addMover('spin', new THREE.Object3D(), (t) => { r.overrides.wobble = Math.sin(Math.min(1, t / 12) * Math.PI) * (p.breathe ? 1.5 : 2.5); if (t > 12) { delete r.overrides.wobble; return true; } }, 13);
      break;
    }
    case 'balloon': {
      const n = p.many ? 40 : 1;
      for (let i = 0; i < n; i++) {
        const obj = makeThing(r, 'balloon', p.many ? r.c(i) : p.colour);
        const off = v3(rng.range(-15, 15), 0, rng.range(-15, 15)).addScaledVector(f, 8);
        addMover('balloon', obj, (t, o) => { o.position.copy(a).add(off).add(v3(Math.sin(t * 0.7 + i) * 0.5, 1 + t * 1.2, 0)); }, 40);
      }
      break;
    }
    case 'clocks': for (let i = 0; i < Math.min(30, p.strikes ?? 12); i++) setTimeout(() => hooks.sfx('bell', a, r.key, 0.4), i * 1100); break;
    case 'flowers': {
      const flower = r.mat('event-flower', { emissive: r.c(1), emissiveIntensity: 0.9, color: r.c(1) });
      let last = a.clone();
      addMover('flowers', new THREE.Object3D(), () => {
        const d = r.dreamers()[0];
        if (!d || d.position.distanceTo(last) < 1.2) return;
        last = d.position.clone();
        const s = new Shape(); s.cone(flower, 0.15, 0.3, 0, 0.15, 0, { seg: 5 }); s.ico(flower, 0.08, 0, 0.35, 0);
        const o = s.build(); o.position.copy(d.position).add(v3(rng.range(-0.6, 0.6), 0, rng.range(-0.6, 0.6)));
        r.dynamic.add(o);
      }, 40);
      break;
    }
    case 'faceCloud': {
      const cloudMat = r.mat('face-cloud', { color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.3 });
      const s = new Shape();
      for (let i = 0; i < 6; i++) s.sphere(cloudMat, 6 + (i % 3) * 2, (i - 3) * 6, Math.sin(i) * 2, 0);
      s.sphere(r.mat('face-eye', { color: '#303040', unlit: true }), 1.2, -5, 2, 7); s.sphere(r.mat('face-eye', { color: '#303040', unlit: true }), 1.2, 5, 2, 7);
      const obj = s.build();
      addMover('cloud', obj, (t, o) => { o.position.copy(a).addScaledVector(f, 120).addScaledVector(side, -80 + t * 4).add(v3(0, 60, 0)); o.lookAt(a); }, 45);
      break;
    }
    case 'skyStairs': {
      const m = M(r);
      const s = new Shape();
      for (let i = 0; i < 60; i++) s.box(m.white, 2, 0.2, 0.5, 0, i * 0.35, -i * 0.5);
      const obj = s.build();
      const pos = a.clone().addScaledVector(f, 5);
      r.place(obj, pos.x, r.heightAt(pos.x, pos.z, pos.y + 3), pos.z, Math.atan2(-f.x, -f.z));
      r.solid(obj, 'mesh');
      break;
    }
    case 'hole': {
      const holeMat = r.mat('hole', { color: '#000000', unlit: true, noFog: true });
      const s = new Shape(); s.cyl(holeMat, 2, 2, 0.02, 0, 0, 0, { seg: 20 });
      const obj = s.build();
      const pos = a.clone().addScaledVector(f, 7);
      pos.y = r.heightAt(pos.x, pos.z, pos.y + 3) + 0.03;
      obj.position.copy(pos);
      r.dynamic.add(obj);
      const col = r.physics.fixedCylinder(0.2, 1.8, pos.clone().add(v3(0, 0.15, 0)));
      r.link(obj, ['water'], { kind: 'hole', colliders: [col], special: { type: 'deep' }, mutable: false });
      break;
    }
    case 'chorusBell': {
      const m = M(r);
      const s = new Shape(); s.add(m.metal, new THREE.LatheGeometry([new THREE.Vector2(1.2, 0), new THREE.Vector2(1, 0.3), new THREE.Vector2(0.6, 1.4), new THREE.Vector2(0, 1.6)], 12), 0, 1, 0, { color: '#ffd890' });
      s.box(m.wood, 0.2, 4, 0.2, -1.4, 2, 0); s.box(m.wood, 0.2, 4, 0.2, 1.4, 2, 0); s.box(m.wood, 3, 0.2, 0.2, 0, 4, 0);
      const obj = s.build();
      const pos = a.clone().addScaledVector(f, 8);
      r.place(obj, pos.x, r.heightAt(pos.x, pos.z, pos.y + 3), pos.z, 0);
      r.link(obj, ['light', 'glass'], { kind: 'big-bell', chorus: p.need ?? 2, special: { type: 'realm', realm: 'chorus' }, mutable: false });
      break;
    }
    case 'dance': {
      const things = p.what === 'lanternfolk-sit' ? [] : r.mutables.slice(0, 30);
      if (p.what === 'lanternfolk-sit') for (const e of r.entities) if (e.kind === 'lanternfolk') { (e as Lanternfolk).state = 'sit'; (e as Lanternfolk).stateT = 8; }
      addMover('dance', new THREE.Object3D(), (t) => {
        things.forEach((o, i) => { o.rotation.z = Math.sin(t * 3 + i) * 0.06; o.position.y += Math.sin(t * 6 + i) * 0.004; });
        if (t > 20) { things.forEach((o) => (o.rotation.z = 0)); return true; }
      }, 21);
      break;
    }
  }
}
