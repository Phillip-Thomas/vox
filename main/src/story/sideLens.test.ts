import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyLiftCameraTransform,
  applySideCameraTransform,
  sideHarvestProbePoints,
  type SideLens
} from './sideLens.ts';
import { applyGravityCameraTransform } from '../utils/gravityCamera.ts';

function makeLens(): SideLens {
  const up = new THREE.Vector3(0, 1, 0);
  const travelAxis = new THREE.Vector3(1, 0, 0);
  return {
    origin: new THREE.Vector3(0, 50, 0),
    travelAxis,
    depthAxis: travelAxis.clone().cross(up).normalize(), // (0,0,-1)
    up
  };
}

describe('sideLens', () => {
  it('side camera looks at the player from +depth with the lens up', () => {
    const lens = makeLens();
    const camera = new THREE.PerspectiveCamera(50);
    // no parent: world-space branch
    camera.position.copy(lens.origin).addScaledVector(lens.depthAxis, 16).addScaledVector(lens.up, 3);
    applySideCameraTransform(camera, lens);
    const lookDir = camera.getWorldDirection(new THREE.Vector3());
    // looking back along -depth (toward the player)
    expect(lookDir.dot(lens.depthAxis)).toBeLessThan(-0.9);
  });

  it('handedness: +travelAxis projects to screen-RIGHT (so D moves right)', () => {
    const lens = makeLens();
    const camera = new THREE.PerspectiveCamera(50);
    camera.position.copy(lens.origin).addScaledVector(lens.depthAxis, 16).addScaledVector(lens.up, 3);
    applySideCameraTransform(camera, lens);
    camera.updateMatrixWorld(true);
    // A point ahead of the player along +travel should land at +x in view space.
    const ahead = lens.origin.clone().addScaledVector(lens.travelAxis, 5);
    const inView = camera.worldToLocal(ahead.clone());
    expect(inView.x).toBeGreaterThan(0.5);
  });

  it('parented camera matches the unparented world transform', () => {
    const lens = makeLens();
    const parent = new THREE.Group();
    parent.position.copy(lens.origin);
    parent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7); // body yaw must not matter
    const camera = new THREE.PerspectiveCamera(50);
    parent.add(camera);
    parent.updateMatrixWorld(true);
    applySideCameraTransform(camera, lens);
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const expected = lens.origin.clone().addScaledVector(lens.depthAxis, 16).addScaledVector(lens.up, 3);
    expect(eye.distanceTo(expected)).toBeLessThan(1e-4);
    const lookDir = camera.getWorldDirection(new THREE.Vector3());
    expect(lookDir.dot(lens.depthAxis)).toBeLessThan(-0.9);
  });

  it('lift blend endpoints match the pure side and first-person transforms', () => {
    // Parented cameras, as in-game (both pure transforms write LOCAL position
    // only when a parent exists).
    const lens = makeLens();
    const up = new THREE.Vector3(0, 1, 0);
    const forward = new THREE.Vector3(1, 0, 0);
    const pitch = -0.1;
    const eyeHeight = 1.0;
    const rig = (cam: THREE.PerspectiveCamera) => {
      const parent = new THREE.Group();
      parent.position.copy(lens.origin);
      parent.add(cam);
      parent.updateMatrixWorld(true);
    };
    const reference = new THREE.PerspectiveCamera(50);
    const camera = new THREE.PerspectiveCamera(50);
    rig(reference);
    rig(camera);

    // blend 0 == the side transform
    applySideCameraTransform(reference, lens);
    applyLiftCameraTransform(camera, lens, up, forward.clone(), pitch, eyeHeight, 0);
    expect(camera.position.distanceTo(reference.position)).toBeLessThan(1e-6);
    expect(Math.abs(camera.quaternion.dot(reference.quaternion))).toBeCloseTo(1, 5);

    // blend 1 == the first-person gravity transform
    applyGravityCameraTransform(reference, up, forward.clone(), pitch, eyeHeight);
    applyLiftCameraTransform(camera, lens, up, forward.clone(), pitch, eyeHeight, 1);
    expect(camera.position.distanceTo(reference.position)).toBeLessThan(1e-6);
    expect(Math.abs(camera.quaternion.dot(reference.quaternion))).toBeCloseTo(1, 5);

    // mid-blend travels away from the side vantage toward the eyes
    applySideCameraTransform(reference, lens);
    const sideEye = reference.position.clone();
    applyLiftCameraTransform(camera, lens, up, forward.clone(), pitch, eyeHeight, 0.5);
    expect(camera.position.distanceTo(sideEye)).toBeGreaterThan(1);
  });

  it('harvest probes lead with the facing side and include underfoot', () => {
    const lens = makeLens();
    const position = new THREE.Vector3(10, 52, 0);
    const out = Array.from({ length: 5 }, () => new THREE.Vector3());
    sideHarvestProbePoints(position, lens, 1, out);
    expect(out[0].x).toBeGreaterThan(position.x); // ahead of +facing
    sideHarvestProbePoints(position, lens, -1, out);
    expect(out[0].x).toBeLessThan(position.x); // flips with facing
    expect(out[2].y).toBeLessThan(position.y); // underfoot probe
  });
});
