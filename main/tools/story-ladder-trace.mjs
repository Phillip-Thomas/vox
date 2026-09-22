// --- The story ladder trace ----------------------------------------------------------
//
// Records, per beat, everything the player is told and allowed: the published
// objective (id, marker label, work order, health, marker requirement), the
// marker text actually rendered, and the input policy — sampled over a short
// deep-link entry and de-duplicated into a list of distinct states.
//
// It is the determinism fingerprint for PARAVOXIA_STORY_PIPELINE_REFACTOR_PLAN.md,
// in the same role `proceduralWorldGeneratorDeterminism.test.ts` plays for
// terrain: a refactor that moves every table into one contract must leave this
// byte-identical. A diff here is a defect, not a refactor.
//
//   npm run story:ladder:trace                 # trace, write JSON, print hash
//   npm run story:ladder:trace -- --baseline   # record as the baseline
//   npm run story:ladder:trace -- --compare    # fail on any difference
//   PARAVOXIA_LADDER_BEATS=ch1-fixed,ch1-raster npm run story:ladder:trace

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';
import { CHROMIUM_ARGS, assertHardwareGl, chromePath, startParavoxiaPreview } from './lib/previewServer.mjs';

// Generated chapter view preserves the canonical declaration order.
const registry = JSON.parse(await readFile('chapter-registry.json', 'utf8'));
const ALL_BEATS = registry.chapters.flatMap(chapter => chapter.beats);

const args = process.argv.slice(2);
const baselineMode = args.includes('--baseline');
const compareMode = args.includes('--compare');
const beats = process.env.PARAVOXIA_LADDER_BEATS
  ? process.env.PARAVOXIA_LADDER_BEATS.split(',').map(v => v.trim()).filter(Boolean)
  : ALL_BEATS;
const sampleMs = Number(process.env.PARAVOXIA_LADDER_SAMPLE_MS ?? 100);
const windowMs = Number(process.env.PARAVOXIA_LADDER_WINDOW_MS ?? 6_000);
const outputDir = path.resolve(process.env.PARAVOXIA_LADDER_OUTPUT ?? 'captures/story-ladder');
// Extra query for every deep link, e.g. `worldprep=sync` to trace the ladder on
// the legacy synchronous boot regardless of the world-gen plan's progress.
const extraQuery = process.env.PARAVOXIA_LADDER_QUERY ? `&${process.env.PARAVOXIA_LADDER_QUERY}` : '';
// Production runs live at the REPO root's `.codex/`, one level above `main/`.
const baselinePath = path.resolve('..', '.codex/production-runs/2026-09-story-pipeline/ladder-baseline.json');

/** One sample of "what the player is told and allowed", read in the page. */
const SAMPLE = () => {
  const text = selector => {
    const node = document.querySelector(selector);
    if (!node) return null;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return null;
    return (node.textContent ?? '').replace(/\s+/g, ' ').trim() || null;
  };
  const objective = window.__storyObjective ?? null;
  const policy = window.__storyInputPolicy ?? null;
  return {
    beat: window.__storyBeat ?? null,
    objective: objective && {
      id: objective.id, kind: objective.kind, markerLabel: objective.markerLabel,
      workOrder: objective.workOrder, requiresMarker: objective.requiresMarker, health: objective.health
    },
    feedMarker: text('[data-regulation-objective-marker="true"]'),
    freeMarker: text('[data-hud-surface="free-marker"]'),
    feedWorkOrder: text('[data-hud-surface="feed-work-order"]'),
    policy: policy && {
      lookMode: policy.lookMode, moveSpeedScale: policy.moveSpeedScale,
      allowJump: policy.allowJump, allowSprint: policy.allowSprint, allowMine: policy.allowMine,
      allowBuild: policy.allowBuild, allowCraft: policy.allowCraft
    }
  };
};

