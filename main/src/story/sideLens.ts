import * as THREE from 'three';
import { applyGravityCameraTransform } from '../utils/gravityCamera.ts';

// --- The side-scroller lens ---------------------------------------------------------
//
// The raster era views the REAL voxel world strictly side-on: a camera hung off
// the player's flank along a fixed depth axis, movement locked to the vertical
// plane through the spawn. This module owns the lens frame (set by
// StoryWorldProps for the pinned story world) and the pure camera math —
// consumers (CameraControls, EfficientPlayer) act only when the story input
// policy says lookMode === 'side', so a registered lens is inert in sandbox.

export interface SideLens {
  /** Plane anchor — the arrival/spawn point. */
  origin: THREE.Vector3;
  /** Screen-right travel direction (tangent; aimed at the quota strip). */
  travelAxis: THREE.Vector3;
  /** travelAxis × up — the locked depth axis; the camera sits at +depth. */
  depthAxis: THREE.Vector3;
  up: THREE.Vector3;
}

let active: SideLens | null = null;

export function setSideLens(lens: SideLens): void {
  active = lens;
}

export function clearSideLens(): void {
  active = null;
}

export function getSideLens(): SideLens | null {
  return active;
}

// Last horizontal facing (±1 along travelAxis) — written by the movement step,
// read by the harvest probes and the worker sprite.
let facing: 1 | -1 = 1;

export function setSideFacing(value: 1 | -1): void {
  facing = value;
}

export function getSideFacing(): 1 | -1 {
  return facing;
}

export const SIDE_CAMERA_DISTANCE = 16;
export const SIDE_CAMERA_LIFT = 3.0;
export const SIDE_CAMERA_FOCUS_LIFT = 1.4;

const _up = new THREE.Vector3();
const _parentQuat = new THREE.Quaternion();
const _parentInverse = new THREE.Quaternion();
const _parentPos = new THREE.Vector3();
const _localOffset = new THREE.Vector3();
const _worldEye = new THREE.Vector3();
const _worldTarget = new THREE.Vector3();
const _lookMatrix = new THREE.Matrix4();
const _worldQuat = new THREE.Quaternion();
const _localQuat = new THREE.Quaternion();

/**
 * Side-view camera: offset from the player along +depthAxis, looking back at
 * the player. Mirrors applyGravityCameraTransform's parent-inverse local-space
 * math (utils/gravityCamera.ts) — the camera is a child of the player's
 * RigidBody, which reorients with gravity.
 */
export function applySideCameraTransform(
  camera: THREE.Camera,
  lens: SideLens,
  distance = SIDE_CAMERA_DISTANCE,
  lift = SIDE_CAMERA_LIFT,
  focusLift = SIDE_CAMERA_FOCUS_LIFT
): void {
  _up.copy(lens.up).normalize();
  const parent = camera.parent;

  if (parent) {
    parent.updateWorldMatrix(true, false);
    parent.getWorldQuaternion(_parentQuat);
    _parentInverse.copy(_parentQuat).invert();
    parent.getWorldPosition(_parentPos);

    _worldEye.copy(_parentPos)
      .addScaledVector(lens.depthAxis, distance)
      .addScaledVector(_up, lift);
    _localOffset.copy(_worldEye).sub(_parentPos).applyQuaternion(_parentInverse);
    camera.position.copy(_localOffset);
  } else {
    camera.getWorldPosition(_worldEye);
    _parentPos.copy(_worldEye).addScaledVector(lens.depthAxis, -distance).addScaledVector(_up, -lift);
  }

  _worldTarget.copy(_parentPos).addScaledVector(_up, focusLift);
  _lookMatrix.lookAt(_worldEye, _worldTarget, _up);
  _worldQuat.setFromRotationMatrix(_lookMatrix);

  if (parent) {
    _localQuat.copy(_parentInverse).multiply(_worldQuat);
    camera.quaternion.copy(_localQuat);
  } else {
    camera.quaternion.copy(_worldQuat);
  }

  camera.up.copy(_up);
  camera.updateMatrixWorld(true);
}

const _blendPosA = new THREE.Vector3();
const _blendPosB = new THREE.Vector3();
const _blendQuatA = new THREE.Quaternion();
const _blendQuatB = new THREE.Quaternion();

/**
 * The 2D→3D lift: blend between the side-scroller vantage (blend 0) and the
 * first-person gravity camera (blend 1). Computes BOTH pure transforms and
 * interpolates position/orientation — at the endpoints it matches each source
 * transform exactly (unit-tested), so the handovers on either side are seamless.
 */
export function applyLiftCameraTransform(
  camera: THREE.Camera,
  lens: SideLens,
  surfaceUp: THREE.Vector3,
  surfaceForward: THREE.Vector3,
  pitch: number,
  eyeHeight: number,
  blend: number
): void {
  const k = Math.min(1, Math.max(0, blend));
  if (k <= 0) {
    applySideCameraTransform(camera, lens);
    return;
  }
  if (k >= 1) {
    applyGravityCameraTransform(camera, surfaceUp, surfaceForward, pitch, eyeHeight);
    return;
  }
  applySideCameraTransform(camera, lens);
  _blendPosA.copy(camera.position);
  _blendQuatA.copy(camera.quaternion);
  applyGravityCameraTransform(camera, surfaceUp, surfaceForward, pitch, eyeHeight);
  _blendPosB.copy(camera.position);
  _blendQuatB.copy(camera.quaternion);
  camera.position.lerpVectors(_blendPosA, _blendPosB, k);
  camera.quaternion.slerpQuaternions(_blendQuatA, _blendQuatB, k);
  camera.updateMatrixWorld(true);
}

/**
 * Candidate cell offsets (world units, in the lens frame) for adjacent-block
 * harvesting — Terraria-style: ahead of the facing side first, then below the
 * feet, then ahead-above. `facing` is ±1 along travelAxis.
 */
export function sideHarvestProbePoints(
  position: THREE.Vector3,
  lens: SideLens,
  facing: 1 | -1,
  out: THREE.Vector3[]
): THREE.Vector3[] {
  const t = lens.travelAxis;
  const u = lens.up;
  let i = 0;
  const push = (alongTravel: number, alongUp: number) => {
    out[i++].copy(position).addScaledVector(t, alongTravel * facing).addScaledVector(u, alongUp);
  };
  push(1.6, -0.4); // ahead, waist height
  push(1.6, -1.8); // ahead, ground level
  push(0, -2.0);   // under the feet
  push(2.8, -0.4); // one further ahead
  push(1.6, 1.4);  // ahead, head height
  return out;
}
