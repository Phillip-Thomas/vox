import { seededUnit } from '../../utils/worldCoordinates.ts';
import {
  MAX_COMPANION_DISTANCE_FROM_PRIMARY,
  type QuaternionTuple,
  type SystemCoordinate,
  type Vec3Tuple
} from '../starSystem.ts';
import { createAnchorageIdentity } from './anchorageAddress.ts';
import { buildAnchorageGraph } from './anchorageLayout.ts';
import type { AnchorageAddress, AnchorageGraph } from './anchorageTypes.ts';

/**
 * The anchorage as a body in system space.
 *
 * Everything outward-facing about a station — where it sits, which way it points,
 * where a ship parks to dock — is derived here, from the same seed that builds the
 * interior. That is the whole discipline of this file: the berth a ship flies into
 * is computed from the apron the player walks out of, so the two cannot drift.
 * Placing the dock by hand and the airlock by generation is how you end up with a
 * hatch that opens onto the side of the hull.
 *
 * Scale is deliberately 1:1 with the interior. The generated station is roughly
 * 830 units long against a planet's 89-unit bound radius, so it genuinely dwarfs
 * the worlds around it — which is why it is placed well outside the planet band
 * and approached in isolation. Rendering the exterior at any other scale would
 * make the berth stop lining up with the airlock, and a lie in the transform is
 * far more expensive than a large silhouette.
 */

/** Anchorages sit beyond the planet band so approach reads as deep space. */
const MIN_ANCHORAGE_RADIUS = MAX_COMPANION_DISTANCE_FROM_PRIMARY + 1_400;
const ANCHORAGE_RADIUS_SPREAD = 2_400;

/** How far off the hull a ship parks to dock, along the approach axis. */
export const BERTH_STANDOFF = 210;

/** Margin added to the graph bound for masts, radiators and berth arms. */
const EXTERIOR_OVERHANG = 130;

/** Salts frozen at v1: changing one relocates every existing anchorage. */
const SALT = {
  population: 401,
  azimuth: 307,
  elevation: 311,
  radius: 313,
  spineAzimuth: 419,
  spineElevation: 421,
  roll: 431
} as const;

/**
 * The station's own frame.
 *
 * Graph coordinates run from the dock end at +X with an arbitrary origin; station
 * space is that box recentred on its middle, so the model hangs on its centre of
 * mass rather than swinging around one corner when the station is oriented.
 */
export interface AnchorageFrame {
  /** Subtract from a graph coordinate to get a station-local one. */
  origin: Vec3Tuple;
  /** Half-extents of the graph bounding box. */
  half: Vec3Tuple;
}

export interface AnchorageBody {
  worldId: string;
  seed: number;
  address: AnchorageAddress;
  /** Centre of the station, in system space. */
  systemPosition: Vec3Tuple;
  /** Orientation taking station-local axes into system space. */
  quaternion: QuaternionTuple;
  /** Sphere enclosing the whole exterior, including masts and radiators. */
  boundRadius: number;
  frame: AnchorageFrame;
  /** Where a ship holds station to dock, in system space. */
  berth: Vec3Tuple;
  /**
   * The same point in station space.
   *
   * Stored rather than recomputed because the approach corridor is measured
   * against it, and a corridor derived from a slightly different berth is a
   * corridor that does not lead to the door.
   */
  berthLocal: Vec3Tuple;
  /**
   * Unit vector a ship travels along to enter the berth — from open space toward
   * the dock mouth. A ship on final is flying this way.
   */
  approachAxis: Vec3Tuple;
}

/**
 * How many anchorages a system has.
 *
 * Most have none. A station is meant to be a destination, and a station in every
 * system is scenery. Two is rare enough to be worth remarking on when it happens.
 */
export function systemAnchorageCount(coordinate: SystemCoordinate, systemSeed: number): 0 | 1 | 2 {
  void coordinate;
  const roll = seededUnit(systemSeed, SALT.population);
  if (roll < 0.62) return 0;
  if (roll < 0.94) return 1;
  return 2;
}

/**
 * Every anchorage in a system, in index order. Empty for most systems.
 *
 * `minimum` forces at least that many regardless of the roll. It exists because
 * most systems have none by design — including, as it happens, the one the game
 * starts in — so without it "go and look at the station" means "first find a
 * system that has one". A development affordance, not a generation rule: the
 * station it conjures is the same seeded station that system would have had.
 */
export function systemAnchorages(
  coordinate: SystemCoordinate,
  systemSeed: number,
  minimum = 0
): AnchorageBody[] {
  const count = Math.max(minimum, systemAnchorageCount(coordinate, systemSeed));
  const bodies: AnchorageBody[] = [];
  for (let index = 0; index < count; index++) {
    bodies.push(anchorageBody({ system: coordinate, index }));
  }
  return bodies;
}

export function anchorageBody(address: AnchorageAddress, graph?: AnchorageGraph): AnchorageBody {
  const identity = createAnchorageIdentity(address);
  const seed = identity.seed;
  const resolved = graph ?? buildAnchorageGraph(seed);
  const frame = anchorageFrame(resolved);

  const systemPosition = systemPositionForAnchorage(seed);
  const quaternion = spineQuaternion(seed);

  /*
    The berth sits on the *apron's* axis, not the bounding box's.

    Those are not the same line and assuming they were put the berth eighty-six
    units above the dock mouth — the station's bounding box is dominated by the
    sealed volume at the far end, which is four times the height of the dock, so
    the box's centre is up in the roof of a completely different district. A ship
    that parks on the geometric centreline of a station parks on top of it.
  */
  const dock = dockCell(resolved);
  const mouth = toStationLocal(frame, [
    dock.min[0],
    (dock.min[1] + dock.max[1]) / 2,
    (dock.min[2] + dock.max[2]) / 2
  ]);
  const berthLocal: Vec3Tuple = [mouth[0] - BERTH_STANDOFF, mouth[1], mouth[2]];
  const berth = addTuple(systemPosition, rotate(quaternion, berthLocal));

  // Local +X points from the dock end toward the far end, so a ship on final is
  // travelling along +X.
  const approachAxis = rotate(quaternion, [1, 0, 0]);

  return {
    worldId: identity.worldId,
    seed,
    address: identity.address,
    systemPosition,
    quaternion,
    boundRadius: Math.hypot(frame.half[0], frame.half[1], frame.half[2]) + EXTERIOR_OVERHANG,
    frame,
    berth,
    berthLocal,
    approachAxis
  };
}

