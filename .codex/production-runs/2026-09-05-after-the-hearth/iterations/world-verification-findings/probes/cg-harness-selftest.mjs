#!/usr/bin/env node
/**
 * OFFLINE self-test for this run's verifier harness. Run-local, pure CPU.
 *
 *   node verifier/probes/cg-harness-selftest.mjs [--json <path>]
 *
 * NO browser, NO preview, NO GPU, NO game build, NO game test runner, NO
 * network. It imports the harness's own pure modules and drives them with
 * synthetic sequences, so it fails when BEHAVIOUR regresses rather than when a
 * string is renamed.
 *
 * The two behaviours it is specifically built to catch:
 *   1. the `home-movie-2` defect — one shared gameplay state attributed to a raw
 *      frame and its HUD-suppressed partner taken ~1 s apart, across a real
 *      beat/objective change;
 *   2. stall-predicate false positives (slow real walking, ongoing actor motion,
 *      active flight, intentional cue holds, deliberate manual waits, out-of-
 *      scope phases) versus real stagnation, including the parked-ship
 *      VF-DEEPLINK-1 shape that MUST still fail.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import process from 'node:process';
import {
  classifyCaptureProvenance, observation, pairProvenance, classifyLuma, FRAME_ROLES
} from './lib/captureProvenance.mjs';
import {
  selectPlayerPose, selectWorkerPose, normalizeEntities, deriveFootFrames,
  progressSignature, unavailableDiagnostic, CG_DIAGNOSTIC_HOOKS, CAPSULE
} from './lib/physicalPose.mjs';
import { StallWatch, DEFAULT_STALL_CONFIG } from './lib/stallWatch.mjs';

const results = [];
let failures = 0;
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    failures += 1;
    results.push({ name, ok: false, error: String(e && e.message ? e.message : e) });
    console.error(`  FAIL  ${name}\n        ${e && e.message ? e.message : e}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const eqNum = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg} (got ${a}, want ${b} +-${tol})`);

// ===========================================================================
// A. PER-FRAME CAPTURE PROVENANCE
// ===========================================================================

check('A1 stable capture window is claimable at-state', () => {
  const pre = observation({ beat: 'ch13-home', objectiveId: 'ch13:home:review', workOrder: ['a'], anchorId: null }, 1000);
  const post = observation({ beat: 'ch13-home', objectiveId: 'ch13:home:review', workOrder: ['a'], anchorId: null }, 1180);
  const p = classifyCaptureProvenance(pre, post);
  assert(p.stateStableAcrossCapture === true, 'unchanged state must be stable');
  assert(p.atStateClaimable === true, 'unchanged state must be claimable');
  assert(p.crossings.length === 0, 'no crossings expected');
  eqNum(p.window.durationMs, 180, 0, 'window duration must be the frame\'s own');
});

check('A2 REGRESSION: a beat+objective change during one screenshot is not collapsed to a single state', () => {
  const pre = observation({ beat: 'ch13-home', objectiveId: 'ch13:home:choose-return', workOrder: ['x'] }, 5000);
  const post = observation({ beat: 'ch13-return', objectiveId: null, workOrder: null }, 5900);
  const p = classifyCaptureProvenance(pre, post);
  assert(p.stateStableAcrossCapture === false, 'a crossing must be reported, not smoothed');
  assert(p.atStateClaimable === false, 'a crossed frame must NOT be claimable at an exact state');
  const fields = p.crossings.map((c) => c.field).sort();
  assert(fields.includes('beat') && fields.includes('objectiveId') && fields.includes('workOrderSig'),
    `expected beat/objectiveId/workOrderSig crossings, got ${fields.join(',')}`);
  // The old harness stored exactly one `beat` scalar per frame. Prove both
  // endpoints are real and different, so any single scalar would be a fiction.
  assert(p.pre.beat === 'ch13-home' && p.post.beat === 'ch13-return', 'both endpoints must be retained verbatim');
  assert(p.window.startMs === 5000 && p.window.endMs === 5900, 'the honest artifact is a window, not an anchor instant');
  assert(/window/i.test(p.stateAttribution) && !/exact/.test(p.stateAttribution.replace('no exact', '')),
    'attribution must describe a window');
});

check('A3 REGRESSION: raw and HUD-suppressed partners ~1s apart are never called simultaneous', () => {
  const rawPre = observation({ beat: 'ch13-home', objectiveId: 'ch13:home:review', anchorId: 'anc.cg.cell-installed' }, 10_000);
  const rawPost = observation({ beat: 'ch13-home', objectiveId: 'ch13:home:review', anchorId: 'anc.cg.cell-installed' }, 10_120);
  const pPre = observation({ beat: 'ch13-home', objectiveId: 'ch13:home:choose-return', anchorId: 'anc.cg.return-chosen' }, 10_900);
  const pPost = observation({ beat: 'ch13-home', objectiveId: 'ch13:home:choose-return', anchorId: 'anc.cg.return-chosen' }, 11_030);
  const raw = { role: FRAME_ROLES.raw, provenance: classifyCaptureProvenance(rawPre, rawPost) };
  const percept = { role: FRAME_ROLES.percept, provenance: classifyCaptureProvenance(pPre, pPost) };

  assert(raw.role.hudSuppressed === false && percept.role.hudSuppressed === true, 'roles must be distinct');
  const pair = pairProvenance(raw, percept);
  assert(pair.simultaneous === false, 'pairs must never be recorded as simultaneous');
  eqNum(pair.pairOffsetMs, 905, 1, 'real offset must be recorded');
  assert(pair.stateHeldBetweenPartners === false, 'the run advanced between the partners; that must be visible');
  const fields = pair.betweenPartnerCrossings.map((c) => c.field);
  assert(fields.includes('objectiveId') && fields.includes('anchorId'),
    `expected objectiveId/anchorId to differ between partners, got ${fields.join(',')}`);
  // Each partner still individually holds its own state — that is the point.
  assert(raw.provenance.atStateClaimable === true && percept.provenance.atStateClaimable === true,
    'each frame is individually claimable even though the pair is not');
  assert(raw.provenance.pre.objectiveId !== percept.provenance.pre.objectiveId,
    'the two frames must carry their OWN objective, not one shared value');
});

check('A4 a near-black boot frame is progression evidence, never visual acceptance', () => {
  const boot = classifyLuma({ meanLuma: 0, maxLuma: 0.0, nearBlack: 1, blank: true, contrast: 0 });
  assert(boot.bootBlackFrameCandidate === true, 'blank boot frame must be flagged');
  assert(boot.visualAcceptance === false, 'blank frame must never be acceptance');
  const bright = classifyLuma({ meanLuma: 0.31, maxLuma: 0.98, nearBlack: 0.02, blank: false });
  assert(bright.bootBlackFrameCandidate === false, 'a lit frame is not a boot black frame');
  assert(bright.visualAcceptance === false, 'NO frame may ever be visual acceptance in this harness');
  assert(classifyLuma(null).visualAcceptance === false, 'missing stats must not become acceptance');
});

// ===========================================================================
// B. PHYSICAL POSE / DIAGNOSTIC FEATURE DETECTION
// ===========================================================================

check('B1 with no snapshot pose the rounded autopilot pose is used and labelled as such', () => {
  const sel = selectPlayerPose({ autopilot: { pos: [-26.13, 52.79, 12] }, journeySnapshot: { entities: {} } });
  assert(sel.fullPrecisionAvailable === false, 'must not claim full precision that does not exist');
  assert(sel.sourceClass === 'rounded-autopilot-global', `unexpected sourceClass ${sel.sourceClass}`);
  eqNum(sel.declaredPrecisionUnits, 0.01, 0, 'declared precision');
  eqNum(sel.observedQuantumUnits, 0.01, 0, 'observed quantum must corroborate the claim');
  assert(/CENTRE/.test(sel.frame), 'the capsule-centre frame must be recorded');
  assert(sel.snapshotPoseCandidatesChecked.length > 0, 'the candidates actually probed must be listed');
});

check('B2 a future full-precision snapshot pose is preferred, with the rounded pose retained', () => {
  const sel = selectPlayerPose({
    autopilot: { pos: [-26.13, 52.79, 12] },
    journeySnapshot: { state: { player: { position: [-26.134271, 52.7913, 12.00417] } } }
  });
  assert(sel.fullPrecisionAvailable === true, 'a published pose must be picked up with no harness edit');
  assert(sel.source === 'journey-snapshot:state.player.position', `unexpected source ${sel.source}`);
  eqNum(sel.pos[0], -26.134271, 1e-9, 'primary must be verbatim, unrounded');
  assert(Array.isArray(sel.secondaryRoundedAutopilotPos), 'the rounded autopilot pose must be RETAINED as secondary');
  eqNum(sel.secondaryRoundedAutopilotPos[0], -26.13, 0, 'secondary retained verbatim');
});

check('B3 REGRESSION: the journey snapshot entities Record is read (it is not an array)', () => {
  const record = {
    'actor:w7744': { id: 'actor:w7744', mounted: true, visible: true, position: [-34.01, 51.1, 10.02], phase: 'holding-h', source: 'audit-worker', revision: 12 },
    'prop:field-pack': { id: 'prop:field-pack', mounted: true, visible: false, position: null, phase: null, source: 'field-pack', revision: 3 }
  };
  assert(Array.isArray(record) === false, 'fixture must mirror the real Record shape');
  const ents = normalizeEntities(record);
  assert(Array.isArray(ents) && ents.length === 2, 'a Record must normalise to two entities');
  const w = selectWorkerPose({ journeySnapshot: { entities: record }, auditWorker: { pos: [-34, 51.1, 10] } });
  assert(w.sourceClass === 'journey-entity-record', `expected the 1e-2 entity record, got ${w.sourceClass}`);
  eqNum(w.declaredPrecisionUnits, 0.01, 0, 'entity precision');
  eqNum(w.pos[0], -34.01, 0, 'entity pose used verbatim');
  assert(w.phase === 'holding-h', 'entity phase must be carried');
  eqNum(w.fallbackAuditWorkerPos[0], -34, 0, 'the coarser global must still be retained');
  // and the fallback still works when the bridge is silent
  const f = selectWorkerPose({ auditWorker: { pos: [-34, 51.1, 10] } });
  assert(f.sourceClass === 'rounded-actor-global' && f.declaredPrecisionUnits === 0.1, 'fallback must be labelled coarser');
  assert(normalizeEntities(null) === null, 'absent entities stay absent, not empty-and-passing');
});

check('B5 the PUBLISHED ch13 diagnostic leads the pose selection, in BOTH frames', () => {
  // The real shape now served by window.__paravoxiaCommonGround.snapshot().
  const sample = {
    autopilot: { pos: [-26.13, 52.79, 12] },
    journeySnapshot: { state: { player: { position: [-26.1, 52.7, 12.0] } } },
    cgDiagnostic: {
      available: true,
      hookUsed: 'window.__paravoxiaCommonGround.snapshot()',
      value: {
        bodyCentre: [-26.134271, 52.789821, 12.004170],
        bodyPose: [-26.134271, 50.989821, 12.004170],
        up: [0, 1, 0],
        groundOffsetUnits: 1.8,
        supported: true,
        diagnostic: {
          worker: { leg: 'holding-h', travelled: 2, legLength: 2, held: false, sampledIndex: 0, permitted: null, position: { x: -40.0004, y: 51.05, z: 12.0001 } }
        }
      }
    }
  };
  const sel = selectPlayerPose(sample);
  assert(sel.sourceClass === 'cg-diagnostic-live-capsule-centre', `unexpected sourceClass ${sel.sourceClass}`);
  assert(sel.fullPrecisionAvailable === true, 'the published hook IS full precision');
  eqNum(sel.pos[1], 52.789821, 1e-9, 'centre verbatim');
  eqNum(sel.groundedBodyPose[1], 50.989821, 1e-9, 'the chapter grounded frame is carried separately');
  eqNum(sel.pos[1] - sel.groundedBodyPose[1], 1.8, 1e-9, 'the two frames differ by exactly the capsule offset');
  assert(sel.liveUp !== null, 'the LIVE up must be recorded, never assumed');
  assert(Array.isArray(sel.secondaryRoundedAutopilotPos) && Array.isArray(sel.secondarySnapshotPose),
    'both weaker sources must still be retained for reconciliation');
  const w = selectWorkerPose(sample);
  assert(w.sourceClass === 'cg-diagnostic-live-actor-pose', `unexpected worker sourceClass ${w.sourceClass}`);
  eqNum(w.pos[0], -40.0004, 1e-9, 'actor pose verbatim');
  assert(w.leg === 'holding-h' && w.travelled === 2, 'the leg it is actually walking must be carried');
});

check('B6 an UNAVAILABLE or malformed diagnostic never fabricates a lead pose', () => {
  const none = selectPlayerPose({ autopilot: { pos: [1, 2, 3] }, cgDiagnostic: { available: false, value: null } });
  assert(none.sourceClass === 'rounded-autopilot-global', 'an unavailable hook must fall back, not lead');
  assert(none.groundedBodyPose === null && none.liveUp === null, 'no grounded frame may be invented');
  const bad = selectPlayerPose({ cgDiagnostic: { available: true, value: { bodyCentre: ['x', null, 3] } } });
  assert(bad.sourceClass === 'unavailable' && bad.pos === null, 'a malformed vector must not be accepted');
  const noWorker = selectWorkerPose({ cgDiagnostic: { available: true, value: { diagnostic: { worker: null } } } });
  assert(noWorker.pos === null || noWorker.sourceClass !== 'cg-diagnostic-live-actor-pose', 'absent actor stays absent');
});

check('B4 foot frames are derived from the capsule centre with both semantics', () => {
  const f = deriveFootFrames([-26.13, 52.79, 12]);
  eqNum(CAPSULE.halfHeight + CAPSULE.radius, 1.8, 1e-12, 'capsule constants');
  eqNum(f.cylinderBottom[1], 51.49, 1e-9, 'EfficientPlayer feetWorld = centre - halfHeight');
  eqNum(f.sole[1], 50.99, 1e-9, 'sole = centre - (halfHeight + radius); matches the interim report figure');
  assert(f.upAssumed === true, 'the +Y assumption must be flagged as an assumption');
  assert(/not exposed/i.test(f.upSourceLimit), 'the missing live up-axis must be stated');
  const tilted = deriveFootFrames([0, 0, 0], [1, 0, 0]);
  eqNum(tilted.sole[0], -1.8, 1e-9, 'a supplied up must actually be used');
  assert(tilted.upAssumed === false, 'a supplied up is not an assumption');
});

check('B5 an unexposed CommonGround diagnostic is recorded unavailable, never as a pass', () => {
  const u = unavailableDiagnostic(CG_DIAGNOSTIC_HOOKS, 'no candidate hook answered');
  assert(u.available === false && u.value === null, 'unavailable must be explicit');
  assert(u.hooksChecked.length === CG_DIAGNOSTIC_HOOKS.length, 'every probed name must be listed');
  assert(/UNMEASURED/.test(u.consequence), 'the consequence must say unmeasured, not fine');
  assert(progressSignature(null) === null && progressSignature({}) === null, 'no fields means no signature');
  const sig = progressSignature({ common: { stage: 'positioning-to-e', terraUnits: 4 }, holdReason: null });
  assert(typeof sig === 'string' && sig.includes('common.terraUnits'), 'observed progress fields must sign');
  assert(progressSignature({ common: { stage: 'positioning-to-e', terraUnits: 5 }, holdReason: null }) !== sig,
    'a terraUnits change must alter the signature');
});

// ===========================================================================
// C. STALL PREDICATE — real stagnation vs false positives
// ===========================================================================

const base = {
  phase: 'walk', beat: 'ch13-survey', objectiveId: 'ch13:survey:start',
  markerLabel: 'survey start', workOrderSig: '["begin"]', anchorId: 'anc.cg.demonstration-opened',
  activationSequence: 3, milestoneSig: '[]', playerPos: [-26.13, 52.79, 12],
  workerPos: [-34, 51.1, 10], controlMode: 'fps', shipPos: [8, 53.85, -6]
};
/** Drive a watch over `n` seconds, mutating the observation through `mut`. */
function drive(watch, n, mut = () => ({}), t0 = 0, stepMs = 1000) {
  let last = null;
  for (let i = 0; i <= n; i += 1) {
    const atMs = t0 + i * stepMs;
    last = watch.update({ ...base, atMs, ...mut(i, atMs) });
    if (last.fired) return last;
  }
  return last;
}

