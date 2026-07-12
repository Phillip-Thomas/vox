import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MaterialType } from '../types/materials.ts';
import { voxelSystem } from './efficientVoxelSystem.ts';
import {
  buildCritterAgents,
  countCritterVoxels,
  createCaterpillarGeometry,
  createWormGeometry,
  critterCoverage,
  critterMaxDistance,
  isCritterHomeVoxel,
  isCritterTravelVoxel,
  prepareCritterSeedAttribute,
  updateCritterAgents,
  writeCritterSeeds,
  type CritterConfig
} from './surfaceCritters.ts';
import { QUALITY_PROFILES } from '../config/graphicsSettings.ts';

const dirt = new THREE.Color(0x8b4513);
const sand = new THREE.Color(0xc2b280);

const wormConfig: CritterConfig = {
  kind: 'worm',
  effectId: 'wormLife',
  materials: [MaterialType.DIRT],
  coverageBase: 1,
  coverageGain: 0,
  speed: 4, // fast test speed so steps happen within few updates
  leash: 3,
  bodyColor: new THREE.Color(0x9a604b),
  accentColor: new THREE.Color(0xc98d70),
  darkColor: new THREE.Color(0x4f2f22),
  salt: 71
};

afterEach(() => {
  voxelSystem.reset();
});

function addDirtStrip(length: number): void {
  for (let x = 0; x < length; x++) {
    voxelSystem.addVoxel(x, 25, 0, MaterialType.DIRT, dirt);
  }
}

