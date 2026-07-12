// Settle-then-sample fps probe: boots ?story=<beat>&movie=1, waits for the beat
// to be live plus a settle margin (so cold world-load isn't counted), then takes
// several 2s rAF-count fps samples. Usage: node fps-settle-probe.mjs <beat> [settleS] [samples]
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const beat = process.argv[2] ?? 'crawl';
const settleS = Number(process.argv[3] ?? 8);
const samples = Number(process.argv[4] ?? 3);

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const browser = await chromium.launch({
  executablePath, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log(`[pageerror] ${e.message}`));
await page.goto(`http://localhost:5174/?story=${beat}&movie=1`, { waitUntil: 'load' });

const t0 = Date.now();
let live = false;
while ((Date.now() - t0) / 1000 < 60) {
  const b = await page.evaluate(() => window.__storyBeat ?? null).catch(() => null);
  if (b === beat) { live = true; break; }
  await new Promise(r => setTimeout(r, 300));
}
console.log(`beat ${beat} live=${live} at ${((Date.now()-t0)/1000).toFixed(1)}s; settling ${settleS}s`);
await new Promise(r => setTimeout(r, settleS * 1000));

const sample = () => page.evaluate(() => new Promise(resolve => {
  let frames = 0; const begin = performance.now();
  const count = () => { frames++; if (performance.now() - begin < 2000) requestAnimationFrame(count);
    else resolve(Math.round(frames / ((performance.now() - begin) / 1000))); };
  requestAnimationFrame(count);
}));

const vals = [];
for (let i = 0; i < samples; i++) {
  const beatNow = await page.evaluate(() => window.__storyBeat ?? null).catch(() => null);
  const fps = await sample().catch(() => -1);
  vals.push(fps);
  console.log(`  sample ${i+1}: ${fps} fps (beat=${beatNow}, t+${((Date.now()-t0)/1000).toFixed(1)}s)`);
  await new Promise(r => setTimeout(r, 500));
}
const max = Math.max(...vals);
console.log(`RESULT ${beat}: samples=[${vals.join(', ')}] max=${max} -> ${max >= 60 ? 'PASS(>=60)' : 'BELOW 60'}`);
await browser.close();
process.exit(0);