check('C0 the predicate is OFF unless explicitly opted in', () => {
  assert(DEFAULT_STALL_CONFIG.enabled === false, 'default must be disabled');
  const w = new StallWatch({});
  const r = drive(w, 600);
  assert(r.fired === false, 'a disabled predicate must never fire, however long the stagnation');
  assert(w.describe().fired === null, 'nothing recorded when disabled');
});

check('C1 real stagnation on an on-foot walk phase FAILs at the window', () => {
  const w = new StallWatch({ enabled: true, windowMs: 30_000 });
  const r = drive(w, 60);
  assert(r.fired === true, 'total stagnation must fail');
  assert(r.verdict === 'FAIL-STALL', `verdict was ${r.verdict}`);
  assert(r.report.isSuccess === false, 'a stall may never be success');
  assert(r.report.windowMs >= 30_000 && r.report.windowMs <= 32_000, `fired too early/late at ${r.report.windowMs}`);
  eqNum(r.report.playerMovedUnitsInWindow, 0, 1e-9, 'zero displacement must be recorded');
  assert(r.report.physicalProgressObserved === false, 'no diagnostic was supplied');
  assert(/NOT exposed/.test(r.report.physicalProgressCaveat), 'the missing diagnostic must be caveated in the FAIL');
  assert(/never a pass/i.test(r.report.note), 'the FAIL must state it is not a pass');
});

