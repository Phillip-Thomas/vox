import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DUSK_CINEMATIC,
  computeDuskFireCameraFrame,
  computeDuskGazeTarget,
  duskCinematicStateAt
} from './duskCinematography.ts';
import { SANDBOX_FOV } from './storyInputPolicy.ts';

describe('first-fire dusk cinematography', () => {
  it('observes the fire before handing gaze to the sun, then releases cleanly', () => {
    const fire = duskCinematicStateAt(2, true);
    expect(fire.fireCamera).toBeGreaterThan(0.99);
    expect(fire.fireToSun).toBe(0);
    expect(fire.look).toBeGreaterThan(0.99);
    expect(fire.movement).toBe(0);
    expect(fire.fov).toBeCloseTo(DUSK_CINEMATIC.fireFov, 5);

    const handoff = duskCinematicStateAt(4.4, true);
    expect(handoff.fireCamera).toBeGreaterThan(0);
    expect(handoff.fireCamera).toBeLessThan(1);
    expect(handoff.fireToSun).toBeGreaterThan(0);
    expect(handoff.fireToSun).toBeLessThan(1);
    expect(handoff.look).toBeGreaterThan(0.99);

    const sun = duskCinematicStateAt(DUSK_CINEMATIC.sunTransitionEnd, true);
    expect(sun.fireCamera).toBe(0);
    expect(sun.fireToSun).toBe(1);
    expect(sun.look).toBeGreaterThan(0.99);

    const released = duskCinematicStateAt(DUSK_CINEMATIC.endSeconds, true);
    expect(released.letterbox).toBe(0);
    expect(released.look).toBe(0);
    expect(released.movement).toBe(1);
    expect(released.fov).toBe(SANDBOX_FOV);
  });

  it('keeps the portrait above an arbitrary cube face and aimed at the flame', () => {
    const fire = new THREE.Vector3(51, 8, -3);
    const up = new THREE.Vector3(1, 0, 0);
    const player = new THREE.Vector3(52.1, 8, -3); // directly above the fire
    const forward = new THREE.Vector3(0, 0, -1);
    const eye = new THREE.Vector3();
    const target = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();

    computeDuskFireCameraFrame(fire, up, player, forward, 0.12, eye, target, cameraUp);

    expect(target.clone().sub(fire).dot(up)).toBeCloseTo(0.65, 6);
    expect(eye.clone().sub(fire).dot(up)).toBeGreaterThan(1.9);
    expect(eye.clone().sub(target).projectOnPlane(up).length()).toBeGreaterThan(4);
    expect(cameraUp.dot(up)).toBeCloseTo(1, 6);
  });

  it('moves the gaze direction continuously from the flame to the sun', () => {
    const eye = new THREE.Vector3(0, 2, 0);
    const fire = new THREE.Vector3(0, 0.65, -1);
    const sun = new THREE.Vector3(1, 0.1, 0).normalize();
    const target = new THREE.Vector3();
    const fireDirection = fire.clone().sub(eye).normalize();

    computeDuskGazeTarget(eye, fire, sun, 0, target);
    expect(target.clone().sub(eye).normalize().dot(fireDirection)).toBeGreaterThan(0.99999);
    computeDuskGazeTarget(eye, fire, sun, 0.5, target);
    const middle = target.clone().sub(eye).normalize();
    expect(middle.dot(fireDirection)).toBeGreaterThan(0);
    expect(middle.dot(sun)).toBeGreaterThan(0);
    computeDuskGazeTarget(eye, fire, sun, 1, target);
    expect(target.clone().sub(eye).normalize().dot(sun)).toBeGreaterThan(0.99999);
  });

  it('takes a stable arc when fire and noon sun are opposite directions', () => {
    const eye = new THREE.Vector3(0, 2, 0);
    const fire = new THREE.Vector3(0, 1, 0);
    const sun = new THREE.Vector3(0, 1, 0);
    const before = computeDuskGazeTarget(eye, fire, sun, 0.49, new THREE.Vector3())
      .sub(eye).normalize();
    const middle = computeDuskGazeTarget(eye, fire, sun, 0.5, new THREE.Vector3())
      .sub(eye).normalize();
    const after = computeDuskGazeTarget(eye, fire, sun, 0.51, new THREE.Vector3())
      .sub(eye).normalize();

    expect(before.length()).toBeCloseTo(1, 6);
    expect(middle.length()).toBeCloseTo(1, 6);
    expect(after.length()).toBeCloseTo(1, 6);
    expect(before.dot(middle)).toBeGreaterThan(0.999);
    expect(middle.dot(after)).toBeGreaterThan(0.999);
  });

  it('falls back to the original sun shot if dusk begins without a fire', () => {
    const state = duskCinematicStateAt(2, false);
    expect(state.fireCamera).toBe(0);
    expect(state.fireToSun).toBe(1);
    expect(state.look).toBeGreaterThan(0.99);
  });
});
