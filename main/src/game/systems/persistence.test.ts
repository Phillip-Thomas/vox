import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  saveGlobal, loadGlobal, restoreGlobal, saveWorld,
  restoreStructuresForWorld, restoreCampfiresForWorld, restoreTreesForWorld, restoreStonesForWorld,
  saveVoxelEdits, restoreVoxelEditsForWorld
} from './persistence.ts';
import { voxelSystem, type TerrainVoxel } from '../../utils/efficientVoxelSystem.ts';
import { addItem, getItemCount, resetInventory } from './inventorySystem.ts';
import { setMawCharge, getMawCharge, resetMaw } from './mawSystem.ts';
import { advanceEraTo, getCurrentEra, markMilestone, hasMilestone, resetProgression } from './progressionSystem.ts';
import { placePiece, getPieces, resetStructures, hasPanel, setFreeBuild } from './structureSystem.ts';
import { placeCampfire, getCampfires, resetCampfires } from './campfires.ts';
import { markTreeHarvested, isTreeHarvested, resetTreeHarvest } from './treeHarvest.ts';
import { collectStone, isStoneCollected, resetStonePickup } from './stonePickup.ts';

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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  resetInventory(); resetMaw(); resetProgression();
  resetStructures(); resetCampfires(); resetTreeHarvest(); resetStonePickup();
  setFreeBuild(true); // skip build cost in the round-trip
});

describe('global save round-trip', () => {
  it('restores inventory + maw charge + era + milestones + lastWorld', () => {
    addItem('wood', 7); addItem('stone', 3);
    setMawCharge(40); advanceEraTo('emergent'); markMilestone('maw_repaired');
    saveGlobal({ x: 5, y: -2 });

    resetInventory(); resetMaw(); resetProgression(); // wipe (simulate reload)
    const save = loadGlobal();
    expect(save).toBeTruthy();
    expect(save!.lastWorld).toEqual({ x: 5, y: -2 });
    restoreGlobal(save!);

    expect(getItemCount('wood')).toBe(7);
    expect(getItemCount('stone')).toBe(3);
    expect(getMawCharge()).toBe(40);
    expect(getCurrentEra()).toBe('emergent');
    expect(hasMilestone('maw_repaired')).toBe(true);
  });
});

describe('per-world save round-trip', () => {
  it('restores structures, campfires, harvested trees, collected stones', () => {
    placePiece([1, 2, 3], 3, 'foundation', 'wood');
    placePiece([1, 2, 3], 0, 'wall', 'wood');
    placeCampfire(new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 1, 0));
    markTreeHarvested(4, 5, 6);
    collectStone(7, 8, 9);
    saveWorld(SEED);

    resetStructures(); resetCampfires(); resetTreeHarvest(); resetStonePickup(); // wipe
    restoreStructuresForWorld(SEED);
    restoreCampfiresForWorld(SEED);
    restoreTreesForWorld(SEED);
    restoreStonesForWorld(SEED);

    expect(hasPanel(1, 2, 3, 3)).toBe(true);
    expect(hasPanel(1, 2, 3, 0)).toBe(true);
    expect(getCampfires()).toHaveLength(1);
    expect(isTreeHarvested(4, 5, 6)).toBe(true);
    expect(isStoneCollected(7, 8, 9)).toBe(true);
  });

  it('a different world seed does not load this world\'s data', () => {
    placePiece([1, 2, 3], 3, 'foundation', 'wood');
    saveWorld(SEED);
    resetStructures();
    restoreStructuresForWorld(SEED + 1); // a different planet
    expect(getPieces()).toHaveLength(0);
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

describe('no save present', () => {
  it('loadGlobal is null and per-world restores are no-ops', () => {
    expect(loadGlobal()).toBeNull();
    restoreStructuresForWorld(SEED);
    expect(getPieces()).toHaveLength(0);
  });
});
