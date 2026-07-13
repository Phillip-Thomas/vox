import * as THREE from 'three';
import { SANDBOX_FOV } from './storyInputPolicy.ts';
import { ARRIVAL } from './storyScript.ts';
import { computeRigFrame, SIDE_RIG, type LensRig, type SideLens } from './sideLens.ts';

// --- W-7744 arrival lens -------------------------------------------------------
//
// The first-person look-pull alone cannot promise a readable actor: the worker
// may sleep with the wreck, relay, or a terrain rise between their eyes and the
// approach. This shot briefly revives the opening's side-lens grammar, now as a
// smooth boom out of Terra's eyes rather than a cut to an omniscient camera.
// W-7744 owns the unobstructed work-strip row at the three recognition cues; the
// lens returns to the body before the perceptual blink and final audit.

export const ARRIVAL_SEARCH_FOV = 50;
export const ARRIVAL_GAIT_FOV = 58;
export const ARRIVAL_FOUND_FOV = 44;
export const ARRIVAL_AUDIT_FOV = 52;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function ramp(t: number, from: number, to: number): number {
  if (to <= from) return t >= to ? 1 : 0;
  return smoothstep((t - from) / (to - from));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Optical arc: search -> gait context -> recognition compression -> release. */
export function arrivalFovAt(t: number): number {
  const T = ARRIVAL;
  if (t <= T.holdBlackSeconds) return SANDBOX_FOV;
  if (t < T.someoneAt) {
    return lerp(SANDBOX_FOV, ARRIVAL_SEARCH_FOV, ramp(t, T.holdBlackSeconds, T.someoneAt));
  }
  if (t < T.gaitAt) {
    return lerp(ARRIVAL_SEARCH_FOV, ARRIVAL_GAIT_FOV, ramp(t, T.someoneAt, T.gaitAt));
  }
  if (t < T.foundAt) {
    return lerp(ARRIVAL_GAIT_FOV, ARRIVAL_FOUND_FOV, ramp(t, T.gaitAt, T.foundAt));
  }
  if (t < T.auditAt) {
    return lerp(ARRIVAL_FOUND_FOV, ARRIVAL_AUDIT_FOV, ramp(t, T.foundAt, T.auditAt));
  }
  const lineEnd = T.auditAt + T.auditLineSeconds;
  if (t < lineEnd) return ARRIVAL_AUDIT_FOV;
  if (t < T.endAt) {
    return lerp(ARRIVAL_AUDIT_FOV, SANDBOX_FOV, ramp(t, lineEnd, T.endAt));
  }
  return SANDBOX_FOV;
}

/** The external boom is fully authored at someone/gait/found, then returns. */
export function arrivalCameraWeightAt(t: number): number {
  const T = ARRIVAL;
  const enter = ramp(t, T.holdBlackSeconds, T.someoneAt);
  const exitStart = T.foundAt + 0.5;
  const exit = 1 - ramp(t, exitStart, T.zeroAt);
  return Math.min(enter, exit);
}

/** Terra's gaze stays with W-7744 through the line, then releases in the breath. */
export function arrivalLookWeightAt(t: number): number {
  const T = ARRIVAL;
  const enter = ramp(t, T.holdBlackSeconds, T.someoneAt);
  const lineEnd = T.auditAt + T.auditLineSeconds;
  const exit = 1 - ramp(t, lineEnd, T.endAt);
  return Math.min(enter, exit);
}

/** Write the tracking rig without allocating a new object every render frame. */
export function resolveArrivalRig(t: number, out: LensRig): LensRig {
  const T = ARRIVAL;
  let distance: number;
  if (t < T.someoneAt) {
    distance = lerp(15, 12, ramp(t, T.holdBlackSeconds, T.someoneAt));
  } else if (t < T.gaitAt) {
    distance = lerp(12, 13.5, ramp(t, T.someoneAt, T.gaitAt));
  } else if (t < T.foundAt) {
    distance = lerp(13.5, 9, ramp(t, T.gaitAt, T.foundAt));
  } else {
    distance = 9;
  }
  out.elevation = 0.22;
  out.azimuth = 0;
  out.distance = distance;
  out.lift = 5.5;
  out.focusLift = 1.9;
  out.followQuant = 0;
  out.depthBand = SIDE_RIG.depthBand;
  return out;
}

/** Existing side-lens math, retargeted to W-7744's live surface-snapped pose. */
export function computeArrivalCameraFrame(
  lens: SideLens,
  t: number,
  workerPosition: THREE.Vector3,
  outEye: THREE.Vector3,
  outTarget: THREE.Vector3,
  outUp: THREE.Vector3,
  rig: LensRig
): void {
  computeRigFrame(lens, resolveArrivalRig(t, rig), workerPosition, outEye, outTarget, outUp);
}
