import * as THREE from 'three';
import { FACE_NORMALS, deterministicTangentForUp, dominantFaceForPosition } from './surfaceControls.ts';

/** Why an actor is moving its eyes. Travel stays close to the local horizon;
 * inspect is allowed a wider pitch once the subject is genuinely on this face. */
export type SurfaceGazeMode = 'travel' | 'inspect' | 'ambient';

export interface SurfaceGazeInput {
  eye: THREE.Vector3;
  viewerUp: THREE.Vector3;
  currentForward: THREE.Vector3;
  goal: THREE.Vector3;
  /** The subject's own surface normal. Inferred from its cube face when omitted. */
  goalUp?: THREE.Vector3 | null;
  subjectLift?: number;
  /** Preferred first route segment. This keeps looking and walking in agreement. */
  routeDirection?: THREE.Vector3 | null;
  mode?: SurfaceGazeMode;
  elapsed?: number;
  seed?: number;
}

export interface SurfaceGazeResult {
  direction: THREE.Vector3;
  tangentForward: THREE.Vector3;
  indicatorDirection: THREE.Vector3;
  targetPoint: THREE.Vector3;
  pitch: number;
  direct: boolean;
  surfaceOccluded: boolean;
}

export function createSurfaceGazeResult(): SurfaceGazeResult {
  return {
    direction: new THREE.Vector3(0, 0, -1),
    tangentForward: new THREE.Vector3(0, 0, -1),
    indicatorDirection: new THREE.Vector3(0, 0, -1),
    targetPoint: new THREE.Vector3(0, 0, -20),
    pitch: 0,
    direct: false,
    surfaceOccluded: false
  };
}

const _up = new THREE.Vector3();
const _goalUp = new THREE.Vector3();
const _subject = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _bearing = new THREE.Vector3();
const _fallback = new THREE.Vector3();
const _direct = new THREE.Vector3();
const _side = new THREE.Vector3();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep01(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function stablePhase(seed: number): number {
  // Integer-ish hash without a mutable RNG: repeated calls at the same elapsed
  // time are identical, which makes the gaze frame-rate independent.
  const x = Math.sin((seed + 1) * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * Math.PI * 2;
}

/**
 * Resolve an embodied, surface-aware gaze. A target on another cube face is a
 * bearing over the local horizon, never a chord through the planet. The true
 * subject only owns pitch once it is on the viewer's face and near enough to
 * read; until then the actor looks where they are going with a small, seeded
 * human scan.
 *
 * `out` lets camera/NPC frame loops reuse vectors without allocating.
 */
export function solveSurfaceGaze(
  input: SurfaceGazeInput,
  out: SurfaceGazeResult = createSurfaceGazeResult()
): SurfaceGazeResult {
  const mode = input.mode ?? 'travel';
  _up.copy(input.viewerUp);
  if (_up.lengthSq() < 1e-8) _up.set(0, 1, 0);
  else _up.normalize();

  const viewerFace = dominantFaceForPosition(input.eye);
  const goalFace = dominantFaceForPosition(input.goal);
  const sameFace = viewerFace === goalFace;
  _goalUp.copy(input.goalUp ?? FACE_NORMALS[goalFace]);
  if (_goalUp.lengthSq() < 1e-8) _goalUp.copy(FACE_NORMALS[goalFace]);
  else _goalUp.normalize();

  _subject.copy(input.goal).addScaledVector(_goalUp, input.subjectLift ?? 0);
  _delta.copy(_subject).sub(input.eye);

  _fallback.copy(input.currentForward).addScaledVector(_up, -input.currentForward.dot(_up));
  if (_fallback.lengthSq() < 1e-8) deterministicTangentForUp(_up, _fallback);
  else _fallback.normalize();

  if (input.routeDirection && input.routeDirection.lengthSq() > 1e-8) {
    _bearing.copy(input.routeDirection)
      .addScaledVector(_up, -input.routeDirection.dot(_up));
  } else {
    // Projection is the local surface bearing. Unlike normalizing the raw chord,
    // it cannot point down through the cube when the target lives on another face.
    _bearing.copy(_delta).addScaledVector(_up, -_delta.dot(_up));
    if (!sameFace && _bearing.lengthSq() < 1e-8) {
      _bearing.copy(_goalUp).addScaledVector(_up, -_goalUp.dot(_up));
    }
  }
  if (_bearing.lengthSq() < 1e-8) _bearing.copy(_fallback);
  else _bearing.normalize();

  const tangentRange = Math.max(0, _delta.clone().addScaledVector(_up, -_delta.dot(_up)).length());
  const inspectRange = mode === 'inspect' ? 26 : 14;
  const directBlend = sameFace
    ? smoothstep01(1 - Math.max(0, tangentRange - inspectRange * 0.45) / (inspectRange * 0.55))
    : 0;
  const direct = sameFace && (mode === 'inspect' || tangentRange <= inspectRange);

  const phase = stablePhase(input.seed ?? 0);
  const t = input.elapsed ?? 0;
  const wanderScale = mode === 'ambient' ? 1 : mode === 'travel' ? 0.42 : 0.22;
  const yaw = THREE.MathUtils.degToRad(
    (Math.sin(t * 0.37 + phase) * 3.2 + Math.sin(t * 0.13 + phase * 1.71) * 1.8) * wanderScale
  );
  const wanderPitch = THREE.MathUtils.degToRad(
    (Math.sin(t * 0.29 + phase * 0.73) * 1.5 + Math.sin(t * 0.11 + phase * 1.13) * 0.7) * wanderScale
  );

  out.tangentForward.copy(_bearing).applyAxisAngle(_up, yaw).normalize();
  out.indicatorDirection.copy(_bearing);

  let pitch = wanderPitch;
  if (direct) {
    _direct.copy(_delta);
    if (_direct.lengthSq() < 1e-8) _direct.copy(out.tangentForward);
    else _direct.normalize();
    const subjectPitch = Math.asin(clamp(_direct.dot(_up), -1, 1));
    pitch = THREE.MathUtils.lerp(wanderPitch, subjectPitch, directBlend);
  }
  const minPitch = THREE.MathUtils.degToRad(mode === 'inspect' ? -12 : -8);
  const maxPitch = THREE.MathUtils.degToRad(mode === 'inspect' ? 30 : 15);
  pitch = clamp(pitch, minPitch, maxPitch);

  _side.crossVectors(out.tangentForward, _up);
  if (_side.lengthSq() < 1e-8) deterministicTangentForUp(_up, _side);
  else _side.normalize();
  out.direction.copy(out.tangentForward).multiplyScalar(Math.cos(pitch))
    .addScaledVector(_up, Math.sin(pitch))
    .normalize();
  out.targetPoint.copy(input.eye).addScaledVector(out.direction, 20);
  out.pitch = pitch;
  out.direct = direct && directBlend > 0.5;
  out.surfaceOccluded = !sameFace;
  return out;
}
