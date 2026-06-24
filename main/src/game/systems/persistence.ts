// --- Persistence (localStorage save/load) ------------------------------------
//
// Survives reloads / dev-server restarts so you don't rebuild your base every test.
// Two scopes, both keyed by GENERATION_SCHEMA_VERSION (a schema bump silently drops
// stale saves — see schema.ts):
//   GLOBAL    pvx.v{N}.global        inventory + maw charge + era/milestones + lastWorld
//   PER-WORLD pvx.v{N}.world.{seed}  structures + campfires + harvested trees + stones
//             (these are WORLD-RELATIVE coords, so keyed by the world's seed)
//
// Loadout is DERIVED from inventory — not persisted separately. Terrain voxel edits
// are NOT persisted here (separate concern in efficientVoxelSystem).

import { GENERATION_SCHEMA_VERSION } from '../schema.ts';
import { getInventory, resetInventory, addItem } from './inventorySystem.ts';
import { getMawCharge, setMawCharge } from './mawSystem.ts';
import { getCurrentEra, getMilestones, advanceEraTo, markMilestone } from './progressionSystem.ts';
import { getPieces, restorePieces, type StructurePiece } from './structureSystem.ts';
import { getCampfires, restoreCampfires } from './campfires.ts';
import { getHarvestedTrees, markTreeHarvested } from './treeHarvest.ts';
import { getCollectedStones, markStoneCollected } from './stonePickup.ts';
import type { ItemId } from '../data/items.ts';
import type { EraId } from '../data/eras.ts';
import type { WorldCoordinate } from '../../utils/worldCoordinates.ts';

const PREFIX = `pvx.v${GENERATION_SCHEMA_VERSION}`;
const GLOBAL_KEY = `${PREFIX}.global`;
const worldKey = (seed: number) => `${PREFIX}.world.${seed}`;

function storage(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}
function read<T>(key: string): T | null {
  const s = storage(); if (!s) return null;
  try { const raw = s.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
function write(key: string, value: unknown): void {
  const s = storage(); if (!s) return;
  try { s.setItem(key, JSON.stringify(value)); } catch { /* quota / serialization — ignore */ }
}

// --- Global ------------------------------------------------------------------
export interface GlobalSave {
  inventory: Partial<Record<ItemId, number>>;
  mawCharge: number;
  era: EraId;
  milestones: string[];
  lastWorld: WorldCoordinate | null;
}

export function saveGlobal(lastWorld: WorldCoordinate | null): void {
  const data: GlobalSave = {
    inventory: getInventory(), mawCharge: getMawCharge(), era: getCurrentEra(),
    milestones: getMilestones(), lastWorld
  };
  write(GLOBAL_KEY, data);
}

export function loadGlobal(): GlobalSave | null {
  return read<GlobalSave>(GLOBAL_KEY);
}

/** Restore the global stores (call once at boot, before gameplay components mount). */
export function restoreGlobal(save: GlobalSave): void {
  resetInventory();
  for (const [id, n] of Object.entries(save.inventory) as [ItemId, number][]) if (n > 0) addItem(id, n);
  setMawCharge(save.mawCharge ?? 0);
  if (save.era) advanceEraTo(save.era);
  for (const m of save.milestones ?? []) markMilestone(m);
}

// --- Per-world ---------------------------------------------------------------
interface WorldSave {
  structures: StructurePiece[];
  campfires: Array<{ pos: [number, number, number]; up: [number, number, number] }>;
  trees: Array<[number, number, number]>;
  stones: Array<[number, number, number]>;
}

export function saveWorld(seed: number): void {
  const data: WorldSave = {
    structures: getPieces(),
    campfires: getCampfires().map(c => ({ pos: c.pos, up: c.up })),
    trees: getHarvestedTrees(),
    stones: getCollectedStones()
  };
  write(worldKey(seed), data);
}

function loadWorld(seed: number): WorldSave | null {
  return read<WorldSave>(worldKey(seed));
}

// Per-field restores — each field calls its own in its reset-then-load effect, so
// entering a world (boot OR warp) clears memory then loads THAT world's data.
export function restoreStructuresForWorld(seed: number): void {
  const w = loadWorld(seed); if (w?.structures) restorePieces(w.structures);
}
export function restoreCampfiresForWorld(seed: number): void {
  const w = loadWorld(seed); if (w?.campfires) restoreCampfires(w.campfires);
}
export function restoreTreesForWorld(seed: number): void {
  const w = loadWorld(seed); if (w?.trees) for (const t of w.trees) markTreeHarvested(t[0], t[1], t[2]);
}
export function restoreStonesForWorld(seed: number): void {
  const w = loadWorld(seed); if (w?.stones) for (const s of w.stones) markStoneCollected(s[0], s[1], s[2]);
}
