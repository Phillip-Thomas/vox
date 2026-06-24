// --- Build placement (resolve a snap target from a raycast hit) --------------
//
// Targeting is RAYCAST-based so the ghost sits under the crosshair, with a march
// fallback for aiming across a foundation at eye height. The build frame ("up") is
// the PLAYER'S FOOTING (gravity up), snapped to the nearest axis — NOT the cell's
// dominant face. That's what lets you build AROUND A CUBE EDGE: the same edge cell
// can carry a foundation on its −Y face (built from the +Y surface) AND its −X face
// (built from the +X surface), because foundations are tracked PER FACE.
//
//   foundation → on the top face of terrain (relative to your footing), or extend
//                off another foundation
//   wall       → a vertical face of a cell whose down-face (rel. footing) has a
//                foundation, OR stacked atop a wall below
//   ceiling    → the up face of a foundation/walled cell

import * as THREE from 'three';
import { VOXEL_SCALE, voxelCoordToWorld } from './cubeGravityConstants';
import { voxelSystem } from './efficientVoxelSystem';
import {
  FACE_DIRS, faceIndexForNormal, getPieceAt, hasFoundationInCell, hasFoundationOnFace,
  hasPanel, hasVolume, hasWallInCell, VOLUME_FACE
} from '../game/systems/structureSystem';
import { BUILD_PIECES, type BuildPieceType } from '../game/data/buildPieces';

export interface BuildHit {
  cell: [number, number, number];
  point: THREE.Vector3;
  isPanel: boolean;
  panelType?: BuildPieceType;
  panelFace?: number;
  normalIdx: number; // terrain hit: voxel face index hit (else -1)
}

export interface BuildTarget {
  cell: [number, number, number];
  face: number;
  valid: boolean;
}

const _c = new THREE.Vector3();
const _off = new THREE.Vector3();
const _up = new THREE.Vector3();
const _mp = new THREE.Vector3();

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

/** How far a ceiling may cantilever (tangent tiles) from a directly-supported one. */
const MAX_CEILING_CANTILEVER = 3;

function directlySupported(x: number, y: number, z: number): boolean {
  return hasFoundationInCell(x, y, z) || hasWallInCell(x, y, z);
}

/**
 * A ceiling at `cell` (on the up face) is supported if the cell is directly over a
 * wall/foundation, OR it connects — across already-placed ceiling tiles in the
 * tangent plane — to a directly-supported ceiling within MAX_CEILING_CANTILEVER
 * tiles. Lets flat roofs/floors extend out a bit, but not float forever.
 */
function ceilingSupported(cell: [number, number, number], upIdx: number): boolean {
  if (directlySupported(cell[0], cell[1], cell[2])) return true;
  const downIdx = upIdx ^ 1;
  const k = (c: number[]) => `${c[0]},${c[1]},${c[2]}`;
  const visited = new Set<string>([k(cell)]);
  const queue: Array<{ c: [number, number, number]; d: number }> = [{ c: cell, d: 0 }];
  while (queue.length) {
    const { c, d } = queue.shift()!;
    if (d > 0 && hasPanel(c[0], c[1], c[2], upIdx) && directlySupported(c[0], c[1], c[2])) return true;
    if (d >= MAX_CEILING_CANTILEVER) continue;
    for (let f = 0; f < 6; f++) {
      if (f === upIdx || f === downIdx) continue;
      const n: [number, number, number] = [c[0] + FACE_DIRS[f][0], c[1] + FACE_DIRS[f][1], c[2] + FACE_DIRS[f][2]];
      const nk = k(n);
      // Traverse only over EXISTING ceiling tiles (the target cell at d=0 has none yet).
      if (!visited.has(nk) && hasPanel(n[0], n[1], n[2], upIdx)) { visited.add(nk); queue.push({ c: n, d: d + 1 }); }
    }
  }
  return false;
}

function tangentOffset(cell: [number, number, number], point: THREE.Vector3, upIdx: number): THREE.Vector3 {
  _up.set(FACE_DIRS[upIdx][0], FACE_DIRS[upIdx][1], FACE_DIRS[upIdx][2]);
  voxelCoordToWorld(cell[0], cell[1], cell[2], _c);
  _off.copy(point).sub(_c);
  _off.addScaledVector(_up, -_off.dot(_up));
  return _off;
}

