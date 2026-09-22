#!/usr/bin/env node
// Stage 3 composed-sync onset probe (audio-10x run): for each of the ten
// contracted anchors, arms `scheduleHitOffline` on the beat's own step grid at
// several grid phases and measures the rendered envelope start against the
// returned audioTime (contract: within 1 ms). Silent-mood renders, pre-tail tap.
//
//   node tools/audio-hit-onset-probe.mjs <out.json> [--phases 6.0,6.37,6.71] [--desired 2.2] [--only anc.a,anc.b]
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const outFile = args.find((a) => !a.startsWith('--'));
if (!outFile) { console.error('usage: audio-hit-onset-probe.mjs <out.json> [--phases a,b,c] [--desired s] [--only ids]'); process.exit(2); }
const flag = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
const phases = (flag('phases') ?? '6.0,6.37,6.71').split(',').map(Number);
const desired = Number(flag('desired') ?? '2.2');
const only = flag('only')?.split(',') ?? null;
const postTail = args.includes('--post-tail');
const sampleRate = Number(flag('sample-rate') ?? 44100);
if (!phases.length || phases.some(value => !Number.isFinite(value) || value < 0) || ![44100, 48000].includes(sampleRate)) throw new Error('Use finite non-negative phases and an actual pinned sample rate44100 or48000.');
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));

async function serverUp(port) { try { const r = await fetch(`http://localhost:${port}/score-soak.html`); return r.ok && /<title>[^<]*Paravoxia[^<]*<\/title>/i.test(await r.text()); } catch { return false; } }
let viteProc = null;
process.once('exit', () => { if (viteProc && !viteProc.killed) viteProc.kill(); });
async function freshPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer(); server.unref(); server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close((e) => (e ? reject(e) : resolve(port))); });
  });
}
async function startServer(port) {
  const viteScript = ["import { createServer } from 'vite'", "import react from '@vitejs/plugin-react'",
    `const server = await createServer({ configFile: false, root: process.cwd(), plugins: [react()], server: { port: ${port}, strictPort: true, hmr: false, watch: null } })`,
    'await server.listen()', 'await new Promise(() => {})'].join(';');
  viteProc = spawn(process.execPath, ['--input-type=module', '--eval', viteScript], { cwd: root, stdio: 'ignore', env: { ...process.env, PROBE_NO_HMR: '1' } });
  for (let i = 0; i < 100; i++) { if (await serverUp(port)) return; await new Promise((r) => setTimeout(r, 300)); }
  throw new Error('vite dev server did not come up');
}
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const probePort = await freshPort();
await startServer(probePort);
const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
let failed = false;
const summary = { generatedAt: new Date().toISOString(), sampleRate, phases, desiredDelayS: desired, rows: [], verdict: null };
let expectedRows = 0;
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(600000);
  page.on('pageerror', (e) => { failed = true; console.log(`[pageerror] ${e.message}`); });
  await page.goto(`http://localhost:${probePort}/score-soak.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__scoreSoak), null, { timeout: 20000 });
  for (const armAtS of phases) {
    const specs = await page.evaluate(({ a, d }) => window.__scoreSoak.hitOnsetAnchorSpecs(a, d), { a: armAtS, d: desired });
    if (only?.some(id => !specs.some(spec => spec.anchorId === id))) throw new Error('Unknown requested anchor; missing fixtures cannot pass.');
    expectedRows += specs.filter(spec => !only || only.includes(spec.anchorId)).length;
    for (const spec of specs) {
      if (only && !only.includes(spec.anchorId)) continue;
      spec.sampleRate = sampleRate;
      const r = await page.evaluate((s) => window.__scoreSoak.renderHitOnsetProbe(s), spec);
      const companion = postTail ? await page.evaluate((s) => window.__scoreSoak.renderHitOnsetProbe({ ...s, tail: 'shipped', captureWaveform: true }), spec) : null;
      const row = {
        anchorId: r.anchorId, beat: r.beat, kind: r.kind, quantize: r.quantize, tempo: r.tempo, capMs: r.capMs, mayLead: Boolean(r.mayLead), floorRung: r.floorRung ?? 'step',
        armAtS: r.armedAtS, desiredS: r.armedAtS != null ? r.armedAtS + r.desiredDelayS : null,
        audioTime: r.schedule?.audioTime ?? null, quantumLanded: r.schedule?.quantumLanded ?? null, slackMs: r.schedule?.slackMs ?? null,
        onsetAttackMs: r.schedule?.onsetAttackMs ?? null, firstNonZeroS: r.firstNonZeroS, onsetErrorMs: r.onsetErrorMs, audibleS: r.audibleS,
        preRollSilent: r.preRollSilent, fitsCap: r.fitsCap,
        postTail: companion?.postTail ?? null,
        pass: r.schedule != null && r.fitsCap === true && r.preRollSilent && r.onsetErrorMs != null && Math.abs(r.onsetErrorMs) <= 1
      };
      if (postTail) {
        const wave = row.postTail;
        row.postTailPass = Boolean(wave && wave.sampleRate === sampleRate && wave.firstMusicSampleAtS != null
          && Math.abs(wave.firstMusicSampleAtS - wave.expectedMusicAtS) <= 0.0005
          && (wave.expectedSfxAtS == null || (wave.firstSfxSampleAtS != null && Math.abs(wave.firstSfxSampleAtS - wave.expectedSfxAtS) <= 0.0005)));
        row.pass &&= row.postTailPass;
      }
      summary.rows.push(row);
      console.log(`${row.anchorId.padEnd(30)} arm=${armAtS.toFixed(2)} ${row.quantumLanded ?? 'null'} slack=${row.slackMs?.toFixed(1)}ms cap=${row.capMs.toFixed(1)} onsetErr=${row.onsetErrorMs?.toFixed(3)}ms preRoll=${row.preRollSilent} ${row.pass ? 'PASS' : 'FAIL'}`);
    }
  }
} finally {
  await browser.close();
  if (viteProc && !viteProc.killed) viteProc.kill();
}
const fails = summary.rows.filter((r) => !r.pass);
summary.verdict = { rows: summary.rows.length, expectedRows, complete: expectedRows > 0 && summary.rows.length === expectedRows, pass: summary.rows.length - fails.length, fail: fails.length,
  maxAbsOnsetErrorMs: Math.max(...summary.rows.map((r) => Math.abs(r.onsetErrorMs ?? Infinity))),
  maxSlackOverCapMs: Math.max(...summary.rows.map((r) => (r.slackMs ?? 0) - r.capMs)) };
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
console.log(`RESULT onset rows ${summary.verdict.pass}/${summary.verdict.rows} pass; max |onset error| ${summary.verdict.maxAbsOnsetErrorMs.toFixed(3)} ms; wrote ${outFile}`);
process.exit(failed || fails.length || !summary.verdict.complete || (postTail && summary.rows.some(row => !row.postTail || !row.postTail.music.some(point => point.peak > 0))) ? 1 : 0);
