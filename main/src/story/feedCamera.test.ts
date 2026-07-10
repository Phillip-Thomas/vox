import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createFeedLookState,
  FEED_PITCH,
  FEED_PITCH_MAX,
  FEED_PITCH_MIN,
  FEED_SNAP_THRESHOLD,
  feedAccumulateLook
} from './feedCamera.ts';
import { clampCameraPitch } from '../utils/gravityCamera.ts';

const SENS = 0.002; // mirrors the module's FEED_MOUSE_SENSITIVITY

function setup() {
  return {
    state: createFeedLookState(),
    forward: new THREE.Vector3(0, 0, -1),
    up: new THREE.Vector3(0, 1, 0),
    pitch: { current: FEED_PITCH }
  };
}

describe('feedCamera', () => {
  it('small mouse travel below the threshold does not move the heading (blend 0)', () => {
    const { state, forward, up, pitch } = setup();
    const before = forward.clone();
    feedAccumulateLook(state, (FEED_SNAP_THRESHOLD / SENS) * 0.6, 40, forward, up, pitch, 0);
    expect(forward.angleTo(before)).toBeLessThan(1e-6);
    // pitch tilts (the CCTV servo) but stays inside the band
    expect(pitch.current).toBeLessThan(FEED_PITCH);
    expect(pitch.current).toBeGreaterThanOrEqual(FEED_PITCH_MIN);
  });

  it('crossing the threshold snaps the heading by exactly 90°', () => {
    const { state, forward, up, pitch } = setup();
    const before = forward.clone();
    feedAccumulateLook(state, (FEED_SNAP_THRESHOLD / SENS) * 1.05, 0, forward, up, pitch, 0);
    expect(forward.angleTo(before)).toBeCloseTo(Math.PI / 2, 5);
    // hysteresis: the accumulator reset — the same travel again snaps again, once
    const after = forward.clone();
    feedAccumulateLook(state, (FEED_SNAP_THRESHOLD / SENS) * 1.05, 0, forward, up, pitch, 0);
    expect(forward.angleTo(after)).toBeCloseTo(Math.PI / 2, 5);
  });

  it('four snaps return to the original compass heading', () => {
    const { state, forward, up, pitch } = setup();
    const start = forward.clone();
    for (let i = 0; i < 4; i++) {
      feedAccumulateLook(state, (FEED_SNAP_THRESHOLD / SENS) * 1.05, 0, forward, up, pitch, 0);
    }
    expect(forward.angleTo(start)).toBeLessThan(1e-4);
  });

  it('pitch clamps to the CCTV tilt band at blend 0 and the free clamp at blend 1', () => {
    const { state, forward, up, pitch } = setup();
    // hard look up: capped at the band's ceiling (a tilt motor, not a neck)
    feedAccumulateLook(state, 0, -100000, forward, up, pitch, 0);
    expect(pitch.current).toBeCloseTo(FEED_PITCH_MAX, 5);
    // hard look down: reaches the harvest-at-your-feet floor
    feedAccumulateLook(state, 0, 100000, forward, up, pitch, 0);
    expect(pitch.current).toBeCloseTo(FEED_PITCH_MIN, 5);
    feedAccumulateLook(state, 0, -100000, forward, up, pitch, 1);
    expect(pitch.current).toBeCloseTo(clampCameraPitch(Math.PI), 5);
  });

  it('at blend 1 yaw is continuous (no snapping) and matches free-look math', () => {
    const { state, forward, up, pitch } = setup();
    const before = forward.clone();
    const dxPixels = 100;
    feedAccumulateLook(state, dxPixels, 0, forward, up, pitch, 1);
    expect(forward.angleTo(before)).toBeCloseTo(dxPixels * SENS, 5);
    expect(state.yawAccum).toBe(0 + 0); // snap accumulator untouched at blend 1
  });

  it('mid-blend blends both components without double-counting', () => {
    const { state, forward, up, pitch } = setup();
    const before = forward.clone();
    const travel = (FEED_SNAP_THRESHOLD / SENS) * 0.5;
    feedAccumulateLook(state, travel, 0, forward, up, pitch, 0.5);
    // continuous part rotated by half the free amount; snap part accumulated half
    expect(forward.angleTo(before)).toBeCloseTo(travel * SENS * 0.5, 5);
    expect(Math.abs(state.yawAccum)).toBeCloseTo(FEED_SNAP_THRESHOLD * 0.25, 5);
  });
});
