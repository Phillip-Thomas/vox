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

/**
 * CALIBRATION COST BOUND (producer correction C4).
 *
 * The prior round held each key for 450 ms and then settled for 350 ms — 3.2 s
 * of scripted walking for one four-key round, which is exactly the "giant key
 * walk" that moved the body several units across a curved face mid-calibration.
 * An ordinary short press is enough to measure a DIRECTION, because usability is
 * decided on the tangent magnitude of that displacement in the key's OWN live
 * frame, not on covering distance. The settle is retained (shorter, still
 * controlled) so the post-burst snapshot is not read mid-acceleration.
 */
export const CALIBRATION_BOUNDS = Object.freeze({
  pressMs: 140,
  settleMs: 200,
  // Kept from the thrash closure. These are PRIVATE CONTROLLER LIMITS on this
  // probe's own behaviour; neither number is evidence that the route progressed.
  maxCalibrations: 6,
  minUnitsSinceCalib: 6,
  note: 'short ordinary press + controlled settle; usability comes from the per-key post-burst stamp (upAtSample), never from a pre-round latched basis'
});

/**
 * Apply retained directions to the live `dirs` map, CLEARING keys that are no
 * longer usable or no longer present.
 *
 * The prior call site was `if (retainedDirs[k]) dirs[k] = retainedDirs[k]`, so a
 * key that had just become unusable silently kept its stale direction and
 * chooseKey3d could pick it. Assignment is now total over `keys`.
 */
export function applyRetainedDirs(dirs, entries, keys) {
  const retained = dirsFromEntries(entries);
  const target = dirs ?? {};
  const cleared = [];
  for (const k of keys ?? []) {
    const next = retained[k] ?? null;
    if (next == null && target[k] != null) cleared.push(k);
    target[k] = next;
  }
  return { dirs: target, cleared, retainedKeys: (keys ?? []).filter((k) => retained[k] != null) };
}

/**
 * How many keys are usable RIGHT NOW, across ALL live stamped entries.
 *
 * A partial recalibration round that only re-measured W does not license the
 * claim "0 lateral keys usable": A and D were simply not in that round. The
 * prior `round.lateralKeysUsable` counted only the keys of the last round and
 * would report 0 lateral control while A/D were both live and steering.
 */
export function usableEntryCensus(entries, keys = ['KeyW', 'KeyS', 'KeyA', 'KeyD'], lateralKeys = ['KeyA', 'KeyD']) {
  const e = entries ?? {};
  const usable = keys.filter((k) => e[k]?.usable === true && e[k]?.dir3d);
  const lateral = usable.filter((k) => lateralKeys.includes(k));
  return {
    usableKeys: usable,
    usableCount: usable.length,
    unusableOrMissingKeys: keys.filter((k) => !usable.includes(k)),
    lateralUsableKeys: lateral,
    lateralUsableCount: lateral.length,
    scope: 'ALL live stamped entries, not the last (possibly partial) round',
    note: 'A key absent from the last partial round is neither usable nor unusable by that round; only its own live stamp decides.'
  };
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

// ---------------------------------------------------------------------------
// PRODUCER PREFLIGHT FAULT 2 — the directed-burst path may not guess an up.
//
// The prior call site passed `cur.up ?? [0, 1, 0]` into burst progress, into
// the re-measurement of the pressed key and into the restamp. A MISSING or
// INVALID published up therefore produced a confident measurement in a GUESSED
// world-up frame, and `if (restamp.usable) entries[k] = restamp` left the
// PREVIOUS stamp (and its direction) in place when the restamp failed, so a
// stale key stayed selectable by chooseKey3d.
//
// There is no fallback here. An up is either an ACTUAL published live reading
// or the burst is UNMEASURED: the key's calibration is CLEARED, no inference is
// made from it, and the caller stops. Unmeasured is recorded as unmeasured, and
// is never reported as a measured zero.
// ---------------------------------------------------------------------------

/**
 * Validate an ACTUAL published live up. No default, no world-up substitute.
 * Returns `{ valid: false, up: null, reason }` for anything that is not a real
 * finite, non-degenerate 3-vector.
 */
export function liveUpReading(rawUp) {
  if (rawUp == null) return { valid: false, up: null, raw: rawUp ?? null, reason: 'live-up-unpublished (null/undefined)' };
  if (!Array.isArray(rawUp) || rawUp.length < 3) return { valid: false, up: null, raw: rawUp, reason: 'live-up-malformed (not a 3-vector)' };
  const xyz = [rawUp[0], rawUp[1], rawUp[2]];
  if (!xyz.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return { valid: false, up: null, raw: rawUp, reason: 'live-up-non-finite (NaN/Infinity/non-number component)' };
  }
  const u = unit3(xyz);
  if (!u) return { valid: false, up: null, raw: rawUp, reason: 'live-up-degenerate (zero length)' };
  return { valid: true, up: u, raw: rawUp, face: faceLabel(u), reason: 'live-up-published' };
}

/**
 * ONE directed burst measurement against the live up that was ACTUALLY read
 * after that burst. Pure; the caller supplies real foot poses and the real
 * reading. Three outcomes, all explicit:
 *
 *  - `upReading.valid === false`  -> unmeasured. `clearKey` is true (the key's
 *    entry AND direction must be dropped), `inferenceRefused` is true, no
 *    progress/calibration/stamp is produced and `stop` is true.
 *  - measured but not usable      -> measured, NOT usable, `clearKey` still
 *    true: a failed restamp may never preserve the previous stamp.
 *  - measured and usable          -> the fresh stamp and direction.
 */
export function directedBurstMeasurement({
  key, from, to, upReading, previousEntry = null, minUnits = 0.05
} = {}) {
  const base = { key, previouslyStamped: previousEntry?.usable === true, minUnits };
  if (!upReading || upReading.valid !== true || !Array.isArray(upReading.up)) {
    return {
      ...base,
      measured: false, unmeasured: true, usable: false,
      clearKey: true, entry: null, dir3d: null,
      inferenceRefused: true, stop: true,
      upReading: upReading ?? { valid: false, up: null, reason: 'no-up-reading-supplied' },
      reason: `unmeasured-burst: ${upReading?.reason ?? 'no-up-reading-supplied'}; refusing to measure progress, calibration or a restamp in a guessed frame`,
      note: 'UNMEASURED, not a measured zero. No world-up fallback exists on this path.'
    };
  }
  if (!Array.isArray(from) || !Array.isArray(to)) {
    return {
      ...base, measured: false, unmeasured: true, usable: false,
      clearKey: true, entry: null, dir3d: null, inferenceRefused: true, stop: true,
      upReading,
      reason: 'unmeasured-burst: foot pose unpublished before or after the burst',
      note: 'UNMEASURED, not a measured zero.'
    };
  }
  const stamp = stampedCalibration({ key, from, to, upAtSample: upReading.up, minUnits });
  if (!stamp.usable) {
    return {
      ...base, measured: true, unmeasured: false, usable: false,
      clearKey: true, entry: null, dir3d: null, inferenceRefused: false, stop: false,
      upReading, stamp,
      reason: `restamp-failed: measured against the live up but below the usable tangent bound (${stamp.movedTangentUnits}u); the previous stamp is CLEARED, never retained`,
      note: 'A failed restamp clears the key. It cannot leave a stale usable direction behind.'
    };
  }
  return {
    ...base, measured: true, unmeasured: false, usable: true,
    clearKey: false, entry: stamp, dir3d: stamp.dir3d,
    inferenceRefused: false, stop: false,
    upReading, stamp, reason: 'restamped against the actual live up'
  };
}
