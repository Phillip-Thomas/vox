/**
 * REAL 3D LOCAL-TANGENT STEERING (PREPARED, NEVER YET RUN).
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * The earned-1 capture's walk phase steered in a hard-coded XZ plane: it
 * calibrated each ordinary movement key by measuring only [dx, dz], chose keys
 * by an XZ dot product, and measured distance with distXZ. On the body the
 * Continue boot actually resumed on, the live local up was
 * up = (0.9999999999998366, 1.8057e-07, -5.4246e-07) — the +X cube face — and
 * the survey end E = [-42, 51.05, 12] lies on the +Y face. In that frame the
 * A/D keys move the body predominantly in WORLD Y, so their XZ displacement was
 * below the 0.05 threshold and they were recorded as
 * calibratedKeyDirections.KeyA = null / KeyD = null. The steering then had only
 * W/S to work with, and 144 bursts over 90 387 ms left finalDistToE at
 * 94.79 units. That is a PROBE STEERING DEFECT. It is NOT evidence that the
 * shipped game failed to restore anything, and nothing here asserts otherwise.
 *
 * WHAT THIS MODULE DOES
 * ---------------------
 * Every quantity is 3D. The local tangent plane is built from the ACTUAL live
 * `up` published by the shipped commonGround bridge; nothing about the face is
 * assumed or hard-coded. Key calibration retains the full 3D displacement of
 * each ordinary key, so a key that moves the body purely along world Y on the
 * +X face is a MEASURED, NON-ZERO direction rather than a dropped null. When
 * the face (and therefore up) changes, `basisStale` says so and the caller
 * recalibrates; a stale basis is never silently reused.
 *
 * WHAT THIS MODULE IS NOT
 * -----------------------
 *   - it never writes a pose, never calls a rail/autopilot/state setter, never
 *     teleports and never fabricates a coordinate;
 *   - it makes no claim about whether the game restored correctly;
 *   - it has no browser, DOM, GPU or filesystem dependency: pure functions over
 *     numbers, so the CPU cases in tangentSteering3d.selftest.mjs exercise the
 *     SAME bytes the runtime would import (no mirrored re-implementation).
 */

const EPS = 1e-9;

export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm3 = (a) => Math.hypot(a[0], a[1], a[2]);
export const dist3 = (a, b) => norm3(sub3(a, b));
export const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
export function unit3(a) {
  const m = norm3(a);
  return m < EPS ? null : [a[0] / m, a[1] / m, a[2] / m];
}

/** Component of `v` lying IN the plane whose normal is `up` (up need not be unit). */
export function projectToTangent(v, up) {
  const n = unit3(up);
  if (!n) return { tangent: [...v], normal: [0, 0, 0], normalScalar: 0, upWasDegenerate: true };
  const s = dot3(v, n);
  const normal = scale3(n, s);
  return { tangent: sub3(v, normal), normal, normalScalar: s, upWasDegenerate: false };
}

/**
 * A right-handed orthonormal basis (u, v) of the tangent plane at `up`. The seed
 * axis is the world axis LEAST aligned with up, so the basis is well conditioned
 * on every cube face; it is a reporting frame only and no decision depends on
 * which seed won.
 */
export function tangentBasis(up) {
  const n = unit3(up);
  if (!n) return null;
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  let seed = axes[0]; let best = Infinity;
  for (const a of axes) {
    const align = Math.abs(dot3(a, n));
    if (align < best) { best = align; seed = a; }
  }
  const u = unit3(projectToTangent(seed, n).tangent);
  if (!u) return null;
  const v = unit3(cross3(n, u));
  if (!v) return null;
  return { up: n, u, v, seedAxis: seed };
}

/** Human label for the dominant face of an up vector. Reporting only. */
export function faceLabel(up) {
  const n = unit3(up);
  if (!n) return null;
  const names = ['X', 'Y', 'Z'];
  let i = 0;
  for (let k = 1; k < 3; k++) if (Math.abs(n[k]) > Math.abs(n[i])) i = k;
  return `${n[i] >= 0 ? '+' : '-'}${names[i]}`;
}

/**
 * Has the local frame moved far enough that a calibration taken under `oldUp`
 * can no longer be trusted? Angle, not face name: a slide across a rounded cube
 * edge changes up continuously and must recalibrate before the label flips.
 */
export function basisStale(oldUp, newUp, { maxTiltDeg = 12 } = {}) {
  const a = unit3(oldUp); const b = unit3(newUp);
  if (!a || !b) return { stale: true, tiltDeg: null, reason: 'degenerate-up' };
  const c = Math.min(1, Math.max(-1, dot3(a, b)));
  const tiltDeg = (Math.acos(c) * 180) / Math.PI;
  const faceChanged = faceLabel(a) !== faceLabel(b);
  return {
    stale: tiltDeg > maxTiltDeg || faceChanged,
    tiltDeg,
    faceChanged,
    faceBefore: faceLabel(a),
    faceAfter: faceLabel(b),
    reason: faceChanged ? 'face-change' : (tiltDeg > maxTiltDeg ? 'tilt-exceeded' : 'fresh')
  };
}

