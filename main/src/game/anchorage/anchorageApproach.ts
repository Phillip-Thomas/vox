import type { Vec3Tuple } from '../starSystem.ts';
import { systemToStationLocal, type AnchorageBody } from './anchorageBody.ts';

/**
 * Flying to an anchorage, and being allowed to dock.
 *
 * A station you can touch from any angle at any speed is a trigger volume with a
 * hull around it. This is the procedure instead: you see it, you line up on the
 * approach corridor, you slow down, and then you are cleared. Three gates, each
 * one legible on an instrument and each one refusable with a reason — a docking
 * request that just fails is a bug report, and one that says "too fast" is a
 * thing the player learns.
 *
 * Pure, and expressed against the body descriptor rather than against a scene, so
 * the corridor a ship must fly is the same geometry the exterior renders its guide
 * lights along.
 */

/** Beyond this the station is not on instruments at all. */
export const SCAN_RANGE = 5_200;
/** Inside this the approach corridor is published and alignment starts mattering. */
export const CORRIDOR_RANGE = 1_400;
/** Radius of the sphere around the berth in which docking may be requested. */
export const BERTH_ENVELOPE = 90;
/**
 * Half-angle of the approach cone, measured at the berth.
 *
 * Generous on purpose. This gate exists to make arrival read as an approach, not
 * to be a piloting exam — the speed gate is the one that actually asks something
 * of the player.
 */
export const CORRIDOR_HALF_ANGLE = 0.46;
/** Fastest you may be closing when clearance is granted, in units per second. */
export const DOCK_SPEED_LIMIT = 34;

export type ApproachPhase =
  /** Out of instrument range. */
  | 'unknown'
  /** On instruments, too far to line up. */
  | 'detected'
  /** Inside corridor range; alignment is being measured. */
  | 'approach'
  /** Inside the berth envelope. */
  | 'berth'
  /** Everything satisfied. */
  | 'cleared';

export type ApproachBlocker = 'range' | 'alignment' | 'speed' | null;

export interface ApproachReadout {
  phase: ApproachPhase;
  /** Distance from the ship to the berth. */
  distance: number;
  /** Distance from the ship to the station's centre, for the proximity warning. */
  hullDistance: number;
  /** Radians between the ship's bearing and the corridor axis, measured at the berth. */
  offAxis: number;
  /** Positive means closing. */
  closingSpeed: number;
  insideCorridor: boolean;
  canDock: boolean;
  /** The first unmet gate, in the order a pilot meets them. */
  blocker: ApproachBlocker;
  /** One short instrument line. Never punctuation-only, never empty. */
  advisory: string;
}

export interface ApproachInput {
  position: Vec3Tuple;
  /** Units per second, in system space. */
  velocity: Vec3Tuple;
}

export function evaluateApproach(body: AnchorageBody, ship: ApproachInput): ApproachReadout {
  const toBerth: Vec3Tuple = [
    body.berth[0] - ship.position[0],
    body.berth[1] - ship.position[1],
    body.berth[2] - ship.position[2]
  ];
  const distance = length(toBerth);
  const hullDistance = length([
    body.systemPosition[0] - ship.position[0],
    body.systemPosition[1] - ship.position[1],
    body.systemPosition[2] - ship.position[2]
  ]);

  // Closing speed is the component of velocity along the line to the berth, so
  // flying past at speed does not read as a fast approach.
  const closingSpeed = distance > 1e-6
    ? (ship.velocity[0] * toBerth[0] + ship.velocity[1] * toBerth[1] + ship.velocity[2] * toBerth[2]) / distance
    : 0;

  const offAxis = offAxisAngle(body, ship.position);
  const insideCorridor = offAxis <= CORRIDOR_HALF_ANGLE;

  if (distance > SCAN_RANGE) {
    return {
      phase: 'unknown',
      distance,
      hullDistance,
      offAxis,
      closingSpeed,
      insideCorridor,
      canDock: false,
      blocker: 'range',
      advisory: 'no anchorage on instruments'
    };
  }

  if (distance > CORRIDOR_RANGE) {
    return {
      phase: 'detected',
      distance,
      hullDistance,
      offAxis,
      closingSpeed,
      insideCorridor,
      canDock: false,
      blocker: 'range',
      advisory: `anchorage ${Math.round(distance)} out · hold for approach`
    };
  }

  if (distance > BERTH_ENVELOPE) {
    return {
      phase: 'approach',
      distance,
      hullDistance,
      offAxis,
      closingSpeed,
      insideCorridor,
      canDock: false,
      blocker: insideCorridor ? 'range' : 'alignment',
      advisory: insideCorridor
        ? `on the corridor · ${Math.round(distance)} to the berth`
        : 'off the corridor · come around to the lit approach'
    };
  }

  // Inside the envelope. The remaining gates are the ones worth refusing on.
  if (!insideCorridor) {
    return {
      phase: 'berth',
      distance,
      hullDistance,
      offAxis,
      closingSpeed,
      insideCorridor,
      canDock: false,
      blocker: 'alignment',
      advisory: 'at the berth but off the corridor · line up on the mouth'
    };
  }

  if (closingSpeed > DOCK_SPEED_LIMIT) {
    return {
      phase: 'berth',
      distance,
      hullDistance,
      offAxis,
      closingSpeed,
      insideCorridor,
      canDock: false,
      blocker: 'speed',
      advisory: `too fast to dock · ${Math.round(closingSpeed)} closing, limit ${DOCK_SPEED_LIMIT}`
    };
  }

  return {
    phase: 'cleared',
    distance,
    hullDistance,
    offAxis,
    closingSpeed,
    insideCorridor,
    canDock: true,
    blocker: null,
    advisory: 'cleared to dock'
  };
}

