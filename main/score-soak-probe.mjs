// P4 score-soak probe: drives the /score-soak.html harness headless.
//   node score-soak-probe.mjs excerpts            -> renders/ owner-audition WAVs
//   node score-soak-probe.mjs soak [minutes] [seed] [archetype]
//                                                 -> 30+ min OfflineAudioContext soak
//                                                    (no clipping/NaN + §10.4 musical audits)
// Starts its own vite dev server on PROBE_PORT unless one is already there.
// Exit code 0 = all PASS.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const PROBE_PORT = 5199;
const mode = process.argv[2] ?? 'excerpts';
const soakMinutes = Number(process.argv[3] ?? 32);
const soakSeed = process.argv[4] !== undefined ? Number(process.argv[4]) : undefined;
const soakArchetype = process.argv[5];

const root = path.dirname(new URL(import.meta.url).pathname);
const rendersDir = path.join(root, 'renders');

async function serverUp(port) {
  try {
    const res = await fetch(`http://localhost:${port}/score-soak.html`);
    return res.ok;
  } catch {
    return false;
  }
}

let viteProc = null;
async function ensureServer() {
  if (await serverUp(PROBE_PORT)) return;
  console.log(`[probe] starting vite dev server on :${PROBE_PORT}…`);
  viteProc = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--port', String(PROBE_PORT), '--strictPort'],
    { cwd: root, stdio: 'ignore' }
  );
  for (let i = 0; i < 100; i++) {
    if (await serverUp(PROBE_PORT)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('vite dev server did not come up');
}

function fmtAnalysis(a) {
  return `peak=${a.peak.toFixed(3)} rms=${a.rms.toFixed(4)} nan=${a.nanCount} clip=${a.clipCount} maxWinRms=${a.maxWindowRms.toFixed(3)} longestSilence=${a.longestSilenceS.toFixed(1)}s`;
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
  fs.writeFileSync(file, Buffer.concat(chunks));
}

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs
  .readdirSync(pwDir)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort()
  .pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

let pass = true;
await ensureServer();
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
  await page.goto(`http://localhost:${PROBE_PORT}/score-soak.html`, { waitUntil: 'load' });
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
      if (meta.report) printReport(meta.report);
    }
    console.log(`\nWAVs written to ${rendersDir}`);
  } else if (mode === 'soak') {
    console.log(`[probe] OfflineAudioContext soak: ${soakMinutes} minutes (this renders faster than realtime but still takes a while)…`);
    const res = await page.evaluate(
      ({ minutes, seed, archetype }) => window.__scoreSoak.runAudioSoak(minutes, seed, archetype),
      { minutes: soakMinutes, seed: soakSeed, archetype: soakArchetype }
    );
    console.log(`\n=== AUDIO SOAK ${res.pass ? 'PASS' : 'FAIL'} — ${res.minutes} min, seed ${res.planetSeed} (${res.archetype}), ${res.bars} bars ===`);
    console.log(`  audio: ${fmtAnalysis(res.analysis)} ${res.analysis.nanCount === 0 && res.analysis.clipCount === 0 ? '[PASS]' : '[FAIL]'}`);
    printReport(res.report);
    if (!res.pass) pass = false;
  } else {
    console.error(`unknown mode '${mode}' (excerpts | soak)`);
    pass = false;
  }
} finally {
  await browser.close();
  if (viteProc) viteProc.kill();
}
console.log(`\nRESULT: ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
