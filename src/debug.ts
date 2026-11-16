// F1 dev panel (dev builds only): sliders for shader uniforms, the chart,
// realm jumps, laws, events, Visions and the Watcher.
import { Pane } from 'tweakpane';
import type { Game } from './game';
import { DREAM_REALMS, type RealmId } from './data/types';
import { LAWS, combinedEffects } from './data/laws';
import { VISIONS } from './data/visions';
import { EVENTS } from './data/events';
import { runEvent } from './entities/events';

let pane: any = null;

export function toggleDebug(g: Game) {
  if (pane) { pane.dispose(); pane = null; return; }
  pane = new (Pane as any)({ title: "DMT dev (F1)" });
  const state = { realm: 'stair' as RealmId, x: 0, y: 0, law: LAWS[0].id, vision: VISIONS[0].id, event: EVENTS[0].id, fps: 0 };
  const p = g.players[0];
  const res = g.director?.night?.resonance[0];
  if (res) { state.x = res.x; state.y = res.y; }
  const f1 = pane.addFolder({ title: 'Resonance' });
  f1.addBinding(state, 'x', { min: -4, max: 4, label: 'still↔alive' }).on('change', () => { if (g.director.night) g.director.night.resonance[0].x = state.x; });
  f1.addBinding(state, 'y', { min: -4, max: 4, label: 'deep↔bright' }).on('change', () => { if (g.director.night) g.director.night.resonance[0].y = state.y; });
  const f2 = pane.addFolder({ title: 'Realms' });
  f2.addBinding(state, 'realm', { options: Object.fromEntries([...DREAM_REALMS, 'threshold', 'orrery', 'chorus'].map((r) => [r, r])) });
  f2.addButton({ title: 'Jump' }).on('click', () => { if (g.phase !== 'night') g.startNight('normal', state.realm); else if (p?.realm) g.linkPlayer(p, { id: 'debug', kind: 'debug', tags: ['light'], object: p.realm.root, colliders: [], meshes: [] } as any, { forced: state.realm }); });
  f2.addButton({ title: 'Wake' }).on('click', () => g.beginWaking());
  const f3 = pane.addFolder({ title: 'Dream' });
  f3.addBinding(state, 'law', { options: Object.fromEntries(LAWS.map((l) => [l.name, l.id])) });
  f3.addButton({ title: 'Toggle law' }).on('click', () => { const n = g.director.night; if (!n) return; n.laws = n.laws.includes(state.law) ? n.laws.filter((l) => l !== state.law) : [...n.laws, state.law]; n.fx = combinedEffects(n.laws); });
  f3.addBinding(state, 'vision', { options: Object.fromEntries(VISIONS.map((v) => [v.name, v.id])) });
  f3.addButton({ title: 'Vision' }).on('click', () => p && g.startVision(p, state.vision));
  f3.addBinding(state, 'event', { options: Object.fromEntries(EVENTS.slice(0, 120).map((e) => [e.text.slice(0, 40), e.id])) });
  f3.addButton({ title: 'Event' }).on('click', () => { const e = EVENTS.find((x) => x.id === state.event); if (e && p?.realm) runEvent(p.realm, e, g); });
  const f4 = pane.addFolder({ title: 'Post (pane 1)' });
  const u = g.panes[0]?.post.u as any;
  if (u) for (const k of ['bloomStrength', 'trail', 'kaleido', 'glyph', 'glyphCell', 'tape', 'wobble', 'grade', 'levels', 'fringe']) {
    const o = { v: u[k].value };
    f4.addBinding(o, 'v', { label: k, min: 0, max: k === 'glyphCell' ? 24 : k === 'levels' ? 16 : 2 }).on('change', () => (u[k].value = o.v));
  }
  pane.addBinding(state, 'fps', { readonly: true, interval: 500 } as any);
  setInterval(() => { const t = g.frameTimes; state.fps = t.length ? Math.round(t.length / t.reduce((a, b) => a + b, 0)) : 0; }, 500);
}
