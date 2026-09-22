import * as THREE from 'three';
import type { RapierContext, RapierRigidBody } from '@react-three/rapier';
import {
  GROUND_NORMAL_MIN_DOT,
  GROUND_PROBE_LENGTH,
  GROUND_PROBE_LIFT,
  PLAYER_CAPSULE_HALF_HEIGHT,
  PLAYER_CAPSULE_RADIUS,
  VOXEL_SCALE
} from './cubeGravityConstants';

export const STEP_UP_HEIGHT = VOXEL_SCALE;
export const STEP_PROBE_FORWARD = PLAYER_CAPSULE_RADIUS + 1.15;
// The capsule's lower sphere catches shallow lips below the old shin ray.
// Dry steps and fluid mantles use the same lower-sphere probe; headroom,
// maximum height and landing support still constrain every step.
const STEP_PROBE_LOW_OFFSET = -PLAYER_CAPSULE_HALF_HEIGHT;

/** Query an ordinary one-voxel step, with clear headroom and real support. */
export function canStepUp(
  world: RapierContext['world'],
  rapier: RapierContext['rapier'],
  body: RapierRigidBody | null,
  position: THREE.Vector3,
  up: THREE.Vector3,
  moveDirection: THREE.Vector3
): boolean {
  if (!body || moveDirection.lengthSq() < 0.0001) return false;
  const forward = moveDirection.clone().normalize();
  const lowOrigin = position.clone().addScaledVector(up, STEP_PROBE_LOW_OFFSET);
  const highOrigin = lowOrigin.clone().addScaledVector(up, STEP_UP_HEIGHT);
  const lowRay = new rapier.Ray(lowOrigin, forward);
  const highRay = new rapier.Ray(highOrigin, forward);
  const lowHit = world.castRayAndGetNormal(lowRay, STEP_PROBE_FORWARD, true, undefined, undefined, undefined, body);
  if (!lowHit) return false;
  const highHit = world.castRayAndGetNormal(highRay, STEP_PROBE_FORWARD, true, undefined, undefined, undefined, body);
  if (highHit) return false;
  const groundProbeOrigin = position.clone()
    .addScaledVector(up, STEP_UP_HEIGHT + GROUND_PROBE_LIFT)
    .addScaledVector(forward, STEP_PROBE_FORWARD);
  const groundRay = new rapier.Ray(groundProbeOrigin, up.clone().negate());
  const groundHit = world.castRayAndGetNormal(groundRay, GROUND_PROBE_LENGTH + STEP_UP_HEIGHT, true, undefined, undefined, undefined, body);
  if (!groundHit) return false;
  const normal = new THREE.Vector3(groundHit.normal.x, groundHit.normal.y, groundHit.normal.z).normalize();
  return normal.dot(up) >= GROUND_NORMAL_MIN_DOT;
}
