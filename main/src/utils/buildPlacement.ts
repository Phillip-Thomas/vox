// --- Build placement (resolve a snap target from a raycast hit) --------------
//
// Targeting is RAYCAST-based (not a ray-march) so the ghost sits exactly under the
// crosshair. The caller raycasts the voxel + structure meshes and passes the nearest
// hit; this resolves the (cell, face) the selected piece snaps to, plus whether it's
// a valid placement. Foundation-anchored with vertical wall STACKING:
//   foundation → on the top face of a terrain voxel, or extend off another foundation
//   wall       → on a foundation cell's vertical face, OR stacked atop a wall below
//   ceiling    → the up face of a foundation/walled cell
// "up" = the cube-face normal at the cell (face interiors; edges are a later pass).

import * as THREE from 'three';
import { voxelCoordToWorld } from './cubeGravityConstants';
import { dominantFaceForPosition, FACE_NORMALS } from './surfaceControls';
import { voxelSystem } from './efficientVoxelSystem';
import {
  FACE_DIRS, faceIndexForNormal, hasFoundation, hasPanel, hasWallInCell
} from '../game/systems/structureSystem';
import type { BuildPieceType } from '../game/data/buildPieces';

/** Normalized raycast hit handed to the resolver. */
export interface BuildHit {
  cell: [number, number, number];
  point: THREE.Vector3;     // world-space hit point (exact, under the crosshair)
  isPanel: boolean;         // hit a placed structure panel vs terrain
  panelType?: BuildPieceType;
  panelFace?: number;       // the hit panel's face (0..5)
  normalIdx: number;        // terrain hit: the voxel face index hit (else -1)
}

export interface BuildTarget {
  cell: [number, number, number];
  face: number;
  valid: boolean;
}

const _c = new THREE.Vector3();
const _off = new THREE.Vector3();

function upAtCell(cell: [number, number, number]): THREE.Vector3 {
  voxelCoordToWorld(cell[0], cell[1], cell[2], _c);
  return FACE_NORMALS[dominantFaceForPosition(_c)];
}

function nearestVerticalFace(off: THREE.Vector3, upIdx: number): number {
  const downIdx = upIdx ^ 1;
  let best = -1;
  let bestDot = -Infinity;
  for (let i = 0; i < 6; i++) {
    if (i === upIdx || i === downIdx) continue;
    const d = off.x * FACE_DIRS[i][0] + off.y * FACE_DIRS[i][1] + off.z * FACE_DIRS[i][2];
    if (d > bestDot) { bestDot = d; best = i; }
  }
  return best;
}

/** Tangent offset of the hit point within the hit cell, projected off `up`. */
function tangentOffset(cell: [number, number, number], point: THREE.Vector3, up: THREE.Vector3): THREE.Vector3 {
  voxelCoordToWorld(cell[0], cell[1], cell[2], _c);
  _off.copy(point).sub(_c);
  _off.addScaledVector(up, -_off.dot(up));
  return _off;
}

export function resolveBuildTarget(hit: BuildHit, piece: BuildPieceType): BuildTarget | null {
  const up = upAtCell(hit.cell);
  const upIdx = faceIndexForNormal(up.x, up.y, up.z);
  const downIdx = upIdx ^ 1;
  const ux = Math.round(up.x), uy = Math.round(up.y), uz = Math.round(up.z);

  if (piece === 'foundation') {
    if (hit.isPanel && hit.panelType === 'foundation') {
      // Extend the platform: step one cell in the tangent direction you point at.
      const face = nearestVerticalFace(tangentOffset(hit.cell, hit.point, up), upIdx);
      if (face < 0) return null;
      const d = FACE_DIRS[face];
      const cell: [number, number, number] = [hit.cell[0] + d[0], hit.cell[1] + d[1], hit.cell[2] + d[2]];
      const restsOnGround = voxelSystem.hasVoxel(cell[0] - ux, cell[1] - uy, cell[2] - uz);
      const valid = !voxelSystem.hasVoxel(cell[0], cell[1], cell[2]) && !hasFoundation(cell[0], cell[1], cell[2]) && (restsOnGround || hasFoundation(hit.cell[0], hit.cell[1], hit.cell[2]));
      return { cell, face: downIdx, valid };
    }
    if (!hit.isPanel) {
      // On terrain: only the TOP face (you set a foundation on the ground).
      if (hit.normalIdx !== upIdx) return null;
      const cell: [number, number, number] = [hit.cell[0] + ux, hit.cell[1] + uy, hit.cell[2] + uz];
      const valid = !voxelSystem.hasVoxel(cell[0], cell[1], cell[2]) && !hasFoundation(cell[0], cell[1], cell[2]);
      return { cell, face: downIdx, valid };
    }
    return null;
  }

  if (piece === 'wall') {
    if (hit.isPanel && hit.panelType === 'wall' && hit.panelFace !== undefined) {
      // STACK atop the wall you're looking at: same face, one cell up. Supported by
      // the wall below (which was itself only placeable if supported → induction).
      const cell: [number, number, number] = [hit.cell[0] + ux, hit.cell[1] + uy, hit.cell[2] + uz];
      const valid = !hasPanel(cell[0], cell[1], cell[2], hit.panelFace);
      return { cell, face: hit.panelFace, valid };
    }
    if (hit.isPanel && hit.panelType === 'foundation') {
      // First-course wall on the foundation cell's vertical face you point at.
      const face = nearestVerticalFace(tangentOffset(hit.cell, hit.point, up), upIdx);
      if (face < 0) return null;
      const valid = hasFoundation(hit.cell[0], hit.cell[1], hit.cell[2]) && !hasPanel(hit.cell[0], hit.cell[1], hit.cell[2], face);
      return { cell: hit.cell, face, valid };
    }
    return null;
  }

  // ceiling: cap the foundation/walled cell you're looking at.
  if (hit.isPanel && (hit.panelType === 'foundation' || hit.panelType === 'wall')) {
    const cell = hit.cell;
    const valid = (hasFoundation(cell[0], cell[1], cell[2]) || hasWallInCell(cell[0], cell[1], cell[2])) && !hasPanel(cell[0], cell[1], cell[2], upIdx);
    return { cell, face: upIdx, valid };
  }
  return null;
}
