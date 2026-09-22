// FOCUSED CPU TEST of the helpers the ACTUAL entrypoint calls for producer
// corrections C1-C4. These are BEHAVIOURAL cases against real shapes, not
// source regexes: every assertion calls the exported function.
import {
  spanOfferAcceptance, ROUTE_OFFERED_ANCHOR_ID,
  readContinueFrame, CONTINUE_FRAME_READER_SOURCE, CONTINUE_CAPTURE,
  isValidRuntimeReading, continueCaptureDecision, continueCaptureCompleteness,
  summariseContinueFrames
} from './continueClosure.mjs';
import { usableEntryCensus, applyRetainedDirs, CALIBRATION_BOUNDS } from './liveCalibration.mjs';

let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// ===================================================== C1 span-offer acceptance
// A REAL restored anchor list. Seven anchors — not 19, and 19 was never a count
// of anchors. This must PASS on a valid new span offer.
const SEVEN = ['anc.cg.arrive', 'anc.cg.hearth', 'anc.cg.first-word', 'anc.cg.tools', 'anc.cg.survey-open', 'anc.cg.point-a', 'anc.cg.point-b'];
const EIGHT = [...SEVEN, 'anc.cg.point-c'];
const signed = { signedAuthorizationOk: true, fPressed: true };

for (const [name, before] of [['7 anchors', SEVEN], ['8 anchors', EIGHT]]) {
  const r = spanOfferAcceptance({ ...signed, anchorsBefore: before, anchorsAfter: [...before, ROUTE_OFFERED_ANCHOR_ID] });
  ok(r.accepted === true, `C1 valid new span offer with ${name} is ACCEPTED (no 19-anchor minimum): ${r.problems.join('; ')}`);
  ok(r.newRouteOfferedAnchor === true, `C1 ${name}: new anchor detected`);
  ok(r.beforeAnchorsPreservedInOrder === true, `C1 ${name}: preservation held`);
}
// Anchor count is reported, never required.
eq(spanOfferAcceptance({ ...signed, anchorsBefore: SEVEN, anchorsAfter: [...SEVEN, ROUTE_OFFERED_ANCHOR_ID] }).observedAnchorCounts,
  { before: 7, after: 8 }, 'C1 counts are reported');

// OLD anchor: route-offered was ALREADY present before [F].
{
  const before = [...SEVEN, ROUTE_OFFERED_ANCHOR_ID];
  const r = spanOfferAcceptance({ ...signed, anchorsBefore: before, anchorsAfter: [...before] });
  ok(r.accepted === false, 'C1 an already-present route-offered anchor FAILS');
  ok(/ALREADY present/.test(r.problems.join(' ')), 'C1 old-anchor reason is explicit');
}
// UNRELATED new anchor only.
{
  const r = spanOfferAcceptance({ ...signed, anchorsBefore: SEVEN, anchorsAfter: [...SEVEN, 'anc.cg.some-other-thing'] });
  ok(r.accepted === false, 'C1 an unrelated new anchor FAILS');
  eq(r.unrelatedNewAnchors, ['anc.cg.some-other-thing'], 'C1 unrelated anchor is reported, not accepted');
}
// MISSING PRESERVATION: a pre-[F] anchor was dropped/reordered.
{
  const after = [...SEVEN.slice(0, 3), ...SEVEN.slice(4), ROUTE_OFFERED_ANCHOR_ID];
  const r = spanOfferAcceptance({ ...signed, anchorsBefore: SEVEN, anchorsAfter: after });
  ok(r.accepted === false, 'C1 a lost pre-[F] anchor FAILS even with the new anchor present');
  ok(r.newRouteOfferedAnchor === true && r.beforeAnchorsPreservedInOrder === false, 'C1 failure is attributed to preservation, not to the anchor');
}
// UNAUTHORIZED / UNPRESSED [F].
ok(spanOfferAcceptance({ signedAuthorizationOk: false, fPressed: true, anchorsBefore: SEVEN, anchorsAfter: [...SEVEN, ROUTE_OFFERED_ANCHOR_ID] }).accepted === false,
  'C1 unsigned authorization FAILS');
