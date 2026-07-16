import type { BuildPieceType } from './data/buildPieces.ts';

export interface AuthoritativeStructureReceipt {
  worldId: string;
  playerId: string;
  cell: readonly [number, number, number];
  face: number;
  type: BuildPieceType;
  material: string;
  commandId?: string;
}

const receiptsByWorld = new Map<string, Map<string, AuthoritativeStructureReceipt>>();

/**
 * Client-local projection of server-accepted structure events. This is not a
 * second structure store: it only distinguishes an optimistic local piece from
 * the same piece after its authoritative world-event echo/snapshot arrives.
 */
export function recordAuthoritativeStructureReceipt(
  receipt: AuthoritativeStructureReceipt
): boolean {
  if (!validReceipt(receipt)) return false;
  const world = receiptsByWorld.get(receipt.worldId) ?? new Map();
  world.set(slotKey(receipt.cell, receipt.face), {
    ...receipt,
    cell: [...receipt.cell]
  });
  receiptsByWorld.set(receipt.worldId, world);
  return true;
}

export function hasAuthoritativeStructureReceipt(input: {
  worldId: string;
  cell: readonly [number, number, number];
  face: number;
  type?: BuildPieceType;
  playerId?: string;
}): boolean {
  const receipt = receiptsByWorld.get(input.worldId)?.get(slotKey(input.cell, input.face));
  return Boolean(receipt
    && (!input.type || receipt.type === input.type)
    && (!input.playerId || receipt.playerId === input.playerId));
}

export function removeAuthoritativeStructureReceipt(
  worldId: string,
  cell: readonly [number, number, number],
  face: number
): boolean {
  const world = receiptsByWorld.get(worldId);
  if (!world) return false;
  const removed = world.delete(slotKey(cell, face));
  if (world.size === 0) receiptsByWorld.delete(worldId);
  return removed;
}

/** A full server snapshot replaces, rather than merges, one world's receipt set. */
export function clearAuthoritativeStructureReceipts(worldId?: string): void {
  if (worldId) receiptsByWorld.delete(worldId);
  else receiptsByWorld.clear();
}

function validReceipt(receipt: AuthoritativeStructureReceipt): boolean {
  return Boolean(receipt.worldId.trim()
    && receipt.playerId.trim()
    && receipt.cell.length === 3
    && receipt.cell.every(Number.isInteger)
    && Number.isInteger(receipt.face)
    && receipt.face >= 0
    && receipt.face <= 6
    && receipt.type
    && receipt.material.trim());
}

function slotKey(cell: readonly [number, number, number], face: number): string {
  return `${cell[0]},${cell[1]},${cell[2]}:${face}`;
}
