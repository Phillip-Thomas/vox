import {
  applyInventorySnapshot,
  getInventorySnapshot,
  type InventorySnapshot
} from './systems/inventorySystem.ts';
import {
  applyVitalsSnapshot,
  getVitalsSnapshot,
  type VitalsSnapshot
} from './systems/survivalVitals.ts';
import {
  applyMawSnapshot,
  getMawSnapshot,
  type MawSnapshot
} from './systems/mawSystem.ts';
import {
  applyWaterskinSnapshot,
  getWaterskinSnapshot,
  type WaterskinSnapshot
} from './systems/consumeSystem.ts';
import {
  applyJetpackSnapshot,
  getJetpackSnapshot,
  type JetpackSnapshot
} from './systems/jetpackSystem.ts';
import {
  applyProgressionSnapshot,
  getProgressionSnapshot,
  type ProgressionSnapshot
} from './systems/progressionSystem.ts';
import {
  applyPlayerPoseSnapshot,
  getPlayerPoseSnapshot,
  type PlayerPoseSnapshot
} from './systems/playerPoseSystem.ts';
import {
  applyPlayerFlightSnapshot,
  getPlayerFlightSnapshot,
  type PlayerFlightSnapshot
} from './systems/playerFlightSystem.ts';
import {
  getPieces,
  resetStructures,
  restorePieces,
  type StructurePiece
} from './systems/structureSystem.ts';
import {
  getCampfires,
  resetCampfires,
  restoreCampfires,
  type Campfire
} from './systems/campfires.ts';
import {
  getHarvestedTrees,
  markTreeHarvested,
  resetTreeHarvest
} from './systems/treeHarvest.ts';
import {
  getCollectedStones,
  markStoneCollected,
  resetStonePickup
} from './systems/stonePickup.ts';
import {
  getCollectedForage,
  markForageCollected,
  resetForagePickup
} from './systems/foragePickup.ts';
import { voxelSystem } from '../utils/efficientVoxelSystem.ts';
import { GENERATION_SCHEMA_VERSION } from './schema.ts';

export interface VoxelDiffSnapshot {
  generationSchemaVersion: number;
  fingerprint: number;
  removed: Array<[number, number, number]>;
  added: Array<[number, number, number]>;
}

export interface GameSnapshot {
  schemaVersion: 1;
  players: {
    inventory: InventorySnapshot;
    vitals: VitalsSnapshot;
    maw: MawSnapshot;
    waterskin: WaterskinSnapshot;
    jetpack: JetpackSnapshot;
    progression: ProgressionSnapshot;
    pose: PlayerPoseSnapshot;
    flight: PlayerFlightSnapshot;
  };
  world: {
    structures: Array<Omit<StructurePiece, 'id'>>;
    campfires: Array<Omit<Campfire, 'id'>>;
    trees: Array<[number, number, number]>;
    stones: Array<[number, number, number]>;
    forage: Array<[number, number, number]>;
    voxels: VoxelDiffSnapshot;
  };
}

export interface ApplySnapshotOptions {
  replace?: boolean;
  /**
   * Apply voxel terrain diff now. Keep false until procedural baseline terrain has
   * been populated; callers must flush/rebuild collision immediately after.
   */
  applyVoxelDiff?: boolean;
}

export function snapshot(): GameSnapshot {
  return {
    schemaVersion: 1,
    players: {
      inventory: getInventorySnapshot(),
      vitals: getVitalsSnapshot(),
      maw: getMawSnapshot(),
      waterskin: getWaterskinSnapshot(),
      jetpack: getJetpackSnapshot(),
      progression: getProgressionSnapshot(),
      pose: getPlayerPoseSnapshot(),
      flight: getPlayerFlightSnapshot()
    },
    world: {
      structures: getPieces().map(({ id: _id, ...piece }) => piece),
      campfires: getCampfires().map(({ id: _id, ...campfire }) => campfire),
      trees: getHarvestedTrees(),
      stones: getCollectedStones(),
      forage: getCollectedForage(),
      voxels: getVoxelDiffSnapshot()
    }
  };
}

export function applySnapshot(state: GameSnapshot, options: ApplySnapshotOptions = {}): void {
  const replace = options.replace ?? true;

  applyInventorySnapshot(state.players.inventory, { replace });
  applyVitalsSnapshot(state.players.vitals, { replace });
  applyMawSnapshot(state.players.maw, { replace });
  applyWaterskinSnapshot(state.players.waterskin, { replace });
  applyJetpackSnapshot(state.players.jetpack ?? {}, { replace });
  applyProgressionSnapshot(state.players.progression ?? {}, { replace });
  applyPlayerPoseSnapshot(state.players.pose ?? {}, { replace });
  applyPlayerFlightSnapshot(state.players.flight ?? {}, { replace });

  if (replace) {
    resetStructures();
    resetCampfires();
    resetTreeHarvest();
    resetStonePickup();
    resetForagePickup();
  }

  restorePieces(state.world.structures);
  restoreCampfires(state.world.campfires);
  for (const [x, y, z] of state.world.trees) markTreeHarvested(x, y, z);
  for (const [x, y, z] of state.world.stones) markStoneCollected(x, y, z);
  for (const [x, y, z] of state.world.forage) markForageCollected(x, y, z);
  if (options.applyVoxelDiff) applyVoxelDiffSnapshot(state.world.voxels);
}

export function getVoxelDiffSnapshot(): VoxelDiffSnapshot {
  return {
    generationSchemaVersion: GENERATION_SCHEMA_VERSION,
    fingerprint: voxelSystem.getOriginalTerrainSize(),
    removed: voxelSystem.getDeletedVoxels(),
    added: []
  };
}

export function applyVoxelDiffSnapshot(diff: VoxelDiffSnapshot | undefined): boolean {
  if (!diff) return false;
  if (diff.generationSchemaVersion !== GENERATION_SCHEMA_VERSION) return false;
  if (diff.fingerprint !== voxelSystem.getOriginalTerrainSize()) return false;
  voxelSystem.applyTerrainDiff(diff.removed ?? []);
  return true;
}
