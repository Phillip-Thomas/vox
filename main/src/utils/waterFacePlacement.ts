import * as THREE from 'three';
import { FACE_NORMALS } from './waterVoxels';

// Rest position of a water surface along its exposed face normal. The cell spans
// +/-1 world units (VOXEL_SCALE=2), so this leaves wave headroom inside the cell.
export const WATER_FACE_OFFSET = 0.55;
export const WATER_QUAD_SIZE = 2.0;

const DOMINANT_AXIS_EPS = 1e-6;
const SIDE_BOTTOM = -1.0;
const SIDE_BOUNDARY = 1.0;
const SIDE_HEIGHT = WATER_FACE_OFFSET - SIDE_BOTTOM;
const SIDE_CENTER_H = (WATER_FACE_OFFSET + SIDE_BOTTOM) / 2;
const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);
const SURFACE_EDGE_CAP_TANGENT = 0;
const SURFACE_EDGE_TRIM_SCALE = (SURFACE_EDGE_CAP_TANGENT - SIDE_BOTTOM) / 2;
const SURFACE_EDGE_TRIM_CENTER = (SURFACE_EDGE_CAP_TANGENT + SIDE_BOTTOM) / 2;
const SURFACE_TANGENTS: ReadonlyArray<
  readonly [readonly [number, number, number], readonly [number, number, number]]
> = [
  [[0, 1, 0], [0, 0, 1]], // +X
  [[0, 0, 1], [0, 1, 0]], // -X
  [[0, 0, 1], [1, 0, 0]], // +Y
  [[1, 0, 0], [0, 0, 1]], // -Y
  [[1, 0, 0], [0, 1, 0]], // +Z
  [[0, 1, 0], [1, 0, 0]]  // -Z
];

export const WATER_FACE_QUATERNIONS: THREE.Quaternion[] = FACE_NORMALS.map(([nx, ny, nz]) =>
  new THREE.Quaternion().setFromUnitVectors(PLANE_NORMAL, new THREE.Vector3(nx, ny, nz))
);

export type WaterFaceKind = 'surface' | 'wall' | 'floor';

export interface WaterFacePlacementScratch {
  facePos: THREE.Vector3;
  normal: THREE.Vector3;
  surfaceOffset: THREE.Vector3;
  surfaceScale: THREE.Vector2;
  surfaceX: THREE.Vector3;
  surfaceY: THREE.Vector3;
  capA: THREE.Vector3;
  capB: THREE.Vector3;
  capAxis: THREE.Vector3;
  up: THREE.Vector3;
  right: THREE.Vector3;
  yColumn: THREE.Vector3;
}

export function createWaterFacePlacementScratch(): WaterFacePlacementScratch {
  return {
    facePos: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    surfaceOffset: new THREE.Vector3(),
    surfaceScale: new THREE.Vector2(1, 1),
    surfaceX: new THREE.Vector3(),
    surfaceY: new THREE.Vector3(),
    capA: new THREE.Vector3(),
    capB: new THREE.Vector3(),
    capAxis: new THREE.Vector3(),
    up: new THREE.Vector3(),
    right: new THREE.Vector3(),
    yColumn: new THREE.Vector3()
  };
}

export function cubeSurfaceUpForWaterCell(cellCenter: THREE.Vector3, target = new THREE.Vector3()): THREE.Vector3 {
  const ax = Math.abs(cellCenter.x);
  const ay = Math.abs(cellCenter.y);
  const az = Math.abs(cellCenter.z);
  if (ax >= ay && ax >= az) return target.set(Math.sign(cellCenter.x) || 1, 0, 0);
  if (ay >= ax && ay >= az) return target.set(0, Math.sign(cellCenter.y) || 1, 0);
  return target.set(0, 0, Math.sign(cellCenter.z) || 1);
}

export function classifyWaterFace(cellCenter: THREE.Vector3, faceNormal: THREE.Vector3): WaterFaceKind {
  const dominant = dominantAxisMatch(cellCenter, faceNormal);
  if (dominant > 0) return 'surface';
  if (dominant < 0) return 'floor';
  return 'wall';
}

