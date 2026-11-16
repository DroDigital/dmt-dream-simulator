// Acceptance capture for M2G (20 s at 30 fps, rendered frame by frame):
// the Glyph Lab cycling through 8 presets, then Evening Suburb dissolving
// through the glyph link transition into Glyph Desert with wind and ripples.
// usage: node tools/capture.mjs   (needs the verify server on :5174 and ffmpeg)
import { createRequire } from 'module';
import { mkdirSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const HOST = process.env.HOST ?? 'http://localhost:5174';
const dir = 'screenshots/capture';
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
let n = 0;
const shot = async () => { await page.screenshot({ path: `${dir}/f${String(n++).padStart(4, '0')}.png` }); };

// part 1: Glyph Lab, 8 presets × 1.25 s
await page.goto(`${HOST}/glyph-lab.html?webgl&nopanel&manual`);
await page.waitForFunction(() => window.labReady, null, { timeout: 90000 });
await page.evaluate(() => lab.setAuto(false));
const presets = ['desert-day', 'desert-night', 'glyph-night-2', 'glyph-night-3', 'glyph-night-4', 'tv-static', 'photo-neon', 'photo-fluted'];
for (const p of presets) {
  await page.evaluate((name) => { lab.setPreset(name); lab.step(2); }, p);
  for (let i = 0; i < 37; i++) { await page.evaluate(() => lab.step(2)); await shot(); }
}
console.log('lab frames', n);

// part 2: Evening Suburb → glyph transition → Glyph Desert, walking (ripples) in the wind
await page.goto(`${HOST}/?webgl&auto&fresh&realm=suburb&capture`);
await page.waitForFunction(() => window.capFrame && window.dmt, null, { timeout: 90000 });
await page.evaluate(() => window.capFrame(60)); // fall asleep, arrive
await page.evaluate(() => { dmt.input.scripted = { moveY: 0.6 }; });
for (let i = 0; i < 60; i++) { await page.evaluate(() => window.capFrame(1)); await shot(); }
await page.evaluate(() => {
  const p = dmt.players[0];
  const fake = { id: 'capture', kind: 'vending', tags: ['glyph'], object: p.realm.root, colliders: [], meshes: [] };
  dmt.linkPlayer(p, fake, { forced: 'desert', transition: 'dissolve' });
});
for (let i = 0; i < 240; i++) { await page.evaluate(() => window.capFrame(1)); await shot(); }
console.log('total frames', n);
await browser.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', `${dir}/f%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', 'screenshots/m2g-capture.mp4']);
console.log('wrote screenshots/m2g-capture.mp4');
