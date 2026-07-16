import * as THREE from 'three';
import type { CubeFace } from '../types/cube.ts';
import { dominantFaceForPosition, FACE_NORMALS } from '../utils/surfaceControls.ts';
import type { AgentSurfaceRouteReason } from '../utils/agentSurfaceNavigation.ts';
import {
  EDGE_HYSTERESIS,
  PLAYER_CENTER_CLEARANCE,
  VOXEL_SCALE
} from '../utils/cubeGravityConstants.ts';

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
const FACE_ORDER: readonly CubeFace[] = ['right', 'left', 'front', 'back', 'top', 'bottom'];

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

export interface CrossFaceSurfaceLeg {
  fromFace: CubeFace;
  nextFace: CubeFace;
  remainingTransitions: 1 | 2;
  approach: THREE.Vector3;
  continuationDirection: THREE.Vector3;
}

export interface CrossFaceSurfaceLegInput {
  player: THREE.Vector3,
  goal: THREE.Vector3,
  currentFace: CubeFace,
  goalFace: CubeFace,
  lookForward: THREE.Vector3,
  planetRadius: number,
  edgeEntryRadius: number,
  cornerInset: number
}

export interface CrossFaceApproachCandidatesInput {
  leg: CrossFaceSurfaceLeg;
  goal: THREE.Vector3;
  edgeEntryRadius: number;
  cornerInset: number;
  scanStep?: number;
  maxCandidates?: number;
}

/**
 * Candidate dry insets along one physical cube edge. The unfolded shortest
 * seam remains first; a goal-aligned seam is the first fallback because it
 * avoids needless lateral travel on the destination face. Only then do we
 * probe a bounded, deterministic fan along the edge for terrain/water access.
 */
export function crossFaceApproachCandidates(
  input: CrossFaceApproachCandidatesInput
): THREE.Vector3[] {
  const edgeAxis = new THREE.Vector3().crossVectors(
    FACE_NORMALS[input.leg.fromFace],
    FACE_NORMALS[input.leg.nextFace]
  ).normalize();
  const seamLimit = Math.max(0, input.edgeEntryRadius - input.cornerInset);
  const scanStep = Math.max(0.5, input.scanStep ?? 8);
  const maxCandidates = Math.max(2, Math.floor(input.maxCandidates ?? 16));
  const result: THREE.Vector3[] = [];
  const seams: number[] = [];
  const append = (rawSeam: number) => {
    const seam = Math.max(-seamLimit, Math.min(seamLimit, rawSeam));
    if (seams.some(value => Math.abs(value - seam) < 0.25)) return;
    seams.push(seam);
    result.push(input.leg.approach.clone().addScaledVector(
      edgeAxis,
      seam - input.leg.approach.dot(edgeAxis)
    ));
  };

  const nominalSeam = input.leg.approach.dot(edgeAxis);
  const goalSeam = input.goal.dot(edgeAxis);
  append(nominalSeam);
  append(goalSeam);
  for (let offset = scanStep; result.length < maxCandidates && offset <= seamLimit * 2 + scanStep; offset += scanStep) {
    append(goalSeam + offset);
    if (result.length >= maxCandidates) break;
    append(goalSeam - offset);
    if (seams.includes(seamLimit) && seams.includes(-seamLimit)) break;
  }
  return result;
}

/** Plan one dry, fixed cube-edge leg above the same-face terrain A* layer. */
export function planCrossFaceSurfaceLeg(input: CrossFaceSurfaceLegInput): CrossFaceSurfaceLeg | null {
  const {
    player,
    goal,
    currentFace,
    goalFace,
    lookForward,
    planetRadius,
    edgeEntryRadius,
    cornerInset
  } = input;
  if (currentFace === goalFace) return null;

  const currentUp = FACE_NORMALS[currentFace];
  const goalUp = FACE_NORMALS[goalFace];
  const opposite = currentUp.dot(goalUp) < -0.5;
  let nextFace = goalFace;
  if (opposite) {
    let bestCost = Infinity;
    let bestLook = -Infinity;
    for (const candidate of FACE_ORDER) {
      const candidateUp = FACE_NORMALS[candidate];
      if (Math.abs(currentUp.dot(candidateUp)) > 0.5) continue;
      const edgeAxis = new THREE.Vector3().crossVectors(currentUp, candidateUp).normalize();
      const longitudinal = 4 * planetRadius - player.dot(candidateUp) - goal.dot(candidateUp);
      const lateral = goal.dot(edgeAxis) - player.dot(edgeAxis);
      const cost = longitudinal * longitudinal + lateral * lateral;
      const look = lookForward.dot(candidateUp);
      if (cost < bestCost - 1e-6 || (Math.abs(cost - bestCost) <= 1e-6 && look > bestLook + 1e-6)) {
        bestCost = cost;
        bestLook = look;
        nextFace = candidate;
      }
    }
  }

  const nextUp = FACE_NORMALS[nextFace];
  const edgeAxis = new THREE.Vector3().crossVectors(currentUp, nextUp).normalize();
  const playerU = player.dot(nextUp);
  const targetU = opposite
    ? 4 * planetRadius - goal.dot(nextUp)
    : 2 * planetRadius - goal.dot(currentUp);
  const denominator = targetU - playerU;
  const t = Math.max(0, Math.min(1, Math.abs(denominator) < 1e-6
    ? 0.5
    : (planetRadius - playerU) / denominator));
  const rawSeam = THREE.MathUtils.lerp(player.dot(edgeAxis), goal.dot(edgeAxis), t);
  const seamLimit = Math.max(0, edgeEntryRadius - cornerInset);
  const seam = Math.max(-seamLimit, Math.min(seamLimit, rawSeam));
  const surfaceHeight = player.dot(currentUp);
  const approach = currentUp.clone().multiplyScalar(surfaceHeight)
    .addScaledVector(nextUp, edgeEntryRadius)
    .addScaledVector(edgeAxis, seam);
  return {
    fromFace: currentFace,
    nextFace,
    remainingTransitions: opposite ? 2 : 1,
    approach,
    continuationDirection: currentUp.clone().multiplyScalar(-1)
  };
}

