// The Glyph Suite's style system. Every field is a uniform, so styles blend
// and animate without recompiling. Presets live in data/glyph-styles/*.json.

export type GlyphMode = 'ascii' | 'braille' | 'blocks';
export type BackdropMode = 'blurred' | 'black' | 'original' | 'transparent';
export type ColourMode = 'full' | 'mono' | 'duotone' | 'palette' | 'phosphor';

export interface GlyphStyle {
  name?: string;
  mode: GlyphMode;
  font: string;
  ramp: string;
  cellPx: number;
  depthCells: boolean;
  depthNear: number;
  depthFar: number;
  cellSizes: [number, number, number];
  edgeThreshold: number;
  edgeDepthWeight: number;
  edgeNormalWeight: number;
  edgeLumaWeight: number;
  edgeThickness: 1 | 2;
  backdropMode: BackdropMode;
  backdropStrength: number;
  backdropBlur: number;
  colourMode: ColourMode;
  colourSaturation: number;
  colourBoost: number;
  black: number;
  white: number;
  gamma: number;
  contrast: number;
  coverage: number;
  invert: boolean;
  shadowLift: boolean;
  hysteresis: number;
  holdFrames: number;
  wind: { speed: number; dir: [number, number] } | null;
  ripples: boolean;
  gazeSettle: boolean;
  paper: { aberration: number; flutedGlass: number };
  glyphOpacity: number;
  /** extras (optional): phosphor tint, mono/duotone keys, scanlines */
  phosphor?: 'green' | 'amber';
  scanlines?: number;
  inkColour?: string;
}

export const MODES: GlyphMode[] = ['ascii', 'braille', 'blocks'];
export const BACKDROPS: BackdropMode[] = ['blurred', 'black', 'original', 'transparent'];
export const COLOURS: ColourMode[] = ['full', 'mono', 'duotone', 'palette', 'phosphor'];

export const DEFAULT_STYLE: GlyphStyle = {
  mode: 'ascii', font: 'VT323', ramp: ' .:-=+*#%@', cellPx: 8, depthCells: true, depthNear: 6, depthFar: 40,
  cellSizes: [12, 8, 6], edgeThreshold: 0.35, edgeDepthWeight: 1, edgeNormalWeight: 0.8, edgeLumaWeight: 0.6, edgeThickness: 1,
  backdropMode: 'blurred', backdropStrength: 0.45, backdropBlur: 2, colourMode: 'full', colourSaturation: 1.1, colourBoost: 1.35,
  black: 0.04, white: 0.9, gamma: 0.9, contrast: 0.4, coverage: 1, invert: false, shadowLift: true, hysteresis: 0.06, holdFrames: 3,
  wind: null, ripples: true, gazeSettle: true, paper: { aberration: 0, flutedGlass: 0 }, glyphOpacity: 1,
};

