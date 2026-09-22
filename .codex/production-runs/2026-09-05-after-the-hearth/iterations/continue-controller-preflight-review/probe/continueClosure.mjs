/**
 * PRIVATE PROBE HELPER — continue-controller-closure. PREPARED, NEVER RUN HEADED.
 *
 * Closes producer corrections C1 (span-offer acceptance), C2 (real telemetry
 * hooks/field identity) and C3 (capture window) of
 * producer-continue-controller-wire-review.json. Nothing in main/src is touched
 * and no game behaviour is asserted here: these are pure verifier-side readers
 * and decisions, exercised by continueClosure.selftest.mjs on CPU.
 *
 * C1 — 19 WAS NEVER AN ANCHOR COUNT.
 * The prior acceptance required `anchorsBefore.slice(0, 19).length === 19`. 19 is
 * the serialized SURVEY POINT count of the earned save, not a story-anchor count;
 * a restored state with 7 or 8 real anchors would have been refused for a reason
 * that has nothing to do with the action under test. Acceptance here is exactly:
 * signed authorization, [F] actually pressed, `anc.cg.route-offered` NEW relative
 * to the pre-[F] reading, and every ACTUAL pre-[F] anchor still present IN ORDER.
 * No minimum, no count claim. The separate full-WorldSave/point-prefix equality
 * gate after Continue (`overwriteVerdict`) is untouched and still required.
 *
 * C2 — THE SYSTEM HOOK WAS GUESSED.
 * `window.__paravoxiaSystem` does not exist. The shipped hook that publishes
 * `activePlanetId` and `renderOrigin` is the journey probe, exactly as
 * main/tools/lib/evidence.mjs:126-140 already reads it:
 *   __paravoxiaJourneyProbe.snapshot().state.systemFlight
 * (published by main/src/story/JourneyRuntimeProbeBridge.tsx:229 as an array
 * `renderOrigin`). `worldBound` is a DIFFERENT thing: a boolean on the common
 * ground bridge (`main/src/story/commonGroundDirector.ts:1876,1931 —
 * worldBound: binding !== null`). The prior `s.renderOrigin ?? s.worldBound`
 * would have recorded the boolean `true` as a render origin. It never can here.
 *
 * C3 — HARVEST WAS BOTH TOO EARLY AND TOO NARROW.
 * The loop broke as soon as a survey snapshot plus the HUD existed, and the
 * harvest then discarded every frame with `ms > 5000` since the click. The pose
 * change of interest was observed ~1 s AFTER that first valid runtime reading,
 * and on a late boot the first valid reading itself lands past 5000 ms, so the
 * filter could drop the entire signal. Capture is retained from BEFORE the click
 * through at least `holdAfterFirstValidMs` past the first valid runtime
 * foot+HUD reading, bounded by `maxWindowMs`. If the boot is so late that the
 * hold cannot fit inside the bound, the run reports INCOMPLETE — never a pass.
 */

// ---------------------------------------------------------------------------
// C1 — span-offer acceptance on the restored state
// ---------------------------------------------------------------------------

export const ROUTE_OFFERED_ANCHOR_ID = 'anc.cg.route-offered';

/**
 * Did the ACTUAL [F] press produce the authored span offer on restored state?
 *
 * `anchorsBefore` is the live pre-[F] reading, whatever its real length. Its
 * whole content must survive in order (an anchor list the action truncated or
 * reordered is a failure), and the route-offered anchor must be NEW. A generic
 * survey-phase change is deliberately not an input: it cannot make this true.
 *
 * Source of the transition under test (authority already read, no re-audit):
 *   main/src/story/commonGroundDirector.ts commitCommonGroundSpanOffer (~:1172)
 *   sets survey phase 'offered' and notes anchor `anc.cg.route-offered`.
 */
