// Full-run probe: ?story=1&movie=1 -> done. Polls __storyBeat + __autopilot,
// records per-beat dwell and the max beatClock reached; flags a RESCUE whenever
// a beat's clock reaches/exceeds its BEAT_TIMEOUT (a forced advance). Also fps
// samples per beat. Usage: node full-run-probe.mjs [maxSeconds]
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const maxSeconds = Number(process.argv[2] ?? 900);
const BEAT_TIMEOUT = {
  'ch1-fixed': 55, 'ch1-raster': 95, 'ch1-depth': 60, 'ch1-nav': 75, 'ch1-iso': 75,
  'ch1-anomaly': 62, 'ch2-color': 34, 'ch2-approach': 45, 'ch3-gather': 34,
  'ch3-await-rest': 70, 'ch3-thirst': 75, 'ch3-forage': 60, 'ch3-signal': 60, 'ch4-vigil': 140
};

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const browser = await chromium.launch({
  executablePath, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log(`[pageerror] ${e.message}`));
await page.goto('http://localhost:5174/?story=1&movie=1', { waitUntil: 'load' });

const t0 = Date.now();
let lastBeat = undefined;
let beatEnterWall = t0;
let maxClock = 0;
let ok = false;
const rows = [];
const fpsMeasured = new Set();
const rescues = [];

const flush = (prevBeat, wallNow) => {
  if (prevBeat === undefined || prevBeat === null) return;
  const dwell = (wallNow - beatEnterWall) / 1000;
  const to = BEAT_TIMEOUT[prevBeat];
  const rescued = to !== undefined && maxClock >= to - 0.15;
  rows.push({ beat: prevBeat, dwell: dwell.toFixed(1), maxClock: maxClock.toFixed(1), to: to ?? '-', rescued });
  if (rescued) rescues.push(`${prevBeat} (clock ${maxClock.toFixed(1)}s >= timeout ${to}s)`);
};

while ((Date.now() - t0) / 1000 < maxSeconds) {
  const s = await page.evaluate(() => ({
    beat: window.__storyBeat ?? null,
    clock: (window.__autopilot && window.__autopilot.clock) ?? null,
    nudges: (window.__autopilot && window.__autopilot.nudges) ?? null,
  })).catch(() => null);
  if (s) {
    if (s.clock !== null && typeof s.clock === 'number') maxClock = Math.max(maxClock, s.clock);
    if (s.beat !== lastBeat) {
      const wallNow = Date.now();
      flush(lastBeat, wallNow);
      const at = ((wallNow - t0) / 1000).toFixed(1);
      console.log(`[${at}s] ${lastBeat ?? '(boot)'} -> ${s.beat}`);
      lastBeat = s.beat;
      beatEnterWall = wallNow;
      maxClock = 0;
      if (s.beat && !fpsMeasured.has(s.beat)) {
        fpsMeasured.add(s.beat);
        const fps = await page.evaluate(() => new Promise(resolve => {
          let f = 0; const b = performance.now();
          const c = () => { f++; if (performance.now() - b < 1500) requestAnimationFrame(c);
            else resolve(Math.round(f / ((performance.now() - b) / 1000))); };
          requestAnimationFrame(c);
        })).catch(() => -1);
        console.log(`    fps@${s.beat}: ${fps}`);
      }
      if (s.beat === 'done') { ok = true; break; }
    }
  }
  await new Promise(r => setTimeout(r, 500));
}
flush(lastBeat, Date.now());

console.log('\n=== PER-BEAT DWELL vs TIMEOUT ===');
console.log('beat'.padEnd(18), 'dwell'.padStart(7), 'maxClock'.padStart(9), 'timeout'.padStart(8), '  rescued');
for (const r of rows) console.log(String(r.beat).padEnd(18), String(r.dwell).padStart(7), String(r.maxClock).padStart(9), String(r.to).padStart(8), '  ', r.rescued ? 'YES <<<' : 'no');
console.log(`\nTOTAL: ${((Date.now() - t0)/1000).toFixed(1)}s  reachedDone=${ok}  rescues=${rescues.length}`);
if (rescues.length) rescues.forEach(r => console.log('  RESCUE: ' + r));
console.log(ok && rescues.length === 0 ? 'PASS' : (ok ? 'REACHED-DONE-WITH-RESCUES' : 'FAIL-NO-DONE'));
await browser.close();
process.exit(ok && rescues.length === 0 ? 0 : 1);
