// --- SHORT survey lane: pure decision helpers (run-local, owned) ----------------------
//
// NEW FILE. Nothing here edits the game, the contract or any shared probe. It is
// pure: no fs, no net, no browser, no clock. Everything it decides is decided
// from values the caller measured.
//
// WHY A SHORT LANE EXISTS AT ALL
// ------------------------------
// The movie rail and the existing manual witness probes deliberately draw the
// LONG route (`manual-witness-hold-probe.mjs` hardcodes the 18-waypoint
// z=14..22 detour, which is CG_ROUTE_LONG minus its first vertex). LONG is
// supported end to end by the FIXED reference and therefore completes as
// routeClass `fixed-reference`. It cannot, at any budget, prove the SHORT
// class. So no existing capture can be re-read as a SHORT proof and this lane
// must draw the short span itself.
//
// GEOMETRY IS QUOTED, NOT INFERRED FROM FILENAMES
// -----------------------------------------------
// Every constant below is quoted from FROZEN source read read-only at
// preparation time; the sha256 of each source file is recorded in pin.json and
// re-checked by the runtime against the frozen implementation-source-manifest.
//   main/src/story/commonGroundState.ts  CG_POSES, CG_ROUTE_SHORT, CG_ROUTE_LONG,
//                                        OCCUPANCY_/RELEASE_ cylinders
//   main/src/story/commonGroundDirector.ts  tickWorkerTest routeClass decision,
//                                        commitCommonGroundWitnessOffer,
//                                        commitCommonGroundTailReopen,
//                                        noteCommonGroundRevisionReady,
//                                        getCommonGroundDiagnostic
//   main/src/story/commonGroundRoute.test.ts  the SHIPPED predicate snapshot below
//
// Knowing where to walk is not a grant. Every unit the runtime moves is an
// ordinary held key and every arrival is asserted by measured distance.

export const SHORT_LANE_SCHEMA = 'paravoxia.verifier.arrivalCommonShort.logic.v1';

/** Quoted from commonGroundState.ts CG_POSES (grounded body origins). */
export const CG_POSES = Object.freeze({
  R: Object.freeze({ x: -34, y: 51.05, z: 20 }),
  S: Object.freeze({ x: -26, y: 51.05, z: 12 }),
  E: Object.freeze({ x: -42, y: 51.05, z: 12 }),
  C: Object.freeze({ x: -48, y: 51.05, z: 12 }),
  H: Object.freeze({ x: -40, y: 51.05, z: 12 }),
  W: Object.freeze({ x: -34, y: 51.05, z: 10 }),
  T: Object.freeze({ x: -44, y: 51.05, z: 12 })
});

/** Quoted from commonGroundState.ts CG_ROUTE_SHORT — 9 samples, 16 walked units. */
export const CG_ROUTE_SHORT = Object.freeze([
  [-26, 51.05, 12], [-28, 51.05, 12], [-30, 51.05, 12], [-32, 51.05, 12], [-34, 51.05, 12],
  [-36, 51.05, 12], [-38, 51.05, 12], [-40, 51.05, 12], [-42, 51.05, 12]
].map((p) => Object.freeze(p)));

/** Quoted from commonGroundState.ts CG_ROUTE_LONG — 19 samples, 36 walked units. */
export const CG_ROUTE_LONG = Object.freeze([
  [-26, 51.05, 12], [-26, 51.05, 14], [-28, 51.05, 14], [-28, 51.05, 16], [-30, 51.05, 16],
  [-30, 51.05, 18], [-32, 51.05, 18], [-32, 51.05, 20], [-32, 51.05, 22], [-34, 51.05, 22],
  [-36, 51.05, 22], [-38, 51.05, 22], [-40, 51.05, 22], [-42, 51.05, 22], [-42, 51.05, 20],
  [-42, 51.05, 18], [-42, 51.05, 16], [-42, 51.05, 14], [-42, 51.05, 12]
].map((p) => Object.freeze(p)));

export const SHORT_WALKED_UNITS = 16;
export const LONG_WALKED_UNITS = 36;

/** Quoted from commonGroundState.ts. Occupancy is the INNER cylinder. */
export const OCCUPANCY_RADIUS_UNITS = 1.25;
export const OCCUPANCY_VERTICAL_UNITS = 0.6;
export const RELEASE_RADIUS_UNITS = 1.75;
export const RELEASE_VERTICAL_UNITS = 0.9;

