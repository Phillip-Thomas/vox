import { describe, expect, it } from 'vitest';
import {
  createWorldArrivalPose,
  findTopFaceSurfaceVoxel
} from './worldArrival';

describe('world arrival poses', () => {
  it('chooses the same surface voxel for the same world seed', () => {
    expect(findTopFaceSurfaceVoxel(50, 12345)).toEqual(findTopFaceSurfaceVoxel(50, 12345));
  });

  it('creates the approach and parked ship along the flat top-face normal', () => {
    const pose = createWorldArrivalPose(50, 12345);
    const surf = pose.playerSurfacePosition;
    const appr = pose.approachPosition;
    const approachDelta = appr.clone().sub(surf);
    expect(approachDelta.x).toBeCloseTo(0);
    expect(approachDelta.y).toBeCloseTo(30);
    expect(approachDelta.z).toBeCloseTo(0);

    const surfaceCenterY = pose.surfaceVoxel.y * 2;
    expect(pose.playerSurfacePosition.x).toBe(pose.shipPosition.x);
    expect(pose.playerSurfacePosition.z).toBe(pose.shipPosition.z);
    expect(pose.playerSurfacePosition.y).toBeGreaterThan(surfaceCenterY);
    expect(pose.shipPosition.y).toBeGreaterThan(surfaceCenterY);
  });

  it('keeps the parked ship below the player surface spawn', () => {
    const pose = createWorldArrivalPose(50, 12345);
    expect(pose.shipPosition.y).toBeLessThan(pose.playerSurfacePosition.y);
    expect(pose.shipPosition.y).toBeGreaterThan(pose.surfaceVoxel.y * 2);
  });
});
