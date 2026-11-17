import type { NightRecord } from '../core/save';
import { DIARY } from '../data/diary';
import { LAWS } from '../data/laws';
import { EVENTS } from '../data/events';
import { REALMS } from '../data/realms';

// The Dream Journal: a polaroid of the night's most striking frame, a 3-line
// poem, the chart dot and the night number. Pages export as PNG.

/** Score a 64×36 RGBA frame for contrast, saturation and motion. */
export function scoreFrame(px: Uint8Array, prev: Uint8Array | null): number {
  let sum = 0, sum2 = 0, sat = 0, motion = 0;
  const n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    sum += l; sum2 += l * l;
    sat += Math.max(r, g, b) - Math.min(r, g, b);
    if (prev) motion += Math.abs(px[i] - prev[i]) / 255;
  }
  const mean = sum / n;
  const contrast = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  const exposure = 1 - Math.abs(mean - 0.45) * 1.4;
  return contrast * 2 + (sat / n) * 1.2 + Math.min(0.3, (motion / n) * 3) + exposure * 0.5;
}

export function imageDataToDataURL(img: ImageData, flipY: boolean): string {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d')!;
  if (flipY) {
    const t = document.createElement('canvas'); t.width = img.width; t.height = img.height;
    t.getContext('2d')!.putImageData(img, 0, 0);
    ctx.translate(0, img.height); ctx.scale(1, -1); ctx.drawImage(t, 0, 0);
  } else ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/jpeg', 0.82);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

const PAPER = '#f4ead4';
const INK = '#3a2c2a';

function paperTexture(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, h);
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  ctx.strokeStyle = '#d8c8a8';
  for (let i = 0; i < 260; i++) {
    ctx.globalAlpha = 0.12 + rnd() * 0.15;
    const x = rnd() * w, y = rnd() * h, a = rnd() * Math.PI;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(90,60,30,0.18)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

function wobblyLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, seed: number) {
  ctx.beginPath(); ctx.moveTo(x0, y0);
  const n = 8;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const j = Math.sin(seed + i * 2.3) * 1.2;
    ctx.lineTo(x0 + (x1 - x0) * t + j, y0 + (y1 - y0) * t - j);
  }
  ctx.stroke();
}