/**
 * THE SHIPPED PREDICATE SNAPSHOT.
 *
 * These are not this role's opinions about the geometry. They are the
 * assertions the SHIPPED unit suite already makes about CG_ROUTE_SHORT, quoted
 * so this lane cannot accidentally write a looser proof of its own:
 *
 *   main/src/story/commonGroundRoute.test.ts
 *   sha256 69e1760a1e2296b363af1dea7a7efe7bdde72044e0cf4449cee0bbee28e29f88
 *     L116-118  short + fixed only        -> reason NOT null, supportedPrefix < 9
 *     L121-127  the named cause           -> reason in the two listed below
 *     L129-137  short + held at socket(W) -> reason null, supportedPrefix == 9
 *     L139-145  long  + fixed only        -> reason null, supportedPrefix == 19
 *     L147-150  walked lengths            -> 16 vs 36
 *
 * The runtime NEVER calls a game predicate. It observes the shipped diagnostic
 * (`getCommonGroundDiagnostic`) and compares what actually happened against
 * these already-shipped expectations.
 */
export const SHIPPED_SHORT_PREDICATES = Object.freeze({
  source: 'main/src/story/commonGroundRoute.test.ts',
  sourceSha256: '69e1760a1e2296b363af1dea7a7efe7bdde72044e0cf4449cee0bbee28e29f88',
  shortWithFixedOnlyHolds: true,
  shortHoldReasons: Object.freeze(['reference-occluded-survey-housing', 'reference-out-of-range']),
  shortCompletesWithHeldWitnessAtW: true,
  longCompletesWithFixedOnly: true,
  shortSupportedPrefixWithHeld: 9,
  longSupportedPrefixWithFixed: 19
});

/**
 * The class each route class EARNS, quoted from commonGroundDirector.ts
 * tickWorkerTest: `const routeClass = held ? 'held-reference' : 'fixed-reference'`.
 * `held` is non-null only when the witness is BOTH offered AND occupied at the
 * instant the test completes.
 */
export const EXPECTED_CLASS_FOR = Object.freeze({ SHORT: 'held-reference', LONG: 'fixed-reference' });

// --- small geometry ---------------------------------------------------------------------
export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += dist3(points[i - 1], points[i]);
  return total;
}

/** Largest distance from `p` to the nearest point of the polyline `route` (XZ). */
export function maxDeviationFrom(route, samples) {
  let worst = 0;
  for (const s of samples) {
    let near = Infinity;
    for (const r of route) near = Math.min(near, distXZ(s, r));
    worst = Math.max(worst, near);
  }
  return worst;
}

/**
 * WHAT WAS ACTUALLY DRAWN vs WHAT WAS ISSUED.
 *
 * A probe that says "I intended SHORT" proves nothing; the drawn samples decide.
 * The classification is deliberately three-valued and refuses to guess: a walk
 * that is neither near the short span nor near the long one is UNCLASSIFIED and
 * is never quietly reported as SHORT.
 *
 * `issued` is the target this lane asked for. A disagreement between `issued`
 * and `actual` is itself the finding.
 */
export function classifyDrawnRoute({ samples = [], walkedUnits = null, issued = null, corridor = 2.0, unitTolerance = 4 } = {}) {
  const pts = (samples ?? []).filter((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite));
  const out = {
    issued, actual: 'UNCLASSIFIED', agrees: false, sampleCount: pts.length,
    polylineUnits: pts.length >= 2 ? polylineLength(pts) : 0,
    walkedUnits, shortDeviation: null, longDeviation: null, why: null
  };
  if (pts.length < 2) { out.why = 'fewer than two samples: nothing was drawn'; return out; }
  const dShort = maxDeviationFrom(CG_ROUTE_SHORT, pts);
  const dLong = maxDeviationFrom(CG_ROUTE_LONG, pts);
  out.shortDeviation = dShort;
  out.longDeviation = dLong;
  const nearShort = dShort <= corridor;
  const nearLong = dLong <= corridor;
  const lenNear = (target) => Math.abs(out.polylineUnits - target) <= unitTolerance;
  // The two spans SHARE their endpoints and the long route's own tail lies on
  // x=-42; length is what separates them, so both tests must agree.
  if (nearShort && !nearLong && lenNear(SHORT_WALKED_UNITS)) out.actual = 'SHORT';
  else if (nearLong && lenNear(LONG_WALKED_UNITS)) out.actual = 'LONG';
  else out.why = `deviation short=${dShort.toFixed(2)} long=${dLong.toFixed(2)} polyline=${out.polylineUnits.toFixed(2)}u matches neither signed span within corridor ${corridor}/±${unitTolerance}u`;
  out.agrees = issued !== null && out.actual === issued;
  return out;
}

