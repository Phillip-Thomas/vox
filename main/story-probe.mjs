// Headless story beat-flow probe (Linux): polls window.__storyBeat from a given
// ?story= start until a target beat (default 'done') or a hard timeout, logging
// every transition with wall-clock timings, plus a 2s rAF fps sample at each
// beat of interest. Usage:
//   node story-probe.mjs [startBeat] [targetBeat] [maxSeconds]
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const start = process.argv[2] ?? 'ch3-thirst';
const target = process.argv[3] ?? 'done';
const maxSeconds = Number(process.argv[4] ?? 600);

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
const url = `http://localhost:5174/?story=${start}&movie=1`;
console.log(`# ${url} -> ${target} (max ${maxSeconds}s)`);
await page.goto(url, { waitUntil: 'load' });

const t0 = Date.now();
let lastBeat = undefined;
let ok = false;
const fpsMeasured = new Set();

while ((Date.now() - t0) / 1000 < maxSeconds) {
  const state = await page.evaluate(() => ({
    beat: window.__storyBeat ?? null,
    pilot: window.__autopilot ?? null
  })).catch(() => null);
  if (state && state.beat !== lastBeat) {
    const at = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[${at}s] beat: ${lastBeat ?? '(boot)'} -> ${state.beat}`);
    lastBeat = state.beat;
    // fps sample on each newly-entered beat (one per beat)
    if (state.beat && !fpsMeasured.has(state.beat)) {
      fpsMeasured.add(state.beat);
      const fps = await page.evaluate(() => new Promise(resolve => {
        let frames = 0;
        const begin = performance.now();
        const count = () => {
          frames++;
          if (performance.now() - begin < 2000) requestAnimationFrame(count);
          else resolve(Math.round(frames / ((performance.now() - begin) / 1000)));
        };
        requestAnimationFrame(count);
      })).catch(() => -1);
      console.log(`  fps@${state.beat}: ${fps}`);
    }
    if (state.beat === target) { ok = true; break; }
  }
  await new Promise(r => setTimeout(r, 400));
}
if (!ok) {
  const pilot = await page.evaluate(() => window.__autopilot ?? null).catch(() => null);
  console.log(`TIMEOUT at beat=${lastBeat} pilot=${JSON.stringify(pilot)}`);
}
console.log(ok ? `OK: reached ${target} in ${((Date.now() - t0) / 1000).toFixed(1)}s` : 'FAIL');
await browser.close();
process.exit(ok ? 0 : 1);
