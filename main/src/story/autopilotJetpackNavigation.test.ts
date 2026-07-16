import { describe, expect, it } from 'vitest';
import {
  PLANNED_JETPACK_RELEASE_SECONDS,
  PLANNED_JETPACK_STALL_SECONDS,
  plannedJetpackJumpDecision
} from './autopilotJetpackNavigation.ts';
import {
  JETPACK_MAX_FUEL,
  JETPACK_REFILL_RATE,
  updateJumpState
} from '../utils/surfaceControls.ts';

describe('plannedJetpackJumpDecision', () => {
  it('releases a blocked thrust pulse before the tank can run dry', () => {
    expect(PLANNED_JETPACK_STALL_SECONDS).toBeLessThan(JETPACK_MAX_FUEL);
    expect(PLANNED_JETPACK_RELEASE_SECONDS).toBeGreaterThanOrEqual(1);
    expect(PLANNED_JETPACK_RELEASE_SECONDS * JETPACK_REFILL_RATE)
      .toBeGreaterThan(PLANNED_JETPACK_STALL_SECONDS);
  });

  it('releases a stalled held jump long enough to create a new player-input edge', () => {
    const release = plannedJetpackJumpDecision({
      active: true,
      pushing: true,
      entering: false,
      routeReason: 'water-crossing-required',
      now: 12,
      horizontalStillSeconds: PLANNED_JETPACK_STALL_SECONDS,
      releaseUntil: -1
    });
    expect(release).toEqual({
      jumpHeld: false,
      holdMovement: true,
      releaseUntil: 12 + PLANNED_JETPACK_RELEASE_SECONDS,
      resetStillTime: true
    });

    expect(plannedJetpackJumpDecision({
      active: true,
      pushing: true,
      entering: false,
      routeReason: 'water-crossing-required',
      now: release.releaseUntil - 0.01,
      horizontalStillSeconds: 0.5,
      releaseUntil: release.releaseUntil
    }).jumpHeld).toBe(false);

    expect(plannedJetpackJumpDecision({
      active: true,
      pushing: true,
      entering: false,
      routeReason: 'water-crossing-required',
      now: release.releaseUntil,
      horizontalStillSeconds: 1,
      releaseUntil: release.releaseUntil
    })).toEqual({
      jumpHeld: true,
      holdMovement: false,
      releaseUntil: -1,
      resetStillTime: true
    });
  });

  it('never synthesizes jump outside an active moving jetpack leg', () => {
    expect(plannedJetpackJumpDecision({
      active: false,
      pushing: true,
      entering: false,
      routeReason: 'water-crossing-required',
      now: 4,
      horizontalStillSeconds: 9,
      releaseUntil: 5
    })).toEqual({
      jumpHeld: false,
      holdMovement: false,
      releaseUntil: -1,
      resetStillTime: false
    });
    expect(plannedJetpackJumpDecision({
      active: true,
      pushing: false,
      entering: false,
      routeReason: 'water-crossing-required',
      now: 4,
      horizontalStillSeconds: 9,
      releaseUntil: 5
    })).toEqual({
      jumpHeld: false,
      holdMovement: false,
      releaseUntil: -1,
      resetStillTime: false
    });
  });

  it('keeps wet-start swim and ascent controls live instead of entering a dry hold', () => {
    const decision = plannedJetpackJumpDecision({
      active: true,
      pushing: true,
      entering: true,
      routeReason: 'wet-start-egress',
      now: 8,
      horizontalStillSeconds: PLANNED_JETPACK_STALL_SECONDS * 2,
      releaseUntil: 20
    });
    const controls = { forward: true, jump: decision.jumpHeld };
    if (decision.holdMovement) controls.forward = false;

    expect(decision).toEqual({
      jumpHeld: true,
      holdMovement: false,
      releaseUntil: -1,
      resetStillTime: false
    });
    expect(controls.forward).toBe(true);
    expect(controls.forward || controls.jump).toBe(true);
  });

  it('retains physical ascent when a wet-start waypoint briefly has no horizontal input', () => {
    expect(plannedJetpackJumpDecision({
      active: true,
      pushing: false,
      entering: false,
      routeReason: 'wet-start-egress',
      now: 9,
      horizontalStillSeconds: 4,
      releaseUntil: -1
    })).toMatchObject({
      jumpHeld: true,
      holdMovement: false
    });
  });

  it('rearms a stale held jump on dry-bank entry through the real player jump state', () => {
    const stale = {
      isGrounded: true,
      coyoteTimeRemaining: 0,
      jumpBufferRemaining: 0,
      previousJump: true
    };
    const release = plannedJetpackJumpDecision({
      active: true,
      pushing: true,
      entering: true,
      routeReason: 'water-crossing-required',
      now: 20,
      horizontalStillSeconds: 0,
      releaseUntil: -1
    });
    const rearmed = updateJumpState(stale, release.jumpHeld, true, 1 / 60);
    expect(rearmed.shouldJump).toBe(false);
    expect(rearmed.next.previousJump).toBe(false);

    const repress = plannedJetpackJumpDecision({
      active: true,
      pushing: true,
      entering: false,
      routeReason: 'water-crossing-required',
      now: release.releaseUntil,
      horizontalStillSeconds: 0,
      releaseUntil: release.releaseUntil
    });
    const launch = updateJumpState(rearmed.next, repress.jumpHeld, true, 1 / 60);
    expect(launch.shouldJump).toBe(true);
  });
});
