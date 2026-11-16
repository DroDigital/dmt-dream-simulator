import * as THREE from 'three/webgpu';
import { initPhysics } from './core/physics';
import { Input, type DeviceId, type PlayerInput } from './core/input';
import { loadSave, writeSave, freshSave, wipeSave, type SaveData, type NightRecord } from './core/save';
import { defaultProfile } from './core/settings';
import { Layout, type Rect } from './core/layout';
import type { GameHooks, DreamerView } from './core/types';
import { Director, type NightMode } from './director/director';
import { depthOf, cellOf, type PushReason } from './director/resonance';
import { Dreamer } from './player';
import { createRealm } from './realms/registry';
import type { Realm, Linkable } from './realms/realm';
import { LanternFlat } from './realms/flat';
import { PanePost, Compositor, Snapshotter, rebuildGlyphAtlas } from './render/post';
import { G, setPaperTexture } from './render/materials';
import { TextureBank } from './render/textures';
import { AudioEngine, type PaneListener } from './audio/audio';
import { UI } from './ui/ui';
import { REALMS } from './data/realms';
import { DREAM_REALMS, TRANSITION_INDEX, quadrantWeights, type RealmId, type Tag, type TransitionKind } from './data/types';
import type { DreamEvent } from './data/events';
import { Watcher, Telephone, makeDreamerFigure } from './entities/common';
import { runEvent } from './entities/events';
import { runVision } from './entities/visions';
import { composePoem, poemLine } from './journal/poems';
import { scoreFrame, imageDataToDataURL } from './journal/journal';
import { DREAMER_COLOURS } from './render/palettes';
import { hashString } from './core/rng';

type Phase = 'title' | 'flat' | 'falling' | 'night' | 'waking';

interface Transition {
  from: Realm;
  to: Realm;
  t: number;
  dur: number;
  kind: TransitionKind;
  spawn: THREE.Vector3;
  yaw: number;
  vision: string | null;
  cam: THREE.PerspectiveCamera;
}

interface Pane {
  post: PanePost;
  rect: Rect;
  transition: Transition | null;
  fade: number; // 0..1 to fadeColor
  fadeColor: THREE.Color;
  bestScore: number;
  prevFrame: Uint8Array | null;
  polaroid: string;
  lens: string;
}

const STEP = 1 / 60;

