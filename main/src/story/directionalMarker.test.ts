import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { projectDirectionalMarker } from './directionalMarker.ts';

function cameraAt(position: THREE.Vector3, target: THREE.Vector3): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

describe('surface directional marker', () => {
  it('projects a same-face subject in frame', () => {
    const camera = cameraAt(new THREE.Vector3(0, 52, 0), new THREE.Vector3(10, 52, 0));
    const marker = projectDirectionalMarker(camera, new THREE.Vector3(10, 51, 0), {
      width: 1600,
      height: 900
    });
    expect(marker.offscreen).toBe(false);
    expect(marker.surfaceOccluded).toBe(false);
    expect(marker.x).toBeGreaterThan(700);
    expect(marker.x).toBeLessThan(900);
  });

  it('honors camera world space under a transformed player parent', () => {
    const parent = new THREE.Group();
    parent.position.set(20, 52, -8);
    parent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
    parent.add(camera);
    parent.updateMatrixWorld(true);
    camera.lookAt(new THREE.Vector3(20, 52, -20));
    camera.updateMatrixWorld(true);
    const marker = projectDirectionalMarker(camera, new THREE.Vector3(20, 52, -20), {
      width: 1600,
      height: 900
    });
    expect(marker.offscreen).toBe(false);
  });

  it('keeps an adjacent-face target on an edge bearing', () => {
    const camera = cameraAt(new THREE.Vector3(0, 52, 0), new THREE.Vector3(0, 52, -10));
    const marker = projectDirectionalMarker(camera, new THREE.Vector3(52, 0, 4), {
      width: 1600,
      height: 900
    });
    expect(marker.offscreen).toBe(true);
    expect(marker.surfaceOccluded).toBe(true);
    expect(marker.x).toBeGreaterThan(800);
    expect(Number.isFinite(marker.angle)).toBe(true);
  });

  it('uses a stable lateral icon rather than pointing down for dead astern', () => {
    const camera = cameraAt(new THREE.Vector3(0, 52, 0), new THREE.Vector3(0, 52, -10));
    const marker = projectDirectionalMarker(camera, new THREE.Vector3(0, 51, 20), {
      width: 1600,
      height: 900,
      preferredSide: -1
    });
    expect(marker.offscreen).toBe(true);
    expect(marker.x).toBeLessThan(800);
    expect(marker.y).toBeCloseTo(450, 5);
  });
});
