import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createOfflineCommandContext, respawnCommand } from '../gameplayCommands.ts';
import { createWorldIdentity } from '../worldIdentity.ts';
import { createSimulationRng } from '../rng.ts';
import { RECIPES } from '../data/recipes.ts';
import { craft, type CraftContext } from './craftingSystem.ts';
import {
  collectForage,
  resetForagePickup,
  isForageCollected,
  isDeadwoodNode
} from './foragePickup.ts';
import { collectStone, resetStonePickup, isStoneCollected } from './stonePickup.ts';
import { harvestVoxel } from './harvestingSystem.ts';
import { getItemCount, removeItem, resetInventory } from './inventorySystem.ts';
import { placeCampfire, resetCampfires, getCampfires } from './campfires.ts';
import {
  getPieces,
  placePiece,
  resetStructures,
  setFreeBuild
} from './structureSystem.ts';
import { analyzeShelterCell, findShelterSpawn } from './shelterSystem.ts';
import { getVitals, resetVitals, setVitals, tickVitals } from './survivalVitals.ts';
import {
  loadGlobal,
  loadPlayerPose,
  restoreCampfiresForWorld,
  restoreForageForWorld,
  restoreGlobal,
  restoreStonesForWorld,
  restoreStructuresForWorld,
  restoreVoxelEditsForWorld,
  saveGlobal,
  savePlayerPose,
  saveVoxelEdits,
  saveWorld,
  setLocalPersistenceMode
} from './persistence.ts';
import { resetMaw } from './mawSystem.ts';
import { resetProgression } from './progressionSystem.ts';
import { fillWaterskin, getWaterskinFill, resetWaterskin } from './consumeSystem.ts';
import { setPlayerLook, setPlayerWorldPosition } from '../../state/playerFrame.ts';
import { voxelSystem, type TerrainVoxel } from '../../utils/efficientVoxelSystem.ts';

class MemStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key() { return null; }
  get length() { return this.values.size; }
}

const WORLD = createWorldIdentity({ x: 2, y: -3 });
const LOWER: [number, number, number] = [0, 30, 0];
const UPPER: [number, number, number] = [0, 31, 0];
const craftContext: CraftContext = { stations: ['hand'] };

function loadTestTerrain(): void {
  const terrain: TerrainVoxel[] = [{
    x: 0,
    y: 1,
    z: 0,
    blockId: 'stone',
    material: 'stone',
    color: new THREE.Color('gray')
  }];
  voxelSystem.reset();
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshBasicMaterial(),
    8
  );
  mesh.count = 0;
  voxelSystem.setMesh(mesh);
  voxelSystem.populateInitialTerrain(terrain, terrain, {});
}

function gatherPrimitiveLoadout() {
  const deadwood: Array<[number, number, number]> = [];
  for (let x = -2_000; deadwood.length < 22 && x <= 2_000; x++) {
    if (!isDeadwoodNode(x, 0, 0, WORLD.seed)) continue;
    const coord: [number, number, number] = [x, 0, 0];
    expect(collectForage(...coord, 'deadwood')).toEqual({ id: 'wood', qty: 2 });
    deadwood.push(coord);
  }
  expect(deadwood).toHaveLength(22);
  for (let i = 0; getItemCount('biofiber') < 13; i++) {
    harvestVoxel({ blockId: 'grass', toolTier: 0, rng: createSimulationRng(`fiber-${i}`) });
  }
  for (let i = 0; getItemCount('stone') < 3; i++) {
    collectStone(i, 1, 0, createSimulationRng(`stone-${i}`));
  }
  return deadwood;
}

function buildSealedRoom() {
  placePiece(LOWER, 3, 'foundation', 'wood', 2);
  placePiece(UPPER, 2, 'ceiling', 'wood', 2);
  for (const face of [0, 1, 4, 5]) placePiece(LOWER, face, 'tall_wall', 'wood', 2);
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  setLocalPersistenceMode('offline');
  resetInventory();
  resetMaw();
  resetProgression();
  resetVitals();
  resetWaterskin();
  resetStructures();
  resetCampfires();
  resetForagePickup();
  resetStonePickup();
  setFreeBuild(false);
  loadTestTerrain();
});