/**
 * One measured ordinary-key calibration sample.
 *
 * The FULL 3D displacement is retained. `movedTangent` is what steering can use;
 * `movedNormal` (climb/fall along up) is recorded separately and never counted
 * as horizontal progress. A key is `usable` on the 3D tangent magnitude — the
 * exact test the XZ version got wrong for A/D on the +X face.
 */
export function calibrationSample({ key, from, to, up, minUnits = 0.05 }) {
  const moved = sub3(to, from);
  const proj = projectToTangent(moved, up);
  const tangentUnits = norm3(proj.tangent);
  return {
    key,
    from: [...from],
    to: [...to],
    up: [...up],
    face: faceLabel(up),
    moved3d: moved,
    moved3dUnits: norm3(moved),
    movedTangent: proj.tangent,
    movedTangentUnits: tangentUnits,
    movedNormalUnits: proj.normalScalar,
    dir3d: unit3(moved),
    dirTangent: unit3(proj.tangent),
    usable: tangentUnits > minUnits,
    minUnits
  };
}

/**
 * Pick the ordinary key whose MEASURED direction, re-projected into the CURRENT
 * tangent plane, best matches the wanted tangent direction.
 *
 * Directions are stored as 3D unit vectors and re-projected on every use, so a
 * calibration taken slightly before an up change degrades gracefully instead of
 * pointing out of the plane. Returns the full scored table for the record.
 */
export function chooseKey3d(dirs3d, wantTangent, up, { minScore = 0.15 } = {}) {
  const want = unit3(projectToTangent(wantTangent, up).tangent);
  const scored = [];
  let best = null;
  for (const [key, d] of Object.entries(dirs3d ?? {})) {
    if (!d) { scored.push({ key, score: null, reason: 'no-measured-displacement' }); continue; }
    const p = unit3(projectToTangent(d, up).tangent);
    if (!p || !want) { scored.push({ key, score: null, reason: 'degenerate-projection' }); continue; }
    const score = dot3(p, want);
    scored.push({ key, score, projected: p });
    if (!best || score > best.score) best = { key, score, projected: p };
  }
  const ok = !!best && best.score >= minScore;
  return {
    key: ok ? best.key : null,
    score: best ? best.score : null,
    want,
    scored,
    minScore,
    reason: ok ? 'chosen' : (best ? 'no-key-scores-above-threshold' : 'no-usable-key')
  };
}

/**
 * Progress of one burst resolved in the CURRENT tangent plane.
 *
 * alongLeg: motion toward the target along the intended tangent leg.
 * lateral:  in-plane motion perpendicular to that leg (a sidestep is not proof
 *           the intended direction was clear).
 * normal:   motion along up (climb/fall) — reported, never credited as progress.
 * dist3dBefore/After: FULL 3D distance to the target; nothing is dropped.
 */
export function burstProgress3d({ from, to, target, up }) {
  const legRaw = projectToTangent(sub3(target, from), up).tangent;
  const leg = unit3(legRaw);
  const moved = sub3(to, from);
  const p = projectToTangent(moved, up);
  const along = leg ? dot3(p.tangent, leg) : 0;
  const lateralVec = leg ? sub3(p.tangent, scale3(leg, along)) : p.tangent;
  return {
    alongLeg: along,
    lateral: norm3(lateralVec),
    normal: p.normalScalar,
    grossTangent: norm3(p.tangent),
    gross3d: norm3(moved),
    legTangentUnits: norm3(legRaw),
    dist3dBefore: dist3(from, target),
    dist3dAfter: dist3(to, target),
    legDegenerate: !leg
  };
}

/**
 * Obstacle / stall verdict over the last `window` bursts, in tangent space.
 *
 * A stall STOPS the route attempt and is reported with its own telemetry. It is
 * never answered by a forced action, a teleport, a setter or a bigger timeout.
 */
