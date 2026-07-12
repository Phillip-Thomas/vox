// Screenshot + geometry proof for the tree-test harness (tree-test.html).
//
// Unlike capture.mjs (which drives the game's window.__game bridge), this just
// loads the standalone harness URL, waits for shaders + the one-frame colour
// apply to settle, and screenshots. Use it to eyeball biome colour + silhouette
// variety after changing treeProfile / treeGen / treeMaterials.
//
// Prereq: Vite dev server running (http://localhost:5173).
// Usage:  node tools/capture-trees.mjs [--label=trees] [--query=count=36&cols=6] [--headed]

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = resolve(ROOT, 'captures');
const BASE = process.env.GAME_URL || 'http://localhost:5173/';

function arg(name, def) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  if (process.argv.includes(`--${name}`)) return true;
  return def;
}

function resolveChromiumExecutable() {
  const localAppData = process.env.LOCALAPPDATA?.replaceAll('\\', '/');
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/google/chrome/chrome',
    localAppData && `${localAppData}/Google/Chrome/Application/chrome.exe`,
    localAppData && `${localAppData}/Microsoft/Edge/Application/msedge.exe`,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'
  ].filter(Boolean);

  const bundled = chromium.executablePath();
  if (bundled) candidates.push(bundled);

  const executablePath = candidates.find(candidate => existsSync(candidate));
  if (!executablePath) {
    throw new Error(
      'Chromium was not found. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to a Chromium or Chrome executable.'
    );
  }
  return executablePath;
}

const label = arg('label', 'trees');
const query = arg('query', '');
const headedArg = arg('headed', false);
const headed = headedArg === true || headedArg === 'true';
const url = `${BASE}tree-test.html${query ? `?${query}` : ''}`;
const executablePath = resolveChromiumExecutable();
const viewport = { width: 1600, height: 900 };

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: !headed,
  args: ['--ignore-gpu-blocklist', '--enable-gpu']
});
const page = await browser.newPage({ viewport });
const issues = [];
page.on('pageerror', error => issues.push({ type: 'pageerror', message: error.message }));
page.on('console', message => {
  if (message.type() === 'error') {
    issues.push({ type: 'console', message: message.text() });
  }
});

const screenshot = resolve(OUT, `${label}.png`);
const metrics = resolve(OUT, `${label}.metrics.json`);
let summary = [];

try {
  console.log('loading', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(
    () => window.__treeTest?.summary?.().length > 0,
    null,
    { timeout: 30000 }
  );
  // Let shaders compile + the lazy per-tree colour apply run a few frames.
  await page.waitForTimeout(3500);
  summary = await page.evaluate(() => window.__treeTest.summary());
  await page.screenshot({ path: screenshot });
} finally {
  await browser.close();
}

writeFileSync(metrics, JSON.stringify({
  label,
  url,
  createdAt: new Date().toISOString(),
  browser: {
    executablePath,
    mode: headed ? 'headed' : 'headless'
  },
  viewport,
  screenshot: `captures/${label}.png`,
  treeCount: summary.length,
  summary,
  issues
}, null, 2));

console.log('screenshot ->', `captures/${label}.png`);
console.log('metrics ->', `captures/${label}.metrics.json`);

if (issues.length > 0) {
  for (const issue of issues) console.error(`${issue.type}: ${issue.message}`);
  process.exitCode = 1;
}
