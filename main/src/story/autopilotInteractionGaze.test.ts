import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getPondPose, STORY_SEED } from './world/storyWorld.ts';
import { PLAYER_EYE_HEIGHT, VOXEL_SCALE } from '../utils/cubeGravityConstants.ts';
import { createSurfaceGazeResult, solveSurfaceGaze } from '../utils/surfaceGaze.ts';
import { getWorldGen } from '../utils/worldGenCache.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';

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

    const generator = getWorldGen(50, STORY_SEED, STORY_PRIMARY_WORLD_ID).generator;
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

  it('aims from the dry shore exactly at the lifted resonance target in interaction mode', () => {
    const pond = getPondPose(50, STORY_SEED);
    expect(pond).not.toBeNull();

    // Ch5 movie mode reaches this dry posture before using the same Attend
    // affordance as manual play. The gaze composes the lifted physical response.
    const eye = pond!.shore.clone().addScaledVector(pond!.up, PLAYER_EYE_HEIGHT);
    const verifiedTarget = pond!.surface.clone().addScaledVector(pond!.up, 1.35);
    const verifiedRay = verifiedTarget.clone().sub(eye).normalize();
    const result = solveSurfaceGaze({
      eye,
      viewerUp: pond!.up,
      // Deliberately disagree with both the route and subject: interaction gaze
      // must still own the final ray exactly instead of retaining travel yaw.
      currentForward: new THREE.Vector3(1, 0, 0),
      goal: pond!.surface,
      goalUp: pond!.up,
      subjectLift: 1.35,
      routeDirection: pond!.shore.clone().sub(pond!.surface),
      mode: 'interact',
      elapsed: 163.5,
      seed: 7744
    }, createSurfaceGazeResult());

    expect(result.direct).toBe(true);
    expect(result.direction.dot(verifiedRay)).toBeGreaterThan(0.999999);
    expect(result.direction.dot(verifiedRay)).toBeGreaterThan(0.94);
  });
});
