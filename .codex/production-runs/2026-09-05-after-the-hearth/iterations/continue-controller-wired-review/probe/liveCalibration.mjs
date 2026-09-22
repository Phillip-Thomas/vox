/**
 * PRIVATE PROBE HELPER — continue-controller-closure. PREPARED, NEVER RUN HEADED.
 *
 * Two confirmed private defects of the earned-continue-3d attempt-1 run are
 * closed here. Neither is a game defect and nothing in main/src is touched.
 *
 * DEFECT 1 — CALIBRATION THRASH (measured, attempt-1 trace.ndjson)
 * ---------------------------------------------------------------
 * `walkTowards.runCalibration` latched `basisUp` from ONE snapshot taken BEFORE
 * four 450 ms ordinary key presses. Measured in the capture: 88 calibrate rows,
 * median moved3dUnits = 1.878, i.e. each calibration round walked the body
 * ~7.5 units across a curved face while holding a basis recorded before that
 * walk. The recorded rounds show up rotating WITHIN one round:
 *   face-change-1 basisUp [0.88197, 0.47130, ~0]
 *   face-change-2 basisUp [0.49081, 0.87127, ~0]   (~26.3 deg later, same round)
 * so the 12 deg staleness test fired again immediately on the next loop pass:
 * 21 recalibrations / 36 directed bursts / 90 778 ms / final foot 90.05 u from E.
 *
 * The closure is bounded and live, not a bigger timeout and not a teleport:
 *   - each key's direction is stamped with the up MEASURED AT THAT KEY's own
 *     post-burst snapshot (`upAtSample`), never a pre-round latch;
 *   - a retained direction survives a smooth face change because chooseKey3d
 *     already re-projects 3D directions into the CURRENT plane; staleness is
 *     decided per key against `upAtSample`, so a still-usable key is kept;
 *   - recalibration additionally requires MEANINGFUL DIRECTED MOTION since the
 *     last one (`minUnitsSinceCalib`), which is what breaks the loop: the tilt
 *     the calibration itself induced can no longer immediately re-trigger it;
 *   - calibration is capped (`maxCalibrations`) and only the keys that actually
 *     went stale are re-measured (`keysNeedingRecalibration`).
 * A/D remain full-3D and non-zero on +X (they move in world Y there), the +Y
 * frame stays proper, and no-progress / obstacle detection is untouched.
 *
 * DEFECT 2 — OBJECT-TRUTHINESS F GATE
 * -----------------------------------
 * `promptOffersF(prompts, verbPattern)` returns an OBJECT `{ok, why, matched,
 * prompts}`. The attempt-1 main probe passed that object straight into
 * `newActionGate({promptOffersF: offersF})` and `groundedActionGate`, where it
 * is only tested for truthiness — so `{ok:false}` for an unrelated `[F] Drink`
 * read as offered. The pinned contract already ships the correct helper,
 * `mayPressF({objectiveId, expectedObjectiveId, prompts, verbPattern})`.
 *
 * The authored survey-span action, read from the shipped source (not guessed):
 *   main/src/story/commonGroundDirector.ts:1627-1636
 *     survey.phase === 'drawing' && reach(CG_POSES.E, CG_POINT_REACH)
 *     -> { id: 'story-ch13-offer-span', verb: 'Offer the walked span' }
 *   directive key 'ch13:survey:offer-span' -> vector(CG_POSES.E)  (:1552)
 * The neighbouring `story-ch13-hold-witness` / 'Offer this end' (:1648) is a
 * DIFFERENT action for a DIFFERENT phase and must never satisfy this gate — the
 * earned-continue-3d selftest fixture used exactly that wrong verb.
 */

import { mayPressF } from './pinned/commonPassageLogic.pinned.mjs';
import {
  unit3, dot3, norm3, sub3, faceLabel, basisStale, calibrationSample
} from './tangentSteering3d.mjs';

/** The authored survey-span offer, transcribed from the shipped source. */
export const SPAN_OFFER_CONTRACT = Object.freeze({
  // FOUR SEPARATE NAMESPACES. Conflating them was the attempt-2 defect.
  //   actionId    -> storyInteractions candidate id (commonGroundDirector.ts:1632)
  //   verb        -> that candidate's verb           (commonGroundDirector.ts:1633)
  //   objectiveId -> HUD [data-story-guidance-hud][data-objective-id]
  //                  (objectivePrimitives.ts:761-766 via ch13SurveyObjective)
  //   directiveKey-> commonGroundMarkerTarget switch key (commonGroundDirector.ts:1552)
  // objectiveId and directiveKey happen to share the literal string; they are
  // still read from different publishers and are compared separately.
  actionId: 'story-ch13-offer-span',
  verb: 'Offer the walked span',
  verbPattern: /Offer the walked span/,
  beat: 'ch13-survey',
  surveyPhase: 'drawing',
  objectiveId: 'ch13:survey:offer-span',
  // The SAME survey.phase 'drawing' publishes 'ch13:survey:draw' until the
  // slot has >=2 samples AND the player is within CG_POINT_REACH of E
  // (commonGroundDirector.ts:1478-1485). Phase alone is NOT the objective.
  notYetObjectiveId: 'ch13:survey:draw',
  promptLine: '[F] Offer the walked span for W-7744 to test.',
  directiveKey: 'ch13:survey:offer-span',
  sourceRefs: Object.freeze([
    'main/src/story/commonGroundDirector.ts:1627-1636',
    'main/src/story/commonGroundDirector.ts:1478-1485',
    'main/src/story/beats/objectivePrimitives.ts:761-766',
    'main/src/story/ux/StoryGuidanceHud.tsx:148',
    'main/src/story/commonGroundDirector.ts:1552'
  ])
});