function dominantAxisMatch(cellCenter: THREE.Vector3, faceNormal: THREE.Vector3): -1 | 0 | 1 {
  const ax = Math.abs(cellCenter.x);
  const ay = Math.abs(cellCenter.y);
  const az = Math.abs(cellCenter.z);
  const maxAxis = Math.max(ax, ay, az);
  if (maxAxis <= DOMINANT_AXIS_EPS) return 1;

  if (Math.abs(faceNormal.x) > 0.999 && Math.abs(ax - maxAxis) <= DOMINANT_AXIS_EPS) {
    return Math.sign(faceNormal.x) === Math.sign(cellCenter.x) ? 1 : -1;
  }
  if (Math.abs(faceNormal.y) > 0.999 && Math.abs(ay - maxAxis) <= DOMINANT_AXIS_EPS) {
    return Math.sign(faceNormal.y) === Math.sign(cellCenter.y) ? 1 : -1;
  }
  if (Math.abs(faceNormal.z) > 0.999 && Math.abs(az - maxAxis) <= DOMINANT_AXIS_EPS) {
    return Math.sign(faceNormal.z) === Math.sign(cellCenter.z) ? 1 : -1;
  }
  return 0;
}

function isSurfaceFaceDirForWaterCell(cellCenter: THREE.Vector3, faceDir: number): boolean {
  const [nx, ny, nz] = FACE_NORMALS[faceDir];
  const ax = Math.abs(cellCenter.x);
  const ay = Math.abs(cellCenter.y);
  const az = Math.abs(cellCenter.z);
  const maxAxis = Math.max(ax, ay, az);
  if (maxAxis <= DOMINANT_AXIS_EPS) return true;
  if (nx !== 0) return Math.sign(nx) === Math.sign(cellCenter.x) && Math.abs(ax - maxAxis) <= DOMINANT_AXIS_EPS;
  if (ny !== 0) return Math.sign(ny) === Math.sign(cellCenter.y) && Math.abs(ay - maxAxis) <= DOMINANT_AXIS_EPS;
  return Math.sign(nz) === Math.sign(cellCenter.z) && Math.abs(az - maxAxis) <= DOMINANT_AXIS_EPS;
}

function setSurfaceTangents(faceDir: number, x: THREE.Vector3, y: THREE.Vector3): void {
  const [tx, ty] = SURFACE_TANGENTS[faceDir];
  x.set(tx[0], tx[1], tx[2]);
  y.set(ty[0], ty[1], ty[2]);
}

export function surfaceEdgeTrimForWaterFace(
  faceDir: number,
  cellCenter: THREE.Vector3,
  targetOffset = new THREE.Vector3(),
  targetScale = new THREE.Vector2(1, 1)
): { offset: THREE.Vector3; scale: THREE.Vector2 } {
  const len = cellCenter.length();
  targetOffset.set(0, 0, 0);
  targetScale.set(1, 1);
  if (len <= 1e-6) return { offset: targetOffset, scale: targetScale };

  const [tangentX, tangentY] = SURFACE_TANGENTS[faceDir];

  for (let otherFaceDir = 0; otherFaceDir < FACE_NORMALS.length; otherFaceDir++) {
    if (otherFaceDir === faceDir) continue;
    if (!isSurfaceFaceDirForWaterCell(cellCenter, otherFaceDir)) continue;

    const [ox, oy, oz] = FACE_NORMALS[otherFaceDir];
    const tangentXDot = ox * tangentX[0] + oy * tangentX[1] + oz * tangentX[2];
    const tangentYDot = ox * tangentY[0] + oy * tangentY[1] + oz * tangentY[2];
    if (Math.abs(tangentXDot) > 0.999) {
      targetScale.x = SURFACE_EDGE_TRIM_SCALE;
      targetOffset.x += ox * SURFACE_EDGE_TRIM_CENTER;
      targetOffset.y += oy * SURFACE_EDGE_TRIM_CENTER;
      targetOffset.z += oz * SURFACE_EDGE_TRIM_CENTER;
    } else if (Math.abs(tangentYDot) > 0.999) {
      targetScale.y = SURFACE_EDGE_TRIM_SCALE;
      targetOffset.x += ox * SURFACE_EDGE_TRIM_CENTER;
      targetOffset.y += oy * SURFACE_EDGE_TRIM_CENTER;
      targetOffset.z += oz * SURFACE_EDGE_TRIM_CENTER;
    }
  }

  return { offset: targetOffset, scale: targetScale };
}

