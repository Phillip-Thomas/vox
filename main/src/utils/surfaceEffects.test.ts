import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MaterialType } from '../types/materials.ts';
import { voxelSystem } from './efficientVoxelSystem.ts';
import { buildWindProfile } from './windProfile.ts';
import {
  buildSurfaceMoteInstances,
  buildSurfaceSheetInstances,
  countSurfaceMoteVoxels,
  countSurfaceSheetVoxels,
  createSurfaceMoteGeometry,
  createSurfaceSheetGeometry,
  isSurfaceEffectVoxel,
  isVoxelFaceOpen,
  surfaceEffectRealityDensityScale,
  surfaceEffectVisibility,
  surfaceMoteCoverage,
  surfaceMotesPerVoxel,
  surfaceSheetIntensity,
  type SurfaceMoteConfig,
  type SurfaceSheetConfig
} from './surfaceEffects.ts';
import { VOXEL_REALITY_PRESETS } from '../game/systems/realityRenderSystem.ts';

const sand = new THREE.Color(0xc2b280);
const dirt = new THREE.Color(0x8b4513);
const ice = new THREE.Color(0xcfe6f5);

const sandFlowConfig: SurfaceSheetConfig = {
  id: 'sandFlow',
  kind: 'flow',
  materials: [MaterialType.SAND],
  colorA: new THREE.Color(0xd8c8a0),
  colorB: new THREE.Color(0xf5e6c0),
  colorC: new THREE.Color(0xfff2d0),
  intensity: 0.6,
  patchScale: 0.07,
  flowSpeed: 1.25,
  grainScale: 2.4,
  sparkle: 0,
  emissive: 0,
  feather: 0,
  salt: 181
};

const frostMoteConfig: SurfaceMoteConfig = {
  id: 'frost',
  materials: [MaterialType.ICE],
  colorA: new THREE.Color(0xffffff),
  colorB: new THREE.Color(0xbfe8ff),
  coverageBase: 1,
  coverageGain: 0,
  motesPerVoxel: 2,
  size: 0.04,
  baseLift: 0.1,
  liftRange: 0.6,
  driftSpeed: 0.3,
  rise: 0.1,
  alpha: 0.4,
  emissive: 0.2,
  salt: 900
};

afterEach(() => {
  voxelSystem.reset();
});

