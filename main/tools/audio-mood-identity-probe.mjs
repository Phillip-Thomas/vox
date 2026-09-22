#!/usr/bin/env node
// Stage 3 MOODS-as-constraints identity probe (audio-10x run): renders every
// authored mood entry for MOOD_IDENTITY_SECONDS through the REAL instrument on
// the score-soak harness and writes one hash line per mood.
//
//   node tools/audio-mood-identity-probe.mjs <out.json> [--only name,name]
//
// Run once BEFORE an instrument edit and once after; `audio-mood-identity-compare`
// (inline below via --compare a.json b.json) reports which moods changed.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
// WAV PCM16 reader (stereo interleaved) → per-channel Int16 arrays.
function readWavPcm16(file) {
  const buf = fs.readFileSync(file);
  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  let off = 12;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const len = buf.readUInt32LE(off + 4);
    if (id === 'data') { dataOff = off + 8; dataLen = len; break; }
    off += 8 + len + (len % 2);
  }
  const frames = Math.floor(dataLen / 2 / channels);
  const out = Array.from({ length: channels }, () => new Int16Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) out[c][i] = buf.readInt16LE(dataOff + (i * channels + c) * 2);
  return { channels: out, sampleRate, frames };
}
function compareWavDirs(dirA, dirB) {
  const rows = [];
  for (const f of fs.readdirSync(dirA).filter((n) => n.endsWith('.wav')).sort()) {
    const fb = path.join(dirB, f);
    if (!fs.existsSync(fb)) { rows.push({ name: f.replace(/\.wav$/, ''), missing: true }); continue; }
    const a = readWavPcm16(path.join(dirA, f));
    const b = readWavPcm16(fb);
    const n = Math.min(a.frames, b.frames);
    let maxLsb = 0, diffSamples = 0, sumSqA = 0, sumSqB = 0, sumSqD = 0, firstDiff = -1;
    for (let c = 0; c < a.channels.length; c++) {
      const ca = a.channels[c], cb = b.channels[c];
      for (let i = 0; i < n; i++) {
        const d = cb[i] - ca[i];
        if (d !== 0) { diffSamples++; if (firstDiff < 0 || i < firstDiff) firstDiff = i; }
        const ad = Math.abs(d); if (ad > maxLsb) maxLsb = ad;
        sumSqA += ca[i] * ca[i]; sumSqB += cb[i] * cb[i]; sumSqD += d * d;
      }
    }
    const rmsA = Math.sqrt(sumSqA / (n * a.channels.length)) / 32768, rmsB = Math.sqrt(sumSqB / (n * a.channels.length)) / 32768;
    const rmsD = Math.sqrt(sumSqD / (n * a.channels.length)) / 32768;
    rows.push({
      name: f.replace(/\.wav$/, ''), frames: n, maxAbsDeltaLsb: maxLsb, diffSampleFraction: diffSamples / (n * a.channels.length),
      firstDiffS: firstDiff < 0 ? null : firstDiff / a.sampleRate,
      rmsDeltaDb: rmsA > 0 ? 20 * Math.log10(rmsB / rmsA) : null,
      residualDbfs: rmsD > 0 ? 20 * Math.log10(rmsD) : -Infinity,
      identical: maxLsb === 0
    });
  }
  return rows;
}
if (args[0] === '--compare-wav') {
  const rows = compareWavDirs(args[1], args[2]);
  const identical = rows.filter((r) => r.identical).length;
  console.log(JSON.stringify({ before: args[1], after: args[2], moods: rows.length, identical, changed: rows.length - identical,
    maxAbsDeltaLsb: Math.max(...rows.map((r) => r.maxAbsDeltaLsb ?? 0)),
    worstResidualDbfs: Math.max(...rows.map((r) => (r.residualDbfs ?? -Infinity))), rows }, null, 2));
  process.exit(0);
}
if (args[0] === '--compare') {
  const a = JSON.parse(fs.readFileSync(args[1], 'utf8'));
  const b = JSON.parse(fs.readFileSync(args[2], 'utf8'));
  let changed = 0;
  const rows = [];
  for (const name of Object.keys(a.moods)) {
    const candidateName = b.moods[name] ? name : Object.keys(b.moods).find(key => b.moods[key].legacyName === name);
    const candidate = b.moods[candidateName];
    const same = candidate && a.moods[name].pcmSha256 === candidate.pcmSha256;
    if (!same) changed++;
    rows.push({ name, candidateName: candidateName ?? null, owningBeat: candidate?.beat ?? null, identical: Boolean(same), before: a.moods[name].pcmSha256.slice(0, 16), after: candidate?.pcmSha256.slice(0, 16) ?? null });
  }
  const report = { before: args[1], after: args[2], moods: rows.length, changed, identical: rows.length - changed, rows };
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}
const outFile = args.find((a) => !a.startsWith('--'));
if (!outFile) {
  console.error('usage: audio-mood-identity-probe.mjs <out.json> [--only a,b] | --compare a.json b.json');
  process.exit(2);
}
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null;
// --wav <dir>: also pull every render's PCM16 WAV into <dir>/<name>.wav (name '/' → '__').
const wavIdx = args.indexOf('--wav');
const wavDir = wavIdx >= 0 ? args[wavIdx + 1] : null;
if (wavDir) fs.mkdirSync(wavDir, { recursive: true });
async function pullWav(page, bytes, file) {
  const chunks = [];
  let offset = 0;
  while (offset < bytes) {
    const b64 = await page.evaluate((o) => window.__scoreSoak.wavChunk(o), offset);
    if (!b64) break;
    const buf = Buffer.from(b64, 'base64');
    chunks.push(buf);
    offset += buf.length;
  }
  fs.writeFileSync(file, Buffer.concat(chunks));
}
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));

