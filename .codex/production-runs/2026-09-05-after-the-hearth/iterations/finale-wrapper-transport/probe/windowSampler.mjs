/**
 * ATOMIC FINALE-WINDOW SAMPLER — run-local to 2026-09-05-after-the-hearth,
 * owned by the finale-window lane. Nothing here starts a browser, and nothing
 * here touches game source: it only builds the STRING of an in-page function
 * that reads existing shipped read-only hooks.
 *
 * WHY IT EXISTS (E1 of finale-lifecycle-audit.json)
 * -------------------------------------------------
 * The journey probe's trace record is stitched from THREE awaited
 * page.evaluate() calls, so story/avFull fields are older than the CG/score
 * fields inside the same "sample". That is a read-ordering artefact, and it is
 * the reason the token lifetime is bounded only to (0.0235 s, ~0.33 s].
 *
 * The fix needs NO new game hook: every read is co-located inside ONE
 * synchronous function body that runs inside ONE requestAnimationFrame
 * callback, on the same frame, before any await can interleave. The page keeps
 * the samples in its own bounded ring buffer; Node serializes AFTER the window
 * has been sealed, so no CDP round-trip (screenshot, evaluate) can be the thing
 * that loses the completion edge.
 *
 * HONESTY RULES BAKED IN
 * ----------------------
 *   - A hook that is absent is recorded as {available:false, reason} and is
 *     NEVER defaulted to null-as-if-read. "Unavailable" and "read as null" are
 *     different facts and stay different in the buffer.
 *   - No shipped hook reports the cancellation REASON (commonGroundScore.ts:259
 *     discards `_reason`) and no shipped hook reports AudioContext.state
 *     directly. This sampler therefore records what exists and marks those two
 *     signals MISSING. It never infers a cause.
 *   - Nothing is written into the game: no store, pose, anchor, progress or
 *     audio-state mutation, no global patch, no AudioContext construction.
 *     `getSnapshot`/`snapshot`/`__voxBundleDiag`/`__voxAudioDiag` are the
 *     shipped read-only diagnostics; `document.hasFocus()` is a DOM read.
 */

export const SAMPLER_SCHEMA = 'paravoxia.verifier.finaleWindowSampler.v2';

/**
 * Values COPIED from inspected (never modified) game source, so the sampler
 * matches the actual runtime shape rather than a presumed one:
 *   main/src/story/JourneyRuntimeProbeBridge.tsx:244-252  state.signedSceneAv
 *   main/src/story/commonGroundDirector.ts:354-355,1408-1409  anchor ids
 *   main/src/story/commonGroundState.ts:121  CG_COMMON_ROUTE_UNITS = 18
 *   main/src/story/commonGroundDirector.ts:1801-1810  diagnostic.common
 */
export const AV_ANCHOR_COMPLETE = 'anc.cg.complete';
export const AV_ANCHOR_HANDBACK = 'anc.cg.handback';
export const CG_COMMON_ROUTE_UNITS = 18;

/** Default window shape. All bounded; the sampler can never run unbounded. */
export const DEFAULT_WINDOW = Object.freeze({
  preEdgeMs: 3000,        // retained BEFORE the completion edge
  postEdgeMs: 11500,      // retained AFTER it (>= the 11 s the producer requires)
  maxSamples: 6000,       // hard ring cap (~100 s at 60 Hz) — memory bound
  maxRunMs: 420000,       // absolute self-termination, edge or no edge
  driver: 'raf'           // 'raf' | 'timer' (timer is the justified fallback)
});

// ---------------------------------------------------------------- pure logic --
// These three functions are the sampler's decision core. They are pure so the
// CPU self-test can exercise the structure, the event-window termination and
// the failure paths with no browser at all.

/**
 * Completion edge: the first sample whose story state is BOTH handed back and
 * done. We require the AV activation history to actually carry complete AND
 * handback, so a beat-only flip cannot be mistaken for the edge.
 */
export function detectEdge(sample) {
  return edgeReason(sample).edge;
}

