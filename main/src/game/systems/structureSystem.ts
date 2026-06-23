// --- Structure store (placed shelter pieces) ---------------------------------
//
// Placed build pieces, stored as panels keyed by (voxel cell, face). A foundation
// also registers its cell so walls/ceilings can require one. World-relative coords →
// reset on world swap. Placing spends the piece's resource cost; removing refunds a
// fraction. Module-singleton + version/subscribe, persistence-ready (the home base).

import { BUILD_PIECES, type BuildPieceType } from '../data/buildPieces.ts';
import { addItem, hasItems, removeItem } from './inventorySystem.ts';

/** The 6 axis face directions; index 0..5. Opposite of i is `i ^ 1`. */
export const FACE_DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
];

export function oppositeFace(i: number): number {
  return i ^ 1;
}

/** Nearest face index to a (roughly axis-aligned) normal. */
export function faceIndexForNormal(nx: number, ny: number, nz: number): number {
  let best = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < 6; i++) {
    const d = nx * FACE_DIRS[i][0] + ny * FACE_DIRS[i][1] + nz * FACE_DIRS[i][2];
    if (d > bestDot) { bestDot = d; best = i; }
  }
  return best;
}

export interface StructurePiece {
  id: number;
  cell: [number, number, number];
  face: number; // 0..5 (index into FACE_DIRS)
  type: BuildPieceType;
}

const pieces = new Map<string, StructurePiece>(); // key: "x,y,z:face"
const foundationCells = new Set<string>();        // key: "x,y,z"
let nextId = 1;
let version = 0;
const listeners = new Set<() => void>();

function emit() { listeners.forEach(l => l()); }
function cellKey(x: number, y: number, z: number): string { return `${x},${y},${z}`; }
function panelKey(x: number, y: number, z: number, face: number): string { return `${x},${y},${z}:${face}`; }

export function hasFoundation(x: number, y: number, z: number): boolean {
  return foundationCells.has(cellKey(x, y, z));
}

export function hasPanel(x: number, y: number, z: number, face: number): boolean {
  return pieces.has(panelKey(x, y, z, face));
}

export function getPieceAt(x: number, y: number, z: number, face: number): StructurePiece | undefined {
  return pieces.get(panelKey(x, y, z, face));
}

/** True if any of the cell's faces holds a wall (used for ceiling support). */
export function hasWallInCell(x: number, y: number, z: number): boolean {
  for (let f = 0; f < 6; f++) {
    const p = pieces.get(panelKey(x, y, z, f));
    if (p && p.type === 'wall') return true;
  }
  return false;
}

export function canAfford(type: BuildPieceType): boolean {
  return hasItems(BUILD_PIECES[type].cost);
}

/** Place a piece at (cell, face). Validates occupancy + cost; spends resources. */
export function placePiece(cell: [number, number, number], face: number, type: BuildPieceType): boolean {
  const [x, y, z] = cell;
  if (hasPanel(x, y, z, face)) return false;
  if (!hasItems(BUILD_PIECES[type].cost)) return false;
  for (const c of BUILD_PIECES[type].cost) removeItem(c.id, c.qty);
  pieces.set(panelKey(x, y, z, face), { id: nextId++, cell: [x, y, z], face, type });
  if (type === 'foundation') foundationCells.add(cellKey(x, y, z));
  version++;
  emit();
  return true;
}

/** Remove a piece, refunding half its cost (rounded down). */
export function removePiece(cell: [number, number, number], face: number): boolean {
  const [x, y, z] = cell;
  const key = panelKey(x, y, z, face);
  const piece = pieces.get(key);
  if (!piece) return false;
  pieces.delete(key);
  if (piece.type === 'foundation') foundationCells.delete(cellKey(x, y, z));
  for (const c of BUILD_PIECES[piece.type].cost) {
    const refund = Math.floor(c.qty / 2);
    if (refund > 0) addItem(c.id, refund);
  }
  version++;
  emit();
  return true;
}

export function getPieces(): StructurePiece[] {
  return [...pieces.values()];
}

export function getStructureVersion(): number {
  return version;
}

export function resetStructures(): void {
  if (pieces.size > 0 || foundationCells.size > 0) {
    pieces.clear();
    foundationCells.clear();
    version++;
    emit();
  }
}

export function subscribeStructures(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
