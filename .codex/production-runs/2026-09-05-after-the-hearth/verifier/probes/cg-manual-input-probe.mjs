#!/usr/bin/env node
/**
 * Manual-lane input probe: does the actual named control complete the actual
 * objective, with a real state transition either side of the input?
 *
 * Used to separate "the interaction is broken" from "the movie rail never
 * takes it", and to produce the control-input completion evidence the
 * guidance-target schema demands for ch13:return:launch.
 *
 *   node cg-manual-input-probe.mjs --beat ch13-home --key KeyF --hold-ms 60 \
 *        --presses 2 --settle-s 16 --out manual-home
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { loadContract, ART, CAPTURES } from './lib/cgContract.mjs';
import { openParavoxia, waitReady, readState, frameStats } from '../../../../../main/tools/lib/evidence.mjs';

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = (m) => console.log(`[cg-manual] ${m}`);

const beat = arg('beat', 'ch13-home');
const key = arg('key', 'KeyF');
const holdMs = Number(arg('hold-ms', '60'));
const presses = Number(arg('presses', '1'));
const gapS = Number(arg('gap-s', '10'));
const settleS = Number(arg('settle-s', '16'));
const variant = arg('variant', 'desktop');
const outName = arg('out', `manual-${beat}`);

const ownership = JSON.parse(readFileSync(resolve(ART, 'preview-ownership.json'), 'utf8'));
if (ownership.state !== 'running') throw new Error(`owned preview is ${ownership.state}`);
const { sha256: contractSha } = loadContract();
const outDir = resolve(CAPTURES, outName);
mkdirSync(outDir, { recursive: true });

const session = await openParavoxia({
  url: `?story=${beat}&journeyprobe=1`,
  preview: { url: ownership.url, stop() {} }, build: false, log: tag,
  viewport: variant === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 },
  isMobile: variant === 'mobile',
  reducedMotion: variant === 'reduced-motion' ? 'reduce' : 'no-preference'
});
const { page } = session;
await waitReady(page, { timeoutMs: 180_000 });
await sleep(settleS * 1000);

async function state(labelForFrame) {
  const base = await readState(page);
  const extra = await page.evaluate(() => {
    const hud = document.querySelector('[data-story-guidance-hud]');
    const out = {};
    try {
      const s = window.__paravoxiaJourneyProbe?.getSnapshot?.();
      out.milestones = s?.state?.localActor?.milestones ?? null;
      out.av = s?.state?.signedSceneAv ?? null;
      out.spaceFlight = s?.state?.spaceFlight ?? null;
      out.prompts = s?.interaction?.prompts ?? null;
      out.interactionTrace = (s?.interaction?.trace?.entries ?? []).slice(-8);
      out.objective = s?.objective ?? null;
      out.input = s?.input ?? null;
    } catch (e) { out.snapshotError = String(e).slice(0, 160); }
    try { out.lifecycle = window.__voxObjectiveLifecycle?.()?.map((e) => ({ ...e })) ?? null; } catch { /* ro */ }
    try { out.sfxTriggerCounts = window.__voxSfxTrace?.()?.triggerCounts ?? null; } catch { /* ro */ }
    out.hud = hud ? {
      objectiveId: hud.getAttribute('data-objective-id'),
      markerLabel: hud.getAttribute('data-objective-marker-label'),
      health: hud.getAttribute('data-objective-health'),
      requiresMarker: hud.getAttribute('data-objective-requires-marker')
    } : null;
    return out;
  });
  let frame = null;
  if (labelForFrame) {
    const file = join(outDir, `${labelForFrame}.png`);
    const bytes = await page.screenshot({ path: file });
    frame = { file, sha256: createHash('sha256').update(bytes).digest('hex'), stats: frameStats(bytes) };
  }
  return { ...base, ...extra, frame, atMs: Date.now(), atIso: new Date().toISOString() };
}

const records = [];
for (let i = 0; i < presses; i += 1) {
  const before = await state(`press${i}-before`);
  const startedAt = Date.now();
  await page.keyboard.down(key);
  await sleep(holdMs);
  await page.keyboard.up(key);
  const releasedAt = Date.now();
  await sleep(gapS * 1000);
  const after = await state(`press${i}-after`);
  const row = {
    pressIndex: i, key, holdMs,
    inputStartedAtSeconds: startedAt / 1000,
    inputReleasedAtSeconds: releasedAt / 1000,
    completedAtSeconds: after.atMs / 1000,
    before: {
      objectiveId: before.hud?.objectiveId ?? null, markerLabel: before.hud?.markerLabel ?? null,
      health: before.hud?.health ?? null, anchor: before.av?.anchorId ?? null,
      beat: before.beat, milestones: before.milestones?.length ?? null,
      prompts: before.interactionPrompts ?? null,
      spaceFlight: before.spaceFlight ? { phase: before.spaceFlight.phase, controlMode: before.spaceFlight.controlMode } : null,
      frame: before.frame
    },
    after: {
      objectiveId: after.hud?.objectiveId ?? null, markerLabel: after.hud?.markerLabel ?? null,
      health: after.hud?.health ?? null, anchor: after.av?.anchorId ?? null,
      beat: after.beat, milestones: after.milestones?.length ?? null,
      prompts: after.interactionPrompts ?? null,
      spaceFlight: after.spaceFlight ? { phase: after.spaceFlight.phase, controlMode: after.spaceFlight.controlMode } : null,
      frame: after.frame
    },
    milestonesGained: (after.milestones ?? []).filter((m) => !(before.milestones ?? []).includes(m)),
    lifecycleAfter: after.lifecycle,
    interactionTraceAfter: after.interactionTrace,
    sfxAfter: after.sfxTriggerCounts,
    objectiveChanged: (before.hud?.objectiveId ?? null) !== (after.hud?.objectiveId ?? null),
    anchorChanged: (before.av?.anchorId ?? null) !== (after.av?.anchorId ?? null)
  };
  records.push(row);
  tag(`press ${i} ${key}: objective ${row.before.objectiveId} -> ${row.after.objectiveId}; anchor ${row.before.anchor} -> ${row.after.anchor}; +milestones ${JSON.stringify(row.milestonesGained)}`);
}

writeFileSync(join(outDir, 'manual-input.json'), `${JSON.stringify({
  schema: 'paravoxia.verifier.cgManualInput.v0',
  runId: '2026-09-05-after-the-hearth',
  contractSha256: contractSha,
  beat, key, variant, lane: 'manual',
  preview: { url: ownership.url, indexSha256: ownership.indexSha256, buildHash: ownership.buildHash },
  renderer: session.renderer,
  rendererClass: /swiftshader|software|llvmpipe/i.test(String(session.renderer)) ? 'software' : 'hardware',
  headed: session.headed,
  records,
  pageErrors: session.pageErrors.slice(0, 20),
  capturedAt: new Date().toISOString()
}, null, 2)}\n`);
tag(`wrote ${join(outDir, 'manual-input.json')}`);
await session.stop();
