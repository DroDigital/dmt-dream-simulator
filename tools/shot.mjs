// usage: node tools/shot.mjs <url> <out.png> [waitMs] [--webgpu]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(require('child_process').execSync('node -p "require.resolve(\'playwright\')"', { cwd: '/' }).toString().trim()); }
const { chromium } = pw;
const [url, out, wait = '4000'] = process.argv.slice(2);
const webgpu = process.argv.includes('--webgpu');
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
if (webgpu) args.push('--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-webgpu-adapter=swiftshader');
const browser = await chromium.launch({ args, ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}) });
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(url);
await page.waitForTimeout(+wait);
const info = await page.evaluate(() => ({ backend: window.backend, frames: window.frames, err: window.err, dbg: window.dbg, dbg2: window.dbg2 }));
await page.screenshot({ path: out });
console.log(JSON.stringify(info));
console.log(logs.slice(0, 40).join('\n'));
await browser.close();
