import { describe, expect, it } from 'vitest';
import {
  createWorldArrivalPose,
  findTopFaceSurfaceVoxel
} from './worldArrival';

describe('world arrival poses', () => {
  it('chooses the same surface voxel for the same world seed', () => {
    expect(findTopFaceSurfaceVoxel(50, 12345)).toEqual(findTopFaceSurfaceVoxel(50, 12345));
  });

  it('creates an approach position above the surface spawn, along the outward normal', () => {
    const pose = createWorldArrivalPose(50, 12345);
    const surf = pose.playerSurfacePosition;
    const appr = pose.approachPosition;
    // Higher altitude (farther from the planet centre).
    expect(appr.length()).toBeGreaterThan(surf.length() + 20);
    // Displaced straight out along the surface's outward radial (not hardcoded +Y).
    const radial = surf.clone().normalize();
    const delta = appr.clone().sub(surf).normalize();
    expect(delta.dot(radial)).toBeGreaterThan(0.99);
  });

  it('keeps the parked ship below the player surface spawn', () => {
    const pose = createWorldArrivalPose(50, 12345);
    expect(pose.shipPosition.y).toBeLessThan(pose.playerSurfacePosition.y);
    expect(pose.shipPosition.y).toBeGreaterThan(pose.surfaceVoxel.y * 2);
  });
});
