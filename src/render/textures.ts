import * as THREE from 'three/webgpu';
import { PCG32 } from '../core/rng';
import { hexToRgb, mixHex } from './palettes';

// Every texture is drawn at 128 px and quantised to a 32-colour palette built
// from the realm's key colours, so everything shares one chunky look.

export type TexKind =
  | 'paper' | 'plaster' | 'tile' | 'wood' | 'brick' | 'marble' | 'fabric' | 'stained'
  | 'grass' | 'water' | 'coral' | 'metal' | 'books' | 'glyph' | 'stone' | 'cloud'
  | 'bark' | 'leaf' | 'sand' | 'carpet' | 'wallpaper' | 'screen' | 'flesh' | 'checker'
  | 'lantern' | 'asphalt' | 'roof' | 'window' | 'plain';

export const SIZE = 128;

function build32(palette: string[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  const shades = [0.28, 0.5, 0.72, 0.9, 1.0, 1.15];
  for (const p of palette.slice(0, 5)) {
    const [r, g, b] = hexToRgb(p);
    for (const s of shades) out.push([Math.min(1, r * s), Math.min(1, g * s), Math.min(1, b * s)]);
  }
  out.push([0.06, 0.05, 0.08], [0.97, 0.96, 0.93]);
  return out;
}

export function quantise(ctx: CanvasRenderingContext2D, palette: string[], size = SIZE) {
  const pal = build32(palette).map(([r, g, b]) => [r * 255, g * 255, b * 255]);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const cache = new Map<number, number>();
  for (let i = 0; i < d.length; i += 4) {
    const key = ((d[i] >> 2) << 12) | ((d[i + 1] >> 2) << 6) | (d[i + 2] >> 2);
    let best = cache.get(key);
    if (best === undefined) {
      let bd = 1e9; best = 0;
      for (let k = 0; k < pal.length; k++) {
        const dr = d[i] - pal[k][0], dg = d[i + 1] - pal[k][1], db = d[i + 2] - pal[k][2];
        const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
        if (dist < bd) { bd = dist; best = k; }
      }
      cache.set(key, best);
    }
    d[i] = pal[best][0]; d[i + 1] = pal[best][1]; d[i + 2] = pal[best][2];
  }
  ctx.putImageData(img, 0, 0);
}

function canvas(size = SIZE): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  return [c, ctx];
}

function speckle(ctx: CanvasRenderingContext2D, rng: PCG32, n: number, colours: string[], maxR = 2, alpha = 0.5) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * rng.next();
    ctx.fillStyle = rng.pick(colours);
    const r = rng.range(0.5, maxR);
    ctx.fillRect(rng.next() * SIZE, rng.next() * SIZE, r, r);
  }
  ctx.globalAlpha = 1;
}

const GLYPHS = 'ア イ ウ エ オ カ キ ク ケ コ ∴ ∵ ◇ ○ △ □ ☾ ✶ ᚠ ᚢ ᚦ ᛗ ᛟ ⌘ ¶ § ※ ≈ ∞ λ Ω ψ'.split(' ');

export interface TexParams {
  palette: string[];
  mood: number; // 0..3 texture mood (chart quadrant)
  era: number; // 0 fresh, 1 worn, 2 overgrown, 3 abstract
  seed: number;
}