/**
 * How far off the approach corridor a position is, in radians, measured at the berth.
 *
 * The corridor is a cone whose apex is the berth and whose axis runs back out into
 * open space along -X in station-local terms. Measuring in station space rather
 * than in system space means the whole test is two subtractions and an atan2, and
 * it stays correct however the station is oriented.
 */
export function offAxisAngle(body: AnchorageBody, position: Vec3Tuple): number {
  const local = systemToStationLocal(body, position);
  // Lateral offset is measured from the berth's own axis, which runs through the
  // dock mouth — not through the station's geometric centre, which is up inside a
  // completely different district.
  const dx = local[0] - body.berthLocal[0];
  const lateral = Math.hypot(local[1] - body.berthLocal[1], local[2] - body.berthLocal[2]);
  // A ship correctly positioned is out along -X from the berth, i.e. dx < 0.
  return Math.atan2(lateral, -dx);
}

/**
 * Where the ship should be to fly a clean approach: out along the corridor axis
 * from the berth. Used to place a ship on final and to draw the guide.
 */
export function approachHold(body: AnchorageBody, distanceFromBerth: number): Vec3Tuple {
  return [
    body.berth[0] - body.approachAxis[0] * distanceFromBerth,
    body.berth[1] - body.approachAxis[1] * distanceFromBerth,
    body.berth[2] - body.approachAxis[2] * distanceFromBerth
  ];
}

/**
 * Where an arriving ship drops out of transit: off the beam, not on the corridor.
 *
 * Arriving already lined up means approaching a very long, very thin object down
 * its shortest axis, which is the one view where none of it is visible. Coming in
 * off the beam shows the whole length first and turns lining up into a manoeuvre
 * the player performs rather than a state they begin in. It is the difference
 * between an establishing shot and a loading screen.
 */
export function arrivalStandoff(body: AnchorageBody, distanceFromCentre: number): Vec3Tuple {
  const lateral = perpendicularTo(body.approachAxis);
  const up = cross(body.approachAxis, lateral);
  // Weighted toward the beam, biased a little toward the dock end and above the
  // plane of the spine, which is the three-quarter view the station looks best in.
  const direction = normalize([
    lateral[0] * 0.78 - body.approachAxis[0] * 0.46 + up[0] * 0.32,
    lateral[1] * 0.78 - body.approachAxis[1] * 0.46 + up[1] * 0.32,
    lateral[2] * 0.78 - body.approachAxis[2] * 0.46 + up[2] * 0.32
  ]);
  return [
    body.systemPosition[0] + direction[0] * distanceFromCentre,
    body.systemPosition[1] + direction[1] * distanceFromCentre,
    body.systemPosition[2] + direction[2] * distanceFromCentre
  ];
}

/**
 * A key-light direction that rakes along the spine rather than down it.
 *
 * The star's real position is somewhere else entirely, but a station lit flat from
 * the front or silhouetted from behind stops being a shape, and the exterior gets
 * exactly one light worth having. Placing it across the long axis is the same
 * reason a portrait key sits off to one side.
 */
export function keyLightDirection(body: AnchorageBody): Vec3Tuple {
  const lateral = perpendicularTo(body.approachAxis);
  const up = cross(body.approachAxis, lateral);
  return normalize([
    -lateral[0] * 0.72 + up[0] * 0.55 + body.approachAxis[0] * 0.28,
    -lateral[1] * 0.72 + up[1] * 0.55 + body.approachAxis[1] * 0.28,
    -lateral[2] * 0.72 + up[2] * 0.55 + body.approachAxis[2] * 0.28
  ]);
}

function perpendicularTo(axis: Vec3Tuple): Vec3Tuple {
  // Cross with whichever world axis the spine is least aligned to, so the result
  // is never near-degenerate however the station happens to be oriented.
  const reference: Vec3Tuple =
    Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return normalize(cross(axis, reference));
}

function cross(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalize(v: Vec3Tuple): Vec3Tuple {
  const magnitude = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / magnitude, v[1] / magnitude, v[2] / magnitude];
}

function length(v: Vec3Tuple): number {
  return Math.hypot(v[0], v[1], v[2]);
}
