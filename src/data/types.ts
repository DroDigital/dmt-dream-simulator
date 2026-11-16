export type Tag = 'water' | 'light' | 'paper' | 'glass' | 'flesh' | 'glyph' | 'machine';
export const TAGS: Tag[] = ['water', 'light', 'paper', 'glass', 'flesh', 'glyph', 'machine'];

export type Quadrant = 'halo' | 'bloom' | 'hush' | 'undertow';
export const QUADRANTS: Quadrant[] = ['halo', 'bloom', 'hush', 'undertow'];

export type RealmId =
  | 'flat'
  | 'orchard'
  | 'market'
  | 'cathedral'
  | 'suburb'
  | 'stair'
  | 'metro'
  | 'library'
  | 'static'
  | 'reef'
  | 'veins'
  | 'desert'
  | 'school'
  | 'threshold'
  | 'orrery'
  | 'chorus';

export const DREAM_REALMS: RealmId[] = [
  'orchard', 'market', 'cathedral', 'suburb', 'stair', 'metro',
  'library', 'static', 'reef', 'veins', 'desert', 'school',
];

export type TransitionKind = 'pour' | 'fold' | 'shatter' | 'bloom' | 'dissolve' | 'iris' | 'melt' | 'fade';

export const TAG_TRANSITION: Record<Tag, TransitionKind> = {
  water: 'pour',
  paper: 'fold',
  glass: 'shatter',
  light: 'bloom',
  glyph: 'dissolve',
  flesh: 'melt',
  machine: 'iris',
};

export const TRANSITION_INDEX: Record<TransitionKind, number> = {
  fade: 0, pour: 1, fold: 2, shatter: 3, bloom: 4, dissolve: 5, iris: 6, melt: 7,
};

/** Resonance: x = Still(-4)…Alive(+4), y = Deep(-4)…Bright(+4) */
export interface Resonance { x: number; y: number }

export function quadrantOf(r: Resonance): Quadrant {
  if (r.y >= 0) return r.x <= 0 ? 'halo' : 'bloom';
  return r.x <= 0 ? 'hush' : 'undertow';
}

/** Bilinear quadrant weights so palettes and music blend continuously. */
export function quadrantWeights(r: Resonance): Record<Quadrant, number> {
  const u = Math.min(1, Math.max(0, (r.x + 4) / 8)); // 0 still → 1 alive
  const v = Math.min(1, Math.max(0, (r.y + 4) / 8)); // 0 deep → 1 bright
  // sharpen towards the corners a little
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = s(u), b = s(v);
  return {
    halo: (1 - a) * b,
    bloom: a * b,
    hush: (1 - a) * (1 - b),
    undertow: a * (1 - b),
  };
}
