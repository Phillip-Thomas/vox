import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  saveGlobal, loadGlobal, restoreGlobal, saveWorld,
  restoreStructuresForWorld, restoreCampfiresForWorld, restoreTreesForWorld, restoreStonesForWorld,
  restoreFloraForWorld,
  restoreHabitatForWorld,
  loadVoxelEditsForWorld, saveVoxelEdits, restoreVoxelEditsForWorld,
  savePlayerPose, loadPlayerPose,
  getLocalPersistenceMode,
  isLocalPersistenceEnabled,
  clearWorldStateForWorld,
  markMultiplayerResourceMarker,
  replaceMultiplayerResourceMarkers,
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
import { isFloraHarvested, markFloraHarvested, resetFloraHarvest } from './floraHarvest.ts';
import { getWaterskinFill, fillWaterskin, resetWaterskin } from './consumeSystem.ts';
import { restoreForageForWorld } from './persistence.ts';
import { createWorldIdentity } from '../worldIdentity.ts';
import { GENERATION_SCHEMA_VERSION } from '../schema.ts';
import { createPlanetIdentity } from '../starSystem.ts';
import {
  getAccomplishment,
  recordAccomplishment,
  resetAccomplishments
} from './accomplishmentLedger.ts';
import {
  attendObservation,
  getObservation,
  keepObservation,
  resetObservations
} from './observationLedger.ts';
import {
  commitShipRepairStage,
  getShipRestorationSnapshot,
  resetShipRestoration,
  setShipRestorationLocation
} from './shipRestoration.ts';
import {
  clearHabitatWorld,
  commitHabitatCorePlacement,
  commitHabitatSafeRest,
  commitHabitatShelterCertification,
  getHabitatWorldState,
  resetHabitats
} from './habitatSystem.ts';

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
  resetForagePickup(); resetFloraHarvest(); resetWaterskin();
  resetAccomplishments(); resetObservations(); resetShipRestoration(); resetHabitats();
  setFreeBuild(true); // skip build cost in the round-trip
});

describe('global save round-trip', () => {
  it('restores inventory, progression, survival, narrative ledgers, and ship state', () => {
    addItem('wood', 7); addItem('stone', 3);
    setMawCharge(40); advanceEraTo('emergent'); markMilestone('maw_repaired');
    setVitals({ health: 70, hunger: 55, thirst: 40, warmth: 88, stamina: 30 });
    fillWaterskin(55);
    recordAccomplishment('maw_repaired', { id: 'repair:power-restored' });
    attendObservation(
      'maw.hum.changed',
      { id: 'audio:maw-hum' },
      { id: 'attend:maw-hum' }
    );
    keepObservation('maw.hum.changed', { id: 'keep:maw-hum' }, 'variant:protective');
    expect(commitShipRepairStage('repair:bench-online', 'bench_online').ok).toBe(true);
    setShipRestorationLocation({
      currentSystemId: '5,-2',
      currentWorldId: '5,-2',
      parkedPose: { position: [6, 52.5, -3], quaternion: [0, 0, 0, 1] },
      systemPose: {
        position: [6, 52.5, -3],
        velocity: [0, 0, 0],
        quaternion: [0, 0, 0, 1]
      },
      locationMode: 'surface'
    });
    saveGlobal({ x: 5, y: -2 });

    resetInventory(); resetMaw(); resetProgression(); resetVitals(); resetWaterskin();
    resetAccomplishments(); resetObservations(); resetShipRestoration(); // wipe (simulate reload)
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
    expect(getAccomplishment('maw_repaired')?.evidenceHistory).toHaveLength(1);
    expect(getObservation('maw.hum.changed')).toMatchObject({
      acknowledgement: 'kept',
      interpretationVariantId: 'variant:protective',
      revisionHistory: [{ kind: 'attend' }, { kind: 'keep' }]
    });
    expect(getShipRestorationSnapshot()).toMatchObject({
      repairStage: 'bench_online',
      repairHistory: [{ eventId: 'repair:bench-online', from: 'wrecked', to: 'bench_online' }],
      currentSystemId: '5,-2',
      currentWorldId: '5,-2',
      locationMode: 'surface',
      parkedPose: { position: [6, 52.5, -3], quaternion: [0, 0, 0, 1] },
      systemPose: { position: [6, 52.5, -3], velocity: [0, 0, 0] }
    });
  });

  it('treats legacy saves without ledger fields as empty ledgers', () => {
    recordAccomplishment('stale_fact', { id: 'stale:evidence' });
    attendObservation('stale.observation', { id: 'stale:evidence' }, { id: 'stale:attend' });

    restoreGlobal({
      inventory: {},
      mawCharge: 0,
      era: 'primitive',
      milestones: [],
      lastWorld: null
    });

    expect(getAccomplishment('stale_fact')).toBeUndefined();
    expect(getObservation('stale.observation')).toBeUndefined();
  });

  it('stores a canonical secondary planet while retaining the legacy coordinate', () => {
    const planet = createPlanetIdentity({ system: { x: 5, y: -2 }, slot: 1 });
    saveGlobal(planet);

    expect(loadGlobal()).toMatchObject({
      lastWorld: { x: 5, y: -2 },
      lastPlanetWorldId: '5,-2:p1'
    });
  });
});

