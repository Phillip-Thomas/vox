import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  saveGlobal, loadGlobal, restoreGlobal, saveWorld,
  restoreStructuresForWorld, restoreCampfiresForWorld, restoreTreesForWorld, restoreStonesForWorld,
  saveVoxelEdits, restoreVoxelEditsForWorld,
  savePlayerPose, loadPlayerPose,
  getLocalPersistenceMode,
  isLocalPersistenceEnabled,
  setLocalPersistenceMode
} from './persistence.ts';
import { voxelSystem, type TerrainVoxel } from '../../utils/efficientVoxelSystem.ts';
import { setPlayerWorldPosition, setPlayerLook } from '../../state/playerFrame.ts';
import { addItem, getItemCount, resetInventory } from './inventorySystem.ts';
import { setMawCharge, getMawCharge, resetMaw } from './mawSystem.ts';
import { advanceEraTo, getCurrentEra, markMilestone, hasMilestone, resetProgression } from './progressionSystem.ts';
import { placePiece, getPieces, resetStructures, hasPanel, setFreeBuild } from './structureSystem.ts';
import { placeCampfire, getCampfires, resetCampfires } from './campfires.ts';
import { markTreeHarvested, isTreeHarvested, resetTreeHarvest } from './treeHarvest.ts';
import { collectStone, isStoneCollected, resetStonePickup } from './stonePickup.ts';
import { getVitals, setVitals, resetVitals } from './survivalVitals.ts';
import { collectForage, isForageCollected, resetForagePickup } from './foragePickup.ts';
import { getWaterskinFill, fillWaterskin, resetWaterskin } from './consumeSystem.ts';
import { restoreForageForWorld } from './persistence.ts';
import { createWorldIdentity } from '../worldIdentity.ts';
import { GENERATION_SCHEMA_VERSION } from '../schema.ts';

// localStorage isn't present in the vitest node env — stub a Map-backed one.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key() { return null; }
  get length() { return this.m.size; }
}

const SEED = 12345;
const PREFIX = `pvx.v${GENERATION_SCHEMA_VERSION}`;
const WORLD = createWorldIdentity({ x: 5, y: -2 });
const OTHER_WORLD = createWorldIdentity({ x: -4, y: 8 });
const worldKey = () => `${PREFIX}.world.${WORLD.worldId}`;
const legacyWorldKey = () => `${PREFIX}.world.${WORLD.seed}`;

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  setLocalPersistenceMode('offline');
  resetInventory(); resetMaw(); resetProgression();
  resetStructures(); resetCampfires(); resetTreeHarvest(); resetStonePickup(); resetVitals();
  resetForagePickup(); resetWaterskin();
  setFreeBuild(true); // skip build cost in the round-trip
});

describe('global save round-trip', () => {
  it('restores inventory + maw charge + era + milestones + lastWorld', () => {
    addItem('wood', 7); addItem('stone', 3);
    setMawCharge(40); advanceEraTo('emergent'); markMilestone('maw_repaired');
    setVitals({ health: 70, hunger: 55, thirst: 40, warmth: 88, stamina: 30 });
    fillWaterskin(55);
    saveGlobal({ x: 5, y: -2 });

    resetInventory(); resetMaw(); resetProgression(); resetVitals(); resetWaterskin(); // wipe (simulate reload)
    const save = loadGlobal();
    expect(save).toBeTruthy();
    expect(save!.lastWorld).toEqual({ x: 5, y: -2 });
    restoreGlobal(save!);

    expect(getItemCount('wood')).toBe(7);
    expect(getItemCount('stone')).toBe(3);
    expect(getMawCharge()).toBe(40);
    expect(getCurrentEra()).toBe('emergent');
    expect(hasMilestone('maw_repaired')).toBe(true);
    expect(getVitals()).toEqual({ health: 70, hunger: 55, thirst: 40, warmth: 88, stamina: 30, oxygen: 100 });
    expect(getWaterskinFill()).toBe(55);
  });
});

