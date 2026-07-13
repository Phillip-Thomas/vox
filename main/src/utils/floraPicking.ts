import * as THREE from 'three';
import type { FloraHarvestKind } from '../game/data/floraHarvest.ts';

/** Extra world-space forgiveness around animated foliage silhouettes. */
export const FLORA_PICK_RADIUS_PADDING = 0.18;
/** Small flowers remain comfortably targetable without using dense triangle rays. */
export const FLORA_PICK_MIN_RADIUS = 0.45;

export interface FloraPickProxyTarget {
  kind: FloraHarvestKind;
  mesh: THREE.InstancedMesh;
  slotVoxel: Array<[number, number, number]>;
}

export interface FloraProxyHit {
  kind: FloraHarvestKind;
  coord: [number, number, number];
  distance: number;
}

const _instance = new THREE.Matrix4();
const _worldMatrix = new THREE.Matrix4();
const _center = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _toCenter = new THREE.Vector3();

/**
 * Raycast the coarse bounding-sphere proxy of each visible flora instance.
 *
 * Flora geometry contains many merged stems/leaves; Three's ordinary
 * InstancedMesh raycast repeats a triangle test for every instance. This keeps
 * aiming proportional to instance count with only matrix/vector math while the
 * stable slot-to-voxel map remains the gameplay identity.
 */
export function pickNearestFlora(
  ray: THREE.Ray,
  targets: readonly FloraPickProxyTarget[],
  maxDistance: number,
  isHarvested: (x: number, y: number, z: number) => boolean
): FloraProxyHit | null {
  let best: FloraProxyHit | null = null;
  let bestDistance = maxDistance;

  for (const target of targets) {
    const mesh = target.mesh;
    if (!mesh.visible || mesh.count <= 0) continue;
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const sphere = mesh.geometry.boundingSphere;
    if (!sphere) continue;

    for (let slot = 0; slot < mesh.count; slot++) {
      const coord = target.slotVoxel[slot];
      if (!coord || isHarvested(coord[0], coord[1], coord[2])) continue;

      mesh.getMatrixAt(slot, _instance);
      _worldMatrix.multiplyMatrices(mesh.matrixWorld, _instance);
      _center.copy(sphere.center).applyMatrix4(_worldMatrix);
      _scale.setFromMatrixScale(_worldMatrix);
      const radius = Math.max(
        FLORA_PICK_MIN_RADIUS,
        sphere.radius * Math.max(_scale.x, _scale.y, _scale.z) + FLORA_PICK_RADIUS_PADDING
      );

      _toCenter.subVectors(_center, ray.origin);
      const projected = _toCenter.dot(ray.direction);
      if (projected + radius < 0 || projected - radius > bestDistance) continue;
      const perpendicularSq = Math.max(0, _toCenter.lengthSq() - projected * projected);
      const radiusSq = radius * radius;
      if (perpendicularSq > radiusSq) continue;
      const hitDistance = Math.max(0, projected - Math.sqrt(radiusSq - perpendicularSq));
      if (hitDistance > bestDistance) continue;

      bestDistance = hitDistance;
      best = { kind: target.kind, coord, distance: hitDistance };
    }
  }

  return best;
}
