import { voxelSystem } from '../utils/efficientVoxelSystem.ts';
import type { CommandRejectCode } from './commands.ts';
import type { ItemId } from './data/items.ts';
import type { BuildMaterialId } from './data/buildMaterials.ts';
import type { BuildPieceType } from './data/buildPieces.ts';
import type { ActorId } from './playerActors.ts';
import { addItem, getItemCount, removeItem } from './systems/inventorySystem.ts';
import { setMawCharge } from './systems/mawSystem.ts';
import { setWaterskinFill } from './systems/consumeSystem.ts';
import { setVitals, type VitalsState } from './systems/survivalVitals.ts';
import { removeCampfireIfOwnedBy } from './systems/campfires.ts';
import { unmarkForageCollected } from './systems/foragePickup.ts';
import { unmarkStoneCollected } from './systems/stonePickup.ts';
import { unmarkTreeHarvested } from './systems/treeHarvest.ts';
import {
  removePieceWithoutRefundIfOwnedBy,
  restorePieces,
  setDoorOpen,
  type StructurePiece
} from './systems/structureSystem.ts';

interface RollbackApplyOptions {
  actorId: ActorId;
  rejectCode: CommandRejectCode | string;
}

interface RollbackApplyResult {
  changed: boolean;
  removedItems: number;
  refundedItems: number;
  restoredTerrain: number;
  restoredResources: number;
  removedStructures: number;
  removedCampfires: number;
  restoredStructures: number;
  restoredVitals: boolean;
  restoredWaterskin: boolean;
}

export function applyRejectedCommandRollback(rollback: unknown, options: RollbackApplyOptions): RollbackApplyResult {
  const payload = readObject(rollback);
  const result: RollbackApplyResult = {
    changed: false,
    removedItems: 0,
    refundedItems: 0,
    restoredTerrain: 0,
    restoredResources: 0,
    removedStructures: 0,
    removedCampfires: 0,
    restoredStructures: 0,
    restoredVitals: false,
    restoredWaterskin: false
  };
  if (!payload) return result;

  for (const stack of readItemStacks(payload.removeItems)) {
    const qty = Math.min(stack.qty, getItemCount(stack.id, options.actorId));
    if (qty <= 0) continue;
    if (removeItem(stack.id, qty, options.actorId)) {
      result.changed = true;
      result.removedItems += qty;
    }
  }

  for (const stack of readItemStacks(payload.refundItems)) {
    addItem(stack.id, stack.qty, options.actorId);
    result.changed = true;
    result.refundedItems += stack.qty;
  }

  const mawChargeBefore = readFiniteNumber(payload.mawChargeBefore);
  if (mawChargeBefore !== null) {
    setMawCharge(mawChargeBefore, options.actorId);
    result.changed = true;
  }

  const vitalsBefore = readVitals(payload.vitalsBefore);
  if (vitalsBefore) {
    setVitals(vitalsBefore, options.actorId);
    result.changed = true;
    result.restoredVitals = true;
  }

  const waterskinFillBefore = readFiniteNumber(payload.waterskinFillBefore);
  if (waterskinFillBefore !== null) {
    setWaterskinFill(waterskinFillBefore, options.actorId);
    result.changed = true;
    result.restoredWaterskin = true;
  }

  const removePlacedStructure = readObject(payload.removePlacedStructure);
  const removeCell = readCoord(removePlacedStructure?.cell);
  const removeFace = readInt(removePlacedStructure?.face);
  if (removeCell && removeFace !== null && removePieceWithoutRefundIfOwnedBy(removeCell, removeFace, options.actorId)) {
    result.changed = true;
    result.removedStructures++;
  }

  const setDoor = readObject(payload.setDoorOpen);
  const doorCell = readCoord(setDoor?.cell);
  const doorFace = readInt(setDoor?.face);
  if (doorCell && doorFace !== null && typeof setDoor?.open === 'boolean' && setDoorOpen(doorCell, doorFace, setDoor.open)) {
    result.changed = true;
  }

  const removePlacedCampfire = readObject(payload.removePlacedCampfire);
  const campfirePos = readVec3(removePlacedCampfire?.pos);
  const campfireUp = readVec3(removePlacedCampfire?.up);
  if (campfirePos && campfireUp && removeCampfireIfOwnedBy(campfirePos, campfireUp, options.actorId)) {
    result.changed = true;
    result.removedCampfires++;
  }

  const restoreStructures = readStructurePieces(payload.restoreStructures);
  if (restoreStructures.length > 0) {
    restorePieces(restoreStructures);
    result.changed = true;
    result.restoredStructures += restoreStructures.length;
  }

  if (options.rejectCode === 'conflict') return result;

  const restoreVoxel = readObject(payload.restoreVoxel);
  const restoreCoord = readCoord(restoreVoxel?.coord);
  if (restoreCoord && voxelSystem.restoreOriginalTerrainVoxel(restoreCoord[0], restoreCoord[1], restoreCoord[2])) {
    result.changed = true;
    result.restoredTerrain++;
  }

  const uncollectResource = readObject(payload.uncollectResource);
  const resourceCoord = readCoord(uncollectResource?.coord);
  if (resourceCoord && typeof uncollectResource?.source === 'string') {
    const [x, y, z] = resourceCoord;
    let restored = false;
    if (uncollectResource.source === 'tree') restored = unmarkTreeHarvested(x, y, z);
    else if (uncollectResource.source === 'loose_stone') restored = unmarkStoneCollected(x, y, z);
    else if (uncollectResource.source === 'forage') restored = unmarkForageCollected(x, y, z);
    if (restored) {
      result.changed = true;
      result.restoredResources++;
    }
  }

  return result;
}

