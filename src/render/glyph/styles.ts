// Glyph styles: the schema and maths live in schema.ts (pure, tool-safe);
// this module adds the bundled presets.
import { DEFAULT_STYLE, type GlyphStyle } from './schema';
export * from './schema';

// presets are bundled from data/glyph-styles/*.json
const files = import.meta.glob('../../../data/glyph-styles/*.json', { eager: true, import: 'default' }) as Record<string, Partial<GlyphStyle>>;
export const PRESETS: Record<string, GlyphStyle> = Object.fromEntries(
  Object.entries(files).map(([path, s]) => {
    const name = path.split('/').pop()!.replace('.json', '');
    return [name, { ...DEFAULT_STYLE, ...s, name } as GlyphStyle];
  }),
);
export function preset(name: string): GlyphStyle { return PRESETS[name] ?? { ...DEFAULT_STYLE, name }; }