check('C2 FALSE-POSITIVE GUARD: slow but real walking never fails', () => {
  const w = new StallWatch({ enabled: true, windowMs: 30_000, playerUnits: 0.75 });
  // 0.2 units/s => 0.75 units accrues every ~4 s: the window resets constantly.
  const r = drive(w, 600, (i) => ({ playerPos: [-26.13 + 0.2 * i, 52.79, 12] }));
  assert(r.fired === false, 'a walking player is not stalled');
  assert(w.describe().recentResets.some((x) => x.reason === 'player-moved'), 'reset reason must be recorded');
});

check('C3 FALSE-POSITIVE GUARD: story progress with a stationary body never fails', () => {
  const w = new StallWatch({ enabled: true, windowMs: 30_000 });
  // an interact phase: the body is on the mark, but the work order advances
  const r = drive(w, 600, (i) => ({ phase: 'interact', workOrderSig: `["step-${Math.floor(i / 20)}"]` }));
  assert(r.fired === false, 'advancing objective copy is progress, not a stall');
});

check('C4 FALSE-POSITIVE GUARD: ongoing actor motion while the player waits never fails', () => {
  const w = new StallWatch({ enabled: true, windowMs: 30_000, actorUnits: 0.5 });
  const r = drive(w, 600, (i) => ({ workerPos: [-34 + 0.15 * i, 51.1, 10] }));
  assert(r.fired === false, 'W-7744 walking his own leg is the chapter working');
  assert(w.describe().recentResets.some((x) => x.reason === 'actor-moved'), 'actor-moved reset must be recorded');
});

