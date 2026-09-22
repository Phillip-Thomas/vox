import * as THREE from 'three';
import { applyGravityCameraTransform } from '../utils/gravityCamera.ts';
import { VOXEL_SCALE } from '../utils/cubeGravityConstants.ts';

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
  resetLensRig(); // next story run (or beat jump) starts from the classic profile
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

/**
 * Fixed-screen cells are centred on the crash/arrival origin. Cell 0 therefore
 * owns half a screen in either travel direction and the camera only cuts after
 * the worker actually crosses an adjacent-frame boundary.
 */
export function fixedScreenCellIndex(along: number, cellWidth: number): number {
  if (!Number.isFinite(along) || !Number.isFinite(cellWidth) || cellWidth <= 0) return 0;
  return Math.floor((along + cellWidth / 2) / cellWidth);
}

// --- The lens rig ---------------------------------------------------------------
//
// Side view, top-down, and isometric are the SAME external camera at different
// spherical angles around the player — and "fixed screen" vs "scrolling" is just
// whether the anchor quantizes to screen cells or follows continuously. Every era
// transition is therefore one camera move: the director retargets the rig and the
// active transform blends whole frames (eye/target/up), so any rig hands off to
// any other seamlessly (including quantized→continuous, the TRACKING unbolt).

export interface LensRig {
  /** Radians above the side-on horizontal. 0 = profile, PI/2 = top-down, PI/4 = iso. */
  elevation: number;
  /** Radians of yaw around up, from square-on (+depth) toward +travel. Iso uses PI/4. */
  azimuth: number;
  distance: number;
  lift: number;
  focusLift: number;
  /** 0 = continuous follow; >0 = anchor snaps to cells of this width (fixed-screen era). */
  followQuant: number;
  /** Movement freedom along the plane normal: 0 = locked, >0 = ± band, Infinity = free. */
  depthBand: number;
  /**
   * Movement freedom ALONG the travel axis, ± band metres around the lens origin:
   * Infinity = free (the cube-edge escape / face traversal stays reachable);
   * finite = the pure-2D side-scroller is walled in so the worker can neither
   * walk off the face nor switch faces. Same semantics/feel as depthBand.
   */
  travelBand: number;
}

export const SIDE_RIG: LensRig = {
  elevation: 0,
  azimuth: 0,
  distance: SIDE_CAMERA_DISTANCE,
  lift: SIDE_CAMERA_LIFT,
  focusLift: SIDE_CAMERA_FOCUS_LIFT,
  followQuant: 0,
  depthBand: 0,
  travelBand: Infinity
};

let rigFrom: LensRig = { ...SIDE_RIG };
let rigTo: LensRig = { ...SIDE_RIG };
let rigBlend = 1;
let rigSeconds = 0;

/** Retarget the rig; the active transform eases over `transitionSeconds`. */
export function setLensRig(rig: LensRig, transitionSeconds = 0): void {
  rigFrom = { ...currentEffectiveRig() };
  rigTo = { ...rig };
  rigSeconds = transitionSeconds;
  rigBlend = transitionSeconds > 0 ? 0 : 1;
}

/** The target rig — movement/input decisions switch discretely with the beat. */
export function getLensRig(): LensRig {
  return rigTo;
}

export function resetLensRig(): void {
  setLensRig(SIDE_RIG, 0);
}

/** 0..1 progress of the in-flight rig transition (1 = settled). */
export function getLensRigBlend(): number {
  return rigBlend;
}