// --- Volume orientation (stairs/roof): shared by the renderer + placement -----
// Local frame: up = +Y, the piece ascends/slopes along +Z. volumeQuat maps that into
// the world for a given build-up axis + yaw step; volumeOrientFromForward picks the
// yaw whose +Z best matches where the player looks.
export function volumeQuat(upIdx: number, orient: number): THREE.Quaternion {
  const u = FACE_DIRS[upIdx] ?? FACE_DIRS[2];
  const up = new THREE.Vector3(u[0], u[1], u[2]);
  const base = new THREE.Quaternion();
  if (up.y > 0.999) base.identity();
  else if (up.y < -0.999) base.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  else base.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  return new THREE.Quaternion().setFromAxisAngle(up, (orient || 0) * Math.PI / 2).multiply(base);
}

export function volumeOrientFromForward(upIdx: number, forward: THREE.Vector3): number {
  const u = FACE_DIRS[upIdx] ?? FACE_DIRS[2];
  const up = new THREE.Vector3(u[0], u[1], u[2]);
  const f = forward.clone().addScaledVector(up, -forward.dot(up));
  if (f.lengthSq() < 1e-6) return 0;
  f.normalize();
  const z = new THREE.Vector3();
  let best = 0, bestDot = -Infinity;
  for (let o = 0; o < 4; o++) {
    z.set(0, 0, 1).applyQuaternion(volumeQuat(upIdx, o));
    const d = z.dot(f);
    if (d > bestDot) { bestDot = d; best = o; }
  }
  return best;
}

export function resolveBuildTarget(hit: BuildHit, piece: BuildPieceType, up: THREE.Vector3): BuildTarget | null {
  const upIdx = faceIndexForNormal(up.x, up.y, up.z);
  const downIdx = upIdx ^ 1;
  const u = FACE_DIRS[upIdx];
  const free = (c: [number, number, number], f: number) => !hasPanel(c[0], c[1], c[2], f);
  // Wall variants (doorway/window/gable) snap exactly like a wall.
  const family = BUILD_PIECES[piece].family;

  if (family === 'foundation') {
    if (hit.isPanel && hit.panelType === 'foundation') {
      const face = nearestVerticalFace(tangentOffset(hit.cell, hit.point, upIdx), upIdx);
      if (face < 0) return null;
      const d = FACE_DIRS[face];
      const cell: [number, number, number] = [hit.cell[0] + d[0], hit.cell[1] + d[1], hit.cell[2] + d[2]];
      const restsOnGround = voxelSystem.hasVoxel(cell[0] - u[0], cell[1] - u[1], cell[2] - u[2]);
      const valid = !voxelSystem.hasVoxel(cell[0], cell[1], cell[2]) && free(cell, downIdx)
        && (restsOnGround || hasFoundationOnFace(hit.cell[0], hit.cell[1], hit.cell[2], downIdx));
      return { cell, face: downIdx, valid };
    }
    if (!hit.isPanel) {
      if (hit.normalIdx !== upIdx) return null; // only the surface you stand on
      const cell: [number, number, number] = [hit.cell[0] + u[0], hit.cell[1] + u[1], hit.cell[2] + u[2]];
      const valid = !voxelSystem.hasVoxel(cell[0], cell[1], cell[2]) && free(cell, downIdx);
      return { cell, face: downIdx, valid };
    }
    return null;
  }

  if (family === 'volume') {
    // Stairs/roof place like a foundation: in the empty cell on top of the surface
    // you point at (terrain top-face, a foundation, or another volume to stack).
    const volFree = (c: [number, number, number]) =>
      !voxelSystem.hasVoxel(c[0], c[1], c[2]) && !hasVolume(c[0], c[1], c[2]);
    if (!hit.isPanel) {
      if (hit.normalIdx !== upIdx) return null;
      const cell: [number, number, number] = [hit.cell[0] + u[0], hit.cell[1] + u[1], hit.cell[2] + u[2]];
      return { cell, face: VOLUME_FACE, valid: volFree(cell) };
    }
    // On a foundation top-face, or stacked on the volume you point at.
    if (hit.panelType === 'foundation' || hit.panelType === 'stairs' || hit.panelType === 'sloped_roof') {
      const cell: [number, number, number] = [hit.cell[0] + u[0], hit.cell[1] + u[1], hit.cell[2] + u[2]];
      return { cell, face: VOLUME_FACE, valid: volFree(cell) };
    }
    return null;
  }

  if (family === 'wall') {
    const hitIsWall = hit.panelType !== undefined && BUILD_PIECES[hit.panelType].family === 'wall';
    if (hit.isPanel && hitIsWall && hit.panelFace !== undefined) {
      const cell: [number, number, number] = [hit.cell[0] + u[0], hit.cell[1] + u[1], hit.cell[2] + u[2]];
      return { cell, face: hit.panelFace, valid: free(cell, hit.panelFace) }; // stack atop the wall
    }
    if (hit.isPanel && hit.panelType === 'foundation') {
      const face = nearestVerticalFace(tangentOffset(hit.cell, hit.point, upIdx), upIdx);
      if (face < 0) return null;
      const valid = hasFoundationOnFace(hit.cell[0], hit.cell[1], hit.cell[2], downIdx) && free(hit.cell, face);
      return { cell: hit.cell, face, valid };
    }
    return null;
  }

  // ceiling
  const hitFam = hit.isPanel && hit.panelType !== undefined ? BUILD_PIECES[hit.panelType].family : null;
  if (hitFam === 'ceiling') {
    // Extend a flat roof/floor off the edge you point at (cantilevered up to max).
    const face = nearestVerticalFace(tangentOffset(hit.cell, hit.point, upIdx), upIdx);
    if (face < 0) return null;
    const d = FACE_DIRS[face];
    const cell: [number, number, number] = [hit.cell[0] + d[0], hit.cell[1] + d[1], hit.cell[2] + d[2]];
    return { cell, face: upIdx, valid: free(cell, upIdx) && ceilingSupported(cell, upIdx) };
  }
  if (hitFam === 'wall' || hitFam === 'foundation') {
    const c = hit.cell;
    return { cell: c, face: upIdx, valid: free(c, upIdx) && ceilingSupported(c, upIdx) };
  }
  return null;
}

