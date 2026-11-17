import type { SaveData, NightRecord } from '../core/save';
import type { Settings, PlayerProfile } from '../core/settings';
import { DREAMERS } from '../core/settings';
import { renderPage, drawChart, exportPage } from '../journal/journal';
import { liveDots } from '../director/resonance';
import { REALMS } from '../data/realms';
import { DREAM_REALMS } from '../data/types';
import { LAWS } from '../data/laws';
import { EVENTS } from '../data/events';
import { VISIONS } from '../data/visions';
import { ACHIEVEMENTS } from '../data/achievements';
import { decodeDreamCode } from '../director/dreamcode';
import { DIARY } from '../data/diary';
import { CREDITS } from '../data/credits';
import { DREAMER_COLOURS } from '../render/palettes';

// Plain DOM overlays: no UI framework. The game has no HUD; these are the
// Journal, the chart, the Atlas and the few menus a dreamer needs.

type Handler = (...a: any[]) => void;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) (e as any)[k] = v;
    else if (k === 'class') e.className = v;
    else if (v !== undefined && v !== false) e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids) e.append(k);
  return e;
}

export class UI {
  layers = new Map<string, HTMLDivElement>();
  open: string | null = null;
  handlers: Record<string, Handler> = {};
  hintEl: HTMLDivElement;

  constructor(public save: () => SaveData) {
    for (const name of ['title', 'warning', 'menu', 'settings', 'journal', 'chart', 'atlas', 'code', 'daily', 'wake', 'photo', 'credits', 'afterimage', 'ending']) {
      const d = el('div', { id: name, class: 'layer' + (['title', 'photo'].includes(name) ? '' : ' veil') });
      document.body.append(d);
      this.layers.set(name, d);
    }
    this.hintEl = el('div', { id: 'hint' });
    document.body.append(this.hintEl);
    const t = this.layers.get('title')!;
    t.append(el('h1', {}, 'Sleep?'), el('div', { class: 'small' }, 'headphones recommended · click, or press any button'));
    t.onclick = () => this.emit('sleep');
  }

  on(name: string, fn: Handler) { this.handlers[name] = fn; }
  emit(name: string, ...a: any[]) { this.handlers[name]?.(...a); }

  show(name: string) {
    for (const [k, l] of this.layers) l.classList.toggle('on', k === name);
    this.open = name;
  }
  hide() { for (const l of this.layers.values()) l.classList.remove('on'); this.open = null; }
  get blocking() { return this.open !== null && this.open !== 'photo'; }

  hint(text: string, ms = 3000) {
    this.hintEl.textContent = text;
    this.hintEl.classList.add('on');
    clearTimeout((this as any)._ht);
    (this as any)._ht = setTimeout(() => this.hintEl.classList.remove('on'), ms);
  }

  private fill(name: string, ...kids: Node[]) {
    const l = this.layers.get(name)!;
    l.replaceChildren(...kids);
    this.show(name);
    return l;
  }

  warning() {
    const s = this.save().settings;
    const gentle = el('input', { type: 'checkbox' }) as HTMLInputElement;
    gentle.checked = s.gentle;
    this.fill('warning', el('div', { class: 'card' },
      el('h2', {}, 'Before you sleep'),
      el('p', {}, 'This game has slowly moving colour, soft flashes of light and screen effects that some people find uncomfortable. A very small number of people may experience seizures when exposed to certain light patterns.'),
      el('p', {}, 'Flashes are limited to three per second and luminance changes are clamped. Gentle mode lowers trails, colour fringing and screen breathing, and swaps flash transitions for slow fades.'),
      el('div', { class: 'row' }, el('label', {}, gentle, 'Gentle mode')),
      el('div', { class: 'row' }, el('button', { class: 'primary', onclick: () => this.emit('warningDone', gentle.checked) }, 'I understand'))));
  }

