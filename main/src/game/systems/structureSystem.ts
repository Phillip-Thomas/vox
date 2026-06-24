// --- Structure store (placed shelter pieces) ---------------------------------
//
// Placed build pieces, stored as panels keyed by (voxel cell, face). A foundation
// also registers its cell so walls/ceilings can require one. World-relative coords →
// reset on world swap. Placing spends the piece's resource cost; removing refunds a
// fraction. Module-singleton + version/subscribe, persistence-ready (the home base).

import { BUILD_PIECES, type BuildPieceType } from '../data/buildPieces.ts';
import { pieceCost, type BuildMaterialId } from '../data/buildMaterials.ts';
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

/** Sentinel "face" for a volume piece (stairs/roof) — one per cell, distinct from
 *  the 6 panel faces, so a cell can hold panels AND a volume. */
export const VOLUME_FACE = 6;

export interface StructurePiece {
  id: number;
  cell: [number, number, number];
  face: number; // 0..5 (FACE_DIRS), or VOLUME_FACE for volume pieces
  type: BuildPieceType;
  material: BuildMaterialId;
  /** Doorways are 2 cells tall: a 'lower' + 'upper' half, linked via `partner`. */
  tall?: 'lower' | 'upper';
  partner?: [number, number, number];
  /** Volume pieces: the build-up axis (0..5) + yaw step (0..3) they're oriented by. */
  up?: number;
  orient?: number;
  /** Openable pieces (door): true when open (passable, not sealing). */
  open?: boolean;
}

const pieces = new Map<string, StructurePiece>(); // key: "x,y,z:face"
let nextId = 1;
let version = 0;
const listeners = new Set<() => void>();

function emit() { listeners.forEach(l => l()); }
function panelKey(x: number, y: number, z: number, face: number): string { return `${x},${y},${z}:${face}`; }

/** True if THIS face of the cell holds a foundation (a cell can carry foundations
 *  on several faces — e.g. wrapping around a cube edge, one per adjacent surface). */
export function hasFoundationOnFace(x: number, y: number, z: number, face: number): boolean {
  return pieces.get(panelKey(x, y, z, face))?.type === 'foundation';
}

/** True if ANY face of the cell holds a foundation (used for ceiling support). */
export function hasFoundationInCell(x: number, y: number, z: number): boolean {
  for (let f = 0; f < 6; f++) {
    if (pieces.get(panelKey(x, y, z, f))?.type === 'foundation') return true;
  }
  return false;
}

export function hasPanel(x: number, y: number, z: number, face: number): boolean {
  return pieces.has(panelKey(x, y, z, face));
}

export function getPieceAt(x: number, y: number, z: number, face: number): StructurePiece | undefined {
  return pieces.get(panelKey(x, y, z, face));
}

/** True if any of the cell's faces holds a wall-family piece (wall/doorway/window/
 *  gable) — used for ceiling support. */
export function hasWallInCell(x: number, y: number, z: number): boolean {
  for (let f = 0; f < 6; f++) {
    const p = pieces.get(panelKey(x, y, z, f));
    if (p && BUILD_PIECES[p.type].family === 'wall') return true;
  }
  return false;
}

// Free build (debug): skip resource cost/refund so the catalog can be exercised
// without grinding. Injected (not URL-read here) — App sets it from ?debug=1.
let freeBuild = false;
export function setFreeBuild(on: boolean): void { freeBuild = on; }
export function isFreeBuild(): boolean { return freeBuild; }

export function canAfford(type: BuildPieceType, material: BuildMaterialId): boolean {
  return freeBuild || hasItems(pieceCost(type, material));
}

/** Place a piece at (cell, face) in a material. Validates occupancy + cost; spends. */
export function placePiece(cell: [number, number, number], face: number, type: BuildPieceType, material: BuildMaterialId): boolean {
  const [x, y, z] = cell;
  if (hasPanel(x, y, z, face)) return false;
  const cost = pieceCost(type, material);
  if (!freeBuild) {
    if (!hasItems(cost)) return false;
    for (const c of cost) removeItem(c.id, c.qty);
  }
  pieces.set(panelKey(x, y, z, face), { id: nextId++, cell: [x, y, z], face, type, material });
  version++;
  emit();
  return true;
}