/**
 * Did the SHORT span actually complete, and did it complete AS SHORT?
 *
 * Requires all four independently: the accepted slot exists, the accepted class
 * is the one a held reference earns, the drawn geometry classified SHORT, and
 * the anchor the runtime fires on a real completion was seen. A `held-reference`
 * class on a LONG drawing is not a SHORT proof and is reported as a MISLABEL.
 */
export function shortCompletionVerdict({
  drawn = null, acceptedClass = null, acceptedSamples = 0, anchors = [], phase = null
} = {}) {
  const problems = [];
  const tested = (anchors ?? []).includes('anc.cg.route-tested');
  if (!tested) problems.push('anc.cg.route-tested never fired: no completed test');
  if (phase !== 'tested') problems.push(`survey phase is ${JSON.stringify(phase)}, not "tested"`);
  if (acceptedClass !== EXPECTED_CLASS_FOR.SHORT) {
    problems.push(`acceptedClass ${JSON.stringify(acceptedClass)} != ${EXPECTED_CLASS_FOR.SHORT} (shipped: only an offered+occupied witness earns the held class)`);
  }
  if (!drawn || drawn.actual !== 'SHORT') problems.push(`drawn route classified ${JSON.stringify(drawn?.actual ?? null)}, not SHORT`);
  if (acceptedSamples > 0 && drawn && drawn.sampleCount > 0 && acceptedSamples !== drawn.sampleCount) {
    problems.push(`accepted slot holds ${acceptedSamples} samples but ${drawn.sampleCount} were observed while drawing`);
  }
  const mislabel = acceptedClass === EXPECTED_CLASS_FOR.SHORT && drawn && drawn.actual === 'LONG';
  return {
    ok: problems.length === 0,
    mislabel,
    verdict: problems.length === 0 ? 'SHORT-HELD-REFERENCE-COMPLETED' : mislabel ? 'MISLABELLED-NOT-SHORT' : 'SHORT-NOT-PROVEN',
    acceptedClass, problems
  };
}

/**
 * A NEW witness [F], not a pre-existing hold.
 *
 * The failure this closes: `witnessOffered` may already be true when the lane
 * arrives (a previous offer in the same survey), and reading it after a press
 * would then credit an F that changed nothing. A new offer requires the flag to
 * have been FALSE immediately before the press, TRUE after it, and the
 * once-anchor to have arrived with it.
 */
export function newWitnessOfferVerdict({ before = null, after = null, anchorsBefore = [], anchorsAfter = [], pressed = false } = {}) {
  const problems = [];
  if (!pressed) problems.push('no F was pressed');
  if (before?.witnessOffered === true) problems.push('a witness was ALREADY offered before this press: any change credits an earlier offer, not this one');
  if (after?.witnessOffered !== true) problems.push('no witness is offered after the press');
  const hadAnchor = (anchorsBefore ?? []).includes('anc.cg.witness-held');
  const hasAnchor = (anchorsAfter ?? []).includes('anc.cg.witness-held');
  if (hadAnchor) problems.push('anc.cg.witness-held had already fired before this press');
  if (!hasAnchor) problems.push('anc.cg.witness-held did not fire for this press');
  return { ok: problems.length === 0, isNewOffer: problems.length === 0, problems };
}

/**
 * Occupancy is REQUIRED and is INDEPENDENT of the offer.
 *
 * Quoted behaviour (commonGroundDirector.tickWorkerTest): occupancy is
 * recomputed every tick with hysteresis, and an offered-but-vacant witness
 * publishes the `reference-vacant` hold instead of completing. A completion
 * observed while `witnessOccupied` was false at the completing sample would mean
 * the held class was earned without anybody holding it.
 */
