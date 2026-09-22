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
// The chapter-13 store lives in the PURE state module, not in its director:
// the director reaches storyState, storyState reaches this file, and importing
// the director here would close that loop. Same reason, same shape, as habitat.
import {
  clearCommonGroundWorld,
  settleCommonGroundIfNothingStaged,
  serializeCommonGroundForWorld,
  stageCommonGroundWorldPayload
} from '../../story/commonGroundState.ts';
import { getInventory, resetInventory, addItem } from './inventorySystem.ts';
import { getMawCharge, setMawCharge } from './mawSystem.ts';
import { getCurrentEra, getMilestones, advanceEraTo, markMilestone } from './progressionSystem.ts';
import { getPieces, restorePieces, type StructurePiece } from './structureSystem.ts';
import { getCampfires, resetCampfires, restoreCampfires, type Campfire } from './campfires.ts';
import { getHarvestedTrees, markTreeHarvested } from './treeHarvest.ts';
import { getCollectedStones, markStoneCollected } from './stonePickup.ts';
import { getCollectedForage, markForageCollected } from './foragePickup.ts';
import { getHarvestedFlora, markFloraHarvested } from './floraHarvest.ts';
import { voxelSystem } from '../../utils/efficientVoxelSystem.ts';
import { getPlayerWorldPosition, getPlayerLook } from '../../state/playerFrame.ts';
import { getVitals, setVitals, type VitalsState } from './survivalVitals.ts';
import { getWaterskinFill, setWaterskinFill } from './consumeSystem.ts';
import {
  applyAccomplishmentLedgerSnapshot,
  getAccomplishmentLedgerSnapshot,
  resetAccomplishments,
  type AccomplishmentLedgerSnapshot
} from './accomplishmentLedger.ts';
import {
  applyObservationLedgerSnapshot,
  getObservationLedgerSnapshot,
  resetObservations,
  type ObservationLedgerSnapshot
} from './observationLedger.ts';
import {
  applyShipRestorationSnapshot,
  getShipRestorationSnapshot,
  resetShipRestoration,
  type ShipRestorationState
} from './shipRestoration.ts';
import {
  applyHabitatWorldSnapshot,
  clearHabitatWorld,
  getHabitatWorldSnapshot,
  type HabitatWorldState
} from './habitatSystem.ts';
import type { ItemId } from '../data/items.ts';
import type { EraId } from '../data/eras.ts';
import type { CurrentWorld, WorldCoordinate } from '../../utils/worldCoordinates.ts';
import { coordinateKey } from '../../utils/worldCoordinates.ts';
import type { WorldIdentity } from '../worldIdentity.ts';

const PREFIX = `pvx.v${GENERATION_SCHEMA_VERSION}`;
const GLOBAL_KEY = `${PREFIX}.global`;
export type LocalPersistenceMode = 'offline' | 'multiplayer';
type WorldSaveRef = number | Pick<WorldIdentity, 'worldId' | 'seed'> | CurrentWorld;

let localPersistenceMode: LocalPersistenceMode = 'offline';
export interface MultiplayerResourceMarkers {
  trees: Array<[number, number, number]>;
  stones: Array<[number, number, number]>;
  forage: Array<[number, number, number]>;
  flora: Array<[number, number, number]>;
}
const multiplayerResourceMarkersByWorld = new Map<string, MultiplayerResourceMarkers>();

export function setLocalPersistenceMode(mode: LocalPersistenceMode): void {
  if (mode === 'offline' && localPersistenceMode !== 'offline') {
    multiplayerResourceMarkersByWorld.clear();
  }
  localPersistenceMode = mode;
}

export function getLocalPersistenceMode(): LocalPersistenceMode {
  return localPersistenceMode;
}

export function isLocalPersistenceEnabled(): boolean {
  return localPersistenceMode === 'offline';
}

/** Cache full authoritative markers so a destination Tree/Stone/Forage field
 * can reset on mount and still replay the snapshot that arrived during warp. */
export function replaceMultiplayerResourceMarkers(
  worldId: string,
  markers: MultiplayerResourceMarkers
): void {
  multiplayerResourceMarkersByWorld.set(worldId, {
    trees: markers.trees.map(coord => [...coord]),
    stones: markers.stones.map(coord => [...coord]),
    forage: markers.forage.map(coord => [...coord]),
    flora: markers.flora.map(coord => [...coord])
  });
}

