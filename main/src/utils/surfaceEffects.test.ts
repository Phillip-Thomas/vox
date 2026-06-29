import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MaterialType } from '../types/materials.ts';
import { voxelSystem } from './efficientVoxelSystem.ts';
import { buildWindProfile } from './windProfile.ts';
import {
  buildDirtLifeInstances,
  countSandDustVoxels,
  countDirtLifeVoxels,
  createDirtLifeGeometry,
  createSandDustGeometry,
  dirtLifeClustersPerVoxel,
  dirtLifeCoverage,
  isDirtLifeVoxel,
  isSandDustVoxel,
  sandDustCoverage,
  sandDustWispsPerVoxel
} from './surfaceEffects.ts';

const sand = new THREE.Color(0xc2b280);
const dirt = new THREE.Color(0x8b4513);

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
});
