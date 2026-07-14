import * as THREE from 'three';
import type { CubeFace } from '../types/cube.ts';
import { dominantFaceForPosition } from '../utils/surfaceControls.ts';
import type { AgentSurfaceRouteReason } from '../utils/agentSurfaceNavigation.ts';

export interface AutopilotSteeringIntent {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

const _up = new THREE.Vector3();
const _direction = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();

/** The physics-owned face. Position is ambiguous at an exact cube seam; local
 * gravity up is not, so autonomous routing must key its handoff on this value. */
export function surfaceFaceFromUp(up: THREE.Vector3): CubeFace {
  return dominantFaceForPosition(up);
}

/** Camera-relative buttons for a world-space surface leg. If the look forward
 * is temporarily parallel to the new up during a face roll, the route itself
 * becomes the forward basis. This preserves intent until camera transport has
 * finished instead of emitting a reverse/side oscillation at the seam. */
export function surfaceSteeringIntent(
  routeDirection: THREE.Vector3,
  surfaceUp: THREE.Vector3,
  lookForward: THREE.Vector3,
  threshold = 0.18
): AutopilotSteeringIntent {
  _up.copy(surfaceUp).normalize();
  _direction.copy(routeDirection).addScaledVector(_up, -routeDirection.dot(_up));
  if (_direction.lengthSq() < 1e-8) {
    return { forward: false, backward: false, left: false, right: false };
  }
  _direction.normalize();
  _forward.copy(lookForward).addScaledVector(_up, -lookForward.dot(_up));
  if (_forward.lengthSq() < 1e-8) _forward.copy(_direction);
  else _forward.normalize();
  _right.crossVectors(_forward, _up);
  if (_right.lengthSq() < 1e-8) {
    return { forward: true, backward: false, left: false, right: false };
  }
  _right.normalize();
  const forward = _direction.dot(_forward);
  const right = _direction.dot(_right);
  return {
    forward: forward > threshold,
    backward: forward < -threshold,
    right: right > threshold,
    left: right < -threshold
  };
}

/** A direct cross-face leg has reached the goal's owning face. Keep the held
 * forward input through the short camera/gravity transport before asking the
 * same-face A* planner for a new route from a seam cell. */
export function beginsCrossFaceRouteHandoff(
  previousReason: AgentSurfaceRouteReason,
  previousFace: CubeFace,
  currentFace: CubeFace,
  goalFace: CubeFace
): boolean {
  return previousReason === 'different-face-direct-fallback'
    && previousFace !== currentFace
    && currentFace === goalFace;
}
