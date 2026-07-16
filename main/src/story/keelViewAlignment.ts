import * as THREE from 'three';
import { lookDirectionFromGravityFrame } from '../utils/gravityCamera.ts';

export interface KeelViewFallback {
  playerPosition: THREE.Vector3;
  playerUp: THREE.Vector3;
  surfaceForward: THREE.Vector3;
  pitch: number;
  eyeHeight: number;
}

export interface KeelViewScratch {
  forward: THREE.Vector3;
  eye: THREE.Vector3;
  toTarget: THREE.Vector3;
}

export function createKeelViewScratch(): KeelViewScratch {
  return {
    forward: new THREE.Vector3(),
    eye: new THREE.Vector3(),
    toTarget: new THREE.Vector3()
  };
}

/** One world-space ray contract for the mounted player camera and movie fallback. */
export function resolveKeelViewAlignment(
  camera: THREE.Camera | null,
  target: THREE.Vector3,
  fallback: KeelViewFallback,
  scratch: KeelViewScratch
): number {
  if (camera) {
    camera.getWorldDirection(scratch.forward);
    camera.getWorldPosition(scratch.eye);
  } else {
    lookDirectionFromGravityFrame(
      fallback.surfaceForward,
      fallback.playerUp,
      fallback.pitch,
      scratch.forward
    );
    scratch.eye.copy(fallback.playerPosition)
      .addScaledVector(fallback.playerUp, fallback.eyeHeight);
  }
  scratch.toTarget.copy(target).sub(scratch.eye);
  if (scratch.toTarget.lengthSq() <= 1e-8) return 1;
  scratch.toTarget.normalize();
  return Math.max(0, Math.min(1, scratch.forward.dot(scratch.toTarget)));
}
