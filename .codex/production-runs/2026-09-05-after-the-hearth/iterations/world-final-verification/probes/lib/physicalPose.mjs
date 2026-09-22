/**
 * Physical-pose source selection and coordinate-frame bookkeeping.
 *
 * The interim report's VF-RAIL-2 turned on centre-vs-feet semantics, so this
 * harness now records WHICH pose it measured, at WHAT precision, in WHICH
 * frame — instead of silently integrating one rounded global.
 *
 * READ-ONLY SOURCE SURVEY (2026-09-06, verified against the dirty working tree;
 * the engineer is actively editing, so the next verifier must re-run
 * `--probe-shape` before trusting these):
 *
 *   main/src/story/JourneyRuntimeProbeBridge.tsx  buildSnapshot()
 *     -> schema 'paravoxia.journeyRuntimeSnapshot.v1'
 *     -> HAS NO PLAYER POSE FIELD AT ALL. It imports getPlayerWorldPosition
 *        but uses it only inside prepareScenario()'s gaze receipt.
 *     -> `entities` is a Record<string, JourneyEntityState>, NOT an array.
 *        (The previous probe did `Array.isArray(s.entities) ? ... : null`, so
 *        it silently recorded null for every entity, every sample.)
 *     -> entity positions are rounded to 1e-2 by journeyRuntime.roundedPosition.
 *
 *   main/src/story/autopilot/primitives.ts:2097  window.__autopilot
 *     -> pos = getPlayerWorldPosition() rounded to 1e-2. MOVIE LANE ONLY.
 *
 *   main/src/story/world/AuditWorker.tsx:143  window.__auditWorker
 *     -> pos rounded to 1e-1 (coarser than the entity record for the same actor).
 *
 *   main/src/state/playerFrame.ts getPlayerWorldPosition()
 *     -> the value EfficientPlayer publishes from `body.translation()`:
 *        the RAPIER CAPSULE CENTRE, not the feet and not the authored pose.
 *
 *   main/src/utils/cubeGravityConstants.ts
 *     -> PLAYER_CAPSULE_HALF_HEIGHT 1.3, PLAYER_CAPSULE_RADIUS 0.5.
 *        EfficientPlayer.tsx:1525 derives its own "feetWorld" as
 *        centre - up*HALF_HEIGHT (cylinder bottom); the SOLE is a further
 *        RADIUS below, centre - up*(HALF_HEIGHT + RADIUS).
 *
 * Consequence recorded honestly: FULL-PRECISION live player pose is NOT
 * currently obtainable. Everything below is a measurement at 1e-2 (or 1e-1)
 * quantisation, and every derived path length is a LOWER BOUND.
 */

export const CAPSULE = Object.freeze({
  halfHeight: 1.3,
  radius: 0.5,
  source: 'main/src/utils/cubeGravityConstants.ts (PLAYER_CAPSULE_HALF_HEIGHT / PLAYER_CAPSULE_RADIUS)'
});

/**
 * Candidate paths for a full-precision player pose inside the journey snapshot.
 * None of these exist today. They are probed defensively so that the moment the
 * engineer publishes one, the next verifier picks it up with no harness edit.
 */
export const SNAPSHOT_POSE_CANDIDATES = Object.freeze([
  'player.position',
  'player.pos',
  'state.player.position',
  'state.player.pose.position',
  'physical.player.position',
  'physical.player.capsuleCentre'
]);

const readPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const isVec3 = (v) => Array.isArray(v) && v.length >= 3
  && v.slice(0, 3).every((n) => typeof n === 'number' && Number.isFinite(n));

/** Quantisation actually observed in the numbers themselves (a cross-check on the claim). */
export function observedQuantum(vec) {
  if (!isVec3(vec)) return null;
  // coarsest first: the observed quantum is the LARGEST step every component fits
  for (const q of [1e-1, 1e-2, 1e-3]) {
    if (vec.slice(0, 3).every((n) => Math.abs(n / q - Math.round(n / q)) < 1e-6)) return q;
  }
  return null;
}

