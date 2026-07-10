import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MaterialType } from '../types/materials.ts';
import { voxelSystem } from './efficientVoxelSystem.ts';
import {
  FAUNA_KINDS,
  buildFaunaInstances,
  buildFaunaProfile,
  chooseFaunaKindForVoxel,
  chooseHerdDirectionIndex,
  countFaunaVoxels,
  createFaunaGeometry,
  createFaunaMaterial,
  faunaKindId,
  faunaLevelTransitionLift,
  faunaScaleForKind,
  isFaunaEligibleVoxel,
  isFaunaHabitatVoxel,
  isFaunaSurfaceDry,
  isFaunaTravelVoxel,
  prepareFaunaInstanceAttributes,
  shouldPlaceFaunaVoxel,
  updateFaunaAgents,
  type FaunaAgent,
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

  it('sizes the herd hierarchy against the player (grazers horse-tall, never player-dwarfed)', () => {
    // Local geometry head-top heights (see faunaScaleForKind doc comment).
    const GRAZER_LOCAL_HEIGHT = 1.45;
    const PLAYER_STANDING_HEIGHT = 3.6; // world units, from cubeGravityConstants

    for (const seed of [0, 0.5, 1]) {
      const [, grazerY] = faunaScaleForKind('grazer', seed);
      const height = grazerY * GRAZER_LOCAL_HEIGHT;
      // A grazer stands roughly eye-level with the player: clearly taller than
      // half the player, never towering over them.
      expect(height).toBeGreaterThan(PLAYER_STANDING_HEIGHT * 0.78);
      expect(height).toBeLessThan(PLAYER_STANDING_HEIGHT * 1.05);
    }

    const [grazerX, grazerY] = faunaScaleForKind('grazer', 0.5);
    const [woollyX, woollyY] = faunaScaleForKind('woolly', 0.5);
    const [runnerX] = faunaScaleForKind('runner', 0.5);
    const [hopperX] = faunaScaleForKind('hopper', 0.5);
    const [dragonflyX] = faunaScaleForKind('dragonfly', 0.5);

    expect(grazerY).toBeGreaterThan(grazerX);
    expect(woollyY).toBeGreaterThan(woollyX);
    expect(grazerX).toBeGreaterThan(woollyX);
    expect(woollyX).toBeGreaterThan(runnerX);
    expect(runnerX).toBeGreaterThan(hopperX);
    expect(hopperX).toBeGreaterThan(dragonflyX);

    // Planet-level size bias multiplies the whole animal uniformly.
    const [biasedX, biasedY] = faunaScaleForKind('grazer', 0.5, 1.15);
    expect(biasedX).toBeCloseTo(grazerX * 1.15);
    expect(biasedY).toBeCloseTo(grazerY * 1.15);
  });

  it('herds grazers toward the nearest same-kind neighbor and separates crowds', () => {
    const makeAgent = (kind: FaunaAgent['kind'], x: number, toWorld: THREE.Vector3): FaunaAgent => ({
      kind,
      terrainSeed: 1,
      homeX: x, homeY: 25, homeZ: 0,
      x, y: 25, z: 0,
      toX: x, toY: 25, toZ: 0,
      from: toWorld.clone(),
      to: toWorld.clone(),
      progress: 0,
      directionIndex: 0,
      speed: 0.5,
      scaleSeed: 0.5,
      tiltSeed: 0.5,
      offsetU: 0,
      offsetV: 0,
      phase: 0,
      stridePhase: 0,
      stepSalt: 1,
      stepCount: 0,
      orientation: new THREE.Quaternion(),
      grazeUntil: 0,
      fleeUntil: 0,
      pose: 0
    });

    // Agent at voxel (0,25,0) — top cube face, steps: [+x, +z, -x, -z].
    const self = makeAgent('grazer', 0, new THREE.Vector3(0, 51, 0));

    // Far mate (20 wu, beyond the comfort band): steer toward it (+x = index 0).
    const far = makeAgent('grazer', 10, new THREE.Vector3(20, 51, 0));
    expect(chooseHerdDirectionIndex(self, [self, far])).toBe(0);

    // Crowding mate (2 wu): separate (-x = index 2).
    const close = makeAgent('grazer', 1, new THREE.Vector3(2, 51, 0));
    expect(chooseHerdDirectionIndex(self, [self, close])).toBe(2);

    // Comfortable spacing (6 wu): wander freely.
    const comfy = makeAgent('grazer', 3, new THREE.Vector3(0, 51, 6));
    expect(chooseHerdDirectionIndex(self, [self, comfy])).toBeNull();

    // Out of herd range (60 wu): ignore.
    const distant = makeAgent('grazer', 30, new THREE.Vector3(60, 51, 0));
    expect(chooseHerdDirectionIndex(self, [self, distant])).toBeNull();

    // Non-herd kinds and solitary animals never bias.
    const runner = makeAgent('runner', 0, new THREE.Vector3(0, 51, 0));
    expect(chooseHerdDirectionIndex(runner, [runner, makeAgent('runner', 10, new THREE.Vector3(20, 51, 0))])).toBeNull();
    expect(chooseHerdDirectionIndex(self, [self])).toBeNull();

    // Nearest mate wins over farther ones.
    expect(chooseHerdDirectionIndex(self, [self, far, makeAgent('grazer', -8, new THREE.Vector3(-16, 51, 0))])).toBe(2);
  });

  it('keeps ground fauna off submerged terrain (no wading foxes)', () => {
    const seed = VERDANT_SEED;
    // Water classifier floods everything with x >= 2 (the cell above those voxels).
    const water = { isWaterVoxel: (x: number) => x >= 2 };
    const profile: FaunaProfile = { ...fullCoverageProfile(seed), water };

    // Dry voxels are unaffected; submerged ones are ground-fauna-hostile but
    // fish habitat (dragonflies take either).
    expect(isFaunaSurfaceDry(0, 25, 0, profile)).toBe(true);
    expect(isFaunaSurfaceDry(3, 25, 0, profile)).toBe(false);
    expect(isFaunaSurfaceDry(3, 25, 0, { water: undefined })).toBe(true);
    expect(isFaunaHabitatVoxel('runner', 3, 25, 0, profile)).toBe(false);
    expect(isFaunaHabitatVoxel('fish', 3, 25, 0, profile)).toBe(true);
    expect(isFaunaHabitatVoxel('fish', 0, 25, 0, profile)).toBe(false);
    expect(isFaunaHabitatVoxel('dragonfly', 3, 25, 0, profile)).toBe(true);

    // Travel: a runner walking a strip toward water must stop at the shoreline.
    for (let x = -2; x <= 6; x++) voxelSystem.addVoxel(x, 25, 0, MaterialType.DIRT, dirt);
    const geometry = createFaunaGeometry('runner', profile);
    prepareFaunaInstanceAttributes(geometry, 8);
    const mesh = new THREE.InstancedMesh(geometry, createFaunaMaterial('runner', profile), 8);
    const dryProfile: FaunaProfile = {
      ...profile,
      coverage: 1,
      weights: { grazer: 0.001, woolly: 0.001, runner: 50, hopper: 0.001, dragonfly: 0.001, fish: 0.001 }
    };
    const built = buildFaunaInstances('runner', mesh, 10, 0, null, seed, dryProfile);
    expect(built.agents.length).toBeGreaterThan(0);
    // All spawned agents sit on dry voxels, and stay dry while traveling.
    for (let step = 0; step < 300; step++) {
      updateFaunaAgents(mesh, built.agents, step * 0.1, 0.1, seed, dryProfile);
      for (const agent of built.agents) {
        expect(agent.x).toBeLessThan(2);
        expect(agent.toX).toBeLessThan(2);
      }
    }
    geometry.dispose();
  });

  it('spawns fish only over submerged terrain and keeps them in the water while swimming', () => {
    const seed = VERDANT_SEED;
    // Everything with x >= 2 is flooded (cell above those voxels is water).
    const water = { isWaterVoxel: (x: number) => x >= 2 };
    const profile: FaunaProfile = {
      ...fullCoverageProfile(seed),
      water,
      weights: { grazer: 0.001, woolly: 0.001, runner: 0.001, hopper: 0.001, dragonfly: 0.001, fish: 50 }
    };
    // A shoreline strip: dry land x in [-4..1], flooded lakebed x in [2..8].
    for (let x = -4; x <= 8; x++) voxelSystem.addVoxel(x, 25, 0, MaterialType.SAND, sand);

    expect(countFaunaVoxels('fish', 10, seed, profile)).toBeGreaterThan(0);

    const geometry = createFaunaGeometry('fish', profile);
    prepareFaunaInstanceAttributes(geometry, 16);
    const mesh = new THREE.InstancedMesh(geometry, createFaunaMaterial('fish', profile), 16);
    const built = buildFaunaInstances('fish', mesh, 10, 0, null, seed, profile);
    expect(built.agents.length).toBeGreaterThan(0);

    for (const agent of built.agents) {
      expect(agent.homeX).toBeGreaterThanOrEqual(2);
      // Fish anchor floats in the water column above the seabed, not on it.
      const seabedTop = 25 * 2 + 1; // voxel center y=50, face at 50.99
      expect(agent.from.y).toBeGreaterThan(seabedTop + 0.2);
    }

    // Swimming: agents never route onto dry land voxels.
    for (let step = 0; step < 300; step++) {
      updateFaunaAgents(mesh, built.agents, step * 0.1, 0.1, seed, profile);
      for (const agent of built.agents) {
        expect(agent.x).toBeGreaterThanOrEqual(2);
        expect(agent.toX).toBeGreaterThanOrEqual(2);
      }
    }
    geometry.dispose();
  });

  it('lets fish school through the herd steering', () => {
    const makeFish = (x: number, toWorld: THREE.Vector3): FaunaAgent => ({
      kind: 'fish',
      terrainSeed: 1,
      homeX: x, homeY: 25, homeZ: 0,
      x, y: 25, z: 0,
      toX: x, toY: 25, toZ: 0,
      from: toWorld.clone(),
      to: toWorld.clone(),
      progress: 0,
      directionIndex: 0,
      speed: 0.5,
      scaleSeed: 0.5,
      tiltSeed: 0.5,
      offsetU: 0,
      offsetV: 0,
      phase: 0,
      stridePhase: 0,
      stepSalt: 1,
      stepCount: 0,
      orientation: new THREE.Quaternion(),
      grazeUntil: 0,
      fleeUntil: 0,
      pose: 0
    });
    const self = makeFish(0, new THREE.Vector3(0, 51, 0));
    const mate = makeFish(10, new THREE.Vector3(20, 51, 0));
    expect(chooseHerdDirectionIndex(self, [self, mate])).toBe(0); // school toward +x
  });

  it('startles fauna into fleeing a fast-approaching player and routes them away', () => {
    const seed = VERDANT_SEED;
    const profile = fullCoverageProfile(seed);
    for (let x = -6; x <= 6; x++) {
      for (let z = -6; z <= 6; z++) voxelSystem.addVoxel(x, 25, z, MaterialType.GRASS, grass);
    }
    const geometry = createFaunaGeometry('grazer', profile);
    prepareFaunaInstanceAttributes(geometry, 64);
    const mesh = new THREE.InstancedMesh(geometry, createFaunaMaterial('grazer', profile), 64);
    const built = buildFaunaInstances('grazer', mesh, 10, 0, null, seed, profile);
    expect(built.agents.length).toBeGreaterThan(0);
    const agent = built.agents[0];

    // A player sprinting AT the animal from 5 wu away startles it...
    agent.progress = 0; // evaluated position = agent.from, exactly
    const player = agent.from.clone();
    player.x += 5;
    const sprintTowardAgent = new THREE.Vector3(-6, 0, 0);
    updateFaunaAgents(mesh, built.agents, 10, 0.05, seed, profile, player, sprintTowardAgent);
    expect(agent.fleeUntil).toBeGreaterThan(10);
    expect(agent.grazeUntil).toBe(0);

    // ...and while fleeing, chosen routes never head back toward the player.
    const before = agent.from.distanceTo(player);
    for (let step = 0; step < 40; step++) {
      updateFaunaAgents(mesh, built.agents, 10 + step * 0.05, 0.05, seed, profile, player, null);
    }
    expect(agent.to.distanceTo(player)).toBeGreaterThanOrEqual(before - 0.6);

    // A stationary player at the same distance does NOT startle.
    const calm = built.agents[1] ?? agent;
    calm.fleeUntil = 0;
    calm.progress = 0;
    const calmWatcher = calm.from.clone();
    calmWatcher.x += 5;
    updateFaunaAgents(mesh, built.agents, 60, 0.05, seed, profile, calmWatcher, new THREE.Vector3(0, 0, 0));
    expect(calm.fleeUntil).toBe(0);
    geometry.dispose();
  });

  it('holds position and raises the graze pose while grazing', () => {
    const seed = VERDANT_SEED;
    const profile = fullCoverageProfile(seed);
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) voxelSystem.addVoxel(x, 25, z, MaterialType.GRASS, grass);
    }
    const geometry = createFaunaGeometry('grazer', profile);
    prepareFaunaInstanceAttributes(geometry, 64);
    const mesh = new THREE.InstancedMesh(geometry, createFaunaMaterial('grazer', profile), 64);
    const built = buildFaunaInstances('grazer', mesh, 10, 0, null, seed, profile);
    expect(built.agents.length).toBeGreaterThan(0);
    const agent = built.agents[0];

    // Force a graze window and verify the animal stands still, head lowering.
    agent.grazeUntil = 100;
    const fromBefore = agent.from.clone();
    const toBefore = agent.to.clone();
    const progressBefore = agent.progress;
    for (let step = 0; step < 30; step++) {
      updateFaunaAgents(mesh, built.agents, 50 + step * 0.05, 0.05, seed, profile);
    }
    expect(agent.from.equals(fromBefore)).toBe(true);
    expect(agent.to.equals(toBefore)).toBe(true);
    expect(agent.progress).toBe(progressBefore);
    expect(agent.pose).toBeGreaterThan(0.9);
    const poseAttr = geometry.getAttribute('aFaunaPose') as THREE.InstancedBufferAttribute;
    expect(poseAttr.getX(0)).toBeGreaterThan(0.9);

    // After the pause ends the animal resumes and the pose relaxes.
    for (let step = 0; step < 40; step++) {
      updateFaunaAgents(mesh, built.agents, 101 + step * 0.05, 0.05, seed, profile);
    }
    expect(agent.pose).toBeLessThan(0.25);
    geometry.dispose();
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
      expect(material.customProgramCacheKey()).toBe('fauna-field-v7');
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