/**
 * The edge predicate with its evidence, so a NON-edge is explainable and an
 * absent signal is never silently read as false.
 *
 * Requires, IN ONE atomic sample:
 *   - story beat done / story inactive,
 *   - the actual activationHistoryAnchorIds array containing BOTH
 *     'anc.cg.complete' AND 'anc.cg.handback' by exact string membership,
 *   - the live CG diagnostic.common with committed === true AND BOTH
 *     terraUnits >= 18 AND workerUnits >= 18 (CG_COMMON_ROUTE_UNITS). The
 *     producer requires both sides of the common route, not worker alone.
 * Any of those being unavailable/absent yields edge:false with a reason of
 * 'unavailable', which is NOT the same fact as an observed false.
 */
export function edgeReason(sample) {
  const st = sample?.story;
  const cg = sample?.cg;
  const ev = {};
  if (!st || st.available === false) return { edge: false, reason: 'story-unavailable', evidence: ev };
  ev.beat = st.beat ?? null;
  ev.active = st.active ?? null;
  const done = st.beat === 'done' || st.active === false;
  if (st.avHistoryPresent !== true) {
    return { edge: false, reason: st.avMemberPresent === true ? 'av-history-absent' : 'av-member-absent', evidence: ev };
  }
  ev.avHasCgComplete = st.avHasCgComplete;
  ev.avHasCgHandback = st.avHasCgHandback;
  const anchors = st.avHasCgComplete === true && st.avHasCgHandback === true;
  if (!cg || cg.available === false) return { edge: false, reason: 'cg-unavailable', evidence: ev };
  const common = cg.common;
  if (!common || common.available !== true || common.value === null) {
    return { edge: false, reason: 'cg-common-unavailable', evidence: ev };
  }
  ev.committed = common.committed;
  ev.workerUnits = common.workerUnits;
  ev.terraUnits = common.terraUnits;
  ev.routeUnitsRequired = CG_COMMON_ROUTE_UNITS;
  // Absence of EITHER side is 'absent', not a negative observation.
  if (common.committedPresent !== true
      || common.workerUnitsPresent !== true || typeof common.workerUnits !== 'number'
      || common.terraUnitsPresent !== true || typeof common.terraUnits !== 'number') {
    return { edge: false, reason: 'cg-common-fields-absent', evidence: ev };
  }
  // BOTH routes at full units, committed, in this one atomic record. The 1e-6
  // is the pre-existing float-equality guard and is applied IDENTICALLY to both
  // sides; it is NOT widened, so 17 (or 6) never satisfies 18.
  const worker18 = common.workerUnits + 1e-6 >= CG_COMMON_ROUTE_UNITS;
  const terra18 = common.terraUnits + 1e-6 >= CG_COMMON_ROUTE_UNITS;
  const committed18 = common.committed === true && worker18 && terra18;
  const edge = done && anchors && committed18;
  return {
    edge,
    reason: edge ? 'complete+handback+committed-terra18-worker18'
      : (!done ? 'story-not-done'
        : (!anchors ? 'anchor-ids-missing'
          : (!terra18 ? 'common-terra-not-18'
            : (!worker18 ? 'common-worker-not-18' : 'common-not-committed')))),
    evidence: ev
  };
}

/**
 * Termination: sealed once the retained post-edge span is complete, or when the
 * absolute run bound is hit (which is a MEASURED FAILURE of the window, never a
 * success). Returns a reason string or null.
 */
export function shouldTerminate(state, nowMs, cfg = DEFAULT_WINDOW) {
  if (state.edgeAtMs != null && nowMs - state.edgeAtMs >= cfg.postEdgeMs) return 'window-complete';
  if (nowMs - state.startedAtMs >= cfg.maxRunMs) {
    return state.edgeAtMs == null ? 'max-run-no-edge' : 'max-run-truncated-window';
  }
  return null;
}

/**
 * Ring retention: before the edge we keep only the trailing preEdgeMs; after
 * the edge we keep EVERYTHING (that is the evidence). The hard cap is a memory
 * bound and, if it ever bites, it is recorded as `dropped` rather than hidden.
 */
