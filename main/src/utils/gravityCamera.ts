import * as THREE from 'three';
import { makeTangentBasis } from './surfaceControls';

const DEFAULT_FORWARD = new THREE.Vector3(0, 0, -1);
const MAX_PITCH = Math.PI / 2 - 0.1;

const tempUp = new THREE.Vector3();
const tempForward = new THREE.Vector3();
const tempRight = new THREE.Vector3();
const tempLookDirection = new THREE.Vector3();
const tempWorldEye = new THREE.Vector3();
const tempWorldTarget = new THREE.Vector3();
const tempParentPosition = new THREE.Vector3();
const tempParentQuaternion = new THREE.Quaternion();
const tempParentInverse = new THREE.Quaternion();
const tempWorldQuaternion = new THREE.Quaternion();
const tempLocalQuaternion = new THREE.Quaternion();
const tempLocalOffset = new THREE.Vector3();
const tempLookMatrix = new THREE.Matrix4();
const tempTransport = new THREE.Quaternion();

export function clampCameraPitch(pitch: number) {
  return THREE.MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH);
}

export function transportCameraForward(
  forward: THREE.Vector3,
  oldUp: THREE.Vector3,
  newUp: THREE.Vector3,
  target = new THREE.Vector3()
) {
  tempTransport.setFromUnitVectors(oldUp, newUp);
  target.copy(forward).applyQuaternion(tempTransport);
  return makeTangentBasis(newUp, target, DEFAULT_FORWARD, target).forward;
}

export function rotateCameraForwardYaw(
  forward: THREE.Vector3,
  up: THREE.Vector3,
  yawDelta: number,
  target = new THREE.Vector3()
) {
  target.copy(forward).applyAxisAngle(up, yawDelta);
  return makeTangentBasis(up, target, DEFAULT_FORWARD, target).forward;
}

export function lookDirectionFromGravityFrame(
  forward: THREE.Vector3,
  up: THREE.Vector3,
  pitch: number,
  target = new THREE.Vector3()
) {
  const basis = makeTangentBasis(up, forward, DEFAULT_FORWARD, tempForward, tempRight);
  target
    .copy(basis.forward)
    .multiplyScalar(Math.cos(pitch))
    .addScaledVector(basis.up, Math.sin(pitch))
    .normalize();
  return target;
}

export function applyGravityCameraTransform(
  camera: THREE.Camera,
  up: THREE.Vector3,
  forward: THREE.Vector3,
  pitch: number,
  eyeHeight: number
) {
  tempUp.copy(up).normalize();
  const basis = makeTangentBasis(tempUp, forward, DEFAULT_FORWARD, tempForward, tempRight);
  forward.copy(basis.forward);
  lookDirectionFromGravityFrame(basis.forward, tempUp, pitch, tempLookDirection);

  const parent = camera.parent;
  if (parent) {
    parent.updateWorldMatrix(true, false);
    parent.getWorldQuaternion(tempParentQuaternion);
    tempParentInverse.copy(tempParentQuaternion).invert();

    tempLocalOffset.copy(tempUp).multiplyScalar(eyeHeight).applyQuaternion(tempParentInverse);
    camera.position.copy(tempLocalOffset);

    parent.getWorldPosition(tempParentPosition);
    tempWorldEye.copy(tempParentPosition).addScaledVector(tempUp, eyeHeight);
  } else {
    camera.getWorldPosition(tempWorldEye);
  }

  tempWorldTarget.copy(tempWorldEye).add(tempLookDirection);
  tempLookMatrix.lookAt(tempWorldEye, tempWorldTarget, tempUp);
  tempWorldQuaternion.setFromRotationMatrix(tempLookMatrix);

  if (parent) {
    tempLocalQuaternion.copy(tempParentInverse).multiply(tempWorldQuaternion);
    camera.quaternion.copy(tempLocalQuaternion);
  } else {
    camera.quaternion.copy(tempWorldQuaternion);
  }

  camera.up.copy(tempUp);
  camera.updateMatrixWorld(true);
}
