import { describe, expect, it } from 'vitest';
import {
  BOARDING_CAMERA_MIN_STANDOFF,
  BOARDING_CAMERA_HERO_EYE_LOCAL,
  BOARDING_HATCH_FRAME_PRIORITY,
  BOARDING_TRANSACTION_FRAME_PRIORITY,
  BOARDING_CAMERA_PATH_MIN_LOCAL_Y,
  BOARDING_HATCH_THROAT_FOCUS_LOCAL,
  BOARDING_HATCH_TARGET_LOCAL,
  boardingHatchLeafOccludesSegment,
  boardingHatchRotationX,
  boardingCameraPoseWeight,
  boardingCanopySafetyMetric,
  boardingVisibleCanopySafetyMetric,
  resolveBoardingCameraStandoffLocal,
  sampleBoardingCameraPathLocal,
  sampleBoardingRuntimeCameraEyeLocal
} from './hifiWreckComposition.ts';

const BOARDING_STARTS = [
  [0.5, 3.4, 0],
  [3.4, 1.35, 0],
  [-2.4, 1.4, 0],
  [0.5, 1.35, 3.2],
  [0.5, 1.35, -3.2],
  [3.05, 1.35, 2.55],
  [3.05, 1.35, -2.55],
  [-2.05, 1.35, -2.55]
] as const;

function distance(left: readonly number[], right: readonly number[]): number {
  return Math.hypot(
    left[0]! - right[0]!,
    left[1]! - right[1]!,
    left[2]! - right[2]!
  );
}

describe('hi-fi wreck boarding composition', () => {
  it.each(BOARDING_STARTS)('stops the exterior camera outside the inflated canopy from [%f, %f, %f]', (x, y, z) => {
    const start = [x, y, z] as const;
    const endpoint = resolveBoardingCameraStandoffLocal(start);
    expect(boardingCanopySafetyMetric(endpoint)).toBeGreaterThanOrEqual(1);
    expect(distance(endpoint, BOARDING_HATCH_TARGET_LOCAL))
      .toBeGreaterThanOrEqual(BOARDING_CAMERA_MIN_STANDOFF - 1e-6);
    expect(distance(endpoint, BOARDING_HATCH_TARGET_LOCAL))
      .toBeLessThan(distance(start, BOARDING_HATCH_TARGET_LOCAL));
  });

  it('does not pull an invalid embedded start through the transparent shell', () => {
    const embedded = [0.72, 0.52, 0] as const;
    expect(resolveBoardingCameraStandoffLocal(embedded)).toEqual(embedded);
  });

  it.each(BOARDING_STARTS)('keeps the complete exterior-to-hatch path above hull geometry from [%f, %f, %f]', (x, y, z) => {
    for (let index = 0; index <= 20; index++) {
      const eye = sampleBoardingCameraPathLocal([x, y, z], index / 20);
      expect(eye[1]).toBeGreaterThanOrEqual(BOARDING_CAMERA_PATH_MIN_LOCAL_Y);
      expect(boardingCanopySafetyMetric(eye)).toBeGreaterThanOrEqual(1);
    }
    expect(distance(
      sampleBoardingCameraPathLocal([x, y, z], 1),
      BOARDING_CAMERA_HERO_EYE_LOCAL
    )).toBeLessThan(1e-9);
  });

  it('raises the dorsal hatch around its physical X-axis hinge', () => {
    expect(boardingHatchRotationX(0)).toBe(-0);
    expect(boardingHatchRotationX(0.5)).toBeLessThan(0);
    expect(boardingHatchRotationX(1)).toBeCloseTo(-1.18);
  });

  it('samples the hatch before the normal-priority transaction advances', () => {
    expect(BOARDING_HATCH_FRAME_PRIORITY).toBeLessThan(0);
    expect(BOARDING_TRANSACTION_FRAME_PRIORITY).toBe(0);
    expect(BOARDING_HATCH_FRAME_PRIORITY).toBeLessThan(BOARDING_TRANSACTION_FRAME_PRIORITY);
  });

  it('hands camera ownership over smoothly before the late hatch interval', () => {
    expect(boardingCameraPoseWeight(0)).toBe(0);
    expect(boardingCameraPoseWeight(0.2)).toBeGreaterThan(0);
    expect(boardingCameraPoseWeight(0.61)).toBeLessThan(1);
    expect(boardingCameraPoseWeight(0.62)).toBe(1);
    expect(boardingCameraPoseWeight(0.78)).toBe(1);
  });

  it.each(BOARDING_STARTS)('keeps the authored and runtime sightlines outside the visible canopy from [%f, %f, %f]', (x, y, z) => {
    for (let progressIndex = 0; progressIndex <= 20; progressIndex++) {
      const progress = progressIndex / 20;
      const eye = sampleBoardingCameraPathLocal([x, y, z], progress);
      const runtimeEye = sampleBoardingRuntimeCameraEyeLocal(
        [x, y, z],
        [x, y - 0.2, z],
        progress
      );
      for (const sightlineEye of [eye, runtimeEye]) {
        for (let rayIndex = 0; rayIndex <= 20; rayIndex++) {
          const rayProgress = rayIndex / 20;
          const point = sightlineEye.map((coordinate, axis) => coordinate + (
            BOARDING_HATCH_THROAT_FOCUS_LOCAL[axis]! - coordinate
          ) * rayProgress) as [number, number, number];
          expect(boardingVisibleCanopySafetyMetric(point)).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it.each(BOARDING_STARTS)('keeps the opened hatch leaf out of the hero sightline from [%f, %f, %f]', (x, y, z) => {
    // A closed/opening leaf is naturally the subject at first. Once the shot
    // has materially opened, neither the panel nor its safety margin may cross
    // between the camera and the throat.
    for (let progressIndex = 13; progressIndex <= 20; progressIndex++) {
      const progress = progressIndex / 20;
      const eye = sampleBoardingCameraPathLocal([x, y, z], progress);
      expect(boardingHatchLeafOccludesSegment(
        eye,
        BOARDING_HATCH_THROAT_FOCUS_LOCAL,
        progress,
        0.025
      )).toBe(false);

      // CameraControls rebuilds the live gravity eye every frame, 0.2wu below
      // the authored player-eye offset, then applies one non-cumulative blend.
      const blendedEye = sampleBoardingRuntimeCameraEyeLocal(
        [x, y, z],
        [x, y - 0.2, z],
        progress
      );
      expect(boardingHatchLeafOccludesSegment(
        blendedEye,
        BOARDING_HATCH_THROAT_FOCUS_LOCAL,
        progress,
        0.025
      )).toBe(false);
    }
  });
});
