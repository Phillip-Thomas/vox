#!/usr/bin/env node
/**
 * Station interior baseline probe (run 2026-09-04-station-interior-light).
 *
 * Read-only measurement. Two passes against the already-running preview:
 *   pass A  ?hud=0   -> per-cell rAF frame counting over ~3s (clean scene cost)
 *   pass B  ?hud=1   -> per-cell stills at 1600x900 + the shipped debug HUD text,
 *                       which is the only place spaceStationInteriorDiagnostics()
 *                       is surfaced (it is NOT on window), plus one mobile still.
 *
 * Usage: node baseline-probe.mjs [--url http://127.0.0.1:4321]
 */

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
// playwright-core lives in main/node_modules; this script sits outside it.
const MAIN = resolve(HERE, '../../../main');
const require = createRequire(pathToFileURL(`${MAIN}/package.json`));
const { chromium } = require('playwright-core');
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = argValue('url', 'http://127.0.0.1:4321');
const SHOT_DIR = resolve(HERE, 'evidence/baseline-hud');
const OUT_JSON = resolve(HERE, 'evidence/baseline-perf.json');
const CELLS = ['apron', 'counter', 'concourse', 'floor', 'shelves'];
const SAMPLE_MS = 3_000;

function chromiumPath() {
  const base = `${process.env.HOME}/.cache/ms-playwright`;
  const dir = readdirSync(base).find(entry => entry.startsWith('chromium-'));
  if (!dir) throw new Error(`no chromium in ${base}`);
  return `${base}/${dir}/chrome-linux/chrome`;
}

const browser = await chromium.launch({
  executablePath: chromiumPath(),
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage'
  ]
});

mkdirSync(SHOT_DIR, { recursive: true });
mkdirSync(dirname(OUT_JSON), { recursive: true });