check('C5 FALSE-POSITIVE GUARD: active flight never fails — but a PARKED ship in flight mode still does', () => {
  const flying = new StallWatch({ enabled: true, windowMs: 30_000, shipUnits: 1, phases: ['walk', 'interact', 'on-foot'] });
  const rf = drive(flying, 600, (i) => ({ controlMode: 'flight', shipPos: [8 + 3 * i, 53.85, -6] }));
  assert(rf.fired === false, 'a ship actually flying is not a stall');

  // VF-DEEPLINK-1 shape: flight controlMode, ship parked, on-foot rail asking to walk.
  const parked = new StallWatch({ enabled: true, windowMs: 30_000, shipUnits: 1 });
  const rp = drive(parked, 300, () => ({ controlMode: 'flight' }));
  assert(rp.fired === true, 'flight controlMode alone must NOT exempt a frozen deep-link boot');
  assert(rp.report.controlMode === 'flight', 'the control mode must be captured in the FAIL');
  eqNum(rp.report.shipMovedUnitsInWindow, 0, 1e-9, 'the parked ship must be evidenced');
});

check('C6 FALSE-POSITIVE GUARD: an intentional cue hold delays a FAIL but cannot cancel it', () => {
  const w = new StallWatch({ enabled: true, windowMs: 30_000 });
  const held = drive(w, 120, () => ({ captionActive: true }));
  assert(held.fired === false, 'a caption on screen must suppress firing');
  assert(w.describe().cueSuppressions.length > 0, 'the suppression must be recorded, not silent');
  // caption ends, stagnation continues: the already-overrun window fires at once
  const after = w.update({ ...base, atMs: 121_000, captionActive: false });
  assert(after.fired === true, 'an ended cue hold must not have reset the clock');
  assert(after.report.cueSuppressionsBeforeFire.length > 0, 'the FAIL must disclose it was suppressed earlier');
});