export function decideRetention(buffer, nowMs, edgeAtMs, cfg = DEFAULT_WINDOW) {
  let cut = 0;
  if (edgeAtMs == null) {
    while (cut < buffer.length && nowMs - buffer[cut].tMs > cfg.preEdgeMs) cut += 1;
  } else {
    while (cut < buffer.length && edgeAtMs - buffer[cut].tMs > cfg.preEdgeMs) cut += 1;
  }
  let overflow = 0;
  if (buffer.length - cut > cfg.maxSamples) overflow = buffer.length - cut - cfg.maxSamples;
  return { dropFromHead: cut + overflow, capHit: overflow > 0 };
}

/** Signals this lane knows are NOT obtainable from any shipped hook. */
export const KNOWN_MISSING_SIGNALS = Object.freeze([
  {
    signal: 'final-texture cancellation reason / calling site',
    why: 'commonGroundScore.ts:259 takes the reason as `_reason` and discards it; nothing records the caller.',
    consequence: 'No capture, including this one, can name WHICH suspend/cancel call fired. Timing adjacency is the only available discriminator and it is circumstantial.'
  },
  {
    signal: 'AudioContext.state / musicVolume / mute at the clearing frame',
    why: 'No shipped read-only hook exposes the context object or the mixer state; __voxAudioDiag returns describeGameAudioOutputRoutes() (a route description string), not the context state.',
    consequence: 'The audio-block alternative (A1) cannot be excluded by state read; it can only be bounded by what the route description does or does not say.'
  },
  {
    signal: 'paused / hudBlockingOverlayOpen / downed / worldGenReady / initialRenderReleased (App.tsx foreground conjuncts)',
    why: 'They are React component state, not exposed on any diagnostic surface.',
    consequence: 'A2 (the "pause" reason label) stays undistinguishable from the story-inactive label by state read alone.'
  }
]);

/**
 * Build the in-page installer source. It is injected verbatim via
 * page.evaluate(installerSource, cfg) and installs
 * `window.__finaleWindowProbe` (a probe-owned namespace, NOT a game global; it
 * is deleted on teardown and never read by the game).
 */
