import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { QUALITY_PROFILES } from '../config/graphicsSettings.ts';
import { VOXEL_REALITY_PRESETS } from '../game/systems/realityRenderSystem.ts';
import { createVoxelMaterial, updateVoxelMaterial } from './voxelMaterial.ts';

describe('voxelMaterial', () => {
  it('keeps one shared lit voxel shader program', () => {
    const material = createVoxelMaterial();

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.customProgramCacheKey()).toBe('voxel-pbr-v6');
    expect(material.roughness).toBeGreaterThan(0.9);

    material.dispose();
  });

  it('updates quality, reality, and sun/moon uniforms without recompiling variants', () => {
    const material = createVoxelMaterial();
    const uniforms = {
      uTime: { value: 0 },
      uAnimated: { value: 1 },
      uTriplanar: { value: 1 },
      uAO: { value: 1 },
      uRealityChroma: { value: 1 },
      uRealityDetail: { value: 1 },
      uRealityOrganic: { value: 1 },
      uRealityAtmosphere: { value: 1 },
      uRealityThermal: { value: 1 },
      uRealityCrystalline: { value: 1 },
      uRealityMetal: { value: 1 },
      uSunDir: { value: new THREE.Vector3() },
      uMoonDir: { value: new THREE.Vector3() }
    };
    material.userData.shader = { uniforms };

    updateVoxelMaterial(
      material,
      12,
      QUALITY_PROFILES.HIGH,
      VOXEL_REALITY_PRESETS.alive,
      new THREE.Vector3(0, 3, 0),
      new THREE.Vector3(0, -2, 0)
    );

    expect(uniforms.uTime.value).toBe(12);
    expect(uniforms.uAnimated.value).toBe(1);
    expect(uniforms.uTriplanar.value).toBe(1);
    expect(uniforms.uAO.value).toBe(1);
    expect(uniforms.uRealityOrganic.value).toBeGreaterThan(0);
    expect(uniforms.uSunDir.value.length()).toBeCloseTo(1);
    expect(uniforms.uMoonDir.value.length()).toBeCloseTo(1);

    updateVoxelMaterial(material, 13, QUALITY_PROFILES.POTATO, VOXEL_REALITY_PRESETS.alive);
    expect(uniforms.uAnimated.value).toBe(0);
    expect(uniforms.uTriplanar.value).toBe(0);
    expect(uniforms.uAO.value).toBe(0);

    material.dispose();
  });
});
