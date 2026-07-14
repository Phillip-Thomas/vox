import * as THREE from 'three';
import { SANDBOX_FOV } from './storyInputPolicy.ts';

// The first fire is not merely a trigger for sunset. The cut begins down at the
// thing the player has just made, takes one slow arc around the flames, then
// returns to the player's eyes while their gaze travels from firelight to the
// setting sun. Keeping the timing math pure makes the hand-off testable without
// a renderer and gives the director one authoritative clock for every layer.

export const DUSK_CINEMATIC = {
  endSeconds: 10,
  fireEnterEnd: 0.9,
  fireHoldEnd: 3.2,
  fireCameraReleaseEnd: 5.3,
  sunTransitionEnd: 5.8,
  lookReleaseStart: 7,
  lookReleaseEnd: 9,
  movementReleaseStart: 8,
  movementReleaseEnd: 9.5,
  fireFov: 50,
  sunFov: 60
} as const;

export interface DuskCinematicState {
  letterbox: number;
  fireCamera: number;
  fireToSun: number;
  look: number;
  movement: number;
  fov: number;
  score: number;
  orbitRadians: number;
}

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

function heldEnvelope(t: number, enterStart: number, enterEnd: number, exitStart: number, exitEnd: number): number {
  return Math.min(ramp(t, enterStart, enterEnd), 1 - ramp(t, exitStart, exitEnd));
}

/** Resolve all authored dusk layers from the same ten-second clock. */
export function duskCinematicStateAt(t: number, hasFire: boolean): DuskCinematicState {
  const T = DUSK_CINEMATIC;
  const time = Math.max(0, t);
  const fireCamera = hasFire
    ? heldEnvelope(time, 0.1, T.fireEnterEnd, T.fireHoldEnd, T.fireCameraReleaseEnd)
    : 0;
  const fireToSun = hasFire ? ramp(time, T.fireHoldEnd, T.sunTransitionEnd) : 1;
  const look = heldEnvelope(time, 0.15, 1.15, T.lookReleaseStart, T.lookReleaseEnd);
  const letterbox = heldEnvelope(time, 0, 1.1, 8, T.endSeconds);
  const movement = ramp(time, T.movementReleaseStart, T.movementReleaseEnd);

  // A warm, portrait-like fire lens opens back out as the gaze reaches the sky.
  const openingTargetFov = hasFire ? T.fireFov : T.sunFov;
  const openingFov = THREE.MathUtils.lerp(
    SANDBOX_FOV,
    openingTargetFov,
    ramp(time, 0.1, T.fireEnterEnd)
  );
  const focusedFov = hasFire
    ? THREE.MathUtils.lerp(T.fireFov, T.sunFov, fireToSun)
    : T.sunFov;
  const fov = time < T.fireEnterEnd
    ? openingFov
    : THREE.MathUtils.lerp(focusedFov, SANDBOX_FOV, ramp(time, T.lookReleaseStart, T.endSeconds));

  return {
    letterbox,
    fireCamera,
    fireToSun,
    look,
    movement,
    fov,
    score: 0.35 + heldEnvelope(time, 0, 2.4, 6.5, T.endSeconds) * 0.65,
    // A restrained 22-degree lateral arc makes the flames breathe without
    // turning the first primitive achievement into an orbiting showcase cam.
    orbitRadians: THREE.MathUtils.lerp(-0.2, 0.18, ramp(time, T.fireEnterEnd, T.fireHoldEnd))
  };
}

const _up = new THREE.Vector3();
const _radial = new THREE.Vector3();
const _right = new THREE.Vector3();
const _fallback = new THREE.Vector3();
const _surfaceDelta = new THREE.Vector3();

/**
 * Compose a low three-quarter fire portrait in any cube-face surface frame.
 * The camera remains above the walkable plane and uses the player's current
 * tangent as the fallback when the newly placed fire is directly underfoot.
 */
export function computeDuskFireCameraFrame(
  firePosition: THREE.Vector3,
  surfaceUp: THREE.Vector3,
  playerPosition: THREE.Vector3,
  playerForward: THREE.Vector3,
  orbitRadians: number,
  outEye: THREE.Vector3,
  outTarget: THREE.Vector3,
  outUp: THREE.Vector3
): void {
  _up.copy(surfaceUp);
  if (_up.lengthSq() < 1e-8) _up.set(0, 1, 0);
  else _up.normalize();

  outTarget.copy(firePosition).addScaledVector(_up, 0.65);
  _surfaceDelta.copy(playerPosition).sub(firePosition);
  _radial.copy(_surfaceDelta).addScaledVector(_up, -_surfaceDelta.dot(_up));
  if (_radial.lengthSq() < 1e-6) {
    _radial.copy(playerForward).addScaledVector(_up, -playerForward.dot(_up)).multiplyScalar(-1);
  }
  if (_radial.lengthSq() < 1e-6) {
    _fallback.set(0, 0, -1);
    if (Math.abs(_fallback.dot(_up)) > 0.9) _fallback.set(1, 0, 0);
    _radial.copy(_fallback).addScaledVector(_up, -_fallback.dot(_up));
  }
  _radial.normalize().applyAxisAngle(_up, orbitRadians);
  _right.crossVectors(_up, _radial).normalize();

  outEye.copy(outTarget)
    .addScaledVector(_radial, 4.2)
    .addScaledVector(_right, 1.15)
    .addScaledVector(_up, 1.35);
  outUp.copy(_up);
}

const _fireDirection = new THREE.Vector3();
const _sunDirection = new THREE.Vector3();
const _gazeAxis = new THREE.Vector3();

/** Build a directionally smooth fire -> sun target at a stable focal distance. */
export function computeDuskGazeTarget(
  eye: THREE.Vector3,
  fireTarget: THREE.Vector3,
  sunDirection: THREE.Vector3,
  fireToSun: number,
  outTarget: THREE.Vector3
): THREE.Vector3 {
  _fireDirection.copy(fireTarget).sub(eye);
  if (_fireDirection.lengthSq() < 1e-8) _fireDirection.set(0, -1, 0);
  else _fireDirection.normalize();
  _sunDirection.copy(sunDirection);
  if (_sunDirection.lengthSq() < 1e-8) _sunDirection.set(0, 1, 0);
  else _sunDirection.normalize();

  // Spherical interpolation matters here: at the start of scripted dusk the
  // fire is almost straight down and the noon sun almost straight up. A linear
  // blend would collapse at the midpoint and make the camera snap 180 degrees.
  const blend = clamp01(fireToSun);
  const dot = THREE.MathUtils.clamp(_fireDirection.dot(_sunDirection), -1, 1);
  if (dot > 0.9995) {
    outTarget.copy(_fireDirection).lerp(_sunDirection, blend).normalize();
  } else if (dot < -0.9995) {
    _fallback.set(0, 1, 0);
    if (Math.abs(_fireDirection.dot(_fallback)) > 0.9) _fallback.set(1, 0, 0);
    _gazeAxis.crossVectors(_fireDirection, _fallback).normalize();
    outTarget.copy(_fireDirection).applyAxisAngle(_gazeAxis, Math.PI * blend);
  } else {
    const angle = Math.acos(dot);
    const sinAngle = Math.sin(angle);
    outTarget.copy(_fireDirection).multiplyScalar(Math.sin((1 - blend) * angle) / sinAngle)
      .addScaledVector(_sunDirection, Math.sin(blend * angle) / sinAngle)
      .normalize();
  }
  outTarget.multiplyScalar(80).add(eye);
  return outTarget;
}
