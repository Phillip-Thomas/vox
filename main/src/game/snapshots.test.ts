import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applySnapshot, applyVoxelDiffSnapshot, snapshot, type GameSnapshot } from './snapshots.ts';
import { resetLocalActorId } from './playerActors.ts';
import { voxelSystem, type TerrainVoxel } from '../utils/efficientVoxelSystem.ts';
import { addItem, getItemCount, resetAllInventories } from './systems/inventorySystem.ts';
import {
  applyStamina,
  getVitals,
  isStaminaExhausted,
  resetAllVitals,
  setVitals
} from './systems/survivalVitals.ts';
import { addMawCharge, getMawCharge, resetAllMawState } from './systems/mawSystem.ts';
import { getWaterskinFill, resetAllWaterskins, setWaterskinFill } from './systems/consumeSystem.ts';
import { consumeJetpackFuel, getJetpackFuelAmount, resetAllJetpackFuel } from './systems/jetpackSystem.ts';
import { advanceEraTo, getCurrentEra, hasMilestone, markMilestone, resetProgression } from './systems/progressionSystem.ts';
import { getPlayerPose, resetPlayerPoses, setPlayerPose } from './systems/playerPoseSystem.ts';
import { getPlayerFlightState, resetPlayerFlightStates, setPlayerFlightState } from './systems/playerFlightSystem.ts';
import {
  getPieces,
  placePiece,
  resetStructures,
  setFreeBuild
} from './systems/structureSystem.ts';
import { getCampfires, placeCampfire, resetCampfires } from './systems/campfires.ts';
import { getHarvestedTrees, markTreeHarvested, resetTreeHarvest } from './systems/treeHarvest.ts';
import { getCollectedStones, markStoneCollected, resetStonePickup } from './systems/stonePickup.ts';
import { getCollectedForage, markForageCollected, resetForagePickup } from './systems/foragePickup.ts';

const emptySnapshot: GameSnapshot = {
  schemaVersion: 1,
  players: {
    inventory: {},
    vitals: {},
    maw: {},
    waterskin: {},
    jetpack: {},
    progression: {},
    pose: {},
    flight: {}
  },
  world: {
    structures: [],
    campfires: [],
    trees: [],
    stones: [],
    forage: [],
    voxels: {
      generationSchemaVersion: 1,
      fingerprint: 0,
      removed: [],
      added: []
    }
  }
};

function resetAllState() {
  resetLocalActorId();
  resetAllInventories();
  resetAllVitals();
  resetAllMawState();
  resetAllWaterskins();
  resetAllJetpackFuel();
  resetProgression();
  resetPlayerPoses();
  resetPlayerFlightStates();
  resetStructures();
  resetCampfires();
  resetTreeHarvest();
  resetStonePickup();
  resetForagePickup();
  setFreeBuild(false);
  voxelSystem.reset();
}

beforeEach(resetAllState);

