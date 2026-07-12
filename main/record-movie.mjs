// Record the full Paravoxia movie run to video (Playwright page capture).
import { chromium } from 'playwright-core';
import { mkdirSync, renameSync } from 'node:fs';

const EXE = '/home/thomasphillip/.cache/ms-playwright/chromium-1217/chrome-linux/chrome';
const OUT_DIR = '/home/thomasphillip/Projects/vox/captures';
const START = process.argv[2] ?? '1';
const NAME = process.argv[3] ?? 'paravoxia-movie';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=gl', '--enable-unsafe-swiftshader']
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } }
});
const page = await context.newPage();
await page.goto(`http://localhost:5174/?story=${START}&movie=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });

const t0 = Date.now();
let last = '';
while (Date.now() - t0 < 1100 * 1000) {
  await page.waitForTimeout(2000);
  const beat = await page.evaluate(() => window.__storyBeat ?? null);
  if (beat !== last) { console.log(`t+${Math.round((Date.now() - t0) / 1000)}s ${beat}`); last = beat; }
  if (beat === 'done') { await page.waitForTimeout(8000); break; }
}
const video = page.video();
await page.close();
const path = await video.path();
await context.close();
await browser.close();
renameSync(path, `${OUT_DIR}/${NAME}.webm`);
console.log(`saved ${OUT_DIR}/${NAME}.webm`);
