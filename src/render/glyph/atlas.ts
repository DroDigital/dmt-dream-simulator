import * as THREE from 'three/webgpu';
import { MODE_TABLE, EDGE_ROW, ATLAS_ROWS, ATLAS_COLS } from './modes';
import { EDGE_GLYPHS } from './schema';

// Row 0 = fill ramp (ASCII), row 1 = edge glyphs | / _ \ +, row 2 = braille,
// row 3 = blocks. Built at load from a canvas with the chosen font (VT323, OFL).

const PX = 40;

export class GlyphAtlas {
  canvas = document.createElement('canvas');
  texture: THREE.CanvasTexture;
  private rows: { chars: string[]; font: string }[] = [];

  constructor() {
    this.canvas.width = PX * ATLAS_COLS;
    this.canvas.height = PX * ATLAS_ROWS;
    for (let r = 0; r < ATLAS_ROWS; r++) this.rows.push({ chars: [], font: 'VT323' });
    for (const m of Object.values(MODE_TABLE)) this.rows[m.row] = { chars: [...m.ramp], font: m.font };
    // edge set: _ \ | / plus + at corners
    this.rows[EDGE_ROW] = { chars: [...EDGE_GLYPHS, '+'], font: 'VT323' };
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.flipY = false;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
    this.draw();
  }

  /** Replace a mode's row (e.g. a preset's custom ramp or font). */
  setRow(row: number, ramp: string, font?: string) {
    const chars = [...ramp];
    const cur = this.rows[row];
    if (cur && cur.chars.join('') === chars.join('') && (!font || font === cur.font)) return;
    this.rows[row] = { chars, font: font ?? cur?.font ?? 'VT323' };
    this.draw();
  }

  draw() {
    const ctx = this.canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.rows.forEach((row, r) => {
      const isEdge = r === EDGE_ROW;
      ctx.font = `${isEdge ? 40 : r === 0 ? 38 : 34}px ${row.font.includes(',') || row.font.includes('"') ? row.font : `"${row.font}", monospace`}`;
      row.chars.slice(0, ATLAS_COLS).forEach((ch, i) => {
        const x = i * PX + PX / 2, y = r * PX + PX / 2 + 1;
        if (isEdge) {
          // edges are drawn as strokes so they meet their neighbours cleanly
          ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'square';
          ctx.beginPath();
          const h = PX / 2 - 2;
          if (ch === '_') { ctx.moveTo(x - h, y + h * 0.75); ctx.lineTo(x + h, y + h * 0.75); }
          else if (ch === '|') { ctx.moveTo(x, y - h); ctx.lineTo(x, y + h); }
          else if (ch === '/') { ctx.moveTo(x - h, y + h); ctx.lineTo(x + h, y - h); }
          else if (ch === '\\') { ctx.moveTo(x - h, y - h); ctx.lineTo(x + h, y + h); }
          else { ctx.moveTo(x - h, y); ctx.lineTo(x + h, y); ctx.moveTo(x, y - h); ctx.lineTo(x, y + h); }
          ctx.stroke(); ctx.restore();
        } else ctx.fillText(ch, x, y);
      });
    });
    this.texture.needsUpdate = true;
  }
}

let shared: GlyphAtlas | null = null;
export function sharedAtlas(): GlyphAtlas { return (shared ??= new GlyphAtlas()); }
