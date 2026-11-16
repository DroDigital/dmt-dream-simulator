import * as THREE from 'three/webgpu';
import type { Realm } from './realm';
import { Lanternfolk, MothChoir, Precip, Telephone, Kite, LanternWoman } from '../entities/common';
import { M } from './props';
import { Shape } from './kit';

export interface DressOpts {
  lamps?: THREE.Vector3[];
  lf?: { centre: THREE.Vector3; radius: number; count: number };
  phone?: { pos: THREE.Vector3; yaw: number; stand?: boolean };
  kite?: THREE.Vector3;
  woman?: { pos: THREE.Vector3; yaw: number };
  precipCentre?: THREE.Vector3;
  nestedAt?: THREE.Vector3;
}

/** Law-driven and motif dressing every realm gets. */
export function dress(r: Realm, o: DressOpts) {
  const rng = r.rng.fork('dress');
  const lawsLF = r.laws.lanternfolk ?? 1;
  if (o.lf && !r.laws.empty) {
    const bright = 1 + Math.max(-0.6, r.ctx.resonance.y / 4);
    const n = Math.round(o.lf.count * bright * lawsLF * r.density);
    for (let i = 0; i < n; i++) {
      const a = rng.next() * Math.PI * 2, d = rng.next() * o.lf.radius;
      const p = o.lf.centre.clone().add(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d));
      p.y = r.heightAt(p.x, p.z, o.lf.centre.y + 6);
      r.addEntity(new Lanternfolk(r, p, o.lf.radius * 0.6));
    }
  }
  // moths and drifters rise with Still
  const still = Math.max(0, -r.ctx.resonance.x) / 4;
  if (o.lamps?.length && (r.laws.moths || rng.chance(0.25 + still * 0.6))) {
    r.addEntity(new MothChoir(r, o.lamps.slice(0, 24), Math.round(18 + still * 30)));
  }
  if (o.phone) {
    const t = new Telephone(r, o.phone.pos, o.phone.yaw, o.phone.stand ?? true);
    r.addEntity(t);
    (r as any).telephone = t;
  }
  const lead = r.ctx.leadMotif;
  if (o.kite && (lead === 'kite' ? rng.chance(0.7) : rng.chance(0.2))) r.addEntity(new Kite(r, o.kite));
  if (o.woman && (lead === 'woman' ? rng.chance(0.6) : rng.chance(0.18))) r.addEntity(new LanternWoman(r, o.woman.pos, o.woman.yaw));
  const pc = o.precipCentre ?? r.spawn.pos;
  if (r.laws.snow) r.addEntity(new Precip(r, pc, 'snow', '#ffffff', 700, 50, 30, 1.2));
  if (r.laws.indoorRain && r.meta.indoor) r.addEntity(new Precip(r, pc, 'rain', '#a8c8ff', 800, 30, 8, 9));
  if (r.laws.nested && o.nestedAt) {
    const m = M(r);
    const s = new Shape();
    s.box(m.fabric, 1.0, 0.18, 2.1, 0, 0.09, 0, { color: '#f0e8f8' });
    s.box(m.white, 0.7, 0.12, 0.35, 0, 0.24, -0.8);
    const f = s.build();
    r.place(f, o.nestedAt.x, o.nestedAt.y, o.nestedAt.z, rng.next() * 6);
    r.link(f, ['light'], { kind: 'futon', special: { type: 'nested' } });
  }
}
