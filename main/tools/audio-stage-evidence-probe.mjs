// Stage A/B evidence probe (audio-10x run): renders the stage-evidence set
// through the REAL engines on the score-soak harness, pulls each WAV and its
// metrics into an output folder.
//
//   node tools/audio-stage-evidence-probe.mjs <outDir> [--only a,b] [--glue off] [--quality lean] [--sweeps]
//                                              [--tap pre-tail|pre-stage-2] [--latency] [--glue-gain]
//                                              [--gains] [--ceiling] [--duck shipCrash,terminalCorrupt,oxygenCritical [--duck-story-lead]]
//                                              [--latency-rates 44100,48000]
//                                              [--stems] [--diagnostic-variant music-no-sfx|music-ducked|sfx-only|sum]
//                                              [--soak-minutes 32 --soak-seed 5 --soak-archetype verdant]
//                                              [--float32] (unchanged meter-input samples, no PCM16 clipping)
// --stems defaults to all five original stresses, both tiers, all four variants.
// Raw float32 WAVs, diagnostic JSON, and source hashes are exported; only sum is acceptance evidence.
//
// `--duck` takes SFX events and the source-only target `oxygenCritical` (raised
// by the oxygen body clock's critical breath, not by playSfx). Traces are 1 ms
// windows and report both raw times and times from the audible onset (S2-J3/J5).
//
// Owns a fresh HMR-off vite server on an ephemeral port (same pattern as
// audio-check-probe.mjs). One render at a time; nothing runs in parallel.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import crypto from 'node:crypto';
import { diagnosticScriptIdentity } from './lib/audioDiagnosticIdentity.mjs';

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--'));
if (!outDir) {
  console.error('usage: audio-stage-evidence-probe.mjs <outDir> [--only a,b] [--glue off] [--quality lean] [--sweeps]');
  process.exit(2);
}
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const soakMinutes = flag('soak-minutes') == null ? null : Number(flag('soak-minutes'));
const only = flag('only')?.split(',').filter(Boolean) ?? (soakMinutes != null ? [] : undefined);
if (flag('only') === '') { /* no renders */ }
const glue = flag('glue') === 'off' ? false : true;
const quality = flag('quality') === 'lean' ? 'lean' : 'full';
const stems = args.includes('--stems') || Boolean(flag('diagnostic-variant'));
const variants = flag('diagnostic-variant') ? [flag('diagnostic-variant')] : ['music-no-sfx', 'music-ducked', 'sfx-only', 'sum'];
if (variants.some(v => !['music-no-sfx', 'music-ducked', 'sfx-only', 'sum'].includes(v))) throw new Error('Unknown diagnostic variant');
const qualities = stems && !flag('quality') ? ['full', 'lean'] : [quality];
const sweeps = args.includes('--sweeps');
const glueGain = args.includes('--glue-gain');
// Stage 2: '--tap pre-tail' renders the music path BEFORE the mastering tail;
// '--latency' measures the tail's fixed look-ahead on both entry paths.
const tail = flag('tap') === 'pre-tail' ? 'pre-tail' : flag('tap') === 'pre-stage-2' ? 'pre-stage-2' : 'shipped';
const latency = args.includes('--latency');
/** Rates the tail latency is pinned at (mixTuning LATENCY_COMP_PINNED_RATES); override with --latency-rates a,b. */
const LATENCY_RATES = (flag('latency-rates')?.split(',').map(Number).filter(Boolean)) ?? [44100, 48000];
// '--gains' measures every tail stage's static gain; '--duck a,b' renders duck traces.
const gains = args.includes('--gains');
const duckEvents = flag('duck')?.split(',').filter(Boolean);
const duckStoryLead = args.includes('--duck-story-lead');
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const RENDER_TIMEOUT_MS = 600000;