check('C7 FALSE-POSITIVE GUARD: a declared deliberate manual wait never fails', () => {
  const w = new StallWatch({ enabled: true, windowMs: 30_000 });
  const r = drive(w, 600, () => ({ manualHold: true }));
  assert(r.fired === false, 'an operator-declared wait is not a defect');
  // and the guard must not persist after the wait ends
  const w2 = new StallWatch({ enabled: true, windowMs: 30_000 });
  drive(w2, 20, () => ({ manualHold: true }));
  const after = drive(w2, 60, () => ({}), 21_000);
  assert(after.fired === true, 'stagnation after the declared wait must still be caught');
});

check('C8 FALSE-POSITIVE GUARD: an out-of-scope phase is not judged', () => {
  const w = new StallWatch({ enabled: true, windowMs: 30_000, phases: ['walk', 'interact'] });
  const r = drive(w, 600, () => ({ phase: 'cutscene' }));
  assert(r.fired === false, 'the predicate is scoped to on-foot walk/interact phases');
  assert(String(w.describe().lastIdleReason).startsWith('phase-out-of-scope'), 'the scoping must be recorded');
});

check('C9 a runtime-declared holdReason widens the window but does not disable it', () => {
  const w = new StallWatch({ enabled: true, windowMs: 30_000, holdMultiplier: 2 });
  const early = drive(w, 45, () => ({ cgHoldReason: 'awaiting-witness' }));
  assert(early.fired === false, 'at 45 s a declared hold must still have room (needs 60 s)');
  const late = drive(w, 30, () => ({ cgHoldReason: 'awaiting-witness' }), 46_000);
  assert(late.fired === true, 'a hold that never ends must still fail at the widened window');
  eqNum(late.report.requiredWindowMs, 60_000, 0, 'the widened requirement must be disclosed');
});

