import { createPlayerPose, type PlayerPose } from './playerPose.ts';
import { setPlayerPose } from './systems/playerPoseSystem.ts';
import type { JsonObject } from './multiplayerClient.ts';
import { voxelSystem } from '../utils/efficientVoxelSystem.ts';
import { markTreeHarvested } from './systems/treeHarvest.ts';
import { markStoneCollected } from './systems/stonePickup.ts';
import { markForageCollected } from './systems/foragePickup.ts';
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
import type { BuildPieceType } from './data/buildPieces.ts';
import { notifyWorldCollisionChanged, type CollisionCell } from './worldCollisionReconciliation.ts';

export interface RemotePoseUpdate {
  playerId: string;
  worldId: string;
  seq: number;
  pose: JsonObject;
}

export interface ReplicatedWorldEvent {
  seq: number;
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
  options: WorldEventApplyOptions = {}
): WorldSnapshotReplayResult {
  let applied = 0;
  let queuedTerrain = 0;
  let queuedWater = 0;
  for (const event of extractSnapshotWorldEvents(snapshot)) {
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
  if (options.ignoreLocalPlayer && parsed.playerId === options.localPlayerId) return false;

  switch (parsed.type) {
    case 'voxel_mined':
      return applyReplicatedVoxelMined(parsed.payload, options.terrain ?? voxelSystem, options.worldId);
    case 'water_flooded':
      return applyReplicatedWaterFlooded(parsed.payload, options.water, options.worldId);
    case 'resource_taken':
      return applyReplicatedResourceTaken(parsed.payload);
    case 'structure_placed':
      return applyReplicatedStructurePlaced(parsed.payload, parsed.playerId, options.worldId);
    case 'structure_removed':
      return applyReplicatedStructureRemoved(parsed.payload, options.worldId);
    case 'door_toggled':
      return applyReplicatedDoorToggled(parsed.payload, options.worldId);
    case 'campfire_placed':
      return applyReplicatedCampfirePlaced(parsed.payload, parsed.playerId);
    default:
      return false;
  }
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

export function applyReplicatedResourceTaken(payload: JsonObject): boolean {
  const coord = readCoord(payload.coord);
  if (!coord) return false;
  switch (payload.source) {
    case 'tree':
      markTreeHarvested(coord[0], coord[1], coord[2]);
      return true;
    case 'loose_stone':
      markStoneCollected(coord[0], coord[1], coord[2]);
      return true;
    case 'forage':
      markForageCollected(coord[0], coord[1], coord[2]);
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
  if (type === 'door') {
    const applied = applyDoorLeaf(cell, face);
    if (applied) notifyStructureCollisionChanged('structure_placed', cell, face, worldId);
    return applied;
  }
  if (type === 'doorway') {
    const up = readInt(payload.up);
    if (up === null || !FACE_DIRS[up]) return false;
    const dir = FACE_DIRS[up];
    const upper: [number, number, number] = [cell[0] + dir[0], cell[1] + dir[1], cell[2] + dir[2]];
    restorePieces([
      {
        cell,
        face,
        type: 'doorway',
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
        type: 'doorway',
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
    type: type as BuildPieceType,
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

function readInt(value: unknown): number | null {
  return Number.isInteger(value) ? value as number : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
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
