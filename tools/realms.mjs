// Screenshot every realm at a fixed seed: node tools/realms.mjs [realm...]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const realms = process.argv.slice(2).length ? process.argv.slice(2) : ['flat', 'orchard', 'market', 'cathedral', 'suburb', 'stair', 'metro', 'library', 'static', 'reef', 'veins', 'desert', 'school', 'threshold', 'orrery', 'chorus'];
const extra = process.env.Q ?? '';
const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const r of realms) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  const url = r === 'flat' ? `http://localhost:5173/?webgl&auto&fresh&flat${extra}` : `http://localhost:5173/?webgl&auto&fresh&realm=${r}${extra}`;
  await page.goto(url);
  await page.waitForTimeout(+(process.env.WAIT ?? 12000));
  await page.screenshot({ path: `screenshots/realm-${r}${process.env.TAG ?? ''}.png` });
  const err = await page.evaluate(() => window.err);
  console.log(r, err ?? '', [...new Set(logs)].slice(0, 6).join('\n  '));
  await page.close();
}
await browser.close();