describe('primitive demo golden loop', () => {
  it('gathers, crafts, shelters, recovers, respawns, and reloads without debug grants', () => {
    const gatheredDeadwood = gatherPrimitiveLoadout();
    expect(craft(RECIPES.stone_hatchet, craftContext).ok).toBe(true);
    expect(craft(RECIPES.stone_pickaxe, craftContext).ok).toBe(true);
    expect(craft(RECIPES.waterskin, craftContext).ok).toBe(true);
    expect(craft(RECIPES.biofuel, craftContext).ok).toBe(true);
    expect(craft(RECIPES.biofuel, craftContext).ok).toBe(true);

    // Three real stone breaks deterministically fund both visible fire recipes.
    harvestVoxel({ blockId: 'stone', toolTier: 1 });
    harvestVoxel({ blockId: 'stone', toolTier: 1 });
    harvestVoxel({ blockId: 'stone', toolTier: 1 });
    expect(getItemCount('flint')).toBe(3);
    expect(craft(RECIPES.torch, craftContext).ok).toBe(true);
    expect(getItemCount('torch')).toBe(1);
    expect(craft(RECIPES.campfire, craftContext).ok).toBe(true);
    expect(removeItem('campfire', 1)).toBe(true);
    placeCampfire(new THREE.Vector3(0, 60, 0), new THREE.Vector3(0, 1, 0));

    buildSealedRoom();
    expect(analyzeShelterCell(LOWER).sheltered).toBe(true);

    setVitals({ warmth: 25, health: 100 });
    tickVitals(10, true, undefined, {
      daylight: 0,
      sheltered: true,
      nearFire: true,
      warmthEnabled: true
    });
    expect(getVitals().warmth).toBe(55);

    const inventoryBeforeDowned = getItemCount('wood');
    setVitals({ health: 0 });
    const home = findShelterSpawn(new THREE.Vector3(20, 60, 0));
    expect(home).not.toBeNull();
    const commandContext = createOfflineCommandContext(WORLD, {
      rng: createSimulationRng('primitive-loop-respawn')
    });
    expect(respawnCommand(commandContext, { position: home!.position, up: home!.up }).ok).toBe(true);
    setPlayerWorldPosition(home!.position);
    setPlayerLook(new THREE.Vector3(0, 0, -1), 0.15);
    expect(getVitals().health).toBe(100);
    expect(getItemCount('wood')).toBe(inventoryBeforeDowned);

    fillWaterskin(55);
    voxelSystem.removeVoxel(0, 1, 0);
    voxelSystem.exposeNeighbors(0, 1, 0);

    const savedWood = getItemCount('wood');
    const savedWarmth = getVitals().warmth;
    saveGlobal(WORLD);
    saveWorld(WORLD);
    savePlayerPose(WORLD);
    saveVoxelEdits(WORLD);

    resetInventory();
    resetVitals();
    resetStructures();
    resetCampfires();
    resetForagePickup();
    resetStonePickup();
    resetWaterskin();
    loadTestTerrain();
    const globalSave = loadGlobal();
    expect(globalSave).not.toBeNull();
    restoreGlobal(globalSave!);
    restoreStructuresForWorld(WORLD);
    restoreCampfiresForWorld(WORLD);
    restoreForageForWorld(WORLD);
    restoreStonesForWorld(WORLD);
    restoreVoxelEditsForWorld(WORLD);

    expect(getItemCount('wood')).toBe(savedWood);
    expect(getVitals().warmth).toBe(savedWarmth);
    expect(getWaterskinFill()).toBe(55);
    expect(getPieces()).toHaveLength(10);
    expect(getCampfires()).toHaveLength(1);
    expect(isForageCollected(...gatheredDeadwood[0]!)).toBe(true);
    expect(isStoneCollected(0, 1, 0)).toBe(true);
    expect(voxelSystem.isDeleted(0, 1, 0)).toBe(true);
    expect(loadPlayerPose(WORLD)).toMatchObject({
      pos: home!.position.toArray(),
      pitch: 0.15
    });
    expect(analyzeShelterCell(LOWER).sheltered).toBe(true);
    expect(findShelterSpawn(new THREE.Vector3(20, 60, 0))).not.toBeNull();
  });
});
