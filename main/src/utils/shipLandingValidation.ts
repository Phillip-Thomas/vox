import * as THREE from 'three';
import type { ValidatedSpawnSite } from './spawnValidation.ts';
import {
  COLLIDER_HALF_EXTENT,
  voxelCoordToWorld
} from './cubeGravityConstants.ts';

/**
 * Rapier's voxel colliders stop just inside the rendered two-unit cube. Keep
 * this tolerance small enough that a floor panel, mesa block, or tree collider
 * sitting above the terrain cannot masquerade as the procedural support face.
 */
const SURFACE_PLANE_TOLERANCE = 0.06;
const TERRAIN_NORMAL_MIN_DOT = 0.995;

/**
 * Prove that a landing ray hit the same procedural voxel face selected by the
 * dry/flat spawn validator.
 *
 * Rapier's world contains other fixed colliders (player structures, the story
 * mesa, and tree trunks). The terrain query intentionally knows nothing about
 * those props, so a valid pad below one is not by itself sufficient: the ray
 * contact must also coincide with that pad's actual voxel-collider face.
 */
export function landingHitMatchesValidatedTerrain(
  contactPoint: THREE.Vector3,
  contactNormal: THREE.Vector3,
  site: ValidatedSpawnSite
): boolean {
  if (contactNormal.lengthSq() < 1e-8 || site.up.lengthSq() < 1e-8) return false;

  const normal = contactNormal.clone().normalize();
  const up = site.up.clone().normalize();
  if (normal.dot(up) < TERRAIN_NORMAL_MIN_DOT) return false;

  const supportCenter = voxelCoordToWorld(
    site.supportVoxel.x,
    site.supportVoxel.y,
    site.supportVoxel.z
  );
  const fromSupportCenter = contactPoint.clone().sub(supportCenter);
  const outwardDistance = fromSupportCenter.dot(up);
  if (
    Math.abs(outwardDistance - COLLIDER_HALF_EXTENT)
    > SURFACE_PLANE_TOLERANCE
  ) {
    return false;
  }

  // The contact must also land inside this voxel's face, not merely on the same
  // infinite plane (for example, a neighbouring structure's coplanar panel).
  fromSupportCenter.addScaledVector(up, -outwardDistance);
  const tangentLimit = COLLIDER_HALF_EXTENT + SURFACE_PLANE_TOLERANCE;
  return Math.max(
    Math.abs(fromSupportCenter.x),
    Math.abs(fromSupportCenter.y),
    Math.abs(fromSupportCenter.z)
  ) <= tangentLimit;
}
