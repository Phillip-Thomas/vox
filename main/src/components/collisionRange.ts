import * as THREE from 'three';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants.ts';

// --- Collision streaming range -------------------------------------------------------
//
// Whether a voxel is close enough to the player to carry a physics body. Pure,
// allocation-free, and identical in arithmetic to the predicate it was lifted
// out of `EfficientPlanet`: it is evaluated for EVERY exposed voxel on every
// collision resync (each unit of player movement), which is why the original —
// a fresh Vector3 per voxel and a cloned gravity vector — cost ~170ms of main
// thread plus GC in a cold-boot profile.

export interface CollisionRangeScratch {
  offset: THREE.Vector3;
  gravity: THREE.Vector3;
}

export function createCollisionRangeScratch(): CollisionRangeScratch {
  return { offset: new THREE.Vector3(), gravity: new THREE.Vector3() };
}

/**
 * Within `streamRange` of the player, a voxel gets a body once it is at least
 * `minDistance` away; nearer than that, only voxels that could SUPPORT the
 * player (0.4–5 units below along gravity) do, so the body never collides with
 * the ground it is standing inside during spawn settle.
 */
export function withinCollisionRange(
  x: number,
  y: number,
  z: number,
  playerPosition: THREE.Vector3 | null,
  surfaceUp: THREE.Vector3,
  streamRange: number,
  minDistance: number,
  scratch: CollisionRangeScratch
): boolean {
  if (!playerPosition) return true;
  const offset = voxelCoordToWorld(x, y, z, scratch.offset).sub(playerPosition);
  const distanceSq = offset.lengthSq();
  if (distanceSq > streamRange * streamRange) return false;
  const distance = Math.sqrt(distanceSq);
  if (distance >= minDistance) return true;
  const gravityDirection = scratch.gravity.copy(surfaceUp).multiplyScalar(-1);
  const supportDistance = offset.dot(gravityDirection);
  return supportDistance > 0.4 && supportDistance < 5;
}
