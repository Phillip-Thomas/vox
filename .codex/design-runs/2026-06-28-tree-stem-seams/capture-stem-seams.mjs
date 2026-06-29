import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../main/package.json', import.meta.url));
const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:5173';
const RUN_DIR = path.resolve('.codex/design-runs/2026-06-28-tree-stem-seams');
const SHOT_DIR = path.join(RUN_DIR, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--use-gl=swiftshader']
});

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const consoleIssues = [];
page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    consoleIssues.push({ type: msg.type(), text: msg.text() });
  }
});
page.on('pageerror', err => {
  consoleIssues.push({ type: 'pageerror', text: err.message });
});

async function captureTreeTest(name, url, viewport) {
  await page.setViewportSize(viewport ?? { width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.__treeTest?.summary?.().length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(2200);
  const summary = await page.evaluate(() => window.__treeTest.summary());
  const screenshot = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  return { name, url, viewport: viewport ?? { width: 1440, height: 900 }, screenshot, summary };
}

const captures = [];
captures.push(await captureTreeTest('desktop-frond-stem-close', `${BASE}/tree-test.html?only=frond`));
captures.push(await captureTreeTest('desktop-round-stem-close', `${BASE}/tree-test.html?only=round`));
captures.push(await captureTreeTest('desktop-tree-silhouettes', `${BASE}/tree-test.html?mode=silhouettes`));
captures.push(await captureTreeTest(
  'mobile-frond-stem-close',
  `${BASE}/tree-test.html?only=frond`,
  { width: 390, height: 844 }
));

await page.setViewportSize({ width: 1440, height: 900 });
const gameUrl = `${BASE}/?agent=1&world=0,45&dayphase=0.4734&profile=HIGH`;
await page.goto(gameUrl, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(() => window.__game, null, { timeout: 20000 });
await page.waitForFunction(() => {
  const game = window.__game;
  if (!game) return false;
  let treeCount = 0;
  game.scene.traverse(object => {
    if (!object.isInstancedMesh) return;
    let key = '';
    try { key = object.material?.customProgramCacheKey?.() ?? ''; } catch { /* ignore */ }
    if (/tree-bark/.test(key)) treeCount += object.count ?? 0;
  });
  return treeCount > 0;
}, null, { timeout: 30000 });
await page.evaluate(() => window.__game.view('underCanopy'));
await page.waitForTimeout(2600);
const gameScreenshot = path.join(SHOT_DIR, 'desktop-inworld-stem.png');
await page.screenshot({ path: gameScreenshot, fullPage: false });

const report = {
  captures,
  game: { url: gameUrl, screenshot: gameScreenshot },
  consoleIssues
};
fs.writeFileSync(path.join(RUN_DIR, 'capture-results.json'), JSON.stringify(report, null, 2));
await browser.close();

console.log(JSON.stringify({
  captures: captures.map(c => ({
    name: c.name,
    treeCount: c.summary.length,
    silhouettes: [...new Set(c.summary.map(t => t.silhouette))].sort(),
    barkVertices: c.summary.map(t => ({
      key: t.key,
      silhouette: t.silhouette,
      trunkHeight: +t.trunkHeight.toFixed(2),
      vertices: t.meshes.find(m => /tree-bark/.test(m.materialKey))?.vertices ?? 0
    })),
    screenshot: c.screenshot
  })),
  game: report.game,
  consoleIssueCount: consoleIssues.length,
  consoleIssues: consoleIssues.slice(0, 8)
}, null, 2));