export function stallVerdict(bursts, { window = 6, minAlongUnits = 0.25, minDistGainUnits = 0.25 } = {}) {
  const recent = bursts.slice(-window);
  if (recent.length < window) {
    return { stalled: false, reason: 'insufficient-history', samples: recent.length, window };
  }
  const along = recent.reduce((s, b) => s + (b.alongLeg ?? 0), 0);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const distGain = (first.dist3dBefore ?? 0) - (last.dist3dAfter ?? 0);
  const lateral = recent.reduce((s, b) => s + (b.lateral ?? 0), 0);
  const normal = recent.reduce((s, b) => s + Math.abs(b.normal ?? 0), 0);
  const stalled = along < minAlongUnits && distGain < minDistGainUnits;
  return {
    stalled,
    window,
    alongSum: along,
    lateralSum: lateral,
    normalAbsSum: normal,
    dist3dGain: distGain,
    minAlongUnits,
    minDistGainUnits,
    reason: stalled
      ? (lateral > along ? 'lateral-only-motion (obstacle or wrong tangent leg)' : 'no-tangent-progress')
      : 'progressing'
  };
}

/**
 * Separate the two DIFFERENT things the earned-1 record conflated.
 *
 * auditSupported  — the commonGround bridge's `supported`: whether the AUDITED
 *                   chapter plane supports her at that grounded pose. It is
 *                   legitimately false when the body is on another cube face,
 *                   and false here is NOT a broken-planet-physics claim.
 * physicsGrounded — the actual physics ground contact. The shipped bridge
 *                   (CommonGroundProbeSnapshot) publishes no such field and
 *                   pageReadState exposes none, so unless a hook supplies it at
 *                   runtime this stays null and is REPORTED AS A GAP.
 */
export function footingReading({ auditSupported = null, physicsGrounded = undefined, up = null, auditPlaneFace = '+Y' } = {}) {
  const face = up ? faceLabel(up) : null;
  const onAuditPlane = face != null && face === auditPlaneFace;
  return {
    auditSupported,
    auditPlaneFace,
    observedFace: face,
    onAuditPlane,
    auditSupportedIsMeaningfulHere: onAuditPlane,
    physicsGrounded: physicsGrounded === undefined ? null : physicsGrounded,
    physicsGroundedAvailable: physicsGrounded !== undefined,
    note: physicsGrounded === undefined
      ? 'no physics grounded flag is published by the shipped bridge; this is retained as an OBSERVATION GAP, not inferred from auditSupported'
      : 'physics grounded came from a runtime hook and is reported verbatim'
  };
}

// ===========================================================================
// GROUND FRAME (pre-GPU correction, producer-earned-continue-3d-prep-review)
// ===========================================================================
/**
 * WHY THIS SECTION EXISTS
 * ----------------------
 * The prepared walk compared `bodyCentre` against the GROUND target
 * E = [-42, 51.05, 12] with an arrival radius of 1.2. The shipped bridge
 * (commonGroundDirector.ts:782, :795-797, :1891) publishes TWO different
 * points:
 *
 *   bodyCentre = getPlayerWorldPosition()             — capsule CENTRE
 *   bodyPose   = centre - up * CG_PLAYER_GROUND_OFFSET — the FOOT / grounded pose
 *
 * CG_PLAYER_GROUND_OFFSET = PLAYER_CAPSULE_HALF_HEIGHT + PLAYER_CAPSULE_RADIUS.
 * Measured in the earned-1 capture at the post-Continue body:
 *   bodyCentre [52.78897476196289, 17.5,               -20]
 *   bodyPose   [50.98897476196318, 17.499999674973967, -19.99999902356783]
 * i.e. exactly 1.8 units along the live up (+X face). E's y = 51.05 likewise
 * matches the EARN-phase FOOT y = 50.9899, not a centre.
 *
 * So a correctly standing player at E has |centre - E| ~= 1.8 > 1.2: ordinary
 * lawful arrival was ARITHMETICALLY IMPOSSIBLE in the prepared probe. The fix
 * is to compare the FOOT against ground targets. The radius is NOT widened,
 * no coordinate is dropped, and bodyCentre is retained separately.
 */

/** The shipped ground offset, re-derived from the live snapshot, never assumed. */
export function groundFrame({ bodyCentre = null, bodyPose = null, up = null, groundOffsetUnits = null } = {}) {
  const n = up ? unit3(up) : null;
  const haveBoth = Array.isArray(bodyCentre) && Array.isArray(bodyPose);
  const delta = haveBoth ? sub3(bodyCentre, bodyPose) : null;   // centre - foot
  const observedOffset = delta ? norm3(delta) : null;
  // Is the published centre->foot displacement actually along the published up?
  const alongUp = (delta && n) ? dot3(delta, n) : null;
  const offAxis = (delta && n && alongUp != null) ? norm3(sub3(delta, scale3(n, alongUp))) : null;
  const consistentWithUp = offAxis != null && offAxis <= 1e-3
    && (observedOffset == null || Math.abs((alongUp ?? 0) - observedOffset) <= 1e-3);
  const matchesPublishedOffset = (groundOffsetUnits != null && observedOffset != null)
    ? Math.abs(observedOffset - groundOffsetUnits) <= 1e-3
    : null;
  return {
    centre: haveBoth ? [...bodyCentre] : (bodyCentre ? [...bodyCentre] : null),
    foot: bodyPose ? [...bodyPose] : null,
    footAvailable: Array.isArray(bodyPose),
    up: n,
    face: n ? faceLabel(n) : null,
    observedOffsetUnits: observedOffset,
    publishedOffsetUnits: groundOffsetUnits,
    offsetAlongUpUnits: alongUp,
    offsetOffAxisUnits: offAxis,
    offsetConsistentWithUp: consistentWithUp,
    matchesPublishedOffset,
    note: 'foot (bodyPose) is the frame for GROUND targets; centre is retained for the record and is never compared to a ground target'
  };
}