export function spanOfferAcceptance({
  anchorsBefore = null, anchorsAfter = null,
  signedAuthorizationOk = false, fPressed = false,
  anchorId = ROUTE_OFFERED_ANCHOR_ID
} = {}) {
  const problems = [];
  const observed = Array.isArray(anchorsBefore) && Array.isArray(anchorsAfter);
  const before = Array.isArray(anchorsBefore) ? anchorsBefore : [];
  const after = Array.isArray(anchorsAfter) ? anchorsAfter : [];
  if (!observed) problems.push('anchor lists were not both observed as arrays; acceptance is unmeasured, not true');

  const presentBefore = before.includes(anchorId);
  const presentAfter = after.includes(anchorId);
  const newRouteOfferedAnchor = observed && !presentBefore && presentAfter;
  if (observed && presentBefore) problems.push(`${anchorId} was ALREADY present before [F]: its presence after proves nothing about this press`);
  else if (observed && !presentAfter) problems.push(`${anchorId} is absent after [F]`);

  // Every ACTUAL pre-[F] anchor, in its actual order. No count, no minimum.
  const lostOrReordered = before
    .map((a, k) => (after[k] === a ? null : { index: k, expected: a, found: after[k] ?? null }))
    .filter(Boolean);
  const beforeAnchorsPreservedInOrder = observed && lostOrReordered.length === 0;
  if (observed && !beforeAnchorsPreservedInOrder) {
    problems.push(`pre-[F] anchors were not preserved in order at ${lostOrReordered.length} position(s)`);
  }

  if (signedAuthorizationOk !== true) problems.push('[F] was not pressed under a signed authorization');
  if (fPressed !== true) problems.push('[F] was not actually pressed');

  const unrelatedNewAnchors = after.filter((a) => !before.includes(a) && a !== anchorId);
  const accepted = signedAuthorizationOk === true && fPressed === true
    && newRouteOfferedAnchor === true && beforeAnchorsPreservedInOrder === true;

  return {
    accepted,
    rule: 'signedAuthorizationOk && fPressed && NEW ' + anchorId + ' since the pre-[F] reading && all actual pre-[F] anchors preserved in order',
    anchorId,
    signedAuthorizationOk: signedAuthorizationOk === true,
    fPressed: fPressed === true,
    newRouteOfferedAnchor,
    beforeAnchorsPreservedInOrder,
    lostOrReorderedAnchors: lostOrReordered,
    unrelatedNewAnchors,
    observedAnchorCounts: { before: observed ? before.length : null, after: observed ? after.length : null },
    problems,
    note: 'Anchor counts are REPORTED, never required. No fixed prefix length is asserted: 19 was the serialized survey POINT count, not an anchor count. The full WorldSave/point-prefix equality after Continue is a separate, still-required gate (overwriteVerdict).'
  };
}

// ---------------------------------------------------------------------------
// C2 — the per-frame reader, exercised in BOTH the page and the CPU test
// ---------------------------------------------------------------------------

/**
 * PURE, SELF-CONTAINED page-side frame reader. It closes over nothing, so its
 * own `.toString()` source is what the installed sampler evaluates; the CPU
 * selftest calls the SAME function against fixtures shaped like the real hooks.
 *
 * `w` is a window-like object. Absent fields stay null. Errors are recorded on
 * the frame instead of losing it.
 */
