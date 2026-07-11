// Headless frame-strip capture: screenshots every N seconds from a ?story=
// start, filenames stamped with elapsed time + the live beat, until a target
// beat has been held for a couple of frames (or a timeout). Usage:
//   node story-strip.mjs <startBeat> <outDir> [seconds] [interval]
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const start = process.argv[2] ?? 'ch3-thirst';
const outDir = process.argv[3] ?? `/tmp/strip-${start}`;
const seconds = Number(process.argv[4] ?? 90);
const interval = Number(process.argv[5] ?? 4);

fs.mkdirSync(outDir, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:5174/?story=${start}&movie=1`, { waitUntil: 'load' });

const t0 = Date.now();
let shot = 0;
while ((Date.now() - t0) / 1000 < seconds) {
  const beat = await page.evaluate(() => window.__storyBeat ?? 'null').catch(() => 'err');
  const at = Math.round((Date.now() - t0) / 1000);
  const file = path.join(outDir, `${String(shot).padStart(3, '0')}_${String(at).padStart(3, '0')}s_${beat}.png`);
  await page.screenshot({ path: file }).catch(() => {});
  shot++;
  await new Promise(r => setTimeout(r, interval * 1000));
}
console.log(`wrote ${shot} frames to ${outDir}`);
await browser.close();
