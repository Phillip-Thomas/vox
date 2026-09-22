/**
 * commonPassageLogic.mjs — PURE decision logic for the manual COMMON passage probe.
 *
 * No browser, no fs, no game import. Everything here is statically self-testable
 * (`node selftest.mjs`) so the harness's guard, parser, control, arrival and
 * progress rules are exercised without a GPU.
 *
 * Geometry constants below are COPIES of frozen chapter source read read-only in
 * the immutable pre-repair snapshot
 * `iterations/handoff-standby-findings/source/main/src/story/commonGroundState.ts`
 * (CG_POSES, CG_ROUTE_COMMON, CG_COMMON_ROUTE_UNITS, BODY_BODY_CLEARANCE_UNITS).
 * They are route KNOWLEDGE used to steer ordinary keys, never a grant: the probe
 * writes no pose, no progress and no anchor. Because the waypoints were read from
 * source, this probe can never claim first-time naive usability.
 */

// --- frozen chapter geometry (read-only copies) ---------------------------------------
export const CG_POSES = Object.freeze({
  R: Object.freeze({ x: -34, y: 51.05, z: 20 }),
  S: Object.freeze({ x: -26, y: 51.05, z: 12 }),
  E: Object.freeze({ x: -42, y: 51.05, z: 12 }),
  C: Object.freeze({ x: -48, y: 51.05, z: 12 }),
  H: Object.freeze({ x: -40, y: 51.05, z: 12 }),
  W: Object.freeze({ x: -34, y: 51.05, z: 10 }),
  T: Object.freeze({ x: -44, y: 51.05, z: 12 })
});

/** The signed common passage: 18 walked units, E -> C, in this order. */
export const CG_ROUTE_COMMON = Object.freeze([
  [-42, 51.05, 12], [-42, 51.05, 14], [-42, 51.05, 16],
  [-44, 51.05, 16], [-44, 51.05, 18], [-46, 51.05, 18],
  [-48, 51.05, 18], [-48, 51.05, 16], [-48, 51.05, 14],
  [-48, 51.05, 12]
].map((p) => Object.freeze(p)));

/** The authored long survey route (S -> E), used only to earn the survey/common transition. */
export const CG_ROUTE_LONG = Object.freeze([
  [-26, 51.05, 14], [-28, 51.05, 14], [-28, 51.05, 16], [-30, 51.05, 16],
  [-30, 51.05, 18], [-32, 51.05, 18], [-32, 51.05, 20], [-32, 51.05, 22],
  [-34, 51.05, 22], [-36, 51.05, 22], [-38, 51.05, 22], [-40, 51.05, 22],
  [-42, 51.05, 22], [-42, 51.05, 20], [-42, 51.05, 18], [-42, 51.05, 16],
  [-42, 51.05, 14], [-42, 51.05, 12]
].map((p) => Object.freeze(p)));

export const CG_COMMON_ROUTE_UNITS = 18;
export const BODY_BODY_CLEARANCE_UNITS = 1;
export const OCCUPANCY_RADIUS_UNITS = 1.25;

/**
 * The recorded early-turn deviation: turn 0.18 units BEFORE the z=16 corner, i.e.
 * at z 15.82 on the second segment (producer-manual-corner-risk.json /
 * commonGroundRoute.ts frontier-rule comment). This is the COMMON corner case and
 * is strictly distinct from the earlier free survey drawing loop.
 */
export const EARLY_TURN_POINT = Object.freeze([-42, 51.05, 15.82]);
export const EARLY_TURN_SEGMENT_INDEX = 2; // route vertex it turns short of

// --- small vector helpers --------------------------------------------------------------
export const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const unit2 = (v) => { const m = Math.hypot(v[0], v[1]); return m < 1e-9 ? null : [v[0] / m, v[1] / m]; };

export function splitByUp(from, to, up) {
  const m0 = Math.hypot(up[0], up[1], up[2]);
  const u = m0 < 1e-9 ? [0, 1, 0] : [up[0] / m0, up[1] / m0, up[2] / m0];
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const v = dot3(d, u);
  const h = [d[0] - v * u[0], d[1] - v * u[1], d[2] - v * u[2]];
  const hMag = Math.hypot(h[0], h[1], h[2]);
  return { vertical: v, horizontal: hMag, hUnit: hMag < 1e-9 ? null : [h[0] / hMag, h[1] / hMag, h[2] / hMag] };
}

/** A body vector must be finite, three-component and NOT the uninitialised origin. */
export function bodyUsable(p) {
  if (!Array.isArray(p) || p.length !== 3) return { ok: false, why: 'not-a-3-vector' };
  if (!p.every((n) => Number.isFinite(n))) return { ok: false, why: 'non-finite' };
  if (Math.hypot(p[0], p[1], p[2]) < 1e-6) return { ok: false, why: 'uninitialised-origin-000' };
  return { ok: true, why: null };
}

