// --- Common Ground (ch13): the single writer of W-7744's body -----------------------
//
// One body, one writer. `AuditWorker.tsx` renders `getAuditWorkerPose()` and the
// A4 choreography writes it during `a4-exhale`; this module writes it during the
// four ch13 beats and never overlaps, so there is exactly one authority on where
// he is at any instant.
//
// He walks. Every leg below is a real grounded traversal over the same dry
// surface the player walks, guarded by the chapter's own solid rule, and every
// leg can HOLD. Nothing here teleports him, and nothing here marks a milestone,
// advances a beat or grants a receipt — the director reads his actual arrival.

import * as THREE from 'three';
import {
  CG_POSES,
  CG_ROUTE_COMMON,
  distanceBetween,
  type CommonGroundPoint
} from './commonGroundState.ts';
import {
  walkedSegmentSupported,
  type CommonGroundAabb,
  type CommonGroundFooting
} from './commonGroundRoute.ts';
import { getAuditWorkerPose, hideAuditWorker } from './world/AuditWorker.tsx';

/** His walking speed, matching the shipped auditor gait. */
const WORKER_WALK_SPEED = 2.45;
const WORKER_TURN_SPEED = 5.2;
/**
 * Arrival is EXACT, to floating-point tolerance and nothing more.
 *
 * A 0.35-unit slack sounds harmless and is not: the caller promotes a fully
 * tested prefix on arrival, so a third of a metre of slack is a third of a metre
 * of span nobody walked being credited as demonstrated — and on the final test
 * it would commit the reciprocal proof at 17.65 of 18 units. The integration is
 * clipped at the endpoint instead, so the last fraction is walked rather than
 * forgiven.
 */
const ARRIVAL_EPSILON = 1e-6;

export type CommonGroundActorLeg =
  /** Standing at W, repeating the unresolved local measurement. */
  | 'inspecting'
  /** W -> S. Uncredited: reaching the start of an offered span proves nothing. */
  | 'approach-start'
  /** Sampling the offered span itself. This is the test. */
  | 'testing-span'
  /** E -> H. Uncredited positioning. */
  | 'position-to-h'
  /** Standing at H, maintaining the reference while Terra walks E -> C. */
  | 'holding-h'
  /** H -> E. Uncredited positioning. */
  | 'position-to-e'
  /** His own full E -> C traversal. */
  | 'independent-test'
  /** Standing at C, arrived. */
  | 'arrived';

export interface CommonGroundActorState {
  leg: CommonGroundActorLeg;
  /** Walked units completed on the current leg. */
  travelled: number;
  /** Total walked units of the current leg's polyline. */
  legLength: number;
  /** True while a real physical condition stops him; never a timer. */
  held: boolean;
  /** Index of the last sample he has actually sampled on a tested span. */
  sampledIndex: number;
  /** How far along this leg he is currently permitted to walk. */
  permitted: number;
}

const state: CommonGroundActorState = {
  leg: 'inspecting',
  travelled: 0,
  legLength: 0,
  held: false,
  sampledIndex: -1,
  permitted: Number.POSITIVE_INFINITY
};

let path: CommonGroundPoint[] = [];
let pathKey: string | null = null;
/** How far along `path` he may advance right now; the director sets this. */
let permittedUnits = Number.POSITIVE_INFINITY;

const _up = new THREE.Vector3(0, 1, 0);
const _heading = new THREE.Vector3();

export function getCommonGroundActorState(): Readonly<CommonGroundActorState> {
  return state;
}

export function resetCommonGroundActor(): void {
  state.leg = 'inspecting';
  state.travelled = 0;
  state.legLength = 0;
  state.held = false;
  state.sampledIndex = -1;
  state.permitted = Number.POSITIVE_INFINITY;
  path = [];
  pathKey = null;
  permittedUnits = Number.POSITIVE_INFINITY;
}