export function buildInstallerSource() {
  return `(cfg) => {
  const CG_COMMON_ROUTE_UNITS = ${CG_COMMON_ROUTE_UNITS};
  const edgeReason = ${edgeReason.toString()};
  if (window.__finaleWindowProbe && window.__finaleWindowProbe.installed) {
    return { installed: false, reason: 'already-installed' };
  }
  const unavailable = (reason) => ({ available: false, reason });
  const call = (fn, thisArg) => {
    try {
      if (typeof fn !== 'function') return unavailable('hook-not-a-function');
      const v = fn.call(thisArg);
      return v === undefined ? unavailable('hook-returned-undefined') : { available: true, value: v };
    } catch (e) { return unavailable('threw:' + String(e && e.message ? e.message : e).slice(0, 120)); }
  };

  // ---- feature detection, ONCE, recorded verbatim -------------------------
  const inventory = {
    __paravoxiaCommonGround: typeof window.__paravoxiaCommonGround,
    'commonGround.snapshot': typeof window.__paravoxiaCommonGround?.snapshot,
    'commonGround.scoreDiagnostic': typeof window.__paravoxiaCommonGround?.scoreDiagnostic,
    __paravoxiaJourneyProbe: typeof window.__paravoxiaJourneyProbe,
    'journeyProbe.getSnapshot': typeof window.__paravoxiaJourneyProbe?.getSnapshot,
    'journeyProbe.getCommonGroundScoreDiagnostic': typeof window.__paravoxiaJourneyProbe?.getCommonGroundScoreDiagnostic,
    __voxBundleDiag: typeof window.__voxBundleDiag,
    __voxAudioDiag: typeof window.__voxAudioDiag,
    __storyBeat: typeof window.__storyBeat,
    __autopilot: typeof window.__autopilot,
    __auditWorker: typeof window.__auditWorker,
    __game: typeof window.__game
  };

  const state = {
    startedAtMs: performance.now(),
    startedAtWallMs: Date.now(),
    timeOriginMs: performance.timeOrigin,
    edgeAtMs: null,
    edgeIndex: null,
    sealed: false,
    sealReason: null,
    frames: 0,
    dropped: 0,
    capHit: false,
    sampleErrors: 0,
    lastError: null
  };
  const buf = [];

  // ---- THE ONE SYNCHRONOUS SAMPLING FUNCTION ------------------------------
  // Everything below runs inside a single rAF callback in one uninterrupted JS
  // turn, so all fields in one record come from ONE frame.
  const sample = (rafTimeMs) => {
    const tMs = performance.now();
    const rec = { tMs, rafTimeMs: rafTimeMs ?? null, wallMs: Date.now() };

    // -- Common Ground snapshot (score / beat / anchors) --
    const cgFn = window.__paravoxiaCommonGround?.snapshot;
    const cg = call(cgFn, window.__paravoxiaCommonGround);
    if (!cg.available) { rec.cg = cg; rec.score = cg; }
    else {
      const s = cg.value || {};
      rec.cg = {
        available: true,
        diagnosticBeat: s.diagnostic?.beat ?? null,
        diagnosticPresent: s.diagnostic !== undefined,
        anchors: s.diagnostic?.anchors ?? s.anchors ?? null,
        // ACTUAL shape (commonGroundDirector.getCommonGroundDiagnostic):
        // diagnostic.common = { stage, terraUnits, comparisonProved,
        // finalReferenceOffered, finalReferenceOccupied, workerUnits, committed }.
        // Read in THIS sample so the completion edge can require the live
        // 18/18 committed common route from the SAME frame.
        common: s.diagnostic?.common === undefined
          ? unavailable('diagnostic-has-no-common-member')
          : (s.diagnostic.common === null
              ? { available: true, value: null, note: 'common member present and null (no live CG snapshot)' }
              : { available: true,
                  stage: s.diagnostic.common.stage ?? null,
                  committed: typeof s.diagnostic.common.committed === 'boolean' ? s.diagnostic.common.committed : null,
                  committedPresent: s.diagnostic.common.committed !== undefined,
                  workerUnits: typeof s.diagnostic.common.workerUnits === 'number' ? s.diagnostic.common.workerUnits : null,
                  workerUnitsPresent: s.diagnostic.common.workerUnits !== undefined,
                  // BOTH sides of the common route are required at the edge, so
                  // terraUnits is read with the SAME presence/type guard as
                  // workerUnits: an ABSENT member must stay distinguishable
                  // from an observed number, never collapse to null-as-if-read.
                  terraUnits: typeof s.diagnostic.common.terraUnits === 'number' ? s.diagnostic.common.terraUnits : null,
                  terraUnitsPresent: s.diagnostic.common.terraUnits !== undefined,
                  routeUnitsRequired: ${CG_COMMON_ROUTE_UNITS},
                  comparisonProved: s.diagnostic.common.comparisonProved ?? null,
                  finalReferenceOffered: s.diagnostic.common.finalReferenceOffered ?? null }),
        pendingAnchors: s.pendingAnchors ?? null,
        railCursor: s.railCursor ?? null,
        bodyCentre: s.bodyCentre ?? null,
        supported: s.supported ?? null
      };
      rec.score = s.score === undefined
        ? unavailable('snapshot-has-no-score-member')
        : (s.score === null
            ? { available: true, value: null, note: 'score member present and null' }
            : { available: true, beat: s.score.beat ?? null, mood: s.score.mood ?? null,
                finalTextureSeconds: s.score.finalTextureSeconds === undefined ? null : s.score.finalTextureSeconds,
                finalTextureSecondsPresent: s.score.finalTextureSeconds !== undefined });
    }

    // -- story state / AV history / common units --
    const jp = call(window.__paravoxiaJourneyProbe?.getSnapshot, window.__paravoxiaJourneyProbe);
    if (!jp.available) rec.story = jp;
    else {
      const s = jp.value || {};
      const story = s.state?.story ?? s.story ?? null;
      // ACTUAL bridge shape (JourneyRuntimeProbeBridge.buildSnapshot):
      //   snapshot.state.signedSceneAv = { active, suspended, beat, anchorId,
      //   anchorEvent, activationSequence, activationHistoryAnchorIds: string[] }
      // There is NO state.avFull member. An ABSENT member stays absent
      // (null + a *Present flag); it is never reported as false.
      const avPresent = s.state !== undefined && s.state !== null
        && Object.prototype.hasOwnProperty.call(s.state, 'signedSceneAv');
      const av = avPresent ? s.state.signedSceneAv : null;
      const ids = Array.isArray(av?.activationHistoryAnchorIds) ? av.activationHistoryAnchorIds : null;
      // EXACT named membership, never a substring/JSON regex.
      const hasId = (id) => (ids === null ? null : ids.indexOf(id) !== -1);
      rec.story = story === null ? unavailable('snapshot-has-no-story') : {
        available: true,
        active: story.active ?? null,
        chapter: story.chapter ?? null,
        beat: story.beat ?? null,
        runId: story.runId ?? null,
        objectiveId: s.state?.objective?.id ?? s.objective?.id ?? null,
        milestones: Array.isArray(s.state?.milestones) ? s.state.milestones.slice(-8) : null,
        avMemberPresent: avPresent,
        avAvailable: av != null,
        avActive: av ? (av.active ?? null) : null,
        avSuspended: av ? (av.suspended ?? null) : null,
        avBeat: av ? (av.beat ?? null) : null,
        avAnchorId: av ? (av.anchorId ?? null) : null,
        avAnchorEvent: av ? (av.anchorEvent ?? null) : null,
        avActivationSequence: av ? (av.activationSequence ?? null) : null,
        avHistoryPresent: ids !== null,
        avHistoryAnchorIds: ids ? ids.slice() : null,
        avHasCgComplete: hasId('${AV_ANCHOR_COMPLETE}'),
        avHasCgHandback: hasId('${AV_ANCHOR_HANDBACK}'),
        avHistoryCount: ids ? ids.length : null,
        common: s.state?.commonGround ?? s.commonGround ?? s.state?.common ?? null,
        restoration: s.state?.restoration ?? s.restoration ?? null,
        worldId: s.state?.worldId ?? s.worldId ?? null
      };
    }

    // -- score bundle: heldChain / release --
    const bd = call(window.__voxBundleDiag, window);
    rec.bundle = !bd.available ? bd : {
      available: true,
      heldChain: bd.value?.heldChain ?? null,
      tonic: bd.value?.tonic ?? null,
      traceLength: Array.isArray(bd.value?.trace) ? bd.value.trace.length : null,
      lastTrace: Array.isArray(bd.value?.trace) && bd.value.trace.length
        ? bd.value.trace[bd.value.trace.length - 1] : null
    };

    // -- audio output route description (a STRING; not a context-state read) --
    const ad = call(window.__voxAudioDiag, window);
    rec.audioRoute = !ad.available ? ad
      : { available: true, describe: String(ad.value).slice(0, 400),
          note: 'describeGameAudioOutputRoutes() output. It is NOT AudioContext.state, mute, or volume.' };

    // -- document focus / visibility --
    try {
      rec.doc = { available: true, visibilityState: document.visibilityState, hidden: document.hidden,
                  hasFocus: document.hasFocus() };
    } catch (e) { rec.doc = unavailable('document-read-threw'); }

    // -- actor / world identity (read-only) --
    try {
      rec.identity = {
        available: true,
        playerPos: window.__autopilot?.pos ?? null,
        routeAction: window.__autopilot?.routeAction ?? null,
        workerPos: window.__auditWorker?.pos ?? null,
        storyBeatMirror: typeof window.__storyBeat === 'string' ? window.__storyBeat : null
      };
    } catch (e) { rec.identity = unavailable('identity-read-threw'); }

    return rec;
  };

  // ---- ring retention + termination (mirrors windowSampler.mjs pure core) --
  const push = (rec) => {
    buf.push(rec);
    if (state.edgeAtMs == null) {
      // THE SAME function object as the module's edgeReason(): its source is
      // injected verbatim below, so the in-page decision cannot drift from the
      // one the CPU checks exercise.
      const verdict = edgeReason(rec);
      rec.edgeVerdict = verdict;
      if (verdict.edge) { state.edgeAtMs = rec.tMs; state.edgeIndex = buf.length - 1; state.edgeReason = verdict.reason; }
      else { state.lastNonEdgeReason = verdict.reason; }
    }
    let cut = 0;
    if (state.edgeAtMs == null) { while (cut < buf.length && rec.tMs - buf[cut].tMs > cfg.preEdgeMs) cut += 1; }
    else { while (cut < buf.length && state.edgeAtMs - buf[cut].tMs > cfg.preEdgeMs) cut += 1; }
    let overflow = 0;
    if (buf.length - cut > cfg.maxSamples) { overflow = buf.length - cut - cfg.maxSamples; state.capHit = true; }
    const drop = cut + overflow;
    if (drop > 0) {
      buf.splice(0, drop);
      state.dropped += drop;
      if (state.edgeIndex != null) state.edgeIndex = Math.max(0, state.edgeIndex - drop);
    }
    if (state.edgeAtMs != null && rec.tMs - state.edgeAtMs >= cfg.postEdgeMs) { state.sealed = true; state.sealReason = 'window-complete'; }
    else if (rec.tMs - state.startedAtMs >= cfg.maxRunMs) {
      state.sealed = true;
      state.sealReason = state.edgeAtMs == null ? 'max-run-no-edge' : 'max-run-truncated-window';
    }
  };

  let handle = null;
  const tick = (rafTimeMs) => {
    if (state.sealed) return;
    try { push(sample(rafTimeMs)); state.frames += 1; }
    catch (e) { state.sampleErrors += 1; state.lastError = String(e && e.stack ? e.stack : e).slice(0, 300); }
    if (state.sealed) return;
    handle = cfg.driver === 'timer' ? setTimeout(() => tick(null), cfg.timerMs || 8) : requestAnimationFrame(tick);
  };

  window.__finaleWindowProbe = {
    installed: true,
    schema: ${JSON.stringify(SAMPLER_SCHEMA)},
    cfg,
    inventory,
    status: () => ({ sealed: state.sealed, sealReason: state.sealReason, edgeAtMs: state.edgeAtMs,
                     edgeIndex: state.edgeIndex, frames: state.frames, buffered: buf.length,
                     dropped: state.dropped, capHit: state.capHit, sampleErrors: state.sampleErrors,
                     lastError: state.lastError, nowMs: performance.now(), startedAtMs: state.startedAtMs,
                     latestBeat: buf.length ? (buf[buf.length - 1].story?.beat ?? null) : null,
                     latestFinalTextureSeconds: buf.length ? (buf[buf.length - 1].score?.finalTextureSeconds ?? null) : null }),
    // ONE synchronous atomic read on demand (used for before/after frame pairs).
    sampleNow: () => sample(null),
    drain: () => ({ schema: ${JSON.stringify(SAMPLER_SCHEMA)}, cfg, inventory, state: { ...state }, samples: buf }),
    teardown: () => { state.sealed = true; if (handle != null) { try { cancelAnimationFrame(handle); } catch (e) {} try { clearTimeout(handle); } catch (e) {} } try { delete window.__finaleWindowProbe; } catch (e) {} return true; }
  };
  handle = cfg.driver === 'timer' ? setTimeout(() => tick(null), cfg.timerMs || 8) : requestAnimationFrame(tick);
  return { installed: true, inventory, startedAtMs: state.startedAtMs, timeOriginMs: state.timeOriginMs };
}`;
}
