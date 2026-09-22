// Stage 0 audio gate: drives the /score-soak.html harness headless and asserts
// the combined music+SFX render's health.
//
//   node tools/audio-check-probe.mjs            -> the `audio:check` verify step
//   node tools/audio-check-probe.mjs baseline   -> bed / combined / sfx baselines
//
// Owns a fresh HMR-off vite server on an ephemeral port (the machine's inotify
// budget cannot carry a watching dev server). Exit code 0 = PASS.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';

const mode = process.argv[2] ?? 'check';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
/**
 * Wall budget for the whole gate, seconds. Stage 0 measured ~17 s and set 25;
 * the Stage 1 instrument (5 pad voices × 6 saws, three drives, LR4 crossover,
 * stereo rooms) renders 90 s in ~13 s per pass and the two-pass gate measured
 * 25.5 s on a loaded box, so the advisory budget is 40 s. The binding checks
 * are true-peak, finiteness, smoothness, silence and replay determinism.
 */
const WALL_BUDGET_S = 40;
const PAGE_READY_TIMEOUT_MS = 20000;
const RENDER_TIMEOUT_MS = 180000;

async function serverUp(port) {
  try {
    const res = await fetch(`http://localhost:${port}/score-soak.html`);
    return res.ok;
  } catch {
    return false;
  }
}

let viteProc = null;
process.once('exit', () => {
  if (viteProc && !viteProc.killed) viteProc.kill();
});

async function freshPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function startServer(port) {
  const viteScript = [
    "import { createServer } from 'vite'",
    "import react from '@vitejs/plugin-react'",
    `const server = await createServer({ configFile: false, root: process.cwd(), plugins: [react()], server: { port: ${port}, strictPort: true, hmr: false, watch: null } })`,
    'await server.listen()',
    'await new Promise(() => {})'
  ].join(';');
  viteProc = spawn(process.execPath, ['--input-type=module', '--eval', viteScript], {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, PROBE_NO_HMR: '1' }
  });
  for (let i = 0; i < 100; i++) {
    if (await serverUp(port)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('vite dev server did not come up');
}

function fmtLoudness(l) {
  return (
    `I=${l.integratedLufs.toFixed(2)} LUFS  S-max=${l.shortTermMaxLufs.toFixed(2)}  ` +
    `M-max=${l.momentaryMaxLufs.toFixed(2)}  LRA=${l.loudnessRangeLu.toFixed(2)} LU  ` +
    `TP=${l.truePeakDbtp.toFixed(2)} dBTP  SP=${l.samplePeakDbfs.toFixed(2)} dBFS  ` +
    `corr=${l.correlation.toFixed(3)}`
  );
}

function fmtBands(l) {
  return `bands=[${l.spectral.bandFractions.map((b) => b.toFixed(3)).join(', ')}] zcr=${l.spectral.meanZeroCrossingRate.toFixed(0)}Hz`;
}

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs
  .readdirSync(pwDir)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort()
  .pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

let pass = true;
const startedAt = Date.now();
const probePort = await freshPort();
await startServer(probePort);
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio'
  ]
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => {
    pass = false;
    console.log(`[pageerror] ${e.message}`);
  });
  page.on('console', (m) => {
    if (m.text().startsWith('[soak-page]')) console.log(m.text());
  });
  await page.goto(`http://localhost:${probePort}/score-soak.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__scoreSoak), null, {
    timeout: PAGE_READY_TIMEOUT_MS
  });

  if (mode === 'baseline') {
    // Stage 0 §7 baselines: what the current floor measures, stem by stem.
    for (const stem of ['bed', 'combined', 'sfx']) {
      const r = await page.evaluate(
        (s) => window.__scoreSoak.renderAudioCheckStem(s),
        stem
      );
      console.log(`\n[${stem}] ${r.seconds.toFixed(1)}s, ${r.bars} bars, ${r.sfxCuesFired} sfx cues`);
      console.log(`    ${fmtLoudness(r.loudness)}`);
      console.log(`    ${fmtBands(r.loudness)}`);
      console.log(
        `    peak=${r.analysis.peak.toFixed(4)} rms=${r.analysis.rms.toFixed(5)} ` +
          `nan=${r.analysis.nanCount} clip=${r.analysis.clipCount} ` +
          `longestSilence=${r.analysis.longestSilenceS.toFixed(1)}s ` +
          `smoothViolations=${r.analysis.smoothnessViolations}`
      );
      console.log(`    sha256=${r.pcmSha256}`);
    }
  } else {
    page.setDefaultTimeout(RENDER_TIMEOUT_MS);
    const result = await page.evaluate(() => window.__scoreSoak.runAudioCheck());
    console.log(`\naudio:check — combined music+SFX, ${result.seconds}s, rendered twice`);
    console.log(`    ${fmtLoudness(result.render.loudness)}`);
    console.log(`    ${fmtBands(result.render.loudness)}`);
    for (const c of result.checks) {
      if (!c.pass) pass = false;
      console.log(`    [${c.pass ? 'PASS' : 'FAIL'}] ${c.name.padEnd(12)} ${c.detail}`);
    }
    if (!result.pass) pass = false;
  }
} finally {
  await browser.close();
  if (viteProc && !viteProc.killed) viteProc.kill();
}

const wallS = (Date.now() - startedAt) / 1000;
const withinBudget = mode !== 'check' || wallS <= WALL_BUDGET_S;
if (!withinBudget) pass = false;
console.log(
  `\nwall time ${wallS.toFixed(1)}s${mode === 'check' ? ` (budget ${WALL_BUDGET_S}s)` : ''} — ` +
    `${pass ? 'PASS' : 'FAIL'}`
);
process.exit(pass ? 0 : 1);