export const CROSS_FACE_SAFE_DOMINANCE_MARGIN = 0.25;

export interface CrossFaceCrossingTargetInput {
  player: THREE.Vector3;
  fromFace: CubeFace;
  nextFace: CubeFace;
  planetRadius: number;
  safeDominanceMargin?: number;
}

/**
 * Resolve a fixed physical crossing target at the instant the dry edge approach
 * accepts. Preserve the actor's live old-face clearance (do not cut a chord
 * through the cube), then travel far enough around the outside edge that smooth
 * gravity owns the destination face by more than its edge hysteresis. This only
 * returns a movement waypoint; it never relocates the body.
 */
export function crossFaceCrossingTarget(
  input: CrossFaceCrossingTargetInput
): THREE.Vector3 {
  const fromUp = FACE_NORMALS[input.fromFace];
  const nextUp = FACE_NORMALS[input.nextFace];
  const fromScore = input.player.dot(fromUp);
  const safeMargin = Math.max(
    0,
    input.safeDominanceMargin ?? CROSS_FACE_SAFE_DOMINANCE_MARGIN
  );
  const nextScore = Math.max(
    input.planetRadius + PLAYER_CENTER_CLEARANCE,
    fromScore + EDGE_HYSTERESIS + safeMargin
  );
  return input.player.clone().addScaledVector(
    nextUp,
    nextScore - input.player.dot(nextUp)
  );
}

export type CrossFaceSurfaceLegPhase = 'approach' | 'crossing' | 'complete';

export interface CrossFaceSurfaceLegPhaseInput {
  phase: Exclude<CrossFaceSurfaceLegPhase, 'complete'>;
  currentFace: CubeFace;
  nextFace: CubeFace;
  approachDistance: number;
  approachTolerance: number;
}

/** Crossing is a commitment, not a per-frame proximity condition. */
export function advanceCrossFaceSurfaceLegPhase(
  input: CrossFaceSurfaceLegPhaseInput
): CrossFaceSurfaceLegPhase {
  if (input.currentFace === input.nextFace) return 'complete';
  if (input.phase === 'crossing') return 'crossing';
  return input.approachDistance <= input.approachTolerance
    ? 'crossing'
    : 'approach';
}

export function enteredPlannedSurfaceFace(
  fromFace: CubeFace,
  nextFace: CubeFace,
  currentFace: CubeFace
): boolean {
  return fromFace !== currentFace && currentFace === nextFace;
}

/**
 * A cross-face handoff is owned by the destination planner only after the body
 * quantizes into its exact entry column. Surface-normal height is deliberately
 * ignored: water buoyancy and edge-roll settling can move the actor above or
 * below the sampled planner point without changing which column it occupies.
 * This mirrors agentSurfaceNavigation's Math.round(world / VOXEL_SCALE) grid
 * conversion, avoiding a geometric tolerance that can include an adjacent
 * non-traversable column.
 */
export function reachedCrossFaceDestinationEntry(
  player: THREE.Vector3,
  destinationEntry: THREE.Vector3,
  destinationFace: CubeFace
): boolean {
  const up = FACE_NORMALS[destinationFace];
  const playerGrid = [player.x, player.y, player.z].map(value =>
    Math.round(value / VOXEL_SCALE)
  );
  const entryGrid = [destinationEntry.x, destinationEntry.y, destinationEntry.z].map(value =>
    Math.round(value / VOXEL_SCALE)
  );
  const normalAxis = Math.abs(up.x) > 0.5 ? 0 : Math.abs(up.y) > 0.5 ? 1 : 2;
  return playerGrid.every((value, axis) =>
    axis === normalAxis || value === entryGrid[axis]
  );
}