// ── JSON Schema (draft-07) for presets, validated by tools/validate-data ──
export const GLYPH_STYLE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'GlyphStyle',
  type: 'object',
  additionalProperties: false,
  required: ['mode', 'font', 'ramp', 'cellPx', 'depthCells', 'depthNear', 'depthFar', 'cellSizes', 'edgeThreshold', 'edgeDepthWeight', 'edgeNormalWeight', 'edgeLumaWeight', 'edgeThickness', 'backdropMode', 'backdropStrength', 'backdropBlur', 'colourMode', 'colourSaturation', 'colourBoost', 'black', 'white', 'gamma', 'contrast', 'coverage', 'invert', 'shadowLift', 'hysteresis', 'holdFrames', 'wind', 'ripples', 'gazeSettle', 'paper', 'glyphOpacity'],
  properties: {
    name: { type: 'string' },
    mode: { enum: MODES },
    font: { type: 'string', minLength: 1 },
    ramp: { type: 'string', minLength: 2 },
    cellPx: { type: 'number', minimum: 3, maximum: 32 },
    depthCells: { type: 'boolean' },
    depthNear: { type: 'number', minimum: 0 },
    depthFar: { type: 'number', minimum: 0 },
    cellSizes: { type: 'array', items: { type: 'number', minimum: 3, maximum: 32 }, minItems: 3, maxItems: 3 },
    edgeThreshold: { type: 'number', minimum: 0, maximum: 4 },
    edgeDepthWeight: { type: 'number', minimum: 0, maximum: 4 },
    edgeNormalWeight: { type: 'number', minimum: 0, maximum: 4 },
    edgeLumaWeight: { type: 'number', minimum: 0, maximum: 4 },
    edgeThickness: { enum: [1, 2] },
    backdropMode: { enum: BACKDROPS },
    backdropStrength: { type: 'number', minimum: 0, maximum: 1 },
    backdropBlur: { type: 'number', minimum: 0, maximum: 16 },
    colourMode: { enum: COLOURS },
    colourSaturation: { type: 'number', minimum: 0, maximum: 3 },
    colourBoost: { type: 'number', minimum: 0, maximum: 4 },
    black: { type: 'number', minimum: 0, maximum: 1 },
    white: { type: 'number', minimum: 0, maximum: 1 },
    gamma: { type: 'number', minimum: 0.1, maximum: 4 },
    contrast: { type: 'number', minimum: 0, maximum: 2 },
    coverage: { type: 'number', minimum: 0, maximum: 1 },
    invert: { type: 'boolean' },
    shadowLift: { type: 'boolean' },
    hysteresis: { type: 'number', minimum: 0, maximum: 1 },
    holdFrames: { type: 'integer', minimum: 0, maximum: 60 },
    wind: { oneOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['speed', 'dir'], properties: { speed: { type: 'number', minimum: 0 }, dir: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } } }] },
    ripples: { type: 'boolean' },
    gazeSettle: { type: 'boolean' },
    paper: { type: 'object', additionalProperties: false, required: ['aberration', 'flutedGlass'], properties: { aberration: { type: 'number', minimum: 0, maximum: 1 }, flutedGlass: { type: 'number', minimum: 0, maximum: 1 } } },
    glyphOpacity: { type: 'number', minimum: 0, maximum: 1 },
    phosphor: { enum: ['green', 'amber'] },
    scanlines: { type: 'number', minimum: 0, maximum: 1 },
    inkColour: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
  },
} as const;

/** A tiny JSON-Schema validator covering the keywords the schema uses. */
export function validate(value: unknown, schema: any = GLYPH_STYLE_SCHEMA, path = '$'): string[] {
  const errs: string[] = [];
  const v = value as any;
  if (schema.oneOf) {
    const ok = schema.oneOf.some((s: any) => validate(value, s, path).length === 0);
    if (!ok) errs.push(`${path}: matches none of oneOf`);
    return errs;
  }
  if (schema.enum && !schema.enum.includes(v)) errs.push(`${path}: ${JSON.stringify(v)} not in ${JSON.stringify(schema.enum)}`);
  const t = schema.type;
  if (t === 'null' && v !== null) errs.push(`${path}: expected null`);
  if (t === 'string') {
    if (typeof v !== 'string') errs.push(`${path}: expected string`);
    else {
      if (schema.minLength && [...v].length < schema.minLength) errs.push(`${path}: too short`);
      if (schema.pattern && !new RegExp(schema.pattern).test(v)) errs.push(`${path}: pattern`);
    }
  }
  if (t === 'number' || t === 'integer') {
    if (typeof v !== 'number' || !isFinite(v)) errs.push(`${path}: expected number`);
    else {
      if (t === 'integer' && !Number.isInteger(v)) errs.push(`${path}: expected integer`);
      if (schema.minimum !== undefined && v < schema.minimum) errs.push(`${path}: < ${schema.minimum}`);
      if (schema.maximum !== undefined && v > schema.maximum) errs.push(`${path}: > ${schema.maximum}`);
    }
  }
  if (t === 'boolean' && typeof v !== 'boolean') errs.push(`${path}: expected boolean`);
  if (t === 'array') {
    if (!Array.isArray(v)) errs.push(`${path}: expected array`);
    else {
      if (schema.minItems !== undefined && v.length < schema.minItems) errs.push(`${path}: too few items`);
      if (schema.maxItems !== undefined && v.length > schema.maxItems) errs.push(`${path}: too many items`);
      if (schema.items) v.forEach((x: any, i: number) => errs.push(...validate(x, schema.items, `${path}[${i}]`)));
    }
  }
  if (t === 'object') {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) { errs.push(`${path}: expected object`); return errs; }
    for (const r of schema.required ?? []) if (!(r in v)) errs.push(`${path}.${r}: required`);
    for (const [k, x] of Object.entries(v)) {
      const ps = schema.properties?.[k];
      if (!ps) { if (schema.additionalProperties === false) errs.push(`${path}.${k}: not allowed`); continue; }
      errs.push(...validate(x, ps, `${path}.${k}`));
    }
  }
  return errs;
}

