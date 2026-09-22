/**
 * EARNED-CONTINUE OWNED LOGIC — run-local to 2026-09-05-after-the-hearth.
 *
 * Pure decision helpers for the earned ch13 return -> Origin -> partial survey
 * -> shipped save -> real landing-menu Continue -> NEW physical action lane.
 * Nothing here touches a browser, a GPU, a game source file or a shared lock;
 * every function is a decision over values the probe MEASURED.
 *
 * OWNERSHIP: this file belongs to the earned-continue role. The lock/preflight/
 * served-identity primitives are NOT re-implemented here — they are imported
 * from `pinned/commonPassageLogic.pinned.mjs`, a byte-exact pin of the manual
 * COMMON role's helper taken at pin time (see pinned/pin.json). The manual role
 * may keep editing its own live file; this lane is bound to the pinned bytes.
 *
 * WHAT THESE HELPERS REFUSE TO CALL PROOF
 * ---------------------------------------
 *   - a file-vs-file byte comparison of two saves (that is preservation of
 *     bytes, not a restored runtime);
 *   - a RAW COUNT of signedSceneAv object keys (`Object.keys(av).length`), which
 *     is what the flight lane recorded and which names nothing;
 *   - a predicted/expected anchor list, a stale static id->beat mapping, or a
 *     menu label read on its own;
 *   - a story deep link on the Continue boot (that would re-seed the very state
 *     under test).
 */
import { createHash } from 'node:crypto';
import { readFileSync as nodeReadFileSync } from 'node:fs';

export const EARNED_CONTINUE_LOGIC_SCHEMA = 'paravoxia.verifier.earnedContinueLogic.v1';

export const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

// --- source-manifest re-hash (dynamic, actual file bytes) --------------------
/**
 * Re-hash the manifest FILE and every path it lists, from the real bytes on
 * disk. `expectManifestSha` is the root-published manifest sha256; a mismatch is
 * reported, never repaired. Injectable IO so the self-test needs no fixtures on
 * the real tree.
 */
export function rehashSourceManifest({
  manifestPath = null, repoRoot = null, expectManifestSha = null, label = 'rehash',
  readFile = (p) => nodeReadFileSync(p), joinPath = (a, b) => `${a}/${b}`
} = {}) {
  const out = {
    label, manifestPath, expectManifestSha, manifestSha256: null,
    filesChecked: 0, mismatches: [], unreadable: [], intact: false, manifestMatchesExpected: false
  };
  let raw = null;
  try { raw = readFile(manifestPath); }
  catch (e) { out.unreadable.push({ path: manifestPath, error: String(e).slice(0, 160) }); return out; }
  out.manifestSha256 = sha256Hex(raw);
  out.manifestMatchesExpected = !expectManifestSha ? false : out.manifestSha256 === expectManifestSha;
  let hashes = null;
  try { hashes = JSON.parse(String(raw)).hashes ?? null; }
  catch (e) { out.unreadable.push({ path: manifestPath, error: `unparseable: ${String(e).slice(0, 120)}` }); return out; }
  if (!hashes || typeof hashes !== 'object') {
    out.unreadable.push({ path: manifestPath, error: 'manifest has no "hashes" map' });
    return out;
  }
  for (const [rel, expected] of Object.entries(hashes)) {
    let bytes = null;
    try { bytes = readFile(joinPath(repoRoot, rel)); }
    catch (e) { out.unreadable.push({ path: rel, error: String(e).slice(0, 120) }); continue; }
    out.filesChecked++;
    const actual = sha256Hex(bytes);
    if (actual !== expected) out.mismatches.push({ path: rel, expected, actual });
  }
  out.intact = out.mismatches.length === 0 && out.unreadable.length === 0 && out.filesChecked > 0;
  return out;
}

// --- capture-directory refusal ----------------------------------------------
/** A capture folder that already holds evidence is never written into again. */
export function captureDirDecision({ path = null, exists = false, entries = [] } = {}) {
  const problems = [];
  if (!path) problems.push('--out resolved to no capture path');
  if (exists && entries.length > 0) {
    problems.push(`NONEMPTY-CAPTURE-DIR ${path} holds ${entries.length} entr(ies): refusing to overwrite prior evidence`);
  }
  return { ok: problems.length === 0, problems, path, existingEntries: entries.length };
}

// --- live AV anchor reading (nested, named, over time) -----------------------
/**
 * The ONLY accepted reading of the signed-AV bridge.
 *
 * `state.signedSceneAv` (published by JourneyRuntimeProbeBridge) is an OBJECT
 * with named fields; the flight lane recorded `Object.keys(av).length` (a
 * constant 7 in this build) which measures the bridge's own shape, not the
 * story. This returns the named anchor id, the named history, and the
 * activation SEQUENCE number so a caller can order snapshots in time.
 */