/** Settled = a finite tail of samples whose mutual spread is under eps. */
export function settled(samples, { n = 8, eps = 0.02 } = {}) {
  if (samples.length < n) return { ok: false, why: `only ${samples.length} samples`, spread: null };
  const tail = samples.slice(-n);
  let spread = 0;
  for (let i = 0; i < tail.length; i += 1) {
    for (let j = i + 1; j < tail.length; j += 1) spread = Math.max(spread, dist3(tail[i], tail[j]));
  }
  return { ok: spread <= eps, why: spread <= eps ? null : `spread ${spread.toFixed(4)} > ${eps}`, spread };
}

export function directionsDistinct(aUnit, bUnit, minDeg = 25) {
  if (!aUnit || !bUnit) return { ok: false, deg: null, why: 'a held key produced no horizontal direction' };
  const c = Math.max(-1, Math.min(1, dot3(aUnit, bUnit)));
  const deg = (Math.acos(c) * 180) / Math.PI;
  return { ok: deg >= minDeg, deg, why: deg >= minDeg ? null : `only ${deg.toFixed(1)}deg apart` };
}

/** Pick the calibrated key whose MEASURED world direction best matches `want`. */
export function chooseKey(dirs, want) {
  let best = null; let bestDot = -Infinity;
  for (const [k, d] of Object.entries(dirs)) {
    if (!d) continue;
    const s = d[0] * want[0] + d[1] * want[1];
    if (s > bestDot) { bestDot = s; best = k; }
  }
  return { key: best, score: bestDot };
}

/**
 * A key hold is a real INPUT RECEIPT only when the body moved horizontally with a
 * direction. Spawn settling (vertical-only drift) is not motion.
 */
export function keyReceipt({ from, to, up = [0, 1, 0], minHorizontal = 0.4 }) {
  const ub = bodyUsable(from); const ua = bodyUsable(to);
  if (!ub.ok || !ua.ok) return { ok: false, why: `unusable body (${ub.why ?? ua.why})`, horizontal: null, dir2: null };
  const sp = splitByUp(from, to, up);
  const dir2 = unit2([to[0] - from[0], to[2] - from[2]]);
  if (!(sp.horizontal >= minHorizontal)) {
    return { ok: false, why: `horizontal ${sp.horizontal.toFixed(3)} < ${minHorizontal} (vertical ${sp.vertical.toFixed(3)}) — settling, not motion`, horizontal: sp.horizontal, vertical: sp.vertical, dir2 };
  }
  if (!dir2) return { ok: false, why: 'no horizontal direction', horizontal: sp.horizontal, vertical: sp.vertical, dir2 };
  return { ok: true, why: null, horizontal: sp.horizontal, vertical: sp.vertical, dir2 };
}

// --- preflight guard --------------------------------------------------------------------
/**
 * Decide whether a browser may be launched AT ALL. Refuses on unreadiness, on a
 * verifier control hold, on a missing/foreign URL, on a missing external heavy
 * lock, and on an unbound source manifest. Pure: callers pass the loaded files.
 */
