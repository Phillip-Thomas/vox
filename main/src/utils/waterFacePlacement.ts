import * as THREE from 'three';
import { FACE_NORMALS } from './waterVoxels';

// Rest position of a water surface along its exposed face normal. The cell spans
// +/-1 world units (VOXEL_SCALE=2), so this leaves wave headroom inside the cell.
export const WATER_FACE_OFFSET = 0.55;
export const WATER_QUAD_SIZE = 2.0;

const OUTWARD_SURFACE_DOT = 0.5;
const SIDE_BOTTOM = -1.0;
const SIDE_BOUNDARY = 1.0;
const SIDE_HEIGHT = WATER_FACE_OFFSET - SIDE_BOTTOM;
const SIDE_CENTER_H = (WATER_FACE_OFFSET + SIDE_BOTTOM) / 2;
const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);

export const WATER_FACE_QUATERNIONS: THREE.Quaternion[] = FACE_NORMALS.map(([nx, ny, nz]) =>
  new THREE.Quaternion().setFromUnitVectors(PLANE_NORMAL, new THREE.Vector3(nx, ny, nz))
);

export type WaterFaceKind = 'surface' | 'wall' | 'floor';

export interface WaterFacePlacementScratch {
  facePos: THREE.Vector3;
  normal: THREE.Vector3;
  up: THREE.Vector3;
  right: THREE.Vector3;
  yColumn: THREE.Vector3;
}

export function createWaterFacePlacementScratch(): WaterFacePlacementScratch {
  return {
    facePos: new THREE.Vector3(),
    normal: new THREE.Vector3(),
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
  const len = cellCenter.length();
  if (len <= 1e-6) return 'surface';
  const outwardness = faceNormal.dot(cellCenter) / len;
  if (outwardness >= OUTWARD_SURFACE_DOT) return 'surface';
  if (outwardness <= -OUTWARD_SURFACE_DOT) return 'floor';
  return 'wall';
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
    scratch.facePos.copy(cellCenter).addScaledVector(nrm, WATER_FACE_OFFSET);
    target.compose(scratch.facePos, WATER_FACE_QUATERNIONS[faceDir], UNIT_SCALE);
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