check('C10 physical progress from the diagnostic resets the window even with a frozen body', () => {
  const w = new StallWatch({ enabled: true, windowMs: 30_000 });
  const r = drive(w, 600, (i) => ({ cgProgressSig: `{"common.terraUnits":${Math.floor(i / 10)}}` }));
  assert(r.fired === false, 'credited route progress is progress');
  assert(w.describe().recentResets.some((x) => x.reason === 'physical-progress-change'), 'progress reset must be recorded');

  // real stagnation WITH the diagnostic present: the FAIL is stronger, not weaker
  const w2 = new StallWatch({ enabled: true, windowMs: 30_000 });
  const stuck = drive(w2, 60, () => ({ cgProgressSig: '{"common.terraUnits":4}' }));
  assert(stuck.fired === true, 'a frozen diagnostic plus a frozen body is a stall');
  assert(stuck.report.physicalProgressObserved === true, 'the observed diagnostic must be credited to the FAIL');
  assert(stuck.report.physicalProgressCaveat === null, 'no missing-diagnostic caveat when it was observed');
  assert(stuck.report.physicalProgressSignatureHeld.includes('terraUnits'), 'the frozen signature must be quoted');
});

check('C11 the described predicate carries its own limits and never a success verdict', () => {
  const d = new StallWatch({ enabled: true }).describe();
  assert(d.limits.length >= 5, 'limits must be enumerated');
  assert(/FAIL when/.test(d.predicate), 'the exact predicate must be stated');
  assert(!/pass|success/i.test(d.predicate), 'the predicate must not define any success');
});

