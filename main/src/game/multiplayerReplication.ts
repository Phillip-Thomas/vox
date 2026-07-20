import { createPlayerPose, type PlayerPose } from './playerPose.ts';
import { ECONOMY_CATALOG } from './data/generatedEconomyCatalog.ts';
import { getPlayerPose, setPlayerPose } from './systems/playerPoseSystem.ts';
import { addItem, applyInventorySnapshot, type InventorySnapshot } from './systems/inventorySystem.ts';
import { applyVitalsSnapshot, type VitalsSnapshot } from './systems/survivalVitals.ts';
import { applyMawSnapshot, type MawSnapshot } from './systems/mawSystem.ts';
import { applyWaterskinSnapshot, type WaterskinSnapshot } from './systems/consumeSystem.ts';
import {
  applyProgressionSnapshot,
  getProgressionSnapshot,
  hasMilestone,
  markMilestone,
  type ProgressionSnapshot
} from './systems/progressionSystem.ts';
import type { JsonObject } from './multiplayerClient.ts';
import { voxelSystem } from '../utils/efficientVoxelSystem.ts';
import { markTreeHarvested, resetTreeHarvest } from './systems/treeHarvest.ts';
import { markStoneCollected, resetStonePickup } from './systems/stonePickup.ts';
import { markForageCollected, resetForagePickup } from './systems/foragePickup.ts';
import { markFloraHarvested, resetFloraHarvest } from './systems/floraHarvest.ts';
import { isFloraHarvestKind } from './data/floraHarvest.ts';
import { restoreCampfires } from './systems/campfires.ts';
import {
  applyDoorLeaf,
  FACE_DIRS,
  getPieceAt,
  isStructurePieceSolid,
  removePieceWithoutRefund,
  restorePieces,
  setDoorOpen,
  VOLUME_FACE,
  type StructurePiece
} from './systems/structureSystem.ts';
import type { BuildMaterialId } from './data/buildMaterials.ts';
import { BUILD_PIECES, type BuildPieceType } from './data/buildPieces.ts';
import { notifyWorldCollisionChanged, type CollisionCell } from './worldCollisionReconciliation.ts';
import {
  markMultiplayerResourceMarker,
  replaceMultiplayerResourceMarkers
} from './systems/persistence.ts';
import {
  commitHabitatCorePlacement,
  commitHabitatSafeRest,
  commitHabitatShelterCertification,
  getHabitatWorldState,
  applyHabitatWorldSnapshot
} from './systems/habitatSystem.ts';
import {
  applyShipRestorationSnapshot,
  commitShipRepairStage
} from './systems/shipRestoration.ts';
import { WRECK_SALVAGE_MILESTONE } from './systems/shipRepairTransactions.ts';
import { emitEmergentStoryEvent } from '../story/emergentStoryEvents.ts';
import { commitStoryJetInstalled } from '../story/emergentCapabilities.ts';
import {
  applyAuthoritativeTidegardenSiteChoiceReceipt,
  tidegardenSiteChoiceMatchesCell
} from '../story/tidegardenSiteChoice.ts';
import {
  STORY_PRIMARY_WORLD_ID,
  TIDEGARDEN_WORLD_ID
} from '../story/tidegardenRoute.ts';
import {
  applyKestrelFoundingReserve,
  KESTREL_FOUNDING_RESERVE,
  KESTREL_FOUNDING_RESERVE_MILESTONE
} from '../story/kestrelFoundingReserve.ts';
import {
  clearAuthoritativeStructureReceipts,
  recordAuthoritativeStructureReceipt,
  removeAuthoritativeStructureReceipt
} from './authoritativeStructureReceipts.ts';

export interface RemotePoseUpdate {
  playerId: string;
  worldId: string;
  seq: number;
  pose: JsonObject;
}

export interface ReplicatedWorldEvent {
  seq: number;
  commandId?: string;
  type: string;
  playerId: string;
  payload: JsonObject;
  timeMs?: number;
}

export interface TerrainReplicationTarget {
  applyTerrainDiff(removed: ReadonlyArray<[number, number, number]>): void;
  getOriginalTerrainSize?(): number;
}

export interface WaterReplicationTarget {
  applyWaterFlood(cells: ReadonlyArray<[number, number, number]>): number;
}

export interface WorldEventApplyOptions {
  localPlayerId?: string | null;
  ignoreLocalPlayer?: boolean;
  worldId?: string;
  terrain?: TerrainReplicationTarget;
  water?: WaterReplicationTarget;
}

export interface WorldSnapshotApplyOptions extends WorldEventApplyOptions {
  /**
   * A full server snapshot owns the complete shared-resource truth. Clear any
   * offline/predicted markers before replay so stale local trees cannot remain
   * hidden merely because snapshots are otherwise additive and idempotent.
   */
  replaceResourceMarkers?: boolean;
}

export interface TerrainDiffReplayResult {
  applied: number;
  queued: number;
}

export interface WaterFloodReplayResult {
  applied: number;
  queued: number;
}

export interface WorldSnapshotReplayResult {
  applied: number;
  queuedTerrain: number;
  queuedWater: number;
}

export interface PlayerStateSnapshotApplyOptions {
  replace?: boolean;
}

const pendingTerrainDiffsByWorld = new Map<string, Array<[number, number, number]>>();
const pendingWaterFloodsByWorld = new Map<string, Array<[number, number, number]>>();
let activeTerrainWorldId: string | null = null;
let activeWaterWorldId: string | null = null;
let activeWaterTarget: WaterReplicationTarget | null = null;

export function toPosePayload(pose: PlayerPose): JsonObject {
  return { ...pose } as JsonObject;
}

export function applyRemotePoseUpdate(update: RemotePoseUpdate, localPlayerId: string | null): PlayerPose | null {
  if (update.playerId === localPlayerId) return null;
  const current = getPlayerPose(update.playerId);
  if (current && current.worldId === update.worldId && update.seq <= current.seq) return null;
  const pose = createPlayerPose({
    ...(update.pose as Partial<PlayerPose>),
    playerId: update.playerId,
    worldId: update.worldId,
    seq: update.seq
  });
  return setPlayerPose(pose);
}