describe('surface critters', () => {
  it('scales coverage with density', () => {
    expect(critterCoverage(0, wormConfig)).toBe(0);
    expect(critterCoverage(1, { coverageBase: 0.08, coverageGain: 0.14 })).toBeCloseTo(0.22);
    expect(critterCoverage(20, { coverageBase: 0.5, coverageGain: 0.5 })).toBe(1);
  });

  it('homes only on eligible exposed voxels of the configured material', () => {
    expect(isCritterHomeVoxel({ material: MaterialType.DIRT }, wormConfig)).toBe(true);
    expect(isCritterHomeVoxel({ material: MaterialType.SAND }, wormConfig)).toBe(false);
    expect(isCritterHomeVoxel({ material: MaterialType.DIRT, supportsSurfaceResources: false }, wormConfig)).toBe(false);
  });

  it('only travels across voxels of the SAME material as home', () => {
    expect(isCritterTravelVoxel({ material: MaterialType.DIRT }, MaterialType.DIRT)).toBe(true);
    expect(isCritterTravelVoxel({ material: MaterialType.SAND }, MaterialType.DIRT)).toBe(false);
    expect(isCritterTravelVoxel({ material: MaterialType.DIRT, supportsSurfaceResources: false }, MaterialType.DIRT)).toBe(false);
    expect(isCritterTravelVoxel(undefined, MaterialType.DIRT)).toBe(false);
  });

  it('spawns deterministic agents on eligible voxels', () => {
    addDirtStrip(4);
    voxelSystem.addVoxel(4, 25, 0, MaterialType.SAND, sand);

    expect(countCritterVoxels(wormConfig, 1, 12345)).toBe(4);
    const a = buildCritterAgents(wormConfig, 1, 0, null, 12345);
    const b = buildCritterAgents(wormConfig, 1, 0, null, 12345);
    expect(a.length).toBe(4);
    expect(a.map(agent => [agent.homeX, agent.homeY, agent.homeZ])).toEqual(
      b.map(agent => [agent.homeX, agent.homeY, agent.homeZ])
    );
    expect(a.map(agent => agent.directionIndex)).toEqual(b.map(agent => agent.directionIndex));
  });

  it('stays on same-material voxels while crawling', () => {
    addDirtStrip(3);
    // Adjacent sand + stone that worms must never enter.
    voxelSystem.addVoxel(3, 25, 0, MaterialType.SAND, sand);
    voxelSystem.addVoxel(0, 25, 1, MaterialType.STONE, new THREE.Color(0x858c90));

    const agents = buildCritterAgents(wormConfig, 1, 0, null, 12345);
    expect(agents.length).toBe(3);

    const geometry = createWormGeometry(wormConfig);
    prepareCritterSeedAttribute(geometry, 8);
    writeCritterSeeds(geometry, agents);
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 8);

    for (let i = 0; i < 400; i++) {
      updateCritterAgents(mesh, agents, 0.1, 12345, wormConfig);
      for (const agent of agents) {
        const voxel = voxelSystem.getVoxel(agent.x, agent.y, agent.z);
        expect(voxel?.material).toBe(MaterialType.DIRT);
        const target = voxelSystem.getVoxel(agent.toX, agent.toY, agent.toZ);
        expect(target?.material).toBe(MaterialType.DIRT);
      }
    }

    geometry.dispose();
  });

  it('carries over live agents across a rebuild so their crawl never restarts', () => {
    addDirtStrip(6);
    const geometry = createWormGeometry(wormConfig);
    prepareCritterSeedAttribute(geometry, 16);
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 16);

    const agents = buildCritterAgents(wormConfig, 1, 0, null, 12345);
    expect(agents.length).toBe(6);

    // Let the worms wander so they accumulate in-flight state (progress, steps,
    // possibly a position away from home) that a naive rebuild would discard.
    for (let i = 0; i < 60; i++) updateCritterAgents(mesh, agents, 0.1, 12345, wormConfig);
    const before = agents.map(a => ({ ...a }));
    expect(before.some(a => a.stepCount > 0)).toBe(true);

    // Rebuild after an edit elsewhere, feeding the live agents back in.
    const rebuilt = buildCritterAgents(wormConfig, 1, 0, null, 12345, 160, { existingAgents: agents });
    expect(rebuilt.length).toBe(6);
    // Every agent is the SAME object with its walk state intact — no reset.
    for (let i = 0; i < rebuilt.length; i++) {
      expect(rebuilt[i]).toBe(agents[i]);
      expect(rebuilt[i].stepCount).toBe(before[i].stepCount);
      expect(rebuilt[i].progress).toBe(before[i].progress);
      expect([rebuilt[i].x, rebuilt[i].y, rebuilt[i].z]).toEqual([before[i].x, before[i].y, before[i].z]);
    }

    geometry.dispose();
  });

  it('drops only the agent whose home voxel was destroyed on rebuild', () => {
    addDirtStrip(5);
    const agents = buildCritterAgents(wormConfig, 1, 0, null, 12345);
    expect(agents.length).toBe(5);

    // Destroy one worm's home voxel; every other worm must survive untouched.
    const victim = agents[2];
    voxelSystem.removeVoxel(victim.homeX, victim.homeY, victim.homeZ);

    const rebuilt = buildCritterAgents(wormConfig, 1, 0, null, 12345, 160, { existingAgents: agents });
    expect(rebuilt.length).toBe(4);
    expect(rebuilt).not.toContain(victim);
    for (const survivor of agents) {
      if (survivor === victim) continue;
      expect(rebuilt).toContain(survivor);
    }
  });

  it('writes one instance matrix per agent', () => {
    addDirtStrip(2);
    const agents = buildCritterAgents(wormConfig, 1, 0, null, 12345);
    const geometry = createWormGeometry(wormConfig);
    prepareCritterSeedAttribute(geometry, 8);
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 8);

    const result = updateCritterAgents(mesh, agents, 0.016, 12345, wormConfig);
    expect(result.count).toBe(2);
    expect(mesh.count).toBe(2);

    // Bodies sit ON the face (voxel (x,25,0) -> top face at y=50.99).
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(0, m);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    expect(pos.y).toBeGreaterThan(50.5);
    expect(pos.y).toBeLessThan(51.6);

    geometry.dispose();
  });

  it('builds worm and caterpillar geometry with gait + color attributes', () => {
    for (const geometry of [createWormGeometry(wormConfig), createCaterpillarGeometry(wormConfig)]) {
      expect(geometry.attributes.position.count).toBeGreaterThan(0);
      expect(geometry.attributes.color.count).toBe(geometry.attributes.position.count);
      const seg = geometry.attributes.aSegT;
      expect(seg.count).toBe(geometry.attributes.position.count);
      for (let i = 0; i < seg.count; i++) {
        expect(seg.getX(i)).toBeGreaterThanOrEqual(0);
        expect(seg.getX(i)).toBeLessThanOrEqual(1);
      }
      geometry.dispose();
    }
  });

  it('keeps critters a close-inspection layer', () => {
    expect(critterMaxDistance(QUALITY_PROFILES.ULTRA)).toBeLessThanOrEqual(26);
    expect(critterMaxDistance(QUALITY_PROFILES.MEDIUM)).toBeGreaterThan(0);
    expect(critterMaxDistance(QUALITY_PROFILES.POTATO)).toBe(0);
  });
});
