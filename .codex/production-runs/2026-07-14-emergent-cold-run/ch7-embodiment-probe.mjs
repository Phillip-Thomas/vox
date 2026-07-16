import playwright from '../../../main/node_modules/playwright-core/index.js';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = playwright;
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const mainRoot = path.join(repoRoot, 'main');
const startBeat = process.env.PROBE_BEAT ?? 'ch7-reconstruct';
const outputDir = path.join(repoRoot, 'captures', `${startBeat}-embodiment-2026-07-14`);
const port = 5225;
const url = `http://127.0.0.1:${port}/?story=${encodeURIComponent(startBeat)}&movie=1&profile=POTATO`;

function browserExecutable() {
  const cache = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    const versions = readdirSync(cache)
      .filter(name => /^chromium-\d+$/.test(name))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const version of versions) {
      const candidate = path.join(cache, version, 'chrome-linux', 'chrome');
      if (existsSync(candidate)) return candidate;
    }
  }
  return '/snap/bin/chromium';
}

await mkdir(outputDir, { recursive: true });
const serverLog = [];
const vite = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: mainRoot, env: { ...process.env, PROBE_NO_HMR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] }
);
vite.stdout.on('data', chunk => serverLog.push(String(chunk)));
vite.stderr.on('data', chunk => serverLog.push(String(chunk)));

let browser;
let context;
const consoleErrors = [];
const timeline = [];
const startedAt = Date.now();
const deadlineAt = startedAt + Number(process.env.PROBE_DEADLINE_MS ?? 120_000);

try {
  for (let index = 0; index < 120; index++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break;
    } catch { /* server is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  browser = await chromium.launch({
    executablePath: browserExecutable(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-gpu-vsync'
    ]
  });
  context = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const page = await context.newPage();
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));
  await page.addInitScript(() => {
    let sceneAv = null;
    window.__sceneAvHistory = [];
    Object.defineProperty(window, '__paravoxiaSceneAv', {
      configurable: true,
      get: () => sceneAv,
      set: value => {
        sceneAv = value;
        window.__sceneAvHistory.push({
          at: Date.now(),
          beat: value?.beat ?? null,
          anchorId: value?.anchorId ?? null,
          activatedAnchorIds: [...(value?.activatedAnchorIds ?? [])]
        });
      }
    });
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForFunction(() => window.__storyBeat !== undefined, undefined, { timeout: 120_000 });
  await page.evaluate(() => {
    window.__readCh7Evidence = () => ({
      beat: window.__storyBeat ?? null,
      av: window.__paravoxiaSceneAv ?? null,
      player: window.__voxelDebug?.player ?? null,
      autopilot: window.__autopilot ?? null
    });
  });

  let reached = false;
  for (let index = 0; index < 300 && Date.now() < deadlineAt; index++) {
    const sample = await page.evaluate(() => window.__readCh7Evidence());
    const previous = timeline[timeline.length - 1];
    const signature = JSON.stringify({
      beat: sample.beat,
      anchor: sample.av?.anchorId,
      active: sample.av?.activatedAnchorIds,
      grounded: sample.player?.grounded
    });
    if (!previous || previous.signature !== signature) {
      timeline.push({ elapsedMs: Date.now() - startedAt, signature, ...sample });
      await writeFile(
        path.join(outputDir, 'timeline.json'),
        `${JSON.stringify(timeline, null, 2)}\n`
      );
    }
    if (sample.beat === 'ch8-launch') {
      reached = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 750));
  }

  const final = await page.evaluate(() => window.__readCh7Evidence());
  const avHistory = await page.evaluate(() => window.__sceneAvHistory ?? []);
  await page.screenshot({ path: path.join(outputDir, 'final.png') });
  const boardAnchors = [
    'anc.board.hatch-enter',
    'anc.board.camera-transfer',
    'anc.board.pressure-seal',
    'anc.board.cockpit-handback'
  ];
  const requiredAnchors = startBeat === 'ch7-board'
    ? boardAnchors
    : [
      'anc.reconstruct.diagnosis',
      'anc.reconstruct.lift-online',
      'anc.reconstruct.first-hover',
      'anc.reconstruct.calibration',
      ...boardAnchors
    ];
  const seenAnchors = [...new Set(avHistory.flatMap(sample => sample.activatedAnchorIds ?? []))];
  const summary = {
    result: reached && consoleErrors.length === 0 && requiredAnchors.every(anchor => seenAnchors.includes(anchor))
      ? 'PASS'
      : 'FAIL',
    url,
    elapsedMs: Date.now() - startedAt,
    reachedCh8Launch: reached,
    requiredAnchors,
    seenAnchors,
    avHistory,
    final,
    consoleErrors,
    timeline
  };
  await writeFile(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  vite.kill('SIGTERM');
  await writeFile(path.join(outputDir, 'vite.log'), serverLog.join(''));
}
