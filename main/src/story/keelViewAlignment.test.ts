import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyGravityCameraTransform } from '../utils/gravityCamera.ts';
import { createKeelViewScratch, resolveKeelViewAlignment } from './keelViewAlignment.ts';

const UP = new THREE.Vector3(0, 1, 0);
const BODY = new THREE.Vector3(6, 45, -12);
const TARGET = new THREE.Vector3(6, 40, -15);
const SURFACE_FORWARD = new THREE.Vector3(0, 0, -1);
const PITCH = Math.asin(TARGET.clone().sub(BODY.clone().addScaledVector(UP, 1)).normalize().dot(UP));

describe('Keel view alignment', () => {
  it('uses a mounted camera world position rather than its local eye offset', () => {
    const parent = new THREE.Group();
    parent.position.copy(BODY);
    const camera = new THREE.PerspectiveCamera();
    parent.add(camera);
    applyGravityCameraTransform(camera, UP, SURFACE_FORWARD, PITCH, 1);

    const alignment = resolveKeelViewAlignment(camera, TARGET, {
      playerPosition: BODY,
      playerUp: UP,
      surfaceForward: SURFACE_FORWARD,
      pitch: PITCH,
      eyeHeight: 1
    }, createKeelViewScratch());

    expect(camera.position.toArray()).toEqual([0, 1, 0]);
    expect(alignment).toBeGreaterThan(0.999999);
  });

  it('reconstructs the same world ray when movie mode has no camera object', () => {
    const fallback = resolveKeelViewAlignment(null, TARGET, {
      playerPosition: BODY,
      playerUp: UP,
      surfaceForward: SURFACE_FORWARD,
      pitch: PITCH,
      eyeHeight: 1
    }, createKeelViewScratch());

    expect(fallback).toBeGreaterThan(0.999999);
  });
});
