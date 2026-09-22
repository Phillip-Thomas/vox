/**
 * Per-frame capture provenance for this run's verification probes.
 *
 * WHY THIS EXISTS
 * ---------------
 * The pre-repair `home-movie-2` capture recorded ONE shared gameplay state on a
 * raw frame and its HUD-suppressed partner even though the two screenshots were
 * taken up to ~1 s apart while gameplay advanced. Root flagged that in
 * `verifier-inbox.md` ("do not treat pairs as simultaneous or as exact
 * before/at/after anchor evidence").
 *
 * This module makes that failure structurally impossible: every frame carries
 * its OWN pre-shot and post-shot observation, its own capture WINDOW, and an
 * explicit crossing list when the run advanced while the shutter was open. It
 * never synthesises an exact anchor instant it did not observe.
 *
 * It is pure (no browser, no fs, no clock of its own) so the offline self-test
 * exercises the real classifier rather than mirrored strings.
 */

/** Gameplay fields whose change during a capture window destroys "at-state" provenance. */
export const PROVENANCE_FIELDS = Object.freeze([
  'beat',
  'objectiveId',
  'markerLabel',
  'workOrderSig',
  'anchorId',
  'activationSequence',
  'milestoneSig'
]);

const eq = (a, b) => (a === b) || (a == null && b == null);

/**
 * Normalise a probe sample into the minimal provenance observation.
 * `atMs` is the wall clock of THAT observation, never of a sibling frame.
 */
export function observation(sample, atMs) {
  const s = sample ?? {};
  return {
    atMs,
    beat: s.beat ?? null,
    objectiveId: s.objectiveId ?? null,
    markerLabel: s.markerLabel ?? null,
    workOrderSig: s.workOrder == null ? null : JSON.stringify(s.workOrder),
    anchorId: s.anchorId ?? null,
    activationSequence: s.activationSequence ?? null,
    milestoneSig: s.milestoneSig ?? (s.milestones == null ? null : JSON.stringify(s.milestones)),
    playerPos: Array.isArray(s.playerPos) ? [...s.playerPos] : null,
    workerPos: Array.isArray(s.workerPos) ? [...s.workerPos] : null
  };
}

/**
 * Compare the pre-shot and post-shot observations of ONE frame.
 *
 * Returns a window, not an instant. If any provenance field differs, the frame
 * is `stateStableAcrossCapture:false` and `atStateClaimable:false`: the frame's
 * true gameplay state is only known to lie somewhere inside
 * [preAtMs, postAtMs]. We deliberately do NOT pick a side.
 */
export function classifyCaptureProvenance(pre, post) {
  const crossings = [];
  for (const field of PROVENANCE_FIELDS) {
    if (!eq(pre?.[field], post?.[field])) {
      crossings.push({ field, before: pre?.[field] ?? null, after: post?.[field] ?? null });
    }
  }
  const startMs = pre?.atMs ?? null;
  const endMs = post?.atMs ?? null;
  const durationMs = (startMs != null && endMs != null) ? endMs - startMs : null;
  const stable = crossings.length === 0;
  return {
    window: { startMs, endMs, durationMs },
    pre: pre ?? null,
    post: post ?? null,
    crossings,
    stateStableAcrossCapture: stable,
    /**
     * TRUE only when nothing tracked changed while the shutter was open. When
     * false the caller must describe the frame as "inside window X" and must
     * not attribute it to either endpoint's state.
     */
    atStateClaimable: stable,
    stateAttribution: stable
      ? 'state-held-across-capture-window'
      : 'state-crossed-during-capture-window (frame lies inside the window; no exact anchor instant is claimed)'
  };
}

/**
 * Relate a HUD-suppressed perceptual frame to its raw partner.
 * Pairs are ALWAYS recorded as non-simultaneous with their real offset; the
 * intentional HUD hiding is preserved and labelled, never undone or faked.
 */
export function pairProvenance(rawFrame, perceptFrame) {
  const rawMid = midpoint(rawFrame?.provenance?.window);
  const perceptMid = midpoint(perceptFrame?.provenance?.window);
  const offsetMs = (rawMid != null && perceptMid != null) ? Math.round(perceptMid - rawMid) : null;
  const spanCrossings = [];
  if (rawFrame?.provenance?.post && perceptFrame?.provenance?.pre) {
    for (const field of PROVENANCE_FIELDS) {
      if (!eq(rawFrame.provenance.post[field], perceptFrame.provenance.pre[field])) {
        spanCrossings.push({
          field,
          before: rawFrame.provenance.post[field] ?? null,
          after: perceptFrame.provenance.pre[field] ?? null
        });
      }
    }
  }
  return {
    simultaneous: false,
    reason: 'raw and HUD-suppressed frames are two sequential screenshots; the run advances between them',
    pairOffsetMs: offsetMs,
    stateHeldBetweenPartners: spanCrossings.length === 0 && rawFrame != null && perceptFrame != null,
    betweenPartnerCrossings: spanCrossings
  };
}

function midpoint(w) {
  if (!w || w.startMs == null || w.endMs == null) return null;
  return (w.startMs + w.endMs) / 2;
}

/**
 * Boot / black-frame classification.
 *
 * A near-black frame is recorded as PROGRESSION EVIDENCE ONLY. This function
 * never returns a pass: `visualAcceptance` is hard-false for every frame,
 * because this harness makes no visual-taste or visible-content claim at all.
 */
export function classifyLuma(stats) {
  // evidence.mjs frameStats(): meanLuma/maxLuma are 0..1, nearBlack is the
  // fraction of pixels under L<0.02, blank is its own contrast verdict.
  if (!stats) return { nearBlackFraction: null, blankByStats: null, bootBlackFrameCandidate: null, visualAcceptance: false, note: NEAR_BLACK_NOTE };
  const nearBlackFraction = Number(stats.nearBlack);
  const maxLuma = Number(stats.maxLuma);
  const blankByStats = stats.blank === true;
  const candidate = blankByStats
    || (Number.isFinite(nearBlackFraction) && nearBlackFraction >= 0.99)
    || (Number.isFinite(maxLuma) && maxLuma < 0.02);
  return {
    nearBlackFraction: Number.isFinite(nearBlackFraction) ? nearBlackFraction : null,
    maxLuma: Number.isFinite(maxLuma) ? maxLuma : null,
    blankByStats,
    bootBlackFrameCandidate: candidate,
    visualAcceptance: false,
    note: NEAR_BLACK_NOTE
  };
}

const NEAR_BLACK_NOTE = 'A near-black/blank frame is boot or progression evidence ONLY and is never visual acceptance. This harness asserts nothing about visual content, taste, or a "restored core" being identifiable.';

/** Role vocabulary — raw vs perceptual is a ROLE, not a quality ranking. */
export const FRAME_ROLES = Object.freeze({
  raw: {
    kind: 'raw-hud-inclusive',
    hudSuppressed: false,
    evidenceClass: 'ux/guidance-inclusive',
    note: 'Original pixels as the player sees them, HUD included.'
  },
  percept: {
    kind: 'perceptual-hud-suppressed',
    hudSuppressed: true,
    evidenceClass: 'perceptual/scene-only',
    note: 'HUD deliberately hidden by the shipped evidence helper (vox-hide-ui stylesheet). The hiding is intentional and is restored immediately afterwards; original pixels are otherwise untouched and never re-encoded.'
  }
});
