import * as THREE from 'three';
import { BUILD_PIECES } from '../data/buildPieces.ts';
import {
  FACE_DIRS,
  getPieces,
  oppositeFace,
  type StructurePiece
} from './structureSystem.ts';
import {
  PLAYER_CENTER_CLEARANCE,
  VOXEL_SCALE,
  voxelCoordToWorld
} from '../../utils/cubeGravityConstants.ts';
import { getCampfires, type Campfire } from './campfires.ts';

export type ShelterCell = [number, number, number];

export interface ShelterAnalysis {
  sheltered: boolean;
  cell: ShelterCell;
  /** Cells connected to the player without crossing a sealing panel. */
  interiorCells: ShelterCell[];
  /** Mean insulation of the enclosure faces encountered by the flood fill. */
  insulation: number;
}

export interface ShelterSpawn {
  position: THREE.Vector3;
  up: THREE.Vector3;
  cell: ShelterCell;
  insulation: number;
}

const MAX_VISITED_CELLS = 4096;
const MAX_AXIS_SPAN = 32;
const LOCAL_STRUCTURE_RADIUS = MAX_AXIS_SPAN / 2;
export const CAMPFIRE_WARMTH_RADIUS = 7;

function cellKey(cell: ShelterCell): string {
  return `${cell[0]},${cell[1]},${cell[2]}`;
}

function panelKey(cell: ShelterCell, face: number): string {
  return `${cellKey(cell)}:${face}`;
}

/** A fitted, closed doorway seals even though the empty doorway definition does not. */
export function isShelterSeal(piece: StructurePiece): boolean {
  if (piece.face < 0 || piece.face >= FACE_DIRS.length) return false;
  if (piece.type === 'doorway') return Boolean(piece.leaf) && !piece.open;
  const definition = BUILD_PIECES[piece.type];
  if (definition.openable) return !piece.open;
  return definition.seals;
}

function sealingPanels(pieces: readonly StructurePiece[]): Map<string, StructurePiece> {
  const panels = new Map<string, StructurePiece>();
  for (const piece of pieces) {
    if (isShelterSeal(piece)) panels.set(panelKey(piece.cell, piece.face), piece);
  }
  return panels;
}

function adjacent(cell: ShelterCell, face: number): ShelterCell {
  const direction = FACE_DIRS[face];
  return [
    cell[0] + direction[0],
    cell[1] + direction[1],
    cell[2] + direction[2]
  ];
}

function barrier(
  panels: ReadonlyMap<string, StructurePiece>,
  cell: ShelterCell,
  face: number
): StructurePiece | undefined {
  const direct = panels.get(panelKey(cell, face));
  if (direct) return direct;
  const neighbour = adjacent(cell, face);
  return panels.get(panelKey(neighbour, oppositeFace(face)));
}

function failed(cell: ShelterCell): ShelterAnalysis {
  return { sheltered: false, cell, interiorCells: [], insulation: 0 };
}

/**
 * Flood-fill the structure grid from an occupied cell. Reaching the expanded
 * structure bounds means outside air; a bounded component means a sealed room.
 * Panels are checked from both adjacent cells because placement may key either
 * side of the shared boundary.
 */
