// Continuous real-input story -> done -> chapter10 -> station evidence.
// Docking changes documents. Preserve each document's measurement epoch so
// navigation cannot erase an earlier stuck signal or erase half the movie.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { CHROMIUM_ARGS, assertHardwareGl, chromePath, startParavoxiaPreview } from './lib/previewServer.mjs';

const capMs = Number(process.env.PARAVOXIA_SEAM_CAP_SECONDS ?? 2100) * 1000;
const profile = process.env.PARAVOXIA_SEAM_PROFILE ?? 'LOW';
const outputDir = path.resolve(process.env.PARAVOXIA_SEAM_OUTPUT ?? 'captures/beat-seams-recovery');
const threshold = Number(process.env.PARAVOXIA_SEAM_THRESHOLD_MS ?? 100);
const INIT = () => {
  const key = 'paravoxia:seam-measurement-epochs';
  let previous = [];
  try { previous = JSON.parse(sessionStorage.getItem(key) ?? '[]'); sessionStorage.removeItem(key); } catch { /* first document */ }
  const epoch = { url: location.href, timeOrigin: performance.timeOrigin, frames: [], beatLog: [] };
  const snapshot = () => ({ ...epoch, backstops: window.__railBackstops ?? [], stuck: window.__railStuck ?? [],
    station: window.__stationScreening ?? null, autopilot: window.__autopilot ?? null });
  window.__seamEpochs = () => [...previous, snapshot()];
  addEventListener('pagehide', () => sessionStorage.setItem(key, JSON.stringify([...previous, snapshot()])));
  (function tick(t) {
    epoch.frames.push(t);
    const beat = window.__stationScreening ? `station:${window.__stationScreening.phase}` : window.__storyBeat ?? null;
    const log = epoch.beatLog;
    if (!log.length || log.at(-1).beat !== beat) log.push({ beat, t });
    requestAnimationFrame(tick);
  })(performance.now());
};
await mkdir(outputDir, { recursive: true });
const preview = await startParavoxiaPreview({ build: process.env.PARAVOXIA_SEAM_SKIP_BUILD !== '1' && !process.env.PARAVOXIA_URL });
const buildAssets = {};
for (const file of await readdir('dist/assets')) if (/\.(js|css)$/.test(file)) {
  buildAssets[file] = createHash('sha256').update(await readFile(`dist/assets/${file}`)).digest('hex');
}
const browser = await chromium.launch({ headless: false, executablePath: chromePath(), args: CHROMIUM_ARGS });
let epochs = [];
let completed = false;
let renderer;
const errors = [];
const samples = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await context.addInitScript(INIT);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${preview.url}?story=1&movie=1&profile=${profile}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  renderer = await assertHardwareGl(page);
  const startedAt = Date.now();
  let lastBeat = null;
  while (Date.now() - startedAt < capMs) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => ({ beat: window.__storyBeat ?? null,
      station: window.__stationScreening ?? null, backstops: window.__railBackstops ?? [],
      stuck: window.__railStuck ?? [], objective: window.__storyObjective ?? null,
      autopilot: window.__autopilot ?? null })).catch(() => null);
    if (!state) continue; // execution context replaced by the real docking navigation
    samples.push({ seconds: (Date.now() - startedAt) / 1000, url: page.url(), ...state });
    const beat = state.station ? `station:${state.station.phase}` : state.beat;
    if (beat !== lastBeat) {
      console.log(`[seams] ${Math.round((Date.now() - startedAt) / 1000)}s ${beat}`);
      lastBeat = beat;
      await page.screenshot({ path: path.join(outputDir, `${samples.length}-${String(beat).replaceAll(':', '-')}.png`) });
    }
    epochs = await page.evaluate(() => window.__seamEpochs?.() ?? []).catch(() => epochs);
    if (state.station?.completed) { completed = true; break; }
    if (state.station?.stuck || state.stuck.length || state.backstops.length || errors.length) break;
  }
  await page.screenshot({ path: path.join(outputDir, 'final.png') });
  epochs = await page.evaluate(() => window.__seamEpochs?.() ?? []).catch(() => epochs);
  await context.close();
} finally { await browser.close(); preview.stop(); }

const rows = [];
const durations = [];
for (const [epochIndex, epoch] of epochs.entries()) {
  for (let i = 1; i < epoch.beatLog.length; i++) {
    const from = epoch.beatLog[i - 1], to = epoch.beatLog[i];
    let max = 0;
    for (let f = 1; f < epoch.frames.length; f++) {
      const t = epoch.frames[f];
      if (t > to.t - 2000 && t < to.t + 2000) max = Math.max(max, t - epoch.frames[f - 1]);
    }
    rows.push({ epoch: epochIndex, from: from.beat ?? '(load)', to: to.beat, maxGapMs: Math.round(max), at: Math.round(to.t) });
    if (from.beat) durations.push({ beat: from.beat, seconds: (to.t - from.t) / 1000 });
  }
}
const backstops = epochs.flatMap(epoch => epoch.backstops);
const stuck = epochs.flatMap(epoch => epoch.stuck);
const stationStuck = epochs.map(epoch => epoch.station?.stuck).filter(Boolean);
const seamFailures = rows.filter(row => row.from !== '(load)' && row.maxGapMs > threshold);
let timingComparison = null;
if (process.env.PARAVOXIA_SEAM_TIMING_BASELINE) {
  const baselineFile = path.resolve(process.env.PARAVOXIA_SEAM_TIMING_BASELINE);
  const bytes = await readFile(baselineFile);
  const baseline = JSON.parse(bytes);
  // Explicit measured durations only. Objective-only ladder fingerprints are
  // never relabelled as elapsed-time evidence.
  if (!Array.isArray(baseline.durations)) throw new Error('Timing baseline must carry measured durations[].');
  timingComparison = { source: baselineFile, sha256: createHash('sha256').update(bytes).digest('hex'), rows: baseline.durations.map(expected => {
    const actual = durations.find(row => row.beat === expected.beat);
    const relativeDelta = actual && expected.seconds > 0 ? Math.abs(actual.seconds - expected.seconds) / expected.seconds : null;
    return { beat: expected.beat, expectedSeconds: expected.seconds, actualSeconds: actual?.seconds ?? null,
      relativeDelta, ok: relativeDelta !== null && relativeDelta <= 0.1 };
  }) };
}
const result = { generatedAt: new Date().toISOString(), profile, renderer, buildAssets, threshold, capMs,
  completed, rows, durations, backstops, stuck, stationStuck, errors, timingComparison, epochs, samples,
  completionGate: completed && !backstops.length && !stuck.length && !stationStuck.length && !errors.length,
  seamGate: !seamFailures.length,
  timingGate: timingComparison === null ? null : timingComparison.rows.every(row => row.ok) };
await writeFile(path.join(outputDir, 'beat-seams.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ completed, backstops: backstops.length, stuck: stuck.length, stationStuck,
  seamFailures, timingGate: result.timingGate, errors }));
// A missing timing reference is explicitly unproved, never a passed full-plan gate.
process.exitCode = result.completionGate && result.seamGate && result.timingGate === true ? 0 : 1;