async function serverUp(port) {
  try { return (await fetch(`http://localhost:${port}/score-soak.html`)).ok; } catch { return false; }
}
let viteProc = null;
process.once('exit', () => { if (viteProc && !viteProc.killed) viteProc.kill(); });
async function freshPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
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
    cwd: root, stdio: 'ignore', env: { ...process.env, PROBE_NO_HMR: '1' }
  });
  for (let i = 0; i < 100; i++) {
    if (await serverUp(port)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('vite dev server did not come up');
}

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const probePort = await freshPort();
await startServer(probePort);
const browser = await chromium.launch({
  executablePath, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required', '--mute-audio']
});
let failed = false;
const summary = { generatedAt: new Date().toISOString(), seconds: null, count: 0, moods: {} };
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(600000);
  page.on('pageerror', (e) => { failed = true; console.log(`[pageerror] ${e.message}`); });
  await page.goto(`http://localhost:${probePort}/score-soak.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__scoreSoak), null, { timeout: 20000 });
  const names = await page.evaluate(() => window.__scoreSoak.moodIdentityNames);
  summary.count = names.length;
  for (let i = 0; i < names.length; i++) {
    if (only && !only.includes(names[i])) continue;
    const r = await page.evaluate((idx) => window.__scoreSoak.renderMoodIdentity(idx), i);
    summary.seconds = r.seconds;
    summary.moods[r.name] = { beat: r.beat, variant: r.variant, legacyName: r.legacyName, carrierAlive: r.carrierAlive, pcmSha256: r.pcmSha256, fingerprintSha256: r.fingerprintSha256, smoothness: r.analysis.smoothnessViolations, nan: r.analysis.nanCount, rms: r.analysis.rms, peak: r.analysis.peak };
    if (wavDir) await pullWav(page, r.wavBytes, path.join(wavDir, `${r.name.replace(/\//g, '__')}.wav`));
    console.log(`[${String(i + 1).padStart(2)}/${names.length}] ${r.name.padEnd(28)} pcm=${r.pcmSha256.slice(0, 16)} smooth=${r.analysis.smoothnessViolations}`);
  }
} finally {
  await browser.close();
  if (viteProc && !viteProc.killed) viteProc.kill();
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
console.log(`wrote ${outFile} (${Object.keys(summary.moods).length} moods of ${summary.count})`);
process.exit(failed ? 1 : 0);