export function applyRemotePoseSnapshot(
  snapshot: JsonObject,
  worldId: string,
  localPlayerId: string | null
): PlayerPose[] {
  const applied: PlayerPose[] = [];
  for (const [playerId, pose] of extractSnapshotPoseEntries(snapshot)) {
    const next = applyRemotePoseUpdate({
      playerId,
      worldId,
      seq: readPoseSeq(pose),
      pose
    }, localPlayerId);
    if (next) applied.push(next);
  }
  return applied;
}

export function applyReplicatedPlayerStateSnapshot(
  snapshot: JsonObject,
  options: PlayerStateSnapshotApplyOptions = {}
): boolean {
  const players = readObject(snapshot.players);
  if (!players) return false;
  const replace = options.replace ?? false;
  let applied = false;

  const inventory = sanitizeInventorySnapshot(players.inventory);
  if (inventory) {
    applyInventorySnapshot(inventory, { replace });
    applied = true;
  }

  const vitals = sanitizeVitalsSnapshot(players.vitals);
  if (vitals) {
    applyVitalsSnapshot(vitals, { replace });
    applied = true;
  }

  const maw = sanitizeNumberSnapshot(players.maw);
  if (maw) {
    applyMawSnapshot(maw as MawSnapshot, { replace });
    applied = true;
  }

  const waterskin = sanitizeNumberSnapshot(players.waterskin);
  if (waterskin) {
    applyWaterskinSnapshot(waterskin as WaterskinSnapshot, { replace });
    applied = true;
  }

  const progression = sanitizeProgressionSnapshot(players.progression);
  if (progression) {
    applyProgressionSnapshot(progression, {
      replace,
      // Camera/render/body receipts cannot be reconstructed by the state
      // server. Preserve only the progression system's explicit client-owned
      // allow-list; every economy and shared-story milestone remains replaced.
      preserveClientOwnedMilestones: true
    });
    // A player delta may replace the local actor's server-owned receipts while
    // another actor's accepted cache claim remains in the same client snapshot.
    // Re-project the world fact so the empty cache cannot become interactable.
    if (Object.values(getProgressionSnapshot()).some(state => (
      state.milestones.includes(WRECK_SALVAGE_MILESTONE)
    ))) markMilestone(WRECK_SALVAGE_MILESTONE);
    applied = true;
  }

  return applied;
}

export function applyReplicatedStoryStateSnapshot(
  snapshot: JsonObject,
  worldId: string
): boolean {
  const story = readObject(snapshot.story);
  if (!story) return false;
  let applied = false;

  const ship = readObject(story.ship);
  if (ship && isReplicatedShipStage(ship.repairStage)) {
    applyShipRestorationSnapshot({
      version: 1,
      repairStage: ship.repairStage,
      repairHistory: Array.isArray(ship.repairHistory) ? ship.repairHistory : [],
      currentSystemId: typeof ship.currentSystemId === 'string' ? ship.currentSystemId : worldId.split(':p')[0],
      currentWorldId: typeof ship.currentWorldId === 'string' ? ship.currentWorldId : worldId,
      parkedPose: null,
      systemPose: null,
      locationMode: ship.locationMode === 'atmosphere' || ship.locationMode === 'local_space'
        ? ship.locationMode
        : 'surface'
    });
    // Any accepted stage beyond the wreck proves the one physical cache was
    // consumed. Project that shared fact locally without manufacturing its
    // finite inventory outputs for a non-claiming peer.
    if (ship.repairStage !== 'wrecked') markMilestone(WRECK_SALVAGE_MILESTONE);
    applied = true;
  }

  applyHabitatWorldSnapshot(worldId, story.habitat);
  if (story.habitat !== undefined) applied = true;

  if (Array.isArray(story.relationshipAttendedBy)) {
    for (const playerId of story.relationshipAttendedBy) {
      if (typeof playerId === 'string') {
        markMilestone('story:tidegarden:relationship-attended', playerId);
        applied = true;
      }
    }
  }
  return applied;
}

export function applyReplicatedWorldSnapshotTerrain(
  snapshot: JsonObject,
  worldId: string,
  options: WorldEventApplyOptions = {}
): TerrainDiffReplayResult {
  return replayReplicatedTerrainDiff(
    worldId,
    extractSnapshotVoxelMinedCoords(snapshot, options),
    options.terrain ?? voxelSystem
  );
}

export function applyReplicatedWorldSnapshotEvents(
  snapshot: JsonObject,
  worldId: string,
  options: WorldSnapshotApplyOptions = {}
): WorldSnapshotReplayResult {
  const events = extractSnapshotWorldEvents(snapshot);
  // A full snapshot is the authoritative structure audit log for this world.
  // Drop stale ACK markers before replaying its accepted placement/removal order.
  clearAuthoritativeStructureReceipts(worldId);
  if (options.replaceResourceMarkers) {
    const trees: Array<[number, number, number]> = [];
    const stones: Array<[number, number, number]> = [];
    const forage: Array<[number, number, number]> = [];
    const flora: Array<[number, number, number]> = [];
    for (const event of events) {
      if (event.type !== 'resource_taken') continue;
      const coord = readCoord(event.payload.coord);
      if (!coord) continue;
      if (event.payload.source === 'tree') trees.push(coord);
      else if (event.payload.source === 'loose_stone') stones.push(coord);
      else if (event.payload.source === 'forage') forage.push(coord);
      else if (event.payload.source === 'flora' && typeof event.payload.kind === 'string' && isFloraHarvestKind(event.payload.kind)) flora.push(coord);
    }
    replaceMultiplayerResourceMarkers(worldId, { trees, stones, forage, flora });
    resetTreeHarvest();
    resetStonePickup();
    resetForagePickup();
    resetFloraHarvest();
  }
  let applied = 0;
  let queuedTerrain = 0;
  let queuedWater = 0;
  for (const event of events) {
    if (options.ignoreLocalPlayer && event.playerId === options.localPlayerId) continue;
    if (event.type === 'voxel_mined') {
      const before = getPendingReplicatedTerrainDiffCount(worldId);
      const result = applyReplicatedVoxelMined(event.payload, options.terrain ?? voxelSystem, worldId);
      queuedTerrain += Math.max(0, getPendingReplicatedTerrainDiffCount(worldId) - before);
      if (result) applied++;
      continue;
    }
    if (event.type === 'water_flooded') {
      const before = getPendingReplicatedWaterFloodCount(worldId);
      const result = applyReplicatedWaterFlooded(event.payload, options.water, worldId);
      queuedWater += Math.max(0, getPendingReplicatedWaterFloodCount(worldId) - before);
      if (result) applied++;
      continue;
    }
    if (applyReplicatedWorldEvent(event, { ...options, worldId })) applied++;
  }
  return { applied, queuedTerrain, queuedWater };
}

