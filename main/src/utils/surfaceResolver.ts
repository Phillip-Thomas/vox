import * as THREE from 'three';
import type { CubeFace } from '../types/cube';
import { FACE_NORMALS, dominantFaceForPosition } from './surfaceControls';

// --- Surface-frame resolver --------------------------------------------------
//
// The SINGLE authority that decides, each physics step, which face's gravity is
// in effect — replacing the old "gravity only ever changes via the edge-crossing
// heuristic, evaluated AFTER grounding against a possibly-stale face" structure
// that let you tunnel out on another face (or mis-fire at an edge) and fall off.
//
// It is a PURE function (no THREE body mutation) so it can be exhaustively tested
// against tunnelling, corners, wrong-current-face, and escape states. The caller
// (EfficientPlayer) runs it FIRST, then grounds/moves against the resolved up.
//
// Design (see the gravity review):
//   • INTERIOR FREEZE — when the cube-radius is well below the nominal shell
//     (tunnels / core), HOLD the current face. No dominant-axis flipping, so
//     burrowing down a shaft keeps "down the shaft" and the body-diagonal core
//     never strobes between faces.
//   • SURFACE BAND — near the nominal shell, the authoritative face is the STICKY
//     dominant face: a challenger must beat the current face's score by a margin
//     before we switch (kills corner/idle dither). A disagreement here is a
//     wrong-face emergence or a mis-fire -> 'snap' (reorient gravity + reproject;
//     the caller eases the camera). Intentional edge-walks are handled earlier by
//     the existing chooseFaceFromPosition path and won't reach here (they set the
//     transition cooldown the caller checks).
//   • ESCAPE — independent safety net: beyond the cancel shell, kill outward
//     velocity; beyond the emergency shell, hard-clamp the position inward. Makes
//     leaving the planet impossible regardless of any face-logic gap.

export type SurfaceResolveMode = 'hold' | 'snap' | 'escape';

export interface SurfaceResolverParams {
  /** Below planetRadius*interiorFreezeFrac (cube-radius) face identity is frozen. */
  interiorFreezeFrac: number;
  /** Challenger must beat current score by planetRadius*stickyMarginFrac to win. */
  stickyMarginFrac: number;
  /** Beyond planetRadius*(1+cancelOutwardFrac): cancel outward velocity. */
  cancelOutwardFrac: number;
  /** Beyond planetRadius*(1+emergencyFrac): hard-clamp the position inward. */
  emergencyFrac: number;
}

export const DEFAULT_RESOLVER_PARAMS: SurfaceResolverParams = {
  interiorFreezeFrac: 0.5,
  stickyMarginFrac: 0.04,
  cancelOutwardFrac: 0.5,
  emergencyFrac: 1.0
};

export interface SurfaceResolverInput {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  currentFace: CubeFace;
  planetRadius: number;
  params?: Partial<SurfaceResolverParams>;
}

export interface SurfaceResolution {
  mode: SurfaceResolveMode;
  /** Authoritative face after resolving. */
  face: CubeFace;
  up: THREE.Vector3;
  /** face !== currentFace. */
  changed: boolean;
  /** Caller must reproject velocity onto `up` (drop outward) on a change. */
  reprojectVelocity: boolean;
  /** Ease the camera rather than instant snap. */
  animateCamera: boolean;
  /** Escape: corrected velocity to apply (outward cancelled). */
  velocityCorrection?: THREE.Vector3;
  /** Escape: corrected position when beyond the emergency shell. */
  positionClamp?: THREE.Vector3;
}

function cubeRadiusOf(position: THREE.Vector3): number {
  return Math.max(Math.abs(position.x), Math.abs(position.y), Math.abs(position.z));
}

function faceScore(position: THREE.Vector3, face: CubeFace): number {
  return position.dot(FACE_NORMALS[face]);
}

export function resolveSurfaceFrame(input: SurfaceResolverInput): SurfaceResolution {
  const p = { ...DEFAULT_RESOLVER_PARAMS, ...(input.params ?? {}) };
  const { position, velocity, currentFace, planetRadius } = input;

  const held = (): SurfaceResolution => ({
    mode: 'hold',
    face: currentFace,
    up: FACE_NORMALS[currentFace].clone(),
    changed: false,
    reprojectVelocity: false,
    animateCamera: false
  });

  const cubeRadius = cubeRadiusOf(position);

  // --- ESCAPE (independent of face logic) ----------------------------------
  const cancelRadius = planetRadius * (1 + p.cancelOutwardFrac);
  if (cubeRadius > cancelRadius) {
    const dominant = dominantFaceForPosition(position);
    const outwardDir = position.lengthSq() > 1e-9
      ? position.clone().normalize()
      : FACE_NORMALS[dominant].clone();
    const outwardSpeed = velocity.dot(outwardDir);
    const corrected = velocity.clone();
    if (outwardSpeed > 0) corrected.addScaledVector(outwardDir, -outwardSpeed);

    const emergencyRadius = planetRadius * (1 + p.emergencyFrac);
    let positionClamp: THREE.Vector3 | undefined;
    if (cubeRadius > emergencyRadius) {
      positionClamp = position.clone().multiplyScalar(emergencyRadius / cubeRadius);
    }
    return {
      mode: 'escape',
      face: dominant,
      up: FACE_NORMALS[dominant].clone(),
      changed: dominant !== currentFace,
      reprojectVelocity: true,
      animateCamera: dominant !== currentFace,
      velocityCorrection: corrected,
      positionClamp
    };
  }

  // --- INTERIOR FREEZE: hold the current face (tunnels / core) --------------
  if (cubeRadius < planetRadius * p.interiorFreezeFrac) {
    return held();
  }

  // --- SURFACE BAND: sticky dominant-face reconciliation --------------------
  const challenger = dominantFaceForPosition(position);
  if (challenger === currentFace) return held();

  const margin = planetRadius * p.stickyMarginFrac;
  const delta = faceScore(position, challenger) - faceScore(position, currentFace);
  if (delta <= margin) return held(); // not a clear win -> sticky hold

  return {
    mode: 'snap',
    face: challenger,
    up: FACE_NORMALS[challenger].clone(),
    changed: true,
    reprojectVelocity: true,
    animateCamera: true
  };
}