export function occupancyRequirementVerdict({ samples = [], completedAtIndex = null, standPoint = null, witnessPose = null } = {}) {
  const problems = [];
  if (!samples.length) problems.push('no occupancy series was recorded');
  const occupiedThroughout = samples.length > 0 && samples.every((s) => s.witnessOccupied === true);
  const anyVacant = samples.some((s) => s.witnessOccupied === false);
  const completing = completedAtIndex == null ? samples[samples.length - 1] : samples[completedAtIndex];
  if (completing && completing.witnessOccupied !== true) {
    problems.push('the witness was NOT occupied at the completing observation: a held class there would be unearned');
  }
  let insideOccupancy = null;
  if (standPoint && witnessPose) {
    const radial = Math.hypot(standPoint[0] - witnessPose[0], standPoint[2] - witnessPose[2]);
    const vertical = Math.abs(standPoint[1] - witnessPose[1]);
    insideOccupancy = radial <= OCCUPANCY_RADIUS_UNITS && vertical <= OCCUPANCY_VERTICAL_UNITS;
    if (!insideOccupancy) problems.push(`stand point is ${radial.toFixed(2)}u/${vertical.toFixed(2)}u from the witness pose, outside the ${OCCUPANCY_RADIUS_UNITS}/${OCCUPANCY_VERTICAL_UNITS} occupancy cylinder`);
  }
  return { ok: problems.length === 0, occupiedThroughout, anyVacant, insideOccupancy, problems };
}

/**
 * A PHYSICAL FAILURE STOPS DEPENDENT ACTIONS.
 *
 * Callers pass the ordered gate receipts recorded so far. If any required gate
 * failed, no dependent act (a key, an F, a click) may be attempted, and the
 * refusal names the first failure rather than the last.
 */
export function downstreamPermitted(gates = [], { action = 'dependent action' } = {}) {
  const failed = (gates ?? []).filter((g) => g && g.required !== false && g.ok !== true);
  if (failed.length === 0) return { permitted: true, why: null, blockedBy: null };
  return {
    permitted: false,
    blockedBy: failed[0].name,
    why: `${action} refused: ${failed[0].name} failed (${JSON.stringify(failed[0].detail ?? null).slice(0, 200)})`
  };
}

/**
 * A revision is a real edit only when the samples actually changed.
 *
 * Quoted from `reviseTail`: a no-op reopen deliberately does NOT bump
 * tailRevision, and `testedPrefixCount` is never lowered by a revision.
 */
export function revisionVerdict({ before = null, after = null, anchors = [] } = {}) {
  const problems = [];
  if (!before || !after) return { ok: false, changed: false, problems: ['a before/after survey diagnostic pair is required'] };
  const bumped = (after.tailRevision ?? 0) > (before.tailRevision ?? 0);
  const prefixKept = (after.testedPrefix ?? 0) >= (before.testedPrefix ?? 0);
  const reopened = (anchors ?? []).includes('anc.cg.tail-reopened');
  const revised = (anchors ?? []).includes('anc.cg.route-revised');
  if (!reopened) problems.push('anc.cg.tail-reopened never fired: no reopen was committed');
  if (!prefixKept) problems.push(`tested prefix fell ${before.testedPrefix} -> ${after.testedPrefix}: a revision must never un-prove samples`);
  if (bumped !== revised) problems.push(`tailRevision bumped=${bumped} but anc.cg.route-revised=${revised}: the edit and its anchor disagree`);
  return { ok: problems.length === 0, changed: bumped, prefixKept, problems };
}

/**
 * FIXTURE vs EARNED. A deep link is a labelled fixture, full stop.
 *
 * This lane may use `?story=ch13-survey` for an ISOLATED survey proof. It must
 * never be reported as an earned continuous arrival, and the label is computed
 * from the entry URL actually used rather than asserted by hand.
 */
export function entryLabel(entryUrl) {
  const url = String(entryUrl ?? '');
  const deepLinked = /[?&]story=/.test(url);
  const movie = /[?&]movie=1/.test(url);
  const beat = (url.match(/[?&]story=([^&]+)/) ?? [null, null])[1];
  return {
    entryUrl: url || null,
    deepLinked, movieRail: movie, beat,
    label: deepLinked ? 'LABELLED-FIXTURE' : 'EARNED-CONTINUOUS',
    isEarnedContinuousArrival: false,
    mayClaimEarnedArrival: false,
    claim: deepLinked
      ? `LABELLED ch13-survey FIXTURE (${beat}). Isolated survey proof only. NOT an earned continuous arrival, not first-time naive UX, and no continuity claim of any kind.`
      : 'No story deep link was used; this lane still makes no earned-arrival claim, which is a different lane’s proof.',
    manualLane: !movie
  };
}