describe('per-world save round-trip', () => {
  it('restores structures, campfires, harvested trees, collected stones', () => {
    placePiece([1, 2, 3], 3, 'foundation', 'wood');
    placePiece([1, 2, 3], 0, 'wall', 'wood');
    placeCampfire(new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 1, 0));
    markTreeHarvested(4, 5, 6);
    collectStone(7, 8, 9);
    collectForage(2, 2, 2, 'berry');
    saveWorld(SEED);

    resetStructures(); resetCampfires(); resetTreeHarvest(); resetStonePickup(); resetForagePickup(); // wipe
    restoreStructuresForWorld(SEED);
    restoreCampfiresForWorld(SEED);
    restoreTreesForWorld(SEED);
    restoreStonesForWorld(SEED);
    restoreForageForWorld(SEED);

    expect(hasPanel(1, 2, 3, 3)).toBe(true);
    expect(hasPanel(1, 2, 3, 0)).toBe(true);
    expect(getCampfires()).toHaveLength(1);
    expect(isTreeHarvested(4, 5, 6)).toBe(true);
    expect(isStoneCollected(7, 8, 9)).toBe(true);
    expect(isForageCollected(2, 2, 2)).toBe(true);
  });

  it('a different world seed does not load this world\'s data', () => {
    placePiece([1, 2, 3], 3, 'foundation', 'wood');
    saveWorld(SEED);
    resetStructures();
    restoreStructuresForWorld(SEED + 1); // a different planet
    expect(getPieces()).toHaveLength(0);
  });

  it('writes world-id keys for world-aware save paths', () => {
    placePiece([1, 2, 3], 3, 'foundation', 'wood');

    saveWorld(WORLD);

    const storage = globalThis.localStorage;
    expect(storage.getItem(worldKey())).toBeTruthy();
    expect(storage.getItem(legacyWorldKey())).toBeNull();
  });

  it('migrates a legacy seed-keyed save when restoring with a known world identity', () => {
    placePiece([1, 2, 3], 3, 'foundation', 'wood');
    saveWorld(WORLD.seed);
    resetStructures();

    restoreStructuresForWorld(WORLD);

    expect(hasPanel(1, 2, 3, 3)).toBe(true);
    expect(globalThis.localStorage.getItem(worldKey())).toBeTruthy();
  });

  it('keeps orphan seed-only saves quarantined without a world identity', () => {
    placePiece([1, 2, 3], 3, 'foundation', 'wood');
    saveWorld(WORLD.seed);
    resetStructures();

    restoreStructuresForWorld(WORLD.seed);

    expect(hasPanel(1, 2, 3, 3)).toBe(true);
    expect(globalThis.localStorage.getItem(legacyWorldKey())).toBeTruthy();
    expect(globalThis.localStorage.getItem(worldKey())).toBeNull();
  });

  it('prefers the world-id save over a stale legacy seed save', () => {
    placePiece([1, 0, 0], 3, 'foundation', 'wood');
    saveWorld(WORLD.seed);
    resetStructures();
    placePiece([2, 0, 0], 3, 'foundation', 'wood');
    saveWorld(WORLD);
    resetStructures();

    restoreStructuresForWorld(WORLD);

    expect(hasPanel(2, 0, 0, 3)).toBe(true);
    expect(hasPanel(1, 0, 0, 3)).toBe(false);
  });
});