export function applyPendingReplicatedTerrainDiff(
  worldId: string,
  terrain: TerrainReplicationTarget = voxelSystem
): TerrainDiffReplayResult {
  const pending = pendingTerrainDiffsByWorld.get(worldId) ?? [];
  if (pending.length === 0) return { applied: 0, queued: 0 };
  if (!canApplyTerrainDiff(worldId, terrain)) return { applied: 0, queued: pending.length };

  pendingTerrainDiffsByWorld.delete(worldId);
  const unique = uniqueCoords(pending);
  terrain.applyTerrainDiff(unique);
  notifyWorldCollisionChanged({
    kind: 'terrain_diff',
    worldId,
    cells: unique
  });
  return { applied: unique.length, queued: 0 };
}

export function applyPendingReplicatedWaterFlood(
  worldId: string,
  water: WaterReplicationTarget | null = activeWaterTarget
): WaterFloodReplayResult {
  const pending = pendingWaterFloodsByWorld.get(worldId) ?? [];
  if (pending.length === 0) return { applied: 0, queued: 0 };
  if (!water || !canApplyWaterFlood(worldId)) return { applied: 0, queued: pending.length };

  pendingWaterFloodsByWorld.delete(worldId);
  const unique = uniqueCoords(pending);
  return { applied: water.applyWaterFlood(unique), queued: 0 };
}

export function getPendingReplicatedTerrainDiffCount(worldId: string): number {
  return pendingTerrainDiffsByWorld.get(worldId)?.length ?? 0;
}

export function getPendingReplicatedWaterFloodCount(worldId: string): number {
  return pendingWaterFloodsByWorld.get(worldId)?.length ?? 0;
}

export function clearPendingReplicatedTerrainDiffs(worldId?: string): void {
  if (worldId) pendingTerrainDiffsByWorld.delete(worldId);
  else pendingTerrainDiffsByWorld.clear();
}

export function clearPendingReplicatedWaterFloods(worldId?: string): void {
  if (worldId) pendingWaterFloodsByWorld.delete(worldId);
  else pendingWaterFloodsByWorld.clear();
}

export function setActiveReplicatedTerrainWorld(worldId: string | null): void {
  activeTerrainWorldId = worldId;
}

export function clearActiveReplicatedTerrainWorld(worldId: string): void {
  if (activeTerrainWorldId === worldId) activeTerrainWorldId = null;
}

export function setActiveReplicatedWaterWorld(worldId: string | null, water: WaterReplicationTarget | null = null): void {
  activeWaterWorldId = worldId;
  activeWaterTarget = worldId ? water : null;
}

export function clearActiveReplicatedWaterWorld(worldId: string): void {
  if (activeWaterWorldId === worldId) {
    activeWaterWorldId = null;
    activeWaterTarget = null;
  }
}

export function extractSnapshotPoseEntries(snapshot: JsonObject): Array<[string, JsonObject]> {
  const players = readObject(snapshot.players);
  const poses = readObject(players?.poses);
  if (!poses) return [];
  return Object.entries(poses)
    .filter((entry): entry is [string, JsonObject] => typeof entry[0] === 'string' && readObject(entry[1]) !== null)
    .map(([playerId, pose]) => [playerId, pose]);
}

export function extractSnapshotWorldEvents(snapshot: JsonObject): ReplicatedWorldEvent[] {
  const world = readObject(snapshot.world);
  const events = Array.isArray(world?.events) ? world.events : [];
  return events
    .map(parseReplicatedWorldEvent)
    .filter((event): event is ReplicatedWorldEvent => event !== null);
}

export function extractSnapshotVoxelMinedCoords(
  snapshot: JsonObject,
  options: Pick<WorldEventApplyOptions, 'localPlayerId' | 'ignoreLocalPlayer'> = {}
): Array<[number, number, number]> {
  const coords: Array<[number, number, number]> = [];
  for (const event of extractSnapshotWorldEvents(snapshot)) {
    if (options.ignoreLocalPlayer && event.playerId === options.localPlayerId) continue;
    if (event.type !== 'voxel_mined') continue;
    const coord = readCoord(event.payload.coord);
    if (coord) coords.push(coord);
  }
  return coords;
}

