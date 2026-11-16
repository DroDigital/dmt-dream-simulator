// Generative music that follows the Resonance chart, plus synthesized SFX.
// Everything is made from oscillators and noise, so the game ships no audio
// files; mode, tempo and instrument levels blend continuously by chart position.
import type { Quadrant, Tag } from '../data/types';
import { PCG32 } from '../core/rng';

const MODES: Record<Quadrant, number[]> = {
  halo: [0, 2, 4, 6, 7, 9, 11], // Lydian
  bloom: [0, 2, 4, 5, 7, 9, 10], // Mixolydian
  hush: [0, 2, 3, 5, 7, 9, 10], // Dorian
  undertow: [0, 1, 3, 5, 7, 8, 10], // Phrygian
};
const TEMPO: Record<Quadrant, number> = { halo: 66, bloom: 108, hush: 0, undertow: 90 };
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export interface PaneListener { x: number; y: number; z: number; yaw: number; realmKey: string; pan: number; weight: number; root: number }

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  sfx!: GainNode;
  lowpass!: BiquadFilterNode;
  echo!: DelayNode;
  echoGain!: GainNode;
  noiseBuf!: AudioBuffer;
  drones: { osc: OscillatorNode[]; gain: GainNode; pan: StereoPannerNode; root: number }[] = [];
  weights: Record<Quadrant, number> = { halo: 0.25, bloom: 0.25, hush: 0.25, undertow: 0.25 };
  listeners: PaneListener[] = [];
  theme: number[] = [0, 2, 4, 7];
  nextBeat = 0;
  beat = 0;
  rng = new PCG32(1);
  hush = false;
  duck = new Map<string, number>();
  playing = false;
  roomTone: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  quietUntil = 0;
  vol = { master: 0.8, music: 0.7 };
  private timer: number | null = null;

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = this.vol.master;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.lowpass = ctx.createBiquadFilter(); this.lowpass.type = 'lowpass'; this.lowpass.frequency.value = 18000;
    this.music = ctx.createGain(); this.music.gain.value = this.vol.music;
    this.music.connect(this.lowpass).connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.lowpass);
    this.echo = ctx.createDelay(1.5); this.echo.delayTime.value = 0.42;
    this.echoGain = ctx.createGain(); this.echoGain.gain.value = 0;
    this.sfx.connect(this.echo); this.echo.connect(this.echoGain).connect(this.echo); this.echoGain.connect(this.lowpass);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nextBeat = ctx.currentTime + 0.2;
    this.timer = window.setInterval(() => this.schedule(), 50);
    this.playing = true;
  }

  setVolumes(master: number, music: number) {
    this.vol = { master, music };
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(master, this.ctx.currentTime, 0.1);
    this.music.gain.setTargetAtTime(this.hush ? 0 : music, this.ctx.currentTime, 0.3);
  }

  setNightTheme(seed: number) {
    const r = new PCG32(seed, 0x7);
    const len = r.int(4, 6);
    this.theme = Array.from({ length: len }, () => r.int(0, 6));
    this.rng = new PCG32(seed, 0x9);
  }

  setHush(h: boolean) {
    this.hush = h;
    if (this.ctx) this.music.gain.setTargetAtTime(h ? 0 : this.vol.music, this.ctx.currentTime, 0.5);
  }
  setEcho(on: boolean) { if (this.ctx) this.echoGain.gain.setTargetAtTime(on ? 0.45 : 0, this.ctx.currentTime, 0.3); }

  setWeights(w: Record<Quadrant, number>) { this.weights = w; }

  /** One drone per pane, tuned to that pane's realm root, panned to its side. */
  setListeners(ls: PaneListener[]) {
    this.listeners = ls;
    if (!this.ctx) return;
    const ctx = this.ctx;
    while (this.drones.length < ls.length) {
      const gain = ctx.createGain(); gain.gain.value = 0;
      const pan = ctx.createStereoPanner();
      const osc = [ctx.createOscillator(), ctx.createOscillator(), ctx.createOscillator()];
      osc[0].type = 'sine'; osc[1].type = 'triangle'; osc[2].type = 'sine';
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      osc.forEach((o) => { o.connect(f); o.start(); });
      f.connect(gain).connect(pan).connect(this.music);
      this.drones.push({ osc, gain, pan, root: 0 });
    }
    this.drones.forEach((d, i) => {
      const l = ls[i];
      const t = ctx.currentTime;
      if (!l) { d.gain.gain.setTargetAtTime(0, t, 0.5); return; }
      if (d.root !== l.root) {
        d.root = l.root;
        const f = mtof(l.root - 24);
        d.osc[0].frequency.setTargetAtTime(f, t, 0.8);
        d.osc[1].frequency.setTargetAtTime(f * 1.5 * 1.003, t, 0.8);
        d.osc[2].frequency.setTargetAtTime(f * 2.002, t, 0.8);
      }
      const duck = this.duck.get(l.realmKey) ?? 0;
      d.gain.gain.setTargetAtTime(0.05 * l.weight * (1 - duck * 0.8), t, 0.4);
      d.pan.pan.setTargetAtTime(l.pan * 0.6, t, 0.3);
    });
    // the Watcher: a low-pass closes over the whole mix as he nears
    let maxDuck = 0;
    for (const v of this.duck.values()) maxDuck = Math.max(maxDuck, v);
    this.lowpass.frequency.setTargetAtTime(18000 * Math.pow(1 - maxDuck * 0.97, 3) + 200, ctx.currentTime, 0.2);
  }

  setDuck(realmKey: string, amt: number) { this.duck.set(realmKey, Math.max(0, Math.min(1, amt))); }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || this.hush) return;
    const w = this.weights;
    const tempo = w.halo * TEMPO.halo + w.bloom * TEMPO.bloom + w.undertow * TEMPO.undertow + w.hush * 50;
    const spb = 60 / Math.max(40, tempo) / 2; // eighth notes
    while (this.nextBeat < ctx.currentTime + 0.2) {
      this.playBeat(this.nextBeat, spb);
      const swing = w.halo * 0.15 * (this.beat % 2 ? 1 : -1);
      this.nextBeat += spb * (1 + swing) + w.undertow * (this.beat % 3 === 0 ? spb * 0.25 : 0);
      this.beat++;
    }
  }

  private scaleNote(q: Quadrant, degree: number, root: number, octave = 0) {
    const mode = MODES[q];
    const d = ((degree % 7) + 7) % 7;
    return root + mode[d] + 12 * (octave + Math.floor(degree / 7));
  }

  private dominant(): Quadrant {
    let best: Quadrant = 'halo', bv = -1;
    for (const q of Object.keys(this.weights) as Quadrant[]) if (this.weights[q] > bv) { bv = this.weights[q]; best = q; }
    return best;
  }

  private playBeat(t: number, spb: number) {
    const w = this.weights;
    const root = this.listeners[0]?.root ?? 60;
    const q = this.dominant();
    const r = this.rng;
    const pan = this.listeners[0]?.pan ?? 0;
    // motif: theme fragments placed by chance
    if (r.chance(0.18 + w.bloom * 0.25)) {
      const start = r.int(0, this.theme.length - 1);
      const len = r.int(3, 5);
      for (let i = 0; i < len; i++) {
        const deg = this.theme[(start + i) % this.theme.length];
        const note = this.scaleNote(q, deg, root, 0);
        const tt = t + i * spb * (w.halo > 0.4 ? 2 : 1);
        if (w.halo > 0.25) this.piano(tt, note, 0.12 * w.halo + 0.03, pan);
        if (w.bloom > 0.25) this.mallet(tt, note + 12, 0.1 * w.bloom, pan);
        if (w.undertow > 0.3 && i === 0) this.fmBass(tt, note - 24, 0.14 * w.undertow, spb * 4);
        if (w.hush > 0.3 && r.chance(0.3)) this.bell(tt, note + 12, 0.06 * w.hush, pan);
      }
    }
    if (this.beat % 16 === 0) {
      // a pad chord every bar
      const chord = [0, 2, 4].map((d) => this.scaleNote(q, d + r.int(0, 1), root, -1));
      chord.forEach((n) => this.pad(t, n, 0.04 * (w.halo + w.hush * 0.8 + 0.3), spb * 16, pan));
    }
    if (w.bloom > 0.3 && this.beat % 2 === 0) this.drum(t, this.beat % 8 === 0 ? 90 : 180, 0.12 * w.bloom);
    if (w.undertow > 0.35 && (this.beat % 8 === 0 || this.beat % 8 === 1)) this.heartbeat(t, 0.25 * w.undertow);
    if (w.hush > 0.4 && this.beat % 32 === 0) this.hiss(t, spb * 24, 0.02 * w.hush);
  }

  // ── instruments ──────────────────────────────────────────────────────
  private env(t: number, a: number, d: number, peak: number, dest: AudioNode): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(dest);
    return g;
  }
  private panned(p: number, dest: AudioNode = this.music): AudioNode {
    const sp = this.ctx!.createStereoPanner(); sp.pan.value = Math.max(-1, Math.min(1, p)); sp.connect(dest); return sp;
  }
  private osc(t: number, type: OscillatorType, f: number, dur: number, dest: AudioNode) {
    const o = this.ctx!.createOscillator(); o.type = type; o.frequency.value = f; o.connect(dest); o.start(t); o.stop(t + dur + 0.1); return o;
  }
  piano(t: number, n: number, v: number, pan = 0, dest?: AudioNode) {
    const g = this.env(t, 0.005, 1.6, v, this.panned(pan, dest));
    this.osc(t, 'sine', mtof(n), 1.7, g); this.osc(t, 'triangle', mtof(n) * 2.001, 0.8, this.env(t, 0.005, 0.5, v * 0.3, g));
  }
  mallet(t: number, n: number, v: number, pan = 0) {
    const g = this.env(t, 0.002, 0.45, v, this.panned(pan));
    const car = this.ctx!.createOscillator(); car.frequency.value = mtof(n);
    const mod = this.ctx!.createOscillator(); mod.frequency.value = mtof(n) * 3.5;
    const mg = this.ctx!.createGain(); mg.gain.setValueAtTime(mtof(n) * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.3);
    mod.connect(mg).connect(car.frequency); car.connect(g);
    car.start(t); mod.start(t); car.stop(t + 0.6); mod.stop(t + 0.6);
  }
  bell(t: number, n: number, v: number, pan = 0, dest?: AudioNode) {
    const g = this.env(t, 0.003, 3.5, v, this.panned(pan, dest));
    [1, 2.76, 5.4, 8.93].forEach((r, i) => this.osc(t, 'sine', mtof(n) * r, 3.5, this.env(t, 0.003, 3.5 / (i + 1), 1 / (i + 1), g)));
  }
  pad(t: number, n: number, v: number, dur: number, pan = 0) {
    const f = this.ctx!.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200; f.connect(this.panned(pan));
    const g = this.ctx!.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur); g.connect(f);
    for (const det of [-6, 0, 7]) { const o = this.osc(t, 'sawtooth', mtof(n), dur, g); o.detune.value = det; }
  }
  fmBass(t: number, n: number, v: number, dur: number) {
    const g = this.env(t, 0.01, dur, v, this.music);
    const car = this.ctx!.createOscillator(); car.frequency.value = mtof(n); car.detune.value = -12;
    const mod = this.ctx!.createOscillator(); mod.frequency.value = mtof(n) * 0.5;
    const mg = this.ctx!.createGain(); mg.gain.value = mtof(n) * 1.5;
    mod.connect(mg).connect(car.frequency); car.connect(g); car.start(t); mod.start(t); car.stop(t + dur + 0.1); mod.stop(t + dur + 0.1);
  }
  noise(t: number, dur: number, v: number, type: BiquadFilterType, freq: number, q = 1, dest: AudioNode = this.music, sweepTo?: number) {
    const src = this.ctx!.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx!.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = this.env(t, Math.min(0.02, dur * 0.2), dur, v, dest);
    src.connect(f).connect(g); src.start(t, Math.random()); src.stop(t + dur + 0.1);
  }
  drum(t: number, f: number, v: number) {
    const g = this.env(t, 0.002, 0.25, v, this.music);
    const o = this.osc(t, 'sine', f, 0.3, g); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.2);
    this.noise(t, 0.05, v * 0.4, 'highpass', 3000);
  }
  heartbeat(t: number, v: number, dest: AudioNode = this.music) {
    const g = this.env(t, 0.005, 0.22, v, dest);
    const o = this.osc(t, 'sine', 60, 0.3, g); o.frequency.exponentialRampToValueAtTime(38, t + 0.2);
  }
  hiss(t: number, dur: number, v: number) { this.noise(t, dur, v, 'bandpass', 4000, 0.4); }

  // ── SFX ──────────────────────────────────────────────────────────────
  private spatial(pos?: { x: number; y: number; z: number }, realmKey?: string, gain = 1): { node: AudioNode; v: number } | null {
    if (!this.ctx) return null;
    let best: { v: number; pan: number } | null = null;
    for (const l of this.listeners) {
      if (realmKey && l.realmKey !== realmKey) continue;
      if (!pos) { best = { v: gain * l.weight, pan: l.pan * 0.5 }; break; }
      const dx = pos.x - l.x, dz = pos.z - l.z, dy = pos.y - l.y;
      const d = Math.hypot(dx, dy, dz);
      const v = gain * l.weight / (1 + (d * d) / 40);
      const ang = Math.atan2(dx, -dz) + l.yaw; // listener-relative bearing
      const pan = Math.max(-1, Math.min(1, Math.sin(ang) * 0.8 + l.pan * 0.5));
      if (!best || v > best.v) best = { v, pan };
    }
    if (!best || best.v < 0.003) return null;
    return { node: this.panned(best.pan, this.sfx), v: best.v };
  }

  play(name: string, pos?: { x: number; y: number; z: number }, realmKey?: string, gain = 1) {
    const s = this.spatial(pos, realmKey, gain);
    if (!s || !this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const { node, v } = s;
    const root = this.listeners[0]?.root ?? 60;
    switch (name) {
      case 'link-paper': for (let i = 0; i < 6; i++) this.noise(t + i * 0.03, 0.05, v * 0.25, 'bandpass', 2500 + Math.random() * 3000, 2, node); break;
      case 'link-water': this.noise(t, 0.9, v * 0.3, 'lowpass', 2500, 1, node, 300); break;
      case 'link-glass': [0, 4, 7, 11].forEach((d, i) => this.bell(t + i * 0.06, root + 24 + d, v * 0.12, 0, node)); break;
      case 'link-light': this.pad(t, root + 12, v * 0.1, 1.2); this.pad(t, root + 19, v * 0.08, 1.2); break;
      case 'link-glyph': for (let i = 0; i < 8; i++) this.osc(t + i * 0.04, 'square', 900 + Math.random() * 1400, 0.02, this.env(t + i * 0.04, 0.001, 0.02, v * 0.06, node)); break;
      case 'link-flesh': { const g = this.env(t, 0.05, 0.8, v * 0.3, node); const o = this.osc(t, 'sine', 120, 0.9, g); o.frequency.exponentialRampToValueAtTime(50, t + 0.8); break; }
      case 'link-machine': { const g = this.env(t, 0.01, 0.35, v * 0.12, node); this.osc(t, 'square', 110, 0.4, g); this.osc(t, 'square', 165, 0.4, g); break; }
      case 'phone': {
        // the same two-note ring in every realm, the game's one fixed sound
        for (let i = 0; i < 40; i++) this.osc(t + i * 0.05, 'sine', i % 2 ? 1318.5 : 1046.5, 0.05, this.env(t + i * 0.05, 0.003, 0.045, v * 0.12, node));
        break;
      }
      case 'step': case 'step-glyph': this.noise(t, 0.06, v * (name === 'step' ? 0.08 : 0.05), 'bandpass', name === 'step' ? 700 : 2400, 1.5, node); break;
      case 'mothchord': [0, 4, 7, 11].forEach((d) => { const g = this.env(t, 0.8, 2.5, v * 0.025, node); this.osc(t, 'sine', mtof(root + 12 + d), 3.4, g); }); break;
      case 'piano': [0, 2, 4].forEach((d, i) => this.piano(t + i * 0.45, this.scaleNote('hush', this.theme[i % this.theme.length] + d, root), v * 0.12, 0, node)); break;
      case 'heartbeat': this.heartbeat(t, v * 0.25, node); this.heartbeat(t + 0.22, v * 0.18, node); break;
      case 'bell': this.bell(t, root + 12, v * 0.2, 0, node); break;
      case 'wake': [0, 7, 12, 16].forEach((d, i) => this.bell(t + 1 + i * 0.18, root + 12 + d, v * 0.12, 0, node)); break;
      case 'sleep': this.pad(t, root - 12, v * 0.08, 3); break;
      case 'vision': this.pad(t, root, v * 0.12, 6); this.pad(t, root + 7, v * 0.1, 6); this.bell(t + 0.5, root + 24, v * 0.1, 0, node); break;
      case 'reunion': [0, 4, 7, 12].forEach((d, i) => this.piano(t + i * 0.12, root + 12 + d, v * 0.12, 0, node)); break;
      case 'quiet': this.quietPiece(t, v, node); break;
      case 'chime': [0, 2, 4, 7, 9].forEach((d, i) => this.bell(t + i * 0.3 + Math.random() * 0.1, root + 24 + d, v * 0.06, 0, node)); break;
      case 'clock': this.osc(t, 'square', 2000, 0.01, this.env(t, 0.001, 0.015, v * 0.05, node)); break;
      case 'kettle': this.osc(t, 'sine', 2600, 3, this.env(t, 1.5, 1.5, v * 0.05, node)); break;
      case 'laugh': for (let i = 0; i < 5; i++) this.osc(t + i * 0.16, 'triangle', 380 - i * 20, 0.1, this.env(t + i * 0.16, 0.01, 0.1, v * 0.06, node)); break;
      case 'bark': for (let i = 0; i < 2; i++) this.noise(t + i * 0.35, 0.12, v * 0.2, 'bandpass', 600, 4, node); break;
      case 'applause': for (let i = 0; i < 60; i++) this.noise(t + Math.random() * 2.5, 0.02, v * 0.08, 'bandpass', 2000 + Math.random() * 2000, 2, node); break;
      case 'whale': { const g = this.env(t, 1.5, 3, v * 0.12, node); const o = this.osc(t, 'sine', 180, 4.6, g); o.frequency.linearRampToValueAtTime(320, t + 2); o.frequency.linearRampToValueAtTime(140, t + 4.5); break; }
      case 'horn': this.osc(t, 'sawtooth', 110, 3, this.env(t, 0.4, 2.5, v * 0.04, node)); break;
      case 'choir': [0, 7, 12].forEach((d) => this.pad(t, root + d, v * 0.05, 8)); break;
      case 'gong': this.bell(t, root - 12, v * 0.3, 0, node); break;
      case 'lullaby': [0, 2, 4, 2, 0, -3, 0].forEach((d, i) => this.piano(t + i * 0.5, root + 12 + d, v * 0.08, 0, node)); break;
      case 'radio': this.noise(t, 2, v * 0.08, 'bandpass', 1500, 0.6, node, 800); break;
      case 'crickets': for (let i = 0; i < 30; i++) this.osc(t + i * 0.12, 'sine', 4200, 0.03, this.env(t + i * 0.12, 0.005, 0.03, v * 0.02, node)); break;
      case 'rain': this.noise(t, 4, v * 0.06, 'highpass', 1800, 0.5, node); break;
      case 'breath': this.noise(t, 2.5, v * 0.08, 'lowpass', 400, 1, node, 900); break;
      default: this.bell(t, root + 12, v * 0.08, 0, node);
    }
  }

  linkSound(tags: Tag[], pos?: { x: number; y: number; z: number }, realmKey?: string) {
    this.play('link-' + (tags[0] ?? 'light'), pos, realmKey, 1);
  }

  quietPiece(t: number, v: number, node: AudioNode) {
    if (!this.ctx || this.ctx.currentTime < this.quietUntil) return;
    this.quietUntil = this.ctx.currentTime + 30;
    const root = this.listeners[0]?.root ?? 60;
    const prog = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];
    prog.forEach((ch, i) => ch.forEach((d) => this.pad(t + i * 7, root + d, v * 0.04, 8)));
    for (let i = 0; i < 12; i++) this.piano(t + 1 + i * 2.3, root + 12 + [0, 4, 7, 11, 12, 7][i % 6], v * 0.07, 0, node);
  }

  /** Waking: the Lantern Flat's room tone, a ticking clock and distant traffic. */
  setRoomTone(on: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (on && !this.roomTone) {
      const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 280;
      const gain = this.ctx.createGain(); gain.gain.value = 0; gain.gain.setTargetAtTime(0.05, t, 1);
      src.connect(f).connect(gain).connect(this.master); src.start();
      this.roomTone = { src, gain };
    } else if (!on && this.roomTone) {
      const r = this.roomTone; r.gain.gain.setTargetAtTime(0, t, 0.5); setTimeout(() => r.src.stop(), 2000); this.roomTone = null;
    }
  }

  stop() { if (this.timer) clearInterval(this.timer); this.ctx?.close(); this.ctx = null; }
}