/** Leaving the chapter returns his body to the same hidden state ch4 leaves it in. */
export function releaseCommonGroundActor(): void {
  resetCommonGroundActor();
  hideAuditWorker();
}

function polylineLength(points: readonly CommonGroundPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceBetween(points[index - 1], points[index]);
  }
  return total;
}

/** Point at `units` along the polyline, plus the index of the sample reached. */
function samplePolyline(
  points: readonly CommonGroundPoint[],
  units: number
): { point: CommonGroundPoint; heading: CommonGroundPoint; index: number } {
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const segment = distanceBetween(from, to);
    if (segment <= 0) continue;
    if (travelled + segment >= units) {
      const t = (units - travelled) / segment;
      return {
        point: {
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
          z: from.z + (to.z - from.z) * t
        },
        heading: { x: (to.x - from.x) / segment, y: 0, z: (to.z - from.z) / segment },
        index: index - 1 + (t >= 1 ? 1 : 0)
      };
    }
    travelled += segment;
  }
  const last = points[points.length - 1] ?? points[0];
  const previous = points[points.length - 2] ?? last;
  const segment = Math.max(1e-6, distanceBetween(previous, last));
  return {
    point: last,
    heading: { x: (last.x - previous.x) / segment, y: 0, z: (last.z - previous.z) / segment },
    index: points.length - 1
  };
}

export interface CommonGroundLegRequest {
  leg: CommonGroundActorLeg;
  /** The polyline he must actually walk. Standing legs use a single point. */
  points: readonly CommonGroundPoint[];
  /**
   * The last INDEX of this leg's own path he may reach.
   *
   * An index, not a distance, and that is the whole point: the director knows
   * which sample is the last demonstrable one, but only this module knows where
   * the leg actually started. Handing over a distance measured from the live
   * pose meant the permitted length shrank as he walked, so he stopped a few
   * centimetres short of a sample he was fully permitted to reach and reported
   * a hold that had no physical cause.
   */
  permittedIndex?: number;
  /** A key that, when it changes, restarts the leg. */
  key: string;
  /**
   * Distance already walked on this leg when it is (re)created.
   *
   * Used once, on the frame a save is resumed: he was somewhere along this leg
   * when the game was closed, and starting him back at its first point would
   * re-walk ground he already covered. Ignored while the key is unchanged.
   */
  seedTravelled?: number;
}

/**
 * Set (or continue) the leg he is walking. Re-issuing the same key continues
 * from where he actually is; a new key starts a new leg from its first point.
 */
export function setCommonGroundLeg(request: CommonGroundLegRequest): void {
  if (pathKey !== request.key) {
    pathKey = request.key;
    path = request.points.map(point => ({ ...point }));
    state.leg = request.leg;
    state.legLength = polylineLength(path);
    state.travelled = Math.max(0, Math.min(state.legLength, request.seedTravelled ?? 0));
    state.sampledIndex = path.length > 0 ? 0 : -1;
    state.held = false;
  } else {
    state.leg = request.leg;
  }
  permittedUnits = request.permittedIndex == null
    ? Number.POSITIVE_INFINITY
    : polylineLength(path.slice(0, Math.max(1, Math.min(path.length, request.permittedIndex + 1))));
  state.permitted = permittedUnits;
}

export interface CommonGroundActorTickInput {
  dt: number;
  footing: CommonGroundFooting | null;
  extraSolids: readonly CommonGroundAabb[];
  /** Terra's live body, so he never walks into her. */
  playerPosition: CommonGroundPoint | null;
  bodyClearanceUnits: number;
}

/**
 * Advance him along the current leg.
 *
 * THREE THINGS CAN STOP HIM, and all three are physical: the director has not
 * permitted the next stretch (an unsupported reference), the next stretch is not
 * dry supported ground or passes through a solid, or the player's own body is in
 * the way. A hold is a hold — his position is retained, the leg is not restarted,
 * and no clock is consulted.
 */