export function preflightDecision({
  ready = null, control = null, url = null, out = null,
  heavyLockHeld = false, expectSourceManifestSha = null, liveSourceManifestSha = null,
  role = 'common-manual-focused'
} = {}) {
  const refusals = [];
  if (!ready || ready.ready !== true) refusals.push(`verification-ready.json ready=${ready ? String(ready.ready) : 'missing'}`);
  if (!control) refusals.push('verifier-control.json missing');
  else {
    if (control.action === 'hold') refusals.push(`verifier control action=hold (${String(control.instruction ?? '').slice(0, 120)})`);
    if (control.activeRole && control.activeRole !== role) refusals.push(`verifier control activeRole=${control.activeRole}, not ${role}`);
  }
  if (!url) refusals.push('--url is required (root-published canonical URL); no hardcoded port default exists');
  else if (!/^https?:\/\//.test(url)) refusals.push(`--url ${url} is not an http(s) URL`);
  if (!out) refusals.push('--out is required (unique run-local capture folder)');
  if (!heavyLockHeld) refusals.push('exclusive shared heavy lock not held (must be acquired externally before invocation)');
  if (!expectSourceManifestSha) refusals.push('--expect-source-manifest is required and must be the NEW root-published manifest sha256');
  else if (liveSourceManifestSha && liveSourceManifestSha !== expectSourceManifestSha) {
    refusals.push(`source manifest sha mismatch: expected ${expectSourceManifestSha}, live ${liveSourceManifestSha}`);
  }
  return { launch: refusals.length === 0, refusals };
}

/** Browser identity: liveness is not identity (CLAUDE.md, port-takeover incident). */
export function identityVerdict({ title = null, renderer = null, headed = null, indexSha = null, expectIndexSha = null }) {
  const problems = [];
  if (title !== 'Paravoxia') problems.push(`document.title=${JSON.stringify(title)} is not "Paravoxia"`);
  if (!renderer || !/ANGLE/i.test(renderer)) problems.push(`renderer ${JSON.stringify(renderer)} is not hardware ANGLE`);
  if (/SwiftShader|llvmpipe/i.test(String(renderer))) problems.push('software renderer');
  if (headed !== true) problems.push('session is not headed');
  if (expectIndexSha && indexSha && indexSha !== expectIndexSha) problems.push(`index sha ${indexSha} != expected ${expectIndexSha}`);
  return { ok: problems.length === 0, problems };
}

// --- prompt / objective gates ------------------------------------------------------------
/** True only when a shipped primary prompt literally offers [F] with the wanted verb. */
export function promptOffersF(prompts, verbPattern = null) {
  const list = Array.isArray(prompts) ? prompts.filter((p) => typeof p === 'string') : [];
  const withF = list.filter((p) => /\[?\bF\b\]?/.test(p));
  if (withF.length === 0) return { ok: false, why: 'no primary prompt mentions F', matched: null, prompts: list };
  if (!verbPattern) return { ok: true, why: null, matched: withF[0], prompts: list };
  const hit = withF.find((p) => verbPattern.test(p)) ?? null;
  return { ok: !!hit, why: hit ? null : `no F prompt matched ${verbPattern}`, matched: hit, prompts: list };
}

/** F is permitted only when the CURRENT objective is the expected one AND F is offered. */
export function mayPressF({ objectiveId = null, expectedObjectiveId = null, prompts = null, verbPattern = null }) {
  const p = promptOffersF(prompts, verbPattern);
  if (expectedObjectiveId && objectiveId !== expectedObjectiveId) {
    return { ok: false, why: `objective is ${JSON.stringify(objectiveId)}, expected ${expectedObjectiveId}`, prompt: p.matched };
  }
  if (!p.ok) return { ok: false, why: p.why, prompt: null };
  return { ok: true, why: null, prompt: p.matched };
}

// --- arrival / walk verdicts ---------------------------------------------------------------
/**
 * A leg NEVER reports arrival on a timeout or a stall. `reached` is true only when a
 * measured distance is inside `arrive` while the budget still ran.
 */
export function legVerdict({ label, target, arrive, distance, elapsedMs, budgetMs, stalledMs, stallLimitMs = 7000, travelled = 0 }) {
  const timedOut = elapsedMs >= budgetMs;
  const stalled = stalledMs >= stallLimitMs;
  const reached = Number.isFinite(distance) && distance <= arrive && !timedOut && !stalled;
  return {
    label, target, arrive, distance, elapsedMs, travelled,
    reached,
    status: reached ? 'reached' : stalled ? 'stalled' : timedOut ? 'timeout' : 'not-reached',
    // Explicitly never the word "arrived" unless reached is true.
    fatal: !reached
  };
}

/** Monotone credited-progress tracker: detects loss of earned prefix and stalls. */
export function makeProgressTracker({ name = 'terraUnits', epsilon = 1e-6 } = {}) {
  const samples = [];
  let max = 0; let minAfterMax = Infinity; let dropped = null;
  return {
    push(units, meta = {}) {
      const u = Number.isFinite(units) ? units : null;
      samples.push({ units: u, ...meta });
      if (u === null) return { units: null, max, dropped };
      if (u + epsilon < max) { minAfterMax = Math.min(minAfterMax, u); dropped = dropped ?? { from: max, to: u, at: samples.length - 1 }; }
      if (u > max) max = u;
      return { units: u, max, dropped };
    },
    get name() { return name; },
    get samples() { return samples; },
    get max() { return max; },
    get last() { return samples.length ? samples[samples.length - 1].units : null; },
    get prefixRetained() { return dropped === null; },
    get drop() { return dropped; },
    stalledOver(nSamples, tol = epsilon) {
      if (samples.length < nSamples) return false;
      const tail = samples.slice(-nSamples).map((s) => s.units).filter((u) => u !== null);
      if (tail.length < 2) return false;
      return Math.max(...tail) - Math.min(...tail) <= tol;
    }
  };
}

/**
 * The full physical assertion for the eighteen-unit passage. Body at the endpoint is
 * NOT sufficient: credited units, physical arrival, live support and a live reference
 * (evidenced by credit actually accruing while walking) must all hold.
 */
export function passageVerdict({
  creditedUnits = null, requiredUnits = CG_COMMON_ROUTE_UNITS, arrivalDistance = null, arriveRadius = 1.0,
  supported = null, referenceObserved = null, orderedLegsAllReached = null, clearanceUnits = null,
  extraFPresses = 0, resetsObserved = 0, epsilon = 1e-6
} = {}) {
  const checks = {
    fullEighteenCredited: Number.isFinite(creditedUnits) && creditedUnits + epsilon >= requiredUnits,
    physicalArrivalAtC: Number.isFinite(arrivalDistance) && arrivalDistance <= arriveRadius,
    liveSupportAtArrival: supported === true,
    referenceHeldDuringPassage: referenceObserved === true,
    orderedRouteLegsAllReached: orderedLegsAllReached === true,
    bodyClearanceMaintained: Number.isFinite(clearanceUnits) && clearanceUnits >= BODY_BODY_CLEARANCE_UNITS,
    noExtraFOrReset: extraFPresses === 0 && resetsObserved === 0
  };
  const failed = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  const unknown = [creditedUnits, arrivalDistance, supported, referenceObserved, orderedLegsAllReached, clearanceUnits]
    .some((v) => v === null || v === undefined);
  return {
    checks,
    failed,
    ok: failed.length === 0,
    verdict: failed.length === 0 ? 'FULL-EIGHTEEN-UNIT-PASSAGE-OBSERVED'
      : unknown ? 'INCONCLUSIVE-UNAVAILABLE-FIELD' : 'PASSAGE-NOT-PROVED'
  };
}

/**
 * Classify the early-corner recovery attempt. Recovery counts ONLY when the body
 * physically returned to the unfinished frontier and re-traversed the omitted
 * ground; endpoint pumping and far-end looping must not close it.
 */
export function recoveryVerdict({
  creditedAtDeviation = null, creditedAfterFarExcursion = null, creditedFinal = null,
  returnedToFrontier = null, omittedGroundTraversed = null, prefixRetained = null,
  extraFPresses = 0, resetsObserved = 0, requiredUnits = CG_COMMON_ROUTE_UNITS, epsilon = 1e-6
} = {}) {
  if ([creditedAtDeviation, creditedAfterFarExcursion, creditedFinal, returnedToFrontier, omittedGroundTraversed, prefixRetained]
    .some((v) => v === null || v === undefined)) {
    return { verdict: 'INCONCLUSIVE-UNAVAILABLE-FIELD', checks: null, failed: ['unavailable-field'] };
  }
  const checks = {
    earlyTurnActuallyStalledCredit: creditedAfterFarExcursion + epsilon < requiredUnits,
    farExcursionBoughtNothing: creditedAfterFarExcursion <= creditedAtDeviation + 0.6 + epsilon,
    returnedToFrontierByOrdinaryMovement: returnedToFrontier === true,
    omittedGroundActuallyTraversed: omittedGroundTraversed === true,
    earnedPrefixRetained: prefixRetained === true,
    fullEighteenAfterRecovery: creditedFinal + epsilon >= requiredUnits,
    noExtraFNoReset: extraFPresses === 0 && resetsObserved === 0
  };
  const failed = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  return {
    checks, failed,
    verdict: failed.length === 0 ? 'EARLY-CORNER-RECOVERY-EARNED-THROUGH-OMITTED-GROUND'
      : checks.earlyTurnActuallyStalledCredit === false ? 'NO-STALL-OBSERVED-CASE-NOT-EXERCISED'
        : failed.includes('fullEighteenAfterRecovery') ? 'RECOVERY-FAILED-CREDIT-NOT-RESTORED'
          : 'RECOVERY-CLAIM-UNSOUND'
  };
}

/** Body-to-body clearance actually measured between two live positions. */
export function clearanceBetween(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return null;
  const d = dist3(a, b);
  return { units: d, ok: d >= BODY_BODY_CLEARANCE_UNITS };
}

/** Split a probe snapshot into the two distinct coordinate spaces. */
export function poseReading(snap) {
  if (!snap) return { bodyCentre: null, bodyPose: null, groundOffsetUnits: null, supported: null, available: false };
  return {
    bodyCentre: snap.bodyCentre ?? null,
    bodyPose: snap.bodyPose ?? null,
    groundOffsetUnits: snap.groundOffsetUnits ?? null,
    supported: typeof snap.supported === 'boolean' ? snap.supported : null,
    available: Array.isArray(snap.bodyPose)
  };
}

/** Any unknown runtime field becomes "unavailable", never a fabricated value. */
export const orUnavailable = (v) => (v === undefined || v === null ? 'unavailable' : v);