export function markMultiplayerResourceMarker(
  worldId: string,
  source: 'tree' | 'loose_stone' | 'forage' | 'flora',
  coord: [number, number, number]
): void {
  const markers = multiplayerResourceMarkersByWorld.get(worldId) ?? {
    trees: [],
    stones: [],
    forage: [],
    flora: []
  };
  const list = source === 'tree'
    ? markers.trees
    : source === 'loose_stone'
      ? markers.stones
      : source === 'forage'
        ? markers.forage
        : markers.flora;
  if (!list.some(item => item[0] === coord[0] && item[1] === coord[1] && item[2] === coord[2])) {
    list.push([...coord]);
  }
  multiplayerResourceMarkersByWorld.set(worldId, markers);
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
  /** Canonical planet identity. Absent legacy saves resume on slot 0. */
  lastPlanetWorldId?: string;
  dayPhase?: number;       // time-of-day to resume at (0..1); SkyController offset
  vitals?: VitalsState;    // survival meters (health/hunger/thirst/warmth/stamina)
  waterskin?: number;      // carried-water fill level
  /** Durable actor accomplishments. Optional keeps pre-ledger saves readable. */
  accomplishments?: AccomplishmentLedgerSnapshot;
  /** Interpretive evidence/revisions. Never used as a Story prerequisite. */
  observations?: ObservationLedgerSnapshot;
  /** Versioned ship repair, location, and system-space state. */
  shipRestoration?: ShipRestorationState;
}

