import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  easedGroundedTravelProgress,
  groundedSurfaceRouteLength,
  sampleGroundedSurfaceRoute,
  turnGroundedHeadingToward
} from './groundedSurfaceMotion.ts';

const UP = new THREE.Vector3(0, 1, 0);
const point = (x: number, y: number, z: number) => ({ position: new THREE.Vector3(x, y, z) });

describe('grounded surface motion', () => {
  it('travels at face distance and rounds cardinal route corners spatially', () => {
    const route = [point(0, 1.05, 0), point(4, 1.05, 0), point(4, 1.05, 4)];
    expect(groundedSurfaceRouteLength(route, UP)).toBe(8);

    const before = sampleGroundedSurfaceRoute(route, 2.5, UP);
    const corner = sampleGroundedSurfaceRoute(route, 4, UP);
    const after = sampleGroundedSurfaceRoute(route, 5.5, UP);
    expect(before.position.toArray()).toEqual([2.5, 1.05, 0]);
    expect(corner.position.toArray()).toEqual([4, 1.05, 0]);
    expect(after.position.toArray()).toEqual([4, 1.05, 1.5]);
    expect(before.heading.x).toBeGreaterThan(before.heading.z);
    expect(corner.heading.x).toBeCloseTo(corner.heading.z, 5);
    expect(after.heading.z).toBeGreaterThan(after.heading.x);
    expect(Math.abs(corner.heading.dot(UP))).toBeLessThan(1e-6);
  });

  it('contains a one-voxel height correction to its adjacent step leg', () => {
    const route = [
      point(0, 1.05, 0),
      point(2, 1.05, 0),
      point(4, 3.05, 0),
      point(6, 3.05, 0)
    ];

    expect(sampleGroundedSurfaceRoute(route, 1.9, UP).position.y).toBeCloseTo(1.05, 6);
    expect(sampleGroundedSurfaceRoute(route, 2.1, UP).position.y).toBeCloseTo(1.05, 6);
    expect(sampleGroundedSurfaceRoute(route, 2.6, UP).position.y).toBeGreaterThan(1.05);
    // At the support-cell boundary an ascent has fully cleared the high voxel.
    expect(sampleGroundedSurfaceRoute(route, 3, UP).position.y).toBeCloseTo(3.05, 6);
    expect(sampleGroundedSurfaceRoute(route, 3.9, UP).position.y).toBeCloseTo(3.05, 6);
    expect(sampleGroundedSurfaceRoute(route, 4.1, UP).position.y).toBeCloseTo(3.05, 6);

    const descent = [point(0, 3.05, 0), point(2, 1.05, 0)];
    // A descent holds the high support until its centre clears the ledge.
    expect(sampleGroundedSurfaceRoute(descent, 0.99, UP).position.y).toBeCloseTo(3.05, 6);
    expect(sampleGroundedSurfaceRoute(descent, 1, UP).position.y).toBeCloseTo(3.05, 6);
    expect(sampleGroundedSurfaceRoute(descent, 1.5, UP).position.y).toBeLessThan(3.05);
  });

  it('eases only the short departure and arrival while preserving a linear middle', () => {
    expect(easedGroundedTravelProgress(0)).toBe(0);
    expect(easedGroundedTravelProgress(1)).toBe(1);
    expect(easedGroundedTravelProgress(0.01)).toBeLessThan(0.01);
    expect(easedGroundedTravelProgress(0.99)).toBeGreaterThan(0.99);
    const firstMiddleStep = easedGroundedTravelProgress(0.5) - easedGroundedTravelProgress(0.4);
    const secondMiddleStep = easedGroundedTravelProgress(0.6) - easedGroundedTravelProgress(0.5);
    expect(firstMiddleStep).toBeCloseTo(secondMiddleStep, 8);
  });

  it('rate-limits turning and keeps the heading tangent to the surface', () => {
    const heading = new THREE.Vector3(1, 0, 0);
    turnGroundedHeadingToward(heading, new THREE.Vector3(0, 0, 1), UP, Math.PI / 6);
    expect(heading.angleTo(new THREE.Vector3(1, 0, 0))).toBeCloseTo(Math.PI / 6, 6);
    expect(heading.dot(UP)).toBeCloseTo(0, 8);
    turnGroundedHeadingToward(heading, new THREE.Vector3(0, 0, 1), UP, Math.PI);
    expect(heading.toArray()).toEqual([0, 0, 1]);
  });
});
