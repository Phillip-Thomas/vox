import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getPondPose, STORY_SEED } from './world/storyWorld.ts';
import { PLAYER_EYE_HEIGHT, VOXEL_SCALE } from '../utils/cubeGravityConstants.ts';
import { createSurfaceGazeResult, solveSurfaceGaze } from '../utils/surfaceGaze.ts';
import { getWorldGen } from '../utils/worldGenCache.ts';

describe('movie interaction gaze', () => {
  it('puts the dry-shore camera ray through the authored pond water cell', () => {
    const pond = getPondPose(50, STORY_SEED);
    expect(pond).not.toBeNull();
    const eye = pond!.shore.clone().addScaledVector(pond!.up, PLAYER_EYE_HEIGHT);
    const result = solveSurfaceGaze({
      eye,
      viewerUp: pond!.up,
      currentForward: new THREE.Vector3(1, 0, 0),
      goal: pond!.surface,
      goalUp: pond!.up,
      routeDirection: pond!.shore.clone().sub(pond!.surface),
      mode: 'interact',
      elapsed: 40,
      seed: 7744
    }, createSurfaceGazeResult());
    const range = eye.distanceTo(pond!.surface);
    expect(range).toBeLessThanOrEqual(8);
    expect(result.direction.dot(pond!.surface.clone().sub(eye).normalize())).toBeGreaterThan(0.999999);

    const generator = getWorldGen(50, STORY_SEED).generator;
    let waterHit = false;
    for (let t = 0.5; t <= 8; t += 0.45) {
      const sample = eye.clone().addScaledVector(result.direction, t);
      if (generator.isWaterVoxel(
        Math.round(sample.x / VOXEL_SCALE),
        Math.round(sample.y / VOXEL_SCALE),
        Math.round(sample.z / VOXEL_SCALE)
      )) {
        waterHit = true;
        break;
      }
    }
    expect(waterHit).toBe(true);
  });
});
