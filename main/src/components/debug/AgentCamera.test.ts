import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MaterialType, materialId } from '../../types/materials';
import { topVoxelMaterialPos } from './AgentCamera';

function materialMesh(entries: Array<{ material: MaterialType; y: number }>): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
    entries.length
  );
  const matrix = new THREE.Matrix4();
  const data = new THREE.InstancedBufferAttribute(new Float32Array(entries.length * 2), 2);
  entries.forEach((entry, index) => {
    matrix.makeTranslation(index, entry.y, 0);
    mesh.setMatrixAt(index, matrix);
    data.setXY(index, materialId(entry.material), 0);
  });
  mesh.geometry.setAttribute('aInstanceData', data);
  return mesh;
}

describe('topVoxelMaterialPos', () => {
  it('frames the highest matching material rather than the highest voxel', () => {
    const mesh = materialMesh([
      { material: MaterialType.ICE, y: 3 },
      { material: MaterialType.STONE, y: 9 },
      { material: MaterialType.ICE, y: 6 }
    ]);
    const out = new THREE.Vector3();

    expect(topVoxelMaterialPos(mesh, [materialId(MaterialType.ICE)], out)).toBe(true);
    expect(out.toArray()).toEqual([2, 6, 0]);
  });

  it('supports material families, unfiltered views, and absent materials', () => {
    const mesh = materialMesh([
      { material: MaterialType.COPPER, y: 4 },
      { material: MaterialType.GOLD, y: 7 },
      { material: MaterialType.STONE, y: 10 }
    ]);
    const out = new THREE.Vector3();
    const ores = [
      materialId(MaterialType.COPPER),
      materialId(MaterialType.GOLD),
      materialId(MaterialType.SILVER)
    ];

    expect(topVoxelMaterialPos(mesh, ores, out)).toBe(true);
    expect(out.toArray()).toEqual([1, 7, 0]);
    expect(topVoxelMaterialPos(mesh, [], out)).toBe(true);
    expect(out.toArray()).toEqual([2, 10, 0]);
    expect(topVoxelMaterialPos(mesh, [materialId(MaterialType.CRYSTAL)], out)).toBe(false);
  });
});
