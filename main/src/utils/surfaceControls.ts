import * as THREE from 'three';
import type { CubeFace } from '../types/cube';
import {
  EDGE_HYSTERESIS,
  FIXED_PHYSICS_STEP,
  GROUNDED_INWARD_SPEED_CAP,
  PLAYER_CENTER_CLEARANCE,
  PLAYER_EDGE_RADIUS,
  TRANSITION_MIN_INWARD_SPEED
} from './cubeGravityConstants';

export type SurfacePhase = 'stable' | 'transitioning';

export interface SurfaceState {
  face: CubeFace;
  up: THREE.Vector3;
  gravity: THREE.Vector3;
  phase: SurfacePhase;
  targetFace: CubeFace | null;
}

export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

export interface JumpState {
  isGrounded: boolean;
  coyoteTimeRemaining: number;
  jumpBufferRemaining: number;
  previousJump: boolean;
}

export interface FaceTransitionOptions {
  planetRadius: number;
  hysteresis?: number;
  bodyRadius?: number;
  velocity?: THREE.Vector3;
  movementDirection?: THREE.Vector3;
  tieEpsilon?: number;
}

export interface ControlFrame {
  up: THREE.Vector3;
  forward: THREE.Vector3;
  right: THREE.Vector3;
}

export const GRAVITY_STRENGTH = 9.81;
export const DEFAULT_MOVE_SPEED = 5;
// Apex = v^2 / 2g. At 6.8 -> ~2.36 world units, clearing one 2-unit voxel with
// margin (the old 5.5 only reached ~1.54, so you couldn't hop a single block).
export const DEFAULT_JUMP_SPEED = 6.8;
// Hold-jump jetpack: limited upward thrust once airborne, refills on the ground.
export const JETPACK_THRUST = 16; // upward accel while held (u/s^2)
export const JETPACK_MAX_FUEL = 1.4; // seconds of continuous thrust
export const JETPACK_REFILL_RATE = 0.8; // fuel/sec refilled while grounded
export const JETPACK_MAX_UP_SPEED = 7; // clamp climb rate so it's a hover, not a rocket
const DEFAULT_COYOTE_TIME = 0.14;
const DEFAULT_JUMP_BUFFER = 0.12;
const DEFAULT_SURFACE_CLEARANCE = PLAYER_CENTER_CLEARANCE;

const tempForward = new THREE.Vector3();
const tempVelocity = new THREE.Vector3();
const tempGravity = new THREE.Vector3();
const tempPosition = new THREE.Vector3();
const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();

export const FACE_NORMALS: Record<CubeFace, THREE.Vector3> = {
  top: new THREE.Vector3(0, 1, 0),
  bottom: new THREE.Vector3(0, -1, 0),
  right: new THREE.Vector3(1, 0, 0),
  left: new THREE.Vector3(-1, 0, 0),
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1)
};

/**
 * Ship-vs-terrain contact outcome: a fast inward (toward-planet) impact is a
 * crash; a gentle one is a soft stop. Pure so it's unit-testable.
 */
export function shipImpactOutcome(inwardSpeed: number, crashSpeed: number): 'crash' | 'soft' {
  return inwardSpeed > crashSpeed ? 'crash' : 'soft';
}

/**
 * The cube face a position sits on, by its dominant axis (= the face whose
 * normal has the largest dot with the position). Unlike chooseFaceFromPosition
 * (an edge-transition detector that returns null mid-face), this always returns
 * a face, so it's the right call for INITIALIZING gravity from a spawn point on
 * any of the 6 faces (e.g. exiting the ship where you landed it).
 */
export function dominantFaceForPosition(position: THREE.Vector3): CubeFace {
  const ax = Math.abs(position.x);
  const ay = Math.abs(position.y);
  const az = Math.abs(position.z);
  if (ax >= ay && ax >= az) return position.x >= 0 ? 'right' : 'left';
  if (ay >= ax && ay >= az) return position.y >= 0 ? 'top' : 'bottom';
  return position.z >= 0 ? 'front' : 'back';
}

export function getSurfaceState(face: CubeFace, phase: SurfacePhase = 'stable', targetFace: CubeFace | null = null): SurfaceState {
  const up = FACE_NORMALS[face].clone();
  return {
    face,
    up,
    gravity: up.clone().multiplyScalar(-GRAVITY_STRENGTH),
    phase,
    targetFace
  };
}

