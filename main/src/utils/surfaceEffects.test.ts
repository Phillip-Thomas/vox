import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MaterialType } from '../types/materials.ts';
import { voxelSystem } from './efficientVoxelSystem.ts';
import { buildWindProfile } from './windProfile.ts';
import {
  buildSurfacePhenomenonInstances,
  buildDirtLifeInstances,
  countSurfacePhenomenonVoxels,
  countSandDustVoxels,
  countDirtLifeVoxels,
  createDirtLifeGeometry,
  createSurfacePhenomenonGeometry,
  createSandDustGeometry,
  dirtLifeClustersPerVoxel,
  dirtLifeCoverage,
  isDirtLifeVoxel,
  isSandDustVoxel,
  isSurfacePhenomenonVoxel,
  sandDustCoverage,
  sandDustWispsPerVoxel,
  surfacePhenomenonCoverage,
  surfacePhenomenonParticlesPerVoxel,
  type SurfacePhenomenonConfig
} from './surfaceEffects.ts';

const sand = new THREE.Color(0xc2b280);
const dirt = new THREE.Color(0x8b4513);
const ice = new THREE.Color(0xcfe6f5);

const frostConfig: SurfacePhenomenonConfig = {
  id: 'frost',
  materials: [MaterialType.ICE],
  colorA: new THREE.Color(0xffffff),
  colorB: new THREE.Color(0xbfe8ff),
  coverageBase: 1,
  coverageGain: 0,
  particlesPerVoxel: 2,
  surfaceOffset: 1.03,
  baseLift: 0.05,
  width: 0.3,
  height: 0.6,
  depth: 0.24,
  alpha: 0.3,
  sparkle: 0.5,
  rise: 0.45,
  turbulence: 0.4,
  salt: 900
};

afterEach(() => {
  voxelSystem.reset();
});