ok(spanOfferAcceptance({ signedAuthorizationOk: true, fPressed: false, anchorsBefore: SEVEN, anchorsAfter: [...SEVEN, ROUTE_OFFERED_ANCHOR_ID] }).accepted === false,
  'C1 [F] not actually pressed FAILS');
// GENERIC PHASE CHANGE ALONE: phase is not even an input; identical anchors fail.
ok(spanOfferAcceptance({ ...signed, anchorsBefore: SEVEN, anchorsAfter: [...SEVEN] }).accepted === false,
  'C1 a generic phase change with no new anchor FAILS');
// Unobserved lists are unmeasured, never true.
ok(spanOfferAcceptance({ ...signed, anchorsBefore: null, anchorsAfter: null }).accepted === false, 'C1 unobserved anchors FAIL');

// ===================================================== C2 real frame shapes
// Fixture shaped like the REAL hooks: nested journey system object, plus the
// boolean worldBound on the common-ground bridge.
const realWindow = {
  __storyBeat: 'ch13-survey',
  __paravoxiaJourneyProbe: {
    snapshot: () => ({
      story: {},
      state: {
        systemFlight: {
          activePlanetId: 'origin', locationMode: 'planet',
          renderOrigin: [2200, 0, -100],
          pose: { position: [1, 2, 3], velocity: [0, 0, 0] }
        }
      }
    })
  },
  __paravoxiaCommonGround: {
    snapshot: () => ({
      worldBound: true,                       // BOOLEAN, and only that
      bodyPose: [-42, 51.05, 12], bodyCentre: [-42, 51.95, 12], up: [0, 1, 0],
      diagnostic: { survey: { phase: 'drawing', samples: 2 }, anchors: SEVEN }
    })
  },
  __voxelDebug: { spawn: { terrainSeed: 4242, playerRequested: [1, 2, 3] } }
};
{
  const f = readContinueFrame(realWindow, 1234);
  eq(f.activePlanetId, 'origin', 'C2 activePlanetId comes from journeyProbe.state.systemFlight');
  eq(f.renderOrigin, [2200, 0, -100], 'C2 renderOrigin is the real published array');
  eq(f.renderOriginSource, 'journeyProbe.state.systemFlight.renderOrigin', 'C2 renderOrigin source is named');
  eq(f.worldBound, true, 'C2 worldBound is retained as its own boolean');
  ok(typeof f.renderOrigin !== 'boolean', 'C2 renderOrigin is NEVER a boolean');
  eq(f.cgFoot, [-42, 51.05, 12], 'C2 bodyPose is TOP-LEVEL');
  eq(f.capsule, [-42, 51.95, 12], 'C2 bodyCentre is TOP-LEVEL');
  eq(f.up, [0, 1, 0], 'C2 up is TOP-LEVEL');
  eq(f.surveyPhase, 'drawing', 'C2 survey is NESTED under diagnostic');
  eq(f.anchorCount, 7, 'C2 anchors are NESTED under diagnostic');
  eq(f.beat, 'ch13-survey', 'C2 beat from __storyBeat');
  eq(f.terrainSeed, 4242, 'C2 terrainSeed from __voxelDebug.spawn');
  eq(f.error, null, 'C2 no error on the real shape');
}
// THE EXACT PRIOR DEFECT: worldBound true, no published renderOrigin anywhere.
{
  const w = {
    __paravoxiaCommonGround: { snapshot: () => ({ worldBound: true, bodyPose: [0, 0, 0] }) },
    __paravoxiaJourneyProbe: { snapshot: () => ({ state: { systemFlight: { activePlanetId: null } } }) }
  };
  const f = readContinueFrame(w, 10);
  eq(f.renderOrigin, null, 'C2 absent renderOrigin is null, NOT the worldBound boolean');
  eq(f.worldBound, true, 'C2 worldBound still recorded distinctly');
  eq(f.renderOriginSource, null, 'C2 no source is claimed when the field is absent');
}
// The guessed hook is gone: a page publishing ONLY __paravoxiaSystem yields nothing.
{
  const f = readContinueFrame({ __paravoxiaSystem: { snapshot: () => ({ activePlanetId: 'guessed' }) } }, 5);
  eq(f.activePlanetId, null, 'C2 __paravoxiaSystem is not read');
  eq(f.journeyProbePublished, false, 'C2 journey probe absence is reported honestly');
}
// A throwing hook is RECORDED on the frame, not fabricated away.
{
  const f = readContinueFrame({ __paravoxiaJourneyProbe: { snapshot: () => { throw new Error('probe exploded'); } } }, 7);
  ok(/probe exploded/.test(f.error ?? ''), 'C2 per-frame error recorded');
  eq(f.ms, 7, 'C2 the frame is kept with its timestamp');
}
// The injected source is the same function.
{
  // eslint-disable-next-line no-eval
  const injected = (0, eval)(`(${CONTINUE_FRAME_READER_SOURCE})`);
  eq(injected(realWindow, 1).renderOrigin, [2200, 0, -100], 'C2 injected source behaves identically to the export');
}

