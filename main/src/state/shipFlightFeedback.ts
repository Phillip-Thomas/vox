import type { FlightPhase } from './spaceFlight.ts';

export const SHIP_BASE_FOV = 70;
export const SHIP_BOOST_FOV = 79;
export const SHIP_REDUCED_MOTION_FOV = 72;

export interface ShipFlightFeedback {
  active: boolean;
  phase: FlightPhase;
  throttle: number;
  boost: number;
  speed: number;
  speedRatio: number;
  acceleration: number;
  forwardSpeed: number;
  motion: number;
  approachLimited: boolean;
  reducedMotion: boolean;
  fov: number;
}

export interface ShipFlightFeedbackInput {
  active: boolean;
  phase: FlightPhase;
  throttle: number;
  boost: boolean;
  speed: number;
  maxSpeed: number;
  acceleration: number;
  forwardSpeed: number;
  approachLimited?: boolean;
  reducedMotion?: boolean;
}

const feedback: ShipFlightFeedback = {
  active: false,
  phase: 'surface',
  throttle: 0,
  boost: 0,
  speed: 0,
  speedRatio: 0,
  acceleration: 0,
  forwardSpeed: 0,
  motion: 0,
  approachLimited: false,
  reducedMotion: false,
  fov: SHIP_BASE_FOV
};

function finiteClamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 0;
}

function damp(current: number, target: number, response: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-response * Math.max(0, dt)));
}

export function prefersReducedFlightMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Desktop boost is Shift; touch retains the existing Space-backed THR button. */
export function resolveShipBoost(
  sprintHeld: boolean,
  jumpHeld: boolean,
  touchActive: boolean,
  forwardHeld: boolean
): boolean {
  return forwardHeld && (sprintHeld || (touchActive && jumpHeld));
}

/** Mutable hot-path snapshot shared by camera, cockpit, HUD, audio and post FX. */
export function getShipFlightFeedback(): Readonly<ShipFlightFeedback> {
  return feedback;
}

export function updateShipFlightFeedback(
  input: ShipFlightFeedbackInput,
  rawDt: number
): Readonly<ShipFlightFeedback> {
  const dt = finiteClamp(rawDt, 0, 0.1);
  const reducedMotion = input.reducedMotion ?? prefersReducedFlightMotion();
  const throttleTarget = finiteClamp(input.throttle, -1, 1);
  const boostTarget = input.active && input.boost ? 1 : 0;
  const speed = Math.max(0, Number.isFinite(input.speed) ? input.speed : 0);
  const maxSpeed = Math.max(1, Number.isFinite(input.maxSpeed) ? input.maxSpeed : 1);
  const speedRatio = finiteClamp(speed / maxSpeed, 0, 1);

  feedback.active = input.active;
  feedback.phase = input.phase;
  feedback.throttle = damp(feedback.throttle, throttleTarget, throttleTarget === 0 ? 7 : 13, dt);
  feedback.boost = damp(feedback.boost, boostTarget, boostTarget > feedback.boost ? 16 : 7, dt);
  feedback.speed = speed;
  feedback.speedRatio = speedRatio;
  feedback.acceleration = finiteClamp(input.acceleration, -1, 1);
  feedback.forwardSpeed = Number.isFinite(input.forwardSpeed) ? input.forwardSpeed : 0;
  feedback.approachLimited = Boolean(input.approachLimited);
  feedback.reducedMotion = reducedMotion;

  const deepSpaceMotion = input.active && input.phase === 'deep_space'
    ? finiteClamp(speedRatio * 0.28 + feedback.boost * 0.82, 0, 1)
    : 0;
  feedback.motion = damp(feedback.motion, reducedMotion ? 0 : deepSpaceMotion, deepSpaceMotion > feedback.motion ? 12 : 4.5, dt);

  const maxFov = reducedMotion ? SHIP_REDUCED_MOTION_FOV : SHIP_BOOST_FOV;
  const fovTarget = input.active
    ? SHIP_BASE_FOV + (maxFov - SHIP_BASE_FOV) * feedback.boost
    : SHIP_BASE_FOV;
  feedback.fov = damp(feedback.fov, fovTarget, fovTarget > feedback.fov ? 13 : 7, dt);
  return feedback;
}

export function resetShipFlightFeedback(): void {
  Object.assign(feedback, {
    active: false,
    phase: 'surface' as FlightPhase,
    throttle: 0,
    boost: 0,
    speed: 0,
    speedRatio: 0,
    acceleration: 0,
    forwardSpeed: 0,
    motion: 0,
    approachLimited: false,
    reducedMotion: false,
    fov: SHIP_BASE_FOV
  });
}