// ── maths shared with the shaders (mirrored in TSL; unit-tested here) ─────

/** l' = pow(clamp((l − black)/(white − black)), gamma), then an S-curve. */
export function remapBrightness(l: number, black: number, white: number, gamma: number, contrast: number, invert = false): number {
  let x = Math.min(1, Math.max(0, (l - black) / Math.max(1e-4, white - black)));
  x = Math.pow(x, gamma);
  const s = x * x * (3 - 2 * x);
  x = Math.min(1, Math.max(0, x + (s - x) * contrast));
  return invert ? 1 - x : x;
}

/** Stable per-cell hash in [0,1) (same formula as the shader's). */
export function cellHash(cx: number, cy: number): number {
  const v = Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** Coverage: a cell draws a glyph when its stable hash is below coverage. */
export function cellCovered(cx: number, cy: number, coverage: number): boolean {
  return cellHash(cx, cy) < coverage;
}

/**
 * Edge direction from a screen-space gradient (x right, y down). The edge
 * runs perpendicular to the gradient; quantised to 4 bins:
 * 0 '_' horizontal, 1 '\' falling, 2 '|' vertical, 3 '/' rising.
 */
export function edgeBin(gx: number, gy: number): number {
  let a = Math.atan2(gx, -gy); // tangent angle = gradient rotated 90°
  a = ((a % Math.PI) + Math.PI) % Math.PI; // [0, π)
  return Math.round(a / (Math.PI / 4)) % 4;
}
export const EDGE_GLYPHS = ['_', '\\', '|', '/'];

export function rampIndex(l: number, count: number, shadowLift: boolean): number {
  const i = Math.floor(Math.min(0.999, Math.max(0, l)) * count);
  return shadowLift ? Math.max(1, i) : i;
}

/** Interpolate numeric fields; booleans/enums switch at t = 0.5 (the pass crossfades modes itself). */
export function blendStyles(a: GlyphStyle, b: GlyphStyle, t: number): GlyphStyle {
  const k = Math.min(1, Math.max(0, t));
  const lerp = (x: number, y: number) => x + (y - x) * k;
  const pick = <T>(x: T, y: T) => (k < 0.5 ? x : y);
  const out: any = {};
  for (const key of Object.keys({ ...a, ...b }) as (keyof GlyphStyle)[]) {
    const x: any = (a as any)[key], y: any = (b as any)[key];
    if (typeof x === 'number' && typeof y === 'number') out[key] = lerp(x, y);
    else if (Array.isArray(x) && Array.isArray(y)) out[key] = x.map((v: number, i: number) => lerp(v, y[i]));
    else if (key === 'wind') {
      if (x && y) out.wind = { speed: lerp(x.speed, y.speed), dir: [lerp(x.dir[0], y.dir[0]), lerp(x.dir[1], y.dir[1])] };
      else out.wind = pick(x, y);
    } else if (key === 'paper') out.paper = { aberration: lerp(x?.aberration ?? 0, y?.aberration ?? 0), flutedGlass: lerp(x?.flutedGlass ?? 0, y?.flutedGlass ?? 0) };
    else out[key] = pick(x, y);
  }
  out.holdFrames = Math.round(out.holdFrames);
  out.edgeThickness = k < 0.5 ? a.edgeThickness : b.edgeThickness;
  out.cellSizes = out.cellSizes.map((v: number) => Math.round(v));
  out.cellPx = Math.round(out.cellPx);
  return out as GlyphStyle;
}

/** Lucidity link: more lucid = calmer, sharper, fewer scrambles. */
export function lucid(style: GlyphStyle, level: number): GlyphStyle & { scramble: number } {
  const L = Math.max(0, Math.min(3, level));
  return {
    ...style,
    cellPx: Math.max(4, style.cellPx - L),
    cellSizes: style.cellSizes.map((c) => Math.max(4, c - L)) as [number, number, number],
    hysteresis: style.hysteresis * Math.pow(1.5, L),
    scramble: Math.pow(0.5, L),
  };
}

/** Gentle mode: ripples and scrambles off, wind halved, aberration ≤ 0.3. */
export function gentle(style: GlyphStyle): GlyphStyle {
  return {
    ...style,
    ripples: false,
    wind: style.wind ? { ...style.wind, speed: style.wind.speed / 2 } : null,
    paper: { ...style.paper, aberration: Math.min(0.3, style.paper.aberration) },
  };
}