export function saveGlobal(lastWorld: WorldCoordinate | CurrentWorld | null, dayPhase?: number): void {
  const coordinate = lastWorld && 'coordinate' in lastWorld
    ? lastWorld.coordinate
    : lastWorld;
  const lastPlanetWorldId = lastWorld && 'worldId' in lastWorld
    ? lastWorld.worldId
    : coordinate
      ? coordinateKey(coordinate)
      : undefined;
  const data: GlobalSave = {
    inventory: getInventory(), mawCharge: getMawCharge(), era: getCurrentEra(),
    milestones: getMilestones(), lastWorld: coordinate, lastPlanetWorldId, dayPhase,
    vitals: getVitals(), waterskin: getWaterskinFill(),
    accomplishments: getAccomplishmentLedgerSnapshot(),
    observations: getObservationLedgerSnapshot(),
    shipRestoration: getShipRestorationSnapshot()
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
  resetAccomplishments();
  resetObservations();
  resetShipRestoration();
  if (save.accomplishments) applyAccomplishmentLedgerSnapshot(save.accomplishments);
  if (save.observations) applyObservationLedgerSnapshot(save.observations);
  if (save.shipRestoration) applyShipRestorationSnapshot(save.shipRestoration);
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
  /** Harvested procedural flora. Optional keeps legacy saves readable. */
  flora?: Array<[number, number, number]>;
  /** Installed/certified Habitat Core truth for this specific planet. */
  habitat?: HabitatWorldState;
  /**
   * Chapter 13's route/reference snapshot for this specific planet.
   *
   * WORLD SAVE ONLY. There is deliberately no GlobalSave field: the trace, the
   * offered span and the held references are facts about one place, and the
   * durable "this happened" lives where it already lives, in the milestone
   * ledger. Optional keeps every legacy save readable.
   */
  commonGround?: unknown;
}

export function saveWorld(world: WorldSaveRef): void {
  const worldId = worldIdFor(world);
  // An autosave for a world whose chapter state is not live must not DESTROY
  // that world's chapter state.
  //
  // `saveWorld` writes a whole new record, so an absent `commonGround` deletes
  // the saved one and a pristine placeholder overwrites it with emptiness. Both
  // happened: an earned, unfinished ch13 survey (4 samples, 2.09 walked) was
  // replaced by `phase: "idle"` during a Continue that had already moved on to
  // another world. `serializeCommonGroundForWorld` now answers null whenever it
  // has nothing authoritative to say, and the previously persisted blob is
  // carried forward untouched. Explicit clearing still owns removal:
  // `clearWorldStateForWorld` deletes the whole record, and a validated live
  // snapshot always writes itself. This retains bytes that belong to another
  // actor too — rejecting a foreign payload is a hydration decision, never a
  // licence for this actor's empty state to erase it.
  const liveCommonGround = worldId ? serializeCommonGroundForWorld(worldId) : null;
  const carriedCommonGround = liveCommonGround ?? (worldId ? loadWorld(world)?.commonGround : undefined);
  const data: WorldSave = {
    worldId: worldId ?? undefined,
    seed: legacySeed(world),
    structures: getPieces(),
    campfires: getCampfires().map(({ id: _id, ...campfire }) => campfire),
    trees: getHarvestedTrees(),
    stones: getCollectedStones(),
    forage: getCollectedForage(),
    flora: getHarvestedFlora(),
    ...(worldId ? { habitat: getHabitatWorldSnapshot(worldId) ?? undefined } : {}),
    ...(carriedCommonGround === undefined || carriedCommonGround === null
      ? {}
      : { commonGround: carriedCommonGround })
  };
  write(scopedWorldKey(world).primary, data);
}

function loadWorld(world: WorldSaveRef): WorldSave | null {
  return readScoped<WorldSave>(scopedWorldKey(world));
}

/** Clear one world's persisted player-authored state. Shared render-field stores
 * are intentionally left alone: the caller may currently be standing on a
 * different world, and clearing them would let that world's cleanup autosave an
 * empty base. Habitat truth is keyed by world and is safe to clear immediately.
 * The subsequent world/Story run remount performs the normal live reset+restore.
 * Terrain edits and pose use separate keys and are cleared by their helpers. */
export function clearWorldStateForWorld(world: WorldSaveRef): void {
  // The Habitat Core is live world-local truth as well as persisted state. An
  // explicit Story replay must clear it even in private/incognito contexts where
  // localStorage is unavailable; otherwise the next run can inherit a core while
  // its actor milestones were deliberately removed and deadlock settlement.
  const worldId = worldIdFor(world);
  if (worldId) clearHabitatWorld(worldId);
  // THIS WORLD ONLY. Clearing Origin must never take Tidegarden's chapter state
  // with it, and vice versa; the two-world arc has both.
  if (worldId) clearCommonGroundWorld(worldId);
  const store = storage();
  if (!store) return;
  const key = scopedWorldKey(world);
  try {
    store.removeItem(key.primary);
    if (key.legacy) store.removeItem(key.legacy);
  } catch {
    // Storage unavailable/blocked: the live Habitat truth was still cleared.
  }
}

// Per-field restores — each field calls its own in its reset-then-load effect, so
// entering a world (boot OR warp) clears memory then loads THAT world's data.
export function restoreStructuresForWorld(world: WorldSaveRef): void {
  const w = loadWorld(world); if (w?.structures) restorePieces(w.structures);
}
export function restoreCampfiresForWorld(world: WorldSaveRef): void {
  const w = loadWorld(world); if (w?.campfires) restoreCampfires(w.campfires);
}
export function restoreHabitatForWorld(world: WorldSaveRef): void {
  const worldId = worldIdFor(world);
  if (!worldId) return;
  const w = loadWorld(world);
  // Do not erase a newer live placement merely because autosave has not run
  // yet and a scene subtree remounted. Explicit world clearing removes both
  // persistence and the live map through clearWorldStateForWorld.
  if (w?.habitat) applyHabitatWorldSnapshot(worldId, w.habitat);
}

/**
 * Stage this world's chapter-13 blob. Identity (actor and world) is validated
 * at first live use, so a foreign or malformed payload initializes local state
 * instead of being grafted onto a live run.
 */
export function restoreCommonGroundForWorld(world: WorldSaveRef): void {
  const worldId = worldIdFor(world);
  if (!worldId) return;
  stageCommonGroundWorldPayload(worldId, loadWorld(world)?.commonGround ?? null);
  // A read that found NOTHING is a real answer ("no chapter state here", or a
  // legacy record without the field), and it settles the world immediately. A
  // read that found a payload settles nothing yet: the payload still has to be
  // validated into live state, and until it is, an empty snapshot must not
  // speak for this world. See `settleCommonGroundIfNothingStaged`.
  settleCommonGroundIfNothingStaged(worldId);
}

/**
 * Explicit scoped restart only; ordinary exits preserve the snapshot.
 *
 * This clears the STORED chapter field too. `saveWorld` now carries an
 * unrepresented blob forward, so clearing only the live and pending maps would
 * leave the payload on disk for the next save to resurrect — the opposite of an
 * explicit restart. Scoped exactly: this world's chapter field only. Structures,
 * campfires, habitat and every other world are untouched.
 */
export function clearCommonGroundForWorld(world: WorldSaveRef): void {
  const worldId = worldIdFor(world);
  if (!worldId) return;
  clearCommonGroundWorld(worldId);
  const stored = loadWorld(world);
  if (!stored || stored.commonGround === undefined) return;
  delete stored.commonGround;
  write(scopedWorldKey(world).primary, stored);
}
/** Drop a world's persisted campfires (memory + the saved blob, other fields kept).
 *  Story entry uses this so a dev-jump's debug pre-place fire — or any stale fire —
 *  never survives into a run that has not built one yet (the ch3-gather craft). */
export function clearCampfiresForWorld(world: WorldSaveRef): void {
  resetCampfires();
  const w = loadWorld(world);
  if (!w || !w.campfires || w.campfires.length === 0) return;
  w.campfires = [];
  write(scopedWorldKey(world).primary, w);
}
export function restoreTreesForWorld(world: WorldSaveRef): void {
  const replicated = multiplayerMarkersFor(world);
  if (replicated) {
    for (const t of replicated.trees) markTreeHarvested(t[0], t[1], t[2]);
    return;
  }
  const w = loadWorld(world); if (w?.trees) for (const t of w.trees) markTreeHarvested(t[0], t[1], t[2]);
}
export function restoreStonesForWorld(world: WorldSaveRef): void {
  const replicated = multiplayerMarkersFor(world);
  if (replicated) {
    for (const s of replicated.stones) markStoneCollected(s[0], s[1], s[2]);
    return;
  }
  const w = loadWorld(world); if (w?.stones) for (const s of w.stones) markStoneCollected(s[0], s[1], s[2]);
}
export function restoreForageForWorld(world: WorldSaveRef): void {
  const replicated = multiplayerMarkersFor(world);
  if (replicated) {
    for (const f of replicated.forage) markForageCollected(f[0], f[1], f[2]);
    return;
  }
  const w = loadWorld(world); if (w?.forage) for (const f of w.forage) markForageCollected(f[0], f[1], f[2]);
}
export function restoreFloraForWorld(world: WorldSaveRef): void {
  const replicated = multiplayerMarkersFor(world);
  if (replicated) {
    for (const f of replicated.flora) markFloraHarvested(f[0], f[1], f[2]);
    return;
  }
  const w = loadWorld(world); if (w?.flora) for (const f of w.flora) markFloraHarvested(f[0], f[1], f[2]);
}

function multiplayerMarkersFor(world: WorldSaveRef): MultiplayerResourceMarkers | null {
  if (localPersistenceMode !== 'multiplayer') return null;
  const worldId = worldIdFor(world);
  return worldId ? multiplayerResourceMarkersByWorld.get(worldId) ?? null : null;
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

export interface PersistedVoxelEdits {
  fingerprint: number;
  removed: ReadonlyArray<readonly [number, number, number]>;
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

/** Read a valid saved terrain diff without applying it to the singleton voxel owner. */
export function loadVoxelEditsForWorld(world: WorldSaveRef): PersistedVoxelEdits | null {
  const save = readScoped<VoxelSave>(scopedWorldKey(world, '.voxels'));
  if (!save) return null;
  if (
    save.generationSchemaVersion != null
    && save.generationSchemaVersion !== GENERATION_SCHEMA_VERSION
  ) return null;
  return {
    fingerprint: save.fingerprint,
    removed: save.removed ?? []
  };
}

/** Drop this world's persisted terrain diff (both the worldId-scoped key and the
 *  legacy seed key). Story dev flows use this so `?story=` sessions never inherit
 *  a strip-mined 2D era from earlier debug runs. */
export function clearVoxelEditsForWorld(world: WorldSaveRef): void {
  const store = storage();
  if (!store) return;
  const key = scopedWorldKey(world, '.voxels');
  try {
    store.removeItem(key.primary);
    if (key.legacy) store.removeItem(key.legacy);
  } catch {
    // Storage unavailable/blocked: nothing persisted, nothing to clear.
  }
}

/** Drop a world's saved player pose. The `?story=` dev flows clear it WITH the
 *  voxel edits: a pose saved at the bottom of a strip-mined pit would otherwise
 *  resurrect INSIDE the restored pristine terrain. */
export function clearPlayerPoseForWorld(world: WorldSaveRef): void {
  const store = storage();
  if (!store) return;
  const key = scopedWorldKey(world, '.player');
  try {
    store.removeItem(key.primary);
    if (key.legacy) store.removeItem(key.legacy);
  } catch {
    // Storage unavailable/blocked: nothing persisted, nothing to clear.
  }
}

/** Replay this world's terrain diff. Call AFTER populateInitialTerrain (so coords are
 *  solid) and BEFORE the collision flush. Refuses a stale save (gen fingerprint
 *  mismatch). Must run synchronously while the live world matches `seed`. */
export function restoreVoxelEditsForWorld(world: WorldSaveRef): void {
  const save = loadVoxelEditsForWorld(world);
  if (!save) return;
  if (save.fingerprint !== voxelSystem.getOriginalTerrainSize()) return; // terrain gen changed → drop
  voxelSystem.applyTerrainDiff(save.removed.map(position => [...position] as [number, number, number]));
}
