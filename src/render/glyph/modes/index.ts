import { ascii } from './ascii';
import { braille } from './braille';
import { blocks } from './blocks';
import type { GlyphMode } from '../schema';

/** Mode switch table. Add a mode here (and a row in the atlas) to extend the suite. */
export const MODE_TABLE: Record<GlyphMode, { id: GlyphMode; row: number; ramp: string; font: string }> = { ascii, braille, blocks };
export const EDGE_ROW = 1;
export const ATLAS_ROWS = 4;
export const ATLAS_COLS = 10;