describe('surface effects', () => {
  it('scales sand dust density into coverage and wisps per voxel', () => {
    expect(sandDustWispsPerVoxel(0)).toBe(0);
    expect(sandDustWispsPerVoxel(0.16)).toBe(1);
    expect(sandDustWispsPerVoxel(0.9)).toBe(2);
    expect(sandDustCoverage(0)).toBe(0);
    expect(sandDustCoverage(0.42)).toBeGreaterThan(0.35);
    expect(sandDustCoverage(2)).toBe(1);
  });

  it('scales dirt micro-life density into coverage and clusters per voxel', () => {
    expect(dirtLifeClustersPerVoxel(0)).toBe(0);
    expect(dirtLifeClustersPerVoxel(0.16)).toBe(1);
    expect(dirtLifeClustersPerVoxel(0.9)).toBe(2);
    expect(dirtLifeCoverage(0)).toBe(0);
    expect(dirtLifeCoverage(0.42)).toBeGreaterThan(0.42);
    expect(dirtLifeCoverage(2)).toBe(1);
  });

  it('only decorates exposed sand surface voxels', () => {
    expect(isSandDustVoxel({ material: MaterialType.SAND })).toBe(true);
    expect(isSandDustVoxel({ material: MaterialType.DIRT })).toBe(false);
    expect(isSandDustVoxel({ material: MaterialType.SAND, supportsSurfaceResources: false })).toBe(false);
  });

  it('only decorates exposed dirt surface voxels with micro-life', () => {
    expect(isDirtLifeVoxel({ material: MaterialType.DIRT })).toBe(true);
    expect(isDirtLifeVoxel({ material: MaterialType.SAND })).toBe(false);
    expect(isDirtLifeVoxel({ material: MaterialType.DIRT, supportsSurfaceResources: false })).toBe(false);
  });

  it('scales generic surface phenomena into coverage and particles per voxel', () => {
    expect(surfacePhenomenonParticlesPerVoxel(0, frostConfig)).toBe(0);
    expect(surfacePhenomenonParticlesPerVoxel(0.2, frostConfig)).toBe(1);
    expect(surfacePhenomenonParticlesPerVoxel(1, frostConfig)).toBe(2);
    expect(surfacePhenomenonCoverage(0, frostConfig)).toBe(0);
    expect(surfacePhenomenonCoverage(1, frostConfig)).toBe(1);
  });

  it('keeps generic surface phenomena on eligible exposed materials only', () => {
    expect(isSurfacePhenomenonVoxel({ material: MaterialType.ICE }, frostConfig)).toBe(true);
    expect(isSurfacePhenomenonVoxel({ material: MaterialType.SAND }, frostConfig)).toBe(false);
    expect(isSurfacePhenomenonVoxel({ material: MaterialType.ICE, supportsSurfaceResources: false }, frostConfig)).toBe(false);
  });

  it('counts deterministic dust instances for eligible sand voxels', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.SAND, sand);
    voxelSystem.addVoxel(1, 25, 0, MaterialType.SAND, sand);
    voxelSystem.addVoxel(2, 25, 0, MaterialType.DIRT, dirt);
    voxelSystem.addVoxel(3, 25, 0, MaterialType.SAND, sand, undefined, {
      supportsSurfaceResources: false
    });

    expect(countSandDustVoxels(1, 12345)).toBe(4);
  });

  it('counts deterministic dirt micro-life instances for eligible dirt voxels', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.DIRT, dirt);
    voxelSystem.addVoxel(1, 25, 0, MaterialType.DIRT, dirt);
    voxelSystem.addVoxel(2, 25, 0, MaterialType.SAND, sand);
    voxelSystem.addVoxel(3, 25, 0, MaterialType.DIRT, dirt, undefined, {
      supportsSurfaceResources: false
    });

    expect(countDirtLifeVoxels(2, 12345)).toBe(10);
  });

  it('counts deterministic generic surface phenomena for eligible materials', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.ICE, ice);
    voxelSystem.addVoxel(1, 25, 0, MaterialType.ICE, ice);
    voxelSystem.addVoxel(2, 25, 0, MaterialType.SAND, sand);
    voxelSystem.addVoxel(3, 25, 0, MaterialType.ICE, ice, undefined, {
      supportsSurfaceResources: false
    });

    expect(countSurfacePhenomenonVoxels(frostConfig, 1, 12345)).toBe(4);
  });

  it('builds a double-ribbon dust geometry with uv coordinates', () => {
    const geometry = createSandDustGeometry();
    expect(geometry.attributes.position.count).toBe(8);
    expect(geometry.attributes.uv.count).toBe(8);
    expect(geometry.index?.count).toBe(12);
    geometry.dispose();
  });

  it('builds low dirt crumb and crawler geometry with a kind attribute', () => {
    const geometry = createDirtLifeGeometry();
    expect(geometry.attributes.position.count).toBeGreaterThan(8);
    expect(geometry.attributes.uv.count).toBe(geometry.attributes.position.count);
    expect(geometry.attributes.aDirtKind.count).toBe(geometry.attributes.position.count);
    expect(geometry.index?.count).toBeGreaterThan(12);
    geometry.dispose();
  });

  it('builds shared surface phenomenon crossed-card geometry', () => {
    const geometry = createSurfacePhenomenonGeometry();
    expect(geometry.attributes.position.count).toBe(8);
    expect(geometry.attributes.uv.count).toBe(8);
    expect(geometry.index?.count).toBe(12);
    geometry.dispose();
  });

  it('builds deterministic dirt micro-life instances above eligible dirt voxels', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.DIRT, dirt);
    voxelSystem.addVoxel(1, 25, 0, MaterialType.DIRT, dirt);
    const geometry = createDirtLifeGeometry();
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 32);
    const result = buildDirtLifeInstances(mesh, 2, 0, null, 12345, buildWindProfile(12345));

    expect(result.voxelCount).toBe(2);
    expect(result.count).toBe(10);
    expect(mesh.count).toBe(10);

    geometry.dispose();
    material.dispose();
  });

  it('builds deterministic generic surface phenomenon instances above eligible voxels', () => {
    voxelSystem.addVoxel(0, 25, 0, MaterialType.ICE, ice);
    voxelSystem.addVoxel(1, 25, 0, MaterialType.ICE, ice);
    const geometry = createSurfacePhenomenonGeometry();
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 16);
    const result = buildSurfacePhenomenonInstances(frostConfig, mesh, 1, 0, null, 12345, buildWindProfile(12345));

    expect(result.voxelCount).toBe(2);
    expect(result.count).toBe(4);
    expect(mesh.count).toBe(4);

    geometry.dispose();
    material.dispose();
  });
});
