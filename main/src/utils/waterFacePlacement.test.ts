import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  classifyWaterFace,
  composeWaterFaceMatrix,
  createWaterFacePlacementScratch,
  WATER_FACE_OFFSET
} from './waterFacePlacement';

const POS_X = new THREE.Vector3(1, 0, 0);
const NEG_X = new THREE.Vector3(-1, 0, 0);
const POS_Y = new THREE.Vector3(0, 1, 0);
const POS_Z = new THREE.Vector3(0, 0, 1);

describe('water face placement', () => {
  it('treats cube-edge outward faces as water surfaces instead of raised side walls', () => {
    const edgeCenter = new THREE.Vector3(50, 50, 0);

    expect(classifyWaterFace(edgeCenter, POS_X)).toBe('surface');
    expect(classifyWaterFace(edgeCenter, POS_Y)).toBe('surface');
  });

  it('treats cube-corner outward faces as water surfaces', () => {
    const cornerCenter = new THREE.Vector3(50, 50, 50);

    expect(classifyWaterFace(cornerCenter, POS_X)).toBe('surface');
    expect(classifyWaterFace(cornerCenter, POS_Y)).toBe('surface');
    expect(classifyWaterFace(cornerCenter, POS_Z)).toBe('surface');
  });

  it('keeps true shoreline faces as walls and inward faces as floors', () => {
    const faceCenter = new THREE.Vector3(50, 0, 0);

    expect(classifyWaterFace(faceCenter, POS_X)).toBe('surface');
    expect(classifyWaterFace(faceCenter, POS_Y)).toBe('wall');
    expect(classifyWaterFace(faceCenter, NEG_X)).toBe('floor');
  });

  it('places cube-edge surface faces at the shared water offset, not the cell boundary', () => {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const edgeCenter = new THREE.Vector3(50, 50, 0);

    const kind = composeWaterFaceMatrix(2, edgeCenter, matrix, createWaterFacePlacementScratch());
    matrix.decompose(position, rotation, scale);

    expect(kind).toBe('surface');
    expect(position.x).toBeCloseTo(edgeCenter.x);
    expect(position.y).toBeCloseTo(edgeCenter.y + WATER_FACE_OFFSET);
    expect(position.z).toBeCloseTo(edgeCenter.z);
  });
});
