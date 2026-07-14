import * as THREE from 'three';
import { VOXEL_SCALE } from './cubeGravityConstants.ts';

/** A route point whose position is the actor's grounded root/foot anchor. */
export interface GroundedSurfaceRoutePoint {
  position: THREE.Vector3;
}

export interface GroundedSurfaceSample {
  position: THREE.Vector3;
  heading: THREE.Vector3;
  distance: number;
  segmentIndex: number;
  segmentProgress: number;
}

const EPSILON = 1e-6;
const _segment = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _behind = new THREE.Vector3();
const _ahead = new THREE.Vector3();
const _currentHeading = new THREE.Vector3();
const _targetHeading = new THREE.Vector3();
const _cross = new THREE.Vector3();

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function tangentLength(a: THREE.Vector3, b: THREE.Vector3, up: THREE.Vector3): number {
  _segment.copy(b).sub(a);
  _segment.addScaledVector(up, -_segment.dot(up));
  const horizontal = _segment.length();
  return horizontal > EPSILON ? horizontal : a.distanceTo(b);
}

/**
 * Distance travelled over the supporting face. Step height is simultaneous with
 * forward travel, matching the player's step assist instead of making slopes
 * artificially faster or slower.
 */
export function groundedSurfaceRouteLength(
  route: ReadonlyArray<GroundedSurfaceRoutePoint>,
  up: THREE.Vector3
): number {
  let total = 0;
  for (let index = 1; index < route.length; index++) {
    total += tangentLength(route[index - 1].position, route[index].position, up);
  }
  return total;
}

/**
 * A short acceleration/deceleration envelope with a constant-speed middle.
 * Unlike a whole-journey smoothstep, it does not create a long unnatural drift.
 */
export function easedGroundedTravelProgress(progress: number, rampFraction = 0.08): number {
  const t = clamp01(progress);
  const ramp = Math.min(0.49, Math.max(0, rampFraction));
  if (ramp <= EPSILON) return t;
  const area = 1 - ramp;
  if (t < ramp) return (0.5 * t * t / ramp) / area;
  if (t > 1 - ramp) {
    const tail = 1 - t;
    return 1 - (0.5 * tail * tail / ramp) / area;
  }
  return (t - 0.5 * ramp) / area;
}

function stepHeightProgress(progress: number, heightDelta: number): number {
  if (Math.abs(heightDelta) <= EPSILON) return progress;
  // Step up before the body reaches the riser; step down only after its centre
  // clears the ledge. At the cell boundary (p=.5), an ascent is already at the
  // high support and a descent is still at the high support, so the root never
  // intersects either voxel. Either correction stays inside one adjacent leg.
  return heightDelta > 0
    ? smoothstep((progress - 0.25) / 0.25)
    : smoothstep((progress - 0.5) / 0.25);
}

function writePositionAtDistance(
  route: ReadonlyArray<GroundedSurfaceRoutePoint>,
  distance: number,
  up: THREE.Vector3,
  out: THREE.Vector3
): { distance: number; segmentIndex: number; segmentProgress: number } {
  if (route.length === 0) {
    out.set(0, 0, 0);
    return { distance: 0, segmentIndex: -1, segmentProgress: 0 };
  }
  if (route.length === 1) {
    out.copy(route[0].position);
    return { distance: 0, segmentIndex: 0, segmentProgress: 0 };
  }

  const total = groundedSurfaceRouteLength(route, up);
  const clampedDistance = Math.min(total, Math.max(0, distance));
  let remaining = clampedDistance;
  for (let index = 1; index < route.length; index++) {
    const a = route[index - 1].position;
    const b = route[index].position;
    _segment.copy(b).sub(a);
    const heightDelta = _segment.dot(up);
    _tangent.copy(_segment).addScaledVector(up, -heightDelta);
    let legLength = _tangent.length();
    if (legLength <= EPSILON) {
      _tangent.copy(_segment);
      legLength = _tangent.length();
    }
    if (remaining <= legLength || index === route.length - 1) {
      const progress = legLength > EPSILON ? clamp01(remaining / legLength) : 0;
      out.copy(a).addScaledVector(_tangent, progress);
      if (Math.abs(heightDelta) > EPSILON) {
        out.addScaledVector(up, heightDelta * stepHeightProgress(progress, heightDelta));
      }
      return {
        distance: clampedDistance,
        segmentIndex: index - 1,
        segmentProgress: progress
      };
    }
    remaining -= legLength;
  }

  out.copy(route[route.length - 1].position);
  return {
    distance: clampedDistance,
    segmentIndex: route.length - 2,
    segmentProgress: 1
  };
}

/**
 * Sample a grounded route with spatial heading look-ahead. The look-ahead rounds
 * cardinal A* corners over a few footsteps, so bodies turn through them rather
 * than snapping ninety degrees at a cell boundary.
 */
export function sampleGroundedSurfaceRoute(
  route: ReadonlyArray<GroundedSurfaceRoutePoint>,
  distance: number,
  up: THREE.Vector3,
  out: GroundedSurfaceSample = {
    position: new THREE.Vector3(),
    heading: new THREE.Vector3(),
    distance: 0,
    segmentIndex: -1,
    segmentProgress: 0
  },
  headingLookaheadWorld = VOXEL_SCALE * 1.25
): GroundedSurfaceSample {
  const placement = writePositionAtDistance(route, distance, up, out.position);
  out.distance = placement.distance;
  out.segmentIndex = placement.segmentIndex;
  out.segmentProgress = placement.segmentProgress;

  const lookahead = Math.max(VOXEL_SCALE * 0.25, headingLookaheadWorld);
  writePositionAtDistance(route, placement.distance - lookahead, up, _behind);
  writePositionAtDistance(route, placement.distance + lookahead, up, _ahead);
  out.heading.copy(_ahead).sub(_behind);
  out.heading.addScaledVector(up, -out.heading.dot(up));
  if (out.heading.lengthSq() <= EPSILON && placement.segmentIndex >= 0) {
    const a = route[placement.segmentIndex].position;
    const b = route[Math.min(route.length - 1, placement.segmentIndex + 1)].position;
    out.heading.copy(b).sub(a).addScaledVector(up, -out.heading.dot(up));
  }
  if (out.heading.lengthSq() > EPSILON) out.heading.normalize();
  return out;
}

/** Turn a face-tangent heading by no more than maxRadians, mutating current. */
export function turnGroundedHeadingToward(
  current: THREE.Vector3,
  target: THREE.Vector3,
  up: THREE.Vector3,
  maxRadians: number
): THREE.Vector3 {
  _currentHeading.copy(current).addScaledVector(up, -current.dot(up));
  _targetHeading.copy(target).addScaledVector(up, -target.dot(up));
  if (_targetHeading.lengthSq() <= EPSILON) return current;
  _targetHeading.normalize();
  if (_currentHeading.lengthSq() <= EPSILON || maxRadians <= 0) {
    if (_currentHeading.lengthSq() <= EPSILON) current.copy(_targetHeading);
    return current;
  }
  _currentHeading.normalize();
  const angle = Math.acos(THREE.MathUtils.clamp(_currentHeading.dot(_targetHeading), -1, 1));
  if (angle <= Math.max(0, maxRadians)) return current.copy(_targetHeading);
  _cross.crossVectors(_currentHeading, _targetHeading);
  const signed = Math.sign(_cross.dot(up)) || 1;
  return current.copy(_currentHeading)
    .applyAxisAngle(up, signed * Math.max(0, maxRadians))
    .addScaledVector(up, -current.dot(up))
    .normalize();
}