export function readContinueFrame(w, ms) {
  var frame = {
    ms: ms,
    beat: null, beatPublished: false,
    journeyProbePublished: false, systemFlightPublished: false,
    activePlanetId: null, locationMode: null,
    renderOrigin: null, renderOriginSource: null,
    cgPublished: false, worldBound: null,
    cgFoot: null, capsule: null, up: null,
    surveyPhase: null, anchorCount: null,
    terrainSeed: null, playerRequested: null, voxelDebugPublished: false,
    error: null
  };
  try {
    frame.beatPublished = Object.prototype.hasOwnProperty.call(w, '__storyBeat');
    frame.beat = w.__storyBeat === undefined ? null : w.__storyBeat;

    // THE REAL SYSTEM HOOK (evidence.mjs:126-140). __paravoxiaSystem was a guess.
    var snap = (w.__paravoxiaJourneyProbe && typeof w.__paravoxiaJourneyProbe.snapshot === 'function')
      ? w.__paravoxiaJourneyProbe.snapshot() : null;
    frame.journeyProbePublished = !!snap;
    var sf = (snap && snap.state) ? snap.state.systemFlight : null;
    frame.systemFlightPublished = !!sf;
    if (sf) {
      frame.activePlanetId = sf.activePlanetId === undefined ? null : sf.activePlanetId;
      frame.locationMode = sf.locationMode === undefined ? null : sf.locationMode;
      // renderOrigin is an ARRAY published by JourneyRuntimeProbeBridge:229.
      // A boolean is never a render origin.
      if (Array.isArray(sf.renderOrigin)) {
        frame.renderOrigin = sf.renderOrigin.slice();
        frame.renderOriginSource = 'journeyProbe.state.systemFlight.renderOrigin';
      }
    }

    // COMMON GROUND bridge: bodyPose/bodyCentre/up are TOP-LEVEL; anchors and
    // survey live under .diagnostic (cgSnap in the entry reads them the same way).
    var s = (w.__paravoxiaCommonGround && typeof w.__paravoxiaCommonGround.snapshot === 'function')
      ? w.__paravoxiaCommonGround.snapshot() : null;
    frame.cgPublished = !!s;
    if (s) {
      // DISTINCT boolean. It is not, and can never become, a render origin.
      frame.worldBound = typeof s.worldBound === 'boolean' ? s.worldBound : null;
      frame.cgFoot = Array.isArray(s.bodyPose) ? s.bodyPose.slice() : null;
      frame.capsule = Array.isArray(s.bodyCentre) ? s.bodyCentre.slice() : null;
      frame.up = Array.isArray(s.up) ? s.up.slice() : null;
      var diag = s.diagnostic || null;
      if (diag && diag.survey && diag.survey.phase !== undefined) frame.surveyPhase = diag.survey.phase;
      if (diag && Array.isArray(diag.anchors)) frame.anchorCount = diag.anchors.length;
    }

    var vd = (w.__voxelDebug && w.__voxelDebug.spawn) ? w.__voxelDebug.spawn : null;
    frame.voxelDebugPublished = !!vd;
    if (vd) {
      frame.terrainSeed = vd.terrainSeed === undefined ? null : vd.terrainSeed;
      frame.playerRequested = Array.isArray(vd.playerRequested) ? vd.playerRequested.slice() : null;
    }
  } catch (e) {
    frame.error = String(e && e.message ? e.message : e).slice(0, 200);
  }
  return frame;
}

/** The exact bytes injected into the page, so both sides run one function. */
export const CONTINUE_FRAME_READER_SOURCE = readContinueFrame.toString();

// ---------------------------------------------------------------------------
// C3 — capture window
// ---------------------------------------------------------------------------

export const CONTINUE_CAPTURE = Object.freeze({
  holdAfterFirstValidMs: 5000,
  maxWindowMs: 30000,
  // UNCHANGED shipped-wait budget for the Continue itself.
  continueWaitBudgetMs: 60000,
  maxFrames: 6000
});

/** A frame counts as the first valid runtime reading only with a real foot AND HUD. */
export function isValidRuntimeReading({ frame = null, hudPresent = false, menuPresent = true } = {}) {
  return !!(frame && Array.isArray(frame.cgFoot) && frame.cgFoot.length >= 3
    && hudPresent === true && menuPresent === false);
}

/**
 * Should capture continue at `msSinceClick`? The 5 s hold is measured from the
 * FIRST VALID RUNTIME reading, never from the click, so a late boot does not
 * silently truncate the observation.
 */
export function continueCaptureDecision({
  msSinceClick = 0, firstValidRuntimeMs = null,
  holdAfterFirstValidMs = CONTINUE_CAPTURE.holdAfterFirstValidMs,
  maxWindowMs = CONTINUE_CAPTURE.maxWindowMs
} = {}) {
  const holdUntilMs = firstValidRuntimeMs == null ? null : firstValidRuntimeMs + holdAfterFirstValidMs;
  const holdSatisfied = holdUntilMs != null && msSinceClick >= holdUntilMs;
  if (msSinceClick >= maxWindowMs) {
    return {
      keepCapturing: false, reason: 'window-cap-reached', capped: true,
      msSinceClick, firstValidRuntimeMs, holdUntilMs, holdSatisfied,
      holdAfterFirstValidMs, maxWindowMs
    };
  }
  if (firstValidRuntimeMs == null) {
    return {
      keepCapturing: true, reason: 'awaiting-first-valid-runtime-foot-and-hud', capped: false,
      msSinceClick, firstValidRuntimeMs, holdUntilMs, holdSatisfied,
      holdAfterFirstValidMs, maxWindowMs
    };
  }
  return {
    keepCapturing: !holdSatisfied,
    reason: holdSatisfied ? 'hold-after-first-valid-runtime-satisfied' : 'holding-after-first-valid-runtime',
    capped: false, msSinceClick, firstValidRuntimeMs, holdUntilMs, holdSatisfied,
    holdAfterFirstValidMs, maxWindowMs
  };
}