/**
 * The fixture must not BOOT with the thing this lane is supposed to earn.
 * Called on the first diagnostic read, before any input.
 */
export function fixtureBootIsClean({ survey = null, anchors = [] } = {}) {
  const problems = [];
  if (!survey) return { ok: false, problems: ['no survey diagnostic on the boot read'] };
  if (survey.phase !== 'idle') problems.push(`boot survey phase is ${survey.phase}, not idle`);
  if ((survey.acceptedSamples ?? 0) !== 0) problems.push(`boot already carries ${survey.acceptedSamples} accepted samples`);
  if (survey.acceptedClass != null) problems.push(`boot already carries acceptedClass ${survey.acceptedClass}`);
  if (survey.witnessOffered === true) problems.push('boot already carries an offered witness/held reference');
  if (survey.witnessOccupied === true) problems.push('boot already carries an occupied witness');
  if ((survey.samples ?? 0) !== 0) problems.push(`boot already carries ${survey.samples} working samples`);
  if ((survey.testedPrefix ?? 0) !== 0) problems.push(`boot already carries a tested prefix of ${survey.testedPrefix}`);
  if ((survey.tailRevision ?? 0) !== 0) problems.push(`boot already carries tailRevision ${survey.tailRevision}`);
  if (survey.approached === true) problems.push('boot already carries the worker approach');
  for (const a of ['anc.cg.route-tested', 'anc.cg.witness-held', 'anc.cg.route-revised', 'anc.cg.tail-reopened', 'anc.cg.route-offered']) {
    if ((anchors ?? []).includes(a)) problems.push(`boot already fired ${a}`);
  }
  return { ok: problems.length === 0, problems };
}

/**
 * The cleanup/identity/active-role receipt this lane must be able to show.
 * Pure: it reads the receipts the runtime produced, and it never repairs them.
 */
export function closingReceiptVerdict({ cleanup = null, identity = null, controlActiveRole = null, expectedRole = null } = {}) {
  const problems = [];
  if (!cleanup) problems.push('no post-finally cleanup receipt was produced');
  else {
    if (cleanup.phase !== 'post-finally') problems.push(`cleanup receipt phase ${JSON.stringify(cleanup.phase)} is not post-finally`);
    if (cleanup.adopted && cleanup.cleanupCompleted !== true) problems.push(`owned browser session cleanup state=${cleanup.state}`);
    if (cleanup.stopsRootPreview === true) problems.push('cleanup claims to stop the root-owned preview: out of scope for this lane');
  }
  if (!identity || identity.ok !== true) problems.push(`current-build identity not established: ${(identity?.problems ?? ['unmeasured']).join('; ')}`);
  if (!expectedRole) problems.push('no expected activeRole supplied');
  else if (controlActiveRole !== expectedRole) problems.push(`verifier-control activeRole=${JSON.stringify(controlActiveRole)}, not ${expectedRole}`);
  return { ok: problems.length === 0, problems };
}

/**
 * The observer is INSTRUMENTATION, not gameplay.
 *
 * A passive Window/Document input observer that fails to attach says nothing
 * about whether the game accepted the input. It downgrades the observation, and
 * it must never be reported as a gameplay failure or used to pass one.
 */
export function observerFailureIsNotGameplay({ observerOk = null, gameplayEvidence = null } = {}) {
  return {
    observerOk: observerOk === true,
    degradesObservationOnly: observerOk !== true,
    gameplayConclusionAllowed: gameplayEvidence != null,
    note: observerOk === true
      ? 'The passive input observer attached; its records are corroboration only.'
      : 'The passive input observer did NOT attach. That is an INSTRUMENTATION limitation: it neither proves nor disproves that the shipped input path accepted the key. Gameplay conclusions come only from the measured body/diagnostic evidence.'
  };
}