/** The district a ship docks at: the apron, or failing that whatever is furthest -X. */
function dockCell(graph: AnchorageGraph) {
  return (
    graph.cells.find(cell => cell.kind === 'apron') ??
    [...graph.cells].sort((a, b) => a.min[0] - b.min[0])[0]
  );
}

/** Bounding box of the cell graph, as a recentred frame. */
export function anchorageFrame(graph: AnchorageGraph): AnchorageFrame {
  const min: Vec3Tuple = [Infinity, Infinity, Infinity];
  const max: Vec3Tuple = [-Infinity, -Infinity, -Infinity];
  for (const cell of graph.cells) {
    for (let axis = 0; axis < 3; axis++) {
      if (cell.min[axis] < min[axis]) min[axis] = cell.min[axis];
      if (cell.max[axis] > max[axis]) max[axis] = cell.max[axis];
    }
  }
  return {
    origin: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    half: [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2]
  };
}

/** Graph coordinate to station-local. */
export function toStationLocal(frame: AnchorageFrame, point: Vec3Tuple): Vec3Tuple {
  return [point[0] - frame.origin[0], point[1] - frame.origin[1], point[2] - frame.origin[2]];
}

/** Station-local coordinate to system space. */
export function stationLocalToSystem(body: AnchorageBody, local: Vec3Tuple): Vec3Tuple {
  return addTuple(body.systemPosition, rotate(body.quaternion, local));
}

/** System coordinate to station-local. Inverse of the above. */
export function systemToStationLocal(body: AnchorageBody, point: Vec3Tuple): Vec3Tuple {
  const relative: Vec3Tuple = [
    point[0] - body.systemPosition[0],
    point[1] - body.systemPosition[1],
    point[2] - body.systemPosition[2]
  ];
  return rotate(conjugate(body.quaternion), relative);
}

function systemPositionForAnchorage(seed: number): Vec3Tuple {
  const azimuth = seededUnit(seed, SALT.azimuth) * Math.PI * 2;
  const elevation = (seededUnit(seed, SALT.elevation) - 0.5) * 0.5;
  const radius = MIN_ANCHORAGE_RADIUS + seededUnit(seed, SALT.radius) * ANCHORAGE_RADIUS_SPREAD;
  const horizontal = Math.cos(elevation);
  return [
    Math.round(Math.cos(azimuth) * horizontal * radius),
    Math.round(Math.sin(elevation) * radius),
    Math.round(Math.sin(azimuth) * horizontal * radius)
  ];
}

/**
 * Which way the spine points.
 *
 * Seeded rather than axis-aligned, because a station lying exactly along a world
 * axis reads as a level asset. The roll is applied last so two stations pointing
 * the same way still present different faces.
 */
function spineQuaternion(seed: number): QuaternionTuple {
  const azimuth = seededUnit(seed, SALT.spineAzimuth) * Math.PI * 2;
  const elevation = (seededUnit(seed, SALT.spineElevation) - 0.5) * 0.9;
  const roll = seededUnit(seed, SALT.roll) * Math.PI * 2;

  const horizontal = Math.cos(elevation);
  const axis: Vec3Tuple = [
    Math.cos(azimuth) * horizontal,
    Math.sin(elevation),
    Math.sin(azimuth) * horizontal
  ];
  const swing = quaternionFromUnitVectors([1, 0, 0], axis);
  const twist = quaternionFromAxisAngle(axis, roll);
  return multiply(twist, swing);
}

// ---------------------------------------------------------------- quaternions
//
// Written out rather than imported from three, because everything in this
// directory is pure and testable without a renderer, and a body descriptor that
// drags in a graphics library cannot be used by the server or by a headless tool.

export function rotate(q: QuaternionTuple, v: Vec3Tuple): Vec3Tuple {
  const [x, y, z, w] = q;
  // t = 2 * (q.xyz × v); v' = v + w*t + q.xyz × t
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx)
  ];
}

function conjugate(q: QuaternionTuple): QuaternionTuple {
  return [-q[0], -q[1], -q[2], q[3]];
}

function multiply(a: QuaternionTuple, b: QuaternionTuple): QuaternionTuple {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
}

function quaternionFromAxisAngle(axis: Vec3Tuple, angle: number): QuaternionTuple {
  const half = angle / 2;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

function quaternionFromUnitVectors(from: Vec3Tuple, to: Vec3Tuple): QuaternionTuple {
  const dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];
  if (dot < -0.999999) {
    // Antiparallel: any perpendicular axis is a valid half-turn.
    const perpendicular: Vec3Tuple = Math.abs(from[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const axis = normalize(cross(from, perpendicular));
    return quaternionFromAxisAngle(axis, Math.PI);
  }
  const c = cross(from, to);
  return normalizeQuaternion([c[0], c[1], c[2], 1 + dot]);
}

function cross(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalize(v: Vec3Tuple): Vec3Tuple {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function normalizeQuaternion(q: QuaternionTuple): QuaternionTuple {
  const length = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
}

function addTuple(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
