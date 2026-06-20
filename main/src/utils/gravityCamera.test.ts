import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyGravityCameraTransform,
  clampCameraPitch,
  lookDirectionFromGravityFrame,
  rotateCameraForwardYaw,
  transportCameraForward
} from './gravityCamera';
import { FACE_NORMALS } from './surfaceControls';

function expectVectorClose(actual: THREE.Vector3, expected: THREE.Vector3, precision = 5) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

describe('gravity camera frame', () => {
  it('transports the tangent forward vector when the gravity up changes', () => {
    const forward = new THREE.Vector3(1, 0, 0);
    const transported = transportCameraForward(
      forward,
      FACE_NORMALS.top,
      FACE_NORMALS.right
    );

    expect(transported.dot(FACE_NORMALS.right)).toBeCloseTo(0, 5);
    expect(transported.length()).toBeCloseTo(1, 5);
    expectVectorClose(transported, new THREE.Vector3(0, -1, 0));
  });

  it('keeps yaw on the active gravity tangent plane', () => {
    const forward = new THREE.Vector3(0, 0, -1);
    const yawed = rotateCameraForwardYaw(forward, FACE_NORMALS.top, -Math.PI / 2);

    expect(yawed.dot(FACE_NORMALS.top)).toBeCloseTo(0, 5);
    expectVectorClose(yawed, new THREE.Vector3(1, 0, 0));
  });

  it('builds pitch from the gravity frame instead of world axes', () => {
    const look = lookDirectionFromGravityFrame(
      new THREE.Vector3(0, 0, -1),
      FACE_NORMALS.right,
      Math.PI / 6
    );

    expect(look.dot(FACE_NORMALS.right)).toBeCloseTo(0.5, 5);
    expect(look.length()).toBeCloseTo(1, 5);
  });

  it('keeps world camera direction and eye offset aligned with gravity despite parent rotation', () => {
    const parent = new THREE.Object3D();
    parent.position.set(10, 20, 30);
    parent.quaternion.setFromUnitVectors(FACE_NORMALS.top, FACE_NORMALS.right);

    const camera = new THREE.PerspectiveCamera();
    parent.add(camera);

    const up = FACE_NORMALS.right;
    const forward = new THREE.Vector3(0, 0, -1);
    applyGravityCameraTransform(camera, up, forward, 0, 1);
    parent.updateMatrixWorld(true);

    const direction = new THREE.Vector3();
    const worldPosition = new THREE.Vector3();
    camera.getWorldDirection(direction);
    camera.getWorldPosition(worldPosition);

    expectVectorClose(direction, forward);
    expectVectorClose(worldPosition, parent.position.clone().add(up));
    expect(forward.dot(up)).toBeCloseTo(0, 5);
  });

  it('clamps pitch before it can align with the gravity axis', () => {
    expect(clampCameraPitch(Math.PI)).toBeLessThan(Math.PI / 2);
    expect(clampCameraPitch(-Math.PI)).toBeGreaterThan(-Math.PI / 2);
  });
});