// ===================================================== C3 capture window
ok(isValidRuntimeReading({ frame: { cgFoot: [1, 2, 3] }, hudPresent: true, menuPresent: false }) === true, 'C3 foot+HUD+no menu is valid');
ok(isValidRuntimeReading({ frame: { cgFoot: null }, hudPresent: true, menuPresent: false }) === false, 'C3 HUD without a foot is not valid');
ok(isValidRuntimeReading({ frame: { cgFoot: [1, 2, 3] }, hudPresent: false, menuPresent: false }) === false, 'C3 foot without the HUD is not valid');
// LATE BOOT: first valid at 8000 ms, pose change at 9000 ms -> capture must run
// to at least 13000 ms. Under the OLD ms<=5000 filter every frame here was lost.
{
  const d = (ms, first) => continueCaptureDecision({ msSinceClick: ms, firstValidRuntimeMs: first });
  ok(d(5000, null).keepCapturing === true, 'C3 still capturing at 5000ms with no valid reading yet');
  ok(d(7999, null).keepCapturing === true, 'C3 still capturing just before a late first pose');
  ok(d(9000, 8000).keepCapturing === true, 'C3 capturing at the 9000ms pose change');
  ok(d(12999, 8000).keepCapturing === true, 'C3 still capturing at 12999ms');
  ok(d(13000, 8000).keepCapturing === false, 'C3 releases at 13000ms = 8000 + 5000');
  eq(d(13000, 8000).reason, 'hold-after-first-valid-runtime-satisfied', 'C3 release reason is the hold, not the click');
  // IMMEDIATE first pose must NOT end capture immediately.
  ok(d(0, 0).keepCapturing === true, 'C3 an immediate first pose does not end capture at once');
  ok(d(4999, 0).keepCapturing === true, 'C3 immediate first pose still capturing at 4999ms');
  ok(d(5000, 0).keepCapturing === false, 'C3 immediate first pose releases at 5000ms');
  // Hard bound.
  ok(d(CONTINUE_CAPTURE.maxWindowMs, null).keepCapturing === false, 'C3 window cap stops capture');
  ok(d(CONTINUE_CAPTURE.maxWindowMs, null).capped === true, 'C3 cap is recorded');
  eq(CONTINUE_CAPTURE.continueWaitBudgetMs, 60000, 'C3 the Continue wait budget is unchanged at 60s');
}
// Completeness: a late boot that cannot fit the hold is INCOMPLETE, not proof.
{
  ok(continueCaptureCompleteness({ firstValidRuntimeMs: 8000, lastObservedMs: 13000 }).complete === true, 'C3 8000+5000 observed is complete');
  const late = continueCaptureCompleteness({ firstValidRuntimeMs: 28000, lastObservedMs: 30000, capped: true });
  ok(late.complete === false && late.verdict === 'incomplete', 'C3 a boot too late for the hold is INCOMPLETE');
  ok(continueCaptureCompleteness({ firstValidRuntimeMs: null, lastObservedMs: 60000 }).complete === false, 'C3 no valid reading is INCOMPLETE, never a pass');
}
// Nothing is filtered at harvest.
{
  const frames = [
    { ms: 0, msSinceClick: -120, cgFoot: null, beat: null, error: null },
    { ms: 8200, msSinceClick: 8000, cgFoot: [1, 2, 3], beat: 'ch13-survey', error: null },
    { ms: 9200, msSinceClick: 9000, cgFoot: [1, 2, 4], beat: 'ch13-survey', error: null },
    { ms: 13200, msSinceClick: 13000, cgFoot: [1, 2, 4], beat: 'ch13-survey', error: 'hook blip' }
  ];
  const s = summariseContinueFrames(frames, { firstValidRuntimeMs: 8000 });
  eq(s.frameCount, 4, 'C3 every frame is retained, including pre-click and >5000ms');
  eq(s.firstFootMs, 8200, 'C3 first foot frame found past 5000ms');
  eq(s.firstFootChangeMs, 9200, 'C3 the ~1s-later pose change is retained and located');
  eq(s.msFromFirstFootToChange, 1000, 'C3 the observed change interval is measured');
  eq(s.framesWithError, 1, 'C3 per-frame errors are counted, not dropped');
}