function readItemStacks(value: unknown): Array<{ id: ItemId; qty: number }> {
  if (!Array.isArray(value)) return [];
  const stacks: Array<{ id: ItemId; qty: number }> = [];
  for (const entry of value) {
    const stack = readObject(entry);
    const qty = readFiniteNumber(stack?.qty);
    if (!stack || typeof stack.id !== 'string' || qty === null || qty <= 0) continue;
    stacks.push({ id: stack.id as ItemId, qty });
  }
  return stacks;
}

function readStructurePieces(value: unknown): Array<Omit<StructurePiece, 'id'>> {
  if (!Array.isArray(value)) return [];
  const pieces: Array<Omit<StructurePiece, 'id'>> = [];
  for (const entry of value) {
    const piece = readObject(entry);
    const cell = readCoord(piece?.cell);
    const face = readInt(piece?.face);
    if (!piece || !cell || face === null || typeof piece.type !== 'string' || typeof piece.material !== 'string') continue;
    const next: Omit<StructurePiece, 'id'> = {
      cell,
      face,
      type: piece.type as BuildPieceType,
      material: piece.material as BuildMaterialId
    };
    const partner = readCoord(piece.partner);
    const up = readInt(piece.up);
    const orient = readInt(piece.orient);
    if (piece.tall === 'lower' || piece.tall === 'upper') next.tall = piece.tall;
    if (partner) next.partner = partner;
    if (up !== null) next.up = up;
    if (orient !== null) next.orient = orient;
    if (typeof piece.open === 'boolean') next.open = piece.open;
    if (typeof piece.leaf === 'boolean') next.leaf = piece.leaf;
    if (typeof piece.ownerId === 'string') next.ownerId = piece.ownerId as ActorId;
    if (typeof piece.placedBy === 'string') next.placedBy = piece.placedBy as ActorId;
    pieces.push(next);
  }
  return pieces;
}

function readVitals(value: unknown): Partial<VitalsState> | null {
  const payload = readObject(value);
  if (!payload) return null;
  const vitals: Partial<VitalsState> = {};
  const health = readFiniteNumber(payload.health);
  const hunger = readFiniteNumber(payload.hunger);
  const thirst = readFiniteNumber(payload.thirst);
  const warmth = readFiniteNumber(payload.warmth);
  const stamina = readFiniteNumber(payload.stamina);
  const oxygen = readFiniteNumber(payload.oxygen);
  if (health !== null) vitals.health = health;
  if (hunger !== null) vitals.hunger = hunger;
  if (thirst !== null) vitals.thirst = thirst;
  if (warmth !== null) vitals.warmth = warmth;
  if (stamina !== null) vitals.stamina = stamina;
  if (oxygen !== null) vitals.oxygen = oxygen;
  return Object.keys(vitals).length > 0 ? vitals : null;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readCoord(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [x, y, z] = value;
  return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z)
    ? [x, y, z]
    : null;
}

function readVec3(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [x, y, z] = value;
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? [x, y, z]
    : null;
}

function readInt(value: unknown): number | null {
  return Number.isInteger(value) ? value as number : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
