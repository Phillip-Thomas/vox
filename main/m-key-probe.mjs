// Headless [M] survey-chart keypress probe: boots ?story=ch3-thirst (no movie),
// waits for the beat + settle, dispatches KeyM, and asserts the chart chrome
// ("SURVEY CHART") appears in the DOM; presses M again and asserts it closes.
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const beat = process.argv[2] ?? 'ch3-thirst';
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log(`[pageerror] ${e.message}`));
await page.goto(`http://localhost:5174/?story=${beat}`, { waitUntil: 'load' });

// Wait for the beat to be live, then a settle margin (spawn hold ~2-4s headless).
const t0 = Date.now();
let live = false;
while ((Date.now() - t0) / 1000 < 40) {
  const b = await page.evaluate(() => window.__storyBeat ?? null).catch(() => null);
  if (b === beat) { live = true; break; }
  await new Promise(r => setTimeout(r, 300));
}
if (!live) { console.log('FAIL: beat never became live'); await browser.close(); process.exit(1); }
await new Promise(r => setTimeout(r, 6000));

const chartVisible = async () =>
  page.evaluate(() => document.body.innerText.includes('SURVEY CHART'));

console.log(`beat live; chart before press: ${await chartVisible()}`);
await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', bubbles: true }));
});
await new Promise(r => setTimeout(r, 800));
const open = await chartVisible();
console.log(`chart after [M]: ${open}`);
await page.screenshot({ path: `/tmp/m-key-${beat}-open.png` });

await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', bubbles: true }));
});
await new Promise(r => setTimeout(r, 800));
const closed = !(await chartVisible());
console.log(`chart closed after second [M]: ${closed}`);

await browser.close();
const ok = open && closed;
console.log(ok ? 'OK' : 'FAIL');
process.exit(ok ? 0 : 1);
