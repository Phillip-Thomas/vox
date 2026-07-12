// P4 score-soak probe: drives the /score-soak.html harness headless.
//   node score-soak-probe.mjs excerpts            -> renders/ owner-audition WAVs
//   node score-soak-probe.mjs evidence [pair]      -> controlled signal A/B WAV pairs
//   node score-soak-probe.mjs soak [minutes] [seed] [archetype]
//                                                 -> 30+ min OfflineAudioContext soak
//                                                    (no clipping/NaN + §10.4 musical audits)
// Always starts and owns a fresh HMR-off vite server on an ephemeral port.
// Exit code 0 = all PASS.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';

const mode = process.argv[2] ?? 'excerpts';
const soakMinutes = Number(process.argv[3] ?? 32);
const soakSeed = process.argv[4] !== undefined ? Number(process.argv[4]) : undefined;
const soakArchetype = process.argv[5];
const evidencePairFilter = mode === 'evidence' ? process.argv[3] : undefined;

const root = path.dirname(new URL(import.meta.url).pathname);
const rendersDir = path.join(root, 'renders');
const WAV_HEADER_BYTES = 44;
const PCM16_BYTES = 2;
const PCM16_FULL_SCALE = 32768;
/** Minimum controlled A/B difference: below this, the mapping is not demonstrably audible. */
const EVIDENCE_MIN_PAIR_DELTA_RMS = 0.0025;
const EVIDENCE_MAPPING_CONTRACT = {
  'daylight-night': { keys: ['daylight', 'registerShift'], minDifferent: 2 },
  'golden-hour': { keys: ['golden', 'mediants'], minDifferent: 2 },
  submergence: { keys: ['submergence', 'clockHz'], minDifferent: 2 },
  wind: { keys: ['windDrive'], minDifferent: 1 },
  warp: { keys: ['clockHz', 'arrangement'], minDifferent: 2 },
  descent: { keys: ['clockHz', 'clockPresence'], minDifferent: 2 },
  'era-stage': { keys: ['padChoirGate', 'subGate', 'stageBlooms'], minDifferent: 3 },
  'planet-seed': {
    keys: ['tonicPc', 'mode', 'tempoBpm', 'meter', 'paletteBrightness'],
    minDifferent: 2
  }
};

async function serverUp(port) {
  try {
    const res = await fetch(`http://localhost:${port}/score-soak.html`);
    return res.ok;
  } catch {
    return false;
  }
}

