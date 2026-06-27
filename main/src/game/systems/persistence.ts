// --- Persistence (localStorage save/load) ------------------------------------
//
// Survives reloads / dev-server restarts so you don't rebuild your base every test.
// Two scopes, both keyed by GENERATION_SCHEMA_VERSION (a schema bump silently drops
// stale saves — see schema.ts):
//   GLOBAL    pvx.v{N}.global        inventory + maw charge + era/milestones + lastWorld
//   PER-WORLD pvx.v{N}.world.{worldId} structures + campfires + harvested trees + stones
//             (these are WORLD-RELATIVE coords, so keyed by coordinate-derived worldId)
//
// Loadout is DERIVED from inventory — not persisted separately. Terrain voxel edits
// are NOT persisted here (separate concern in efficientVoxelSystem).

import { GENERATION_SCHEMA_VERSION } from '../schema.ts';
import { getInventory, resetInventory, addItem } from './inventorySystem.ts';
import { getMawCharge, setMawCharge } from './mawSystem.ts';
import { getCurrentEra, getMilestones, advanceEraTo, markMilestone } from './progressionSystem.ts';
import { getPieces, restorePieces, type StructurePiece } from './structureSystem.ts';
import { getCampfires, restoreCampfires, type Campfire } from './campfires.ts';
import { getHarvestedTrees, markTreeHarvested } from './treeHarvest.ts';
import { getCollectedStones, markStoneCollected } from './stonePickup.ts';
import { getCollectedForage, markForageCollected } from './foragePickup.ts';
import { voxelSystem } from '../../utils/efficientVoxelSystem.ts';
import { getPlayerWorldPosition, getPlayerLook } from '../../state/playerFrame.ts';
import { getVitals, setVitals, type VitalsState } from './survivalVitals.ts';
import { getWaterskinFill, setWaterskinFill } from './consumeSystem.ts';
import type { ItemId } from '../data/items.ts';
import type { EraId } from '../data/eras.ts';
import type { CurrentWorld, WorldCoordinate } from '../../utils/worldCoordinates.ts';
import type { WorldIdentity } from '../worldIdentity.ts';

const PREFIX = `pvx.v${GENERATION_SCHEMA_VERSION}`;
const GLOBAL_KEY = `${PREFIX}.global`;
export type LocalPersistenceMode = 'offline' | 'multiplayer';
type WorldSaveRef = number | Pick<WorldIdentity, 'worldId' | 'seed'> | CurrentWorld;

let localPersistenceMode: LocalPersistenceMode = 'offline';

export function setLocalPersistenceMode(mode: LocalPersistenceMode): void {
  localPersistenceMode = mode;
}

export function getLocalPersistenceMode(): LocalPersistenceMode {
  return localPersistenceMode;
}

export function isLocalPersistenceEnabled(): boolean {
  return localPersistenceMode === 'offline';
}

function isLegacySeed(ref: WorldSaveRef): ref is number {
  return typeof ref === 'number';
}

function legacySeed(ref: WorldSaveRef): number {
  return isLegacySeed(ref) ? ref : ref.seed;
}

function worldIdFor(ref: WorldSaveRef): string | null {
  return isLegacySeed(ref) ? null : ref.worldId;
}

function scopedWorldKey(ref: WorldSaveRef, suffix = ''): { primary: string; legacy?: string } {
  const worldId = worldIdFor(ref);
  const legacy = `${PREFIX}.world.${legacySeed(ref)}${suffix}`;
  // Seed-only callers have no recoverable coordinate. Keep them quarantined in
  // the legacy namespace; only a world-aware ref is allowed to promote legacy
  // data into a coordinate-derived worldId key.
  if (!worldId) return { primary: legacy };
  return { primary: `${PREFIX}.world.${worldId}${suffix}`, legacy };
}