export function shouldRenderWaterEdgeCap(faceDirA: number, faceDirB: number, cellCenter: THREE.Vector3): boolean {
  if (faceDirA === faceDirB) return false;
  if (!isSurfaceFaceDirForWaterCell(cellCenter, faceDirA)) return false;
  if (!isSurfaceFaceDirForWaterCell(cellCenter, faceDirB)) return false;
  const [ax, ay, az] = FACE_NORMALS[faceDirA];
  const [bx, by, bz] = FACE_NORMALS[faceDirB];
  return Math.abs(ax * bx + ay * by + az * bz) <= DOMINANT_AXIS_EPS;
}

export function composeWaterEdgeCapMatrix(
  faceDirA: number,
  faceDirB: number,
  cellCenter: THREE.Vector3,
  target: THREE.Matrix4,
  scratch: WaterFacePlacementScratch
): boolean {
  if (!shouldRenderWaterEdgeCap(faceDirA, faceDirB, cellCenter)) return false;

  const [ax, ay, az] = FACE_NORMALS[faceDirA];
  const [bx, by, bz] = FACE_NORMALS[faceDirB];
  scratch.capA.set(ax, ay, az);
  scratch.capB.set(bx, by, bz);
  scratch.capAxis.crossVectors(scratch.capA, scratch.capB);
  if (scratch.capAxis.lengthSq() <= 1e-6) return false;
  scratch.capAxis.normalize();
  target.makeBasis(scratch.capA, scratch.capB, scratch.capAxis);
  target.setPosition(cellCenter);
  return true;
}

export function composeWaterFaceMatrix(
  faceDir: number,
  cellCenter: THREE.Vector3,
  target: THREE.Matrix4,
  scratch: WaterFacePlacementScratch
): WaterFaceKind {
  const [nx, ny, nz] = FACE_NORMALS[faceDir];
  const nrm = scratch.normal.set(nx, ny, nz);
  const kind = classifyWaterFace(cellCenter, nrm);

  if (kind === 'surface') {
    const trim = surfaceEdgeTrimForWaterFace(faceDir, cellCenter, scratch.surfaceOffset, scratch.surfaceScale);
    setSurfaceTangents(faceDir, scratch.surfaceX, scratch.surfaceY);
    scratch.facePos.copy(cellCenter)
      .addScaledVector(nrm, WATER_FACE_OFFSET)
      .add(trim.offset);
    scratch.surfaceX.multiplyScalar(trim.scale.x);
    scratch.surfaceY.multiplyScalar(trim.scale.y);
    target.makeBasis(scratch.surfaceX, scratch.surfaceY, nrm);
    target.setPosition(scratch.facePos);
    return kind;
  }

  if (kind === 'floor') {
    scratch.facePos.copy(cellCenter).addScaledVector(nrm, SIDE_BOUNDARY);
    target.compose(scratch.facePos, WATER_FACE_QUATERNIONS[faceDir], UNIT_SCALE);
    return kind;
  }

  const up = cubeSurfaceUpForWaterCell(cellCenter, scratch.up);
  const right = scratch.right.crossVectors(up, nrm);
  if (right.lengthSq() < 1e-6) {
    right.set(0, 0, 1).cross(nrm);
    if (right.lengthSq() < 1e-6) right.set(0, 1, 0).cross(nrm);
  }
  right.normalize();
  scratch.yColumn.copy(up).multiplyScalar(SIDE_HEIGHT / 2);
  scratch.facePos.copy(cellCenter)
    .addScaledVector(nrm, SIDE_BOUNDARY)
    .addScaledVector(up, SIDE_CENTER_H);
  target.makeBasis(right, scratch.yColumn, nrm);
  target.setPosition(scratch.facePos);
  return kind;
}