describe('surface effects (grounded)', () => {
  it('scales sheet pattern intensity with density and clamps to 1', () => {
    expect(surfaceSheetIntensity(0, sandFlowConfig)).toBe(0);
    const low = surfaceSheetIntensity(0.2, sandFlowConfig);
    const high = surfaceSheetIntensity(1, sandFlowConfig);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
    expect(surfaceSheetIntensity(50, { intensity: 5 })).toBe(1);
  });

  it('scales mote density into coverage and motes per voxel', () => {
    expect(surfaceMotesPerVoxel(0, frostMoteConfig)).toBe(0);
    expect(surfaceMotesPerVoxel(0.2, frostMoteConfig)).toBe(1);
    expect(surfaceMotesPerVoxel(1, frostMoteConfig)).toBe(2);
    expect(surfaceMoteCoverage(0, frostMoteConfig)).toBe(0);
    expect(surfaceMoteCoverage(1, frostMoteConfig)).toBe(1);
    expect(surfaceMoteCoverage(2, { coverageBase: 0.2, coverageGain: 0.3 })).toBeCloseTo(0.8);
  });

  it('keeps effects on eligible exposed materials only', () => {
    expect(isSurfaceEffectVoxel({ material: MaterialType.SAND }, sandFlowConfig)).toBe(true);
    expect(isSurfaceEffectVoxel({ material: MaterialType.DIRT }, sandFlowConfig)).toBe(false);
    expect(isSurfaceEffectVoxel({ material: MaterialType.SAND, supportsSurfaceResources: false }, sandFlowConfig)).toBe(false);
  });

  it('uses reality stage to gate spawned surface-effect density separately from device quality', () => {
    expect(surfaceEffectRealityDensityScale(VOXEL_REALITY_PRESETS.bare)).toBe(0);
    expect(surfaceEffectRealityDensityScale(VOXEL_REALITY_PRESETS.color)).toBe(0);
    expect(surfaceEffectRealityDensityScale(VOXEL_REALITY_PRESETS.material)).toBeGreaterThan(0);
    expect(surfaceEffectRealityDensityScale(VOXEL_REALITY_PRESETS.alive)).toBeGreaterThan(
      surfaceEffectRealityDensityScale(VOXEL_REALITY_PRESETS.material)
    );
    expect(surfaceEffectRealityDensityScale(VOXEL_REALITY_PRESETS.paradox)).toBeGreaterThanOrEqual(
      surfaceEffectRealityDensityScale(VOXEL_REALITY_PRESETS.alive)
    );
  });

  it('maps each effect to its reality channel', () => {
    const bare = VOXEL_REALITY_PRESETS.bare;
    const alive = VOXEL_REALITY_PRESETS.alive;
    for (const id of ['sandFlow', 'soilLife', 'frost', 'lavaCrust', 'pollen', 'wormLife', 'grassLife'] as const) {
      expect(surfaceEffectVisibility(id, bare)).toBe(0);
      expect(surfaceEffectVisibility(id, alive)).toBeGreaterThan(0);
    }
    // Thermal-only reality lights lava but not organics.
    const thermalOnly = { ...bare, thermal: 1 };
    expect(surfaceEffectVisibility('lavaCrust', thermalOnly)).toBe(1);
    expect(surfaceEffectVisibility('grassLife', thermalOnly)).toBe(0);
  });

  it('detects whether the outward face is open to the air', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.SAND, sand);
    expect(isVoxelFaceOpen(0, 25, 0)).toBe(true);
    voxelSystem.addVoxel(0, 26, 0, MaterialType.SAND, sand);
    expect(isVoxelFaceOpen(0, 25, 0)).toBe(false);
    expect(isVoxelFaceOpen(0, 26, 0)).toBe(true);
  });

  it('counts one sheet per eligible open-faced voxel', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.SAND, sand);
    voxelSystem.addVoxel(1, 25, 0, MaterialType.SAND, sand);
    voxelSystem.addVoxel(2, 25, 0, MaterialType.DIRT, dirt);
    voxelSystem.addVoxel(3, 25, 0, MaterialType.SAND, sand, undefined, {
      supportsSurfaceResources: false
    });
    // Buried under a neighbor: no sheet.
    voxelSystem.addVoxel(4, 25, 0, MaterialType.SAND, sand);
    voxelSystem.addVoxel(4, 26, 0, MaterialType.SAND, sand);

    expect(countSurfaceSheetVoxels(sandFlowConfig, 1, 12345)).toBe(3);
  });

  it('builds flush deterministic sheet instances on the voxel face', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.SAND, sand);
    voxelSystem.addVoxel(1, 25, 0, MaterialType.SAND, sand);
    const geometry = createSurfaceSheetGeometry();
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 8);
    const result = buildSurfaceSheetInstances(sandFlowConfig, mesh, 1, 0, null, 12345);

    expect(result.voxelCount).toBe(2);
    expect(result.count).toBe(2);
    expect(mesh.count).toBe(2);

    // Sheet hugs the outer face: voxel (0,25,0) -> world (0,50,0), top face at
    // y=50.99; the sheet sits ~0.01 above it, NOT floating like the old cards.
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(0, m);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    expect(pos.y).toBeGreaterThan(50.98);
    expect(pos.y).toBeLessThan(51.05);

    // Right-handed instance basis: a mirrored (negative-determinant) frame
    // back-face-culls the FrontSide sheet and the whole layer disappears.
    expect(m.determinant()).toBeGreaterThan(0);

    geometry.dispose();
    material.dispose();
  });

  it('builds deterministic mote instances above eligible voxels', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.ICE, ice);
    voxelSystem.addVoxel(1, 25, 0, MaterialType.ICE, ice);
    const geometry = createSurfaceMoteGeometry();
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 16);
    const result = buildSurfaceMoteInstances(frostMoteConfig, mesh, 1, 0, null, 12345, buildWindProfile(12345));

    expect(result.voxelCount).toBe(2);
    expect(result.count).toBe(4);
    expect(mesh.count).toBe(4);

    geometry.dispose();
    material.dispose();
  });

  it('counts motes with coverage and exposure applied', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.ICE, ice);
    voxelSystem.addVoxel(1, 25, 0, MaterialType.ICE, ice);
    voxelSystem.addVoxel(2, 25, 0, MaterialType.SAND, sand);
    voxelSystem.addVoxel(3, 25, 0, MaterialType.ICE, ice, undefined, {
      supportsSurfaceResources: false
    });

    expect(countSurfaceMoteVoxels(frostMoteConfig, 1, 12345)).toBe(4);
  });

  it('builds a single flush quad sheet geometry with an upward normal', () => {
    const geometry = createSurfaceSheetGeometry();
    expect(geometry.attributes.position.count).toBe(4);
    const normal = geometry.attributes.normal;
    for (let i = 0; i < normal.count; i++) {
      expect(normal.getY(i)).toBeCloseTo(1);
    }
    geometry.dispose();
  });

  it('builds tiny crossed-card mote geometry', () => {
    const geometry = createSurfaceMoteGeometry();
    expect(geometry.attributes.position.count).toBe(8);
    expect(geometry.attributes.uv.count).toBe(8);
    expect(geometry.index?.count).toBe(12);
    geometry.dispose();
  });
});
