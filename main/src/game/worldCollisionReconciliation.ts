import { VOXEL_SCALE } from '../utils/cubeGravityConstants.ts';

export type CollisionCell = [number, number, number];

export type WorldCollisionChangeKind =
  | 'terrain_diff'
  | 'structure_placed'
  | 'structure_removed'
  | 'door_toggled';

export interface WorldCollisionChange {
  seq: number;
  kind: WorldCollisionChangeKind;
  worldId?: string;
  cells: CollisionCell[];
  solidAfter?: boolean;
  timeMs: number;
}

export interface WorldCollisionChangeInput {
  kind: WorldCollisionChangeKind;
  worldId?: string;
  cells?: ReadonlyArray<readonly [number, number, number]>;
  solidAfter?: boolean;
  timeMs?: number;
}

export interface PointLike {
  x: number;
  y: number;
  z: number;
}

export const WORLD_COLLISION_PLAYER_RECONCILE_DISTANCE = VOXEL_SCALE * 2.75;
export const WORLD_COLLISION_PLAYER_SOLIDIFY_LIFT = 0.35;

type Listener = (change: WorldCollisionChange) => void;

let nextSeq = 1;
let latestChange: WorldCollisionChange | null = null;
const listeners = new Set<Listener>();

export function notifyWorldCollisionChanged(input: WorldCollisionChangeInput): WorldCollisionChange {
  const change: WorldCollisionChange = {
    seq: nextSeq++,
    kind: input.kind,
    worldId: input.worldId,
    cells: uniqueCells(input.cells ?? []),
    solidAfter: input.solidAfter,
    timeMs: input.timeMs ?? Date.now()
  };
  latestChange = change;
  for (const listener of listeners) listener(change);
  return change;
}

export function subscribeWorldCollisionChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWorldCollisionChangeSnapshot(): WorldCollisionChange | null {
  return latestChange;
}

export function shouldReconcilePlayerForWorldCollisionChange(
  change: WorldCollisionChange,
  playerPosition: PointLike,
  worldId?: string | null,
  maxDistance = WORLD_COLLISION_PLAYER_RECONCILE_DISTANCE
): boolean {
  if (worldId && change.worldId && change.worldId !== worldId) return false;
  if (change.cells.length === 0) return false;
  return isWorldCollisionChangeNearPoint(change, playerPosition, maxDistance);
}

export function shouldDisplacePlayerForWorldCollisionChange(change: WorldCollisionChange): boolean {
  return change.solidAfter === true;
}

export function isWorldCollisionChangeNearPoint(
  change: WorldCollisionChange,
  point: PointLike,
  maxDistance = WORLD_COLLISION_PLAYER_RECONCILE_DISTANCE
): boolean {
  const maxDistanceSq = maxDistance * maxDistance;
  for (const [x, y, z] of change.cells) {
    const dx = x * VOXEL_SCALE - point.x;
    const dy = y * VOXEL_SCALE - point.y;
    const dz = z * VOXEL_SCALE - point.z;
    if (dx * dx + dy * dy + dz * dz <= maxDistanceSq) return true;
  }
  return false;
}

export function resetWorldCollisionChangesForTests(): void {
  nextSeq = 1;
  latestChange = null;
  listeners.clear();
}

function uniqueCells(cells: ReadonlyArray<readonly [number, number, number]>): CollisionCell[] {
  const seen = new Set<string>();
  const unique: CollisionCell[] = [];
  for (const cell of cells) {
    const key = `${cell[0]},${cell[1]},${cell[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push([cell[0], cell[1], cell[2]]);
  }
  return unique;
}