let viteProc = null;
const cleanupServer = () => {
  if (viteProc && !viteProc.killed) viteProc.kill();
};
process.once('exit', cleanupServer);
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
  console.log(`[probe] starting isolated HMR-off vite server on :${port}…`);
  const viteScript = [
    "import { createServer } from 'vite'",
    "import react from '@vitejs/plugin-react'",
    `const server = await createServer({ configFile: false, root: process.cwd(), plugins: [react()], server: { port: ${port}, strictPort: true, hmr: false, watch: { ignored: ['**/captures/**', '**/renders/**', '**/.git/**'] } } })`,
    'await server.listen()',
    'await new Promise(() => {})'
  ].join(';');
  viteProc = spawn(
    process.execPath,
    ['--input-type=module', '--eval', viteScript],
    {
      cwd: root,
      stdio: 'ignore',
      env: { ...process.env, PROBE_NO_HMR: '1' }
    }
  );
  for (let i = 0; i < 100; i++) {
    if (await serverUp(port)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  cleanupServer();
  throw new Error('vite dev server did not come up');
}

function fmtAnalysis(a) {
  return `peak=${a.peak.toFixed(3)} rms=${a.rms.toFixed(4)} nan=${a.nanCount} clip=${a.clipCount} maxWinRms=${a.maxWindowRms.toFixed(3)} longestSilence=${a.longestSilenceS.toFixed(1)}s smoothMax=${a.maxSmoothnessDeltaDb.toFixed(2)}dB(${a.maxSmoothnessPreviousRms.toFixed(4)}→${a.maxSmoothnessCurrentRms.toFixed(4)})@${a.maxSmoothnessDeltaDbAtS.toFixed(1)}s/${a.maxSmoothnessDeltaRms.toFixed(4)}rms@${a.maxSmoothnessDeltaAtS.toFixed(1)}s violations=${a.smoothnessViolations}`;
}

function analysisPass(a) {
  return (
    a.nanCount === 0 &&
    a.clipCount === 0 &&
    a.longestSilenceS === 0 &&
    a.smoothnessViolations === 0
  );
}

function composedMixSafetyPass(a) {
  return a.nanCount === 0 && a.clipCount === 0 && a.longestSilenceS === 0;
}

function printReport(report) {
  for (const c of report.checks) {
    console.log(`    [${c.pass ? 'PASS' : 'FAIL'}] ${c.name.padEnd(16)} ${c.detail}`);
  }
  for (const [k, v] of Object.entries(report.stats)) console.log(`    · ${k}: ${v}`);
}

async function pullWav(page, bytes, file) {
  const chunks = [];
  let offset = 0;
  while (offset < bytes) {
    const b64 = await page.evaluate((o) => window.__scoreSoak.wavChunk(o), offset);
    if (b64 === null) break;
    const buf = Buffer.from(b64, 'base64');
    chunks.push(buf);
    offset += buf.length;
  }
  const wav = Buffer.concat(chunks);
  fs.writeFileSync(file, wav);
  return wav;
}

function pcm16PairMetrics(a, b) {
  const end = Math.min(a.length, b.length);
  let deltaSquares = 0;
  let aSquares = 0;
  let bSquares = 0;
  let dot = 0;
  let samples = 0;
  for (let offset = WAV_HEADER_BYTES; offset + PCM16_BYTES <= end; offset += PCM16_BYTES) {
    const sampleA = a.readInt16LE(offset) / PCM16_FULL_SCALE;
    const sampleB = b.readInt16LE(offset) / PCM16_FULL_SCALE;
    const delta = sampleA - sampleB;
    deltaSquares += delta * delta;
    aSquares += sampleA * sampleA;
    bSquares += sampleB * sampleB;
    dot += sampleA * sampleB;
    samples++;
  }
  if (samples === 0) return { deltaRms: 0, rmsA: 0, rmsB: 0, correlation: 0, relativeDeltaDb: 0 };
  const deltaRms = Math.sqrt(deltaSquares / samples);
  const rmsA = Math.sqrt(aSquares / samples);
  const rmsB = Math.sqrt(bSquares / samples);
  const correlation = dot / Math.max(Number.EPSILON, Math.sqrt(aSquares * bSquares));
  const referenceRms = Math.max(Number.EPSILON, (rmsA + rmsB) / 2);
  return {
    deltaRms,
    rmsA,
    rmsB,
    correlation,
    relativeDeltaDb: 20 * Math.log10(deltaRms / referenceRms)
  };
}

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs
  .readdirSync(pwDir)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort()
  .pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

let pass = true;
const probePort = await freshPort();
await startServer(probePort);
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required', '--mute-audio']
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
  await page.waitForFunction(() => Boolean(window.__scoreSoak), null, { timeout: 20000 });

  if (mode === 'excerpts') {
    fs.mkdirSync(rendersDir, { recursive: true });
    const names = await page.evaluate(() => window.__scoreSoak.excerptNames);
    for (const name of names) {
      const meta = await page.evaluate((n) => window.__scoreSoak.renderExcerpt(n), name);
      const file = path.join(rendersDir, `${meta.fileStem}.wav`);
      await pullWav(page, meta.wavBytes, file);
      const ok = meta.healthPass;
      if (!ok) pass = false;
      console.log(`[${ok ? 'PASS' : 'FAIL'}] ${meta.fileStem}.wav (${meta.seconds}s) — ${meta.description}`);
      console.log(`    audio: ${fmtAnalysis(meta.analysis)}`);
      if (meta.continuousControlAnalysis) {
        console.log(`    control audit: ${fmtAnalysis(meta.continuousControlAnalysis)}`);
      }
      if (meta.report) printReport(meta.report);
    }
    console.log(`\nWAVs written to ${rendersDir}`);
  } else if (mode === 'evidence') {
    fs.mkdirSync(rendersDir, { recursive: true });
    const allPairs = await page.evaluate(() => window.__scoreSoak.evidencePairNames);
    const pairs = evidencePairFilter
      ? allPairs.filter((pair) => pair === evidencePairFilter)
      : allPairs;
    if (pairs.length === 0) {
      throw new Error(`unknown evidence pair '${evidencePairFilter}' (${allPairs.join(', ')})`);
    }
    for (const pair of pairs) {
      const pairWavs = [];
      const pairMetas = [];
      for (const variant of ['A', 'B']) {
        const meta = await page.evaluate(
          ({ pair, variant }) => window.__scoreSoak.renderEvidence(pair, variant),
          { pair, variant }
        );
        pairMetas.push(meta);
        const file = path.join(rendersDir, `${meta.fileStem}.wav`);
        pairWavs.push(await pullWav(page, meta.wavBytes, file));
        const ok = meta.healthPass;
        if (!ok) pass = false;
        console.log(
          `[${ok ? 'PASS' : 'FAIL'}] ${meta.fileStem}.wav (${meta.seconds}s) — ${meta.description}`
        );
        console.log(`    owner audition (composed onsets included): ${fmtAnalysis(meta.analysis)}`);
        if (meta.continuousControlAnalysis) {
          console.log(`    control audit: ${fmtAnalysis(meta.continuousControlAnalysis)}`);
        }
        if (meta.report) printReport(meta.report);
      }
      const metrics = pcm16PairMetrics(pairWavs[0], pairWavs[1]);
      const mappingAudible = metrics.deltaRms >= EVIDENCE_MIN_PAIR_DELTA_RMS;
      console.log(
        `    [${mappingAudible ? 'PASS' : 'FAIL'}] controlled A/B delta RMS ${metrics.deltaRms.toFixed(5)} ` +
          `(minimum ${EVIDENCE_MIN_PAIR_DELTA_RMS}); corr ${metrics.correlation.toFixed(4)}, ` +
          `relative ${metrics.relativeDeltaDb.toFixed(2)} dB, RMS A/B ${metrics.rmsA.toFixed(5)}/${metrics.rmsB.toFixed(5)}`
      );
      if (!mappingAudible) pass = false;
      const contract = EVIDENCE_MAPPING_CONTRACT[pair];
      const valuesA = pairMetas[0].mappingValues ?? {};
      const valuesB = pairMetas[1].mappingValues ?? {};
      const changed = contract.keys.filter((key) => valuesA[key] !== valuesB[key]);
      const mappingResolved = changed.length >= contract.minDifferent;
      console.log(
        `    [${mappingResolved ? 'PASS' : 'FAIL'}] resolved music values changed ` +
          `${changed.length}/${contract.keys.length}: ` +
          contract.keys.map((key) => `${key} ${valuesA[key]}→${valuesB[key]}`).join(', ')
      );
      if (!mappingResolved) pass = false;
    }
    console.log(`\nEvidence WAVs written to ${rendersDir}`);
  } else if (mode === 'handoff') {
    const auditStem = process.argv[3] ?? 'combined';
    const handoffSweep = await page.evaluate(
      (stem) => window.__scoreSoak.runStoryHandoffSmoothnessSweep(stem),
      auditStem
    );
    console.log(`\n=== STORY AUTHORITY HANDOFF ${handoffSweep.pass ? 'PASS' : 'FAIL'} ===`);
    console.log(`  audit stem: ${auditStem}`);
    console.log(`  audio: ${fmtAnalysis(handoffSweep.analysis)}`);
    printReport(handoffSweep.report);
    if (!handoffSweep.pass) pass = false;
  } else if (mode === 'root-smoothness') {
    const rootCauseSweep = await page.evaluate(() => window.__scoreSoak.runEraBuildSmoothnessSweep());
    console.log(`\n=== ERA BUILD→BLOOM ${rootCauseSweep.pass ? 'PASS' : 'FAIL'} ===`);
    console.log(`  audio: ${fmtAnalysis(rootCauseSweep.analysis)}`);
    printReport(rootCauseSweep.report);
    if (!rootCauseSweep.pass) pass = false;
  } else if (mode === 'soak') {
    console.log(`[probe] OfflineAudioContext soak: ${soakMinutes} minutes (this renders faster than realtime but still takes a while)…`);
    const res = await page.evaluate(
      ({ minutes, seed, archetype }) => window.__scoreSoak.runAudioSoak(minutes, seed, archetype),
      { minutes: soakMinutes, seed: soakSeed, archetype: soakArchetype }
    );
    console.log(`\n=== AUDIO SOAK ${res.pass ? 'PASS' : 'FAIL'} — ${res.minutes} min, seed ${res.planetSeed} (${res.archetype}), ${res.bars} bars ===`);
    const audioPass = composedMixSafetyPass(res.analysis);
    console.log(
      `  owner mix (composed onsets included): ${fmtAnalysis(res.analysis)} ` +
        `${audioPass ? '[PASS]' : '[FAIL]'}`
    );
    console.log(
      `  continuous-control audit: ${fmtAnalysis(res.continuousControlAnalysis)} ` +
        `${analysisPass(res.continuousControlAnalysis) ? '[PASS]' : '[FAIL]'}`
    );
    printReport(res.report);
    if (!res.pass) pass = false;

    const sweep = await page.evaluate(() => window.__scoreSoak.runSmoothnessSweep());
    console.log(
      `\n=== DAY→NIGHT→DAY SMOOTHNESS ${sweep.pass ? 'PASS' : 'FAIL'} — ` +
        `${sweep.seconds}s, moon-overhead at ${(sweep.seconds / 2).toFixed(1)}s ===`
    );
    console.log(
      `  audio: ${fmtAnalysis(sweep.analysis)} ${analysisPass(sweep.analysis) ? '[PASS]' : '[FAIL]'}`
    );
    printReport(sweep.report);
    if (!sweep.pass) pass = false;

    const rootCauseSweep = await page.evaluate(() => window.__scoreSoak.runEraBuildSmoothnessSweep());
    console.log(
      `\n=== ERA-CHANGING BUILD→BLOOM SMOOTHNESS ${rootCauseSweep.pass ? 'PASS' : 'FAIL'} — ` +
        `${rootCauseSweep.seconds}s root-cause reproduction ===`
    );
    console.log(
      `  audio: ${fmtAnalysis(rootCauseSweep.analysis)} ` +
        `${analysisPass(rootCauseSweep.analysis) ? '[PASS]' : '[FAIL]'}`
    );
    printReport(rootCauseSweep.report);
    if (!rootCauseSweep.pass) pass = false;

    const handoffSweep = await page.evaluate(() => window.__scoreSoak.runStoryHandoffSmoothnessSweep());
    console.log(
      `\n=== STORY AUTHORITY HANDOFF SMOOTHNESS ${handoffSweep.pass ? 'PASS' : 'FAIL'} — ` +
        `${handoffSweep.seconds}s yield/scene-change/resume ===`
    );
    console.log(
      `  audio: ${fmtAnalysis(handoffSweep.analysis)} ` +
        `${analysisPass(handoffSweep.analysis) ? '[PASS]' : '[FAIL]'}`
    );
    printReport(handoffSweep.report);
    if (!handoffSweep.pass) pass = false;
  } else {
    console.error(`unknown mode '${mode}' (excerpts | evidence | soak | handoff | root-smoothness)`);
    pass = false;
  }
} finally {
  await browser.close();
  cleanupServer();
}
console.log(`\nRESULT: ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