// ---------------------------------------------------------------------------
// DEFECT 1 — bounded live tangent calibration
// ---------------------------------------------------------------------------

/** Angle between two ups in degrees; null if either is degenerate. */
export function tiltDeg(a, b) {
  const x = unit3(a ?? [0, 0, 0]); const y = unit3(b ?? [0, 0, 0]);
  if (!x || !y) return null;
  return (Math.acos(Math.min(1, Math.max(-1, dot3(x, y)))) * 180) / Math.PI;
}

/**
 * One calibrated key entry stamped with the up measured AT ITS OWN sample.
 * `from`/`to` are FOOT poses; centre is never substituted.
 */
export function stampedCalibration({ key, from, to, upAtSample, minUnits = 0.05 }) {
  const s = calibrationSample({ key, from, to, up: upAtSample, minUnits });
  return {
    key,
    dir3d: s.usable ? s.dir3d : null,
    usable: s.usable,
    upAtSample: unit3(upAtSample ?? [0, 0, 0]),
    faceAtSample: faceLabel(upAtSample ?? [0, 0, 0]),
    moved3dUnits: s.moved3dUnits,
    movedTangentUnits: s.movedTangentUnits,
    movedNormalUnits: s.movedNormalUnits,
    frame: 'foot (bodyPose)',
    sample: s
  };
}

/**
 * Which stored keys must be re-measured against the CURRENT up, and which are
 * retained through a smooth face change. A key is retained when its own
 * `upAtSample` is within `maxTiltDeg` of current AND its stored 3D direction
 * still has usable projection in the current plane.
 */
/*
 * RETENTION BOUND. The 12 deg number in tangentSteering3d.basisStale was a
 * WHOLE-BASIS latch test; per-key retention is looser because chooseKey3d
 * re-projects a stored 3D direction into the CURRENT plane on every use. The
 * measured attempt-1 round-1 -> round-2 rotation was 32.49 deg, so a 12 deg
 * per-key bound would discard directions that still project usably and would
 * reproduce the thrash. 45 deg keeps a direction only while its in-plane
 * component is still dominant; beyond that the measurement is not trustworthy.
 */
export function keysNeedingRecalibration(entries, currentUp, { maxTiltDeg = 45, minTangent = 0.05 } = {}) {
  const stale = []; const retained = []; const detail = {};
  for (const [key, e] of Object.entries(entries ?? {})) {
    if (!e || !e.dir3d) { stale.push(key); detail[key] = { reason: 'no-measured-direction' }; continue; }
    const t = tiltDeg(e.upAtSample, currentUp);
    const proj = calibrationSample({ key, from: [0, 0, 0], to: e.dir3d, up: currentUp, minUnits: minTangent });
    const usableNow = proj.movedTangentUnits > minTangent;
    const ok = t != null && t <= maxTiltDeg && usableNow;
    detail[key] = { tiltDeg: t, tangentNow: proj.movedTangentUnits, usableNow, retained: ok };
    (ok ? retained : stale).push(key);
  }
  return { stale, retained, detail, maxTiltDeg, minTangent };
}

/**
 * THE THRASH BREAKER. A recalibration is authorized only when the basis is
 * genuinely stale AND the body has covered meaningful DIRECTED distance since
 * the last calibration finished. Calibration's own induced tilt therefore
 * cannot re-trigger calibration, and the count is hard-capped.
 *
 * `unitsSinceLastCalibration` must be measured from real foot displacement by
 * the caller; this helper invents no motion.
 */
