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
  it('aims at reachable trunk above a loose stone in front of its base', () => {
    // Representative geometry for the captured stop at [1.86,50.79,11.56]:
    // the old low-ring ray selected Loose Stone and collection stayed idle.
    const trunk = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(.3, .4, 4, 8, 4).translate(0, 2, 0),
      new THREE.MeshBasicMaterial(), 1);
    trunk.name = 'trunk';
    trunk.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-2, 48.95, -12));
    trunk.updateMatrixWorld(true);
    const stone = new THREE.Mesh(new THREE.SphereGeometry(.65), new THREE.MeshBasicMaterial());
    stone.name = 'loose stone';
    stone.position.set(-1.75, 50.3, -12.4);
    stone.updateMatrixWorld(true);
    const plan = planConstructionTree([{ mesh: trunk, slotVoxel: [[-1, 24, -6]] }],
      new THREE.Vector3(18, 50.9, -12), new THREE.Vector3(0, 50.9, -12), terrain, 50, () => false);
    expect(plan).not.toBeNull();
    const eye = new THREE.Vector3(-.14, 52.35, -14.44);
    const ray = new THREE.Raycaster(eye, plan!.aim.clone().sub(eye).normalize(), 0, 6);
    expect(ray.intersectObjects([trunk, stone], false)[0]?.object.name).toBe('trunk');
  });
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