// --- self-test ---------------------------------------------------------------------------
if (process.argv.includes('--self-test')) {
  let failures = 0;
  const ok = (cond, what) => { if (!cond) { failures += 1; console.error(`FAIL ${what}`); } else console.log(`ok   ${what}`); };

  // 1. actual SHORT vs issued target/route classification
  const shortDraw = classifyDrawnRoute({ samples: CG_ROUTE_SHORT.map((p) => [...p]), issued: 'SHORT' });
  ok(shortDraw.actual === 'SHORT' && shortDraw.agrees, 'the signed short span classifies SHORT and agrees with a SHORT issue');
  const longDraw = classifyDrawnRoute({ samples: CG_ROUTE_LONG.map((p) => [...p]), issued: 'SHORT' });
  ok(longDraw.actual === 'LONG' && !longDraw.agrees, 'the signed long span classifies LONG and DISAGREES with a SHORT issue');
  ok(classifyDrawnRoute({ samples: [[0, 51.05, 0], [9, 51.05, 9]], issued: 'SHORT' }).actual === 'UNCLASSIFIED',
    'a walk near neither span is UNCLASSIFIED, never SHORT by default');
  ok(Math.abs(polylineLength(CG_ROUTE_SHORT) - SHORT_WALKED_UNITS) < 1e-6
    && Math.abs(polylineLength(CG_ROUTE_LONG) - LONG_WALKED_UNITS) < 1e-6,
    'quoted spans reproduce the shipped 16 vs 36 walked units');

  // 2. a held class on a long drawing is a MISLABEL, not a SHORT proof
  ok(shortCompletionVerdict({ drawn: shortDraw, acceptedClass: 'held-reference', acceptedSamples: 9,
    anchors: ['anc.cg.route-tested'], phase: 'tested' }).ok, 'short + held-reference + route-tested completes');
  ok(shortCompletionVerdict({ drawn: shortDraw, acceptedClass: 'fixed-reference', acceptedSamples: 9,
    anchors: ['anc.cg.route-tested'], phase: 'tested' }).verdict === 'SHORT-NOT-PROVEN', 'a fixed-reference class does not prove SHORT');
  ok(shortCompletionVerdict({ drawn: classifyDrawnRoute({ samples: CG_ROUTE_LONG.map((p) => [...p]), issued: 'SHORT' }),
    acceptedClass: 'held-reference', acceptedSamples: 19, anchors: ['anc.cg.route-tested'], phase: 'tested' }).verdict === 'MISLABELLED-NOT-SHORT',
    'held-reference earned on a LONG drawing is reported as a mislabel');
  ok(!shortCompletionVerdict({ drawn: shortDraw, acceptedClass: 'held-reference', acceptedSamples: 9, anchors: [], phase: 'tested' }).ok,
    'no route-tested anchor => no completion');

  // 3. new F vs an existing hold
  ok(newWitnessOfferVerdict({ before: { witnessOffered: false }, after: { witnessOffered: true },
    anchorsBefore: [], anchorsAfter: ['anc.cg.witness-held'], pressed: true }).isNewOffer, 'a genuinely new witness offer is recognised');
  ok(!newWitnessOfferVerdict({ before: { witnessOffered: true }, after: { witnessOffered: true },
    anchorsBefore: ['anc.cg.witness-held'], anchorsAfter: ['anc.cg.witness-held'], pressed: true }).isNewOffer,
    'a pre-existing hold is NOT credited to this F');
  ok(!newWitnessOfferVerdict({ before: { witnessOffered: false }, after: { witnessOffered: true },
    anchorsBefore: [], anchorsAfter: [], pressed: true }).isNewOffer, 'an offer without its anchor is not a new offer');

  // 4. required occupancy
  ok(occupancyRequirementVerdict({ samples: [{ witnessOccupied: true }, { witnessOccupied: true }],
    standPoint: [-34, 51.05, 10], witnessPose: [-34, 51.05, 10] }).ok, 'occupied throughout, inside the cylinder, passes');
  ok(!occupancyRequirementVerdict({ samples: [{ witnessOccupied: true }, { witnessOccupied: false }],
    standPoint: [-34, 51.05, 10], witnessPose: [-34, 51.05, 10] }).ok, 'a vacant witness at the completing sample fails');
  ok(occupancyRequirementVerdict({ samples: [{ witnessOccupied: true }], standPoint: [-34, 51.05, 12], witnessPose: [-34, 51.05, 10] }).insideOccupancy === false,
    'a 2-unit stand-off is outside the 1.25 occupancy radius');

  // 5. a physical failure refuses the dependent action
  const gates = [{ name: 'pointer-lock-active', ok: true }, { name: 'arrived-at-W', ok: false, detail: { d: 9 } }];
  ok(downstreamPermitted(gates, { action: 'press F' }).permitted === false, 'a failed physical gate refuses the dependent F');
  ok(downstreamPermitted(gates).blockedBy === 'arrived-at-W', 'the refusal names the FIRST failure');
  ok(downstreamPermitted([{ name: 'optional', ok: false, required: false }]).permitted === true, 'an explicitly optional observation does not block');

  // 6. revision
  ok(revisionVerdict({ before: { tailRevision: 0, testedPrefix: 3 }, after: { tailRevision: 1, testedPrefix: 3 },
    anchors: ['anc.cg.tail-reopened', 'anc.cg.route-revised'] }).changed, 'a real tail edit bumps the revision with its anchor');
  ok(!revisionVerdict({ before: { tailRevision: 0, testedPrefix: 3 }, after: { tailRevision: 0, testedPrefix: 3 },
    anchors: ['anc.cg.tail-reopened', 'anc.cg.route-revised'] }).ok, 'route-revised without a bump is a disagreement, not a pass');
  ok(!revisionVerdict({ before: { tailRevision: 0, testedPrefix: 3 }, after: { tailRevision: 1, testedPrefix: 2 },
    anchors: ['anc.cg.tail-reopened', 'anc.cg.route-revised'] }).ok, 'a lowered tested prefix fails');

  // 7. fixture vs earned labels
  const lab = entryLabel('http://127.0.0.1:1/?story=ch13-survey&journeyprobe=1&debug=1');
  ok(lab.label === 'LABELLED-FIXTURE' && !lab.mayClaimEarnedArrival && lab.beat === 'ch13-survey', 'a story deep link labels itself a fixture');
  ok(entryLabel('http://127.0.0.1:1/').mayClaimEarnedArrival === false, 'no lane here may claim an earned arrival');
  ok(entryLabel('http://x/?story=ch13-survey&movie=1').manualLane === false, 'movie=1 is not the manual lane');

  // 8. fixture boot must not seed the thing being earned
  ok(fixtureBootIsClean({ survey: { phase: 'idle', samples: 0, testedPrefix: 0, tailRevision: 0, acceptedSamples: 0,
    acceptedClass: null, witnessOffered: false, witnessOccupied: false, approached: false }, anchors: [] }).ok, 'a clean boot passes');
  ok(!fixtureBootIsClean({ survey: { phase: 'tested', samples: 9, testedPrefix: 9, tailRevision: 0, acceptedSamples: 9,
    acceptedClass: 'held-reference', witnessOffered: true, witnessOccupied: true, approached: true }, anchors: ['anc.cg.route-tested'] }).ok,
    'a boot that already carries the completion, the held reference and the anchor is refused');

  // 9. cleanup / identity / active role
  ok(closingReceiptVerdict({ cleanup: { phase: 'post-finally', adopted: true, cleanupCompleted: true, state: 'stopped', stopsRootPreview: false },
    identity: { ok: true }, controlActiveRole: 'arrival-common-short-runtime', expectedRole: 'arrival-common-short-runtime' }).ok, 'a complete closing receipt passes');
  ok(!closingReceiptVerdict({ cleanup: { phase: 'post-finally', adopted: true, cleanupCompleted: false, state: 'stop-failed', stopsRootPreview: false },
    identity: { ok: true }, controlActiveRole: 'arrival-common-short-runtime', expectedRole: 'arrival-common-short-runtime' }).ok, 'a failed stop is reported, not hidden');
  ok(!closingReceiptVerdict({ cleanup: { phase: 'post-finally', adopted: true, cleanupCompleted: true, state: 'stopped', stopsRootPreview: false },
    identity: { ok: true }, controlActiveRole: 'arrival-common-verifier', expectedRole: 'arrival-common-short-runtime' }).ok, 'a foreign activeRole fails the receipt');

  // 10. observer failure is never gameplay
  ok(observerFailureIsNotGameplay({ observerOk: false, gameplayEvidence: null }).degradesObservationOnly, 'observer failure degrades observation only');

  console.log(failures === 0 ? '[arrival-common-short logic self-test] OK' : `[arrival-common-short logic self-test] ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}