export function avReading(av) {
  if (!av || typeof av !== 'object') {
    return { available: false, why: 'state.signedSceneAv is absent', anchorId: null, anchorEvent: null,
      beat: null, active: null, suspended: null, activationSequence: null, history: [], historyCount: 0,
      rawKeyCountIsNotEvidence: null };
  }
  const history = Array.isArray(av.activationHistoryAnchorIds) ? [...av.activationHistoryAnchorIds] : [];
  return {
    available: true,
    beat: av.beat ?? null,
    active: av.active ?? null,
    suspended: av.suspended ?? null,
    anchorId: av.anchorId ?? null,
    anchorEvent: av.anchorEvent ?? null,
    activationSequence: av.activationSequence ?? null,
    history,
    historyCount: history.length,
    rawKeyCountIsNotEvidence: Object.keys(av).length
  };
}

/** Ordered, named difference between two AV readings taken at different times. */
export function avAnchorDelta(before, after) {
  const b = avReading(before?.available === undefined ? before : before);
  const a = avReading(after?.available === undefined ? after : after);
  const bSet = new Set(b.history);
  const added = a.history.filter((id) => !bSet.has(id));
  const aSet = new Set(a.history);
  const dropped = b.history.filter((id) => !aSet.has(id));
  // A REPLAY is an id that was already earned before the save re-appearing as a
  // fresh activation after the restore.
  return {
    addedAnchorIds: added, droppedAnchorIds: dropped,
    sequenceBefore: b.activationSequence, sequenceAfter: a.activationSequence,
    sequenceAdvanced: typeof b.activationSequence === 'number' && typeof a.activationSequence === 'number'
      ? a.activationSequence > b.activationSequence : null,
    beatBefore: b.beat, beatAfter: a.beat,
    activeAfter: a.active, anchorIdAfter: a.anchorId, anchorEventAfter: a.anchorEvent
  };
}

/**
 * Replay verdict for a RESTORE: the restored runtime must not re-activate an
 * anchor that was already earned before the save, and must not re-fire the
 * install/arrival cue. Ids are compared by NAME; no predicted list is used.
 */
export function replayVerdict({
  earnedHistory = [], restoredHistory = [], restoredPendingAnchors = [],
  installWatchBefore = null, installWatchAfter = null, cueAnchorPattern = /(install|arriv|landed|hatch|lift)/i
} = {}) {
  const earned = new Set(earnedHistory);
  const replayed = restoredHistory.filter((id) => earned.has(id));
  const cueReplayed = replayed.filter((id) => cueAnchorPattern.test(String(id)));
  const pendingReplay = (restoredPendingAnchors ?? []).filter((id) => earned.has(id));
  const installReplayed = installWatchBefore != null && installWatchAfter != null
    ? JSON.stringify(installWatchAfter) !== JSON.stringify(installWatchBefore)
    : null;
  return {
    replayedAnchorIds: replayed,
    replayedCueAnchorIds: cueReplayed,
    replayedPendingAnchorIds: pendingReplay,
    installWatchChanged: installReplayed,
    noReplay: replayed.length === 0 && pendingReplay.length === 0,
    note: 'Names, not counts. An empty restored history proves no replay ONLY when the restore actually resumed; it is not by itself continuation proof.'
  };
}

// --- earned Origin entry gate ------------------------------------------------
/**
 * PREREQUISITE F GATE. Everything downstream (drawing, save, Continue, new
 * action) is refused unless the return flight ACTUALLY landed: the shipped
 * milestone latched, the live active planet is the Origin body the flight moved
 * to (measured, not a stale static id mapping), the body is grounded and on foot
 * controls, the renderer is really producing frames, and the signed-AV bridge
 * shows NAMED anchors rather than a key count.
 */
