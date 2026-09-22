#!/usr/bin/env node
/**
 * Common Ground (ch13) lifecycle / anchor / capture probe — run-local to
 * 2026-09-05-after-the-hearth.
 *
 * One long-running browser session per invocation against the ONE owned
 * preview URL (see cg-preview-daemon.mjs). It records, frame-stamped:
 *   - the live beat, objective id / marker label / work order / health / revision
 *   - signed-AV anchor activation (id, event, sequence, history)
 *   - objective entry acknowledgement emissions, counted from the runtime's own
 *     SFX queue trace (`__voxSfxTrace`) — a queue observation, never a hearing
 *     claim
 *   - milestones, receipts, player/actor pose, prompts, captions
 * and writes a state-transition ledger plus before/at/after frames at every
 * anchor change.
 *
 * It asserts nothing about taste. Contract expectations are read from the
 * signed scene-contract.json bytes.
 *
 *   node cg-lifecycle-probe.mjs --beat ch13-survey --lane movie --seconds 180 \
 *        --variant desktop --out survey-movie-1
 */
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';
import {
  loadContract, objectiveExpectations, anchorsByBeat, contingentAnchorIds,
  ART, CAPTURES, MAIN
} from './lib/cgContract.mjs';
import { openParavoxia, waitReady, readState, frameStats, SWIFTSHADER, CAPTURE_TIER } from '../../../../../main/tools/lib/evidence.mjs';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
};
const has = (n) => process.argv.includes(`--${n}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = (m) => console.log(`[cg-probe] ${m}`);

const beat = arg('beat', 'ch13-home');
const lane = arg('lane', 'movie');
const seconds = Number(arg('seconds', '180'));
const variant = arg('variant', 'desktop');          // desktop | mobile | reduced-motion
const tier = arg('tier', null);                      // quality tier query, when in scope
const outName = arg('out', `${beat}-${lane}-${variant}`);
const sampleMs = Number(arg('sample-ms', '100'));
const stripS = Number(arg('strip-s', '0'));          // >0 adds a periodic coverage strip
const extraQuery = arg('query', '');
const noShots = has('no-shots');

const ownership = JSON.parse(readFileSync(resolve(ART, 'preview-ownership.json'), 'utf8'));
if (ownership.state !== 'running') throw new Error(`owned preview is ${ownership.state}, not running`);
const baseUrl = ownership.url;

const { contract, sha256: contractSha } = loadContract();
const expectations = objectiveExpectations(contract);
const beatAnchors = anchorsByBeat(contract).get(beat) ?? [];
const contingent = new Set(contingentAnchorIds(contract));

const outDir = resolve(CAPTURES, outName);
mkdirSync(outDir, { recursive: true });
const tracePath = join(outDir, 'trace.ndjson');
writeFileSync(tracePath, '');
const frames = [];
const events = [];

const viewport = variant === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const query = new URLSearchParams({ story: beat, journeyprobe: '1', debug: '1' });
if (lane === 'movie') query.set('movie', '1');
if (tier) query.set('quality', tier);
for (const kv of extraQuery.split('&').filter(Boolean)) {
  const [k, v = '1'] = kv.split('=');
  query.set(k, v);
}
const url = `?${query.toString()}`;

tag(`beat=${beat} lane=${lane} variant=${variant}${tier ? ` tier=${tier}` : ''} url=${baseUrl}${url}`);

const session = await openParavoxia({
  url,
  preview: { url: baseUrl, stop() {} },
  build: false,
  viewport,
  isMobile: variant === 'mobile',
  reducedMotion: variant === 'reduced-motion' ? 'reduce' : 'no-preference',
  log: tag
});
const { page } = session;
await waitReady(page, { timeoutMs: 180_000 });

/** In-page read: everything the runtime already publishes. No mutation. */
async function sample() {
  const base = await readState(page);
  const extra = await page.evaluate(() => {
    const out = {};
    try {
      const s = window.__paravoxiaJourneyProbe?.getSnapshot?.();
      if (s) {
        out.objectiveFull = s.objective ?? null;
        out.avFull = s.state?.signedSceneAv ?? null;
        out.receipts = s.receipts ?? null;
        out.entities = Array.isArray(s.entities)
          ? s.entities.map((e) => ({ id: e.id, kind: e.kind ?? null, pos: e.position ?? e.pos ?? null }))
          : null;
        out.prompts = s.interaction?.prompts ?? null;
        out.visiblePromptCount = s.interaction?.visiblePromptCount ?? null;
        out.interactionTrace = (s.interaction?.trace?.entries ?? []).slice(-6);
        out.input = s.input ? { keys: s.input.keys ?? null, mode: s.input.mode ?? null } : null;
      }
    } catch (e) { out.snapshotError = String(e).slice(0, 160); }
    try {
      const lc = window.__voxObjectiveLifecycle?.();
      if (lc) {
        out.objectiveLifecycleTrace = lc.map((e) => ({ ...e }));
        out.objectiveLifecycleCount = lc.length;
      }
    } catch { /* read-only */ }
    try {
      const t = window.__voxSfxTrace?.();
      if (t) {
        out.sfxTriggerCounts = t.triggerCounts ?? null;
        out.sfxRecent = (t.events ?? []).slice(-8);
        out.sfxTotal = (t.events ?? []).length;
      }
    } catch { /* read-only */ }
    try {
      const hud = document.querySelector('[data-story-guidance-hud]');
      if (hud) {
        out.hud = {
          objectiveId: hud.getAttribute('data-objective-id'),
          markerLabel: hud.getAttribute('data-objective-marker-label'),
          health: hud.getAttribute('data-objective-health'),
          requiresMarker: hud.getAttribute('data-objective-requires-marker'),
          lines: [...hud.querySelectorAll('li, p, span')]
            .map((n) => n.textContent.trim()).filter(Boolean)
        };
      } else out.hud = null;
    } catch { /* read-only */ }
    return out;
  });
  return { ...base, ...extra, tMs: Date.now() };
}

async function shoot(label) {
  if (noShots) return null;
  const file = join(outDir, `${String(frames.length).padStart(4, '0')}-${label.replace(/[^\w.-]+/g, '_')}.png`);
  const bytes = await page.screenshot({ path: file });
  const stats = frameStats(bytes);
  const rec = {
    file, label, sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length, stats, atMs: Date.now()
  };
  frames.push(rec);
  return rec;
}

const started = Date.now();
let last = null;
let lastAnchor = null;
let lastStrip = 0;
let pendingAfterShot = null;
const objectiveEntries = [];       // one record per objective ENTER
const anchorLedger = [];

function noteEvent(type, payload) {
  const rec = { type, atMs: Date.now(), elapsedMs: Date.now() - started, ...payload };
  events.push(rec);
  appendFileSync(tracePath, `${JSON.stringify({ kind: 'event', ...rec })}\n`);
  tag(`${type} ${JSON.stringify(payload).slice(0, 220)}`);
  return rec;
}

while (Date.now() - started < seconds * 1000) {
  const s = await sample();
  appendFileSync(tracePath, `${JSON.stringify({ kind: 'sample', elapsedMs: Date.now() - started, s })}\n`);

  const objId = s.hud?.objectiveId ?? s.objectiveId ?? null;
  const label = s.hud?.markerLabel ?? s.markerLabel ?? null;
  const workOrder = s.objectiveFull?.workOrder ?? null;
  const anchor = s.avFull?.anchorId ?? null;
  const sfxEnter = s.sfxTriggerCounts?.objectiveEnter ?? 0;

  if (pendingAfterShot && Date.now() >= pendingAfterShot.at) {
    await shoot(`after-${pendingAfterShot.label}`);
    pendingAfterShot = null;
  }

  if (!last || last.objId !== objId) {
    if (last?.objId) {
      noteEvent('objective-clear', { objectiveId: last.objId, beat: s.beat, anchor });
    }
    if (objId) {
      const exp = expectations.get(objId) ?? null;
      const entry = {
        objectiveId: objId, atMs: Date.now(), elapsedMs: Date.now() - started,
        beat: s.beat, enterAnchor: anchor,
        markerLabel: label, workOrder,
        health: s.hud?.health ?? null, requiresMarker: s.hud?.requiresMarker ?? null,
        sfxObjectiveEnterAtEntry: sfxEnter,
        expectedMarkerLabel: exp?.markerLabel ?? null,
        expectedWorkOrder: exp?.workOrder ?? null,
        conditionalWorkOrders: exp?.conditionalWorkOrders ?? [],
        textStates: []
      };
      objectiveEntries.push(entry);
      noteEvent('objective-enter', { objectiveId: objId, markerLabel: label, workOrder, anchor });
      if (!noShots) await shoot(`obj-enter-${objId}`);
    }
  } else if (objId && JSON.stringify(last.workOrder) !== JSON.stringify(workOrder)) {
    const entry = objectiveEntries[objectiveEntries.length - 1];
    const change = {
      atMs: Date.now(), elapsedMs: Date.now() - started,
      from: last.workOrder, to: workOrder,
      markerLabelBefore: last.label, markerLabelAfter: label,
      anchor, sfxObjectiveEnterCount: sfxEnter
    };
    entry?.textStates.push(change);
    noteEvent('objective-text-change', { objectiveId: objId, to: workOrder, markerLabel: label, anchor, sfxEnterCount: sfxEnter });
    if (!noShots) await shoot(`obj-text-${objId}`);
  } else if (objId && last.label !== label) {
    noteEvent('objective-marker-label-change', { objectiveId: objId, from: last.label, to: label });
  }

  if (anchor !== lastAnchor) {
    if (!noShots) await shoot(`anchor-${anchor ?? 'none'}`);
    anchorLedger.push({
      anchorId: anchor, atMs: Date.now(), elapsedMs: Date.now() - started,
      event: s.avFull?.anchorEvent ?? null, sequence: s.avFull?.activationSequence ?? null,
      beat: s.beat, objectiveId: objId, contingent: contingent.has(anchor)
    });
    noteEvent('anchor-change', { from: lastAnchor, to: anchor, sequence: s.avFull?.activationSequence ?? null });
    pendingAfterShot = { label: `anchor-${anchor ?? 'none'}`, at: Date.now() + 1200 };
    lastAnchor = anchor;
  }

  if (stripS > 0 && Date.now() - lastStrip >= stripS * 1000) {
    lastStrip = Date.now();
    await shoot(`strip-${s.beat ?? 'none'}`);
  }

  last = { objId, label, workOrder, anchor };
  await sleep(sampleMs);
}

const finalState = await sample();
const summary = {
  schema: 'paravoxia.verifier.cgLifecycleProbe.v0',
  runId: '2026-09-05-after-the-hearth',
  probe: 'cg-lifecycle-probe.mjs',
  contractSha256: contractSha,
  preview: { url: baseUrl, indexSha256: ownership.indexSha256, buildHash: ownership.buildHash ?? null },
  renderer: session.renderer,
  rendererClass: /swiftshader|software|llvmpipe/i.test(String(session.renderer)) ? 'software' : 'hardware',
  headed: session.headed,
  captureTier: CAPTURE_TIER,
  swiftshaderAllowed: SWIFTSHADER,
  request: { beat, lane, variant, tier, seconds, url: `${baseUrl}${url}`, viewport },
  startedAt: new Date(started).toISOString(),
  endedAt: new Date().toISOString(),
  beatAnchorsExpected: beatAnchors.map((a) => ({ id: a.id, order: a.order, contingent: contingent.has(a.id) })),
  anchorLedger,
  objectiveEntries,
  events,
  frames,
  objectiveLifecycleTrace: finalState.objectiveLifecycleTrace ?? null,
  finalState: {
    beat: finalState.beat, objectiveId: finalState.hud?.objectiveId ?? null,
    markerLabel: finalState.hud?.markerLabel ?? null, health: finalState.hud?.health ?? null,
    milestones: finalState.milestones ?? null, anchor: finalState.avFull?.anchorId ?? null,
    autopilot: finalState.autopilot ?? null
  },
  pageErrors: session.pageErrors.slice(0, 20),
  sfxNote: 'objectiveEnter counts are runtime SFX queue observations; they are not an audibility or hearing claim.'
};
writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
tag(`wrote ${join(outDir, 'summary.json')} (${frames.length} frames, ${events.length} events)`);
await session.stop();
