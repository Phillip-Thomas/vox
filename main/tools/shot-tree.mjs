// Headed real-GPU screenshot of the TREE TEST harness (tree-test.html), which
// renders all 6 silhouettes side-by-side using the REAL generateTree +
// treeMaterials. This is the edit -> see -> judge loop for tree geometry work.
//
//   node tools/shot-tree.mjs [label] [width] [height] [--only=weeping]
//
// --only=<species> renders a single tree, centered + closer (high-detail judging
// of the species being tuned); omit it for the all-6 side-by-side regression view.
// Writes captures/<label>.png (default label "treegrid"). Uses a HEADED Chrome
// window (real GPU) like the other capture tools; headless SwiftShader renders
// trees wrong/empty. The harness rebuilds geometry on every reload, so just
// reload + reshoot after each treeGen edit.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'captures');
const EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const BASE = process.env.GAME_URL || 'http://localhost:5173/';

const positional = process.argv.slice(2).filter(a => !a.startsWith('--'));
const onlyArg = process.argv.find(a => a.startsWith('--only='));
const only = onlyArg ? onlyArg.split('=')[1] : null;
const label = positional[0] || 'treegrid';
const W = Number(positional[1] || (only ? 900 : 1600));
const H = Number(positional[2] || 680);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  headless: false, // REAL GPU
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11']
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERR:', m.text().slice(0, 200)); });

const url = `${BASE}tree-test.html${only ? `?only=${only}` : ''}`;
await page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(e => console.log('goto warn', e.message));
await page.bringToFront(); // avoid background rAF throttling so the scene renders
// Wait for the WebGL canvas to mount, then let geometry build + a few frames settle.
await page.waitForSelector('canvas', { timeout: 15000 }).catch(() => console.log('no canvas'));
await page.waitForTimeout(3500);

const out = resolve(OUT, `${label}.png`);
await page.screenshot({ path: out });
console.log('wrote', `captures/${label}.png`);
await browser.close();