export function applyReplicatedWorldEvent(
  event: unknown,
  options: WorldEventApplyOptions = {}
): boolean {
  const parsed = parseReplicatedWorldEvent(event);
  if (!parsed) return false;
  if (parsed.type === 'structure_placed') {
    recordReplicatedStructureReceipt(parsed, options.worldId);
  } else if (parsed.type === 'structure_removed') {
    removeReplicatedStructureReceipt(parsed, options.worldId);
  }
  if (options.ignoreLocalPlayer && parsed.playerId === options.localPlayerId) {
    return parsed.type === 'structure_placed'
      ? applyReplicatedTidegardenFoundationReceipt(parsed, options.worldId)
      : false;
  }

  switch (parsed.type) {
    case 'voxel_mined':
      return applyReplicatedVoxelMined(parsed.payload, options.terrain ?? voxelSystem, options.worldId);
    case 'water_flooded':
      return applyReplicatedWaterFlooded(parsed.payload, options.water, options.worldId);
    case 'resource_taken':
      return applyReplicatedResourceTaken(parsed.payload, options.worldId);
    case 'structure_placed': {
      const applied = applyReplicatedStructurePlaced(parsed.payload, parsed.playerId, options.worldId);
      const storyReceipt = applyReplicatedTidegardenFoundationReceipt(parsed, options.worldId);
      return applied || storyReceipt;
    }
    case 'structure_removed':
      return applyReplicatedStructureRemoved(parsed.payload, options.worldId);
    case 'door_toggled':
      return applyReplicatedDoorToggled(parsed.payload, options.worldId);
    case 'campfire_placed':
      return applyReplicatedCampfirePlaced(parsed.payload, parsed.playerId);
    case 'player_respawned':
      return applyReplicatedPlayerRespawned(parsed.payload, parsed.playerId, options.worldId, parsed.seq, parsed.timeMs);
    case 'maw_repair_begun':
      return typeof parsed.payload.ritualBeginCommandId === 'string'
        && parsed.payload.ritualSeconds === ECONOMY_CATALOG.storyTransactions.mawRepair.ritualSeconds;
    case 'maw_repaired':
      markMilestone('maw_repaired', parsed.playerId);
      return true;
    case 'maw_first_direction_resolved':
      return applyReplicatedMawFirstDirection(parsed.payload, parsed.playerId);
    case 'maw_pond_observation_begun':
      return isReplicatedMawPondObservationBegin(parsed.payload);
    case 'maw_pond_resonance_observed':
      return applyReplicatedMawPondResonance(parsed.payload, parsed.playerId);
    case 'story_item_acquired':
      return applyReplicatedStoryItemAcquired(parsed.payload, parsed.playerId);
    case 'story_item_banked':
      return applyReplicatedStoryItemBanked(parsed.payload, parsed.playerId);
    case 'wreck_salvage_claimed':
      return applyReplicatedWreckSalvage(parsed.payload, parsed.playerId);
    case 'kestrel_founding_reserve_claimed':
      return applyReplicatedKestrelFoundingReserve(parsed.payload, parsed.playerId);
    case 'ship_repair_stage':
      return applyReplicatedShipRepairStage(parsed, options.worldId);
    case 'tidegarden_relationship_attended':
      return applyReplicatedTidegardenRelationship(parsed);
    case 'tidegarden_site_chosen':
      return applyReplicatedTidegardenSiteChoice(parsed, options.worldId);
    case 'habitat_core_placed':
      return applyReplicatedHabitatCore(parsed, options.worldId);
    case 'habitat_shelter_certified':
      return applyReplicatedHabitatShelter(parsed, options.worldId);
    case 'habitat_safe_rest_completed':
      return applyReplicatedHabitatRest(parsed, options.worldId);
    default:
      return false;
  }
}

function recordReplicatedStructureReceipt(
  event: ReplicatedWorldEvent,
  worldId?: string
): boolean {
  const cell = readCoord(event.payload.cell);
  const face = readInt(event.payload.face);
  const type = readString(event.payload.type);
  const material = readString(event.payload.material);
  if (!worldId || !cell || face === null || !type || !material) return false;
  return recordAuthoritativeStructureReceipt({
    worldId,
    playerId: event.playerId,
    cell,
    face,
    type: type as BuildPieceType,
    material,
    ...(event.commandId ? { commandId: event.commandId } : {})
  });
}

function removeReplicatedStructureReceipt(
  event: ReplicatedWorldEvent,
  worldId?: string
): boolean {
  const cell = readCoord(event.payload.cell);
  const face = readInt(event.payload.face);
  return Boolean(worldId && cell && face !== null
    && removeAuthoritativeStructureReceipt(worldId, cell, face));
}

export function parseReplicatedWorldEvent(event: unknown): ReplicatedWorldEvent | null {
  const value = readObject(event);
  if (!value) return null;
  const payload = readObject(value.payload);
  if (
    !Number.isInteger(value.seq)
    || typeof value.type !== 'string'
    || typeof value.playerId !== 'string'
    || !payload
  ) {
    return null;
  }
  return {
    seq: value.seq as number,
    ...(typeof value.commandId === 'string' ? { commandId: value.commandId } : {}),
    type: value.type,
    playerId: value.playerId,
    payload,
    timeMs: typeof value.timeMs === 'number' ? value.timeMs : undefined
  };
}

export function applyReplicatedVoxelMined(
  payload: JsonObject,
  terrain: TerrainReplicationTarget = voxelSystem,
  worldId?: string
): boolean {
  const coord = readCoord(payload.coord);
  if (!coord) return false;
  const replayed = replayReplicatedTerrainDiff(worldId, [coord], terrain);
  return replayed.applied > 0 || replayed.queued > 0;
}

export function applyReplicatedWaterFlooded(
  payload: JsonObject,
  water?: WaterReplicationTarget,
  worldId?: string
): boolean {
  const cells = readCoordArray(payload.cells);
  if (cells.length === 0) return false;
  const replayed = replayReplicatedWaterFlood(worldId, cells, water);
  return replayed.applied > 0 || replayed.queued > 0;
}

export function applyReplicatedResourceTaken(payload: JsonObject, worldId?: string): boolean {
  const coord = readCoord(payload.coord);
  if (!coord) return false;
  switch (payload.source) {
    case 'tree':
      markTreeHarvested(coord[0], coord[1], coord[2]);
      if (worldId) markMultiplayerResourceMarker(worldId, 'tree', coord);
      return true;
    case 'loose_stone':
      markStoneCollected(coord[0], coord[1], coord[2]);
      if (worldId) markMultiplayerResourceMarker(worldId, 'loose_stone', coord);
      return true;
    case 'forage':
      markForageCollected(coord[0], coord[1], coord[2]);
      if (worldId) markMultiplayerResourceMarker(worldId, 'forage', coord);
      return true;
    case 'flora':
      if (typeof payload.kind !== 'string' || !isFloraHarvestKind(payload.kind)) return false;
      markFloraHarvested(coord[0], coord[1], coord[2]);
      if (worldId) markMultiplayerResourceMarker(worldId, 'flora', coord);
      return true;
    default:
      return false;
  }
}

