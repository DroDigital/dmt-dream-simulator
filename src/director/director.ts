// The Dream Director: the only system that knows what night it is. Physics
// reports contacts, entities report events, the Director decides where a link
// goes, and writes the seed + link log at waking so the night can replay.
import type { RealmId, Tag, Resonance, Quadrant, TransitionKind } from '../data/types';
import { QUADRANTS, quadrantOf, quadrantWeights, TAG_TRANSITION, DREAM_REALMS } from '../data/types';
import { REALMS, QUADRANT_START } from '../data/realms';
import { LAWS, EXCLUSIVE, combinedEffects, type LawEffects } from '../data/laws';
import { EVENTS, RARITY_WEIGHT, type DreamEvent } from '../data/events';
import { VISIONS } from '../data/visions';
import { DIARY } from '../data/diary';
import { PCG32, nightSeed, visitSeed, hash32, hashString, rngFor } from '../core/rng';
import { rollTagTable, chooseDestination, type TagTable } from './linktable';
import { push, depthOf, startRealmFor, average, chebyshev, chartSecret, cellOf, PUSHES, type PushReason } from './resonance';
import { encodeDreamCode, decodeDreamCode } from './dreamcode';
import { dailySeed, isFullMoon, isWinterSolstice, isLanternParty, todayKey } from './calendar';
import type { SaveData, NightRecord, LinkLogEntry } from '../core/save';
import { REALM_PALETTES, QUADRANT_PALETTES, mixHex, rotateHue, accentFrom } from '../render/palettes';
import type { RealmContext } from '../core/types';

export type NightMode = 'normal' | 'afterimage' | 'code' | 'daily' | 'endless';

export interface NightState {
  mode: NightMode;
  night: number;
  seed: number;
  laws: string[];
  fx: LawEffects;
  start: RealmId;
  starts: RealmId[]; // per dreamer (divergent nights)
  duration: number;
  elapsed: number;
  linkIndex: number;
  links: LinkLogEntry[];
  resonance: Resonance[]; // per dreamer
  watcherUsed: boolean;
  visions: string[];
  events: string[];
  realms: Set<RealmId>;
  tags: Tag[][]; // per dreamer
  recent: number[][]; // link times per dreamer (rush)
  keywords: string[];
  deep: boolean;
  code: string;
  replay: NightRecord | null;
  erased: boolean;
  realLife: { fullMoon: boolean; solstice: boolean; lanternParty: boolean };
}

export interface LinkResult {
  realm: RealmId;
  linkIndex: number;
  seed: number;
  transition: TransitionKind;
  vision: string | null;
  key: string;
}

export class Director {
  table: TagTable;
  night!: NightState;
  diaryOrder: number[];

  constructor(public save: SaveData, public now: () => Date = () => new Date()) {
    this.table = rollTagTable(save.runSeed);
    const rng = new PCG32(save.runSeed, 0xd1a);
    this.diaryOrder = rng.shuffle(DIARY.map((_, i) => i));
  }

  get runRng() { return new PCG32(this.save.runSeed, 0x7e5); }
  /** run-level reshuffles */
  get leadMotif(): string { return this.runRng.pick(['kite', 'train', 'woman', 'telephone', 'moons']); }
  get watcherSpeed(): number { return 0.7 + (hash32(this.save.runSeed, 7) % 1000) / 1000 * 0.6; }
  textureOwner(r: RealmId): RealmId {
    const rng = new PCG32(this.save.runSeed, 0x7e0);
    const shuffled = rng.shuffle([...DREAM_REALMS]);
    const i = DREAM_REALMS.indexOf(r);
    return i >= 0 && rng.chance(0.35) ? shuffled[i] : r;
  }