/**
 * Arrival at a GROUND target, decided on the FOOT in full 3D.
 * `arriveUnits` is the caller's existing radius and is never widened here.
 */
export function groundTargetArrival({ bodyCentre = null, bodyPose = null, up = null, groundOffsetUnits = null, target, arriveUnits }) {
  const gf = groundFrame({ bodyCentre, bodyPose, up, groundOffsetUnits });
  if (!gf.footAvailable) {
    return {
      arrived: false, usable: false, reason: 'foot-pose-unavailable',
      frame: gf, target: [...target], arriveUnits,
      distFootToTarget: null,
      distCentreToTarget: gf.centre ? dist3(gf.centre, target) : null
    };
  }
  const d = dist3(gf.foot, target);
  return {
    arrived: d <= arriveUnits,
    usable: true,
    reason: d <= arriveUnits ? 'foot-within-radius' : 'foot-outside-radius',
    frame: gf,
    target: [...target],
    arriveUnits,
    distFootToTarget: d,
    // Diagnostic ONLY. This is the number the prepared probe wrongly gated on.
    distCentreToTarget_diagnosticOnly: gf.centre ? dist3(gf.centre, target) : null
  };
}

/**
 * The pre-[F] authorization. EVERY condition must hold on CURRENT readings:
 *   - the FOOT is at the ground target within the existing radius;
 *   - the beat is the expected CURRENT beat (a stale beat never authorizes);
 *   - audit-plane support is true WHERE audit support is meaningful (i.e. the
 *     body is on the audited plane). Off that plane `auditSupported=false` is
 *     NOT a physics verdict and is NOT silently treated as grounded either —
 *     it refuses, and says why;
 *   - the shipped prompt is actually offering [F].
 * Nothing here presses anything, forces anything or invents a physics contact.
 */
export function groundedActionGate({
  bodyCentre = null, bodyPose = null, up = null, groundOffsetUnits = null,
  target, arriveUnits, beat = null, expectBeat = null,
  auditSupported = null, physicsGrounded = undefined, promptOffersF = false
} = {}) {
  const arrival = groundTargetArrival({ bodyCentre, bodyPose, up, groundOffsetUnits, target, arriveUnits });
  const footing = footingReading({ auditSupported, physicsGrounded, up });
  const problems = [];
  if (!arrival.usable) problems.push(`no published foot pose (${arrival.reason}); a ground target cannot be judged from bodyCentre`);
  else if (!arrival.arrived) problems.push(`foot is ${arrival.distFootToTarget.toFixed(3)}u from the ground target, outside the existing ${arriveUnits}u radius`);
  if (arrival.usable && arrival.frame.offsetConsistentWithUp === false) {
    problems.push('published centre->foot offset is not along the published up; the target frames do not match and no arrival is asserted');
  }
  if (expectBeat != null && beat !== expectBeat) problems.push(`beat is ${JSON.stringify(beat)}, not the current expected ${JSON.stringify(expectBeat)} (stale beat never authorizes the action)`);
  if (footing.physicsGroundedAvailable) {
    if (footing.physicsGrounded !== true) problems.push('the runtime-published physics grounded flag is not true');
  } else if (footing.onAuditPlane) {
    if (auditSupported !== true) problems.push('audit-plane support is not true at the grounded pose (meaningful here: the body IS on the audited plane)');
  } else {
    problems.push(`grounding is UNVERIFIABLE here: the body is on face ${footing.observedFace}, off the audited ${footing.auditPlaneFace} plane, and no physics grounded flag is published. auditSupported=${JSON.stringify(auditSupported)} is not a physics verdict, so it is neither accepted nor read as broken physics`);
  }
  if (!promptOffersF) problems.push('the shipped prompt is not offering [F]');
  return {
    ok: problems.length === 0,
    problems,
    arrival,
    footing,
    beat,
    expectBeat,
    promptOffersF,
    decidedOn: 'foot (bodyPose) vs ground target, full 3D, existing radius unchanged'
  };
}