/**
 * Choose the best available player pose, PRIMARY = full-precision snapshot pose
 * if the bridge ever exposes one, SECONDARY = the rounded `__autopilot.pos`,
 * which is always retained alongside so the two can be reconciled.
 */
export function selectPlayerPose(sample) {
  const s = sample ?? {};
  const snapshot = s.journeySnapshot ?? null;

  // LEAD, when the ch13 read-only diagnostic is installed: it publishes the raw
  // Rapier capsule CENTRE, the GROUNDED body origin every ch13 predicate reads,
  // and the LIVE local up used for that conversion. It is the only source that
  // is full precision AND frame-explicit, and it exists in the manual lane too.
  const cg = s.cgDiagnostic?.available ? (s.cgDiagnostic.value ?? null) : null;
  const cgCentre = isVec3(cg?.bodyCentre) ? cg.bodyCentre.slice(0, 3) : null;
  const cgPose = isVec3(cg?.bodyPose) ? cg.bodyPose.slice(0, 3) : null;
  const cgUp = isVec3(cg?.up) ? cg.up.slice(0, 3) : null;
  const lead = cgCentre ? { pos: cgCentre, path: 'bodyCentre' } : null;

  let primary = null;
  for (const path of SNAPSHOT_POSE_CANDIDATES) {
    const v = readPath(snapshot, path);
    if (isVec3(v)) { primary = { pos: [v[0], v[1], v[2]], path }; break; }
  }
  const autoPos = s.autopilot?.pos ?? null;
  const secondary = isVec3(autoPos) ? { pos: [autoPos[0], autoPos[1], autoPos[2]] } : null;

  const chosen = lead ?? primary ?? secondary;
  const source = lead
    ? `cg-diagnostic:${s.cgDiagnostic.hookUsed ?? 'window.__paravoxiaCommonGround.snapshot()'}.bodyCentre`
    : (primary ? `journey-snapshot:${primary.path}` : (secondary ? 'window.__autopilot.pos' : null));
  return {
    pos: chosen ? [...chosen.pos] : null,
    source,
    sourceClass: lead
      ? 'cg-diagnostic-live-capsule-centre'
      : (primary ? 'journey-snapshot-live-pose' : (secondary ? 'rounded-autopilot-global' : 'unavailable')),
    declaredPrecisionUnits: (lead || primary) ? null : 0.01,
    observedQuantumUnits: observedQuantum(chosen?.pos ?? null),
    fullPrecisionAvailable: Boolean(lead || primary),
    // The chapter's OWN grounded frame, reported beside the centre so a claim is
    // never made in the wrong frame. Null unless the diagnostic published it.
    groundedBodyPose: cgPose ? [...cgPose] : null,
    liveUp: cgUp ? [...cgUp] : null,
    groundOffsetUnits: typeof cg?.groundOffsetUnits === 'number' ? cg.groundOffsetUnits : null,
    supported: cg?.supported ?? null,
    snapshotPoseCandidatesChecked: [...SNAPSHOT_POSE_CANDIDATES],
    secondaryRoundedAutopilotPos: secondary ? [...secondary.pos] : null,
    secondarySnapshotPose: primary ? [...primary.pos] : null,
    frame: 'rapier-capsule-CENTRE (body.translation()), NOT feet and NOT the authored pose',
    groundedFrame: cgPose
      ? 'bodyPose = centre - up*(HALF_HEIGHT 1.3 + RADIUS 0.5); this IS the frame CG_POSES/routes/sockets are authored in'
      : null,
    laneLimit: (lead || primary)
      ? null
      : '__autopilot is published by the movie autopilot only; in a manual lane this pose can be absent entirely'
  };
}

/**
 * Derive the two feet semantics from a capsule centre.
 * `up` defaults to +Y: the live local planet up is NOT exposed to any probe
 * global, so on a non-top cube face these derivations are wrong and are
 * flagged rather than silently used.
 */