describe('terrain voxel edits round-trip', () => {
  const DIRS: Array<[number, number, number]> = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  function block(r: number): TerrainVoxel[] {
    const t: TerrainVoxel[] = [];
    for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) {
      t.push({ x, y, z, material: 'stone', color: new THREE.Color('gray') });
    }
    return t;
  }
  function surface(all: TerrainVoxel[]): TerrainVoxel[] {
    const set = new Set(all.map(v => `${v.x},${v.y},${v.z}`));
    return all.filter(v => DIRS.some(d => !set.has(`${v.x + d[0]},${v.y + d[1]},${v.z + d[2]}`)));
  }
  function mesh() {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial(), 2000);
    m.count = 0; return m;
  }
  function load(all: TerrainVoxel[]) {
    voxelSystem.reset();
    voxelSystem.setMesh(mesh());
    voxelSystem.populateInitialTerrain(all, surface(all), {});
  }

  it('saves a dig and replays it on a fresh load of the same world', () => {
    const all = block(1);
    load(all);
    voxelSystem.removeVoxel(0, 1, 0); voxelSystem.exposeNeighbors(0, 1, 0);
    saveVoxelEdits(777);

    load(all); // simulate reload: identical terrain regen
    expect(voxelSystem.isDeleted(0, 1, 0)).toBe(false); // gone after fresh populate
    restoreVoxelEditsForWorld(777);
    expect(voxelSystem.isDeleted(0, 1, 0)).toBe(true);  // dig restored
    expect(voxelSystem.hasVoxel(0, 1, 0)).toBe(false);
  });

  it('uses world-id keys and can migrates legacy seed-keyed voxel edits', () => {
    const all = block(1);
    load(all);
    voxelSystem.removeVoxel(0, 1, 0); voxelSystem.exposeNeighbors(0, 1, 0);
    saveVoxelEdits(WORLD.seed);

    load(all);
    restoreVoxelEditsForWorld(WORLD);

    expect(voxelSystem.isDeleted(0, 1, 0)).toBe(true);
    const raw = globalThis.localStorage.getItem(`${worldKey()}.voxels`);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).generationSchemaVersion).toBe(GENERATION_SCHEMA_VERSION);
  });

  it('persists deleted terrain as the durable diff without editVersion', () => {
    const all = block(1);
    load(all);
    voxelSystem.removeVoxel(0, 1, 0); voxelSystem.exposeNeighbors(0, 1, 0);

    saveVoxelEdits(WORLD);

    const raw = globalThis.localStorage.getItem(`${worldKey()}.voxels`);
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!);
    expect(saved.removed).toEqual([[0, 1, 0]]);
    expect(saved.fingerprint).toBe(all.length);
    expect(saved.editVersion).toBeUndefined();
  });

  it('does not restore one world id\'s voxel diff into another world', () => {
    const all = block(1);
    load(all);
    voxelSystem.removeVoxel(0, 1, 0); voxelSystem.exposeNeighbors(0, 1, 0);
    saveVoxelEdits(WORLD);

    load(all);
    restoreVoxelEditsForWorld(OTHER_WORLD);

    expect(voxelSystem.isDeleted(0, 1, 0)).toBe(false);
  });

  it('refuses a stale save when the generation fingerprint differs', () => {
    const all = block(1);
    load(all);
    voxelSystem.removeVoxel(0, 1, 0); voxelSystem.exposeNeighbors(0, 1, 0);
    saveVoxelEdits(888);

    load(block(2)); // terrain gen "changed" → different original-terrain size
    restoreVoxelEditsForWorld(888);
    expect(voxelSystem.isDeleted(0, 1, 0)).toBe(false); // refused, not applied
  });
});

describe('player pose + time-of-day', () => {
  it('round-trips time-of-day in the global save', () => {
    saveGlobal({ x: 0, y: 0 }, 0.42);
    expect(loadGlobal()!.dayPhase).toBeCloseTo(0.42);
  });

  it('round-trips player position + look per world', () => {
    setPlayerWorldPosition(new THREE.Vector3(12, -3, 40));
    setPlayerLook(new THREE.Vector3(1, 0, 0), 0.3);
    savePlayerPose(555);

    const p = loadPlayerPose(555);
    expect(p).toBeTruthy();
    expect(p!.pos).toEqual([12, -3, 40]);
    expect(p!.forward[0]).toBeCloseTo(1); // normalized +X
    expect(p!.pitch).toBeCloseTo(0.3);
    expect(loadPlayerPose(556)).toBeNull(); // different world: no pose
  });

  it('migrates legacy seed-keyed player pose to the world-id key', () => {
    setPlayerWorldPosition(new THREE.Vector3(4, 5, 6));
    setPlayerLook(new THREE.Vector3(0, 0, 1), 0.2);
    savePlayerPose(WORLD.seed);

    const p = loadPlayerPose(WORLD);

    expect(p?.pos).toEqual([4, 5, 6]);
    expect(globalThis.localStorage.getItem(`${worldKey()}.player`)).toBeTruthy();
  });
});

describe('no save present', () => {
  it('loadGlobal is null and per-world restores are no-ops', () => {
    expect(loadGlobal()).toBeNull();
    restoreStructuresForWorld(SEED);
    expect(getPieces()).toHaveLength(0);
  });
});

describe('multiplayer local persistence guard', () => {
  it('suppresses localStorage reads and writes while multiplayer owns truth', () => {
    setLocalPersistenceMode('multiplayer');
    expect(getLocalPersistenceMode()).toBe('multiplayer');
    expect(isLocalPersistenceEnabled()).toBe(false);

    addItem('wood', 7);
    saveGlobal({ x: 5, y: -2 });
    placePiece([1, 2, 3], 3, 'foundation', 'wood');
    saveWorld(WORLD);
    setPlayerWorldPosition(new THREE.Vector3(12, -3, 40));
    savePlayerPose(WORLD);

    expect(globalThis.localStorage.length).toBe(0);

    globalThis.localStorage.setItem(`${PREFIX}.global`, JSON.stringify({
      inventory: { wood: 99 },
      mawCharge: 0,
      era: 'primitive',
      milestones: [],
      lastWorld: { x: 1, y: 1 }
    }));
    expect(loadGlobal()).toBeNull();
    expect(loadPlayerPose(WORLD)).toBeNull();
  });
});
