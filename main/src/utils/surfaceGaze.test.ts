import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FACE_NORMALS } from './surfaceControls.ts';
import { createSurfaceGazeResult, solveSurfaceGaze } from './surfaceGaze.ts';

const FACE_POINTS = {
  top: new THREE.Vector3(0, 52, 0),
  bottom: new THREE.Vector3(0, -52, 0),
  right: new THREE.Vector3(52, 0, 0),
  left: new THREE.Vector3(-52, 0, 0),
  front: new THREE.Vector3(0, 0, 52),
  back: new THREE.Vector3(0, 0, -52)
} as const;

describe('surface-aware agent gaze', () => {
  it.each([
    ['top', 'right'], ['top', 'front'], ['bottom', 'left'],
    ['right', 'front'], ['left', 'back'], ['front', 'top']
  ] as const)('keeps an adjacent-face goal near the %s horizon (%s target)', (viewer, goal) => {
    const eye = FACE_POINTS[viewer].clone().addScaledVector(FACE_NORMALS[viewer], 1.35);
    const result = solveSurfaceGaze({
      eye,
      viewerUp: FACE_NORMALS[viewer],
      currentForward: new THREE.Vector3(0, 0, -1),
      goal: FACE_POINTS[goal],
      goalUp: FACE_NORMALS[goal],
      subjectLift: 2,
      mode: 'travel',
      elapsed: 4,
      seed: 17
    });
    expect(result.surfaceOccluded).toBe(true);
    expect(result.direct).toBe(false);
    expect(result.direction.length()).toBeCloseTo(1, 6);
    expect(result.pitch).toBeGreaterThanOrEqual(THREE.MathUtils.degToRad(-8) - 1e-6);
    expect(Math.abs(result.tangentForward.dot(FACE_NORMALS[viewer]))).toBeLessThan(1e-6);
  });

  it.each([
    ['top', 'bottom'], ['right', 'left'], ['front', 'back']
  ] as const)('produces a finite deterministic bearing for opposite faces %s/%s', (viewer, goal) => {
    const input = {
      eye: FACE_POINTS[viewer].clone(),
      viewerUp: FACE_NORMALS[viewer],
      currentForward: new THREE.Vector3(0.3, 0.1, -0.8),
      goal: FACE_POINTS[goal],
      elapsed: 7.25,
      seed: 91
    };
    const a = solveSurfaceGaze(input, createSurfaceGazeResult());
    const b = solveSurfaceGaze(input, createSurfaceGazeResult());
    expect(a.direction.toArray()).toEqual(b.direction.toArray());
    expect(a.direction.length()).toBeCloseTo(1, 6);
    expect(Number.isFinite(a.pitch)).toBe(true);
  });

  it('lifts a nearby subject along the subject face normal', () => {
    const result = solveSurfaceGaze({
      eye: new THREE.Vector3(0, 52, 0),
      viewerUp: FACE_NORMALS.top,
      currentForward: new THREE.Vector3(1, 0, 0),
      goal: new THREE.Vector3(8, 50, 0),
      goalUp: FACE_NORMALS.top,
      subjectLift: 5,
      mode: 'inspect',
      elapsed: 0,
      seed: 1
    });
    expect(result.direct).toBe(true);
    expect(result.pitch).toBeGreaterThan(0);
    expect(result.pitch).toBeLessThanOrEqual(THREE.MathUtils.degToRad(30));
  });

  it('uses the route segment instead of the final-goal chord while travelling', () => {
    const result = solveSurfaceGaze({
      eye: new THREE.Vector3(0, 52, 0),
      viewerUp: FACE_NORMALS.top,
      currentForward: new THREE.Vector3(1, 0, 0),
      goal: new THREE.Vector3(20, 50, 0),
      routeDirection: new THREE.Vector3(0, 0, -1),
      mode: 'travel',
      elapsed: 0,
      seed: 3
    });
    expect(result.tangentForward.z).toBeLessThan(-0.99);
    expect(Math.abs(result.tangentForward.x)).toBeLessThan(0.08);
  });

  it('is elapsed-time deterministic rather than frame-step dependent', () => {
    const input = {
      eye: new THREE.Vector3(0, 52, 0),
      viewerUp: FACE_NORMALS.top,
      currentForward: new THREE.Vector3(0, 0, -1),
      goal: new THREE.Vector3(40, 50, 10),
      mode: 'ambient' as const,
      elapsed: 12.5,
      seed: 55
    };
    const a = solveSurfaceGaze(input);
    solveSurfaceGaze({ ...input, elapsed: 8.1 });
    const b = solveSurfaceGaze(input);
    expect(a.direction.distanceTo(b.direction)).toBeLessThan(1e-12);
  });
});