  rollLaws(seed: number, deepness: number): string[] {
    const rng = new PCG32(seed, 0x1a3);
    const extra = Math.max(0, this.save.cycle - 1);
    const base = rng.next();
    let count = base < 0.45 ? 0 : base < 0.85 ? 1 : 2;
    if (deepness > 0.6 && rng.chance(0.5)) count++;
    count = Math.min(2 + extra, count + (extra && rng.chance(0.5) ? 1 : 0));
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const pool = LAWS.filter((l) => !out.includes(l.id) && !EXCLUSIVE.some((g) => g.includes(l.id) && g.some((x) => out.includes(x))));
      const w = pool.map((l) => l.weight * (l.deep ? 0.5 + deepness * 1.5 : 1));
      const k = rng.weighted(w);
      if (k >= 0) out.push(pool[k].id);
    }
    return out;
  }

  /** Begin a night. Players = number of dreamers. */
  beginNight(mode: NightMode, players: number, opts: { code?: string; record?: NightRecord; shortNights?: boolean } = {}): NightState {
    const s = this.save;
    const nightNo = mode === 'endless' ? 1 + (s.nights.length % 365) : s.night;
    let seed = nightSeed(hash32(s.saveSeed, s.cycle), nightNo);
    let laws: string[] | null = null;
    let start: RealmId | null = null;
    let deep = false;
    let replay: NightRecord | null = null;
    const today = this.now();
    if (mode === 'afterimage' && opts.record) { replay = opts.record; seed = replay.seed; laws = replay.laws; start = replay.start; }
    if (mode === 'code' && opts.code) {
      const c = decodeDreamCode(opts.code);
      if (c) { seed = c.seed; laws = c.laws; start = c.start === 4 ? 'stair' : QUADRANT_START[QUADRANTS[c.start]]; deep = c.deep; }
    }
    if (mode === 'daily') { seed = dailySeed(today); }
    const groupRes = s.resonance;
    const deepness = depthOf(groupRes);
    if (!laws) laws = this.rollLaws(seed, deepness);
    if (!start) start = startRealmFor(groupRes);
    if (mode === 'daily') { const r = new PCG32(seed, 3); start = r.pick(DREAM_REALMS); }
    // the chart secret opens the hidden realm; night 365 opens the Threshold
    if (mode === 'normal' && chartSecret(s.dots, nightNo) && !s.achievements.includes('orrery')) start = 'orrery';
    if (mode === 'normal' && nightNo >= 365 && !s.endless && DREAM_REALMS.every((r) => s.seenRealms.includes(r))) start = 'threshold';
    const starts: RealmId[] = [];
    for (let i = 0; i < players; i++) starts.push(s.divergent && s.divergent[i] && mode === 'normal' ? startRealmFor(s.divergent[i]) : start);
    const fx = combinedEffects(laws);
    const realLife = {
      fullMoon: isFullMoon(today),
      solstice: isWinterSolstice(today),
      lanternParty: isLanternParty(today, s.settings.lanternPartyMonth, s.settings.lanternPartyDay),
    };
    let minutes = REALMS[start].minutes || 5;
    minutes *= fx.timer ?? 1;
    if (realLife.solstice) minutes *= 1.5;
    if (s.night >= 200 || mode === 'code') deep = deep || deepness > 0.75;
    const duration = opts.shortNights ? 45 * (fx.timer ?? 1) : minutes * 60;
    const prevDiary = s.lastDiary >= 0 ? DIARY[s.lastDiary] : null;
    this.night = {
      mode, night: nightNo, seed, laws, fx, start, starts, duration, elapsed: 0, linkIndex: 0, links: [],
      resonance: Array.from({ length: players }, (_, i) => ({ ...(s.divergent?.[i] ?? groupRes) })),
      watcherUsed: false, visions: [], events: [], realms: new Set(), tags: Array.from({ length: players }, () => []),
      recent: Array.from({ length: players }, () => []), keywords: prevDiary?.keywords ?? [], deep,
      code: encodeDreamCode({ seed, laws, start: start === 'stair' ? 4 : Math.max(0, QUADRANTS.indexOf(quadrantOf(groupRes))), deep }),
      replay, erased: false, realLife,
    };
    return this.night;
  }

  get progress() { return Math.min(1, this.night.elapsed / this.night.duration); }

  tick(dt: number) { this.night.elapsed += dt; }

  addPlayer(slot: number) {
    const n = this.night;
    while (n.resonance.length <= slot) { n.resonance.push({ ...this.save.resonance }); n.tags.push([]); n.recent.push([]); n.starts.push(n.start); }
  }

  pushRes(slot: number, reason: PushReason, scale = 1) {
    const r = this.night.resonance[slot];
    if (!r) return;
    this.night.resonance[slot] = push(r, PUSHES[reason], scale);
  }

  /** Build a realm-visit context. */
  visit(realm: RealmId, linkIndex: number, slot: number, coop: number, memory: Set<string>): RealmContext {
    const n = this.night;
    const vseed = realm === 'flat' ? hash32(this.save.saveSeed, 0xf1a7, this.save.nights.length) : hash32(visitSeed(n.seed, linkIndex), hashString(realm));
    const rng = new PCG32(vseed, 0xbeef);
    const res = n.resonance[slot] ?? this.save.resonance;
    const q = quadrantOf(res);
    const era = Math.min(3, Math.floor((n.night - 1) / 90) + (this.save.cycle > 1 ? 1 : 0)) % 4;
    const owner = this.textureOwner(realm);
    const base = REALM_PALETTES[owner];
    const qp = QUADRANT_PALETTES[q];
    const hueRot = new PCG32(n.seed, 0x47).range(-25, 25);
    const palette = base.map((c, i) => rotateHue(mixHex(c, qp[i], 0.3), hueRot));
    const accent = accentFrom(qp, hueRot);
    const events = realm === 'flat' ? [] : this.drawEvents(realm, rng.fork('events'), res, coop);
    const watcherChance = 0.02 + 0.06 * depthOf(res);
    const watcher = realm !== 'flat' && realm !== 'threshold' && realm !== 'chorus' && !n.watcherUsed && rng.chance(watcherChance);
    if (watcher) n.watcherUsed = true;
    return {
      id: realm, key: `${n.seed}:${linkIndex}:${realm}`, seed: vseed, rng, night: n.night, linkIndex, era,
      textureMood: QUADRANTS.indexOf(q), quadrant: q, palette, accent, laws: realm === 'flat' ? {} : n.fx,
      deep: n.deep || (this.save.night >= 200 && depthOf(res) > 0.7), coop, memory, events, resonance: res, watcher,
      watcherSpeed: this.watcherSpeed, realLife: n.realLife, chorusOk: coop >= 2, textureOwner: owner, leadMotif: this.leadMotif,
      afterimage: n.mode === 'afterimage',
    };
  }

  drawEvents(realm: RealmId, rng: PCG32, res: Resonance, coop: number): DreamEvent[] {
    const n = this.night;
    const kw = new Set(n.keywords);
    const depth = depthOf(res);
    const pool = EVENTS.filter((e) => {
      if (e.realms && !e.realms.includes(realm)) return false;
      if (e.coop && coop < e.coop) return false;
      if (e.minNight && n.night < e.minNight) return false;
      const last = this.save.eventLastSeen[e.id];
      if (last !== undefined && n.night - last < 30 && last <= n.night) return false;
      return true;
    });
    const weights = pool.map((e) => {
      let w = RARITY_WEIGHT[e.rarity];
      if (e.keywords.some((k) => kw.has(k))) w *= 3; // the Diary seeds tonight's deck
      if (e.mood === 'eerie') w *= 0.6 + depth;
      if (e.mood === 'wonder' || e.mood === 'tender') w *= 1.4 - depth * 0.6;
      return w;
    });
    const count = rng.int(1, 3);
    const out: DreamEvent[] = [];
    for (let i = 0; i < count; i++) {
      const k = rng.weighted(weights);
      if (k < 0) break;
      out.push(pool[k]);
      weights[k] = 0;
    }
    return out;
  }

  /** Decide where a link goes. */
  link(slot: number, from: RealmId, obj: { id: string; kind: string; tags: Tag[]; forced?: RealmId }, deepFall = false): LinkResult {
    const n = this.night;
    n.linkIndex++;
    const idx = n.linkIndex;
    const res = n.resonance[slot] ?? this.save.resonance;
    const rng = rngFor(n.seed, idx, hashString(obj.kind));
    let realm: RealmId;
    if (obj.forced) realm = obj.forced;
    else if (deepFall) {
      const deepRealms = DREAM_REALMS.filter((r) => REALMS[r].home.y < -1 && r !== from);
      realm = rng.pick(deepRealms);
    } else realm = chooseDestination({ tags: obj.tags, current: from, resonance: res, lastSeenNight: this.save.lastSeenNight, night: n.night, table: this.table }, rng);
    const tag = obj.tags[0];
    const transition: TransitionKind = deepFall ? 'melt' : tag ? TAG_TRANSITION[tag] : 'bloom';
    // Visions: 1 in 40 links, 1 in 25 from night 100
    const chance = n.night >= 100 ? 1 / 25 : 1 / 40;
    let vision: string | null = null;
    if (rng.chance(chance)) {
      const unseen = VISIONS.filter((v) => !n.visions.includes(v.id));
      vision = rng.pick(unseen.length ? unseen : VISIONS).id;
      n.visions.push(vision);
    }
    n.links.push({ t: n.elapsed, slot, from, obj: obj.id, to: realm, idx });
    n.tags[slot]?.push(...obj.tags);
    // a rush: 5 links within 60 s pushes Alive
    const rec = n.recent[slot] ?? (n.recent[slot] = []);
    rec.push(n.elapsed);
    while (rec.length && n.elapsed - rec[0] > 60) rec.shift();
    if (rec.length >= 5) { this.pushRes(slot, 'rush'); rec.length = 0; }
    if (deepFall) this.pushRes(slot, 'fall');
    n.realms.add(realm);
    return { realm, linkIndex: idx, seed: visitSeed(n.seed, idx), transition, vision, key: `${n.seed}:${idx}:${realm}` };
  }

  /** Waking: plot the night, write the record. Returns the record (journal fills poems/polaroids). */
  wake(colours: string[], startRealmsEnd: RealmId[], current: RealmId[]): NightRecord {
    const s = this.save;
    const n = this.night;
    // wake in the realm you started in: Still +1
    current.forEach((r, i) => { if (r === n.starts[i]) this.pushRes(i, 'samerealm'); });
    const group = average(n.resonance);
    const counted = n.mode === 'normal' || n.mode === 'endless';
    const diary = this.diaryOrder[(n.night - 1) % this.diaryOrder.length];
    const rec: NightRecord = {
      night: n.night, cycle: s.cycle, seed: n.seed, laws: n.laws, start: n.start, links: n.links,
      dots: n.resonance.map((r, i) => ({ slot: i, x: r.x, y: r.y, colour: colours[i] ?? '#fff' })), group,
      poems: [], polaroids: [], diary, realms: [...n.realms], events: n.events, visions: n.visions, erased: n.erased,
      mode: n.mode === 'endless' ? 'normal' : n.mode, code: n.code, date: todayKey(this.now()), duration: n.elapsed,
    };
    if (counted) {
      s.dots.push({ night: n.night + (s.cycle - 1) * 365, x: group.x, y: group.y });
      s.resonance = group;
      // divergent nights: dreamers more than 4 cells apart start apart tomorrow
      let far = false;
      for (let i = 0; i < n.resonance.length; i++) for (let j = i + 1; j < n.resonance.length; j++) if (chebyshev(n.resonance[i], n.resonance[j]) > 4) far = true;
      s.divergent = far ? n.resonance.map((r) => ({ ...r })) : null;
      for (const r of n.realms) { s.lastSeenNight[r] = n.night; if (!s.seenRealms.includes(r)) s.seenRealms.push(r); }
      s.lastDiary = diary;
      if (!s.endless && n.mode === 'normal') s.night = Math.min(365, s.night + 1);
      s.nights.push(rec);
      if (s.nights.length > 365 * 3) s.nights.shift();
    }
    for (const e of n.events) s.eventLastSeen[e] = n.night;
    for (const l of n.laws) if (!s.lawsSeen.includes(l)) s.lawsSeen.push(l);
    for (const v of n.visions) if (!s.visionsSeen.includes(v)) s.visionsSeen.push(v);
    if (n.mode === 'daily') s.dailyDone = todayKey(this.now());
    return rec;
  }

  /** After the Threshold: a new cycle with a new run seed. */
  newCycle() {
    const s = this.save;
    s.cycle++;
    s.runSeed = hash32(s.runSeed, s.cycle, 0xc1c1e);
    s.night = 1;
    s.seenRealms = [];
    s.souvenirs = [];
    s.divergent = null;
    this.table = rollTagTable(s.runSeed);
    const rng = new PCG32(s.runSeed, 0xd1a);
    this.diaryOrder = rng.shuffle(DIARY.map((_, i) => i));
  }

  static quadrantWeights(r: Resonance): Record<Quadrant, number> { return quadrantWeights(r); }
  static cellOf = cellOf;
}
