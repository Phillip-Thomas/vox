import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MaterialType } from '../types/materials.ts';
import { voxelSystem } from './efficientVoxelSystem.ts';
import {
  FAUNA_KINDS,
  buildFaunaInstances,
  buildFaunaProfile,
  chooseFaunaKindForVoxel,
  countFaunaVoxels,
  createFaunaGeometry,
  createFaunaMaterial,
  faunaKindId,
  faunaLevelTransitionLift,
  faunaScaleForKind,
  isFaunaEligibleVoxel,
  isFaunaTravelVoxel,
  prepareFaunaInstanceAttributes,
  shouldPlaceFaunaVoxel,
  updateFaunaAgents,
  type FaunaProfile
} from './faunaField.ts';

const grass = new THREE.Color(0x7cb342);
const dirt = new THREE.Color(0x8b4513);
const sand = new THREE.Color(0xc2b280);
const VERDANT_SEED = 3215739679;
const ARID_SEED = 787428812;

afterEach(() => {
  voxelSystem.reset();
});

function fullCoverageProfile(seed: number): FaunaProfile {
  return {
    ...buildFaunaProfile(seed),
    coverage: 1,
    densityMul: 10
  };
}

describe('faunaField', () => {
  it('builds deterministic biome and wind aware fauna profiles', () => {
    const a = buildFaunaProfile(12345);
    const b = buildFaunaProfile(12345);
    expect(a.densityMul).toBe(b.densityMul);
    expect(a.coverage).toBe(b.coverage);
    expect(a.wind.direction.x).toBe(b.wind.direction.x);
    expect(FAUNA_KINDS.every(kind => a.weights[kind] > 0)).toBe(true);
  });

  it('keeps fauna coats readable against verdant vegetation', () => {
    const profile = buildFaunaProfile(VERDANT_SEED);
    const coat = { h: 0, s: 0, l: 0 };
    const grassHue = profile.artDirection.palette.vegetationBase.h;
    const canopyHue = profile.artDirection.palette.canopyBase.h;
    profile.coatBase.getHSL(coat);
    const distToGrass = Math.abs(((coat.h - grassHue + 0.5) % 1) - 0.5);
    const distToCanopy = Math.abs(((coat.h - canopyHue + 0.5) % 1) - 0.5);
    expect(Math.min(distToGrass, distToCanopy)).toBeGreaterThan(0.12);
  });

  it('only decorates eligible surface materials', () => {
    expect(isFaunaEligibleVoxel({ material: MaterialType.GRASS })).toBe(true);
    expect(isFaunaEligibleVoxel({ material: MaterialType.DIRT })).toBe(true);
    expect(isFaunaEligibleVoxel({ material: MaterialType.SAND })).toBe(true);
    expect(isFaunaEligibleVoxel({ material: MaterialType.STONE })).toBe(false);
    expect(isFaunaEligibleVoxel({ material: MaterialType.GRASS, supportsSurfaceResources: false })).toBe(false);
  });

  it('keeps travel biome aware by species and material', () => {
    const profile = buildFaunaProfile(VERDANT_SEED);
    expect(isFaunaTravelVoxel('grazer', { material: MaterialType.GRASS }, profile)).toBe(true);
    expect(isFaunaTravelVoxel('woolly', { material: MaterialType.DIRT }, profile)).toBe(true);
    expect(isFaunaTravelVoxel('woolly', { material: MaterialType.SAND }, profile)).toBe(false);
    expect(isFaunaTravelVoxel('hopper', { material: MaterialType.SAND }, profile)).toBe(true);
    expect(isFaunaTravelVoxel('runner', { material: MaterialType.STONE }, profile)).toBe(false);

    const arid = buildFaunaProfile(ARID_SEED);
    expect(isFaunaTravelVoxel('grazer', { material: MaterialType.GRASS }, arid)).toBe(false);
    expect(isFaunaTravelVoxel('hopper', { material: MaterialType.SAND }, arid)).toBe(true);
  });

  it('adds a clearance arc for voxel level transitions', () => {
    expect(faunaLevelTransitionLift('grazer', 0, 0.5)).toBe(0);
    expect(faunaLevelTransitionLift('grazer', 1, 0)).toBeCloseTo(0);
    expect(faunaLevelTransitionLift('grazer', 1, 1)).toBeCloseTo(0);
    expect(faunaLevelTransitionLift('grazer', 1, 0.5)).toBeGreaterThan(0.9);
    expect(faunaLevelTransitionLift('dragonfly', 1, 0.5)).toBeGreaterThan(0.5);
  });

  it('keeps small fauna small while sizing up grazers and woollies', () => {
    const [grazerX, grazerY] = faunaScaleForKind('grazer', 0);
    const [woollyX, woollyY] = faunaScaleForKind('woolly', 0);
    const [runnerX] = faunaScaleForKind('runner', 1);
    const [hopperX] = faunaScaleForKind('hopper', 1);
    const [dragonflyX] = faunaScaleForKind('dragonfly', 1);

    expect(grazerX).toBeGreaterThan(1.3);
    expect(grazerY).toBeGreaterThan(grazerX);
    expect(woollyX).toBeGreaterThan(1);
    expect(woollyY).toBeGreaterThan(woollyX);
    expect(runnerX).toBeLessThan(1.1);
    expect(hopperX).toBeLessThan(0.9);
    expect(dragonflyX).toBeLessThan(0.75);
  });

  it('creates every fauna archetype with vertex color, part, and flex attributes', () => {
    const profile = buildFaunaProfile(12345);
    for (const kind of FAUNA_KINDS) {
      const geometry = createFaunaGeometry(kind, profile);
      expect(geometry.attributes.position.count).toBeGreaterThan(0);
      expect(geometry.attributes.color.count).toBe(geometry.attributes.position.count);
      expect(geometry.attributes.aFaunaPart.count).toBe(geometry.attributes.position.count);
      expect(geometry.attributes.aFaunaFlex.count).toBe(geometry.attributes.position.count);
      if (kind === 'dragonfly') {
        const parts = geometry.attributes.aFaunaPart.array;
        expect(Array.from(parts).some(value => value === 5)).toBe(true);
      }
      geometry.dispose();
    }
  });

  it('uses one lit fauna material program with species driven by uniforms', () => {
    const profile = buildFaunaProfile(12345);
    const keys = new Set<string>();
    for (const kind of FAUNA_KINDS) {
      const material = createFaunaMaterial(kind, profile);
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(material.vertexColors).toBe(true);
      expect(material.roughness).toBeGreaterThan(0.7);
      expect(material.customProgramCacheKey()).toBe('fauna-field-v4');
      keys.add(material.customProgramCacheKey());
      expect(faunaKindId(kind)).toBeGreaterThanOrEqual(0);
      material.dispose();
    }
    expect(keys.size).toBe(1);
  });

  it('places deterministic fauna and builds matching instances for the selected kind', () => {
    const seed = VERDANT_SEED;
    const profile = fullCoverageProfile(seed);
    voxelSystem.addVoxel(0, 25, 0, MaterialType.GRASS, grass);
    voxelSystem.addVoxel(1, 25, 0, MaterialType.DIRT, dirt);
    voxelSystem.addVoxel(2, 25, 0, MaterialType.SAND, sand);
    voxelSystem.addVoxel(3, 25, 0, MaterialType.STONE, new THREE.Color(0x808080));

    const eligible = Array.from(voxelSystem.getAllVoxels().values())
      .filter(voxel => {
        const [x, y, z] = voxel.position;
        return shouldPlaceFaunaVoxel(voxel, x, y, z, 10, seed, profile);
      });
    expect(eligible).toHaveLength(3);

    const [x, y, z] = eligible[0].position;
    const selectedKind = chooseFaunaKindForVoxel(eligible[0], x, y, z, seed, profile);
    const expectedCount = countFaunaVoxels(selectedKind, 10, seed, profile);
    expect(expectedCount).toBeGreaterThan(0);

    const geometry = createFaunaGeometry(selectedKind, profile);
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 8);
    const result = buildFaunaInstances(selectedKind, mesh, 10, 0, null, seed, profile);

    expect(result.count).toBe(expectedCount);
    expect(mesh.count).toBe(expectedCount);

    geometry.dispose();
    material.dispose();
  });

  it('moves fauna instance matrices along eligible travel lanes', () => {
    const seed = VERDANT_SEED;
    const profile = fullCoverageProfile(seed);
    for (let x = 0; x < 6; x++) {
      voxelSystem.addVoxel(x, 25, 0, MaterialType.GRASS, grass);
    }

    const eligible = Array.from(voxelSystem.getAllVoxels().values())
      .filter(voxel => {
        const [x, y, z] = voxel.position;
        return shouldPlaceFaunaVoxel(voxel, x, y, z, 10, seed, profile);
      });
    expect(eligible.length).toBeGreaterThan(0);

    const [x, y, z] = eligible[0].position;
    const selectedKind = chooseFaunaKindForVoxel(eligible[0], x, y, z, seed, profile);
    const geometry = createFaunaGeometry(selectedKind, profile);
    const prepared = prepareFaunaInstanceAttributes(geometry, 16);
    expect(prepared.count).toBeGreaterThanOrEqual(16);
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 16);
    const result = buildFaunaInstances(selectedKind, mesh, 10, 0, null, seed, profile);
    expect(result.agents.length).toBeGreaterThan(0);
    const seedAttr = geometry.attributes.aFaunaSeed as THREE.InstancedBufferAttribute;
    const seedBefore = seedAttr.getX(0);

    const before = new THREE.Matrix4();
    const after = new THREE.Matrix4();
    const beforePos = new THREE.Vector3();
    const afterPos = new THREE.Vector3();
    mesh.getMatrixAt(0, before);
    beforePos.setFromMatrixPosition(before);
    updateFaunaAgents(mesh, result.agents, 1, 1, seed, profile);
    mesh.getMatrixAt(0, after);
    afterPos.setFromMatrixPosition(after);

    expect(afterPos.distanceTo(beforePos)).toBeGreaterThan(0.02);
    expect(seedAttr.getX(0)).toBe(seedBefore);
    expect((geometry.attributes.aFaunaStride as THREE.InstancedBufferAttribute).getX(0)).toBeCloseTo(result.agents[0].stridePhase);

    geometry.dispose();
    material.dispose();
  });

  it('preserves live agent progress and gait phase when rebuilding visible fauna', () => {
    const seed = VERDANT_SEED;
    const profile = fullCoverageProfile(seed);
    for (let x = 0; x < 8; x++) {
      voxelSystem.addVoxel(x, 25, 0, MaterialType.GRASS, grass);
    }

    const selectedKind = FAUNA_KINDS.find(kind => countFaunaVoxels(kind, 10, seed, profile) > 0) ?? 'grazer';
    const geometry = createFaunaGeometry(selectedKind, profile);
    prepareFaunaInstanceAttributes(geometry, 12);
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 12);
    const initial = buildFaunaInstances(selectedKind, mesh, 10, 0, null, seed, profile);
    expect(initial.agents.length).toBeGreaterThan(0);

    updateFaunaAgents(mesh, initial.agents, 4, 0.9, seed, profile);
    const preserved = initial.agents[0];
    const progressBefore = preserved.progress;
    const strideBefore = preserved.stridePhase;
    const matrixBefore = new THREE.Matrix4();
    const matrixAfter = new THREE.Matrix4();
    const posBefore = new THREE.Vector3();
    const posAfter = new THREE.Vector3();
    mesh.getMatrixAt(0, matrixBefore);
    posBefore.setFromMatrixPosition(matrixBefore);

    const rebuilt = buildFaunaInstances(selectedKind, mesh, 10, 0, null, seed, profile, {
      existingAgents: initial.agents,
      time: 4.9
    });
    mesh.getMatrixAt(0, matrixAfter);
    posAfter.setFromMatrixPosition(matrixAfter);

    expect(rebuilt.agents[0]).toBe(preserved);
    expect(rebuilt.agents[0].progress).toBeCloseTo(progressBefore);
    expect(rebuilt.agents[0].stridePhase).toBeCloseTo(strideBefore);
    expect((geometry.attributes.aFaunaStride as THREE.InstancedBufferAttribute).getX(0)).toBeCloseTo(strideBefore);
    expect(posAfter.distanceTo(posBefore)).toBeLessThan(0.01);

    geometry.dispose();
    material.dispose();
  });

  it('slerps rotation changes instead of snapping immediately', () => {
    const seed = VERDANT_SEED;
    const profile = fullCoverageProfile(seed);
    for (let x = 0; x < 6; x++) {
      voxelSystem.addVoxel(x, 25, 0, MaterialType.GRASS, grass);
    }

    const selectedKind = 'grazer';
    const geometry = createFaunaGeometry(selectedKind, profile);
    prepareFaunaInstanceAttributes(geometry, 4);
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 4);
    const result = buildFaunaInstances(selectedKind, mesh, 10, 0, null, seed, profile);
    expect(result.agents.length).toBeGreaterThan(0);

    const agent = result.agents[0];
    const before = agent.orientation.clone();
    agent.to.copy(agent.from).add(new THREE.Vector3(0, 0, 2));
    agent.toX = agent.x;
    agent.toY = agent.y;
    agent.toZ = agent.z + 1;
    updateFaunaAgents(mesh, [agent], 1, 1 / 60, seed, profile);

    const immediate = before.angleTo(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)));
    const actual = before.angleTo(agent.orientation);
    expect(actual).toBeGreaterThan(0);
    expect(actual).toBeLessThan(immediate);

    geometry.dispose();
    material.dispose();
  });
});
