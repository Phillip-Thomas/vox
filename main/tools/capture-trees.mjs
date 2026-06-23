// Headed real-GPU screenshot of the tree-test harness (tree-test.html).
//
// Unlike capture.mjs (which drives the game's window.__game bridge), this just
// loads the standalone harness URL, waits for shaders + the one-frame colour
// apply to settle, and screenshots. Use it to eyeball biome colour + silhouette
// variety after changing treeProfile / treeGen / treeMaterials.
//
// Prereq: Vite dev server running (http://localhost:5173).
// Usage:  node tools/capture-trees.mjs [--label=trees] [--query=count=36&cols=6]

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = resolve(ROOT, 'captures');
const EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const BASE = process.env.GAME_URL || 'http://localhost:5173/';

function arg(name, def) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

const label = arg('label', 'trees');
const query = arg('query', '');
const url = `${BASE}tree-test.html${query ? `?${query}` : ''}`;

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  headless: false, // REAL GPU (accurate colour)
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11']
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });

console.log('loading', url);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => console.log('goto warn', e.message));
// Let shaders compile + the lazy per-tree colour apply run a few frames.
await page.waitForTimeout(3500);

const out = resolve(OUT, `${label}.png`);
await page.screenshot({ path: out });
console.log('screenshot ->', `captures/${label}.png`);
await browser.close();