export function earnedOriginGate({
  originLandedMilestone = false,
  bootActivePlanetId = null, landedActivePlanetId = null,
  locationMode = null, controlMode = null,
  supported = null, bodyPose = null,
  fps = null, minFps = 15,
  av = null, requireNamedAnchors = true,
  anchors = null
} = {}) {
  const problems = [];
  if (originLandedMilestone !== true) problems.push('story:ch13-origin-landed never latched: the return flight did not physically land');
  if (!landedActivePlanetId) problems.push('no live activePlanetId was read at the landing: the active origin is UNMEASURED');
  else if (bootActivePlanetId && landedActivePlanetId === bootActivePlanetId) {
    problems.push(`activePlanetId is still the departure body ${bootActivePlanetId}: no world handoff was measured`);
  }
  if (locationMode !== 'surface') problems.push(`systemFlight.locationMode=${JSON.stringify(locationMode)} is not "surface"`);
  if (controlMode !== 'fps') problems.push(`spaceFlight.controlMode=${JSON.stringify(controlMode)} is not on-foot "fps"`);
  if (supported !== true) problems.push(`the mounted world does not support the body at its grounded pose (supported=${JSON.stringify(supported)})`);
  if (!Array.isArray(bodyPose) || bodyPose.length !== 3 || bodyPose.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    problems.push('no finite grounded bodyPose was read');
  }
  if (typeof fps !== 'number' || !Number.isFinite(fps)) problems.push('no live frame rate was measured');
  else if (fps < minFps) problems.push(`live frame rate ${fps} < ${minFps}: the session is not really rendering`);
  const avr = avReading(av);
  if (requireNamedAnchors) {
    if (!avr.available) problems.push('state.signedSceneAv is unavailable: named AV anchor history is UNMEASURED');
    else if (avr.historyCount === 0) problems.push('signedSceneAv.activationHistoryAnchorIds is empty: no NAMED anchor has been activated (a key count is not evidence)');
  }
  if (anchors != null && !Array.isArray(anchors)) problems.push('commonGround diagnostic.anchors is not an array: wrong (flat) read path');
  return {
    ok: problems.length === 0, problems,
    measured: {
      originLandedMilestone, bootActivePlanetId, landedActivePlanetId, locationMode, controlMode,
      supported, bodyPose, fps, namedAnchorHistory: avr.history, firedAnchors: Array.isArray(anchors) ? [...anchors] : null
    }
  };
}

// --- checkpoint purity -------------------------------------------------------
/**
 * The checkpoint under test is a PARTIAL drawing. If the movie rail has already
 * carried the survey past the offer/route-test, the save is no longer partial
 * and the capture must be caught (stopped) rather than reported.
 */
export function checkpointPurity({
  surveyPhase = null, samples = 0, minSamples = 4, milestones = [], firedAnchors = []
} = {}) {
  const ms = milestones ?? []; const anc = firedAnchors ?? [];
  const impure = [];
  if (ms.includes('story:ch13-route-tested')) impure.push('story:ch13-route-tested is already latched');
  if (anc.includes('anc.cg.route-offered')) impure.push('anc.cg.route-offered has already fired');
  if (anc.includes('anc.cg.route-tested')) impure.push('anc.cg.route-tested has already fired');
  const reached = surveyPhase === 'drawing' && (samples ?? 0) >= minSamples;
  return {
    reached, pure: impure.length === 0, impure,
    catchNow: reached || impure.length > 0,
    why: impure.length > 0
      ? 'the movie rail ran past the partial checkpoint — catch and refuse rather than call this a partial save'
      : (reached ? 'partial checkpoint reached: stop the rail now by saving' : 'not yet at the partial checkpoint')
  };
}

// --- world / actor identity across the save boundary -------------------------
/** `pvx.v1.world.-1,-1:p1` -> { prefix: 'pvx.v1.world.', worldId: '-1,-1:p1' } */
export function parseWorldKey(key) {
  const m = /^(.*\.world\.)([^.]+)$/.exec(String(key ?? ''));
  return m ? { prefix: m[1], worldId: m[2], key } : { prefix: null, worldId: null, key };
}

/**
 * Same world, same actor, same key prefix — measured on the ACTUAL saved bytes
 * and the ACTUAL live runtime after Continue, never on two files alone.
 */
export function worldIdentityVerdict({
  savedKey = null, savedWorldId = null, savedSeed = null,
  liveActivePlanetIdAtSave = null, liveActivePlanetIdAfterContinue = null,
  restoredKey = null, restoredWorldId = null, restoredSeed = null,
  earnedMilestones = [], restoredMilestones = []
} = {}) {
  const s = parseWorldKey(savedKey); const r = parseWorldKey(restoredKey);
  const problems = [];
  if (!savedKey || !restoredKey) problems.push('a world storage key is missing on one side of the boundary');
  if (s.prefix && r.prefix && s.prefix !== r.prefix) problems.push(`storage key prefix changed: ${s.prefix} -> ${r.prefix}`);
  if (s.worldId && r.worldId && s.worldId !== r.worldId) problems.push(`world id changed across Continue: ${s.worldId} -> ${r.worldId}`);
  if (savedWorldId && restoredWorldId && savedWorldId !== restoredWorldId) problems.push(`WorldSave.worldId changed: ${savedWorldId} -> ${restoredWorldId}`);
  if (savedSeed != null && restoredSeed != null && savedSeed !== restoredSeed) problems.push(`world seed changed: ${savedSeed} -> ${restoredSeed}`);
  if (liveActivePlanetIdAtSave && liveActivePlanetIdAfterContinue
    && liveActivePlanetIdAtSave !== liveActivePlanetIdAfterContinue) {
    problems.push(`live activePlanetId changed across Continue: ${liveActivePlanetIdAtSave} -> ${liveActivePlanetIdAfterContinue} (the resume landed on a different body)`);
  }
  const lost = (earnedMilestones ?? []).filter((m) => !(restoredMilestones ?? []).includes(m));
  if (lost.length) problems.push(`actor milestones lost across Continue: ${lost.join(', ')}`);
  return {
    ok: problems.length === 0, problems,
    savedKeyParts: s, restoredKeyParts: r, lostMilestones: lost,
    note: 'Identity is asserted from live runtime fields AND stored bytes together; matching files alone would not show which world resumed.'
  };
}