export function applyReplicatedStructurePlaced(payload: JsonObject, playerId: string, worldId?: string): boolean {
  const cell = readCoord(payload.cell);
  const face = readInt(payload.face);
  const type = readString(payload.type);
  const material = readString(payload.material);
  if (!cell || face === null || !type || !material) return false;
  const pieceType = type as BuildPieceType;
  const definition = BUILD_PIECES[pieceType];
  if (!definition) return false;
  if (type === 'door') {
    const applied = applyDoorLeaf(cell, face);
    if (applied) notifyStructureCollisionChanged('structure_placed', cell, face, worldId);
    return applied;
  }
  if ((definition.heightUnits ?? 1) > 1) {
    const up = readInt(payload.up);
    if (up === null || !FACE_DIRS[up]) return false;
    const dir = FACE_DIRS[up];
    const upper: [number, number, number] = [cell[0] + dir[0], cell[1] + dir[1], cell[2] + dir[2]];
    restorePieces([
      {
        cell,
        face,
        type: pieceType,
        material: material as BuildMaterialId,
        up,
        tall: 'lower',
        partner: upper,
        ownerId: playerId,
        placedBy: playerId
      },
      {
        cell: upper,
        face,
        type: pieceType,
        material: material as BuildMaterialId,
        up,
        tall: 'upper',
        partner: cell,
        ownerId: playerId,
        placedBy: playerId
      }
    ]);
    notifyStructureCollisionChanged('structure_placed', cell, face, worldId);
    return true;
  }

  const piece: Omit<StructurePiece, 'id'> = {
    cell,
    face,
    type: pieceType,
    material: material as BuildMaterialId,
    ownerId: playerId,
    placedBy: playerId
  };
  const up = readInt(payload.up);
  const orient = readInt(payload.orient);
  if (up !== null) piece.up = up;
  if (orient !== null) piece.orient = orient;
  if (face === VOLUME_FACE && up === null) return false;
  restorePieces([piece]);
  notifyStructureCollisionChanged('structure_placed', cell, face, worldId);
  return true;
}

export function applyReplicatedStructureRemoved(payload: JsonObject, worldId?: string): boolean {
  const cell = readCoord(payload.cell);
  const face = readInt(payload.face);
  if (!cell || face === null) return false;
  const cells = structureCollisionCellsFromStore(cell, face);
  const removed = removePieceWithoutRefund(cell, face);
  if (removed) {
    notifyWorldCollisionChanged({
      kind: 'structure_removed',
      worldId,
      cells,
      solidAfter: false
    });
  }
  return removed;
}

export function applyReplicatedDoorToggled(payload: JsonObject, worldId?: string): boolean {
  const cell = readCoord(payload.cell);
  const face = readInt(payload.face);
  if (!cell || face === null || typeof payload.open !== 'boolean') return false;
  const applied = setDoorOpen(cell, face, payload.open);
  if (applied) notifyStructureCollisionChanged('door_toggled', cell, face, worldId);
  return applied;
}

export function applyReplicatedCampfirePlaced(payload: JsonObject, playerId: string): boolean {
  const pos = readVec3(payload.pos);
  const up = readVec3(payload.up);
  if (!pos || !up) return false;
  restoreCampfires([{ pos, up, ownerId: playerId, placedBy: playerId }]);
  return true;
}

export function applyReplicatedPlayerRespawned(
  payload: JsonObject,
  playerId: string,
  worldId = '',
  eventSeq = 0,
  timeMs?: number
): boolean {
  const position = readVec3(payload.position);
  if (!position) return false;
  const current = getPlayerPose(playerId);
  const up = readVec3(payload.up) ?? current?.up ?? [0, 1, 0];
  setPlayerPose({
    playerId,
    worldId: worldId || current?.worldId || '',
    seq: Math.max(eventSeq, (current?.seq ?? 0) + 1),
    timeMs: timeMs ?? Date.now(),
    position,
    velocity: [0, 0, 0],
    forward: current?.forward ?? [0, 0, -1],
    up,
    pitch: current?.pitch ?? 0,
    action: 'idle',
    teleport: true,
    submergence: 0,
    miningProgress: 0,
    jetpackActive: false,
    torchActive: current?.torchActive ?? false,
    shipPhase: 'surface'
  });
  return true;
}

export function applyReplicatedMawFirstDirection(
  payload: JsonObject,
  playerId: string
): boolean {
  const choice = payload.choice;
  const repairCommandId = readString(payload.repairCommandId);
  const proofCommandId = readString(payload.proofCommandId);
  const targetKind = readString(payload.targetKind);
  const minimumPurposeGapMs = ECONOMY_CATALOG.storyTransactions.mawRepair.purposeGapSeconds * 1000;
  if (!repairCommandId || payload.minimumPurposeGapMs !== minimumPurposeGapMs) return false;
  if (choice === 'lowered-and-listened') {
    if (proofCommandId !== null || targetKind !== 'unassigned') return false;
  } else if (choice === 'harmless-test') {
    if (
      !proofCommandId
      || !targetKind
      || !ECONOMY_CATALOG.storyTransactions.mawRepair.harmlessTestBlockIds.includes(
        targetKind as typeof ECONOMY_CATALOG.storyTransactions.mawRepair.harmlessTestBlockIds[number]
      )
    ) return false;
  } else {
    return false;
  }
  markMilestone('story:maw:first-direction-resolved', playerId);
  markMilestone(`story:maw:first-direction:${choice}`, playerId);
  return true;
}

export function isReplicatedMawPondObservationBegin(payload: JsonObject): boolean {
  return Boolean(
    readString(payload.observationBeginCommandId)
    && readString(payload.directionCommandId)
    && readInt(payload.poseSeq) !== null
    && payload.maximumPoseAgeMs
      === ECONOMY_CATALOG.storyTransactions.mawRepair.maxPoseAgeSeconds * 1000
    && payload.minimumObservationMs
      === ECONOMY_CATALOG.storyTransactions.mawRepair.pondObservationSeconds * 1000
    && payload.physicalProximityCertified === false
  );
}