const problems = [];
function watch(page, tag) {
  page.on('pageerror', error => problems.push(`${tag} pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') problems.push(`${tag} console: ${message.text()}`);
  });
}

/** rAF frame count over `ms`, measured inside the page. */
async function measureFps(page, ms) {
  return page.evaluate(duration => new Promise(done => {
    let frames = 0;
    const t0 = performance.now();
    const tick = () => {
      const now = performance.now();
      if (now - t0 >= duration) {
        done({ frames, elapsedMs: now - t0, fps: (frames * 1000) / (now - t0) });
        return;
      }
      frames++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), ms);
}

/** Parse the shipped SandboxHud text into structured diagnostics. */
async function readHudDiagnostics(page) {
  const text = await page.evaluate(() =>
    document.querySelector('[data-testid="spaceStation-sandbox-hud"]')?.textContent ?? null);
  if (!text) return { raw: null };
  const num = re => {
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  };
  const visible = text.match(/visible:\s*(\d+)\/(\d+)\s*(?:\(([^)]*)\))?/);
  const instances = text.match(/instances:\s*(\d+)\/(\d+)/);
  return {
    raw: text.trim(),
    occupiedCellId: (text.match(/in:\s*([a-z]+)/) || [])[1] ?? null,
    visibleCellCount: visible ? Number(visible[1]) : null,
    cellCount: visible ? Number(visible[2]) : null,
    visibleCellIds: visible && visible[3] ? visible[3].split(',').map(s => s.trim()) : [],
    instances: instances ? Number(instances[1]) : null,
    totalInstances: instances ? Number(instances[2]) : null,
    crowd: num(/crowd:\s*(\d+)/),
    meshes: num(/meshes:\s*(\d+)/),
    programs: num(/programs:\s*(\d+)/),
    hudFps: num(/·\s*(\d+)\s*fps/)
  };
}

const identity = { title: null, ok: false };

// ---- pass A: clean scene, no HUD -------------------------------------------
const pageA = await browser.newPage({ viewport: { width: 1600, height: 900 } });
watch(pageA, 'hud0');
await pageA.goto(`${BASE}/?spacestation=1&hud=0&t=17.5&dock=0`, { waitUntil: 'networkidle', timeout: 90_000 });
identity.title = await pageA.title();
identity.ok = identity.title === 'Paravoxia';
if (!identity.ok) throw new Error(`identity check failed: title="${identity.title}"`);
await pageA.waitForTimeout(5_000);

const perf = [];
for (const cell of CELLS) {
  const placed = await pageA.evaluate(
    ([c, u, v]) => window.__spaceStationTeleport?.(c, u, v) ?? false, [cell, 0.4, 0.5]);
  if (!placed) throw new Error(`could not place viewer in "${cell}"`);
  await pageA.waitForTimeout(1_500);
  const fps = await measureFps(pageA, SAMPLE_MS);
  const state = await pageA.evaluate(() => window.__spaceStationState?.() ?? null);
  perf.push({ cell, hud: false, ...fps, fps: Number(fps.fps.toFixed(2)), state });
  console.log(`hud=0 ${cell.padEnd(10)} ${fps.fps.toFixed(1)} fps (${fps.frames} frames / ${Math.round(fps.elapsedMs)}ms)`);
}
await pageA.close();

// ---- pass B: shipped HUD visible, stills + diagnostics ----------------------
const pageB = await browser.newPage({ viewport: { width: 1600, height: 900 } });
watch(pageB, 'hud1');
await pageB.goto(`${BASE}/?spacestation=1&hud=1&t=17.5&dock=0`, { waitUntil: 'networkidle', timeout: 90_000 });
await pageB.waitForTimeout(5_000);

const diagnostics = [];
for (const cell of CELLS) {
  const placed = await pageB.evaluate(
    ([c, u, v]) => window.__spaceStationTeleport?.(c, u, v) ?? false, [cell, 0.4, 0.5]);
  if (!placed) throw new Error(`could not place viewer in "${cell}" (hud pass)`);
  await pageB.evaluate(() => window.__spaceStationLook?.(-Math.PI / 2, 0));
  await pageB.waitForTimeout(1_800);
  const fps = await measureFps(pageB, SAMPLE_MS);
  const diag = await readHudDiagnostics(pageB);
  const path = resolve(SHOT_DIR, `hud-${cell}.png`);
  await pageB.screenshot({ path });
  diagnostics.push({
    cell,
    hud: true,
    fps: Number(fps.fps.toFixed(2)),
    frames: fps.frames,
    elapsedMs: Math.round(fps.elapsedMs),
    diagnostics: diag,
    screenshot: path
  });
  console.log(`hud=1 ${cell.padEnd(10)} ${fps.fps.toFixed(1)} fps  instances=${diag.instances}/${diag.totalInstances} visible=${diag.visibleCellCount}/${diag.cellCount} programs=${diag.programs}`);
}
await pageB.close();

// ---- mobile still at the concourse ------------------------------------------
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});
const pageM = await mobile.newPage();
watch(pageM, 'mobile');
await pageM.goto(`${BASE}/?spacestation=1&hud=1&t=17.5&dock=0`, { waitUntil: 'networkidle', timeout: 90_000 });
await pageM.waitForTimeout(5_000);
await pageM.evaluate(() => window.__spaceStationTeleport?.('concourse', 0.4, 0.5));
await pageM.evaluate(() => window.__spaceStationLook?.(-Math.PI / 2, 0));
await pageM.waitForTimeout(1_800);
const mobileFps = await measureFps(pageM, SAMPLE_MS);
const mobileDiag = await readHudDiagnostics(pageM);
const mobileTouch = await pageM.evaluate(() => ({
  joystick: !!document.querySelector('[data-testid="touch-joystick"]'),
  actionCluster: !!document.querySelector('[data-testid="touch-action-cluster"]'),
  actions: [...document.querySelectorAll('[data-testid^="touch-action-"]')]
    .map(node => ({ testId: node.getAttribute('data-testid'), label: node.textContent?.trim(), aria: node.getAttribute('aria-label') }))
}));
const mobileShot = resolve(SHOT_DIR, 'hud-mobile-concourse.png');
await pageM.screenshot({ path: mobileShot });
await mobile.close();

const report = {
  schema: 'paravoxia.stationBaselinePerf.v1',
  runId: '2026-09-04-station-interior-light',
  capturedAt: new Date().toISOString(),
  url: BASE,
  identityCheck: identity,
  renderer: 'headless chromium, ANGLE/SwiftShader, dpr 1',
  desktopViewport: '1600x900',
  sampleWindowMs: SAMPLE_MS,
  note: 'spaceStationInteriorDiagnostics() is NOT exposed on window; instance/visibility/program counts are read from the shipped SandboxHud text in the hud=1 pass.',
  cleanPass: perf,
  hudPass: diagnostics,
  mobile: {
    viewport: '390x844',
    isMobile: true,
    hasTouch: true,
    cell: 'concourse',
    fps: Number(mobileFps.fps.toFixed(2)),
    frames: mobileFps.frames,
    elapsedMs: Math.round(mobileFps.elapsedMs),
    diagnostics: mobileDiag,
    touchControls: mobileTouch,
    screenshot: mobileShot
  },
  runtimeProblems: problems
};

writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nwrote ${OUT_JSON}`);
if (problems.length > 0) {
  console.log(`${problems.length} runtime problem(s):`);
  for (const p of problems.slice(0, 10)) console.log(`  ${p}`);
}

await browser.close();
