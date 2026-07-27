import type { Vec3Tuple } from '../starSystem.ts';

/**
 * Flying a ship in open space, for the approach to an anchorage.
 *
 * Newtonian with a light drag term. Pure drag-free space flight is technically
 * correct and miserable to dock with — every correction has to be cancelled by an
 * equal and opposite one, and the player spends the approach fighting an
 * oscillation rather than looking at the station. The drag here is small enough
 * that momentum still dominates and the deceleration into the berth is a real
 * decision, and large enough that a small nudge decays instead of compounding.
 *
 * The one concession is the brake: a station-keeping hold that bleeds velocity
 * hard. Docking without it is a test of patience rather than of judgement.
 *
 * Pure, so "does the brake actually stop you" and "can drag ever push you
 * backwards" are unit tests.
 */

/** Acceleration under main thrust, units per second squared. */
export const MAIN_THRUST = 120;
/** Multiplier while boosting. Crossing four kilometres should not be a chore. */
export const BOOST_MULTIPLIER = 4.4;
/** Fraction of velocity shed per second while the brake is held. */
export const BRAKE_RATE = 2.6;
/** Fraction of velocity shed per second otherwise. Small: momentum still rules. */
export const DRAG_RATE = 0.07;
export const MAX_SPEED = 560;
/** Below this the brake simply zeroes it, so a hold settles instead of creeping. */
const REST_SPEED = 0.05;
const MAX_STEP_SECONDS = 0.05;

export interface FlightState {
  position: Vec3Tuple;
  velocity: Vec3Tuple;
}

export interface FlightInput {
  /** Thrust intent in the ship's own frame, each -1..1. */
  forward: number;
  right: number;
  up: number;
  boost: boolean;
  brake: boolean;
  /** Orthonormal basis from the current view. */
  basisForward: Vec3Tuple;
  basisRight: Vec3Tuple;
  basisUp: Vec3Tuple;
}

export function createFlightState(position: Vec3Tuple): FlightState {
  return { position: [...position] as Vec3Tuple, velocity: [0, 0, 0] };
}

export function stepFlight(state: FlightState, input: FlightInput, deltaSeconds: number): FlightState {
  const dt = Math.min(Math.max(deltaSeconds, 0), MAX_STEP_SECONDS);

  const acceleration = MAIN_THRUST * (input.boost ? BOOST_MULTIPLIER : 1);
  let vx = state.velocity[0];
  let vy = state.velocity[1];
  let vz = state.velocity[2];

  vx += (input.basisForward[0] * input.forward + input.basisRight[0] * input.right + input.basisUp[0] * input.up) * acceleration * dt;
  vy += (input.basisForward[1] * input.forward + input.basisRight[1] * input.right + input.basisUp[1] * input.up) * acceleration * dt;
  vz += (input.basisForward[2] * input.forward + input.basisRight[2] * input.right + input.basisUp[2] * input.up) * acceleration * dt;

  // Exponential decay rather than a linear subtraction. Subtracting a fixed
  // amount per second overshoots through zero at low speed and the ship jitters
  // backwards and forwards around rest.
  const decay = Math.exp(-(input.brake ? BRAKE_RATE : DRAG_RATE) * dt);
  vx *= decay;
  vy *= decay;
  vz *= decay;

  let speed = Math.hypot(vx, vy, vz);
  if (input.brake && speed < REST_SPEED) {
    vx = 0;
    vy = 0;
    vz = 0;
    speed = 0;
  } else if (speed > MAX_SPEED) {
    const k = MAX_SPEED / speed;
    vx *= k;
    vy *= k;
    vz *= k;
  }

  // Integrate position on the average of the old and new velocity, not the new
  // one. Under constant thrust the trapezoid rule is exact, so a burn puts the
  // ship in the same place at twelve frames a second as at a hundred and forty —
  // which matters because the approach is timed by eye and a frame-rate drop
  // during the braking burn must not overshoot the berth.
  return {
    position: [
      state.position[0] + ((state.velocity[0] + vx) / 2) * dt,
      state.position[1] + ((state.velocity[1] + vy) / 2) * dt,
      state.position[2] + ((state.velocity[2] + vz) / 2) * dt
    ],
    velocity: [vx, vy, vz]
  };
}

export function flightSpeed(state: FlightState): number {
  return Math.hypot(state.velocity[0], state.velocity[1], state.velocity[2]);
}

/** Neutral input, for tests and for frames where nothing is held. */
export function idleInput(
  basisForward: Vec3Tuple = [0, 0, -1],
  basisRight: Vec3Tuple = [1, 0, 0],
  basisUp: Vec3Tuple = [0, 1, 0]
): FlightInput {
  return {
    forward: 0,
    right: 0,
    up: 0,
    boost: false,
    brake: false,
    basisForward,
    basisRight,
    basisUp
  };
}