export function tickCommonGroundActor(input: CommonGroundActorTickInput): Readonly<CommonGroundActorState> {
  const pose = getAuditWorkerPose();
  if (path.length === 0) {
    pose.walk = 0;
    return state;
  }
  pose.visible = true;
  pose.up.copy(_up);

  const step = Math.max(0, input.dt) * WORKER_WALK_SPEED;
  // NEVER REWIND. A transient hold can lower the permitted distance below where
  // he already is (a reference lapses behind him); clamping without this floor
  // would slide his body backwards to an earlier supported prefix, which is a
  // teleport wearing a hold's clothes.
  const target = Math.max(
    state.travelled,
    Math.min(state.legLength, Math.min(state.travelled + step, permittedUnits))
  );
  let blocked = target <= state.travelled && state.travelled < state.legLength;

  if (!blocked && target > state.travelled) {
    const from = samplePolyline(path, state.travelled).point;
    const to = samplePolyline(path, target).point;
    if (input.footing
      && !walkedSegmentSupported(from, to, input.footing, { extraSolids: input.extraSolids })) {
      blocked = true;
    }
    if (!blocked && input.playerPosition) {
      const gap = Math.hypot(to.x - input.playerPosition.x, to.z - input.playerPosition.z);
      // POSITIONING NEVER DISPLACES THE PLAYER. If she is standing where he is
      // going, he waits; he does not push her and she is not teleported.
      if (gap < input.bodyClearanceUnits) blocked = true;
    }
  }

  state.held = blocked;
  if (!blocked) state.travelled = target;

  const sampled = samplePolyline(path, state.travelled);
  pose.position.set(sampled.point.x, sampled.point.y, sampled.point.z);
  state.sampledIndex = sampled.index;
  if (sampled.heading.x !== 0 || sampled.heading.z !== 0) {
    _heading.set(sampled.heading.x, 0, sampled.heading.z).normalize();
    turnToward(pose.heading, _heading, WORKER_TURN_SPEED * Math.max(0, input.dt));
  }
  const moving = !blocked && state.travelled < state.legLength;
  pose.stride += moving ? step : 0;
  pose.walk = moving ? 1 : 0;
  return state;
}

function turnToward(current: THREE.Vector3, desired: THREE.Vector3, maxRadians: number): void {
  const dot = Math.max(-1, Math.min(1, current.dot(desired)));
  const angle = Math.acos(dot);
  if (angle <= maxRadians || angle < 1e-4) {
    current.copy(desired);
    return;
  }
  current.lerp(desired, maxRadians / angle).normalize();
}

/** True when his body has actually reached the end of the current leg. */
export function commonGroundActorArrived(): boolean {
  if (path.length === 0) return false;
  return state.legLength - state.travelled <= ARRIVAL_EPSILON;
}

/**
 * Put his body at a known pose without a leg.
 *
 * The resume seam, and nothing else: a save says where he was standing, and the
 * next leg is then built FROM that pose. It walks nothing and proves nothing.
 */
export function seedCommonGroundActorPose(point: CommonGroundPoint): void {
  const pose = getAuditWorkerPose();
  pose.visible = true;
  pose.position.set(point.x, point.y, point.z);
  pose.walk = 0;
}

/** His live grounded position, for range and clearance predicates. */
export function commonGroundActorPosition(): CommonGroundPoint {
  const pose = getAuditWorkerPose();
  return { x: pose.position.x, y: pose.position.y, z: pose.position.z };
}

/** The two uncredited positioning legs, written out so nothing can mistake them. */
export const CG_LEG_E_TO_H: readonly CommonGroundPoint[] = Object.freeze([CG_POSES.E, CG_POSES.H]);
export const CG_LEG_H_TO_E: readonly CommonGroundPoint[] = Object.freeze([CG_POSES.H, CG_POSES.E]);
/** His independent test is the FULL common route, never the positioning legs. */
export const CG_LEG_INDEPENDENT_TEST = CG_ROUTE_COMMON;
