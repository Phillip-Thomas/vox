import { describe, expect, it } from 'vitest';
import {
  createWorldArrivalPose,
  findTopFaceSurfaceVoxel
} from './worldArrival';
import { getWorldGen } from './worldGenCache.ts';
import {
  isDryClearResumePosition,
  isValidatedSpawnPosition,
  resolveShipPlayerEgressPosition
} from './spawnValidation.ts';

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

  it('gives both actors a dry, flat, clear canonical spawn across terrain presets', () => {
    for (const seed of [12345, 54321, 98765, 13579, 24680]) {
      const pose = createWorldArrivalPose(50, seed);
      const terrain = getWorldGen(50, seed).generator;
      expect(
        isValidatedSpawnPosition(terrain, 50, pose.playerSurfacePosition, 'player'),
        `${seed}:player:${JSON.stringify(pose.playerSurfacePosition.toArray())}:${JSON.stringify(pose.surfaceVoxel)}`
      ).toBe(true);
      expect(
        isValidatedSpawnPosition(terrain, 50, pose.shipPosition, 'ship'),
        `${seed}:ship:${JSON.stringify(pose.shipPosition.toArray())}:${JSON.stringify(pose.surfaceVoxel)}`
      ).toBe(true);
      const egress = resolveShipPlayerEgressPosition(terrain, 50, pose.shipPosition, 'top');
      expect(egress, `${seed}:egress`).not.toBeNull();
      const settledEgress = egress!.clone();
      settledEgress.y -= 1;
      expect(
        isDryClearResumePosition(terrain, 50, settledEgress),
        `${seed}:settled-egress`
      ).toBe(true);
    }
  }, 20_000);
});