async function serverUp(port) {
  try {
    const response = await fetch(`http://localhost:${port}/score-soak.html`);
    return response.ok && (await response.text()).includes('<title>Paravoxia score-soak harness</title>');
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
  const wav = Buffer.concat(chunks);
  if (wav.length !== bytes) throw new Error(`Incomplete WAV: ${wav.length}/${bytes} bytes`);
  fs.writeFileSync(file, wav);
  return crypto.createHash('sha256').update(wav).digest('hex');
}

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

fs.mkdirSync(outDir, { recursive: true });
if (stems && fs.existsSync(path.join(outDir, 'summary.json'))) throw new Error('Use a fresh directory for diagnostic evidence');
function sourceHashes() {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else files.push(file);
    }
  }
  walk(path.join(root, 'src'));
  files.push(new URL(import.meta.url).pathname, path.join(root, 'tools/lib/audioDiagnosticIdentity.mjs'), path.join(root, 'score-soak.html'));
  return Object.fromEntries(files.sort().map(file => [path.relative(root, file), crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
}
const sourceBefore = sourceHashes();
if (sourceBefore) fs.writeFileSync(path.join(outDir, 'source-hashes-before.json'), JSON.stringify(sourceBefore, null, 2));
const probePort = await freshPort();
await startServer(probePort);
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required', '--mute-audio']
});
let failed = false;
const summary = { generatedAt: new Date().toISOString(), glue, quality, tail, renders: {}, sweeps: null, ...(stems ? { diagnosticVariants: variants, qualities, measurement: 'OfflineAudioContext; no live rate limiter or live accepted-count evidence' } : {}) };
try {
  const page = await browser.newPage();
  summary.inputDeclarations = {};
  await page.exposeFunction('__recordAudioStressDeclaration', declaration => {
    const key = `${declaration.name}@${declaration.quality}@${declaration.variant}`;
    const entry = { declaredAt: new Date().toISOString(), beforeStressRender: true, declaration,
      declarationSha256: crypto.createHash('sha256').update(JSON.stringify(declaration)).digest('hex'),
      sourceFilesSha256: crypto.createHash('sha256').update(JSON.stringify(sourceBefore)).digest('hex') };
    summary.inputDeclarations[key] = entry;
    fs.writeFileSync(path.join(outDir, 'input-declarations.json'), JSON.stringify(summary.inputDeclarations, null, 2));
  });
  page.setDefaultTimeout(RENDER_TIMEOUT_MS);
  page.on('pageerror', (e) => {
    failed = true;
    console.log(`[pageerror] ${e.message}`);
  });
  page.on('console', (m) => {
    if (m.text().startsWith('[soak-page]')) console.log(m.text());
  });
  await page.goto(`http://localhost:${probePort}/score-soak.html`, { waitUntil: 'load' });
  if (await page.title() !== 'Paravoxia score-soak harness') throw new Error('Wrong application identity');
  await page.waitForFunction(() => Boolean(window.__scoreSoak), null, { timeout: 20000 });
  if (soakMinutes != null) {
    if (!Number.isFinite(soakMinutes) || soakMinutes < 32) throw new Error('Stage5 rendered soak requires at least32minutes.');
    summary.soak = await page.evaluate(({ minutes, seed, archetype, quality }) => window.__scoreSoak.runAudioSoak(minutes, seed, archetype, { listeningWindows: true, quality }), {
      minutes: soakMinutes, seed: Number(flag('soak-seed') ?? 5), archetype: flag('soak-archetype') ?? 'verdant', quality
    });
    for (const [index, excerpt] of (summary.soak.listeningWindows ?? []).entries()) {
      const bytes = await page.evaluate(i => window.__scoreSoak.selectSoakListeningWindow(i), index);
      const filename = `listening-${index + 1}.wav`;
      await pullWav(page, bytes, path.join(outDir, filename));
      excerpt.wavFile = filename;
    }
    if (!summary.soak.pass || summary.soak.listeningWindows?.length !== 2) failed = true;
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(`[soak] ${soakMinutes}min real render pass=${summary.soak.pass}; two unnormalized3min windows from120s/1320s`);
  }
  if (glueGain) {
    const g = await page.evaluate(() => window.__scoreSoak.measureGlueStaticGainDb());
    console.log(`[glue-gain] ${JSON.stringify(g)}`);
    summary.glueStaticGain = g;
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  }
  if (gains) {
    summary.tailStageGains = {};
    for (const stage of ['legacySafety', 'safety', 'limiter', 'tail']) {
      const g = await page.evaluate((st) => window.__scoreSoak.measureTailStageStaticGainDb(st), stage);
      console.log(`[gain ${stage}] baked ${g.bakedGainDb.toFixed(4)} dB | trimmed ${g.trimmedGainDb.toFixed(4)} dB — ${g.detail}`);
      summary.tailStageGains[stage] = g;
    }
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  }
  if (duckEvents) {
    summary.duckTraces = {};
    for (const ev of duckEvents) {
      const d = await page.evaluate(({ ev, lead }) => window.__scoreSoak.renderDuckTrace(ev, lead), { ev, lead: duckStoryLead });
      const ms = (v) => (v == null ? '-' : `${(v * 1000).toFixed(1)} ms`);
      console.log(
        `[duck ${ev}${duckStoryLead ? ' story-lead' : ''}] source=${d.source} expected=${d.expectedDb} dB @ ${d.expectedAttackS}s | ` +
          `window ${(d.windowS * 1000).toFixed(1)} ms | min ${d.minDb} dB at ${ms(d.minAtS)} raw | ` +
          `reached(expected+1) ${ms(d.reachedAtS)} raw / ${ms(d.onsetAdjusted?.reachedAtS)} from onset | ` +
          `full depth ${ms(d.fullDepthAtS)} raw / ${ms(d.onsetAdjusted?.fullDepthAtS)} from onset | ` +
          `dB at attack ${d.dbAtAttack} | recovered(-1 dB) ${ms(d.recoveredAtS)} raw / ${ms(d.onsetAdjusted?.recoveredAtS)} from onset ` +
          `(onset latency ${ms(d.onsetLatencyS)})`
      );
      summary.duckTraces[`${ev}${duckStoryLead ? '@story-lead' : ''}`] = d;
    }
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  }
  if (args.includes('--ceiling')) {
    summary.ceiling = {};
    for (const level of [-6, 0, 6, 12]) {
      const c = await page.evaluate((l) => window.__scoreSoak.measureCeilingTruePeakDbtp(l), level);
      console.log(`[ceiling ${level >= 0 ? '+' : ''}${level} dBFS] TP ${c.truePeakDbtp.toFixed(3)} dBTP, sample peak ${c.samplePeakDbfs.toFixed(3)} dBFS`);
      summary.ceiling[String(level)] = c;
    }
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  }
  if (latency) {
    // S2-D4: one measurement per pinned rate, each rendered AT that rate — the
    // tail's latency is part time-specified (compressor pre-delay) and part
    // sample-specified (oversampled shaper), so it may not be scaled by samples.
    summary.tailLatencyByRate = {};
    for (const rate of LATENCY_RATES) {
      const music = await page.evaluate((o) => window.__scoreSoak.measureTailLatencyS(o), { path: 'music', tail, glue, sampleRate: rate });
      const sfx = await page.evaluate((o) => window.__scoreSoak.measureTailLatencyS(o), { path: 'sfx', tail, glue, sampleRate: rate });
      console.log(
        `[latency ${rate} Hz] music ${(music.latencyS * 1000).toFixed(3)} ms (${music.latencySamples} samples) | ` +
          `sfx ${(sfx.latencyS * 1000).toFixed(3)} ms (${sfx.latencySamples} samples) | ` +
          `music-vs-sfx ${((music.latencyS - sfx.latencyS) * 1000).toFixed(3)} ms`
      );
      summary.tailLatencyByRate[String(rate)] = { music, sfx };
      // The evidence rate stays under the original key so ab-results keeps reading it.
      if (rate === 44100) summary.tailLatency = { music, sfx };
    }
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  }
  const availableNames = await page.evaluate(() => window.__scoreSoak.stageEvidenceNames);
  const names = only ?? availableNames.filter(name => !stems || name.startsWith('stress-'));
  if (names.some(name => !availableNames.includes(name) || (stems && !name.startsWith('stress-')))) throw new Error('Unknown or non-stress diagnostic name');
  const jobs = names.flatMap(name => qualities.flatMap(tier => (stems ? variants : [undefined]).map(diagnosticVariant => ({ name, glue, quality: tier, tail, float32: args.includes('--float32'), ...(diagnosticVariant ? { diagnosticVariant } : {}) }))));
  const matchingGroups = new Map();
  for (const spec of jobs) {
    const { name } = spec;
    const meta = await page.evaluate((spec) => window.__scoreSoak.renderStageEvidence(spec), spec);
    const wavFile = path.join(outDir, `${meta.fileStem}.wav`);
    const wavSha256 = await pullWav(page, meta.wavBytes, wavFile);
    const { wavBytes: _w, ...rest } = meta;
    const l = meta.loudness;
    console.log(
      `[${name}] I=${l.integratedLufs.toFixed(2)} S-max=${l.shortTermMaxLufs.toFixed(2)} LRA=${l.loudnessRangeLu.toFixed(2)} ` +
        `S-at=${(l.shortTermMaxAtS ?? 0).toFixed(1)}s TP=${l.truePeakDbtp.toFixed(2)} corr=${l.correlation.toFixed(3)} bands=[${l.spectral.bandFractions.map((b) => b.toFixed(3)).join(',')}] ` +
        `smooth=${meta.analysis.smoothnessViolations} pcm=${meta.pcmSha256.slice(0, 12)} fp=${meta.fingerprintSha256.slice(0, 12)}`
    );
    const key = stems ? `${name}@${spec.quality}@${spec.diagnosticVariant}` : name;
    // A rejected row is still evidence. Keep its exact observations and WAV
    // binding before checking whether its inputs match the other variants.
    summary.renders[key] = { ...rest, wavFile: path.basename(wavFile), wavSha256 };
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    if (stems) {
      const d = meta.diagnostics;
      const group = `${name}@${spec.quality}`;
      fs.writeFileSync(path.join(outDir, `${meta.fileStem}.diagnostics.json`), JSON.stringify({ ...d, loudness: meta.loudness, wavSha256 }, null, 2));
      const identity = diagnosticScriptIdentity(meta);
      if (matchingGroups.has(group) && matchingGroups.get(group) !== identity) throw new Error(`Nonmatching diagnostic scripts: ${group}`);
      matchingGroups.set(group, identity);
    }
  }
  if (sweeps) {
    const s1 = await page.evaluate(() => window.__scoreSoak.runSmoothnessSweep());
    const s2 = await page.evaluate(() => window.__scoreSoak.runEraBuildSmoothnessSweep());
    const s3 = await page.evaluate(() => window.__scoreSoak.runStoryHandoffSmoothnessSweep('combined'));
    summary.sweeps = { sandbox: s1, eraBuild: s2, storyHandoff: s3 };
    for (const [k, v] of Object.entries(summary.sweeps)) {
      console.log(`[sweep ${k}] ${JSON.stringify(v).slice(0, 400)}`);
    }
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  }
} finally {
  try {
    await browser.close();
  } finally {
    if (viteProc && !viteProc.killed) viteProc.kill();
    if (sourceBefore) {
      const sourceAfter = sourceHashes();
      fs.writeFileSync(path.join(outDir, 'source-hashes-after.json'), JSON.stringify(sourceAfter, null, 2));
      summary.sourceUnchanged = JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter);
      if (!summary.sourceUnchanged) { failed = true; console.error('Source changed during diagnostic rendering; outputs are not a frozen evidence set'); }
      fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    }
  }
}
console.log(`${failed ? 'FAIL' : 'DONE'} -> ${outDir}`);
process.exit(failed ? 1 : 0);