  menu(inNight: boolean) {
    const s = this.save();
    this.fill('menu', el('div', { class: 'card' },
      el('h2', {}, inNight ? `Night ${s.night}` : 'The Lantern Flat'),
      el('div', { class: 'row' },
        el('button', { class: 'primary', onclick: () => this.emit('resume') }, 'Return'),
        el('button', { onclick: () => this.settings() }, 'Settings'),
        el('button', { onclick: () => this.journal() }, 'Journal'),
        el('button', { onclick: () => this.chart() }, 'Chart'),
        el('button', { onclick: () => this.atlas() }, 'Atlas'),
        el('button', { onclick: () => this.credits() }, 'Credits'),
        inNight ? el('button', { onclick: () => this.emit('wakeNow') }, 'Wake up') : el('span')),
      el('p', { class: 'small' }, 'WASD walk · mouse look · Shift drift · hold Space float · Q/E turn · click interact · F photo · Esc menu · a gamepad joins at the Lantern Flat; hold Start (or Backspace) 2 s to leave')));
  }

  settings() {
    const save = this.save();
    const s = save.settings;
    const set = (k: keyof Settings, v: any) => { (s as any)[k] = v; this.emit('settingsChanged', s); };
    const check = (k: keyof Settings, label: string) => {
      const i = el('input', { type: 'checkbox' }) as HTMLInputElement; i.checked = !!s[k];
      i.onchange = () => set(k, i.checked);
      return el('label', {}, i, label);
    };
    const range = (k: keyof Settings, label: string, min: number, max: number, step: number) => {
      const i = el('input', { type: 'range', min, max, step, value: s[k] as any }) as HTMLInputElement;
      i.oninput = () => set(k, parseFloat(i.value));
      return el('label', {}, label, i);
    };
    const sel = (k: keyof Settings, label: string, opts: [string, any][]) => {
      const i = el('select') as HTMLSelectElement;
      for (const [t, v] of opts) { const o = el('option', { value: String(v) }, t); if (String(s[k]) === String(v)) o.selected = true; i.append(o); }
      i.onchange = () => { const v = opts.find(([, vv]) => String(vv) === i.value)![1]; set(k, v); };
      return el('label', {}, label, i);
    };
    const profiles = save.profiles.map((p: PlayerProfile, i: number) => {
      const name = el('select') as HTMLSelectElement;
      DREAMERS.forEach((d, j) => { const o = el('option', { value: j }, d); if (p.dreamer === j) o.selected = true; name.append(o); });
      name.onchange = () => { p.dreamer = +name.value as any; p.name = DREAMERS[p.dreamer]; this.emit('settingsChanged', s); };
      const sens = el('input', { type: 'range', min: 0.2, max: 3, step: 0.1, value: p.sensitivity }) as HTMLInputElement; sens.oninput = () => { p.sensitivity = +sens.value; this.emit('settingsChanged', s); };
      const fov = el('input', { type: 'range', min: 55, max: 110, step: 1, value: p.fov }) as HTMLInputElement; fov.oninput = () => { p.fov = +fov.value; this.emit('settingsChanged', s); };
      const inv = el('input', { type: 'checkbox' }) as HTMLInputElement; inv.checked = p.invertY; inv.onchange = () => { p.invertY = inv.checked; this.emit('settingsChanged', s); };
      const gen = el('input', { type: 'checkbox' }) as HTMLInputElement; gen.checked = p.gentle; gen.onchange = () => { p.gentle = gen.checked; this.emit('settingsChanged', s); };
      return el('div', { class: 'row' }, el('b', { style: `color:${DREAMER_COLOURS[i]};text-shadow:0 0 2px #000` }, `Dreamer ${i + 1}`), name, el('label', {}, 'look', sens), el('label', {}, 'fov', fov), el('label', {}, inv, 'invert'), el('label', {}, gen, 'gentle'));
    });
    this.fill('settings', el('div', { class: 'card' },
      el('h2', {}, 'Settings'),
      el('h3', {}, 'Comfort'),
      el('div', { class: 'row' }, check('gentle', 'Gentle mode (photosensitivity)'), check('breathing', 'Screen breathing'), check('roll', 'Camera roll'), check('instantLinks', 'Instant links (hard fade)'), check('colourBlind', 'Colour-blind palettes')),
      el('h3', {}, 'Picture'),
      el('div', { class: 'row' }, check('trails', 'Feedback trails'), sel('quality', 'Quality', [['High', 'high'], ['Low', 'low']]), sel('fpsCap', 'FPS cap', [['30', 30], ['60', 60], ['Unlocked', 0]]), range('lightScale', 'Light layer resolution', 0.5, 1, 0.05), sel('renderer', 'Renderer', [['WebGPU (auto)', 'auto'], ['WebGL 2', 'webgl']]), sel('glyphRamp', 'Glyph set', [['ASCII', 0], ['Braille', 1], ['Blocks', 2]])),
      el('h3', {}, 'Sound'),
      el('div', { class: 'row' }, range('volume', 'Volume', 0, 1, 0.05), range('music', 'Music', 0, 1, 0.05)),
      el('h3', {}, 'Together'),
      el('div', { class: 'row' }, check('bubblePanes', 'Bubble panes')),
      ...profiles,
      el('h3', {}, 'Calendar'),
      el('div', { class: 'row' }, range('lanternPartyMonth', 'Lantern party month', 1, 12, 1), range('lanternPartyDay', 'day', 1, 31, 1)),
      el('h3', {}, 'Testing'),
      el('div', { class: 'row' }, check('shortNights', 'Short nights (45 s)')),
      el('div', { class: 'row' }, el('button', { class: 'primary', onclick: () => this.emit('resume') }, 'Done'), el('button', { onclick: () => { if (confirm('Forget every night and start a new dream?')) this.emit('wipe'); } }, 'Forget everything'))));
  }