export function analyzeShelterCell(
  cell: ShelterCell,
  pieces: readonly StructurePiece[] = getPieces()
): ShelterAnalysis {
  const facePieces = pieces.filter(piece => (
    piece.face >= 0 && piece.face < FACE_DIRS.length
    && Math.abs(piece.cell[0] - cell[0]) <= LOCAL_STRUCTURE_RADIUS
    && Math.abs(piece.cell[1] - cell[1]) <= LOCAL_STRUCTURE_RADIUS
    && Math.abs(piece.cell[2] - cell[2]) <= LOCAL_STRUCTURE_RADIUS
  ));
  if (facePieces.length < 6) return failed(cell);

  const mins: ShelterCell = [Infinity, Infinity, Infinity];
  const maxs: ShelterCell = [-Infinity, -Infinity, -Infinity];
  for (const piece of facePieces) {
    for (let axis = 0; axis < 3; axis++) {
      mins[axis] = Math.min(mins[axis], piece.cell[axis]);
      maxs[axis] = Math.max(maxs[axis], piece.cell[axis]);
    }
  }
  for (let axis = 0; axis < 3; axis++) {
    if (maxs[axis] - mins[axis] > MAX_AXIS_SPAN) return failed(cell);
    mins[axis] -= 1;
    maxs[axis] += 1;
    if (cell[axis] < mins[axis] || cell[axis] > maxs[axis]) return failed(cell);
  }

  const panels = sealingPanels(facePieces);
  const queue: ShelterCell[] = [cell];
  const visited = new Set<string>([cellKey(cell)]);
  const interiorCells: ShelterCell[] = [];
  let insulationTotal = 0;
  let insulationFaces = 0;

  for (let cursor = 0; cursor < queue.length; cursor++) {
    if (visited.size > MAX_VISITED_CELLS) return failed(cell);
    const current = queue[cursor];
    interiorCells.push(current);
    for (let face = 0; face < FACE_DIRS.length; face++) {
      const sealedBy = barrier(panels, current, face);
      if (sealedBy) {
        insulationTotal += BUILD_PIECES[sealedBy.type].insulation;
        insulationFaces++;
        continue;
      }
      const next = adjacent(current, face);
      if (
        next[0] < mins[0] || next[0] > maxs[0]
        || next[1] < mins[1] || next[1] > maxs[1]
        || next[2] < mins[2] || next[2] > maxs[2]
      ) return failed(cell);
      const key = cellKey(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }

  return {
    sheltered: true,
    cell,
    interiorCells,
    insulation: insulationFaces > 0 ? insulationTotal / insulationFaces : 0
  };
}

export function analyzeShelterAtWorldPosition(
  position: THREE.Vector3,
  pieces: readonly StructurePiece[] = getPieces()
): ShelterAnalysis {
  return analyzeShelterCell([
    Math.round(position.x / VOXEL_SCALE),
    Math.round(position.y / VOXEL_SCALE),
    Math.round(position.z / VOXEL_SCALE)
  ], pieces);
}

export function isNearCampfire(
  position: THREE.Vector3,
  campfires: readonly Campfire[] = getCampfires(),
  radius = CAMPFIRE_WARMTH_RADIUS
): boolean {
  const radiusSq = radius * radius;
  return campfires.some(campfire => {
    const dx = position.x - campfire.pos[0];
    const dy = position.y - campfire.pos[1];
    const dz = position.z - campfire.pos[2];
    return dx * dx + dy * dy + dz * dz <= radiusSq;
  });
}

/** Nearest sealed room with a foundation and two connected interior cells. */
export function findShelterSpawn(
  near: THREE.Vector3,
  pieces: readonly StructurePiece[] = getPieces()
): ShelterSpawn | null {
  let best: ShelterSpawn | null = null;
  let bestDistanceSq = Infinity;
  const seen = new Set<string>();
  for (const piece of pieces) {
    if (piece.type !== 'foundation' || piece.face < 0 || piece.face >= FACE_DIRS.length) continue;
    const upFace = piece.up ?? oppositeFace(piece.face);
    const upDirection = FACE_DIRS[upFace];
    const lower: ShelterCell = [...piece.cell];
    const key = `${cellKey(lower)}:${upFace}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const analysis = analyzeShelterCell(lower, pieces);
    if (!analysis.sheltered) continue;
    const upper: ShelterCell = [
      lower[0] + upDirection[0],
      lower[1] + upDirection[1],
      lower[2] + upDirection[2]
    ];
    if (!analysis.interiorCells.some(candidate => cellKey(candidate) === cellKey(upper))) continue;

    const up = new THREE.Vector3(upDirection[0], upDirection[1], upDirection[2]);
    const position = voxelCoordToWorld(lower[0], lower[1], lower[2])
      .addScaledVector(up, PLAYER_CENTER_CLEARANCE - VOXEL_SCALE);
    const distanceSq = position.distanceToSquared(near);
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      best = { position, up, cell: lower, insulation: analysis.insulation };
    }
  }
  return best;
}