export function deriveFootFrames(centre, up = [0, 1, 0]) {
  if (!isVec3(centre)) return null;
  const u = isVec3(up) ? up : [0, 1, 0];
  const mag = Math.hypot(u[0], u[1], u[2]) || 1;
  const n = [u[0] / mag, u[1] / mag, u[2] / mag];
  const off = (d) => [centre[0] - n[0] * d, centre[1] - n[1] * d, centre[2] - n[2] * d];
  return {
    capsuleCentre: [...centre].slice(0, 3),
    cylinderBottom: off(CAPSULE.halfHeight),
    sole: off(CAPSULE.halfHeight + CAPSULE.radius),
    upUsed: n,
    upAssumed: !isVec3(up) || (up[0] === 0 && up[1] === 1 && up[2] === 0),
    upSourceLimit: 'Live getPlayerUp() is not exposed to any probe global. +Y is ASSUMED; on any non-top cube face these foot frames are invalid and must not be compared against authored poses.',
    reference: 'EfficientPlayer.tsx:1525 uses centre - up*HALF_HEIGHT as feetWorld; the sole is a further RADIUS below.'
  };
}

/**
 * Normalise the journey snapshot `entities` Record (or a legacy array) into an
 * array. Fixes the previous probe's Array.isArray() assumption.
 */
export function normalizeEntities(entities) {
  if (Array.isArray(entities)) return entities.map(mapEntity);
  if (entities && typeof entities === 'object') return Object.values(entities).map(mapEntity);
  return null;
}
const mapEntity = (e) => ({
  id: e?.id ?? null,
  mounted: e?.mounted ?? null,
  visible: e?.visible ?? null,
  phase: e?.phase ?? null,
  source: e?.source ?? null,
  revision: e?.revision ?? null,
  pos: isVec3(e?.position) ? [e.position[0], e.position[1], e.position[2]] : (isVec3(e?.pos) ? [e.pos[0], e.pos[1], e.pos[2]] : null)
});

/**
 * Choose the worker pose. The `actor:w7744` journey entity is quantised to 1e-2;
 * `window.__auditWorker.pos` is only 1e-1, so it is the fallback, not the lead.
 */
export function selectWorkerPose(sample) {
  const ents = normalizeEntities(sample?.journeySnapshot?.entities ?? sample?.entities ?? null);
  const actor = ents?.find((e) => e.id === 'actor:w7744' && isVec3(e.pos)) ?? null;
  const aw = sample?.auditWorker?.pos ?? null;
  // LEAD: the ch13 diagnostic publishes the chapter's own actor position at full
  // precision, together with the leg it is actually walking.
  const cg = sample?.cgDiagnostic?.available ? (sample.cgDiagnostic.value ?? null) : null;
  const w = cg?.diagnostic?.worker ?? null;
  const wp = w && typeof w.position?.x === 'number'
    ? [w.position.x, w.position.y, w.position.z] : null;
  if (isVec3(wp)) {
    return {
      pos: [...wp],
      source: 'cg-diagnostic:diagnostic.worker.position',
      sourceClass: 'cg-diagnostic-live-actor-pose',
      declaredPrecisionUnits: null,
      observedQuantumUnits: observedQuantum(wp),
      phase: w.leg ?? null,
      mounted: actor?.mounted ?? null,
      visible: actor?.visible ?? null,
      leg: w.leg ?? null,
      travelled: typeof w.travelled === 'number' ? w.travelled : null,
      legLength: typeof w.legLength === 'number' ? w.legLength : null,
      held: w.held ?? null,
      sampledIndex: typeof w.sampledIndex === 'number' ? w.sampledIndex : null,
      permitted: w.permitted ?? null,
      fallbackEntityPos: actor ? [...actor.pos] : null,
      fallbackAuditWorkerPos: isVec3(aw) ? [aw[0], aw[1], aw[2]] : null,
      frame: 'authored worker pose (grounded body origin), NOT a physics capsule centre'
    };
  }
  if (actor) {
    return {
      pos: [...actor.pos], source: 'journey-snapshot:entities[actor:w7744].position',
      sourceClass: 'journey-entity-record', declaredPrecisionUnits: 0.01,
      observedQuantumUnits: observedQuantum(actor.pos),
      phase: actor.phase ?? null, mounted: actor.mounted ?? null, visible: actor.visible ?? null,
      fallbackAuditWorkerPos: isVec3(aw) ? [aw[0], aw[1], aw[2]] : null,
      frame: 'authored worker pose.position (render group origin), NOT a physics capsule centre'
    };
  }
  if (isVec3(aw)) {
    return {
      pos: [aw[0], aw[1], aw[2]], source: 'window.__auditWorker.pos',
      sourceClass: 'rounded-actor-global', declaredPrecisionUnits: 0.1,
      observedQuantumUnits: observedQuantum(aw), phase: null, mounted: null, visible: null,
      fallbackAuditWorkerPos: null,
      frame: 'authored worker pose.position (render group origin), NOT a physics capsule centre'
    };
  }
  return { pos: null, source: null, sourceClass: 'unavailable', declaredPrecisionUnits: null, observedQuantumUnits: null, phase: null, mounted: null, visible: null, fallbackAuditWorkerPos: null, frame: null };
}