export class Game implements GameHooks {
  renderer!: THREE.WebGPURenderer;
  canvas: HTMLCanvasElement;
  input: Input;
  save!: SaveData;
  director!: Director;
  audio = new AudioEngine();
  ui!: UI;
  players: Dreamer[] = [];
  panes: Pane[] = [];
  realms = new Map<string, Realm>();
  flat!: LanternFlat;
  phase: Phase = 'title';
  compositor!: Compositor;
  snap!: Snapshotter;
  layout = new Layout();
  time = 0;
  acc = 0;
  last = 0;
  paused = false;
  photoMode = false;
  lying = new Set<number>();
  sleepT = 0;
  wakeT = 0;
  nightPending: { mode: NightMode; code?: string; record?: NightRecord } | null = null;
  pendingAchievements: string[] = [];
  visionUntil = new Map<number, number>();
  phoneListen = new Map<number, number>();
  scoreClock = 0;
  scorePane = 0;
  echoes = new Map<string, THREE.Group>();
  carryCount = new Map<number, number>();
  lfTouched = 0;
  url = new URLSearchParams(location.search);
  frameTimes: number[] = [];
  debug: any = null;
  backend = 'webgl';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.input = new Input(canvas);
  }

  // ── GameHooks ──────────────────────────────────────────────────────────
  get night() { return this.director?.night?.night ?? this.save?.night ?? 1; }
  get coopCount() { return this.players.length; }
  get gentle() { return this.save?.settings.gentle ?? false; }

  push(slot: number | 'all', reason: PushReason) {
    if (this.phase !== 'night') return;
    const slots = slot === 'all' ? this.players.map((p) => p.slot) : [slot];
    for (const s of slots) this.director.pushRes(s, reason);
  }
  sfx(name: string, pos?: THREE.Vector3, realmKey?: string, gain = 1) {
    if (name === 'step' && this.director?.night?.fx.silentSteps && this.phase === 'night') return;
    this.audio.play(name, pos, realmKey, gain);
  }
  dreamersIn(realmKey: string): DreamerView[] { return this.players.filter((p) => p.realmKey === realmKey && !p.frozen); }
  wake(slot: number, reason: 'watcher' | 'timer' | 'nested') {
    const p = this.players.find((x) => x.slot === slot);
    if (!p || !p.awake || this.phase !== 'night') return;
    if (reason === 'watcher') {
      this.director.pushRes(slot, 'watcher');
      this.director.night.erased = true; // erases the Afterimage, for everyone
      this.achieve('watcher'); this.achieve('erased'); this.atlas('entity:watcher');
      this.audio.setDuck(p.realmKey, 1);
      setTimeout(() => this.audio.setDuck(p.realmKey, 0), 1000);
      this.sfx('wake', undefined, undefined, 1);
      p.awake = false;
      if (this.players.every((x) => !x.awake)) this.beginWaking();
    }
  }
  atlas(key: string) { if (this.save && !this.save.atlas.includes(key)) this.save.atlas.push(key); }
  achieve(id: string) {
    if (!this.save || this.save.achievements.includes(id)) return;
    this.save.achievements.push(id);
    this.pendingAchievements.push(id);
  }
  eventSeen(e: DreamEvent) {
    if (this.phase !== 'night') return;
    if (!this.director.night.events.includes(e.id)) this.director.night.events.push(e.id);
    if (e.rarity === 'mythic') this.achieve('mythic');
    if (Object.keys(this.save.eventLastSeen).length + this.director.night.events.length >= 50) this.achieve('events-50');
  }
  giveItem(slot: number, item: string) {
    const p = this.players.find((x) => x.slot === slot);
    if (!p) return;
    p.carrying = item;
    p.carryLinks = 0;
  }
  ringPhone(realmKey: string, on: boolean) {
    const r = this.realms.get(realmKey);
    const t = r && ((r as any).telephone as Telephone | undefined);
    if (t) { t.ringing = on; t.ringT = 0; }
  }
  musicDuck(amount: number, realmKey: string) { this.audio.setDuck(realmKey, amount); }

  // ── boot ───────────────────────────────────────────────────────────────
  async init() {
    this.save = await loadSave();
    if (this.url.has('fresh')) this.save = freshSave(+(this.url.get('seed') ?? 12345));
    const s = this.save.settings;
    if (this.url.has('short')) s.shortNights = true;
    if (this.url.has('night')) this.save.night = Math.max(1, Math.min(365, +this.url.get('night')!));
    const forceWebGL = s.renderer === 'webgl' || this.url.has('webgl');
    this.renderer = new THREE.WebGPURenderer({ canvas: this.canvas, antialias: false, forceWebGL, powerPreference: 'high-performance' });
    await this.renderer.init();
    this.backend = (this.renderer.backend as any).isWebGPUBackend ? 'webgpu' : 'webgl';
    (window as any).backend = this.backend;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.resize();
    addEventListener('resize', () => this.resize());
    await initPhysics();
    const paper = new TextureBank({ palette: ['#3a2c2a', '#e9dcc0', '#f4ead4', '#fffaf0', '#d8c8a8'], mood: 0, era: 0, seed: 11 });
    setPaperTexture(paper.get('paper'));
    this.director = new Director(this.save);
    const ph = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); ph.needsUpdate = true;
    this.compositor = new Compositor(ph);
    this.snap = new Snapshotter(ph);
    this.ui = new UI(() => this.save);
    this.wireUI();
    this.audio.setVolumes(s.volume, s.music);
    this.buildFlat();
    document.getElementById('loading')?.remove();
    if (this.url.has('auto')) this.autoStart();
    else this.ui.show('title');
    this.last = performance.now() / 1000;
    this.renderer.setAnimationLoop((ms: number) => this.frame(ms));
    (window as any).game = this;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  /** Test/automation entry: ?auto&realm=stair&players=2&law=glyphnight&vision=whale */
  async autoStart() {
    this.save.settings.seenWarning = true;
    const n = Math.max(1, Math.min(4, +(this.url.get('players') ?? 1)));
    this.addPlayer('kbm');
    for (let i = 1; i < n; i++) this.addPlayer(`pad${90 + i}` as DeviceId);
    if (this.url.has('flat')) { this.enterFlat(); return; }
    const realm = this.url.get('realm') as RealmId | null;
    this.startNight('normal', realm ?? undefined);
  }

  wireUI() {
    const ui = this.ui;
    ui.on('sleep', () => {
      this.audio.start();
      if (!this.save.settings.seenWarning) { ui.warning(); return; }
      this.leaveTitle();
    });
    ui.on('warningDone', (gentle: boolean) => { this.save.settings.gentle = gentle; this.save.settings.seenWarning = true; writeSave(this.save); this.leaveTitle(); });
    ui.on('resume', () => this.closeUI());
    ui.on('settingsChanged', () => { const s = this.save.settings; this.audio.setVolumes(s.volume, s.music); this.panes.forEach((p) => p.post.setColourBlind(s.colourBlind)); writeSave(this.save); });
    ui.on('wipe', async () => { await wipeSave(); location.reload(); });
    ui.on('wakeNow', () => { this.closeUI(); if (this.phase === 'night') this.beginWaking(); });
    ui.on('dreamCode', (code: string) => { this.closeUI(); this.achieve('code'); this.startNight('code', undefined, { code }); });
    ui.on('daily', () => { this.closeUI(); this.achieve('daily'); this.startNight('daily'); });
    ui.on('afterimage', (rec: NightRecord) => { this.closeUI(); this.achieve('afterimage'); this.startNight('afterimage', undefined, { record: rec }); });
    ui.on('achieve', (id: string) => this.achieve(id));
    ui.on('photoShoot', () => this.takePhoto());
    ui.on('photoExit', () => this.togglePhoto());
    ui.on('photoLens', (l: string) => { if (this.panes[0]) this.panes[0].lens = l; });
    ui.on('newCycle', () => { this.director.newCycle(); this.achieve('cycle'); writeSave(this.save); this.closeUI(); this.enterFlat(); });
    ui.on('endless', () => { this.save.endless = true; writeSave(this.save); this.closeUI(); this.enterFlat(); });
  }

  leaveTitle() {
    this.ui.hide();
    if (!this.players.length) this.addPlayer('kbm');
    this.enterFlat();
    this.input.requestLock();
  }

  closeUI() {
    this.ui.hide();
    this.paused = false;
    if (this.phase !== 'title') this.input.requestLock();
  }

  openUI(fn: () => void) {
    this.paused = true;
    document.exitPointerLock?.();
    fn();
  }

  // ── players & panes ────────────────────────────────────────────────────
  addPlayer(device: DeviceId): Dreamer | null {
    if (this.players.length >= 4 || this.players.some((p) => p.device === device)) return null;
    const used = new Set(this.players.map((p) => p.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    const prof = this.save.profiles[slot] ?? defaultProfile(slot);
    const p = new Dreamer(slot, device, prof);
    p.joinedAt = this.time;
    this.players.push(p);
    this.players.sort((a, b) => a.slot - b.slot);
    this.panes.push(this.makePane());
    if (this.players.length === 4) this.achieve('four');
    if (this.phase === 'flat' || this.phase === 'title') {
      const off = new THREE.Vector3((slot - 1.5) * 0.9, 0, 0);
      p.enter(this.flat, this.flat.spawn.pos.clone().add(off), this.flat.spawn.yaw);
    } else if (this.phase === 'night') {
      this.director.addPlayer(slot);
      const host = this.players.find((x) => x !== p && x.realm);
      if (host?.realm) p.enter(host.realm, host.position.clone().add(new THREE.Vector3(1, 0.2, 0)), host.yaw, this.director.night.fx);
    }
    return p;
  }

  removePlayer(p: Dreamer) {
    if (this.players.length <= 1) return;
    p.leave();
    const i = this.players.indexOf(p);
    this.players.splice(i, 1);
    const pane = this.panes.pop();
    pane?.post.dispose();
  }

  makePane(): Pane {
    const post = new PanePost(this.save.settings.colourBlind);
    return { post, rect: { x: 0, y: 0, w: 1, h: 1 }, transition: null, fade: 0, fadeColor: new THREE.Color(0, 0, 0), bestScore: -1, prevFrame: null, polaroid: '', lens: 'none' };
  }

  // ── realms ─────────────────────────────────────────────────────────────
  buildFlat() {
    this.ensureDirectorNight();
    const ctx = this.director.visit('flat', 0, 0, 1, new Set(this.save.memory));
    // the window view changes every run
    ctx.seed = (this.save.runSeed ^ 0x51ab) >>> 0;
    this.flat?.dispose();
    this.flat = createRealm(ctx) as LanternFlat;
    this.flat.init(this);
    this.flat.setSouvenirs(this.save.souvenirs);
  }

  ensureDirectorNight() {
    if (!this.director.night) this.director.beginNight('normal', Math.max(1, this.players.length), { shortNights: true });
  }

  getRealm(id: RealmId, linkIndex: number, slot: number): Realm {
    const key = `${this.director.night.seed}:${linkIndex}:${id}`;
    let r = this.realms.get(key);
    if (r) return r;
    const ctx = this.director.visit(id, linkIndex, slot, this.players.length, new Set(this.save.memory));
    r = createRealm(ctx);
    r.init(this);
    this.realms.set(key, r);
    this.atlas(`realm:${id}:e${ctx.era}:m${ctx.textureMood}`);
    if (id === 'market' && ctx.realLife.lanternParty) this.achieve('party');
    if (id === 'orrery') this.achieve('orrery');
    this.scheduleVisit(r);
    return r;
  }

  /** Events, the Watcher, and the night-number arcs for a fresh visit. */
  scheduleVisit(r: Realm) {
    const rng = r.rng.fork('schedule');
    for (const ev of r.ctx.events) {
      const at = rng.range(6, 80);
      (r as any).pending = (r as any).pending ?? [];
      (r as any).pending.push({ at, run: () => runEvent(r, ev, this) });
    }
    if (r.ctx.watcher) {
      const at = rng.range(15, 50);
      (r as any).pending = (r as any).pending ?? [];
      (r as any).pending.push({
        at, run: () => {
          const d = r.dreamers()[0];
          if (!d) return;
          const fwd = new THREE.Vector3(-Math.sin(d.yaw), 0, -Math.cos(d.yaw));
          const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
          // he walks one direction only, on a line that passes near one dreamer
          const target = d.position.clone().addScaledVector(fwd, 6).addScaledVector(side, rng.range(-1.2, 1.2));
          const start = target.clone().addScaledVector(side, -32);
          start.y = r.heightAt(start.x, start.z, d.position.y + 10);
          r.addEntity(new Watcher(r, start, side, r.ctx.watcherSpeed));
          (r as any).watcherSlot = d.slot;
        },
      });
    }
  }

  gcRealms() {
    const keep = new Set<string>();
    for (const p of this.players) keep.add(p.realmKey);
    for (const pane of this.panes) if (pane.transition) { keep.add(pane.transition.from.key); keep.add(pane.transition.to.key); }
    const live = [...this.realms.keys()];
    // keep up to 4 realms in memory; drop the oldest unused
    for (const k of live) {
      if (keep.has(k)) continue;
      if (this.realms.size <= 4 && this.phase === 'night') continue;
      this.realms.get(k)!.dispose();
      this.realms.delete(k);
      for (const p of this.players) (p as any).figures?.delete?.(k);
    }
  }

  // ── nights ─────────────────────────────────────────────────────────────
  enterFlat() {
    this.phase = 'flat';
    this.lying.clear();
    for (const r of this.realms.values()) r.dispose();
    this.realms.clear();
    this.buildFlat();
    this.players.forEach((p, i) => {
      p.awake = true; p.frozen = false; p.carrying = null;
      p.enter(this.flat, this.flat.spawn.pos.clone().add(new THREE.Vector3((i - (this.players.length - 1) / 2) * 0.9, 0, 0)), this.flat.spawn.yaw);
    });
    this.panes.forEach((p) => { p.transition = null; p.fade = 1; p.fadeColor.set(0xfff4e0); });
    this.audio.setRoomTone(true);
    this.audio.setHush(false);
    this.audio.setEcho(false);
  }

  /** Everyone lay down: drift off. */
  startNight(mode: NightMode, realmOverride?: RealmId, opts: { code?: string; record?: NightRecord } = {}) {
    this.nightPending = { mode, ...opts };
    this.phase = 'falling';
    this.sleepT = 0;
    this.sfx('sleep');
    (this as any).realmOverride = realmOverride;
  }

  actuallyBeginNight() {
    const pend = this.nightPending!;
    this.nightPending = null;
    const mode: NightMode = pend.mode === 'normal' && this.save.endless ? 'endless' : pend.mode;
    const n = this.director.beginNight(mode, this.players.length, { code: pend.code, record: pend.record, shortNights: this.save.settings.shortNights });
    const override = (this as any).realmOverride as RealmId | undefined;
    if (override && REALMS[override]) { n.start = override; n.starts = n.starts.map(() => override); }
    for (const l of this.url.getAll('law')) if (!n.laws.includes(l)) n.laws.push(l);
    if (this.url.has('law')) { const { combinedEffects } = require_laws(); n.fx = combinedEffects(n.laws); }
    this.audio.setNightTheme(n.seed);
    this.audio.setHush(!!n.fx.hush);
    this.audio.setEcho(!!n.fx.echo);
    this.audio.setRoomTone(false);
    for (const r of this.realms.values()) r.dispose();
    this.realms.clear();
    this.players.forEach((p, i) => {
      const start = n.starts[i] ?? n.start;
      const realm = this.getRealm(start, 0, p.slot);
      n.realms.add(start);
      const off = new THREE.Vector3((i - (this.players.length - 1) / 2) * 1.2, 0, 0);
      p.awake = true; p.frozen = false; p.stillTime = 0;
      p.enter(realm, realm.spawn.pos.clone().add(off), realm.spawn.yaw, n.fx);
    });
    this.panes.forEach((p) => { p.transition = null; p.fade = 1; p.fadeColor.set(0x05040a); p.bestScore = -1; p.polaroid = ''; p.prevFrame = null; });
    this.phase = 'night';
    if (n.realLife.fullMoon) this.achieve('full-moon');
    if (n.realLife.solstice) this.achieve('solstice');
    if (this.url.has('vision')) setTimeout(() => this.startVision(this.players[0], this.url.get('vision')!), 1500);
    if (this.url.has('event')) setTimeout(() => { const { EVENTS } = require_events(); const e = EVENTS.find((x: DreamEvent) => x.id === this.url.get('event')); if (e && this.players[0].realm) runEvent(this.players[0].realm, e, this); }, 1500);
    if (this.url.has('watcher')) setTimeout(() => { const r = this.players[0].realm!; r.ctx.watcher = true; (r as any).pending = [{ at: 0, run: () => { const d = this.players[0]; const f = new THREE.Vector3(-Math.sin(d.yaw), 0, -Math.cos(d.yaw)); const s = new THREE.Vector3(f.z, 0, -f.x); r.addEntity(new Watcher(r, d.position.clone().addScaledVector(f, 5).addScaledVector(s, -6), s, 0.9)); } }]; }, 500);
  }

  beginWaking() {
    if (this.phase !== 'night') return;
    this.phase = 'waking';
    this.wakeT = 0;
    this.sfx('wake');
  }

  async finishWaking() {
    const n = this.director.night;
    const current = this.players.map((p) => (p.realm?.id ?? n.start) as RealmId);
    const rec = this.director.wake(this.players.map((p) => p.colour), n.starts, current);
    // journal: polaroids and poems
    rec.polaroids = this.panes.slice(0, this.players.length).map((p) => p.polaroid);
    if (this.players.length > 1) rec.poems = this.players.map((p, i) => [poemLine(n.tags[i] ?? [], rec.seed + i)]);
    else rec.poems = [composePoem(n.tags[0] ?? [], rec.seed)];
    // souvenirs pile up in the room
    const allTags = n.tags.flat();
    if (allTags.length && rec.mode === 'normal') {
      const t = allTags[Math.floor((rec.seed % 997) / 997 * allTags.length)];
      const sv = ({ paper: 'crane', water: 'shell', light: 'lantern', glass: 'marble', flesh: 'stone', glyph: 'book', machine: 'ticket' } as Record<Tag, string>)[t];
      this.save.souvenirs.push(sv);
      if (this.save.souvenirs.length >= 12) this.achieve('souvenirs');
    }
    this.achieve('first-night');
    const N = this.save.night;
    if (N > 10) this.achieve('night-10');
    if (N > 50) this.achieve('night-50');
    if (N > 100) this.achieve('night-100');
    if (N > 200) this.achieve('night-200');
    if (this.save.lawsSeen.length >= 10) this.achieve('laws-10');
    if (this.save.visionsSeen.length >= 10) this.achieve('visions-10');
    if (DREAM_REALMS.every((r) => this.save.seenRealms.includes(r))) this.achieve('all-realms');
    for (const r of n.resonance) { const c = cellOf(r); if (c.cy === 0) this.achieve('deep'); if (c.cy === 8) this.achieve('bright'); }
    await writeSave(this.save);
    const ach = this.pendingAchievements.splice(0);
    this.enterFlat();
    this.openUI(() => this.ui.wake(rec, this.players.map((p) => p.profile.name), ach));
  }

  // ── links ──────────────────────────────────────────────────────────────
  chorusTouches = new Map<Linkable, Map<number, number>>();

  handleContact(p: Dreamer, l: Linkable, gaze = false) {
    if (p.frozen || !p.realm) return;
    const realm = p.realm;
    const sp = l.special;
    if (this.phase === 'flat') {
      if (sp?.type === 'futon') { this.lieDown(p, l); }
      return;
    }
    if (this.phase !== 'night') return;
    if (sp?.type === 'phone' || sp?.type === 'interact' || l.noLink && !sp) return;
    if (sp?.type === 'threshold') { this.achieve('threshold'); this.beginWaking(); setTimeout(() => this.openUI(() => this.ui.ending()), 5000); return; }
    if (sp?.type === 'nested') {
      this.achieve('nested');
      this.linkPlayer(p, l, { forced: DREAM_REALMS[(hashString(l.id) + this.director.night.linkIndex) % 12], transition: 'fade' });
      return;
    }
    if (l.lantern) {
      this.director.pushRes(p.slot, 'lanternfolk');
      this.atlas('entity:lanternfolk');
      if (++this.lfTouched >= 5) this.achieve('lanternfolk-5');
      const lf = realm.entities.find((e) => (e as any).link === l) as any;
      lf?.touched?.(p.slot);
    }
    // chorus links need 2–4 dreamers touching at once
    if (l.chorus && l.chorus > 1) {
      const m = this.chorusTouches.get(l) ?? new Map<number, number>();
      m.set(p.slot, this.time);
      this.chorusTouches.set(l, m);
      const recent = [...m.entries()].filter(([, t]) => this.time - t < 1.2).map(([s]) => s);
      if (recent.length < l.chorus) return;
      this.chorusTouches.delete(l);
      this.achieve('chorus');
      this.director.pushRes(p.slot, 'chorus');
      const dest: RealmId = sp?.type === 'realm' && sp.realm ? sp.realm : 'chorus';
      const group = this.players.filter((x) => recent.includes(x.slot));
      const res = this.linkPlayer(p, l, { forced: dest });
      for (const q of group) if (q !== p && res) this.followInto(q, res.realm, res.spawn, l);
      for (const q of group) this.visionUntil.set(q.slot, this.time + 4);
      return;
    }
    // remember: the next time this kind appears it glows
    if (this.save.memory.includes(l.kind)) this.achieve('remember');
    else this.save.memory.push(l.kind);
    if (l.kind === 'busstop') this.atlas('entity:bus');
    const forced = sp?.type === 'realm' ? sp.realm : undefined;
    const deep = sp?.type === 'deep';
    // co-op: follow by touching the same object within 10 s
    if (l.lastDest && this.time - l.lastDest.time < 10 && this.realms.has(l.lastDest.key)) {
      const dest = this.realms.get(l.lastDest.key)!;
      this.followInto(p, dest, dest.spawn.pos.clone().add(new THREE.Vector3(0.8 * p.slot, 0, 0.5)), l);
      return;
    }
    if (gaze) this.achieve('gaze');
    const res = this.linkPlayer(p, l, { forced, deep });
    // holding hands: link as one
    if (res && p.holdingHands !== null) {
      const q = this.players.find((x) => x.slot === p.holdingHands);
      if (q && q.realmKey === p.realmKey) { this.followInto(q, res.realm, res.spawn.clone().add(new THREE.Vector3(1, 0, 0)), l); this.achieve('hands'); }
    }
  }

  lieDown(p: Dreamer, l: Linkable) {
    if (this.lying.has(p.slot)) return;
    this.lying.add(p.slot);
    p.frozen = true;
    const f = l.object.position;
    p.position.set(f.x, f.y + 0.1, f.z + 0.3);
    p.prev.copy(p.position);
    p.pitch = 0.9;
    if (this.players.every((q) => this.lying.has(q.slot))) this.startNight('normal');
  }

  linkPlayer(p: Dreamer, l: Linkable, o: { forced?: RealmId; deep?: boolean; transition?: TransitionKind }) {
    if (!p.realm) return null;
    const from = p.realm;
    const res = this.director.link(p.slot, from.id, { id: l.id, kind: l.kind, tags: l.tags, forced: o.forced }, o.deep);
    const dest = this.getRealm(res.realm, res.linkIndex, p.slot);
    l.lastDest = { key: dest.key, realm: dest.id, time: this.time, linkIndex: res.linkIndex };
    this.audio.linkSound(l.tags, p.position, from.key);
    if (this.director.night.fx.bells) this.sfx('bell', p.position, from.key, 0.6);
    // moths burst into the air when you link
    for (const e of from.entities) if (e.kind === 'moths') (e as any).burst?.();
    if (p.carrying && ++p.carryLinks >= 3) this.achieve('carry');
    const spawn = dest.spawn.pos.clone().add(new THREE.Vector3((p.slot % 2) * 0.8, 0, Math.floor(p.slot / 2) * 0.8));
    this.beginTransition(p, from, dest, o.transition ?? res.transition, spawn, dest.spawn.yaw, res.vision);
    return { realm: dest, spawn };
  }

  followInto(q: Dreamer, dest: Realm, spawn: THREE.Vector3, l: Linkable) {
    if (!q.realm || q.frozen) return;
    this.beginTransition(q, q.realm, dest, l.tags[0] ? ({ water: 'pour', paper: 'fold', glass: 'shatter', light: 'bloom', glyph: 'dissolve', flesh: 'melt', machine: 'iris' } as const)[l.tags[0]] : 'bloom', spawn, dest.spawn.yaw, null);
  }

  beginTransition(p: Dreamer, from: Realm, to: Realm, kind: TransitionKind, spawn: THREE.Vector3, yaw: number, vision: string | null) {
    const pane = this.panes[this.players.indexOf(p)];
    if (!pane) return;
    const s = this.save.settings;
    const gentle = s.gentle || p.profile.gentle;
    let dur = vision ? 2 : 0.6;
    if (s.instantLinks) { kind = 'fade'; dur = 0.25; }
    if (gentle && (kind === 'bloom' || kind === 'shatter')) { kind = 'fade'; dur = 1.2; }
    p.frozen = true;
    const cam = new THREE.PerspectiveCamera(p.camera.fov, p.camera.aspect, 0.05, 2400);
    cam.layers.mask = p.camera.layers.mask;
    pane.transition = { from, to, t: 0, dur, kind, spawn, yaw, vision, cam };
    // pre-warm the next realm while the mask still covers the screen
    this.renderer.compileAsync(to.scene, cam).catch(() => {});
  }

  finishTransition(p: Dreamer, pane: Pane) {
    const tr = pane.transition!;
    pane.transition = null;
    p.enter(tr.to, tr.spawn, tr.yaw, this.director.night.fx);
    p.frozen = false;
    if (tr.vision) this.startVision(p, tr.vision);
    this.gcRealms();
  }

  startVision(p: Dreamer, id: string) {
    if (!p.realm) return;
    this.director.pushRes(p.slot, 'vision');
    this.achieve('vision');
    const until = runVision(id, p.realm, this, () => {});
    this.visionUntil.set(p.slot, this.time + (until - performance.now()) / 1000);
  }

  // ── photo mode ─────────────────────────────────────────────────────────
  togglePhoto() {
    this.photoMode = !this.photoMode;
    if (this.photoMode) { this.ui.photo(this.night); document.exitPointerLock?.(); }
    else { this.ui.hide(); if (this.panes[0]) this.panes[0].lens = 'none'; this.input.requestLock(); }
  }

  async takePhoto() {
    const pane = this.panes[0];
    if (!pane) return;
    const img = await this.snap.capture(this.renderer, pane.post.output.texture, pane.post.outW / pane.post.outH);
    const url = imageDataToDataURL(img, this.backend === 'webgl');
    const a = document.createElement('a'); a.download = `dmt-photo-night-${this.night}.jpg`; a.href = url; a.click();
    this.achieve('photo');
  }

  // ── the loop ───────────────────────────────────────────────────────────
  frame(ms: number) {
    const now = ms / 1000;
    const cap = this.save.settings.fpsCap;
    if (cap && now - this.last < 1 / cap - 0.002) return;
    const dtReal = Math.min(now - this.last, 0.25); // no spiral of death after a stall
    this.last = now;
    this.frameTimes.push(dtReal); if (this.frameTimes.length > 120) this.frameTimes.shift();
    this.input.enabled = !this.ui.blocking;
    this.input.poll(dtReal, (d) => { const p = this.players.find((x) => x.device === d); return { sensitivity: p?.profile.sensitivity ?? 1, invertY: p?.profile.invertY ?? false }; });
    this.handleMeta();
    if (!this.paused && this.phase !== 'title') {
      this.acc += dtReal;
      while (this.acc >= STEP) { this.tick(STEP); this.acc -= STEP; }
    }
    const alpha = this.acc / STEP;
    this.render(alpha, dtReal);
  }

  handleMeta() {
    const k = this.input.get('kbm');
    // drop-in: any button on a new pad at the Lantern Flat
    if (this.phase === 'flat' && !this.ui.blocking) for (const d of this.input.joins) if (!this.players.some((p) => p.device === d)) this.addPlayer(d);
    for (const p of [...this.players]) {
      const inp = this.input.get(p.device);
      if (inp.startHeld > 2 && this.players.length > 1) this.removePlayer(p);
    }
    if (this.phase === 'title' && this.input.joins.some((d) => d !== 'kbm') && this.ui.open === 'title') { this.audio.start(); this.addPlayer(this.input.joins.find((d) => d !== 'kbm')!); this.ui.emit('sleep'); }
    const anyPause = this.players.some((p) => this.input.get(p.device).pause) || k.pause;
    if (anyPause && this.phase !== 'title') {
      if (this.ui.open && this.ui.open !== 'title' && this.ui.open !== 'warning') { if (this.photoMode) this.togglePhoto(); else this.closeUI(); }
      else if (!this.ui.open) this.openUI(() => this.ui.menu(this.phase === 'night'));
    }
    const anyPhoto = this.players.some((p) => this.input.get(p.device).photo);
    if (anyPhoto && (this.phase === 'night' || this.phase === 'flat') && (!this.ui.open || this.photoMode)) this.togglePhoto();
    if (this.input.keyPressed('F1') && import.meta.env.DEV) import('./debug').then((m) => m.toggleDebug(this));
  }

  tick(dt: number) {
    this.time += dt;
    if (this.photoMode) return;
    const phase = this.phase;
    if (phase === 'falling') {
      this.sleepT += dt;
      this.panes.forEach((p) => { p.fade = Math.min(1, this.sleepT / 1.5); p.fadeColor.set(0x05040a); });
      if (this.sleepT >= 1.6) this.actuallyBeginNight();
      return;
    }
    if (phase === 'waking') {
      this.wakeT += dt;
      // the camera rises, the world dissolves into motes
      this.players.forEach((p) => { p.position.y += dt * 2.5; p.prev.y += dt * 2.5; });
      this.panes.forEach((p) => { p.fade = Math.min(1, this.wakeT / 3.5); p.fadeColor.set(0xfff4e0); });
      for (const r of this.realms.values()) r.tick(dt);
      if (this.wakeT >= 3.8) { this.phase = 'flat'; this.finishWaking(); }
      return;
    }
    const fx = phase === 'night' ? this.director.night.fx : {};
    const s = this.save.settings;
    const nightNo = phase === 'night' ? this.director.night.night : this.save.night;
    // fades out of sleep / transitions
    this.panes.forEach((pane, i) => {
      if (pane.fade > 0 && !pane.transition) pane.fade = Math.max(0, pane.fade - dt / 1.5);
      const tr = pane.transition;
      const p = this.players[i];
      if (tr && p) {
        tr.t += dt / tr.dur;
        if (tr.t >= 1) this.finishTransition(p, pane);
      }
    });
    // players
    const touchedByPlayer: [Dreamer, Linkable, boolean][] = [];
    for (const p of this.players) {
      const inp = this.input.get(p.device);
      const r = p.tick(dt, inp, fx, s, nightNo);
      for (const l of r.touched) touchedByPlayer.push([p, l, false]);
      if (r.gazeLink && phase === 'night') touchedByPlayer.push([p, r.gazeLink, true]);
      if (r.interact) this.interact(p, r.interact);
      if (phase === 'flat' && this.lying.has(p.slot) && (Math.abs(inp.moveX) + Math.abs(inp.moveY) > 0.5)) { this.lying.delete(p.slot); p.frozen = false; p.pitch = 0; }
      // holding hands: both hold Interact while close
      const partner = this.players.find((q) => q !== p && q.realmKey === p.realmKey && q.position.distanceTo(p.position) < 1.6 && this.input.get(q.device).interact);
      p.holdingHands = inp.interact && partner ? partner.slot : null;
      if (phase === 'night') this.nightChecks(p, inp, dt);
    }
    for (const [p, l, g] of touchedByPlayer) this.handleContact(p, l, g);
    // realms
    const ticked = new Set<Realm>();
    for (const p of this.players) if (p.realm && !ticked.has(p.realm)) ticked.add(p.realm);
    for (const pane of this.panes) if (pane.transition) ticked.add(pane.transition.to);
    if (phase === 'flat') ticked.add(this.flat);
    for (const r of ticked) {
      r.tick(dt);
      r.physics.step();
      const pend = (r as any).pending as { at: number; run: () => void }[] | undefined;
      if (pend && r.dreamers().length) {
        const due = pend.filter((x) => Math.abs(r.time) >= x.at);
        (r as any).pending = pend.filter((x) => Math.abs(r.time) < x.at);
        for (const d of due) d.run();
      }
      const cams = this.players.filter((p) => p.realm === r).map((p) => p.camera);
      const before = r.mutationsThisMinute;
      r.mutate(dt, cams);
      if (r.mutationsThisMinute > before && cams.length) this.achieve('mutation');
    }
    for (const [k, t] of this.phoneListen) if (this.time > t) this.phoneListen.delete(k);
    if (phase === 'night') {
      this.director.tick(dt);
      this.coopChecks(dt);
      if (this.director.night.elapsed >= this.director.night.duration) this.beginWaking();
      if (this.players.every((p) => !p.awake)) this.beginWaking();
    }
  }

  interact(p: Dreamer, l: Linkable) {
    const sp = l.special;
    if (sp?.type === 'phone' || (sp?.type === 'interact' && sp.interact === 'code' && this.phase === 'night')) {
      // answer the phone: whoever answers hears the other dreamers' realms
      this.achieve('phone');
      this.ringPhone(p.realmKey, false);
      this.sfx(this.players.length > 1 ? 'radio' : this.director?.night?.realLife ? 'whale' : 'rain', p.position, p.realmKey, 0.7);
      if (this.players.length > 1) this.phoneListen.set(p.slot, this.time + 12);
      return;
    }
    if (sp?.type !== 'interact' || this.phase !== 'flat') return;
    const s = this.save;
    switch (sp.interact) {
      case 'journal': this.openUI(() => this.ui.journal()); break;
      case 'chart': this.openUI(() => this.ui.chart()); break;
      case 'atlas': this.openUI(() => this.ui.atlas()); break;
      case 'code': this.openUI(() => this.ui.code(s.nights[s.nights.length - 1]?.code ?? '')); break;
      case 'daily': this.openUI(() => this.ui.daily(s.dailyDone === new Date().toISOString().slice(0, 10))); break;
      case 'afterimage': this.openUI(() => this.ui.afterimageList()); break;
      case 'settings': this.openUI(() => this.ui.settings()); break;
    }
  }

  nightChecks(p: Dreamer, inp: PlayerInput, dt: number) {
    const r = p.realm;
    if (!r || p.frozen || !p.awake) return;
    // falling isn't death: you land, softly, in a Deep realm
    if (p.position.y < r.killY) {
      this.achieve('fall');
      const fake = { id: 'fall', kind: 'fall', tags: ['water'] as Tag[], object: new THREE.Object3D(), colliders: [], meshes: [] } as Linkable;
      this.linkPlayer(p, fake, { deep: true, transition: 'melt' });
      return;
    }
    // light has weight: climb to drift Bright
    if (!p.climbPushed && p.position.y > p.spawnY + 20) { p.climbPushed = true; this.director.pushRes(p.slot, 'climb'); this.achieve('climb'); }
    if (p.stillTime > 20 && Math.floor((p.stillTime - dt) / 20) !== Math.floor(p.stillTime / 20)) this.director.pushRes(p.slot, 'still');
    if (p.stillTime > 60) this.achieve('still');
    // quiet places: stand still 20 s and a short ambient motif plays
    if (r.quiet && !p.quietDone && p.stillTime > 20 && p.position.distanceTo(r.quiet.pos) < r.quiet.radius + 1) {
      p.quietDone = true;
      this.sfx('quiet', r.quiet.pos, r.key, 1);
      this.achieve('quiet');
      if (!this.save.quietHeard.includes(r.id)) this.save.quietHeard.push(r.id);
      if (DREAM_REALMS.every((x) => this.save.quietHeard.includes(x))) this.achieve('quiet-all');
    }
    if (p.grounded && p.velocity.lengthSq() > 1 && Math.floor(this.time * 2.2) !== Math.floor((this.time - dt) * 2.2)) this.sfx('step', p.position, r.key, 0.5);
    // watcher near-miss
    for (const e of r.entities) if (e.kind === 'watcher') { const d = e.object.position.distanceTo(p.position); if (d < 3 && d > 0.8) this.achieve('watcher-avoid'); if (d < 25) this.atlas('entity:watcher'); }
    for (const e of r.entities) if (['drifters', 'bookfish', 'moths', 'train'].includes(e.kind)) this.atlas('entity:' + (e.kind === 'train' ? 'conductor' : e.kind));
    if (r.entities.some((e) => e.kind === 'lanternwoman' && e.object.position.distanceTo(p.position) < 10)) this.achieve('woman');
  }

  coopChecks(dt: number) {
    const ps = this.players;
    // reunions: two dreamers apart for 2+ minutes meet, and the realm blooms
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      const together = a.realmKey === b.realmKey && a.position.distanceTo(b.position) < 12;
      const key = `${a.slot}-${b.slot}`;
      const apart = (this as any)['apart' + key] ?? 0;
      if (together) {
        if (apart > 120) {
          this.director.pushRes(a.slot, 'reunion'); this.director.pushRes(b.slot, 'reunion');
          this.sfx('reunion', a.position, a.realmKey, 1); this.achieve('reunion');
          if (a.realm) { a.realm.overrides.bloom = (a.realm.env.bloom ?? 1) + 1; setTimeout(() => delete a.realm?.overrides.bloom, 5000); }
        }
        (this as any)['apart' + key] = 0;
      } else (this as any)['apart' + key] = apart + dt;
    }
    // echoes: a dreamer in another realm flickers in thin spots of yours
    for (const p of ps) {
      const r = p.realm;
      if (!r) continue;
      const others = ps.filter((q) => q.realmKey !== p.realmKey && q.awake);
      let spot: THREE.Vector3 | null = null;
      for (const t of r.thinSpots) if (t.distanceTo(p.position) < 9) { spot = t; break; }
      const key = r.key + ':' + p.slot;
      let ghost = this.echoes.get(key);
      if (spot && others.length) {
        const o = others[Math.floor(this.time / 6) % others.length];
        if (!ghost || ghost.userData.slot !== o.slot) {
          ghost?.parent?.remove(ghost);
          ghost = makeDreamerFigure(r, o.slot, o.profile.dreamer);
          ghost.traverse((x) => x.layers.set(0));
          ghost.userData.slot = o.slot;
          r.dynamic.add(ghost);
          this.echoes.set(key, ghost);
        }
        ghost.position.copy(spot).add(new THREE.Vector3(0.6, 0, 0.6));
        ghost.visible = Math.sin(this.time * 23) > 0.2 && Math.sin(this.time * 3.1) > -0.4;
        this.achieve('echo');
      } else if (ghost) ghost.visible = false;
    }
  }

  // ── rendering ──────────────────────────────────────────────────────────
  private v = new THREE.Vector3();

  render(alpha: number, dt: number) {
    const W = this.renderer.domElement.width, H = this.renderer.domElement.height;
    const s = this.save.settings;
    const n = Math.max(1, this.players.length);
    const targets = this.players.map((p) => (!p.awake ? 0.2 : (this.visionUntil.get(p.slot) ?? 0) > this.time ? 2.2 : p.stillTime > 8 ? 0.7 : 1));
    const rects = this.layout.update(dt, n, targets, s.bubblePanes);
    const nightYear = this.director?.night?.night ?? this.save.night;
    const progress = this.phase === 'night' || this.phase === 'waking' ? this.director.progress : 0.85;
    const listeners: PaneListener[] = [];
    const lightScale = (n === 1 ? 1 : n === 2 ? 0.75 : 0.5) * s.lightScale * (s.quality === 'low' ? 0.75 : 1);
    if (this.phase === 'title') { this.renderTitle(); return; }
    this.compositor.time.value = this.time;
    this.compositor.mandala.value = n === 3 ? 1 : 0;
    this.compositor.seam.value = n > 1 ? 1 : 0;
    this.compositor.screen.value.set(W, H);
    for (let i = 0; i < 4; i++) this.compositor.active[i].value = 0;
    this.players.forEach((p, i) => {
      const pane = this.panes[i];
      const rect = rects[i];
      pane.rect = rect;
      const pw = Math.max(32, rect.w * W), ph = Math.max(32, rect.h * H);
      pane.post.resize(pw, ph, lightScale, 270);
      const fx = this.phase === 'night' || this.phase === 'waking' ? this.director.night.fx : {};
      p.camera.aspect = pw / ph;
      p.updateCamera(alpha, dt, s, fx, this.time);
      if (this.phase === 'waking') { p.camera.position.y += this.wakeT * 0.5; p.camera.updateMatrixWorld(); }
      const realm = p.realm ?? this.flat;
      // the lo-fi body: low-res scene pass
      G.snap.value.set(pane.post.lowW / 2, pane.post.lowH / 2);
      realm.applyEnv(progress, nightYear);
      this.renderer.setRenderTarget(pane.post.lowA);
      this.renderer.render(realm.scene, p.camera);
      const tr = pane.transition;
      pane.post.u.tActive.value = 0;
      if (tr) {
        tr.cam.aspect = p.camera.aspect;
        tr.cam.fov = p.camera.fov;
        tr.cam.position.set(tr.spawn.x, tr.spawn.y + 1.58 * p.scale, tr.spawn.z);
        tr.cam.rotation.set(0, tr.yaw, 0, 'YXZ');
        tr.cam.updateProjectionMatrix(); tr.cam.updateMatrixWorld();
        tr.to.applyEnv(progress, nightYear);
        this.renderer.setRenderTarget(pane.post.lowB);
        this.renderer.render(tr.to.scene, tr.cam);
        realm.applyEnv(progress, nightYear);
        const e = Math.min(1, tr.t);
        pane.post.u.tProgress.value = e * e * (3 - 2 * e);
        pane.post.u.tKind.value = TRANSITION_INDEX[tr.kind];
        pane.post.u.tActive.value = 1;
      }
      this.applyPost(p, pane, realm, fx);
      const tex = pane.post.composite(this.renderer);
      this.compositor.texNodes[i].value = tex;
      this.compositor.rects[i].value.set(rect.x, rect.y, rect.w, rect.h);
      this.compositor.active[i].value = 1;
      this.compositor.colours[i].value.set(DREAMER_COLOURS[p.slot]);
      this.compositor.asleep[i].value = p.awake ? 0 : 1;
      listeners.push({ x: p.eye.x, y: p.eye.y, z: p.eye.z, yaw: p.yaw, realmKey: realm.key, pan: (rect.x + rect.w / 2) * 2 - 1, weight: n === 1 ? 1 : Math.max(0.3, rect.w * rect.h * 2) * (this.phoneListen.size && !this.phoneListen.has(p.slot) ? 1.6 : 1), root: realm.meta.root });
    });
    this.compositor.render(this.renderer);
    this.audio.setListeners(listeners);
    const res = this.phase === 'night' ? this.director.night.resonance[0] : this.save.resonance;
    this.audio.setWeights(quadrantWeights(res ?? { x: 0, y: 0 }));
    this.scoreFrames(dt);
  }

  renderTitle() {
    // a slow drift through the Lantern Flat behind the title
    const cam = (this as any).titleCam ?? ((this as any).titleCam = new THREE.PerspectiveCamera(70, 1, 0.05, 2000));
    const W = this.renderer.domElement.width, H = this.renderer.domElement.height;
    if (!this.panes.length) this.panes.push(this.makePane());
    const pane = this.panes[0];
    pane.post.resize(W, H, 0.75, 270);
    cam.aspect = W / H; cam.position.set(Math.sin(this.time * 0.1) * 1.2, 1.4, 1.5); cam.lookAt(0, 1.5, -3.5); cam.updateProjectionMatrix();
    this.time += 1 / 60;
    this.flat.time = this.time;
    this.flat.applyEnv(0.85, this.save.night);
    G.snap.value.set(pane.post.lowW / 2, pane.post.lowH / 2);
    this.renderer.setRenderTarget(pane.post.lowA);
    this.renderer.render(this.flat.scene, cam);
    pane.post.u.tActive.value = 0;
    this.applyPost(null, pane, this.flat, {});
    this.compositor.texNodes[0].value = pane.post.composite(this.renderer);
    this.compositor.rects[0].value.set(0, 0, 1, 1);
    for (let i = 0; i < 4; i++) this.compositor.active[i].value = i === 0 ? 1 : 0;
    this.compositor.seam.value = 0;
    this.compositor.render(this.renderer);
  }

  applyPost(p: Dreamer | null, pane: Pane, realm: Realm, fx: any) {
    const u = pane.post.u;
    const s = this.save.settings;
    const e = { ...realm.env, ...realm.overrides };
    const gentle = s.gentle || !!p?.profile.gentle;
    const mundane = realm.meta.mundane;
    u.time.value = this.time;
    u.bloomStrength.value = e.bloom * (fx.bloom ?? 1) * (mundane ? 0.8 : 1);
    u.bloomThreshold.value = e.bloomThreshold;
    u.godrays.value = e.godrays;
    if (p) {
      this.v.set(...realm.env.sunDir).normalize().multiplyScalar(1000).add(p.camera.position).project(p.camera);
      const behind = this.v.z > 1;
      u.sunScreen.value.set(this.v.x * 0.5 + 0.5, 0.5 - this.v.y * 0.5);
      if (behind) u.godrays.value = 0;
    }
    const lens = pane.lens;
    u.glyph.value = Math.max(e.glyph, fx.glyph ?? 0, lens === 'glyph' || lens === 'braille' || lens === 'blocks' ? 1 : 0);
    u.glyphCell.value = e.glyphCell ?? 8;
    u.glyphRow.value = lens === 'braille' ? 1 : lens === 'blocks' ? 2 : fx.glyphRow ?? s.glyphRamp;
    u.trail.value = s.trails ? (fx.trails ?? e.trail) * (gentle ? 0.25 : 1) : 0;
    u.kaleido.value = Math.max(e.kaleido, fx.kaleido ?? 0, lens === 'kaleido' ? 0.9 : 0) * (s.breathing && !gentle ? 1 : 0.15);
    u.fringe.value = gentle ? 0.3 : e.fringe;
    u.vignette.value = e.vignette;
    u.grade.value = e.grade;
    const res = p && this.phase === 'night' ? this.director.night.resonance[this.players.indexOf(p)] ?? this.save.resonance : this.save.resonance;
    const w = quadrantWeights(res);
    u.gradeW.value.set(w.halo, w.bloom, w.hush, w.undertow);
    const nightHue = this.director?.night ? ((this.director.night.seed % 1000) / 1000 - 0.5) * 0.4 : 0;
    u.hueRot.value = nightHue + (realm.overrides.hueShift ?? 0) + (fx.hueSpin ? this.time * 0.15 : 0);
    u.mirror.value = fx.mirror ? 1 : 0;
    u.tape.value = Math.max(e.tape, fx.tape ?? 0, lens === 'tape' ? 0.8 : 0);
    u.wobble.value = Math.max(e.wobble, fx.wobble ?? 0) * (gentle ? 0.3 : 1);
    u.mono.value = Math.max(fx.mono ? 1 : 0, realm.overrides.mono ?? 0, lens === 'mono' ? 1 : 0);
    u.invert.value = fx.invert ? 1 : 0;
    u.staticAmt.value = this.audio.duck.get(realm.key) ?? 0;
    u.gentle.value = gentle ? 1 : 0;
    u.flashCap.value = gentle ? 0.15 : 0.6;
    u.levels.value = e.levels;
    if (lens === 'dream') { u.trail.value = 0.9; u.kaleido.value = 0.6; u.bloomStrength.value *= 1.6; }
    u.fadeAmount.value = pane.fade;
    u.fadeColor.value.copy(pane.fadeColor);
  }

  /** Once per second, score a pane's frame; keep the most striking as its polaroid. */
  scoreFrames(dt: number) {
    if (this.phase !== 'night') return;
    this.scoreClock += dt;
    if (this.scoreClock < 1) return;
    this.scoreClock = 0;
    const i = this.scorePane++ % Math.max(1, this.players.length);
    const pane = this.panes[i];
    const p = this.players[i];
    if (!pane || !p || pane.transition || pane.fade > 0.2 || !p.awake) return;
    const tex = pane.post.output.texture;
    const aspect = pane.post.outW / pane.post.outH;
    this.snap.score(this.renderer, tex).then(async (px) => {
      const sc = scoreFrame(px, pane.prevFrame);
      pane.prevFrame = px.slice();
      if (sc > pane.bestScore) {
        pane.bestScore = sc;
        const img = await this.snap.capture(this.renderer, tex, aspect);
        pane.polaroid = imageDataToDataURL(img, this.backend === 'webgl');
      }
    }).catch(() => {});
  }
}

// lazy requires (keep the main graph tidy)
import * as LAWS_MOD from './data/laws';
import * as EVENTS_MOD from './data/events';
function require_laws() { return LAWS_MOD; }
function require_events() { return EVENTS_MOD; }
void rebuildGlyphAtlas; void depthOf;