// Rotation that takes the canonical "up" (+Y, the identity body orientation) to
// the given surface up. Used to spawn the player body already aligned to whatever
// face it lands on, instead of identity (top) — otherwise the capsule is tilted
// and pokes into the first-person view after exiting the ship on another face.
const TOP_UP = new THREE.Vector3(0, 1, 0);
export function quaternionForUp(up: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(TOP_UP, tempVector.copy(up).normalize());
}

export function gravityTupleForFace(face: CubeFace): [number, number, number] {
  const gravity = FACE_NORMALS[face].clone().multiplyScalar(-GRAVITY_STRENGTH);
  return [gravity.x, gravity.y, gravity.z];
}

export function vectorToRapier(vector: THREE.Vector3) {
  return { x: vector.x, y: vector.y, z: vector.z };
}

export function vectorFromRapier(vector: { x: number; y: number; z: number }) {
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}

function projectOntoPlane(vector: THREE.Vector3, planeNormal: THREE.Vector3, target = new THREE.Vector3()) {
  return target.copy(vector).addScaledVector(planeNormal, -vector.dot(planeNormal));
}

export function areAdjacentFaces(first: CubeFace, second: CubeFace) {
  return Math.abs(FACE_NORMALS[first].dot(FACE_NORMALS[second])) < 0.001;
}

function getAdjacentFaces(face: CubeFace) {
  return (Object.keys(FACE_NORMALS) as CubeFace[]).filter(candidate => areAdjacentFaces(face, candidate));
}

export function deterministicTangentForUp(up: THREE.Vector3, target = new THREE.Vector3()) {
  const absX = Math.abs(up.x);
  const absY = Math.abs(up.y);
  const helper = absX < 0.9
    ? target.set(1, 0, 0)
    : absY < 0.9
      ? target.set(0, 1, 0)
      : target.set(0, 0, 1);

  return projectOntoPlane(helper, up, target).normalize();
}

export function makeTangentBasis(
  up: THREE.Vector3,
  preferredForward: THREE.Vector3,
  fallbackForward = new THREE.Vector3(0, 0, -1),
  targetForward = new THREE.Vector3(),
  targetRight = new THREE.Vector3()
): ControlFrame {
  projectOntoPlane(preferredForward, up, targetForward);

  if (targetForward.lengthSq() < 0.0001) {
    projectOntoPlane(fallbackForward, up, targetForward);
  }

  if (targetForward.lengthSq() < 0.0001) {
    deterministicTangentForUp(up, targetForward);
  }

  targetForward.normalize();
  targetRight.crossVectors(targetForward, up);

  if (targetRight.lengthSq() < 0.0001) {
    deterministicTangentForUp(up, targetRight);
    targetForward.crossVectors(up, targetRight).normalize();
  } else {
    targetRight.normalize();
  }

  return { up, forward: targetForward, right: targetRight };
}

export function planarCameraBasis(
  camera: THREE.Camera,
  up: THREE.Vector3,
  fallbackForward: THREE.Vector3,
  targetForward = new THREE.Vector3(),
  targetRight = new THREE.Vector3()
) {
  camera.getWorldDirection(tempForward);
  return makeTangentBasis(up, tempForward, fallbackForward, targetForward, targetRight);
}

export function transportControlFrame(frame: ControlFrame, oldUp: THREE.Vector3, newUp: THREE.Vector3): ControlFrame {
  const rotation = new THREE.Quaternion().setFromUnitVectors(oldUp, newUp);
  const forward = frame.forward.clone().applyQuaternion(rotation);
  const right = frame.right.clone().applyQuaternion(rotation);
  const transported = makeTangentBasis(newUp, forward, right);
  return {
    up: newUp.clone(),
    forward: transported.forward.clone(),
    right: transported.right.clone()
  };
}

export function movementDirectionFromBasis(input: MovementInput, forward: THREE.Vector3, right: THREE.Vector3, target = new THREE.Vector3()) {
  target.set(0, 0, 0);
  if (input.forward) target.add(forward);
  if (input.backward) target.sub(forward);
  if (input.right) target.add(right);
  if (input.left) target.sub(right);
  if (target.lengthSq() > 0.0001) target.normalize();
  return target;
}