export function applyReplicatedMawPondResonance(
  payload: JsonObject,
  playerId: string
): boolean {
  if (
    !readString(payload.observationBeginCommandId)
    || !readString(payload.directionCommandId)
    || readInt(payload.beginPoseSeq) === null
    || readInt(payload.completionPoseSeq) === null
    || payload.minimumObservationMs
      !== ECONOMY_CATALOG.storyTransactions.mawRepair.pondObservationSeconds * 1000
    || payload.physicalProximityCertified !== false
  ) return false;
  markMilestone('story:maw:pond-resonance-visible', playerId);
  return true;
}

export function applyReplicatedStoryItemAcquired(payload: JsonObject, playerId: string): boolean {
  const itemId = payload.itemId;
  if (itemId !== 'maw_repair_kit' && itemId !== 'kestrel_keel_memory') return false;
  const milestone = itemId === 'maw_repair_kit'
    ? 'story:item:maw-repair-kit:acquired'
    : 'story:item:kestrel-keel-memory:acquired';
  if (!hasMilestone(milestone, playerId)) {
    addItem(itemId, 1, playerId);
    markMilestone(milestone, playerId);
  }
  return true;
}

export function applyReplicatedStoryItemBanked(payload: JsonObject, playerId: string): boolean {
  if (payload.itemId !== 'kestrel_keel_memory') return false;
  markMilestone('story:item:kestrel-keel-memory:banked', playerId);
  return true;
}

export function applyReplicatedWreckSalvage(payload: JsonObject, playerId: string): boolean {
  const milestone = WRECK_SALVAGE_MILESTONE;
  if (hasMilestone(milestone, playerId)) {
    markMilestone(milestone);
    return true;
  }
  const outputs = Array.isArray(payload.outputs) ? payload.outputs : [];
  for (const value of outputs) {
    const stack = readObject(value);
    const qty = readInt(stack?.qty);
    if (!stack || typeof stack.id !== 'string' || qty === null || qty <= 0) continue;
    addItem(stack.id as Parameters<typeof addItem>[0], qty, playerId);
  }
  markMilestone(milestone, playerId);
  // Outputs remain actor-owned, but the emptied cache is a shared world fact.
  markMilestone(milestone);
  return true;
}

export function applyReplicatedKestrelFoundingReserve(
  payload: JsonObject,
  playerId: string
): boolean {
  if (hasMilestone(KESTREL_FOUNDING_RESERVE_MILESTONE, playerId)) return true;
  const outputs = Array.isArray(payload.outputs) ? payload.outputs : [];
  const stacks: Array<{ id: Parameters<typeof addItem>[0]; qty: number }> = [];
  for (const value of outputs) {
    const stack = readObject(value);
    const qty = readInt(stack?.qty);
    if (!stack || typeof stack.id !== 'string' || qty === null || qty <= 0) continue;
    stacks.push({ id: stack.id as Parameters<typeof addItem>[0], qty });
  }
  const canonical = stacks.length === KESTREL_FOUNDING_RESERVE.length
    && KESTREL_FOUNDING_RESERVE.every(expected => stacks.some(stack => (
      stack.id === expected.id && stack.qty === expected.qty
    )));
  return canonical && applyKestrelFoundingReserve(KESTREL_FOUNDING_RESERVE, playerId);
}

export function applyReplicatedShipRepairStage(
  event: ReplicatedWorldEvent,
  _worldId?: string
): boolean {
  const target = event.payload.to;
  if (
    target !== 'bench_online'
    && target !== 'frame_restored'
    && target !== 'hull_sealed'
    && target !== 'lift_online'
    && target !== 'flight_ready'
  ) return false;
  const result = commitShipRepairStage(
    event.commandId ?? `multiplayer:ship-repair:${event.seq}:${target}`,
    target,
    event.playerId
  );
  // Lift hardware belongs to the shared hull. Every local actor needs the
  // capability immediately so their own physical hover proof remains possible.
  if (result.ok && (target === 'lift_online' || target === 'flight_ready')) {
    commitStoryJetInstalled();
  }
  return result.ok;
}

export function applyReplicatedTidegardenRelationship(event: ReplicatedWorldEvent): boolean {
  const relationshipId = readString(event.payload.relationshipId);
  if (relationshipId !== 'tideline-root-water-exchange') return false;
  markMilestone('story:tidegarden:relationship-attended', event.playerId);
  emitEmergentStoryEvent({
    id: `server:${event.commandId ?? event.seq}:tidegarden-relationship`,
    type: 'ecology_relationship_observed',
    actorId: event.playerId,
    worldId: TIDEGARDEN_WORLD_ID,
    payload: { worldId: TIDEGARDEN_WORLD_ID, relationshipId }
  });
  return true;
}

export function applyReplicatedTidegardenSiteChoice(
  event: ReplicatedWorldEvent,
  worldId?: string
): boolean {
  const cell = readCoord(event.payload.cell);
  const supportCell = readCoord(event.payload.supportCell);
  const up = readCoord(event.payload.up);
  const resolvedWorldId = worldId?.trim() ?? readString(event.payload.worldId) ?? '';
  if (resolvedWorldId !== TIDEGARDEN_WORLD_ID || !cell || !supportCell || !up) return false;
  return applyAuthoritativeTidegardenSiteChoiceReceipt({
    worldId: resolvedWorldId,
    cell,
    supportCell,
    up
  }, `server:${event.commandId ?? event.seq}:tidegarden-site`, event.playerId).ok;
}

