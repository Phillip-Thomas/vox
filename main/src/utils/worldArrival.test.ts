import { describe, expect, it } from 'vitest';
import {
  createWorldArrivalPose,
  findTopFaceSurfaceVoxel
} from './worldArrival';

describe('world arrival poses', () => {
  it('chooses the same surface voxel for the same world seed', () => {
    expect(findTopFaceSurfaceVoxel(50, 12345)).toEqual(findTopFaceSurfaceVoxel(50, 12345));
  });

  it('creates an approach position above the surface spawn', () => {
    const pose = createWorldArrivalPose(50, 12345);
    expect(pose.approachPosition.x).toBe(pose.playerSurfacePosition.x);
    expect(pose.approachPosition.z).toBe(pose.playerSurfacePosition.z);
    expect(pose.approachPosition.y).toBeGreaterThan(pose.playerSurfacePosition.y + 20);
  });

  it('keeps the parked ship below the player surface spawn', () => {
    const pose = createWorldArrivalPose(50, 12345);
    expect(pose.shipPosition.y).toBeLessThan(pose.playerSurfacePosition.y);
    expect(pose.shipPosition.y).toBeGreaterThan(pose.surfaceVoxel.y * 2);
  });
});
