import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { pickNearestFlora, type FloraPickProxyTarget } from './floraPicking.ts';

function target(
  kind: FloraPickProxyTarget['kind'],
  positions: Array<[number, number, number]>
): FloraPickProxyTarget {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.4, 0.8, 0.4),
    new THREE.MeshBasicMaterial(),
    positions.length
  );
  const matrix = new THREE.Matrix4();
  positions.forEach((position, index) => {
    matrix.makeTranslation(position[0], position[1], position[2]);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.count = positions.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.updateMatrixWorld(true);
  return {
    kind,
    mesh,
    slotVoxel: positions.map(position => [...position] as [number, number, number])
  };
}

describe('flora pick proxies', () => {
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, 0, 1));

  it('returns the nearest visible canonical instance and its slot identity', () => {
    const flower = target('flower', [[0, 0, 5], [0, 0, 8]]);
    const shrub = target('shrub', [[0, 0, 6]]);

    expect(pickNearestFlora(ray, [shrub, flower], 10, () => false)).toMatchObject({
      kind: 'flower',
      coord: [0, 0, 5]
    });
  });

  it('ignores hidden, harvested, off-axis, and out-of-reach plants', () => {
    const hidden = target('cactus', [[0, 0, 2]]);
    hidden.mesh.visible = false;
    const harvested = target('fan', [[0, 0, 3]]);
    const offAxis = target('flower', [[3, 0, 4]]);
    const distant = target('seedhead', [[0, 0, 12]]);

    expect(pickNearestFlora(
      ray,
      [hidden, harvested, offAxis, distant],
      8,
      (x, y, z) => x === 0 && y === 0 && z === 3
    )).toBeNull();
  });
});