// ===========================================================================
// D. BOUNDED SAFETY SCAN — the probe must stay read-only
// ===========================================================================

check('D1 the journey probe calls no mutating runtime routine', () => {
  const src = readFileSync(new URL('./cg-journey-probe.mjs', import.meta.url), 'utf8');
  // Names that would grant progress, seed prerequisites or re-plan a route.
  const forbidden = [
    'prepareScenario', 'requestJourneyProbePreparation', 'recordJourneyProbePreparation',
    'planCommonGroundRoute', 'commonGroundRailPlan', 'applyCommonGroundRail',
    'setScoreBeat', 'grantMilestone', 'setTranslation', 'forceProgress',
    'activateSignedSceneAnchorById', 'noteScreeningAction'
  ];
  const hit = forbidden.filter((n) => src.includes(n));
  assert(hit.length === 0, `probe references mutating routine(s): ${hit.join(', ')}`);
  // The only input it may synthesise is the labelled shipped disembark key.
  const presses = [...src.matchAll(/keyboard\.press\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert(presses.every((k) => k === 'KeyF'), `unexpected synthetic input: ${presses.join(',')}`);
});

check('D2 the harness declares no acceptance vocabulary', () => {
  for (const f of ['./cg-journey-probe.mjs', './lib/stallWatch.mjs', './lib/captureProvenance.mjs', './lib/physicalPose.mjs']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert(!/\bvisualAcceptance:\s*true/.test(src), `${f} must never set visualAcceptance true`);
    assert(!/\bisSuccess:\s*true/.test(src), `${f} must never set isSuccess true`);
    assert(!/outcomeIsAcceptance:\s*true/.test(src), `${f} must never claim acceptance`);
  }
});

// ===========================================================================
const summary = {
  schema: 'paravoxia.verifier.harnessSelfTest.v1',
  runId: '2026-09-05-after-the-hearth',
  ranAt: new Date().toISOString(),
  offline: true,
  usedBrowser: false, usedPreview: false, usedGpu: false, usedGameBuildOrTests: false, usedNetwork: false,
  total: results.length, passed: results.filter((r) => r.ok).length, failed: failures,
  results
};
const jsonPath = (() => { const i = process.argv.indexOf('--json'); return i >= 0 ? process.argv[i + 1] : null; })();
if (jsonPath) writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`[cg-harness-selftest] ${summary.passed}/${summary.total} passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