  async journal(focus?: number) {
    const s = this.save();
    const recs = s.nights;
    const holder = el('div', { class: 'pages' });
    const list = el('div', { class: 'nightlist' });
    const show = async (rec: NightRecord) => {
      const c = await renderPage(rec, rec.dots.map((d) => s.profiles[d.slot]?.name ?? ''));
      holder.replaceChildren(c);
      actions.replaceChildren(
        el('button', { onclick: () => { exportPage(rec, rec.dots.map((d) => s.profiles[d.slot]?.name ?? '')); this.emit('achieve', 'export'); } }, 'Export PNG'),
        el('span', { class: 'mono' }, rec.code),
        s.night >= 20 || s.cycle > 1 ? el('button', { onclick: () => this.emit('afterimage', rec), disabled: rec.erased || undefined }, rec.erased ? 'Erased' : 'Afterimage') : el('span'),
      );
    };
    const actions = el('div', { class: 'row' });
    recs.forEach((r) => list.append(el('button', { onclick: () => show(r) }, String(r.night) + (r.mode !== 'normal' ? '*' : ''))));
    this.fill('journal', el('div', { class: 'card' }, el('h2', {}, 'Dream Journal'), recs.length ? list : el('p', {}, 'Nothing written yet. Lie down on the futon.'), holder, actions, el('div', { class: 'row' }, el('button', { class: 'primary', onclick: () => this.emit('resume') }, 'Close'))));
    const last = focus !== undefined ? recs.find((r) => r.night === focus) : recs[recs.length - 1];
    if (last) await show(last);
  }

  chart(live?: { x: number; y: number }[]) {
    const s = this.save();
    const c = el('canvas', { width: 520, height: 560 }) as HTMLCanvasElement;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#f4ead4'; ctx.fillRect(0, 0, 520, 560);
    const now = s.night + (s.cycle - 1) * 365;
    const dots = liveDots(s.dots, now).map((d) => ({ x: d.x, y: d.y, colour: '#7a3a4a', alpha: 1 - (now - d.night) / 60 }));
    if (live) live.forEach((r, i) => dots.push({ x: r.x, y: r.y, colour: DREAMER_COLOURS[i], alpha: 1 }));
    drawChart(ctx, 60, 50, 420, dots, 3);
    this.fill('chart', el('div', { class: 'card' }, el('h2', {}, 'Resonance'), c, el('p', {}, 'Dots fade after sixty nights.'), el('div', { class: 'row' }, el('button', { class: 'primary', onclick: () => this.emit('resume') }, 'Close'))));
  }