function applyReplicatedTidegardenFoundationReceipt(
  event: ReplicatedWorldEvent,
  worldId?: string
): boolean {
  const cell = readCoord(event.payload.cell);
  const face = readInt(event.payload.face);
  const material = readString(event.payload.material);
  if (worldId !== TIDEGARDEN_WORLD_ID
    || !cell
    || face === null
    || readString(event.payload.type) !== 'foundation'
    || !material
    || !tidegardenSiteChoiceMatchesCell(event.playerId, cell)) return false;
  emitEmergentStoryEvent({
    id: `server:${event.commandId ?? event.seq}:tidegarden-foundation`,
    type: 'settlement_foundation_placed',
    actorId: event.playerId,
    worldId,
    occurredAt: event.timeMs,
    payload: {
      transactionEventId: event.commandId ?? `world-event:${event.seq}`,
      cell,
      face,
      material
    }
  });
  return true;
}

export function applyReplicatedHabitatCore(
  event: ReplicatedWorldEvent,
  worldId?: string
): boolean {
  const resolvedWorldId = worldId?.trim() ?? '';
  const shelterId = readString(event.payload.shelterId);
  const cell = readCoord(event.payload.cell);
  const supportCell = readCoord(event.payload.supportCell);
  const position = readVec3(event.payload.position);
  const up = readVec3(event.payload.up);
  if (!resolvedWorldId || !shelterId || !cell || !supportCell || !position || !up) return false;
  const existing = getHabitatWorldState(resolvedWorldId);
  const committed = existing
    ? existing.core.shelterId === shelterId
    : commitHabitatCorePlacement({
        actorId: event.playerId,
        worldId: resolvedWorldId,
        shelterId,
        cell,
        supportCell,
        position,
        up,
        eventId: event.commandId ?? `multiplayer:habitat-core:${event.seq}`
      });
  if (committed) {
    markMilestone('story:item:habitat-core:crafted', event.playerId);
    markMilestone('story:tidegarden:habitat-core-online', event.playerId);
    emitEmergentStoryEvent({
      id: `server:${event.commandId ?? event.seq}:habitat-core-online`,
      type: 'station_activated',
      actorId: event.playerId,
      worldId: resolvedWorldId,
      payload: { stationId: 'habitat_core' }
    });
  }
  return committed;
}

export function applyReplicatedHabitatShelter(
  event: ReplicatedWorldEvent,
  worldId?: string
): boolean {
  const resolvedWorldId = worldId?.trim() ?? '';
  const shelterId = readString(event.payload.shelterId);
  const cell = readCoord(event.payload.cell);
  const insulation = readNumber(event.payload.insulation);
  const interiorCellCount = readInt(event.payload.interiorCellCount);
  if (!resolvedWorldId || !shelterId || !cell || insulation === null
    || interiorCellCount === null || interiorCellCount <= 0) return false;
  const existing = getHabitatWorldState(resolvedWorldId);
  const committed = existing?.shelterCertification
    ? existing.shelterCertification.shelterId === shelterId
    : commitHabitatShelterCertification(resolvedWorldId, {
        shelterId,
        cell,
        insulation,
        interiorCellCount,
        eventId: event.commandId ?? `multiplayer:habitat-shelter:${event.seq}`
      });
  if (committed) {
    markMilestone('story:tidegarden:shelter-certified', event.playerId);
    emitEmergentStoryEvent({
      id: `server:${event.commandId ?? event.seq}:habitat-shelter-certified`,
      type: 'shelter_certified',
      actorId: event.playerId,
      worldId: resolvedWorldId,
      payload: { worldId: resolvedWorldId, shelterId }
    });
  }
  return committed;
}

export function applyReplicatedHabitatRest(
  event: ReplicatedWorldEvent,
  worldId?: string
): boolean {
  const resolvedWorldId = worldId?.trim() ?? '';
  const shelterId = readString(event.payload.shelterId);
  const dayPhase = readNumber(event.payload.dayPhase);
  if (!resolvedWorldId || !shelterId || dayPhase === null) return false;
  const existing = getHabitatWorldState(resolvedWorldId);
  const committed = existing?.safeRest
    ? existing.safeRest.shelterId === shelterId
    : commitHabitatSafeRest(resolvedWorldId, {
        shelterId,
        dayPhase,
        eventId: event.commandId ?? `multiplayer:habitat-rest:${event.seq}`
      });
  if (committed) {
    markMilestone('story:tidegarden:safe-rest-completed', event.playerId);
    markMilestone('story:tidegarden:two-world-handoff', event.playerId);
    emitEmergentStoryEvent({
      id: `server:${event.commandId ?? event.seq}:habitat-safe-rest`,
      type: 'safe_rest_completed',
      actorId: event.playerId,
      worldId: resolvedWorldId,
      payload: { worldId: resolvedWorldId, shelterId }
    });
    emitEmergentStoryEvent({
      id: `server:${event.commandId ?? event.seq}:two-world-handoff`,
      type: 'two_world_story_handoff',
      actorId: event.playerId,
      worldId: resolvedWorldId,
      payload: {
        originWorldId: STORY_PRIMARY_WORLD_ID,
        siblingWorldId: TIDEGARDEN_WORLD_ID
      }
    });
  }
  return committed;
}

export function readCoord(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [x, y, z] = value;
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return null;
  return [x, y, z];
}

export function readVec3(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [x, y, z] = value;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return [x, y, z];
}

function readCoordArray(value: unknown): Array<[number, number, number]> {
  if (!Array.isArray(value)) return [];
  return value
    .map(readCoord)
    .filter((coord): coord is [number, number, number] => coord !== null);
}

function sanitizeInventorySnapshot(value: unknown): InventorySnapshot | null {
  const source = readObject(value);
  if (!source) return null;
  const snapshot: InventorySnapshot = {};
  for (const [actorId, countsValue] of Object.entries(source)) {
    const counts = readObject(countsValue);
    if (!counts) continue;
    const actorCounts: Record<string, number> = {};
    for (const [itemId, qty] of Object.entries(counts)) {
      if (typeof qty === 'number' && Number.isFinite(qty) && qty > 0) actorCounts[itemId] = qty;
    }
    snapshot[actorId] = actorCounts;
  }
  return snapshot;
}

