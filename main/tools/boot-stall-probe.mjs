// --- The boot-stall probe ------------------------------------------------------------
//
// Measures main-thread long tasks during a cold entry to a story beat. This is
// the gate for PARAVOXIA_WORLD_GEN_OFFTHREAD_PLAN.md: every batch must move the
// numbers it prints, and none may move the terrain fingerprint.
//
// Baseline measured 2026-09-04 (LOW, 1280x720, real GB10 GPU): every cold entry
// costs 2.9-3.6s of long tasks, one ~1.75s block plus 3-4 of 300-650ms, from
// synchronous procedural generation on the main thread.
//
//   npm run perf:boot                       # measure, print, write JSON
//   npm run perf:boot -- --baseline         # also record as the baseline
//   npm run perf:boot -- --compare          # fail if worse than the baseline
//   PARAVOXIA_BOOT_BEATS=descent,ch5-maw npm run perf:boot

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';
import { CHROMIUM_ARGS, assertHardwareGl, chromePath, startParavoxiaPreview } from './lib/previewServer.mjs';

const args = process.argv.slice(2);
const baselineMode = args.includes('--baseline');
const compareMode = args.includes('--compare');
// `--baseline` measures the LEGACY synchronous boot on the same build via the
// `?worldprep=sync` probe affordance, so baseline and candidate are an honest
// A/B rather than two checkouts. PARAVOXIA_BOOT_MODE=sync forces it for any run.
const bootMode = baselineMode ? 'sync' : (process.env.PARAVOXIA_BOOT_MODE ?? 'worker');
const extraQuery = bootMode === 'sync' ? '&worldprep=sync' : '';
const beats = (process.env.PARAVOXIA_BOOT_BEATS ?? 'descent,ch3-dusk,ch8-crossing')
  .split(',').map(v => v.trim()).filter(Boolean);
const runs = Number(process.env.PARAVOXIA_BOOT_RUNS ?? 3);
const profile = process.env.PARAVOXIA_BOOT_PROFILE ?? 'LOW';
const settleMs = Number(process.env.PARAVOXIA_BOOT_SETTLE_MS ?? 8_000);
const outputDir = path.resolve(process.env.PARAVOXIA_BOOT_OUTPUT ?? 'captures/boot-stall');
const baselinePath = path.resolve('tools/baselines/boot-stall.json');

/** Regressions smaller than this are noise on a shared machine. */
const COMPARE_TOLERANCE = 0.15;

const INIT = `
window.__longTasks = [];
new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    window.__longTasks.push([Math.round(entry.startTime), Math.round(entry.duration)]);
  }
}).observe({ entryTypes: ['longtask'] });
`;

await mkdir(outputDir, { recursive: true });
const preview = await startParavoxiaPreview({ build: !process.env.PARAVOXIA_URL });
const browser = await chromium.launch({ headless: true, executablePath: chromePath(), args: CHROMIUM_ARGS });
{
  // Fail fast on a software renderer: see CHROMIUM_ARGS.
  const check = await browser.newPage();
  await check.goto(preview.url, { waitUntil: 'domcontentloaded' });
  await assertHardwareGl(check);
  await check.close();
}

const results = [];
try {
  for (const beat of beats) {
    for (let run = 0; run < runs; run++) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      await context.addInitScript(INIT);
      const page = await context.newPage();
      const url = `${preview.url}?story=${beat}&movie=1&profile=${profile}${extraQuery}`;
      const startedAt = Date.now();
      let failure = null;
      let tasks = [];
      const badResponses = [];
      page.on('response', response => {
        if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url().slice(-80)}`);
      });
      try {
        // A transient non-2xx from the preview showed up once as
        // ERR_HTTP_RESPONSE_CODE_FAILURE; retry rather than record a bogus zero.
        let attempt = 0;
        for (;;) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
            break;
          } catch (error) {
            if (++attempt >= 3) throw error;
            console.warn(`[boot-stall] goto retry ${attempt} for ${beat}: ${String(error?.message ?? error).slice(0, 90)}`);
            await new Promise(resolve => setTimeout(resolve, 1_500));
          }
        }
        await page.waitForFunction(
          () => window.__paravoxiaAppState?.phase === 'playing',
          undefined,
          { timeout: 90_000 }
        );
        await page.waitForTimeout(settleMs);
        tasks = await page.evaluate(() => window.__longTasks);
      } catch (error) {
        failure = String(error?.message ?? error);
      }
      const totalMs = tasks.reduce((sum, [, d]) => sum + d, 0);
      const largestMs = tasks.reduce((max, [, d]) => Math.max(max, d), 0);
      if (badResponses.length) failure = (failure ? failure + '; ' : '') + `bad responses: ${badResponses.slice(0, 3).join(', ')}`;
      results.push({ beat, run, mode: bootMode, totalMs, largestMs, count: tasks.length, tasks, failure, wallMs: Date.now() - startedAt });
      console.log(
        `[boot-stall] ${beat.padEnd(14)} run ${run}: total ${String(totalMs).padStart(5)}ms`
        + `  largest ${String(largestMs).padStart(5)}ms  (${tasks.length} tasks)${failure ? `  FAILED: ${failure}` : ''}`
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
  preview.stop();
}

/** Median across runs, per beat — the number the plan's gates compare. */
function summarise(entries) {
  const byBeat = {};
  for (const beat of beats) {
    const own = entries.filter(e => e.beat === beat && !e.failure);
    const median = key => {
      const sorted = own.map(e => e[key]).sort((a, b) => a - b);
      return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    };
    byBeat[beat] = { totalMs: median('totalMs'), largestMs: median('largestMs'), runs: own.length };
  }
  return byBeat;
}

const summary = summarise(results);
const report = { generatedAt: new Date().toISOString(), mode: bootMode, profile, viewport: '1280x720', beats, runs, summary, results };
await writeFile(path.join(outputDir, 'boot-stall.json'), JSON.stringify(report, null, 2));
console.log(`\n[boot-stall] mode=${bootMode} median per beat:`);
for (const [beat, s] of Object.entries(summary)) {
  console.log(`  ${beat.padEnd(14)} total ${String(s.totalMs).padStart(5)}ms  largest ${String(s.largestMs).padStart(5)}ms  (${s.runs} runs)`);
}

if (baselineMode) {
  await mkdir(path.dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, JSON.stringify({ generatedAt: report.generatedAt, mode: bootMode, profile, summary }, null, 2));
  console.log(`[boot-stall] baseline written: ${baselinePath}`);
}

let exitCode = results.some(r => r.failure) ? 1 : 0;
if (compareMode) {
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  for (const [beat, s] of Object.entries(summary)) {
    const b = baseline.summary?.[beat];
    if (!b || s.totalMs === null) continue;
    for (const key of ['totalMs', 'largestMs']) {
      if (s[key] > b[key] * (1 + COMPARE_TOLERANCE)) {
        console.error(`[boot-stall] REGRESSION ${beat} ${key}: ${s[key]}ms vs baseline ${b[key]}ms`);
        exitCode = 1;
      }
    }
  }
}
process.exit(exitCode);
