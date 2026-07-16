// Retry before the 1.4-second tank can empty against a bank. The release window
// is deliberately long enough to land, re-arm the real jump edge, and regain a
// useful grounded fuel charge even under a slow renderer.
export const PLANNED_JETPACK_STALL_SECONDS = 0.8;
export const PLANNED_JETPACK_RELEASE_SECONDS = 1.5;

export interface PlannedJetpackJumpInput {
  active: boolean;
  pushing: boolean;
  entering: boolean;
  routeReason: string;
  now: number;
  horizontalStillSeconds: number;
  releaseUntil: number;
}

export interface PlannedJetpackJumpDecision {
  jumpHeld: boolean;
  /** Do not walk off the dry launch cell while creating the false -> true edge. */
  holdMovement: boolean;
  releaseUntil: number;
  resetStillTime: boolean;
}

/**
 * A planned water crossing needs a real false -> true jump edge. A preceding
 * cube-edge recovery can leave jump held as the route enters its jetpack leg;
 * likewise, a short first hop can land at the bank while the key is still held.
 * Release for a full low-FPS-safe second, then press again through the ordinary
 * player controller. A blocked crossing therefore becomes bounded thrust/land
 * pulses rather than burning the tank dry. This retries physics without moving
 * the body or accepting a story milestone on the pilot's behalf.
 */
export function plannedJetpackJumpDecision(
  input: PlannedJetpackJumpInput
): PlannedJetpackJumpDecision {
  if (!input.active) {
    return {
      jumpHeld: false,
      holdMovement: false,
      releaseUntil: -1,
      resetStillTime: false
    };
  }

  if (input.routeReason === 'wet-start-egress') {
    // This leg begins without dry support, so a stationary false -> true pulse
    // cannot recharge or launch anything. Keep horizontal swim steering and
    // physical ascent alive until the planner proves a dry-bank handoff. Also
    // cancel any release inherited from a prior dry leg.
    return {
      jumpHeld: true,
      holdMovement: false,
      releaseUntil: -1,
      resetStillTime: false
    };
  }

  if (!input.pushing) {
    return {
      jumpHeld: false,
      holdMovement: false,
      releaseUntil: -1,
      resetStillTime: false
    };
  }

  if (input.releaseUntil >= 0) {
    if (input.now < input.releaseUntil) {
      return {
        jumpHeld: false,
        holdMovement: true,
        releaseUntil: input.releaseUntil,
        resetStillTime: false
      };
    }
    return {
      jumpHeld: true,
      holdMovement: false,
      releaseUntil: -1,
      resetStillTime: true
    };
  }

  if (input.entering) {
    return {
      jumpHeld: false,
      holdMovement: true,
      releaseUntil: input.now + PLANNED_JETPACK_RELEASE_SECONDS,
      resetStillTime: true
    };
  }

  if (input.horizontalStillSeconds >= PLANNED_JETPACK_STALL_SECONDS) {
    return {
      jumpHeld: false,
      holdMovement: true,
      releaseUntil: input.now + PLANNED_JETPACK_RELEASE_SECONDS,
      resetStillTime: true
    };
  }

  return {
    jumpHeld: true,
    holdMovement: false,
    releaseUntil: -1,
    resetStillTime: false
  };
}