export function drawTexture(kind: TexKind, p: TexParams): HTMLCanvasElement {
  const [c, ctx] = canvas();
  const rng = new PCG32(p.seed);
  const [c0, c1, c2, c3, c4] = p.palette;
  const m = p.mood;
  const S = SIZE;
  const fill = (col: string) => { ctx.fillStyle = col; ctx.fillRect(0, 0, S, S); };

  switch (kind) {
    case 'plain': fill(c2); speckle(ctx, rng, 200, [c3, c1], 2, 0.15); break;
    case 'paper': {
      fill(mixHex(c3, '#fff6e6', 0.6));
      ctx.strokeStyle = mixHex(c3, c1, 0.3); ctx.lineWidth = 0.6;
      for (let i = 0; i < 140; i++) {
        ctx.globalAlpha = 0.2 + 0.3 * rng.next();
        const x = rng.next() * S, y = rng.next() * S, a = rng.next() * Math.PI;
        const l = rng.range(4, 18);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (m === 1) { ctx.strokeStyle = c1; ctx.globalAlpha = 0.3; for (let y = 8; y < S; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); } ctx.globalAlpha = 1; }
      if (m === 2) { for (let i = 0; i < 6; i++) { ctx.fillStyle = rng.pick([c1, c2, c4]); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(rng.next() * S, rng.next() * S, rng.range(6, 20), 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
      if (m === 3) { ctx.strokeStyle = c0; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(S, S); ctx.moveTo(S, 0); ctx.lineTo(0, S); ctx.stroke(); ctx.globalAlpha = 1; }
      break;
    }
    case 'plaster': case 'wallpaper': {
      fill(c3);
      speckle(ctx, rng, 600, [c2, c0, '#ffffff'], 2, 0.18);
      if (kind === 'wallpaper' || m >= 2) {
        ctx.fillStyle = c1; ctx.globalAlpha = 0.35;
        const step = m === 3 ? 16 : 32;
        for (let y = 0; y < S; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < S; x += step) {
          ctx.beginPath();
          if (m % 2) ctx.arc(x + 8, y + 8, 4, 0, 7); else { ctx.moveTo(x + 8, y + 2); ctx.lineTo(x + 14, y + 8); ctx.lineTo(x + 8, y + 14); ctx.lineTo(x + 2, y + 8); }
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (kind === 'wallpaper') { ctx.fillStyle = c4; ctx.globalAlpha = 0.25; for (let x = 0; x < S; x += 32) ctx.fillRect(x, 0, 3, S); ctx.globalAlpha = 1; }
      break;
    }
    case 'tile': case 'checker': {
      const n = kind === 'checker' ? 4 : [4, 8, 4, 2][m];
      const s = S / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 ? c3 : (kind === 'checker' ? c0 : mixHex(c3, c2, 0.4));
        ctx.fillRect(x * s, y * s, s, s);
      }
      ctx.strokeStyle = c0; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
      for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, S); ctx.moveTo(0, i * s); ctx.lineTo(S, i * s); ctx.stroke(); }
      ctx.globalAlpha = 1;
      break;
    }
    case 'wood': case 'bark': {
      fill(kind === 'bark' ? mixHex(c0, c4, 0.3) : mixHex(c4, '#8a5a3a', 0.5));
      ctx.strokeStyle = kind === 'bark' ? c0 : mixHex('#5a3a2a', c0, 0.4); ctx.lineWidth = 1;
      for (let i = 0; i < 28; i++) {
        ctx.globalAlpha = 0.3 + 0.4 * rng.next();
        const x = rng.next() * S;
        ctx.beginPath();
        for (let y = 0; y <= S; y += 8) ctx.lineTo(x + Math.sin(y * 0.08 + i) * (kind === 'bark' ? 4 : 2), y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (kind === 'wood') { ctx.fillStyle = c0; ctx.globalAlpha = 0.4; for (let y = 0; y < S; y += 32) ctx.fillRect(0, y, S, 1); ctx.globalAlpha = 1; }
      break;
    }
    case 'brick': case 'stone': {
      fill(c0);
      const bh = kind === 'stone' ? 32 : 16, bw = kind === 'stone' ? 42 : 32;
      for (let y = 0; y < S; y += bh) for (let x = ((y / bh) % 2) * (bw / 2) - bw; x < S; x += bw) {
        ctx.fillStyle = mixHex(kind === 'brick' ? c1 : c3, c2, rng.next() * 0.4);
        ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      }
      speckle(ctx, rng, 300, [c0, c3], 2, 0.2);
      break;
    }
    case 'marble': {
      fill(mixHex(c3, '#ffffff', 0.5));
      ctx.strokeStyle = c1; ctx.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) {
        ctx.globalAlpha = 0.25 + 0.3 * rng.next();
        ctx.beginPath(); let x = rng.next() * S, y = 0; ctx.moveTo(x, y);
        while (y < S) { x += rng.range(-6, 6); y += rng.range(4, 10); ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'fabric': case 'carpet': {
      fill(kind === 'carpet' ? c1 : c2);
      ctx.fillStyle = c3; ctx.globalAlpha = 0.3;
      for (let i = 0; i < S; i += 4) { ctx.fillRect(i, 0, 1, S); ctx.fillRect(0, i, S, 1); }
      ctx.globalAlpha = 0.5; ctx.fillStyle = c4;
      if (kind === 'carpet') for (let r = 56; r > 4; r -= 12) { ctx.strokeStyle = r % 24 ? c4 : c0; ctx.beginPath(); ctx.arc(64, 64, r, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
      break;
    }
    case 'stained': {
      fill('#111018');
      const cells = 14 + m * 4;
      const pts = Array.from({ length: cells }, () => [rng.next() * S, rng.next() * S, rng.pick([c1, c2, c3, c4])] as const);
      const img = ctx.getImageData(0, 0, S, S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let b1 = 1e9, b2 = 1e9, bi = 0;
        for (let k = 0; k < pts.length; k++) {
          const dx = Math.min(Math.abs(x - pts[k][0]), S - Math.abs(x - pts[k][0]));
          const dy = Math.min(Math.abs(y - pts[k][1]), S - Math.abs(y - pts[k][1]));
          const d = dx * dx + dy * dy;
          if (d < b1) { b2 = b1; b1 = d; bi = k; } else if (d < b2) b2 = d;
        }
        const edge = Math.sqrt(b2) - Math.sqrt(b1) < 1.6;
        const [r, g, b] = edge ? [0.07, 0.06, 0.09] : hexToRgb(pts[bi][2]);
        const i = (y * S + x) * 4;
        img.data[i] = r * 255; img.data[i + 1] = g * 255; img.data[i + 2] = b * 255; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      break;
    }
    case 'grass': case 'leaf': {
      fill(kind === 'leaf' ? c4 : mixHex(c4, '#5f8f4a', 0.5));
      for (let i = 0; i < 500; i++) {
        ctx.strokeStyle = rng.pick([c2, c4, c0, c3]); ctx.globalAlpha = 0.4;
        const x = rng.next() * S, y = rng.next() * S;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rng.range(-2, 2), y - rng.range(2, 6)); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'water': {
      fill(c2);
      ctx.strokeStyle = c3; ctx.lineWidth = 1.5;
      for (let y = 0; y < S; y += 8) {
        ctx.globalAlpha = 0.3 + 0.3 * rng.next();
        ctx.beginPath();
        for (let x = 0; x <= S; x += 4) ctx.lineTo(x, y + Math.sin(x * 0.2 + y) * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'coral': case 'flesh': {
      fill(kind === 'flesh' ? c1 : c0);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = rng.pick([c1, c2, c3, c4]); ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(rng.next() * S, rng.next() * S, rng.range(2, 10), 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 0.5; ctx.strokeStyle = c3;
      for (let i = 0; i < 10; i++) { ctx.beginPath(); let x = rng.next() * S, y = rng.next() * S; ctx.moveTo(x, y); for (let k = 0; k < 8; k++) { x += rng.range(-8, 8); y += rng.range(-8, 8); ctx.lineTo(x, y); } ctx.stroke(); }
      ctx.globalAlpha = 1;
      break;
    }
    case 'metal': {
      const g = ctx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, c3); g.addColorStop(0.5, c2); g.addColorStop(1, c3);
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = c0; ctx.globalAlpha = 0.5;
      for (let x = 8; x < S; x += 32) for (let y = 8; y < S; y += 32) { ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      break;
    }
    case 'books': {
      fill(c0);
      for (let row = 0; row < 4; row++) {
        let x = 0;
        while (x < S) {
          const w = rng.int(4, 10), h = rng.int(20, 30);
          ctx.fillStyle = rng.pick([c1, c2, c3, c4, mixHex(c1, c4, 0.5)]);
          ctx.fillRect(x, row * 32 + 32 - h, w - 1, h);
          ctx.fillStyle = c3; ctx.globalAlpha = 0.5; ctx.fillRect(x + 1, row * 32 + 32 - h + 4, w - 3, 1); ctx.globalAlpha = 1;
          x += w;
        }
        ctx.fillStyle = mixHex(c0, c3, 0.3); ctx.fillRect(0, row * 32 + 30, S, 2);
      }
      break;
    }
    case 'glyph': case 'screen': {
      fill(kind === 'screen' ? '#08090c' : c0);
      ctx.fillStyle = kind === 'screen' ? c2 : c4;
      ctx.font = '12px monospace'; ctx.textBaseline = 'top';
      for (let y = 0; y < S; y += 12) for (let x = 0; x < S; x += 10) {
        if (rng.chance(0.6)) { ctx.globalAlpha = 0.3 + 0.7 * rng.next(); ctx.fillText(rng.pick(GLYPHS), x, y); }
      }
      ctx.globalAlpha = 1;
      if (kind === 'screen') { ctx.fillStyle = '#000'; ctx.globalAlpha = 0.35; for (let y = 0; y < S; y += 2) ctx.fillRect(0, y, S, 1); ctx.globalAlpha = 1; }
      break;
    }
    case 'cloud': {
      fill(c0 === '#fff6ec' ? c0 : mixHex(c0, '#ffffff', 0.7));
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = rng.pick([c1, c2, c3, '#ffffff']); ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.arc(rng.next() * S, rng.next() * S, rng.range(8, 24), 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'sand': {
      fill(c1);
      ctx.strokeStyle = c3; ctx.globalAlpha = 0.35;
      for (let y = 0; y < S; y += 6) { ctx.beginPath(); for (let x = 0; x <= S; x += 4) ctx.lineTo(x, y + Math.sin(x * 0.1 + y * 0.3) * 3); ctx.stroke(); }
      ctx.globalAlpha = 1; speckle(ctx, rng, 400, [c3, c0], 1.5, 0.3);
      break;
    }
    case 'lantern': {
      const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 80); g.addColorStop(0, '#fff8e0'); g.addColorStop(0.5, c4); g.addColorStop(1, c1);
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = c0; ctx.globalAlpha = 0.4; for (let y = 0; y < S; y += 16) ctx.fillRect(0, y, S, 2); ctx.globalAlpha = 1;
      break;
    }
    case 'asphalt': {
      fill(mixHex(c2, '#303038', 0.7));
      speckle(ctx, rng, 900, [c0, c3, '#55555f'], 1.5, 0.4);
      ctx.fillStyle = mixHex(c3, '#ffffff', 0.5); ctx.globalAlpha = 0.8; ctx.fillRect(62, 0, 4, 48); ctx.fillRect(62, 80, 4, 48); ctx.globalAlpha = 1;
      break;
    }
    case 'roof': {
      fill(c1);
      ctx.fillStyle = mixHex(c1, c0, 0.4);
      for (let y = 0; y < S; y += 12) for (let x = ((y / 12) % 2) * 8; x < S; x += 16) ctx.fillRect(x, y + 9, 15, 3);
      break;
    }
    case 'window': {
      fill(c3);
      ctx.fillStyle = c0;
      ctx.fillRect(16, 16, 96, 96);
      ctx.fillStyle = c4; ctx.globalAlpha = 0.9; ctx.fillRect(22, 22, 40, 40); ctx.fillRect(66, 22, 40, 40); ctx.fillRect(22, 66, 40, 40); ctx.fillRect(66, 66, 40, 40); ctx.globalAlpha = 1;
      break;
    }
  }

  // Eras: fresh, worn, overgrown, abstract.
  if (p.era === 1) {
    speckle(ctx, rng, 700, [c0, '#2a2420'], 3, 0.25);
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#3a3028';
    for (let i = 0; i < 6; i++) ctx.fillRect(rng.next() * S, 0, rng.range(2, 6), S);
    ctx.globalAlpha = 1;
  } else if (p.era === 2) {
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = rng.pick(['#5d8a4a', '#86b25a', '#3d6a3a']); ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.arc(rng.next() * S, S - Math.abs(rng.gaussian()) * 40, rng.range(2, 8), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (p.era === 3) {
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = c4; ctx.globalAlpha = 0.6;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const x = rng.next() * S, y = rng.next() * S, r = rng.range(10, 40);
      if (i % 2) ctx.arc(x, y, r, 0, 7); else ctx.rect(x - r / 2, y - r / 2, r, r);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  quantise(ctx, p.palette);
  return c;
}

export class TextureBank {
  private cache = new Map<string, THREE.Texture>();
  constructor(public params: TexParams) {}
  get(kind: TexKind, variant = 0): THREE.Texture {
    const key = kind + ':' + variant;
    let t = this.cache.get(key);
    if (!t) {
      const c = drawTexture(kind, { ...this.params, seed: (this.params.seed ^ (variant * 7919) ^ kind.length * 104729) >>> 0 });
      t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      this.cache.set(key, t);
    }
    return t;
  }
  dispose() {
    for (const t of this.cache.values()) t.dispose();
    this.cache.clear();
  }
}

let white: THREE.Texture | null = null;
export function whiteTexture(): THREE.Texture {
  if (!white) {
    const d = new Uint8Array([255, 255, 255, 255]);
    white = new THREE.DataTexture(d, 1, 1);
    white.needsUpdate = true;
  }
  return white;
}