export function recalibrationDecision({
  entries = {}, currentUp = null, unitsSinceLastCalibration = 0,
  calibrationsSoFar = 0, maxCalibrations = 6, minUnitsSinceCalib = 6,
  maxTiltDeg = 45, minTangent = 0.05
} = {}) {
  const need = keysNeedingRecalibration(entries, currentUp, { maxTiltDeg, minTangent });
  // STEERABILITY, not freshness: a key whose stored direction still projects
  // usably into the CURRENT plane can drive the next burst even if its own
  // upAtSample is now stale. Only when NOTHING projects usably is steering
  // genuinely impossible, and only then may the directed-motion guard be
  // bypassed. Conflating the two is what let calibration re-trigger itself.
  const anyUsableNow = Object.values(need.detail).some((d) => d?.usableNow === true);
  if (need.stale.length === 0) {
    return { recalibrate: false, reason: 'basis-fresh', keys: [], ...need, anyUsableNow };
  }
  if (calibrationsSoFar >= maxCalibrations) {
    return { recalibrate: false, reason: 'calibration-cap-reached (route attempt must stop or steer on retained keys, never loop)', keys: [], ...need, anyUsableNow, maxCalibrations };
  }
  if (unitsSinceLastCalibration < minUnitsSinceCalib && anyUsableNow) {
    return {
      recalibrate: false,
      reason: `only ${Number(unitsSinceLastCalibration).toFixed(3)}u of directed motion since the last calibration (< ${minUnitsSinceCalib}u): calibration-induced tilt may not re-trigger calibration while usable keys remain`,
      keys: [], ...need, anyUsableNow, unitsSinceLastCalibration, minUnitsSinceCalib
    };
  }
  return {
    recalibrate: true,
    reason: anyUsableNow ? 'stale-keys-after-real-progress' : 'no-usable-key-in-current-plane',
    keys: need.stale, ...need, anyUsableNow, unitsSinceLastCalibration, minUnitsSinceCalib
  };
}

/** Directed foot distance accumulator; pure, caller feeds real snapshots. */
export function accumulateDirected(prevUnits, footBefore, footAfter) {
  if (!Array.isArray(footBefore) || !Array.isArray(footAfter)) return prevUnits;
  return prevUnits + norm3(sub3(footAfter, footBefore));
}

/** Directions map in the shape chooseKey3d consumes, from stamped entries. */
export function dirsFromEntries(entries) {
  const out = {};
  for (const [k, e] of Object.entries(entries ?? {})) out[k] = e?.dir3d ?? null;
  return out;
}

/** Reporting-only: did the retained basis survive a smooth face change? */
export function faceChangeRetention(entries, currentUp) {
  const need = keysNeedingRecalibration(entries, currentUp);
  const faces = new Set(Object.values(entries ?? {}).map((e) => e?.faceAtSample).filter(Boolean));
  return {
    facesInBasis: [...faces],
    currentFace: faceLabel(currentUp ?? [0, 0, 0]),
    retainedAcrossFaceChange: need.retained,
    smoothChange: basisStale([...faces].length === 1 ? (Object.values(entries).find((e) => e?.upAtSample)?.upAtSample ?? [0, 1, 0]) : [0, 1, 0], currentUp ?? [0, 1, 0])
  };
}

// ---------------------------------------------------------------------------
// DEFECT 2 — signed F authorization
// ---------------------------------------------------------------------------

/**
 * The ONLY boolean the action gates may receive. Every condition is explicit:
 * the object result must have `ok === true`, the CURRENT objective must be the
 * authored one, the live beat and survey phase must bind, and the matched
 * prompt must carry the AUTHORED verb. A later unrelated anchor, a generic
 * phase change, or any other `[F] ...` prompt is refused. Nothing is pressed.
 */
export function signedSpanOfferAuthorization({
  prompts = null, objectiveId = null, beat = null, surveyPhase = null,
  contract = SPAN_OFFER_CONTRACT, footArrived = false, arrivalEvidence = null
} = {}) {
  const problems = [];
  const may = mayPressF({
    objectiveId,
    // OBJECTIVE namespace, not the INTERACTION actionId.
    expectedObjectiveId: contract.objectiveId,
    prompts,
    verbPattern: contract.verbPattern
  });
  if (may.ok !== true) problems.push(`no signed authored [F] offer: ${may.why}`);
  if (objectiveId === contract.notYetObjectiveId) {
    problems.push(`HUD objective is still ${contract.notYetObjectiveId}: the walked span is not yet offerable (samples<2 or foot outside CG_POINT_REACH of E)`);
  }
  if (beat !== contract.beat) problems.push(`beat ${JSON.stringify(beat)} is not the authored ${contract.beat}`);
  if (surveyPhase !== contract.surveyPhase) problems.push(`survey.phase ${JSON.stringify(surveyPhase)} is not the authored ${contract.surveyPhase}`);
  if (footArrived !== true) problems.push('physical arrival was not established from the published FOOT pose against current ground evidence');
  if (arrivalEvidence && arrivalEvidence.usable === false) problems.push(`arrival evidence unusable: ${arrivalEvidence.reason}`);
  const ok = problems.length === 0;
  return {
    ok,
    // The BOOLEAN the gates take. Never an object, never a truthy stand-in.
    promptOffersF: ok,
    matchedPrompt: may.prompt ?? null,
    expectedActionId: contract.actionId,
    expectedObjectiveId: contract.objectiveId,
    expectedVerb: contract.verb,
    objectiveId, beat, surveyPhase, footArrived,
    problems,
    note: 'boolean-only; derived from mayPressF().ok===true plus the authored objective/beat/phase and FOOT arrival. F is never forced.'
  };
}

/** Adaptation the main probe applies at its two gate call sites. */
export function gateInputsFromAuthorization(auth) {
  if (typeof auth?.promptOffersF !== 'boolean') {
    throw new TypeError('gate input must be a boolean; an object result is exactly the attempt-1 defect');
  }
  return { promptOffersF: auth.promptOffersF };
}