/**
 * Place a 2-cell-tall doorway (a lower + upper half on the same wall face), so the
 * opening clears the player's height. `upIdx` = the build-up face index; the upper
 * half sits in the cell one step along it. Cost is charged once for the pair.
 */
export function placeDoorway(cell: [number, number, number], face: number, upIdx: number, material: BuildMaterialId): boolean {
  const u = FACE_DIRS[upIdx];
  const upper: [number, number, number] = [cell[0] + u[0], cell[1] + u[1], cell[2] + u[2]];
  if (hasPanel(cell[0], cell[1], cell[2], face) || hasPanel(upper[0], upper[1], upper[2], face)) return false;
  const cost = pieceCost('doorway', material);
  if (!freeBuild) {
    if (!hasItems(cost)) return false;
    for (const c of cost) removeItem(c.id, c.qty);
  }
  pieces.set(panelKey(cell[0], cell[1], cell[2], face), { id: nextId++, cell: [...cell] as [number, number, number], face, type: 'doorway', material, tall: 'lower', partner: upper });
  pieces.set(panelKey(upper[0], upper[1], upper[2], face), { id: nextId++, cell: upper, face, type: 'doorway', material, tall: 'upper', partner: [...cell] as [number, number, number] });
  version++;
  emit();
  return true;
}

export function hasVolume(x: number, y: number, z: number): boolean {
  return pieces.has(panelKey(x, y, z, VOLUME_FACE));
}

export function getVolumeAt(x: number, y: number, z: number): StructurePiece | undefined {
  return pieces.get(panelKey(x, y, z, VOLUME_FACE));
}

/** Place a volume piece (stairs/sloped_roof) in a cell, oriented by `up` (build-up
 *  axis 0..5) + `orient` (yaw step 0..3). Validates occupancy + cost; spends. */
export function placeVolume(cell: [number, number, number], up: number, orient: number, type: BuildPieceType, material: BuildMaterialId): boolean {
  const [x, y, z] = cell;
  if (hasVolume(x, y, z)) return false;
  const cost = pieceCost(type, material);
  if (!freeBuild) {
    if (!hasItems(cost)) return false;
    for (const c of cost) removeItem(c.id, c.qty);
  }
  pieces.set(panelKey(x, y, z, VOLUME_FACE), { id: nextId++, cell: [x, y, z], face: VOLUME_FACE, type, material, up, orient });
  version++;
  emit();
  return true;
}

/** Toggle an openable piece (door) between closed (solid+sealing) and open. */
export function toggleDoor(cell: [number, number, number], face: number): boolean {
  const p = pieces.get(panelKey(cell[0], cell[1], cell[2], face));
  if (!p || !BUILD_PIECES[p.type].openable) return false;
  p.open = !p.open;
  version++;
  emit();
  return true;
}

/** Remove a piece (and its linked half, for a 2-tall doorway), refunding once. */
export function removePiece(cell: [number, number, number], face: number): boolean {
  const [x, y, z] = cell;
  const key = panelKey(x, y, z, face);
  const piece = pieces.get(key);
  if (!piece) return false;
  pieces.delete(key);
  if (piece.partner) {
    const p = piece.partner;
    pieces.delete(panelKey(p[0], p[1], p[2], face)); // remove the linked doorway half
  }
  if (!freeBuild) {
    for (const c of pieceCost(piece.type, piece.material)) {
      const refund = Math.floor(c.qty / 2);
      if (refund > 0) addItem(c.id, refund);
    }
  }
  version++;
  emit();
  return true;
}

export function getPieces(): StructurePiece[] {
  return [...pieces.values()];
}

/** Re-insert pieces from a save, bypassing cost (reissues ids). */
export function restorePieces(saved: ReadonlyArray<Omit<StructurePiece, 'id'>>): void {
  for (const p of saved) {
    pieces.set(panelKey(p.cell[0], p.cell[1], p.cell[2], p.face), { ...p, id: nextId++ });
  }
  if (saved.length > 0) { version++; emit(); }
}

export function getStructureVersion(): number {
  return version;
}

export function resetStructures(): void {
  if (pieces.size > 0) {
    pieces.clear();
    version++;
    emit();
  }
}

export function subscribeStructures(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