// ===================================================== C4 calibration census
{
  eq(CALIBRATION_BOUNDS.pressMs <= 150 && CALIBRATION_BOUNDS.pressMs >= 120, true, 'C4 press is a short ordinary 120-150ms burst');
  ok(CALIBRATION_BOUNDS.settleMs > 0, 'C4 a controlled settle is retained');
  eq([CALIBRATION_BOUNDS.maxCalibrations, CALIBRATION_BOUNDS.minUnitsSinceCalib], [6, 6], 'C4 the 6-round / 6u private controller limits are preserved');
  // A PARTIAL round re-measured only KeyW; A and D remain live and usable.
  const entries = {
    KeyW: { key: 'KeyW', usable: true, dir3d: [1, 0, 0] },
    KeyS: null,
    KeyA: { key: 'KeyA', usable: true, dir3d: [0, 0, 1] },
    KeyD: { key: 'KeyD', usable: true, dir3d: [0, 0, -1] }
  };
  const c = usableEntryCensus(entries);
  eq(c.lateralUsableCount, 2, 'C4 lateral control counted over ALL live entries after a partial round');
  eq(c.usableKeys, ['KeyW', 'KeyA', 'KeyD'], 'C4 usable keys are the live ones');
  eq(c.unusableOrMissingKeys, ['KeyS'], 'C4 unusable/missing keys are named');
  const dead = usableEntryCensus({ KeyW: { usable: true, dir3d: [1, 0, 0] } });
  eq(dead.lateralUsableCount, 0, 'C4 genuinely absent lateral stamps count 0');
  // STALE DIRS ARE CLEARED, not left behind by a truthy-only overwrite.
  const dirs = { KeyW: [1, 0, 0], KeyS: [-1, 0, 0], KeyA: [0, 0, 1], KeyD: [0, 0, -1] };
  const applied = applyRetainedDirs(dirs, { KeyW: { dir3d: [1, 0, 0] }, KeyA: { dir3d: [0, 0, 1] } }, ['KeyW', 'KeyS', 'KeyA', 'KeyD']);
  eq(applied.dirs.KeyS, null, 'C4 a key with no usable entry is CLEARED');
  eq(applied.dirs.KeyD, null, 'C4 a key dropped from entries is CLEARED');
  eq(applied.cleared, ['KeyS', 'KeyD'], 'C4 cleared keys are reported');
  eq(applied.dirs.KeyW, [1, 0, 0], 'C4 a retained key keeps steering');
  ok(dirs.KeyS === null, 'C4 the live dirs map itself is corrected in place');
}

console.log(`continueClosure.selftest: ${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log('  FAIL:', f);
if (fails.length) process.exit(1);