/** INCOMPLETE is reported as incomplete. It is never reported as proof. */
export function continueCaptureCompleteness({
  firstValidRuntimeMs = null, lastObservedMs = null, capped = false,
  holdAfterFirstValidMs = CONTINUE_CAPTURE.holdAfterFirstValidMs
} = {}) {
  if (firstValidRuntimeMs == null) {
    return { complete: false, verdict: 'incomplete', reason: 'no valid runtime foot+HUD reading was observed inside the bounded window' };
  }
  const need = firstValidRuntimeMs + holdAfterFirstValidMs;
  if (lastObservedMs == null || lastObservedMs < need) {
    return {
      complete: false, verdict: 'incomplete',
      reason: `late boot: first valid runtime reading at ${firstValidRuntimeMs}ms leaves no room for the ${holdAfterFirstValidMs}ms hold inside the bound (last observed ${lastObservedMs}ms${capped ? ', window cap reached' : ''})`,
      firstValidRuntimeMs, lastObservedMs, requiredThroughMs: need, capped
    };
  }
  return {
    complete: true, verdict: 'complete',
    reason: `retained through ${lastObservedMs}ms, at least ${holdAfterFirstValidMs}ms past the first valid runtime reading at ${firstValidRuntimeMs}ms`,
    firstValidRuntimeMs, lastObservedMs, requiredThroughMs: need, capped
  };
}

/** Pure summary over the RETAINED frames. No frame is filtered away. */
export function summariseContinueFrames(frames, { firstValidRuntimeMs = null } = {}) {
  const f = Array.isArray(frames) ? frames : [];
  const firstFoot = f.find((x) => Array.isArray(x.cgFoot)) ?? null;
  const changed = firstFoot
    ? f.find((x) => Array.isArray(x.cgFoot) && x.cgFoot.some((v, i) => v !== firstFoot.cgFoot[i])) ?? null
    : null;
  const uniq = (pick) => [...new Set(f.map((x) => JSON.stringify(pick(x))))];
  return {
    frameCount: f.length,
    retainedAllFrames: true,
    firstMs: f.length ? f[0].ms : null,
    lastMs: f.length ? f[f.length - 1].ms : null,
    firstValidRuntimeMs,
    firstFootMs: firstFoot ? firstFoot.ms : null,
    firstFootChangeMs: changed ? changed.ms : null,
    msFromFirstFootToChange: (firstFoot && changed) ? changed.ms - firstFoot.ms : null,
    framesWithError: f.filter((x) => x.error != null).length,
    firstError: (f.find((x) => x.error != null) ?? {}).error ?? null,
    neverPublished: {
      storyBeat: f.every((x) => x.beat == null),
      journeyProbe: f.every((x) => !x.journeyProbePublished),
      systemFlight: f.every((x) => !x.systemFlightPublished),
      activePlanetId: f.every((x) => x.activePlanetId == null),
      renderOrigin: f.every((x) => x.renderOrigin == null),
      worldBound: f.every((x) => x.worldBound == null),
      cgFoot: f.every((x) => x.cgFoot == null),
      voxelDebugSpawn: f.every((x) => !x.voxelDebugPublished)
    },
    transitions: {
      beat: uniq((x) => x.beat),
      activePlanetId: uniq((x) => x.activePlanetId),
      worldBound: uniq((x) => x.worldBound),
      surveyPhase: uniq((x) => x.surveyPhase),
      terrainSeed: uniq((x) => x.terrainSeed)
    },
    fieldIdentity: 'renderOrigin is read ONLY from journeyProbe.state.systemFlight.renderOrigin; worldBound is a separate boolean and is never aliased to it'
  };
}