function storage(): Storage | null {
  if (!isLocalPersistenceEnabled()) return null;
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
function readScoped<T>(keys: { primary: string; legacy?: string }): T | null {
  const primary = read<T>(keys.primary);
  if (primary || !keys.legacy) return primary;
  const legacy = read<T>(keys.legacy);
  if (legacy) write(keys.primary, legacy);
  return legacy;
}

// --- Global ------------------------------------------------------------------
export interface GlobalSave {
  inventory: Partial<Record<ItemId, number>>;
  mawCharge: number;
  era: EraId;
  milestones: string[];
  lastWorld: WorldCoordinate | null;
  dayPhase?: number;       // time-of-day to resume at (0..1); SkyController offset
  vitals?: VitalsState;    // survival meters (health/hunger/thirst/warmth/stamina)
  waterskin?: number;      // carried-water fill level
}

export function saveGlobal(lastWorld: WorldCoordinate | null, dayPhase?: number): void {
  const data: GlobalSave = {
    inventory: getInventory(), mawCharge: getMawCharge(), era: getCurrentEra(),
    milestones: getMilestones(), lastWorld, dayPhase, vitals: getVitals(), waterskin: getWaterskinFill()
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
  if (save.vitals) setVitals(save.vitals);
  if (save.waterskin != null) setWaterskinFill(save.waterskin);
}

// --- Per-world ---------------------------------------------------------------
interface WorldSave {
  worldId?: string;
  seed?: number;
  structures: StructurePiece[];
  campfires: Array<Omit<Campfire, 'id'>>;
  trees: Array<[number, number, number]>;
  stones: Array<[number, number, number]>;
  forage?: Array<[number, number, number]>;
}

export function saveWorld(world: WorldSaveRef): void {
  const data: WorldSave = {
    worldId: worldIdFor(world) ?? undefined,
    seed: legacySeed(world),
    structures: getPieces(),
    campfires: getCampfires().map(({ id: _id, ...campfire }) => campfire),
    trees: getHarvestedTrees(),
    stones: getCollectedStones(),
    forage: getCollectedForage()
  };
  write(scopedWorldKey(world).primary, data);
}

function loadWorld(world: WorldSaveRef): WorldSave | null {
  return readScoped<WorldSave>(scopedWorldKey(world));
}

// Per-field restores — each field calls its own in its reset-then-load effect, so
// entering a world (boot OR warp) clears memory then loads THAT world's data.
export function restoreStructuresForWorld(world: WorldSaveRef): void {
  const w = loadWorld(world); if (w?.structures) restorePieces(w.structures);
}
export function restoreCampfiresForWorld(world: WorldSaveRef): void {
  const w = loadWorld(world); if (w?.campfires) restoreCampfires(w.campfires);
}
export function restoreTreesForWorld(world: WorldSaveRef): void {
  const w = loadWorld(world); if (w?.trees) for (const t of w.trees) markTreeHarvested(t[0], t[1], t[2]);
}
export function restoreStonesForWorld(world: WorldSaveRef): void {
  const w = loadWorld(world); if (w?.stones) for (const s of w.stones) markStoneCollected(s[0], s[1], s[2]);
}
export function restoreForageForWorld(world: WorldSaveRef): void {
  const w = loadWorld(world); if (w?.forage) for (const f of w.forage) markForageCollected(f[0], f[1], f[2]);
}

// --- Terrain voxel edits (SEPARATE key per world) ---------------------------
// Kept out of the WorldSave blob so a big dig doesn't re-serialize on every
// unrelated autosave and can't take structures down with it on a quota error.
interface VoxelSave {
  worldId?: string;
  seed?: number;
  generationSchemaVersion?: number;
  fingerprint: number;                          // original-terrain size (gen canary)
  removed: Array<[number, number, number]>;     // dug-out coords
  added: Array<[number, number, number]>;       // FUTURE: player-placed blocks
}

// --- Player pose (per world: where you stood + which way you faced) ----------
interface PlayerPose {
  pos: [number, number, number];
  forward: [number, number, number];
  pitch: number;
}
export function savePlayerPose(world: WorldSaveRef): void {
  const p = getPlayerWorldPosition();
  const look = getPlayerLook();
  const data: PlayerPose = {
    pos: [p.x, p.y, p.z],
    forward: [look.forward.x, look.forward.y, look.forward.z],
    pitch: look.pitch
  };
  write(scopedWorldKey(world, '.player').primary, data);
}

/** Saved pose for a world, or null. EfficientScene uses `pos` as the spawn point and
 *  seeds the camera look from `forward`/`pitch` (via setPlayerLook) before mount. */
export function loadPlayerPose(world: WorldSaveRef): PlayerPose | null {
  return readScoped<PlayerPose>(scopedWorldKey(world, '.player'));
}

export function saveVoxelEdits(world: WorldSaveRef): void {
  const data: VoxelSave = {
    worldId: worldIdFor(world) ?? undefined,
    seed: legacySeed(world),
    generationSchemaVersion: GENERATION_SCHEMA_VERSION,
    fingerprint: voxelSystem.getOriginalTerrainSize(),
    removed: voxelSystem.getDeletedVoxels(),
    added: []
  };
  write(scopedWorldKey(world, '.voxels').primary, data);
}

/** Replay this world's terrain diff. Call AFTER populateInitialTerrain (so coords are
 *  solid) and BEFORE the collision flush. Refuses a stale save (gen fingerprint
 *  mismatch). Must run synchronously while the live world matches `seed`. */
export function restoreVoxelEditsForWorld(world: WorldSaveRef): void {
  const save = readScoped<VoxelSave>(scopedWorldKey(world, '.voxels'));
  if (!save) return;
  if (save.generationSchemaVersion != null && save.generationSchemaVersion !== GENERATION_SCHEMA_VERSION) return;
  if (save.fingerprint !== voxelSystem.getOriginalTerrainSize()) return; // terrain gen changed → drop
  voxelSystem.applyTerrainDiff(save.removed ?? []);
}