  atlas() {
    const s = this.save();
    const has = new Set(s.atlas);
    const cell = (key: string, label: string) => el('div', { class: has.has(key) ? 'found' : 'hidden' }, label);
    const realms = DREAM_REALMS.flatMap((r) => [0, 1, 2, 3].flatMap((e) => [0, 1, 2, 3].map((m) => cell(`realm:${r}:e${e}:m${m}`, `${REALMS[r].name} · ${['fresh', 'worn', 'overgrown', 'abstract'][e]} · ${['halo', 'bloom', 'hush', 'undertow'][m]}`))));
    const entities = ['lanternfolk', 'watcher', 'lanternwoman', 'conductor', 'drifters', 'bookfish', 'moths', 'whale', 'kite'].map((e) => cell('entity:' + e, e));
    const laws = LAWS.map((l) => el('div', { class: s.lawsSeen.includes(l.id) ? 'found' : 'hidden' }, l.name));
    const visions = VISIONS.map((v) => el('div', { class: s.visionsSeen.includes(v.id) ? 'found' : 'hidden' }, v.name));
    const events = EVENTS.map((e) => el('div', { class: s.eventLastSeen[e.id] !== undefined ? 'found' : 'hidden' }, e.text));
    const ach = ACHIEVEMENTS.map((a) => el('div', { class: s.achievements.includes(a.id) ? 'found' : 'hidden', title: a.desc }, a.name));
    const found = has.size + s.lawsSeen.length + s.visionsSeen.length + Object.keys(s.eventLastSeen).length;
    const total = realms.length + entities.length + laws.length + visions.length + events.length;
    this.fill('atlas', el('div', { class: 'card' },
      el('h2', {}, `Dream Atlas · ${found} / ${total}`),
      el('h3', {}, 'Realms'), el('div', { class: 'atlas' }, ...realms),
      el('h3', {}, 'Entities'), el('div', { class: 'atlas' }, ...entities),
      el('h3', {}, 'Dream Laws'), el('div', { class: 'atlas' }, ...laws),
      el('h3', {}, 'Visions'), el('div', { class: 'atlas' }, ...visions),
      el('h3', {}, 'Events'), el('div', { class: 'atlas' }, ...events),
      el('h3', {}, `Achievements · ${s.achievements.length} / ${ACHIEVEMENTS.length}`), el('div', { class: 'atlas' }, ...ach),
      el('div', { class: 'row' }, el('button', { class: 'primary', onclick: () => this.emit('resume') }, 'Close'))));
  }

  code(current: string) {
    const input = el('input', { type: 'text', maxlength: 14, placeholder: 'XXXXXXXXXXXX' }) as HTMLInputElement;
    const msg = el('p', {}, '');
    this.fill('code', el('div', { class: 'card' },
      el('h2', {}, 'Dream codes'),
      el('p', {}, 'Every night has a twelve-character code. Dial one to dream it again, or share it. It does not advance the night count.'),
      current ? el('p', {}, 'Last night: ', el('span', { class: 'mono' }, current)) : el('span'),
      el('div', { class: 'row' }, input, el('button', { class: 'primary', onclick: () => { if (decodeDreamCode(input.value)) this.emit('dreamCode', input.value); else msg.textContent = 'The line is silent. That code does not exist.'; } }, 'Dream it')),
      msg, el('div', { class: 'row' }, el('button', { onclick: () => this.emit('resume') }, 'Hang up'))));
    setTimeout(() => input.focus(), 50);
  }

  daily(done: boolean) {
    this.fill('daily', el('div', { class: 'card' },
      el('h2', {}, 'The Daily Dream'),
      el('p', {}, 'One dream per day, the same for everyone. Share the journal page; there are no leaderboards.'),
      done ? el('p', {}, 'You have already dreamed today’s dream.') : el('span'),
      el('div', { class: 'row' }, el('button', { class: 'primary', onclick: () => this.emit('daily') }, 'Dream today’s dream'), el('button', { onclick: () => this.emit('resume') }, 'Not now'))));
  }