describe('per-world save round-trip', () => {
  it('persists an installed Habitat Core with its chosen world-local site', () => {
    expect(commitHabitatCorePlacement({
      actorId: 'terra',
      worldId: WORLD.worldId,
      shelterId: `habitat:${WORLD.worldId}:1,2,3`,
      cell: [1, 2, 3],
      supportCell: [1, 1, 3],
      position: [2, 4.24, 6],
      up: [0, 1, 0],
      eventId: 'habitat:online'
    })).toBe(true);
    expect(commitHabitatShelterCertification(WORLD.worldId, {
      shelterId: `habitat:${WORLD.worldId}:1,2,3`,
      cell: [1, 2, 3],
      insulation: 0.5,
      interiorCellCount: 2,
      eventId: 'habitat:certified'
    })).toBe(true);
    expect(commitHabitatSafeRest(WORLD.worldId, {
      shelterId: `habitat:${WORLD.worldId}:1,2,3`,
      dayPhase: 0.75,
      eventId: 'habitat:rest'
    })).toBe(true);
    saveWorld(WORLD);
    clearHabitatWorld(WORLD.worldId);

    restoreHabitatForWorld(WORLD);
    expect(getHabitatWorldState(WORLD.worldId)).toMatchObject({
      core: {
        shelterId: `habitat:${WORLD.worldId}:1,2,3`,
        cell: [1, 2, 3],
        eventId: 'habitat:online'
      },
      shelterCertification: { eventId: 'habitat:certified' },
      safeRest: { eventId: 'habitat:rest', dayPhase: 0.75 }
    });
  });

  it('restores structures, campfires, and every harvested surface resource', () => {
    placePiece([1, 2, 3], 3, 'foundation', 'wood');
    placePiece([1, 2, 3], 0, 'wall', 'wood');
    placePiece([2, 2, 3], 0, 'tall_wall', 'wood', 2);
    placeCampfire(new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 1, 0));
    markTreeHarvested(4, 5, 6);
    collectStone(7, 8, 9);
    collectForage(2, 2, 2, 'berry');
    markFloraHarvested(3, 3, 3);
    saveWorld(SEED);

    resetStructures(); resetCampfires(); resetTreeHarvest(); resetStonePickup(); resetForagePickup(); resetFloraHarvest(); // wipe
    restoreStructuresForWorld(SEED);
    restoreCampfiresForWorld(SEED);
    restoreTreesForWorld(SEED);
    restoreStonesForWorld(SEED);
    restoreForageForWorld(SEED);
    restoreFloraForWorld(SEED);

    expect(hasPanel(1, 2, 3, 3)).toBe(true);
    expect(hasPanel(1, 2, 3, 0)).toBe(true);
    expect(hasPanel(2, 2, 3, 0)).toBe(true);
    expect(hasPanel(2, 3, 3, 0)).toBe(true);
    expect(getCampfires()).toHaveLength(1);
    expect(isTreeHarvested(4, 5, 6)).toBe(true);
    expect(isStoneCollected(7, 8, 9)).toBe(true);
    expect(isForageCollected(2, 2, 2)).toBe(true);
    expect(isFloraHarvested(3, 3, 3)).toBe(true);
  });

  it('a different world seed does not load this world\'s data', () => {
    placePiece([1, 2, 3], 3, 'foundation', 'wood');
    saveWorld(SEED);
    resetStructures();
    restoreStructuresForWorld(SEED + 1); // a different planet
    expect(getPieces()).toHaveLength(0);
  });

  it('keeps harvested-tree markers scoped to their canonical world id', () => {
    markTreeHarvested(4, 5, 6);
    saveWorld(WORLD);
    resetTreeHarvest();

    restoreTreesForWorld(OTHER_WORLD);
    expect(isTreeHarvested(4, 5, 6)).toBe(false);

    restoreTreesForWorld(WORLD);
    expect(isTreeHarvested(4, 5, 6)).toBe(true);
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

  it('clears only the target save without mutating another live world', () => {
    placePiece([1, 0, 0], 3, 'foundation', 'wood');
    saveWorld(WORLD);
    resetStructures();
    placePiece([9, 0, 0], 3, 'foundation', 'wood');

    clearWorldStateForWorld(WORLD);

    expect(getPieces()).toHaveLength(1);
    expect(hasPanel(9, 0, 0, 3)).toBe(true);
    expect(globalThis.localStorage.getItem(worldKey())).toBeNull();
    saveWorld(OTHER_WORLD);
    resetStructures();
    restoreStructuresForWorld(OTHER_WORLD);
    expect(hasPanel(9, 0, 0, 3)).toBe(true);
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
    expect(loadVoxelEditsForWorld(777)).toEqual({
      fingerprint: all.length,
      removed: [[0, 1, 0]]
    });

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

  it('replays cached authoritative tree markers after a destination field remount', () => {
    setLocalPersistenceMode('multiplayer');
    replaceMultiplayerResourceMarkers(WORLD.worldId, {
      trees: [[4, 5, 6]],
      stones: [[7, 8, 9]],
      forage: [[2, 3, 4]],
      flora: [[12, 13, 14]]
    });

    // Mirrors each destination field's reset-then-restore mount effect after the
    // world_snapshot arrived during an in-progress party warp.
    resetTreeHarvest();
    resetStonePickup();
    resetForagePickup();
    resetFloraHarvest();
    restoreTreesForWorld(WORLD);
    restoreStonesForWorld(WORLD);
    restoreForageForWorld(WORLD);
    restoreFloraForWorld(WORLD);

    expect(isTreeHarvested(4, 5, 6)).toBe(true);
    expect(isStoneCollected(7, 8, 9)).toBe(true);
    expect(isForageCollected(2, 3, 4)).toBe(true);
    expect(isFloraHarvested(12, 13, 14)).toBe(true);

    markMultiplayerResourceMarker(WORLD.worldId, 'tree', [10, 11, 12]);
    resetTreeHarvest();
    restoreTreesForWorld(WORLD);
    expect(isTreeHarvested(4, 5, 6)).toBe(true);
    expect(isTreeHarvested(10, 11, 12)).toBe(true);
    expect(globalThis.localStorage.length).toBe(0);
  });
});