// --- March fallbacks (cell the ray passes THROUGH; for eye-height forward aim) ---

export function marchWallTarget(origin: THREE.Vector3, dir: THREE.Vector3, reach: number, up: THREE.Vector3): BuildTarget | null {
  const upIdx = faceIndexForNormal(up.x, up.y, up.z);
  const u = FACE_DIRS[upIdx];
  _up.set(u[0], u[1], u[2]);
  const step = VOXEL_SCALE * 0.25;
  for (let t = 0.5; t <= reach; t += step) {
    _mp.copy(dir).multiplyScalar(t).add(origin);
    const cx = Math.round(_mp.x / VOXEL_SCALE), cy = Math.round(_mp.y / VOXEL_SCALE), cz = Math.round(_mp.z / VOXEL_SCALE);
    if (voxelSystem.hasVoxel(cx, cy, cz)) continue;
    _off.copy(dir).addScaledVector(_up, -dir.dot(_up)); // faced tangent direction
    const face = nearestVerticalFace(_off, upIdx);
    if (face < 0 || hasPanel(cx, cy, cz, face)) continue;
    const below = getPieceAt(cx - u[0], cy - u[1], cz - u[2], face);
    const wallBelow = below !== undefined && BUILD_PIECES[below.type].family === 'wall';
    if (hasFoundationOnFace(cx, cy, cz, upIdx ^ 1) || wallBelow) {
      return { cell: [cx, cy, cz], face, valid: true };
    }
  }
  return null;
}

export function marchCeilingTarget(origin: THREE.Vector3, dir: THREE.Vector3, reach: number, up: THREE.Vector3): BuildTarget | null {
  const upIdx = faceIndexForNormal(up.x, up.y, up.z);
  const step = VOXEL_SCALE * 0.25;
  for (let t = 0.5; t <= reach; t += step) {
    _mp.copy(dir).multiplyScalar(t).add(origin);
    const cx = Math.round(_mp.x / VOXEL_SCALE), cy = Math.round(_mp.y / VOXEL_SCALE), cz = Math.round(_mp.z / VOXEL_SCALE);
    if (voxelSystem.hasVoxel(cx, cy, cz) || hasPanel(cx, cy, cz, upIdx)) continue;
    if (ceilingSupported([cx, cy, cz], upIdx)) return { cell: [cx, cy, cz], face: upIdx, valid: true };
  }
  return null;
}
