// M2G verification (Playwright + pixel read-back). Needs `npm run dev` on :5173.
// usage: node tools/glyph-verify.mjs [edge] [stability] [snapshots] [perf]
import { createRequire } from 'module';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }

const which = new Set(process.argv.slice(2).length ? process.argv.slice(2) : ['edge', 'stability', 'snapshots', 'perf']);
const BASE = process.env.LAB ?? 'http://localhost:5174/glyph-lab.html?webgl&nopanel&manual';
const W = 960, H = 540;
const out = { when: new Date().toISOString(), results: {} };
const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function open(q = '') {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + q);
  await page.waitForFunction(() => window.labReady || window.err, null, { timeout: 90000 });
  const err = await page.evaluate(() => window.err);
  if (err) throw new Error(err);
  await page.evaluate(() => lab.setAuto(false));
  return page;
}

const edgeBin = (gx, gy) => { let a = Math.atan2(gx, -gy); a = ((a % Math.PI) + Math.PI) % Math.PI; return Math.round(a / (Math.PI / 4)) % 4; };
const flipRows = (arr, w, h) => { const o = new Array(arr.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = arr[(h - 1 - y) * w + x]; return o; };

// ── 1. edge test ──────────────────────────────────────────────────────────
if (which.has('edge')) {
  const page = await open('&scene=cube&preset=desert-day');
  await page.evaluate(() => { lab.setLiving(false); lab.reset(); lab.step(6); });
  const c = await page.evaluate(() => lab.codes());
  const m = await page.evaluate(() => lab.mask());
  const cell = await page.evaluate(() => lab.cellPx());
  const webgl = m.backend === 'webgl';
  const codes = webgl ? flipRows(c.codes, c.w, c.h) : c.codes;
  const px = webgl ? flipRows(m.px, m.w, m.h) : m.px;
  const frac = new Float32Array(c.w * c.h);
  for (let cy = 0; cy < c.h; cy++) for (let cx = 0; cx < c.w; cx++) {
    let on = 0, n = 0;
    for (let y = cy * cell; y < Math.min(H, (cy + 1) * cell); y++) for (let x = cx * cell; x < Math.min(W, (cx + 1) * cell); x++) { n++; if (px[y * W + x] > 127) on++; }
    frac[cy * c.w + cx] = n ? on / n : 0;
  }
  const F = (x, y) => frac[Math.min(c.h - 1, Math.max(0, y)) * c.w + Math.min(c.w - 1, Math.max(0, x))];
  let sil = 0, good = 0, edgeAny = 0;
  for (let y = 1; y < c.h - 1; y++) for (let x = 1; x < c.w - 1; x++) {
    const f = F(x, y);
    if (f <= 0.1 || f >= 0.9) continue;
    sil++;
    const gx = F(x + 1, y - 1) + 2 * F(x + 1, y) + F(x + 1, y + 1) - F(x - 1, y - 1) - 2 * F(x - 1, y) - F(x - 1, y + 1);
    const gy = F(x - 1, y + 1) + 2 * F(x, y + 1) + F(x + 1, y + 1) - F(x - 1, y - 1) - 2 * F(x, y - 1) - F(x + 1, y - 1);
    const want = edgeBin(gx, gy);
    const code = Math.round(codes[y * c.w + x]);
    if (code >= 10 && code <= 13) {
      edgeAny++;
      const d = Math.abs(code - 10 - want) % 4;
      if (Math.min(d, 4 - d) <= 1) good++;
    }
  }
  const ratio = sil ? good / sil : 0;
  out.results.edge = { silhouetteCells: sil, edgeGlyphCells: edgeAny, matching: good, ratio: +ratio.toFixed(3), pass: ratio >= 0.9 };
  console.log('edge', out.results.edge);
  await page.close();
}

// ── 2. stability + 3. photosensitivity ────────────────────────────────────
async function panRun(page, frames) {
  await page.evaluate(() => { lab.reset(); lab.step(2); });
  let prev = (await page.evaluate(() => lab.codes())).codes;
  const n = prev.length;
  let changes = 0;
  const lastFlip = new Map();
  const flips = new Map(); // cell → frame numbers of dark↔bright flips
  for (let f = 0; f < frames; f++) {
    await page.evaluate(() => lab.step(1));
    const cur = (await page.evaluate(() => lab.codes())).codes;
    let ch = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.round(prev[i]), b = Math.round(cur[i]);
      if (a !== b) {
        ch++;
        const dark = (k) => k <= 1, bright = (k) => k >= 8 && k <= 9;
        if ((dark(a) && bright(b)) || (bright(a) && dark(b))) { const l = flips.get(i) ?? []; l.push(f); flips.set(i, l); }
      }
    }
    changes += ch / n;
    prev = cur;
  }
  let worst = 0;
  for (const l of flips.values()) for (let i = 0; i < l.length; i++) { let k = i; while (k < l.length && l[k] - l[i] < 60) k++; worst = Math.max(worst, k - i); }
  void lastFlip;
  return { meanChange: changes / frames, worstFlipsPerSecond: worst };
}
if (which.has('stability')) {
  const page = await open('&preset=desert-day');
  await page.evaluate(() => lab.setLiving(false));
  const on = await panRun(page, 120);
  await page.evaluate(() => lab.patch({ hysteresis: 0, holdFrames: 0 }));
  const off = await panRun(page, 120);
  out.results.stability = {
    withHistory: +(on.meanChange * 100).toFixed(3) + '%', withoutHistory: +(off.meanChange * 100).toFixed(3) + '%', ratio: +(off.meanChange / Math.max(1e-9, on.meanChange)).toFixed(2),
    pass: on.meanChange < 0.03 && off.meanChange > 3 * on.meanChange,
  };
  out.results.photosensitivity = { worstFlipsPerSecond: on.worstFlipsPerSecond, pass: on.worstFlipsPerSecond <= 3 };
  console.log('stability', out.results.stability);
  console.log('photosensitivity', out.results.photosensitivity);
  await page.close();
}

