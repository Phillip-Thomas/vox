import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { QUALITY_PROFILES } from '../config/graphicsSettings.ts';
import { VOXEL_REALITY_PRESETS } from '../game/systems/realityRenderSystem.ts';
import { createWaterBlocksMaterial, updateWaterBlocksMaterial } from './waterBlocksMaterial.ts';

describe('waterBlocksMaterial', () => {
  it('keeps one shared water shader program for all planets and stages', () => {
    const material = createWaterBlocksMaterial();

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.customProgramCacheKey()).toBe('water-blocks-iq-v4');
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);

    material.dispose();
  });

  it('updates quality, reality, and sun/moon uniforms without recompiling variants', () => {
    const material = createWaterBlocksMaterial();
    const uniforms = {
      uTime: { value: 0 },
      uAnimated: { value: 1 },
      uReflections: { value: 1 },
      uWaveAmp: { value: 0.42 },
      uChoppy: { value: 0.6 },
      uRealityChroma: { value: 1 },
      uRealityDetail: { value: 1 },
      uRealityAtmosphere: { value: 1 },
      uSunDir: { value: new THREE.Vector3() },
      uMoonDir: { value: new THREE.Vector3() }
    };
    material.userData.shader = { uniforms };

    updateWaterBlocksMaterial(
      material,
      12,
      new THREE.Vector3(0, 3, 0),
      new THREE.Vector3(0, -2, 0),
      QUALITY_PROFILES.HIGH,
      VOXEL_REALITY_PRESETS.bare
    );

    expect(uniforms.uTime.value).toBe(12);
    expect(uniforms.uAnimated.value).toBe(1);
    expect(uniforms.uRealityChroma.value).toBe(0);
    expect(uniforms.uRealityDetail.value).toBe(0);
    expect(uniforms.uWaveAmp.value).toBeLessThan(0.08);
    expect(uniforms.uReflections.value).toBeCloseTo(0.18, 6);
    expect(uniforms.uSunDir.value.length()).toBeCloseTo(1, 6);
    expect(uniforms.uMoonDir.value.length()).toBeCloseTo(1, 6);

    updateWaterBlocksMaterial(
      material,
      18,
      new THREE.Vector3(0, 3, 0),
      new THREE.Vector3(0, -2, 0),
      QUALITY_PROFILES.HIGH,
      VOXEL_REALITY_PRESETS.alive
    );

    expect(uniforms.uRealityChroma.value).toBe(1);
    expect(uniforms.uRealityDetail.value).toBe(1);
    expect(uniforms.uWaveAmp.value).toBeGreaterThan(0.4);
    expect(uniforms.uWaveAmp.value).toBeLessThanOrEqual(0.42);
    expect(uniforms.uReflections.value).toBe(1);

    updateWaterBlocksMaterial(
      material,
      19,
      new THREE.Vector3(0, 3, 0),
      new THREE.Vector3(0, -2, 0),
      QUALITY_PROFILES.HIGH,
      VOXEL_REALITY_PRESETS.paradox
    );

    expect(uniforms.uWaveAmp.value).toBe(0.42);

    updateWaterBlocksMaterial(
      material,
      20,
      new THREE.Vector3(0, 3, 0),
      new THREE.Vector3(0, -2, 0),
      QUALITY_PROFILES.POTATO,
      VOXEL_REALITY_PRESETS.alive
    );

    expect(uniforms.uAnimated.value).toBe(0);
    expect(uniforms.uReflections.value).toBe(0);

    material.dispose();
  });
});