export function composeVelocity(
  currentVelocity: THREE.Vector3,
  surfaceMoveDirection: THREE.Vector3,
  up: THREE.Vector3,
  speed = DEFAULT_MOVE_SPEED,
  noInputDamping = 0.25
) {
  const tangentMove = projectOntoPlane(surfaceMoveDirection, up, tempVector2);
  if (tangentMove.lengthSq() > 0.0001) tangentMove.normalize();

  tempGravity.copy(up).multiplyScalar(-1);
  const gravityComponent = currentVelocity.dot(tempGravity);
  tempVelocity.copy(tempGravity).multiplyScalar(gravityComponent);

  if (tangentMove.lengthSq() > 0.0001) {
    tempVelocity.addScaledVector(tangentMove, speed);
  } else {
    const tangent = projectOntoPlane(currentVelocity, up, tempVector);
    tempVelocity.addScaledVector(tangent, noInputDamping);
  }

  return tempVelocity.clone();
}

function reprojectVelocityToSurface(velocity: THREE.Vector3, oldUp: THREE.Vector3, newUp: THREE.Vector3) {
  const oldGravity = oldUp.clone().multiplyScalar(-1);
  const gravityComponent = velocity.dot(oldGravity);
  const tangent = projectOntoPlane(velocity, oldUp);
  const rotatedTangent = tangent.clone().applyQuaternion(tempQuaternion.setFromUnitVectors(oldUp, newUp));
  return rotatedTangent.addScaledVector(newUp, -Math.max(0, gravityComponent));
}

export function transitionVelocityAcrossEdge(
  velocity: THREE.Vector3,
  oldUp: THREE.Vector3,
  newUp: THREE.Vector3,
  minimumInwardSpeed = TRANSITION_MIN_INWARD_SPEED
) {
  return transitionAssistVelocity(
    reprojectVelocityToSurface(velocity, oldUp, newUp),
    newUp,
    minimumInwardSpeed
  );
}

export function chooseFaceFromPosition(
  position: THREE.Vector3,
  currentFace: CubeFace,
  options: FaceTransitionOptions
): CubeFace | null {
  const hysteresis = options.hysteresis ?? EDGE_HYSTERESIS;
  const bodyRadius = options.bodyRadius ?? PLAYER_EDGE_RADIUS;
  const tieEpsilon = options.tieEpsilon ?? 0.05;
  tempPosition.copy(position);

  const currentScore = tempPosition.dot(FACE_NORMALS[currentFace]);
  const currentThreshold = options.planetRadius - bodyRadius - hysteresis;
  const edgeEntryThreshold = options.planetRadius - bodyRadius;
  if (currentScore <= currentThreshold) return null;

  let bestFace: CubeFace | null = null;
  let bestScore = -Infinity;
  let bestIntent = -Infinity;
  let bestHardEscape = false;
  let tied = false;

  for (const face of getAdjacentFaces(currentFace)) {
    const normal = FACE_NORMALS[face];

    const score = tempPosition.dot(normal);
    const closeEnoughToEdge = score >= edgeEntryThreshold;

    const tangentVelocity = options.velocity
      ? projectOntoPlane(options.velocity, FACE_NORMALS[currentFace], tempVector2)
      : tempVector2.set(0, 0, 0);
    const velocityIntent = tangentVelocity.dot(normal);
    const movementIntent = options.movementDirection?.dot(normal) ?? 0;
    const intent = Math.max(velocityIntent, movementIntent);
    const hardEscape = score >= options.planetRadius + bodyRadius;
    const hasCrossingIntent = intent > tieEpsilon;

    if (!closeEnoughToEdge || (!hasCrossingIntent && !hardEscape)) continue;

    const scoreDelta = score - bestScore;
    if (scoreDelta > tieEpsilon || (Math.abs(scoreDelta) <= tieEpsilon && intent > bestIntent + tieEpsilon)) {
      bestScore = score;
      bestIntent = intent;
      bestHardEscape = hardEscape;
      bestFace = face;
      tied = false;
    } else if (Math.abs(scoreDelta) <= tieEpsilon && Math.abs(intent - bestIntent) <= tieEpsilon) {
      bestHardEscape = bestHardEscape || hardEscape;
      tied = true;
    }
  }

  if (tied && bestIntent <= tieEpsilon && !bestHardEscape) return null;
  return bestFace;
}

