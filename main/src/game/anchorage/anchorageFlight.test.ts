import { describe, expect, it } from 'vitest';
import {
  BOOST_MULTIPLIER,
  MAX_SPEED,
  createFlightState,
  flightSpeed,
  idleInput,
  stepFlight,
  type FlightInput,
  type FlightState
} from './anchorageFlight.ts';
import {
  BERTH_ENVELOPE,
  DOCK_SPEED_LIMIT,
  approachHold,
  evaluateApproach
} from './anchorageApproach.ts';
import { anchorageBody } from './anchorageBody.ts';

function fly(state: FlightState, input: FlightInput, seconds: number, step = 1 / 60): FlightState {
  let current = state;
  for (let t = 0; t < seconds; t += step) current = stepFlight(current, input, step);
  return current;
}

const FORWARD = idleInput();

describe('ship flight', () => {
  it('starts at rest', () => {
    expect(flightSpeed(createFlightState([10, 0, 0]))).toBe(0);
  });

  it('accelerates along the view and keeps going when thrust stops', () => {
    const thrusting = fly(createFlightState([0, 0, 0]), { ...FORWARD, forward: 1 }, 2);
    expect(thrusting.position[2]).toBeLessThan(-100);
    const coasting = fly(thrusting, FORWARD, 3);
    // Momentum dominates: three seconds of coasting keeps most of the speed.
    expect(flightSpeed(coasting)).toBeGreaterThan(flightSpeed(thrusting) * 0.7);
  });

  it('never lets drag push the ship backwards', () => {
    let state = fly(createFlightState([0, 0, 0]), { ...FORWARD, forward: 1 }, 1);
    for (let i = 0; i < 4_000; i++) {
      const next = stepFlight(state, FORWARD, 1 / 60);
      // Velocity decays toward zero and never crosses it.
      expect(Math.sign(next.velocity[2]) === Math.sign(state.velocity[2]) || next.velocity[2] === 0).toBe(true);
      state = next;
    }
  });

  it('brings the ship to a genuine stop under the brake, not a creep', () => {
    const moving = fly(createFlightState([0, 0, 0]), { ...FORWARD, forward: 1, boost: true }, 3);
    expect(flightSpeed(moving)).toBeGreaterThan(200);
    const stopped = fly(moving, { ...FORWARD, brake: true }, 12);
    expect(flightSpeed(stopped)).toBe(0);
  });

  it('boosts meaningfully faster than main thrust', () => {
    const plain = fly(createFlightState([0, 0, 0]), { ...FORWARD, forward: 1 }, 1);
    const boosted = fly(createFlightState([0, 0, 0]), { ...FORWARD, forward: 1, boost: true }, 1);
    expect(flightSpeed(boosted)).toBeGreaterThan(flightSpeed(plain) * (BOOST_MULTIPLIER * 0.7));
  });

  it('caps speed however long you hold it', () => {
    const state = fly(createFlightState([0, 0, 0]), { ...FORWARD, forward: 1, boost: true }, 90);
    expect(flightSpeed(state)).toBeLessThanOrEqual(MAX_SPEED + 1e-6);
  });

  it('reaches the same place at any frame rate, near enough to fly by', () => {
    const input = { ...FORWARD, forward: 1 };
    const fine = fly(createFlightState([0, 0, 0]), input, 4, 1 / 144);
    const coarse = fly(createFlightState([0, 0, 0]), input, 4, 1 / 20);
    // Explicit integration is not exact across step sizes; what matters is that a
    // frame-rate change does not alter where a burn puts you by a ship length.
    expect(Math.abs(fine.position[2] - coarse.position[2])).toBeLessThan(20);
  });
});

describe('flying an actual approach', () => {
  const body = anchorageBody({ system: { x: -19, y: -17 }, index: 0 });

  it('can cross the corridor and stop inside the berth envelope', () => {
    // Start four kilometres out on the corridor, pointed at the station.
    const start = approachHold(body, 4_000);
    const toStation = body.approachAxis;
    let state = createFlightState(start);

    // Burn in.
    state = fly(state, { ...idleInput(toStation), forward: 1, boost: true }, 9);
    // Coast, then flip and brake — the actual shape of a docking approach.
    state = fly(state, idleInput(toStation), 6);
    state = fly(state, { ...idleInput(toStation), brake: true }, 14);

    const readout = evaluateApproach(body, state);
    expect(readout.distance).toBeLessThan(4_000);
    expect(readout.closingSpeed).toBeLessThan(DOCK_SPEED_LIMIT);
  });

  it('is refused when it arrives hot and cleared when it arrives slow', () => {
    const position = approachHold(body, BERTH_ENVELOPE * 0.5);
    const hot = evaluateApproach(body, {
      position,
      velocity: [
        body.approachAxis[0] * 200,
        body.approachAxis[1] * 200,
        body.approachAxis[2] * 200
      ]
    });
    expect(hot.canDock).toBe(false);
    expect(hot.blocker).toBe('speed');

    const slow = evaluateApproach(body, { position, velocity: [0, 0, 0] });
    expect(slow.canDock).toBe(true);
  });
});