function sanitizeVitalsSnapshot(value: unknown): VitalsSnapshot | null {
  const source = readObject(value);
  if (!source) return null;
  const snapshot: VitalsSnapshot = {};
  for (const [actorId, stateValue] of Object.entries(source)) {
    const state = readObject(stateValue);
    const vitals = readObject(state?.vitals);
    if (!state || !vitals) continue;
    snapshot[actorId] = {
      vitals: {
        health: readFiniteNumber(vitals.health, 100),
        hunger: readFiniteNumber(vitals.hunger, 100),
        thirst: readFiniteNumber(vitals.thirst, 100),
        warmth: readFiniteNumber(vitals.warmth, 100),
        stamina: readFiniteNumber(vitals.stamina, 100),
        oxygen: readFiniteNumber(vitals.oxygen, 100)
      },
      exhausted: typeof state.exhausted === 'boolean' ? state.exhausted : false
    };
  }
  return snapshot;
}

function sanitizeNumberSnapshot(value: unknown): Record<string, number> | null {
  const source = readObject(value);
  if (!source) return null;
  const snapshot: Record<string, number> = {};
  for (const [actorId, amount] of Object.entries(source)) {
    if (typeof amount === 'number' && Number.isFinite(amount)) snapshot[actorId] = amount;
  }
  return snapshot;
}

function sanitizeProgressionSnapshot(value: unknown): ProgressionSnapshot | null {
  const source = readObject(value);
  if (!source) return null;
  const snapshot: ProgressionSnapshot = {};
  for (const [actorId, stateValue] of Object.entries(source)) {
    const state = readObject(stateValue);
    if (!state) continue;
    snapshot[actorId] = {
      era: typeof state.era === 'string' ? state.era as ProgressionSnapshot[string]['era'] : 'primitive',
      milestones: Array.isArray(state.milestones)
        ? state.milestones.filter((milestone): milestone is string => typeof milestone === 'string')
        : []
    };
  }
  return snapshot;
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readInt(value: unknown): number | null {
  return Number.isInteger(value) ? value as number : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isReplicatedShipStage(value: unknown): value is
  | 'wrecked'
  | 'bench_online'
  | 'frame_restored'
  | 'hull_sealed'
  | 'lift_online'
  | 'flight_ready' {
  return value === 'wrecked'
    || value === 'bench_online'
    || value === 'frame_restored'
    || value === 'hull_sealed'
    || value === 'lift_online'
    || value === 'flight_ready';
}

function readPoseSeq(pose: JsonObject): number {
  return Number.isInteger(pose.seq) ? pose.seq as number : 0;
}

function replayReplicatedTerrainDiff(
  worldId: string | undefined,
  coords: ReadonlyArray<[number, number, number]>,
  terrain: TerrainReplicationTarget
): TerrainDiffReplayResult {
  if (coords.length === 0) return { applied: 0, queued: 0 };
  const unique = uniqueCoords(coords);
  if (!worldId || canApplyTerrainDiff(worldId, terrain)) {
    terrain.applyTerrainDiff(unique);
    notifyWorldCollisionChanged({
      kind: 'terrain_diff',
      worldId,
      cells: unique
    });
    return { applied: unique.length, queued: 0 };
  }

  const pending = pendingTerrainDiffsByWorld.get(worldId) ?? [];
  pending.push(...unique);
  pendingTerrainDiffsByWorld.set(worldId, pending);
  return { applied: 0, queued: unique.length };
}

function replayReplicatedWaterFlood(
  worldId: string | undefined,
  cells: ReadonlyArray<[number, number, number]>,
  water?: WaterReplicationTarget
): WaterFloodReplayResult {
  if (cells.length === 0) return { applied: 0, queued: 0 };
  const unique = uniqueCoords(cells);
  const target = water ?? activeWaterTarget;
  if (!worldId) {
    return { applied: target?.applyWaterFlood(unique) ?? 0, queued: 0 };
  }
  if (target && canApplyWaterFlood(worldId)) {
    return { applied: target.applyWaterFlood(unique), queued: 0 };
  }

  const pending = pendingWaterFloodsByWorld.get(worldId) ?? [];
  pending.push(...unique);
  pendingWaterFloodsByWorld.set(worldId, pending);
  return { applied: 0, queued: unique.length };
}

function canApplyTerrainDiff(worldId: string, terrain: TerrainReplicationTarget): boolean {
  if (activeTerrainWorldId !== worldId) return false;
  return !terrain.getOriginalTerrainSize || terrain.getOriginalTerrainSize() > 0;
}

function canApplyWaterFlood(worldId: string): boolean {
  return activeWaterWorldId === worldId;
}

function uniqueCoords(coords: ReadonlyArray<[number, number, number]>): Array<[number, number, number]> {
  const seen = new Set<string>();
  const unique: Array<[number, number, number]> = [];
  for (const coord of coords) {
    const key = coord.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(coord);
  }
  return unique;
}

function notifyStructureCollisionChanged(
  kind: 'structure_placed' | 'door_toggled',
  cell: [number, number, number],
  face: number,
  worldId?: string
): void {
  const piece = getPieceAt(cell[0], cell[1], cell[2], face);
  notifyWorldCollisionChanged({
    kind,
    worldId,
    cells: structureCollisionCellsFromPiece(piece, cell),
    solidAfter: piece ? isStructurePieceSolid(piece) : false
  });
}

function structureCollisionCellsFromStore(cell: [number, number, number], face: number): CollisionCell[] {
  return structureCollisionCellsFromPiece(getPieceAt(cell[0], cell[1], cell[2], face), cell);
}

function structureCollisionCellsFromPiece(piece: StructurePiece | undefined, fallback: [number, number, number]): CollisionCell[] {
  if (!piece) return [[fallback[0], fallback[1], fallback[2]]];
  const cells: CollisionCell[] = [[piece.cell[0], piece.cell[1], piece.cell[2]]];
  if (piece.partner) cells.push([piece.partner[0], piece.partner[1], piece.partner[2]]);
  return cells;
}

function readObject(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : null;
}