/** Draw a hand-drawn chart with this night's dot(s). */
export function drawChart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dots: { x: number; y: number; colour: string; alpha?: number }[], seed = 1) {
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
  const cell = size / 9;
  for (let i = 0; i <= 9; i++) {
    ctx.globalAlpha = i === 0 || i === 9 || i === 4.5 ? 0.9 : 0.25;
    wobblyLine(ctx, x, y + i * cell, x + size, y + i * cell, seed + i);
    wobblyLine(ctx, x + i * cell, y, x + i * cell, y + size, seed + i * 7);
  }
  ctx.globalAlpha = 0.8; ctx.lineWidth = 1.6;
  wobblyLine(ctx, x + size / 2, y - 6, x + size / 2, y + size + 6, seed + 99);
  wobblyLine(ctx, x - 6, y + size / 2, x + size + 6, y + size / 2, seed + 98);
  ctx.globalAlpha = 1; ctx.fillStyle = INK; ctx.font = `italic ${Math.round(size / 13)}px "Cormorant Garamond", serif`; ctx.textAlign = 'center';
  ctx.fillText('bright', x + size / 2, y - 10); ctx.fillText('deep', x + size / 2, y + size + 20);
  ctx.save(); ctx.translate(x - 12, y + size / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('still', 0, 0); ctx.restore();
  ctx.save(); ctx.translate(x + size + 14, y + size / 2); ctx.rotate(Math.PI / 2); ctx.fillText('alive', 0, 0); ctx.restore();
  for (const d of dots) {
    const cx = x + ((d.x + 4.5) / 9) * size, cy = y + ((4.5 - d.y) / 9) * size;
    ctx.globalAlpha = d.alpha ?? 1;
    ctx.fillStyle = d.colour; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

/** One journal page (or a two-page spread in co-op) as a canvas. */
export async function renderPage(rec: NightRecord, names: string[] = []): Promise<HTMLCanvasElement> {
  const pages = Math.max(1, Math.min(2, rec.polaroids.length > 1 ? 2 : 1));
  const W = 720 * pages, H = 960;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  paperTexture(ctx, W, H, rec.seed);
  if (pages === 2) { ctx.strokeStyle = 'rgba(80,50,30,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(720, 20); ctx.lineTo(720, H - 20); ctx.stroke(); }
  ctx.fillStyle = INK; ctx.textAlign = 'left';
  ctx.font = '600 46px "Cormorant Garamond", serif';
  ctx.fillText(`Night ${rec.night}`, 56, 84);
  ctx.font = 'italic 22px "Cormorant Garamond", serif';
  ctx.fillText(rec.mode === 'afterimage' ? 'afterimage' : rec.mode === 'code' ? `dream code ${rec.code}` : rec.mode === 'daily' ? `the daily dream, ${rec.date}` : rec.date + (rec.cycle > 1 ? ` · cycle ${rec.cycle}` : ''), 56, 116);
  const imgs = await Promise.all(rec.polaroids.map(loadImage));
  const count = Math.max(1, rec.polaroids.length);
  for (let i = 0; i < count; i++) {
    const pageX = pages === 2 ? (i % 2) * 720 : 0;
    const multi = count > 2;
    const pw = multi ? 300 : 440, ph = multi ? 260 : 380;
    const px = pageX + (multi ? 50 + (Math.floor(i / 2) % 2) * 320 : 140), py = multi ? 150 + (i >= 2 ? 0 : 0) : 150;
    ctx.save();
    ctx.translate(px + pw / 2, py + ph / 2);
    ctx.rotate(((rec.seed >> (i * 3)) % 7 - 3) * 0.012);
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#fbf8f0'; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    ctx.shadowColor = 'transparent';
    const iw = pw - 36, ih = iw * 0.75;
    if (imgs[i]) ctx.drawImage(imgs[i]!, -pw / 2 + 18, -ph / 2 + 18, iw, ih);
    else { ctx.fillStyle = '#20202a'; ctx.fillRect(-pw / 2 + 18, -ph / 2 + 18, iw, ih); }
    ctx.fillStyle = INK; ctx.font = 'italic 20px "Cormorant Garamond", serif'; ctx.textAlign = 'center';
    ctx.fillText(names[i] ?? '', 0, ph / 2 - 16);
    ctx.restore();
  }
  // poem: three lines (in co-op, one line each)
  ctx.textAlign = 'left'; ctx.fillStyle = INK;
  ctx.font = 'italic 30px "Cormorant Garamond", serif';
  const lines = rec.poems.length > 1 ? rec.poems.map((p) => p[0]) : rec.poems[0] ?? [];
  lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, 70, 600 + i * 42));
  // the chart dot
  drawChart(ctx, 70, 790 - 0, 130, rec.dots.map((d) => ({ x: d.x, y: d.y, colour: d.colour })), rec.seed);
  // laws named in the morning, and what happened
  ctx.font = '20px "Cormorant Garamond", serif';
  let y = 786;
  const notes: string[] = [];
  for (const l of rec.laws) { const law = LAWS.find((x) => x.id === l); if (law) notes.push(law.journal); }
  for (const e of rec.events.slice(0, 2)) { const ev = EVENTS.find((x) => x.id === e); if (ev) notes.push(ev.text); }
  if (rec.realms.length) notes.push('I went to ' + rec.realms.map((r) => REALMS[r].name).slice(0, 4).join(', ') + '.');
  if (rec.erased) notes.push('A tall man walked into me. I cannot find this night again.');
  for (const n of notes.slice(0, 5)) { wrapText(ctx, n, 240, y, 440, 24).forEach(() => {}); y += 24 * Math.ceil(ctx.measureText(n).width / 440) + 6; }
  // the Dream Diary fragment
  const frag = DIARY[rec.diary];
  if (frag && pages === 2) {
    ctx.font = 'italic 24px "Cormorant Garamond", serif';
    wrapText(ctx, '“' + frag.text + '”', 790, 640, 560, 32);
  }
  return c;
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return lines;
}

export async function exportPage(rec: NightRecord, names: string[]) {
  const c = await renderPage(rec, names);
  const a = document.createElement('a');
  a.download = `dmt-night-${rec.night}${rec.mode !== 'normal' ? '-' + rec.mode : ''}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
}