// ---------------------------------------------------------------------------
// CommonGround diagnostics: FEATURE-DETECTED, never assumed, never mutated.
// ---------------------------------------------------------------------------

/**
 * Candidate read-only hook names for getCommonGroundDiagnostic() /
 * getCommonGroundScoreDiagnostic().
 *
 * As of 2026-09-06 a repo-wide grep of main/src and main/tools finds these two
 * functions ONLY at their definitions (commonGroundDirector.ts:1633,
 * commonGroundScore.ts:280). NOTHING assigns them to any window global. Root
 * asked the integration engineer to add a query-gated read-only surface; the
 * exact name is NOT yet decided, so every candidate below is probed and the
 * result recorded as unavailable when none answers.
 *
 * The harness NEVER calls a name that is not in this allow-list, so it cannot
 * accidentally invoke a mutating route planner or a progress grant.
 */
export const CG_DIAGNOSTIC_HOOKS = Object.freeze([
  // SHIPPED NAME, verified live against the 40131 preview on 2026-09-06 (see
  // verifier/logs/world-final/hook-recheck.log). StoryDirectorDriver.tsx:137
  // installs `window.__paravoxiaCommonGround = { snapshot }` under
  // ?journeyprobe=1 / ?chapterjourney=1 / ?debug=1. The list below was written
  // while the name was still undecided and probed only `.diagnostic()` and
  // `.scoreDiagnostic()`, which the build does NOT define — so the harness
  // reported "no hook exposed" for a hook that was answering all along. That
  // was a SAMPLER MISMATCH in this harness, never a missing game surface.
  // The returned value is the FULL probe snapshot (bodyCentre/bodyPose/up/
  // supported/worldBound/rail/railCursor/score/diagnostic/pendingAnchors),
  // which is exactly the shape selectPlayerPose already expects.
  { global: '__paravoxiaCommonGround', member: 'snapshot', kind: 'namespace-method' },
  { global: '__paravoxiaJourneyProbe', member: 'getCommonGroundDiagnostic', kind: 'bridge-method' },
  { global: '__paravoxiaJourneyProbe', member: 'commonGroundDiagnostic', kind: 'bridge-method' },
  { global: '__paravoxiaCommonGroundDiagnostic', member: null, kind: 'global-function' },
  { global: '__voxCommonGroundDiagnostic', member: null, kind: 'global-function' },
  { global: '__paravoxiaCommonGround', member: 'diagnostic', kind: 'namespace-method' }
]);

export const CG_SCORE_DIAGNOSTIC_HOOKS = Object.freeze([
  { global: '__paravoxiaJourneyProbe', member: 'getCommonGroundScoreDiagnostic', kind: 'bridge-method' },
  { global: '__paravoxiaJourneyProbe', member: 'commonGroundScoreDiagnostic', kind: 'bridge-method' },
  { global: '__paravoxiaCommonGroundScoreDiagnostic', member: null, kind: 'global-function' },
  { global: '__voxCommonGroundScoreDiagnostic', member: null, kind: 'global-function' },
  { global: '__paravoxiaCommonGround', member: 'scoreDiagnostic', kind: 'namespace-method' }
]);

