import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { planConstructionTree } from './constructionTreePlan.ts';
import type { TreePickTarget } from '../../components/TreeField.tsx';
import type { SpawnTerrainQuery } from '../../utils/spawnValidation.ts';

const terrain: SpawnTerrainQuery = {
  shouldVoxelExist: (x, y, z) => Math.abs(x) <= 24 && Math.abs(z) <= 24 && y <= 24,
  isWaterVoxel: () => false,
  generateBlockForPosition: () => 'grass'
};
function trees(coords: Array<[number, number, number]>): TreePickTarget[] {
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.3, .4, 4), new THREE.MeshBasicMaterial(), coords.length);
  for (const [index, coord] of coords.entries()) mesh.setMatrixAt(index,
    new THREE.Matrix4().makeTranslation(coord[0] * 2, coord[1] * 2 + .95, coord[2] * 2));
  return [{ mesh, slotVoxel: coords }];
}
describe('construction collection round trip', () => {
  it('keeps the trip near its chosen home rather than chasing the nearest next tree around the cube', () => {
    const plan = planConstructionTree(trees([[16, 24, -6], [-1, 24, -6], [25, 12, -6]]),
      new THREE.Vector3(18, 50.9, -12), new THREE.Vector3(0, 50.9, -12), terrain, 50, () => false);
    expect(plan?.coord).toEqual([-1, 24, -6]);
    expect(plan!.aim.y).toBeGreaterThan(plan!.root.y + 1.5);
    expect(plan!.approach.distanceTo(plan!.root)).toBeLessThan(5);
  });
  it('never selects a felled tree or an unavailable cross-face substitute', () => {
    const plan = planConstructionTree(trees([[-1, 24, -6], [25, 12, -6]]),
      new THREE.Vector3(0, 50.9, -12), new THREE.Vector3(0, 50.9, -12), terrain, 50, x => x === -1);
    expect(plan).toBeNull();
  });
});