await mkdir(outputDir, { recursive: true });
const preview = await startParavoxiaPreview({ build: !process.env.PARAVOXIA_URL && process.env.PARAVOXIA_LADDER_SKIP_BUILD !== '1' });
let browser;
const trace = {};
const failures = [];
try {
  browser = await chromium.launch({ headless: false, executablePath: chromePath(), args: CHROMIUM_ARGS });
  const check = await browser.newPage();
  await check.goto(preview.url, { waitUntil: 'domcontentloaded' });
  await assertHardwareGl(check);
  await check.close();
  for (const beat of beats) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const states = [];
    try {
      // AUTOPILOT OFF. With `movie=1` the screening acts inside the sample window and
      // the trace records WHEN it happened to act — a first compare diffed four
      // non-ch1 beats purely on that timing (campfire douse vs relay samples,
      // hatch entering vs boarding). The ladder is what the player is told and
      // allowed on ENTERING a beat; the rail's behaviour is the parity/rail tests' job.
      const url = `${preview.url}?story=${beat}&movie=0&profile=LOW${extraQuery}`;
      let attempt = 0;
      for (;;) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          break;
        } catch (error) {
          // The preview intermittently answers a navigation with a non-2xx
          // (ERR_HTTP_RESPONSE_CODE_FAILURE); retry rather than record a beat as empty.
          if (++attempt >= 3) throw error;
          await new Promise(resolve => setTimeout(resolve, 1_500));
        }
      }
      // Readiness is "the story is on this beat", not "the app is playing":
      // the prologue beats run over the menu and never reach `playing`, so a
      // phase wait burned the full timeout on each of them. Deep links set
      // `__storyBeat` synchronously; a beat that never appears is a failure
      // worth recording quickly, not a minute and a half of waiting.
      await page.waitForFunction(
        expected => window.__storyBeat === expected || window.__paravoxiaAppState?.phase === 'playing',
        beat,
        { timeout: 30_000 }
      );
      const deadline = Date.now() + windowMs;
      let last = null;
      while (Date.now() < deadline) {
        const sample = await page.evaluate(SAMPLE);
        // Marker distance suffixes ("· 12m") change every frame; strip them so
        // the trace records WHAT is designated, not how far away it happened to be.
        for (const key of ['feedMarker', 'freeMarker']) {
          if (sample[key]) sample[key] = sample[key].replace(/\s*·\s*\d+m\b/g, '');
        }
        const encoded = JSON.stringify(sample);
        if (encoded !== last) { states.push(sample); last = encoded; }
        await page.waitForTimeout(sampleMs);
      }
    } catch (error) {
      failures.push({ beat, error: String(error?.message ?? error) });
    }
    trace[beat] = states;
    console.log(`[ladder] ${beat.padEnd(14)} ${states.length} distinct state(s)`);
    await context.close();
  }
} finally {
  try { await browser?.close(); } finally { preview.stop(); }
}

const canonical = JSON.stringify(trace);
const hash = createHash('sha256').update(canonical).digest('hex').slice(0, 16);
const report = { generatedAt: new Date().toISOString(), beats, hash, failures, trace };
await writeFile(path.join(outputDir, 'ladder-trace.json'), JSON.stringify(report, null, 2));
console.log(`\n[ladder] hash ${hash}  (${beats.length} beats, ${failures.length} failure(s))`);

let exitCode = failures.length > 0 ? 1 : 0;
if (baselineMode) {
  await mkdir(path.dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, JSON.stringify({ generatedAt: report.generatedAt, hash, trace }, null, 2));
  console.log(`[ladder] baseline written: ${baselinePath}`);
}
if (compareMode) {
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  for (const beat of beats) {
    const before = JSON.stringify(baseline.trace?.[beat] ?? null);
    const after = JSON.stringify(trace[beat] ?? null);
    if (before !== after) {
      console.error(`[ladder] DIFF ${beat}`);
      console.error(`  baseline: ${before.slice(0, 400)}`);
      console.error(`  now:      ${after.slice(0, 400)}`);
      exitCode = 1;
    }
  }
  if (exitCode === 0) console.log('[ladder] identical to baseline');
}
process.exit(exitCode);