  afterimageList() {
    const s = this.save();
    const list = el('div', { class: 'nightlist' });
    s.nights.filter((n) => n.mode === 'normal').forEach((r) => list.append(el('button', { disabled: r.erased || undefined, onclick: () => this.emit('afterimage', r) }, String(r.night))));
    this.fill('afterimage', el('div', { class: 'card' }, el('h2', {}, 'Afterimage'),
      el('p', {}, s.night < 20 && s.cycle === 1 ? 'The mirror is still fogged. (Night 20)' : 'Replay a night from its seed. Take the same links and you get the same dream; deviate and it branches.'),
      s.night >= 20 || s.cycle > 1 ? list : el('span'),
      el('div', { class: 'row' }, el('button', { onclick: () => this.emit('resume') }, 'Close'))));
  }

  async wake(rec: NightRecord, names: string[], newAch: string[]) {
    const c = await renderPage(rec, names);
    const frag = DIARY[rec.diary];
    this.fill('wake', el('div', { class: 'card' },
      el('div', { class: 'pages' }, c),
      frag ? el('p', {}, el('i', {}, '“' + frag.text + '”')) : el('span'),
      newAch.length ? el('p', {}, '✶ ' + newAch.map((a) => ACHIEVEMENTS.find((x) => x.id === a)?.name ?? a).join(' · ')) : el('span'),
      el('div', { class: 'row', style: 'justify-content:center' },
        el('button', { class: 'primary', onclick: () => this.emit('resume') }, 'Get up'),
        el('button', { onclick: () => exportPage(rec, names) }, 'Export page'))));
  }

  photo(night: number, presets: string[] = []) {
    const lenses = night >= 50;
    const lens = el('select') as HTMLSelectElement;
    const opts = ['none', ...(lenses ? ['tape', 'kaleido', 'mono', 'dream', ...presets] : ['glyph'])];
    opts.forEach((l) => lens.append(el('option', { value: l }, l)));
    lens.onchange = () => this.emit('photoLens', lens.value);
    const slider = (label: string, key: string, min: number, max: number, step: number, val: number) => {
      const i = el('input', { type: 'range', min, max, step, value: val }) as HTMLInputElement;
      i.oninput = () => this.emit('photoStyle', key === 'cellPx' ? { cellPx: +i.value, cellSizes: [+i.value + 4, +i.value, Math.max(4, +i.value - 2)] } : { [key]: +i.value });
      return el('label', {}, label, i);
    };
    this.fill('photo', el('div', { class: 'bar' }, el('span', {}, 'photo mode'), el('label', {}, lenses ? 'lens' : 'filter', lens),
      slider('coverage', 'coverage', 0, 1, 0.05, 1), slider('contrast', 'contrast', 0, 2, 0.05, 0.4), slider('cell', 'cellPx', 4, 20, 1, 8),
      el('button', { onclick: () => this.emit('photoShoot') }, 'Take photo'), el('button', { onclick: () => this.emit('photoExit') }, 'Leave (F)')));
  }

  credits() {
    this.fill('credits', el('div', { class: 'card' }, el('h2', {}, 'Credits'), el('div', { class: 'cols' }, ...CREDITS.map((c) => el('p', {}, el('b', {}, c.what), el('br'), c.who, el('br'), el('i', {}, c.licence)))),
      el('div', { class: 'row' }, el('button', { class: 'primary', onclick: () => this.emit('resume') }, 'Close'))));
  }

  ending() {
    this.fill('ending', el('div', { class: 'card', style: 'text-align:center' }, el('h2', {}, 'The Threshold'),
      el('p', {}, 'Three hundred and sixty-five nights. The mandala closes.'), el('p', {}, el('i', {}, 'and then I was awake.')),
      el('div', { class: 'row', style: 'justify-content:center' }, el('button', { class: 'primary', onclick: () => this.emit('newCycle') }, 'Dream again (New Dream+)'), el('button', { onclick: () => this.emit('endless') }, 'Endless dreaming'))));
  }
}