export function wrapPositionAroundEdge(
  position: THREE.Vector3,
  oldUp: THREE.Vector3,
  newUp: THREE.Vector3,
  planetRadius: number,
  surfaceClearance = DEFAULT_SURFACE_CLEARANCE,
  target = new THREE.Vector3()
) {
  const oldScore = position.dot(oldUp);
  const newScore = position.dot(newUp);
  const tangent = position
    .clone()
    .addScaledVector(oldUp, -oldScore)
    .addScaledVector(newUp, -newScore);
  const edgeBase = tangent
    .addScaledVector(oldUp, planetRadius)
    .addScaledVector(newUp, planetRadius);

  const edgeRelative = position.clone().sub(edgeBase);
  const rotation = new THREE.Quaternion().setFromUnitVectors(oldUp, newUp);
  target.copy(edgeBase).add(edgeRelative.applyQuaternion(rotation));

  const minTargetScore = planetRadius + surfaceClearance;
  const targetScore = target.dot(newUp);
  if (targetScore < minTargetScore) {
    target.addScaledVector(newUp, minTargetScore - targetScore);
  }

  return target;
}

/**
 * Reproject a velocity onto a (possibly very different) face frame WITHOUT any
 * rotation — keep the tangential + any inward component, DROP the outward
 * component along `up`. Robust for ANY pair of ups including antiparallel
 * (top<->bottom after tunnelling), where setFromUnitVectors would be degenerate.
 * Used by the surface resolver's snap/escape corrections so a face change can
 * never convert outward/falling speed into a tangential launch.
 */
export function reprojectVelocityOntoFace(velocity: THREE.Vector3, up: THREE.Vector3): THREE.Vector3 {
  const along = velocity.dot(up); // outward component (along +up)
  if (along <= 0) return velocity.clone();
  return velocity.clone().addScaledVector(up, -along);
}

export function transitionAssistVelocity(velocity: THREE.Vector3, targetUp: THREE.Vector3, minimumInwardSpeed = 2) {
  const gravityDirection = targetUp.clone().multiplyScalar(-1);
  const inwardSpeed = velocity.dot(gravityDirection);
  if (inwardSpeed >= minimumInwardSpeed) return velocity.clone();
  return velocity.clone().addScaledVector(gravityDirection, minimumInwardSpeed - inwardSpeed);
}

export function integrateLocalGravity(
  velocity: THREE.Vector3,
  gravity: THREE.Vector3,
  up: THREE.Vector3,
  deltaTime = FIXED_PHYSICS_STEP,
  grounded = false
) {
  const next = velocity.clone().addScaledVector(gravity, deltaTime);
  if (!grounded) return next;

  const inward = up.clone().multiplyScalar(-1);
  const inwardSpeed = next.dot(inward);
  if (inwardSpeed <= GROUNDED_INWARD_SPEED_CAP) return next;

  const tangent = projectOntoPlane(next, up);
  return tangent.addScaledVector(inward, GROUNDED_INWARD_SPEED_CAP);
}

export function predictPosition(position: THREE.Vector3, velocity: THREE.Vector3, deltaTime = FIXED_PHYSICS_STEP) {
  return position.clone().addScaledVector(velocity, deltaTime);
}

export function updateJumpState(
  state: JumpState,
  jumpHeld: boolean,
  isGrounded: boolean,
  deltaTime: number,
  coyoteTime = DEFAULT_COYOTE_TIME,
  jumpBuffer = DEFAULT_JUMP_BUFFER
) {
  const pressed = jumpHeld && !state.previousJump;
  const next: JumpState = {
    previousJump: jumpHeld,
    isGrounded,
    coyoteTimeRemaining: isGrounded ? coyoteTime : Math.max(0, state.coyoteTimeRemaining - deltaTime),
    jumpBufferRemaining: pressed ? jumpBuffer : Math.max(0, state.jumpBufferRemaining - deltaTime)
  };

  const shouldJump = next.jumpBufferRemaining > 0 && next.coyoteTimeRemaining > 0;
  if (shouldJump) {
    next.jumpBufferRemaining = 0;
    next.coyoteTimeRemaining = 0;
    next.isGrounded = false;
  }

  return { next, shouldJump };
}

export function applyJumpImpulse(velocity: THREE.Vector3, up: THREE.Vector3, jumpSpeed = DEFAULT_JUMP_SPEED) {
  const tangent = projectOntoPlane(velocity, up);
  return tangent.addScaledVector(up, jumpSpeed);
}
