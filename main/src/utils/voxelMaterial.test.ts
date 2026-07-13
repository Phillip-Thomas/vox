import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { QUALITY_PROFILES } from '../config/graphicsSettings.ts';
import { VOXEL_REALITY_PRESETS } from '../game/systems/realityRenderSystem.ts';
import {
  applyTerrainProfileToMaterial,
  createVoxelMaterial,
  updateVoxelMaterial
} from './voxelMaterial.ts';
import { buildTerrainProfile } from './terrainProfile.ts';

describe('voxelMaterial', () => {
  it('keeps one shared lit voxel shader program', () => {
    const material = createVoxelMaterial();

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.customProgramCacheKey()).toBe('voxel-pbr-v7');
    expect(material.roughness).toBeGreaterThan(0.9);

    material.dispose();
  });

  it('applies the deterministic surface style without creating a program variant', () => {
    const material = createVoxelMaterial();
    const uniforms = {
      uTerrainTint: { value: new THREE.Color() },
      uTerrainTintStrength: { value: 0 },
      uSurfaceOffset: { value: new THREE.Vector3() },
      uSurfaceScale: { value: 1 },
      uSurfaceRelief: { value: 0 },
      uSurfaceWeathering: { value: 0 },
      uSurfaceMineralization: { value: 0 },
      uRockTint: { value: new THREE.Color() },
      uMineralTint: { value: new THREE.Color() },
      uHazardTint: { value: new THREE.Color() }
    };
    material.userData.shader = { uniforms };
    const profile = buildTerrainProfile(1674647402);
    applyTerrainProfileToMaterial(profile, material);

    expect(uniforms.uSurfaceOffset.value.toArray()).toEqual(profile.surfaceOffset.toArray());
    expect(uniforms.uSurfaceScale.value).toBe(profile.surfaceScale);
    expect(uniforms.uSurfaceRelief.value).toBe(profile.surfaceRelief);
    expect(uniforms.uSurfaceMineralization.value).toBe(profile.mineralization);
    expect(uniforms.uRockTint.value.getHex()).toBe(profile.rockTint.getHex());
    expect(material.customProgramCacheKey()).toBe('voxel-pbr-v7');
    material.dispose();
  });

  it('updates quality, reality, and sun/moon uniforms without recompiling variants', () => {
    const material = createVoxelMaterial();
    const uniforms = {
      uTime: { value: 0 },
      uAnimated: { value: 1 },
      uTriplanar: { value: 1 },
      uCheapDetail: { value: 0 },
      uAO: { value: 1 },
      uRealityChroma: { value: 1 },
      uRealityDetail: { value: 1 },
      uRealityOrganic: { value: 1 },
      uRealityAtmosphere: { value: 1 },
      uRealityThermal: { value: 1 },
      uRealityCrystalline: { value: 1 },
      uRealityMetal: { value: 1 },
      uRealityStyle: { value: 1 },
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
    expect(uniforms.uCheapDetail.value).toBe(0);
    expect(uniforms.uAO.value).toBe(1);
    expect(uniforms.uRealityOrganic.value).toBeGreaterThan(0);
    expect(uniforms.uSunDir.value.length()).toBeCloseTo(1);
    expect(uniforms.uMoonDir.value.length()).toBeCloseTo(1);

    updateVoxelMaterial(material, 13, QUALITY_PROFILES.POTATO, VOXEL_REALITY_PRESETS.alive);
    expect(uniforms.uAnimated.value).toBe(0);
    expect(uniforms.uTriplanar.value).toBe(0);
    expect(uniforms.uCheapDetail.value).toBe(0);
    expect(uniforms.uAO.value).toBe(0);

    updateVoxelMaterial(material, 14, QUALITY_PROFILES.MEDIUM, VOXEL_REALITY_PRESETS.alive);
    expect(uniforms.uTriplanar.value).toBe(0);
    expect(uniforms.uCheapDetail.value).toBe(1);

    updateVoxelMaterial(material, 15, QUALITY_PROFILES.MEDIUM, VOXEL_REALITY_PRESETS.material);
    expect(uniforms.uCheapDetail.value).toBeCloseTo(VOXEL_REALITY_PRESETS.material.detail);
    expect(uniforms.uRealityStyle.value).toBeCloseTo(VOXEL_REALITY_PRESETS.material.detail);

    updateVoxelMaterial(material, 16, QUALITY_PROFILES.HIGH, VOXEL_REALITY_PRESETS.bare);
    expect(uniforms.uTriplanar.value).toBe(0);
    expect(uniforms.uCheapDetail.value).toBe(0);
    expect(uniforms.uRealityStyle.value).toBe(0);

    material.dispose();
  });
});
