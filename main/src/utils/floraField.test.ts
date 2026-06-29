import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MaterialType } from '../types/materials.ts';
import { voxelSystem } from './efficientVoxelSystem.ts';
import {
  FLORA_KINDS,
  buildFloraInstances,
  buildFloraProfile,
  chooseFloraKindForVoxel,
  countFloraVoxels,
  createFloraGeometry,
  isFloraEligibleVoxel,
  shouldPlaceFloraVoxel,
  type FloraProfile
} from './floraField.ts';

const grass = new THREE.Color(0x7cb342);
const dirt = new THREE.Color(0x8b4513);
const sand = new THREE.Color(0xc2b280);

afterEach(() => {
  voxelSystem.reset();
});

function fullCoverageProfile(seed: number): FloraProfile {
  return {
    ...buildFloraProfile(seed),
    coverage: 1,
    densityMul: 10
  };
}

describe('floraField', () => {
  it('builds deterministic biome and wind aware flora profiles', () => {
    const a = buildFloraProfile(12345);
    const b = buildFloraProfile(12345);
    expect(a.densityMul).toBe(b.densityMul);
    expect(a.coverage).toBe(b.coverage);
    expect(a.wind.direction.x).toBe(b.wind.direction.x);
    expect(FLORA_KINDS.every(kind => a.weights[kind] > 0)).toBe(true);
  });

  it('only decorates eligible surface materials', () => {
    expect(isFloraEligibleVoxel({ material: MaterialType.GRASS })).toBe(true);
    expect(isFloraEligibleVoxel({ material: MaterialType.DIRT })).toBe(true);
    expect(isFloraEligibleVoxel({ material: MaterialType.SAND })).toBe(true);
    expect(isFloraEligibleVoxel({ material: MaterialType.STONE })).toBe(false);
    expect(isFloraEligibleVoxel({ material: MaterialType.GRASS, supportsSurfaceResources: false })).toBe(false);
  });

  it('creates every flora archetype with vertex color and wind flex attributes', () => {
    const profile = buildFloraProfile(12345);
    for (const kind of FLORA_KINDS) {
      const geometry = createFloraGeometry(kind, profile);
      expect(geometry.attributes.position.count).toBeGreaterThan(0);
      expect(geometry.attributes.color.count).toBe(geometry.attributes.position.count);
      expect(geometry.attributes.aFloraFlex.count).toBe(geometry.attributes.position.count);
      geometry.dispose();
    }
  });

  it('places deterministic flora and builds matching instances for the selected kind', () => {
    const seed = 12345;
    const profile = fullCoverageProfile(seed);
    voxelSystem.addVoxel(0, 25, 0, MaterialType.GRASS, grass);
    voxelSystem.addVoxel(1, 25, 0, MaterialType.DIRT, dirt);
    voxelSystem.addVoxel(2, 25, 0, MaterialType.SAND, sand);
    voxelSystem.addVoxel(3, 25, 0, MaterialType.STONE, new THREE.Color(0x808080));

    const eligible = Array.from(voxelSystem.getAllVoxels().values())
      .filter(voxel => {
        const [x, y, z] = voxel.position;
        return shouldPlaceFloraVoxel(voxel, x, y, z, 10, seed, profile);
      });
    expect(eligible).toHaveLength(3);

    const [x, y, z] = eligible[0].position;
    const selectedKind = chooseFloraKindForVoxel(eligible[0], x, y, z, seed, profile);
    const expectedCount = countFloraVoxels(selectedKind, 10, seed, profile);
    expect(expectedCount).toBeGreaterThan(0);

    const geometry = createFloraGeometry(selectedKind, profile);
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 8);
    const result = buildFloraInstances(selectedKind, mesh, 10, 0, null, seed, profile);

    expect(result.count).toBe(expectedCount);
    expect(mesh.count).toBe(expectedCount);

    geometry.dispose();
    material.dispose();
  });
});