/**
 * Fields inside a CommonGround diagnostic that represent PHYSICAL/route
 * progress. Used by the stall predicate; each is read-only.
 */
export const CG_PROGRESS_FIELDS = Object.freeze([
  'survey.phase', 'survey.approached', 'survey.samples', 'survey.lengthUnits',
  'survey.walkedUnits', 'survey.testedPrefix', 'survey.tailRevision',
  'survey.acceptedSamples', 'survey.acceptedClass',
  'common.stage', 'common.terraUnits', 'common.comparisonProved',
  'common.finalReferenceOffered', 'common.finalReferenceOccupied',
  'holdReason', 'installWatch', 'worker.phase', 'worker.stage'
]);

/**
 * Stable signature of whatever progress fields the diagnostic actually exposed.
 *
 * Accepts BOTH shapes, because the shipped hook returns the full probe snapshot
 * and the CG diagnostic sits one level down under `.diagnostic`:
 *   - a bare diagnostic  -> `survey.phase`
 *   - a probe snapshot   -> `diagnostic.survey.phase`
 * Reading the wrong level silently produced a null signature, which the stall
 * predicate would have read as "no progress fields exist" rather than "no
 * progress". Both levels are tried and the level actually used is recorded.
 */
export function progressSignature(diag) {
  if (!diag || typeof diag !== 'object') return null;
  const nested = diag.diagnostic && typeof diag.diagnostic === 'object' ? diag.diagnostic : null;
  const out = {};
  let seen = 0;
  let level = null;
  for (const path of CG_PROGRESS_FIELDS) {
    let v = readPath(diag, path);
    let from = 'root';
    if (v === undefined && nested) { v = readPath(nested, path); from = 'diagnostic'; }
    if (v !== undefined) { out[path] = v; seen += 1; level = level ?? from; }
  }
  if (seen === 0) return null;
  out['@level'] = level;
  return JSON.stringify(out);
}

/**
 * The CG score state, taken from the probe snapshot's own `score` member when
 * no standalone score hook answers. The shipped build exposes score ONLY inside
 * `snapshot()`, so without this the score was reported unavailable while it was
 * in fact present in a value the harness had already fetched.
 */
export function scoreFromSnapshot(cgDiagnostic) {
  const v = cgDiagnostic?.available ? cgDiagnostic.value : null;
  if (!v || typeof v !== 'object' || !v.score || typeof v.score !== 'object') return null;
  return {
    available: true,
    value: v.score,
    hookUsed: `${cgDiagnostic.hookUsed ?? 'window.__paravoxiaCommonGround.snapshot()'}.score`,
    derivedFromSnapshot: true,
    note: 'Read from the score member of the CommonGround probe snapshot, not from a separate score hook. It is runtime score STATE (beat/mood/finalTextureSeconds) and is NOT an audibility or hearing claim.'
  };
}

/** Explicit "we looked and it was not there" record. Never an implied pass. */
export function unavailableDiagnostic(checked, why) {
  return {
    available: false,
    value: null,
    hookUsed: null,
    hooksChecked: checked.map((h) => (h.member ? `window.${h.global}.${h.member}()` : `window.${h.global}()`)),
    reason: why,
    consequence: 'CommonGround phase / cursor / hold / foot-frame state was NOT observed. Any conclusion needing it is UNMEASURED, not passed.'
  };
}

/** Path metrics are measurements, never runtime proof. Applied to every tracker summary. */
export const PATH_METRIC_SEMANTICS = Object.freeze({
  metricClass: 'measurement-lower-bound',
  isRuntimeProof: false,
  why: [
    'Integrated from discrete probe samples: any motion between two samples is chorded, so the true path is >= the reported value.',
    'Source poses are quantised (1e-2 for the player capsule centre, 1e-2 or 1e-1 for the worker), so small real motion can be rounded away entirely.',
    'The player figure is a CAPSULE CENTRE. It is not the feet, not the authored pose and not whatever frame the chapter route predicates compare against.',
    'Walked distance is NOT credited progress. It can neither confirm nor substitute for the chapter\'s ordered-ground / reference / support / arrival proof.'
  ]
});