// ── 4. snapshot tests per preset ──────────────────────────────────────────
if (which.has('snapshots')) {
  const page = await open('&preset=desert-day');
  const presets = await page.evaluate(() => lab.presets);
  const dir = 'tests/baselines/glyph';
  mkdirSync(dir, { recursive: true }); mkdirSync('screenshots/glyph', { recursive: true });
  const res = {};
  for (const p of presets) {
    await page.evaluate((name) => { lab.setPreset(name); lab.reset(); lab.step(12); }, p);
    const shot = `screenshots/glyph/${p}.png`;
    await page.screenshot({ path: shot });
    const base = `${dir}/${p}.png`;
    if (!existsSync(base)) { writeFileSync(base, await page.screenshot()); res[p] = 'baseline created'; continue; }
    const diff = execFileSync('python3', ['-I', '-c', `
import sys
from PIL import Image, ImageChops, ImageStat
a=Image.open(sys.argv[1]).convert('RGB'); b=Image.open(sys.argv[2]).convert('RGB')
d=ImageStat.Stat(ImageChops.difference(a,b)).mean
print(sum(d)/3/255)`, shot, base]).toString().trim();
    res[p] = +(+diff * 100).toFixed(3) <= 1.5 ? 'match' : `DIFF ${(+diff * 100).toFixed(2)}%`;
  }
  out.results.snapshots = { presets: presets.length, results: res, pass: Object.values(res).every((v) => v !== undefined && !String(v).startsWith('DIFF')) };
  console.log('snapshots', out.results.snapshots);
  await page.close();
}

// ── 5. performance capture (CPU + submit time; GPU time needs real hardware) ─
if (which.has('perf')) {
  const perf = {};
  for (const [label, q] of [['solo', '&preset=desert-day'], ['four-player preset', '&preset=desert-day&four&w=480&h=270']]) {
    const page = await open(q);
    await page.evaluate(() => lab.step(10));
    const ms = await page.evaluate(() => lab.step(60));
    perf[label] = +ms.toFixed(2) + ' ms/frame';
    await page.close();
  }
  out.results.perf = { ...perf, note: 'Measured on SwiftShader (software GPU) in a headless container: relative numbers only. The ≤1.0 ms GPU budget needs a timestamp-query capture on Iris Xe / M1 hardware.' };
  console.log('perf', out.results.perf);
}

mkdirSync('screenshots', { recursive: true });
writeFileSync('screenshots/glyph-verify.json', JSON.stringify(out, null, 2));
await browser.close();
const failed = Object.entries(out.results).filter(([, r]) => r.pass === false).map(([k]) => k);
console.log(failed.length ? 'FAILED: ' + failed.join(', ') : 'all checks passed');
process.exit(failed.length ? 1 : 0);
