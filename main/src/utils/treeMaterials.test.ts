import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { QUALITY_PROFILES } from '../config/graphicsSettings';
import { VOXEL_REALITY_PRESETS } from '../game/systems/realityRenderSystem';
import {
  applyTreeProfileToMaterials,
  createBarkMaterial,
  createBlossomMaterial,
  createImpostorMaterial,
  createLeafMaterial,
  updateTreeMaterials
} from './treeMaterials';
import { buildTreeProfile } from './treeProfile';

function treeUniforms(wind = 1) {
  return {
    uTime: { value: 0 },
    uWind: { value: wind },
    uTreeVisibility: { value: 1 },
    uTreeChroma: { value: 1 },
    uSunDir: { value: new THREE.Vector3() },
    uMoonDir: { value: new THREE.Vector3() }
  };
}

describe('treeMaterials', () => {
  it('uses one shared shader program key per tree material kind', () => {
    const bark = createBarkMaterial();
    const leaf = createLeafMaterial();
    const blossom = createBlossomMaterial();
    const impostor = createImpostorMaterial();

    expect(bark.customProgramCacheKey()).toBe('tree-bark-v6');
    expect(leaf.customProgramCacheKey()).toBe('tree-leaf-v8');
    expect(blossom.customProgramCacheKey()).toBe('tree-blossom-v5');
    expect(impostor.customProgramCacheKey()).toBe('tree-impostor-v6');

    bark.dispose();
    leaf.dispose();
    blossom.dispose();
    impostor.dispose();
  });

  it('updates reality visibility, chroma, wind, sun, and moon uniforms', () => {
    const bark = createBarkMaterial();
    const leaf = createLeafMaterial();
    const blossom = createBlossomMaterial();
    const impostor = createImpostorMaterial();
    const barkU = treeUniforms();
    const leafU = treeUniforms();
    const blossomU = treeUniforms();
    const impostorU = treeUniforms(0);
    bark.userData.shader = { uniforms: barkU };
    leaf.userData.shader = { uniforms: leafU };
    blossom.userData.shader = { uniforms: blossomU };
    impostor.userData.shader = { uniforms: impostorU };

    updateTreeMaterials(
      bark,
      leaf,
      blossom,
      impostor,
      5,
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(0, -3, 0),
      QUALITY_PROFILES.HIGH,
      VOXEL_REALITY_PRESETS.bare
    );

    expect(barkU.uTreeVisibility.value).toBe(0);
    expect(leafU.uTreeVisibility.value).toBe(0);
    expect(blossomU.uTreeVisibility.value).toBe(0);
    expect(impostorU.uTreeVisibility.value).toBe(0);
    expect(leafU.uTreeChroma.value).toBe(0);
    expect(barkU.uWind.value).toBe(0);
    expect(leafU.uWind.value).toBe(0);
    expect(blossomU.uWind.value).toBe(0);
    expect(impostorU.uWind.value).toBe(0);

    updateTreeMaterials(
      bark,
      leaf,
      blossom,
      impostor,
      8,
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(0, -3, 0),
      QUALITY_PROFILES.HIGH,
      VOXEL_REALITY_PRESETS.material
    );

    expect(barkU.uTime.value).toBe(8);
    expect(leafU.uTreeVisibility.value).toBeGreaterThan(0);
    expect(impostorU.uTreeVisibility.value).toBeGreaterThan(0);
    expect(leafU.uTreeChroma.value).toBe(1);
    expect(leafU.uWind.value).toBeGreaterThan(0);
    expect(leafU.uSunDir.value.length()).toBeCloseTo(1);
    expect(leafU.uMoonDir.value.length()).toBeCloseTo(1);
    expect(impostorU.uWind.value).toBe(0);

    bark.dispose();
    leaf.dispose();
    blossom.dispose();
    impostor.dispose();
  });

  it('applies planet bark colour and silhouette to shared material uniforms', () => {
    const profile = buildTreeProfile(20260711);
    const bark = createBarkMaterial();
    const leaf = createLeafMaterial();
    const impostor = createImpostorMaterial();
    const barkUniforms = {
      uBarkColor: { value: new THREE.Color() },
      uLeafBase: { value: new THREE.Color() }
    };
    const leafUniforms = {
      uLeafBase: { value: new THREE.Color() },
      uShapeId: { value: -1 }
    };
    const impostorShape = { value: -1 };
    bark.userData.shader = { uniforms: barkUniforms };
    leaf.userData.shader = { uniforms: leafUniforms };
    impostor.userData.shader = {
      uniforms: {
        uLeafBase: { value: new THREE.Color() },
        uLeafTip: { value: new THREE.Color() },
        uShapeId: impostorShape
      }
    };

    applyTreeProfileToMaterials(profile, bark, leaf, null, impostor);

    expect(barkUniforms.uBarkColor.value.getHex()).toBe(profile.barkColor.getHex());
    expect(leafUniforms.uLeafBase.value.getHex()).toBe(profile.leafColor.getHex());
    expect(impostorShape.value).toBe(profile.shapeId);

    bark.dispose();
    leaf.dispose();
    impostor.dispose();
  });
});
