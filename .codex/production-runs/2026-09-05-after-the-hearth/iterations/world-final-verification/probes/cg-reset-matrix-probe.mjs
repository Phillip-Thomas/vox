#!/usr/bin/env node
/**
 * Reset-matrix probe for the signed ch13 guidance objectives.
 *
 * For one beat it drives the runtime to whatever objective is actually
 * published, then applies each contracted reset trigger and records whether the
 * objective, its marker, and its one-shot entry cue survive. Nothing is
 * asserted that was not observed; an unreached objective is recorded as
 * `not-reached`, never as a pass.
 *
 * Triggers (all eight are signed for every ch13 objective):
 *   beat-exit   navigate to a different beat and read back
 *   deep-link   cold load of this beat's deep link
 *   replay      re-enter the same deep link in the same session
 *   pause       the runtime's own pause path (Escape)
 *   quit        leave to the menu / sandbox entry
 *   focus-loss  real visibilitychange + blur on the page
 *   completion  read state after the beat's completion anchor, when reached
 *   sandbox     plain load with no ?story= at all (story never started)
 *
 *   node cg-reset-matrix-probe.mjs --beat ch13-survey --out reset-survey
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import process from 'node:process';
import { loadContract, objectiveExpectations, ART, CAPTURES } from './lib/cgContract.mjs';
import { openParavoxia, waitReady, readState } from '../../../../../main/tools/lib/evidence.mjs';

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = (m) => console.log(`[cg-reset] ${m}`);

const beat = arg('beat', 'ch13-home');
const otherBeat = arg('other-beat', 'ch10-cold');
const settleS = Number(arg('settle-s', '14'));
const outName = arg('out', `reset-${beat}`);

const ownership = JSON.parse(readFileSync(resolve(ART, 'preview-ownership.json'), 'utf8'));
if (ownership.state !== 'running') throw new Error(`owned preview is ${ownership.state}`);
const baseUrl = ownership.url;
const { contract, sha256: contractSha } = loadContract();
const expectations = objectiveExpectations(contract);

const outDir = resolve(CAPTURES, outName);
mkdirSync(outDir, { recursive: true });

const session = await openParavoxia({
  url: `?story=${beat}&movie=1&journeyprobe=1&debug=1`,
  preview: { url: baseUrl, stop() {} }, build: false, log: tag
});
const { page } = session;

async function guidance() {
  const s = await readState(page);
  const extra = await page.evaluate(() => {
    const hud = document.querySelector('[data-story-guidance-hud]');
    let sfxEnter = null;
    try { sfxEnter = window.__voxSfxTrace?.()?.triggerCounts?.objectiveEnter ?? null; } catch { /* read-only */ }
    let av = null;
    try { av = window.__paravoxiaJourneyProbe?.getSnapshot?.()?.state?.signedSceneAv ?? null; } catch { /* read-only */ }
    return {
      objectiveId: hud?.getAttribute('data-objective-id') ?? null,
      markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
      health: hud?.getAttribute('data-objective-health') ?? null,
      requiresMarker: hud?.getAttribute('data-objective-requires-marker') ?? null,
      hudPresent: Boolean(hud),
      sfxEnter, av
    };
  });
  return { beat: s.beat, ...extra, capturedAt: new Date().toISOString() };
}

async function goto(query, { settle = settleS } = {}) {
  await page.goto(`${baseUrl}${query}`, { waitUntil: 'load', timeout: 180_000 });
  await waitReady(page, { timeoutMs: 180_000 });
  await sleep(settle * 1000);
}

const results = [];
const record = (trigger, before, after, notes) => {
  const row = {
    trigger, beat,
    objectiveBefore: before?.objectiveId ?? null,
    markerBefore: before?.markerLabel ?? null,
    objectiveAfter: after?.objectiveId ?? null,
    markerAfter: after?.markerLabel ?? null,
    healthAfter: after?.health ?? null,
    avAnchorAfter: after?.av?.anchorId ?? null,
    avActiveAfter: after?.av?.active ?? null,
    sfxEnterBefore: before?.sfxEnter ?? null,
    sfxEnterAfter: after?.sfxEnter ?? null,
    staleSameObjectiveStillActive:
      Boolean(before?.objectiveId) && before?.objectiveId === after?.objectiveId,
    notes,
    observedAt: new Date().toISOString()
  };
  results.push(row);
  tag(`${trigger}: before=${row.objectiveBefore} after=${row.objectiveAfter} health=${row.healthAfter}`);
  return row;
};

await waitReady(page, { timeoutMs: 180_000 });
await sleep(settleS * 1000);

// deep-link (this session's cold entry)
let before = await guidance();
record('deep-link', null, before, 'cold deep link entry state; a published objective must be this beat\'s own');

// beat-exit
let stateBefore = await guidance();
await goto(`?story=${otherBeat}&movie=1&journeyprobe=1&debug=1`);
record('beat-exit', stateBefore, await guidance(), `navigated to ${otherBeat}`);

// replay (return to the same deep link within one session)
await goto(`?story=${beat}&movie=1&journeyprobe=1&debug=1`);
stateBefore = await guidance();
await goto(`?story=${beat}&movie=1&journeyprobe=1&debug=1`);
record('replay', stateBefore, await guidance(), 're-entered the same deep link');

// pause (runtime pause path)
stateBefore = await guidance();
await page.keyboard.press('Escape');
await sleep(2500);
record('pause', stateBefore, await guidance(), 'Escape pressed; runtime pause surface');
await page.keyboard.press('Escape');
await sleep(2000);

// focus-loss (real visibility + blur)
stateBefore = await guidance();
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  Object.defineProperty(document, 'hidden', { value: true, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('blur'));
});
await sleep(3000);
record('focus-loss', stateBefore, await guidance(), 'visibilitychange hidden + window blur');
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('focus'));
});
await sleep(2000);

// quit (leave to the entry surface)
await goto(`?story=${beat}&movie=1&journeyprobe=1&debug=1`);
stateBefore = await guidance();
await goto('?journeyprobe=1&debug=1');
record('quit', stateBefore, await guidance(), 'left the story to the plain entry surface');

// sandbox (story never started)
await goto('?journeyprobe=1&debug=1');
record('sandbox', null, await guidance(), 'plain load, no ?story= at all: the chapter must not publish here');

// completion is only recordable if the beat actually completes; the focused
// journey probes own that observation. Recorded here as not-observed.
record('completion', null, null, 'not observed by this probe; see the focused chapter journey runs');

const summary = {
  schema: 'paravoxia.verifier.cgResetMatrix.v0',
  runId: '2026-09-05-after-the-hearth',
  contractSha256: contractSha,
  beat,
  preview: { url: baseUrl, indexSha256: ownership.indexSha256 },
  renderer: session.renderer,
  rendererClass: /swiftshader|software|llvmpipe/i.test(String(session.renderer)) ? 'software' : 'hardware',
  contractedTriggers: [...new Set([...expectations.values()].flatMap((o) => o.resetTriggers))],
  results,
  capturedAt: new Date().toISOString()
};
writeFileSync(join(outDir, 'reset-matrix.json'), `${JSON.stringify(summary, null, 2)}\n`);
tag(`wrote ${join(outDir, 'reset-matrix.json')}`);
await session.stop();
