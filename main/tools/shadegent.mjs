// Driver for the shadegent WebGL2 player: loads a Shadertoy-style .glsl, captures
// clean canvas frames at EXACT iTime values, saves PNGs. The sandbox for iterating
// sky/atmosphere math fast before porting into main/src/utils/spaceSky.ts.
//
//   node tools/shadegent.mjs --glsl <file> [--t 3,5.6,9] [--label sky] [--w 720] [--h 720]
//
// Drives the player's globals directly (recompile/drawOnce/capturePNG): its
// postMessage protocol only replies to a DIFFERENT window, so same-window driving
// uses the globals. drawOnce(startTime + t*1000) renders exactly at iTime=t.

import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find(a => a.startsWith(`--${n}=`));
  return eq ? eq.split('=').slice(1).join('=') : d;
};

const glslPath = arg('glsl');
if (!glslPath) { console.error('need --glsl <file>'); process.exit(1); }
const times = String(arg('t', '3,5.6,9')).split(',').map(Number);
const label = arg('label', 'sky');
const W = Number(arg('w', '720'));
const H = Number(arg('h', '720'));
const PLAYER = 'file:///D:/webdev/voxel-game/shadegent/harness/webgl/index.html';
const OUT = resolve('D:/webdev/voxel-game/shadegent/test-output');
const EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';

mkdirSync(OUT, { recursive: true });
const glsl = readFileSync(glslPath, 'utf8');

const browser = await chromium.launch({
  executablePath: EXE, headless: false,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11']
});
const page = await browser.newPage({ viewport: { width: W + 60, height: H + 60 } });
page.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 160)));
await page.goto(PLAYER, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(700);

const compiled = await page.evaluate(g => {
  const r = recompile(g);
  return { ok: r.ok, errors: r.errors };
}, glsl);

if (!compiled.ok) {
  console.log('COMPILE FAILED:');
  for (const e of compiled.errors || []) console.log(`  line ${e.line}: ${e.message}`);
  await browser.close();
  process.exit(2);
}
console.log('compiled OK');

for (const t of times) {
  const frame = await page.evaluate(tt => {
    // capturePNG() re-renders at performance.now(); rebase startTime so the live
    // clock == tt, then capture + metric the SAME iTime=tt frame.
    startTime = performance.now() - tt * 1000;
    const png = capturePNG();
    let metrics = {};
    try { metrics = computeMetrics(); } catch (_) { /* ignore */ }
    return { png, metrics };
  }, t);
  if (!frame || !frame.png) { console.log(`t=${t} capture FAILED`); continue; }
  writeFileSync(resolve(OUT, `${label}_t${t}.png`), Buffer.from(frame.png.split(',')[1], 'base64'));
  const m = frame.metrics || {};
  console.log(`t=${t} -> ${label}_t${t}.png  luma=${(m.mean_luma ?? 0).toFixed(3)} edges=${(m.edge_density ?? 0).toFixed(3)} blank=${m.is_blank}`);
}

await browser.close();
