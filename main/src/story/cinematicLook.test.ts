import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyCinematicCameraPose,
  clearCinematicCameraPose,
  getCinematicCameraPose,
  getCinematicGazeIntent,
  getCinematicLookTarget,
  setCinematicGazeIntent,
  setCinematicCameraPose,
  setCinematicLookTarget
} from './cinematicLook.ts';

afterEach(clearCinematicCameraPose);
afterEach(() => {
  setCinematicGazeIntent(null);
  setCinematicLookTarget(null);
});

describe('cinematic camera pose', () => {
  it('lands exactly on an authored world frame even under a transformed player parent', () => {
    const parent = new THREE.Group();
    parent.position.set(8, 3, -5);
    parent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7);
    const camera = new THREE.PerspectiveCamera(60);
    parent.add(camera);
    parent.updateMatrixWorld(true);

    const eye = new THREE.Vector3(14, 9, 4);
    const target = new THREE.Vector3(2, 5, -3);
    const up = new THREE.Vector3(0, 1, 0);
    setCinematicCameraPose(eye, target, up, 1);
    applyCinematicCameraPose(camera);

    expect(camera.getWorldPosition(new THREE.Vector3()).distanceTo(eye)).toBeLessThan(1e-6);
    const expectedDirection = target.clone().sub(eye).normalize();
    expect(camera.getWorldDirection(new THREE.Vector3()).dot(expectedDirection)).toBeGreaterThan(0.99999);
  });

  it('copies inputs and becomes exactly inert when cleared', () => {
    const camera = new THREE.PerspectiveCamera(60);
    camera.position.set(1, 2, 3);
    camera.rotation.set(0.1, 0.2, 0.3);
    camera.updateMatrixWorld(true);
    const beforePosition = camera.position.clone();
    const beforeQuaternion = camera.quaternion.clone();

    const eye = new THREE.Vector3(9, 8, 7);
    const target = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    setCinematicCameraPose(eye, target, up, 1);
    eye.setScalar(999);
    target.setScalar(999);
    expect(getCinematicCameraPose().eye.toArray()).toEqual([9, 8, 7]);

    clearCinematicCameraPose();
    expect(applyCinematicCameraPose(camera)).toBe(false);
    expect(camera.position.distanceTo(beforePosition)).toBe(0);
    expect(Math.abs(camera.quaternion.dot(beforeQuaternion))).toBeCloseTo(1, 8);
  });
});

describe('cinematic gaze inputs', () => {
  it('copies raw targets and semantic actor intent', () => {
    const raw = new THREE.Vector3(1, 2, 3);
    setCinematicLookTarget(raw);
    raw.setScalar(99);
    expect(getCinematicLookTarget()?.toArray()).toEqual([1, 2, 3]);

    const goal = new THREE.Vector3(8, 9, 10);
    const route = new THREE.Vector3(0, 0, -1);
    setCinematicGazeIntent({ goal, routeDirection: route, subjectLift: 2 });
    goal.setScalar(100);
    route.setScalar(100);
    expect(getCinematicGazeIntent()?.goal.toArray()).toEqual([8, 9, 10]);
    expect(getCinematicGazeIntent()?.routeDirection?.toArray()).toEqual([0, 0, -1]);
  });
});
