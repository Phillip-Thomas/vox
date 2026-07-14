import * as THREE from 'three';

// --- Cinematic look pull -------------------------------------------------------
//
// During staged sun events (the first dusk, the A3 dawn) the story briefly takes
// the camera: CameraControls' free-look path reads this weight each frame and,
// while it is > 0, steers the look toward a target — a WORLD POSITION when one
// is set (the autopilot aiming at the stone/tree/fire), else the LIVE sun
// direction (the director drives the forced day phase, so the sun is exactly
// where the scene wants it). Mouse input keeps flowing underneath — as the
// weight decays, the player's own hand wins back the camera with no snap.

let weight = 0;
const targetValue = new THREE.Vector3();
let target: THREE.Vector3 | null = null;

export type CinematicGazeMode = 'travel' | 'inspect' | 'ambient' | 'interact';

/** Semantic look request used by autonomous actors. Unlike a raw world target,
 * this preserves the subject's surface frame and the route's first segment so
 * CameraControls can resolve a natural horizon against its visually rolled up. */
export interface CinematicGazeIntent {
  goal: THREE.Vector3;
  goalUp: THREE.Vector3 | null;
  routeDirection: THREE.Vector3 | null;
  subjectLift: number;
  mode: CinematicGazeMode;
  elapsed: number;
  seed: number;
}

const gazeIntent: CinematicGazeIntent = {
  goal: new THREE.Vector3(),
  goalUp: null,
  routeDirection: null,
  subjectLift: 0,
  mode: 'travel',
  elapsed: 0,
  seed: 0
};
let hasGazeIntent = false;

export interface CinematicCameraPose {
  eye: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
  weight: number;
}

const cameraPose: CinematicCameraPose = {
  eye: new THREE.Vector3(),
  target: new THREE.Vector3(),
  up: new THREE.Vector3(0, 1, 0),
  weight: 0
};

export function setCinematicLookWeight(value: number): void {
  weight = Math.min(1, Math.max(0, value));
}

export function getCinematicLookWeight(): number {
  return weight;
}

/** World position to steer toward; null = the sun direction. */
export function setCinematicLookTarget(position: THREE.Vector3 | null): void {
  target = position ? targetValue.copy(position) : null;
}

export function getCinematicLookTarget(): THREE.Vector3 | null {
  return target;
}

export function setCinematicGazeIntent(intent: Partial<CinematicGazeIntent> & Pick<CinematicGazeIntent, 'goal'> | null): void {
  if (!intent) {
    hasGazeIntent = false;
    return;
  }
  gazeIntent.goal.copy(intent.goal);
  gazeIntent.goalUp = intent.goalUp
    ? (gazeIntent.goalUp ?? new THREE.Vector3()).copy(intent.goalUp).normalize()
    : null;
  gazeIntent.routeDirection = intent.routeDirection
    ? (gazeIntent.routeDirection ?? new THREE.Vector3()).copy(intent.routeDirection)
    : null;
  gazeIntent.subjectLift = intent.subjectLift ?? 0;
  gazeIntent.mode = intent.mode ?? 'travel';
  gazeIntent.elapsed = intent.elapsed ?? 0;
  gazeIntent.seed = intent.seed ?? 0;
  hasGazeIntent = true;
}

export function getCinematicGazeIntent(): Readonly<CinematicGazeIntent> | null {
  return hasGazeIntent ? gazeIntent : null;
}

/**
 * Optional authored world-space camera pose. Weight 0 is exactly inert; weight 1
 * is the authored frame. Keeping this beside the look-pull gives story scenes a
 * reset-safe boom without changing the player's rigid body or persisted look.
 */
export function setCinematicCameraPose(
  eye: THREE.Vector3,
  poseTarget: THREE.Vector3,
  up: THREE.Vector3,
  poseWeight: number
): void {
  cameraPose.eye.copy(eye);
  cameraPose.target.copy(poseTarget);
  cameraPose.up.copy(up).normalize();
  cameraPose.weight = Math.min(1, Math.max(0, poseWeight));
}

export function clearCinematicCameraPose(): void {
  cameraPose.weight = 0;
}

export function getCinematicCameraPose(): Readonly<CinematicCameraPose> {
  return cameraPose;
}

const _baseEye = new THREE.Vector3();
const _blendedEye = new THREE.Vector3();
const _parentPosition = new THREE.Vector3();
const _parentQuaternion = new THREE.Quaternion();
const _parentInverse = new THREE.Quaternion();
const _baseWorldQuaternion = new THREE.Quaternion();
const _poseWorldQuaternion = new THREE.Quaternion();
const _blendedWorldQuaternion = new THREE.Quaternion();
const _localQuaternion = new THREE.Quaternion();
const _lookMatrix = new THREE.Matrix4();

/** Blend the live camera toward the authored pose in world space. */
export function applyCinematicCameraPose(
  camera: THREE.Camera,
  pose: Readonly<CinematicCameraPose> = cameraPose
): boolean {
  const k = Math.min(1, Math.max(0, pose.weight));
  if (k <= 0) return false;

  camera.getWorldPosition(_baseEye);
  camera.getWorldQuaternion(_baseWorldQuaternion);
  _lookMatrix.lookAt(pose.eye, pose.target, pose.up);
  _poseWorldQuaternion.setFromRotationMatrix(_lookMatrix);
  _blendedEye.lerpVectors(_baseEye, pose.eye, k);
  _blendedWorldQuaternion.slerpQuaternions(_baseWorldQuaternion, _poseWorldQuaternion, k);

  const parent = camera.parent;
  if (parent) {
    parent.updateWorldMatrix(true, false);
    parent.getWorldPosition(_parentPosition);
    parent.getWorldQuaternion(_parentQuaternion);
    _parentInverse.copy(_parentQuaternion).invert();
    camera.position.copy(_blendedEye).sub(_parentPosition).applyQuaternion(_parentInverse);
    _localQuaternion.copy(_parentInverse).multiply(_blendedWorldQuaternion);
    camera.quaternion.copy(_localQuaternion);
  } else {
    camera.position.copy(_blendedEye);
    camera.quaternion.copy(_blendedWorldQuaternion);
  }
  camera.updateMatrixWorld(true);
  return true;
}