/** The earned bytes must still be on disk after the restore, unoverwritten. */
export function overwriteVerdict({ savedSamples = 0, samplesOnDiskAfterContinue = null, savedSha256 = null, shaAfterContinue = null } = {}) {
  const problems = [];
  if ((savedSamples ?? 0) <= 0) problems.push('the pre-Continue save carried no samples: there was nothing to preserve');
  if (samplesOnDiskAfterContinue === null) problems.push('no post-Continue stored sample count was read');
  else if (samplesOnDiskAfterContinue < (savedSamples ?? 0)) {
    problems.push(`stored samples fell from ${savedSamples} to ${samplesOnDiskAfterContinue}: live empty state was written over the earned bytes`);
  }
  return {
    ok: problems.length === 0, problems,
    savedSamples, samplesOnDiskAfterContinue,
    bytesChanged: savedSha256 && shaAfterContinue ? savedSha256 !== shaAfterContinue : null,
    note: 'A changed sha is not by itself a failure (a legitimate resume rewrites the blob); losing earned samples is.'
  };
}

// --- new-action eligibility --------------------------------------------------
/**
 * The NEW action may only be attempted on a genuinely restored, live survey. No
 * forced click, no dispatched event, no direct verb call: [F] is pressed only
 * when the shipped prompt is literally offering it.
 */
export function newActionGate({
  beat = null, surveyPhase = null, restoredSamples = 0, prompts = null, promptOffersF = false, arrived = false
} = {}) {
  const problems = [];
  if (beat !== 'ch13-survey') problems.push(`beat=${JSON.stringify(beat)} is not ch13-survey: the survey verbs are not live`);
  if (surveyPhase !== 'drawing') problems.push(`survey.phase=${JSON.stringify(surveyPhase)} is not "drawing": nothing was restored to continue`);
  if ((restoredSamples ?? 0) <= 0) problems.push('the restored survey carries no samples');
  if (!arrived) problems.push('the body never actually arrived at the span end by ordinary movement');
  if (!promptOffersF) problems.push(`the shipped primary prompt is not offering [F] (prompts=${JSON.stringify(prompts)})`);
  return { ok: problems.length === 0, problems };
}

/** Acceptance of the new action is read from NAMED anchors and survey state. */
export function newAnchorEligibility({
  anchorsBefore = [], anchorsAfter = [], avBefore = null, avAfter = null,
  surveyPhaseBefore = null, surveyPhaseAfter = null
} = {}) {
  const before = new Set(anchorsBefore ?? []);
  const newlyFired = (anchorsAfter ?? []).filter((a) => !before.has(a));
  const delta = avAnchorDelta(avBefore, avAfter);
  return {
    newlyFiredAnchorIds: newlyFired,
    newlyActivatedAvAnchorIds: delta.addedAnchorIds,
    avSequenceAdvanced: delta.sequenceAdvanced,
    surveyPhase: { before: surveyPhaseBefore, after: surveyPhaseAfter },
    accepted: newlyFired.length > 0 || delta.addedAnchorIds.length > 0
      || (surveyPhaseAfter != null && surveyPhaseAfter !== surveyPhaseBefore),
    note: 'Acceptance is a NAMED newly-fired anchor and/or an advanced AV activation sequence, never a predicted anchor and never an object-key count.'
  };
}

// --- Continue-boot hygiene ---------------------------------------------------
/** The Continue boot must carry NO story deep link and must not re-seed. */
export function continueBootDecision({ url = null, storageKeysBefore = [], storageKeysAfter = [] } = {}) {
  const problems = [];
  let q = null;
  try { q = new URL(String(url)).searchParams; }
  catch { problems.push(`unparseable Continue boot url ${JSON.stringify(url)}`); }
  if (q) {
    if (q.get('story')) problems.push(`the Continue boot carries ?story=${q.get('story')}: that re-seeds the state under test`);
    if (q.get('movie') === '1') problems.push('the Continue boot carries movie=1: the rail would drive the restored state');
  }
  const before = new Set(storageKeysBefore ?? []);
  const dropped = [...before].filter((k) => !(storageKeysAfter ?? []).includes(k));
  if (dropped.length) problems.push(`storage keys were lost across the Continue navigation: ${dropped.join(', ')}`);
  return { ok: problems.length === 0, problems, droppedKeys: dropped };
}
