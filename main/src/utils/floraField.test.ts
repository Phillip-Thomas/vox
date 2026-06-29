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
  createFloraMaterial,
  floraKindId,
  isFloraEligibleVoxel,
  shouldPlaceFloraVoxel,
  updateFloraMaterial,
  type FloraProfile
} from './floraField.ts';
import { QUALITY_PROFILES } from '../config/graphicsSettings.ts';
import { VOXEL_REALITY_PRESETS } from '../game/systems/realityRenderSystem.ts';

const grass = new THREE.Color(0x7cb342);
const dirt = new THREE.Color(0x8b4513);
const sand = new THREE.Color(0xc2b280);
const VERDANT_SEED = 3215739679;
const ARID_SEED = 787428812;

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

  it('uses one lit flora material program with species driven by uniforms', () => {
    const profile = buildFloraProfile(12345);
    const keys = new Set<string>();
    for (const kind of FLORA_KINDS) {
      const material = createFloraMaterial(kind, profile);
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(material.vertexColors).toBe(true);
      expect(material.roughness).toBeGreaterThan(0.7);
      expect(material.customProgramCacheKey()).toBe('flora-field-v2');
      expect(floraKindId(kind)).toBeGreaterThanOrEqual(0);
      keys.add(material.customProgramCacheKey());
      material.dispose();
    }
    expect(keys.size).toBe(1);
  });

  it('updates flora reality and sun/moon uniforms when the shader is live', () => {
    const material = createFloraMaterial('flower', buildFloraProfile(12345));
    const uniforms = {
      uTime: { value: 0 },
      uFloraVisibility: { value: 1 },
      uFloraMotion: { value: 1 },
      uFloraChroma: { value: 1 },
      uSunDir: { value: new THREE.Vector3() },
      uMoonDir: { value: new THREE.Vector3() }
    };
    material.userData.shader = { uniforms };

    updateFloraMaterial(
      material,
      8,
      QUALITY_PROFILES.HIGH,
      VOXEL_REALITY_PRESETS.material,
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(0, -3, 0)
    );

    expect(uniforms.uTime.value).toBe(8);
    expect(uniforms.uFloraMotion.value).toBeGreaterThan(0);
    expect(uniforms.uFloraVisibility.value).toBeGreaterThan(0);
    expect(uniforms.uSunDir.value.length()).toBeCloseTo(1);
    expect(uniforms.uMoonDir.value.length()).toBeCloseTo(1);
    material.dispose();
  });

  it('places deterministic flora and builds matching instances for the selected kind', () => {
    const seed = VERDANT_SEED;
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

  it('uses planet ecology to reject out-of-biome placement', () => {
    const profile = fullCoverageProfile(ARID_SEED);
    expect(shouldPlaceFloraVoxel({ material: MaterialType.GRASS }, 0, 25, 0, 10, ARID_SEED, profile)).toBe(false);
    expect(shouldPlaceFloraVoxel({ material: MaterialType.SAND }, 0, 25, 0, 10, ARID_SEED, profile)).toBe(true);
  });
});
