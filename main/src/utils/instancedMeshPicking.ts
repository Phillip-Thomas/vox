import * as THREE from 'three';

/**
 * Commit mutated instance transforms for meshes that participate in raycasting.
 *
 * Three caches an InstancedMesh-level bounding sphere the first time it is
 * raycast. setMatrixAt() and count changes do not invalidate that cache, so a
 * streamed/rebucketed instance can render at its new position while raycasting
 * still rejects it against the old bounds. Recompute eagerly at the same point
 * that the instance buffer is published so rendering and picking share one
 * spatial snapshot.
 */
export function commitRaycastInstanceTransforms(
  mesh: THREE.InstancedMesh,
  count: number
): void {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}
