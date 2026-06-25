import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  classifyWaterFace,
  composeWaterEdgeCapMatrix,
  composeWaterFaceMatrix,
  createWaterFacePlacementScratch,
  shouldRenderWaterEdgeCap,
  surfaceEdgeTrimForWaterFace,
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

  it('keeps near-edge but non-edge water cells aligned to their dominant cube face', () => {
    const nearEdgeCenter = new THREE.Vector3(50, 40, 0);

    expect(classifyWaterFace(nearEdgeCenter, POS_X)).toBe('surface');
    expect(classifyWaterFace(nearEdgeCenter, POS_Y)).toBe('wall');
    expect(classifyWaterFace(nearEdgeCenter, NEG_X)).toBe('floor');
  });

  it('does not trim the water band near a cube edge unless the cell is on the edge', () => {
    const nearEdgeCenter = new THREE.Vector3(50, 40, 0);
    const trim = surfaceEdgeTrimForWaterFace(0, nearEdgeCenter);

    expect(trim.offset.length()).toBeCloseTo(0);
    expect(trim.scale.x).toBeCloseTo(1);
    expect(trim.scale.y).toBeCloseTo(1);
  });

  it('trims cube-edge surface faces so adjacent sheets meet instead of crossing', () => {
    const edgeCenter = new THREE.Vector3(50, 50, 0);
    const trim = surfaceEdgeTrimForWaterFace(0, edgeCenter);

    expect(trim.offset.x).toBeCloseTo(0);
    expect(trim.offset.y).toBeCloseTo(-0.5);
    expect(trim.offset.z).toBeCloseTo(0);
    expect(trim.scale.x).toBeCloseTo(0.5);
    expect(trim.scale.y).toBeCloseTo(1);
  });

  it('keeps cube-edge surfaces face-aligned while stopping at the shared water edge', () => {
    const xFaceMatrix = new THREE.Matrix4();
    const yFaceMatrix = new THREE.Matrix4();
    const xPosition = new THREE.Vector3();
    const yPosition = new THREE.Vector3();
    const xTangent = new THREE.Vector3();
    const yTangent = new THREE.Vector3();
    const xNormal = new THREE.Vector3();
    const yNormal = new THREE.Vector3();
    const edgeCenter = new THREE.Vector3(50, 50, 0);
    const trimCenter = -0.5;
    const trimScale = 0.5;

    const xKind = composeWaterFaceMatrix(0, edgeCenter, xFaceMatrix, createWaterFacePlacementScratch());
    const yKind = composeWaterFaceMatrix(2, edgeCenter, yFaceMatrix, createWaterFacePlacementScratch());
    xPosition.setFromMatrixPosition(xFaceMatrix);
    yPosition.setFromMatrixPosition(yFaceMatrix);
    xTangent.setFromMatrixColumn(xFaceMatrix, 0);
    yTangent.setFromMatrixColumn(yFaceMatrix, 1);
    xNormal.setFromMatrixColumn(xFaceMatrix, 2);
    yNormal.setFromMatrixColumn(yFaceMatrix, 2);

    expect(xKind).toBe('surface');
    expect(yKind).toBe('surface');
    expect(xPosition.x).toBeCloseTo(edgeCenter.x + WATER_FACE_OFFSET);
    expect(xPosition.y).toBeCloseTo(edgeCenter.y + trimCenter);
    expect(yPosition.x).toBeCloseTo(edgeCenter.x + trimCenter);
    expect(yPosition.y).toBeCloseTo(edgeCenter.y + WATER_FACE_OFFSET);
    expect(xTangent.length()).toBeCloseTo(trimScale);
    expect(yTangent.length()).toBeCloseTo(trimScale);
    expect(xNormal.normalize().x).toBeCloseTo(1);
    expect(yNormal.normalize().y).toBeCloseTo(1);
  });

  it('adds a rounded edge cap only for actual cube-edge surface pairs', () => {
    const edgeCenter = new THREE.Vector3(50, 50, 0);
    const nearEdgeCenter = new THREE.Vector3(50, 40, 0);
    const capMatrix = new THREE.Matrix4();
    const capOrigin = new THREE.Vector3();
    const capX = new THREE.Vector3();
    const capY = new THREE.Vector3();

    expect(shouldRenderWaterEdgeCap(0, 2, edgeCenter)).toBe(true);
    expect(shouldRenderWaterEdgeCap(0, 2, nearEdgeCenter)).toBe(false);
    expect(composeWaterEdgeCapMatrix(0, 2, edgeCenter, capMatrix, createWaterFacePlacementScratch())).toBe(true);

    capOrigin.setFromMatrixPosition(capMatrix);
    capX.setFromMatrixColumn(capMatrix, 0).multiplyScalar(WATER_FACE_OFFSET).add(capOrigin);
    capY.setFromMatrixColumn(capMatrix, 1).multiplyScalar(WATER_FACE_OFFSET).add(capOrigin);

    expect(capX.x).toBeCloseTo(edgeCenter.x + WATER_FACE_OFFSET);
    expect(capX.y).toBeCloseTo(edgeCenter.y);
    expect(capY.x).toBeCloseTo(edgeCenter.x);
    expect(capY.y).toBeCloseTo(edgeCenter.y + WATER_FACE_OFFSET);
  });
});
