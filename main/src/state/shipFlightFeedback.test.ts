import { beforeEach, describe, expect, it } from 'vitest';
import {
  SHIP_BASE_FOV,
  SHIP_BOOST_FOV,
  SHIP_REDUCED_MOTION_FOV,
  getShipFlightFeedback,
  resetShipFlightFeedback,
  resolveShipBoost,
  updateShipFlightFeedback
} from './shipFlightFeedback.ts';

const boostFrame = {
  active: true,
  phase: 'deep_space' as const,
  throttle: 1,
  boost: true,
  speed: 240,
  maxSpeed: 320,
  acceleration: 1,
  forwardSpeed: 240
};

describe('shipFlightFeedback', () => {
  beforeEach(resetShipFlightFeedback);

  it('uses Shift on desktop and preserves the Space-backed touch thruster', () => {
    expect(resolveShipBoost(true, false, false, true)).toBe(true);
    expect(resolveShipBoost(false, true, false, true)).toBe(false);
    expect(resolveShipBoost(false, true, true, true)).toBe(true);
    expect(resolveShipBoost(true, false, false, false)).toBe(false);
  });

  it('attacks quickly, releases smoothly and remains bounded', () => {
    for (let i = 0; i < 30; i++) updateShipFlightFeedback(boostFrame, 1 / 60);
    const engaged = { ...getShipFlightFeedback() };
    expect(engaged.boost).toBeGreaterThan(0.95);
    expect(engaged.fov).toBeGreaterThan(78);
    expect(engaged.fov).toBeLessThanOrEqual(SHIP_BOOST_FOV);
    expect(engaged.motion).toBeGreaterThan(0.8);

    for (let i = 0; i < 75; i++) {
      updateShipFlightFeedback({
        ...boostFrame,
        boost: false,
        throttle: 0,
        speed: 0,
        forwardSpeed: 0,
        acceleration: 0
      }, 1 / 60);
    }
    expect(Math.abs(getShipFlightFeedback().fov - SHIP_BASE_FOV)).toBeLessThan(0.12);
    expect(getShipFlightFeedback().motion).toBeLessThan(0.05);
  });

  it('caps feedback and disables screen motion for reduced-motion players', () => {
    for (let i = 0; i < 60; i++) {
      updateShipFlightFeedback({ ...boostFrame, reducedMotion: true }, 1 / 60);
    }
    expect(getShipFlightFeedback().fov).toBeLessThanOrEqual(SHIP_REDUCED_MOTION_FOV);
    expect(getShipFlightFeedback().motion).toBe(0);
  });
});
