// Headed real-GPU capture harness for the voxel game.
//
// Drives the in-app `window.__game` bridge (mounted under ?agent=1, see
// src/components/debug/AgentCamera.tsx) to take deterministic before/after
// screenshots + REAL FPS metrics at named camera vantages. Uses a HEADED Chrome
// window so it renders on the actual GPU (accurate colour + real FPS) instead of
// headless SwiftShader (which has consistently produced wrong/empty shots).
//
// Prereq: the Vite dev server must be running (http://localhost:5173).
//
// Modes:
//   Ad-hoc:  node tools/capture.mjs --label=phase1 --world=12,7 --day=0.25 \
//              --profile=HIGH --views=overhead,underCanopy,coast,horizon [--painterly] [--extra=k=v]
//   Stored:  node tools/capture.mjs --label=phase1 --stored [--profile=HIGH] [--painterly]
//            -> replays EVERY user-authored vantage in src/components/debug/vantages.json,
//               each on its OWN stored world/seed + dayphase (seed-correct framing).
//
// Output: captures/<label>_<view>.png  +  captures/<label>.metrics.json

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = resolve(ROOT, 'captures');
const VANTAGES_FILE = resolve(ROOT, 'src/components/debug/vantages.json');
const EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const BASE = process.env.GAME_URL || 'http://localhost:5173/';

function arg(name, def) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (process.argv.includes(`--${name}`)) return true;
  return def;
}

const label = arg('label', 'shot');
const profile = arg('profile', 'HIGH');
const painterly = arg('painterly', false);
const stored = arg('stored', false);
const extra = String(arg('extra', '')).split(',').filter(Boolean);

// Build the batch list: each item = { world, day, views: [names] }.
let batches;
if (stored) {
  const list = JSON.parse(readFileSync(VANTAGES_FILE, 'utf8'));
  if (!list.length) { console.log('vantages.json is empty — record some with the C key first.'); process.exit(0); }
  const byGroup = new Map();
  for (const v of list) {
    const key = `${v.world[0]},${v.world[1]}|${v.day ?? ''}`;
    if (!byGroup.has(key)) byGroup.set(key, { world: `${v.world[0]},${v.world[1]}`, day: v.day, views: [] });
    byGroup.get(key).views.push(v.name);
  }
  batches = [...byGroup.values()];
} else {
  batches = [{
    world: arg('world', '0,0'),
    day: Number(arg('day', '0.25')),
    views: String(arg('views', 'overhead,underCanopy,coast,horizon')).split(',').filter(Boolean)
  }];
}

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  headless: false, // REAL GPU
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 200)));

const results = [];
for (const batch of batches) {
  const params = new URLSearchParams();
  params.set('agent', '1');
  params.set('world', batch.world);
  if (batch.day !== null && batch.day !== undefined && batch.day !== '') params.set('dayphase', String(batch.day));
  params.set('profile', profile);
  if (painterly) params.set('painterly', '1');
  for (const kv of extra) { const [k, v = '1'] = kv.split('='); params.set(k, v); }
  const url = `${BASE}?${params.toString()}`;
  console.log('batch', batch.world, 'day', batch.day, '->', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => console.log('goto warn', e.message));
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 });
  await page.evaluate(() => window.__game.ready());

  for (const view of batch.views) {
    const resolved = await page.evaluate(v => window.__game.view(v), view);
    await page.waitForTimeout(900); // let streaming + frames settle
    const out = resolve(OUT, `${label}_${view}.png`);
    await page.screenshot({ path: out });
    const metrics = await page.evaluate(() => window.__game.metrics());
    results.push({ view, world: batch.world, day: batch.day, resolved, metrics });
    console.log(`  ${view.padEnd(20)} -> ${String(resolved).padEnd(22)} fps=${metrics.fps} draws=${metrics.drawCalls} tris=${metrics.triangles} -> ${label}_${view}.png`);
  }
}

writeFileSync(resolve(OUT, `${label}.metrics.json`), JSON.stringify({ label, profile, painterly: !!painterly, results }, null, 2));
console.log('metrics ->', `captures/${label}.metrics.json`);
await browser.close();