function currentEffectiveRig(): LensRig {
  if (rigBlend >= 1) return rigTo;
  const k = smoothstep(rigBlend);
  return {
    elevation: lerp(rigFrom.elevation, rigTo.elevation, k),
    azimuth: lerp(rigFrom.azimuth, rigTo.azimuth, k),
    distance: lerp(rigFrom.distance, rigTo.distance, k),
    lift: lerp(rigFrom.lift, rigTo.lift, k),
    focusLift: lerp(rigFrom.focusLift, rigTo.focusLift, k),
    followQuant: rigTo.followQuant, // quantization never interpolates — frames blend instead
    depthBand: rigTo.depthBand,
    travelBand: rigTo.travelBand // a movement wall, not a camera value — switch discretely
  };
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function smoothstep(k: number): number {
  const t = Math.min(1, Math.max(0, k));
  return t * t * (3 - 2 * t);
}

/**
 * Signed velocity correction to add ALONG a lens band axis, mirroring the
 * external-lens edge clamp (see EfficientPlayer's depth constraint). Inside the
 * band (|drift| ≤ band) the axis is free and this returns 0. Past the edge it
 * (a) cancels any OUTWARD axial velocity and (b) springs the overshoot back
 * toward the anchor at the same 4× stiffness as the depth clamp. `band` of
 * Infinity is always a no-op; `axialSpeed` is the current velocity component
 * along the (unit) band axis, `drift` the signed distance from the anchor.
 */
export function axisBandVelocityDelta(drift: number, band: number, axialSpeed: number): number {
  if (!Number.isFinite(band)) return 0;
  const overshoot = Math.abs(drift) - band;
  if (overshoot <= 0) return 0;
  const outward = Math.sign(drift) || 1;
  let delta = 0;
  if (axialSpeed * outward > 0) delta -= axialSpeed; // cancel the outward component exactly
  delta -= overshoot * outward * 4; // spring the overshoot back onto the band
  return delta;
}

const _rigHoriz = new THREE.Vector3();
const _rigDir = new THREE.Vector3();
const _rigAnchor = new THREE.Vector3();
const _rigRel = new THREE.Vector3();

/**
 * Pure rig frame: world-space eye/target/up for a rig around `anchor`.
 * At {elevation:0, azimuth:0} this reproduces the classic side transform exactly.
 */
export function computeRigFrame(
  lens: SideLens,
  rig: LensRig,
  anchor: THREE.Vector3,
  outEye: THREE.Vector3,
  outTarget: THREE.Vector3,
  outUp: THREE.Vector3
): void {
  _rigAnchor.copy(anchor);
  if (rig.followQuant > 0) {
    // Fixed-screen era: the frame is bolted to the cell the player stands in —
    // crossing an edge hard-flips to the next screen. Vertical framing pins to
    // the lens origin so the shot never bobs with terrain.
    _rigRel.copy(anchor).sub(lens.origin);
    const along = _rigRel.dot(lens.travelAxis);
    const cell = fixedScreenCellIndex(along, rig.followQuant) * rig.followQuant;
    const depth = _rigRel.dot(lens.depthAxis);
    _rigAnchor.copy(lens.origin)
      .addScaledVector(lens.travelAxis, cell)
      .addScaledVector(lens.depthAxis, depth);
  }
  _rigHoriz.copy(lens.depthAxis).multiplyScalar(Math.cos(rig.azimuth))
    .addScaledVector(lens.travelAxis, Math.sin(rig.azimuth));
  _rigDir.copy(_rigHoriz).multiplyScalar(Math.cos(rig.elevation))
    .addScaledVector(lens.up, Math.sin(rig.elevation));
  outEye.copy(_rigAnchor).addScaledVector(_rigDir, rig.distance).addScaledVector(lens.up, rig.lift);
  outTarget.copy(_rigAnchor).addScaledVector(lens.up, rig.focusLift);
  // Screen-up follows the elevation sweep (u at profile, -horiz at top-down) so
  // lookAt never degenerates and the travel axis stays screen-horizontal.
  outUp.copy(lens.up).multiplyScalar(Math.cos(rig.elevation))
    .addScaledVector(_rigHoriz, -Math.sin(rig.elevation))
    .normalize();
}

/**
 * Movement basis under a rig: `forward` is the horizontal camera-forward
 * (exact at every elevation — no top-down degeneracy), `right` = forward × up
 * = screen-right. At the side rig this is (-depthAxis, +travelAxis), i.e.
 * today's raster mapping.
 */
export function rigMoveBasis(
  lens: SideLens,
  rig: LensRig,
  outForward: THREE.Vector3,
  outRight: THREE.Vector3
): void {
  outForward.copy(lens.depthAxis).multiplyScalar(Math.cos(rig.azimuth))
    .addScaledVector(lens.travelAxis, Math.sin(rig.azimuth))
    .negate()
    .normalize();
  outRight.copy(outForward).cross(lens.up).normalize();
}

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

const _frameUp = new THREE.Vector3();

/** Position/orient the camera from a precomputed world-space frame, using the
 * same parent-inverse local-space math as applyGravityCameraTransform (the
 * camera is a child of the player's RigidBody, which reorients with gravity). */
function applyFrame(
  camera: THREE.Camera,
  eye: THREE.Vector3,
  target: THREE.Vector3,
  up: THREE.Vector3
): void {
  const parent = camera.parent;
  if (parent) {
    parent.updateWorldMatrix(true, false);
    parent.getWorldQuaternion(_parentQuat);
    _parentInverse.copy(_parentQuat).invert();
    parent.getWorldPosition(_parentPos);
    _localOffset.copy(eye).sub(_parentPos).applyQuaternion(_parentInverse);
    camera.position.copy(_localOffset);
  }
  _lookMatrix.lookAt(eye, target, up);
  _worldQuat.setFromRotationMatrix(_lookMatrix);
  if (parent) {
    _localQuat.copy(_parentInverse).multiply(_worldQuat);
    camera.quaternion.copy(_localQuat);
  } else {
    camera.quaternion.copy(_worldQuat);
  }
  camera.up.copy(up);
  camera.updateMatrixWorld(true);
}

const _anchorScratch = new THREE.Vector3();

function rigAnchorFromCamera(camera: THREE.Camera, lens: SideLens, rig: LensRig): THREE.Vector3 {
  const parent = camera.parent;
  if (parent) {
    parent.updateWorldMatrix(true, false);
    parent.getWorldPosition(_anchorScratch);
  } else {
    // No parent (tests): reconstruct the anchor from the camera's current spot.
    camera.getWorldPosition(_anchorScratch);
    _anchorScratch.addScaledVector(lens.depthAxis, -rig.distance).addScaledVector(lens.up, -rig.lift);
  }
  return _anchorScratch;
}

/** Camera under an explicit rig (no transition blending). */
export function applyRigCameraTransform(camera: THREE.Camera, lens: SideLens, rig: LensRig): void {
  _up.copy(lens.up).normalize();
  const anchor = rigAnchorFromCamera(camera, lens, rig);
  computeRigFrame(lens, rig, anchor, _worldEye, _worldTarget, _frameUp);
  applyFrame(camera, _worldEye, _worldTarget, _frameUp);
}

const _eyeFrom = new THREE.Vector3();
const _targetFrom = new THREE.Vector3();
const _upFrom = new THREE.Vector3();

/**
 * Camera under the ACTIVE rig, easing any in-flight retarget by blending whole
 * frames — quantized→continuous, side→top-down, anything→anything, one move.
 */
export function applyActiveRigTransform(camera: THREE.Camera, lens: SideLens, dt: number): void {
  if (rigBlend < 1) {
    rigBlend = rigSeconds > 0 ? Math.min(1, rigBlend + dt / rigSeconds) : 1;
  }
  _up.copy(lens.up).normalize();
  const anchor = rigAnchorFromCamera(camera, lens, rigTo);
  if (rigBlend >= 1) {
    computeRigFrame(lens, rigTo, anchor, _worldEye, _worldTarget, _frameUp);
  } else {
    const k = smoothstep(rigBlend);
    computeRigFrame(lens, rigFrom, anchor, _eyeFrom, _targetFrom, _upFrom);
    computeRigFrame(lens, rigTo, anchor, _worldEye, _worldTarget, _frameUp);
    _worldEye.lerpVectors(_eyeFrom, _worldEye, k);
    _worldTarget.lerpVectors(_targetFrom, _worldTarget, k);
    _frameUp.lerpVectors(_upFrom, _frameUp, k).normalize();
  }
  applyFrame(camera, _worldEye, _worldTarget, _frameUp);
}

const _overheadFwd = new THREE.Vector3();
const _overheadUp = new THREE.Vector3();

/**
 * The survey chart ([M] map view): a straight-down overhead of wherever the
 * player stands — the nav era's vantage retained as a tool. `screenUp` is the
 * chart's rolled frame (see mapView.syncChartScreenUp): a face tangent that
 * parallel-transports across cube edges, so the chart stays axis-aligned to
 * the face plane AND continuous when the face changes, never rotating with
 * the player's look direction. Standalone (no lens frame needed — works in
 * plain sandbox).
 */
export function applyOverheadCameraTransform(
  camera: THREE.Camera,
  surfaceUp: THREE.Vector3,
  screenUp: THREE.Vector3,
  height: number
): void {
  _up.copy(surfaceUp).normalize();
  const parent = camera.parent;
  if (parent) {
    parent.updateWorldMatrix(true, false);
    parent.getWorldPosition(_parentPos);
  } else {
    camera.getWorldPosition(_parentPos).addScaledVector(_up, -height);
  }
  _worldEye.copy(_parentPos).addScaledVector(_up, height);
  _worldTarget.copy(_parentPos);
  _overheadFwd.copy(screenUp).addScaledVector(_up, -screenUp.dot(_up));
  if (_overheadFwd.lengthSq() < 1e-6) _overheadFwd.set(1, 0, 0);
  _overheadUp.copy(_overheadFwd).normalize();
  applyFrame(camera, _worldEye, _worldTarget, _overheadUp);
}

/**
 * Side-view camera: offset from the player along +depthAxis, looking back at
 * the player — the classic profile rig.
 */
export function applySideCameraTransform(
  camera: THREE.Camera,
  lens: SideLens,
  distance = SIDE_CAMERA_DISTANCE,
  lift = SIDE_CAMERA_LIFT,
  focusLift = SIDE_CAMERA_FOCUS_LIFT
): void {
  applyRigCameraTransform(camera, lens, { ...SIDE_RIG, distance, lift, focusLift });
}

const _blendPosA = new THREE.Vector3();
const _blendPosB = new THREE.Vector3();
const _blendQuatA = new THREE.Quaternion();
const _blendQuatB = new THREE.Quaternion();

/**
 * The 2D→3D lift: blend between the CURRENT rig vantage (blend 0 — iso by the
 * time the lift fires) and the first-person gravity camera (blend 1). Computes
 * BOTH pure transforms and interpolates position/orientation — at the endpoints
 * it matches each source transform exactly (unit-tested), so the handovers on
 * either side are seamless.
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
    applyRigCameraTransform(camera, lens, rigTo);
    return;
  }
  if (k >= 1) {
    applyGravityCameraTransform(camera, surfaceUp, surfaceForward, pitch, eyeHeight);
    return;
  }
  applyRigCameraTransform(camera, lens, rigTo);
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
 * Side-lens extraction probes: extraction never digs the row it WALKS. All
 * ground-level candidates sit in the rows ±1 off the work line (one voxel
 * along the depth axis), so the walked plane stays pristine; same-row probes
 * are above ground only (waist/head — breaking those leaves no holes).
 * `out` must hold ≥ 6 vectors.
 *
 * THIS SET IS SHARED BY THE SCREENING AND THE PLAYER, and that is the whole
 * point. It began as a movie-only guard, but the hazard it removes was never
 * specific to the movie: the human probe set below carries an UNDERFOOT
 * candidate, so a player who does exactly what the ch1-fixed work order tells
 * them ("EXTRACT: HOLD [E]") while standing still mines the block they are
 * standing on, drops one voxel, and repeats — burying themselves in a shaft
 * under a fixed camera that looks at them side-on, where the pit barely
 * reads. `storyInputPolicy` already names this hazard for ch1-depth ("a
 * held/latched harvest key must not dig up the row") but only ch1-depth was
 * given the guard. Routing both actors through the off-row set makes the
 * pothole structurally impossible instead of policy-dependent.
 */
export function sideHarvestProbePointsOffRow(
  position: THREE.Vector3,
  lens: SideLens,
  facing: 1 | -1,
  out: THREE.Vector3[]
): THREE.Vector3[] {
  const t = lens.travelAxis;
  const u = lens.up;
  const dAx = lens.depthAxis;
  const row = VOXEL_SCALE;
  let i = 0;
  const push = (alongTravel: number, alongUp: number, alongDepth: number) => {
    out[i++].copy(position)
      .addScaledVector(t, alongTravel * facing)
      .addScaledVector(u, alongUp)
      .addScaledVector(dAx, alongDepth);
  };
  push(1.6, -1.8, row);  // ahead at ground, row behind the plane
  push(1.6, -1.8, -row); // ahead at ground, row in front
  push(0, -1.8, row);    // beside at ground, row behind
  push(0, -1.8, -row);   // beside at ground, row in front
  push(1.6, -0.4, 0);    // ahead at waist (same row, above ground — no hole)
  push(1.6, 1.4, 0);     // ahead at head height (same row, above ground)
  return out;
}

