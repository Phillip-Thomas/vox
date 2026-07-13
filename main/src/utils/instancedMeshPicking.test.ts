import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { commitRaycastInstanceTransforms } from './instancedMeshPicking.ts';

describe('commitRaycastInstanceTransforms', () => {
  it('refreshes the cached InstancedMesh bounds after streamed instances move', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    const transform = new THREE.Matrix4();
    const raycaster = new THREE.Raycaster();

    mesh.setMatrixAt(0, transform.makeTranslation(0, 0, 0));
    commitRaycastInstanceTransforms(mesh, 1);
    raycaster.set(new THREE.Vector3(0, 0, 4), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(mesh, false)).toHaveLength(2);

    // Three does not invalidate InstancedMesh.boundingSphere from setMatrixAt.
    // Without the commit below this visible instance is rejected by the old
    // object-level sphere and produces zero intersections.
    mesh.setMatrixAt(0, transform.makeTranslation(100, 0, 0));
    raycaster.set(new THREE.Vector3(100, 0, 4), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(mesh, false)).toHaveLength(0);

    commitRaycastInstanceTransforms(mesh, 1);
    const hits = raycaster.intersectObject(mesh, false);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.instanceId).toBe(0);

    geometry.dispose();
    material.dispose();
  });
});