describe('game snapshots', () => {
  it('round-trips per-player stores and world-shared resource markers', () => {
    addItem('wood', 7, 'alice');
    setVitals({ health: 44, stamina: 1, oxygen: 12 }, 'alice');
    applyStamina(1, true, 'alice');
    addMawCharge(25, 'alice');
    setWaterskinFill(35, 'alice');
    consumeJetpackFuel(0.4, 'alice');
    advanceEraTo('emergent', 'alice');
    markMilestone('maw_repaired', 'alice');
    setPlayerPose({
      playerId: 'alice',
      worldId: '5,-2',
      seq: 7,
      timeMs: 123,
      position: [9, 8, 7],
      velocity: [1, 0, 0],
      forward: [0, 0, -1],
      up: [0, 1, 0],
      action: 'jetpack',
      jetpackActive: true
    });
    setPlayerFlightState({
      playerId: 'alice',
      seq: 3,
      timeMs: 456,
      phase: 'deep_space',
      controlMode: 'flight',
      destination: { x: 6, y: 7 },
      target: { x: 8, y: 9 },
      handoff: { status: 'requested', destination: { x: 6, y: 7 } }
    });

    setFreeBuild(true);
    placePiece([0, 0, 0], 3, 'foundation', 'wood', 2, 'alice');
    placeCampfire(new THREE.Vector3(1, 2, 3), new THREE.Vector3(0, 1, 0), 'alice');
    markTreeHarvested(1, 1, 1);
    markStoneCollected(2, 2, 2);
    markForageCollected(3, 3, 3);

    const saved = snapshot();
    resetAllState();
    applySnapshot(saved);

    expect(getItemCount('wood', 'alice')).toBe(7);
    expect(getVitals('alice')).toMatchObject({ health: 44, stamina: 0, oxygen: 12 });
    expect(isStaminaExhausted('alice')).toBe(true);
    expect(getMawCharge('alice')).toBe(25);
    expect(getWaterskinFill('alice')).toBe(35);
    expect(getJetpackFuelAmount('alice')).toBeCloseTo(1.0);
    expect(getCurrentEra('alice')).toBe('emergent');
    expect(hasMilestone('maw_repaired', 'alice')).toBe(true);
    expect(getPlayerPose('alice')).toMatchObject({
      playerId: 'alice',
      worldId: '5,-2',
      seq: 7,
      position: [9, 8, 7],
      action: 'jetpack',
      jetpackActive: true
    });
    expect(getPlayerFlightState('alice')).toMatchObject({
      playerId: 'alice',
      seq: 3,
      phase: 'deep_space',
      controlMode: 'flight',
      destination: { x: 6, y: 7 }
    });
    expect(getPieces()[0]).toMatchObject({ ownerId: 'alice', placedBy: 'alice' });
    expect(getCampfires()[0]).toMatchObject({ pos: [1, 2, 3], ownerId: 'alice' });
    expect(getHarvestedTrees()).toEqual([[1, 1, 1]]);
    expect(getCollectedStones()).toEqual([[2, 2, 2]]);
    expect(getCollectedForage()).toEqual([[3, 3, 3]]);
  });

  it('replace mode clears stale state before applying', () => {
    addItem('wood', 1, 'stale');
    setPlayerFlightState({ playerId: 'stale', phase: 'deep_space', controlMode: 'flight' });
    setFreeBuild(true);
    placePiece([9, 9, 9], 3, 'foundation', 'wood', 2, 'stale');
    markTreeHarvested(9, 9, 9);

    applySnapshot(emptySnapshot, { replace: true });

    expect(getItemCount('wood', 'stale')).toBe(0);
    expect(getPlayerFlightState('stale')).toBeNull();
    expect(getPieces()).toHaveLength(0);
    expect(getHarvestedTrees()).toHaveLength(0);
  });

  it('round-trips voxel diffs only after baseline terrain is populated', () => {
    const all = block(1);
    loadTerrain(all);
    voxelSystem.removeVoxel(0, 1, 0);
    voxelSystem.exposeNeighbors(0, 1, 0);

    const saved = snapshot();
    loadTerrain(all);

    expect(voxelSystem.isDeleted(0, 1, 0)).toBe(false);
    applySnapshot(saved, { applyVoxelDiff: true });

    expect(voxelSystem.isDeleted(0, 1, 0)).toBe(true);
    expect(voxelSystem.hasVoxel(0, 1, 0)).toBe(false);
  });

  it('refuses voxel diff snapshots when generation fingerprint changes', () => {
    const all = block(1);
    loadTerrain(all);
    voxelSystem.removeVoxel(0, 1, 0);
    voxelSystem.exposeNeighbors(0, 1, 0);

    const saved = snapshot();
    loadTerrain(block(2));

    expect(applyVoxelDiffSnapshot(saved.world.voxels)).toBe(false);
    expect(voxelSystem.isDeleted(0, 1, 0)).toBe(false);
  });
});

const DIRS: Array<[number, number, number]> = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function block(radius: number): TerrainVoxel[] {
  const terrain: TerrainVoxel[] = [];
  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        terrain.push({ x, y, z, material: 'stone', color: new THREE.Color('gray') });
      }
    }
  }
  return terrain;
}

function surface(all: TerrainVoxel[]): TerrainVoxel[] {
  const solid = new Set(all.map(voxel => `${voxel.x},${voxel.y},${voxel.z}`));
  return all.filter(voxel => DIRS.some(([dx, dy, dz]) => !solid.has(`${voxel.x + dx},${voxel.y + dy},${voxel.z + dz}`)));
}

function testMesh(capacity: number) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial(), capacity);
  mesh.count = 0;
  return mesh;
}

function loadTerrain(all: TerrainVoxel[]) {
  voxelSystem.reset();
  voxelSystem.setMesh(testMesh(2000));
  voxelSystem.populateInitialTerrain(all, surface(all), {});
}
