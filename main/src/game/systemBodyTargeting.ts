import type { PlanetAddress, PlanetDescriptor, Vec3Tuple } from './starSystem.ts';

export const DEFAULT_SYSTEM_BODY_AIM_CONE_RADIANS = Math.PI / 30; // 6 degrees

export interface ActiveBodyOcclusionBound {
  systemPosition: Vec3Tuple;
  radius: number;
}

export interface SystemBodyTargetingInput {
  cameraSystemPosition: Vec3Tuple;
  forward: Vec3Tuple;
  activePlanetId: string | null;
  bodies: readonly PlanetDescriptor[];
  aimConeRadians?: number;
  activeBodyOcclusionBound?: ActiveBodyOcclusionBound;
}

export interface SystemBodyTarget {
  address: PlanetAddress;
  worldId: string;
  /** Center-to-camera distance in canonical system units. */
  distance: number;
  /** Conservative apparent angular radius in radians. */
  angularRadius: number;
  /** Dot product of normalized camera-forward and body-center direction. */
  alignment: number;
}

interface Candidate extends SystemBodyTarget {
  direction: Vec3Tuple;
  centerAngle: number;
  silhouetteHit: boolean;
}

/**
 * Resolve the best visible sibling body without reading or mutating runtime state.
 * Candidates are silhouette-aware, analytically occulted, and deterministically
 * ordered so equivalent input produces the same lock on every frame.
 */
export function resolveSystemBodyTarget(input: SystemBodyTargetingInput): SystemBodyTarget | null {
  const camera = finiteTuple(input.cameraSystemPosition, 'cameraSystemPosition');
  const forward = normalized(input.forward, 'forward');
  const aimCone = input.aimConeRadians ?? DEFAULT_SYSTEM_BODY_AIM_CONE_RADIANS;
  if (!Number.isFinite(aimCone) || aimCone < 0 || aimCone > Math.PI / 2) {
    throw new Error('System-body aim cone must be a finite angle between 0 and PI/2.');
  }

  const candidates: Candidate[] = [];
  for (const body of input.bodies) {
    if (body.worldId === input.activePlanetId) continue;
    const offset = subtract(body.systemPosition, camera);
    const distance = length(offset);
    if (distance <= 1e-9) continue;
    const direction = scale(offset, 1 / distance);
    const alignment = dot(forward, direction);
    if (alignment <= 0) continue;

    const angularRadius = Math.asin(clamp(body.surfaceBoundRadius / distance, 0, 1));
    const centerAngle = Math.acos(clamp(alignment, -1, 1));
    if (centerAngle - angularRadius > aimCone) continue;

    const candidate: Candidate = {
      address: cloneAddress(body.address),
      worldId: body.worldId,
      distance,
      angularRadius,
      alignment,
      direction,
      centerAngle,
      silhouetteHit: centerAngle <= angularRadius
    };
    if (isOccluded(candidate, input, camera)) continue;
    candidates.push(candidate);
  }

  candidates.sort(compareCandidates);
  const best = candidates[0];
  if (!best) return null;
  return {
    address: best.address,
    worldId: best.worldId,
    distance: best.distance,
    angularRadius: best.angularRadius,
    alignment: best.alignment
  };
}

function isOccluded(
  candidate: Candidate,
  input: SystemBodyTargetingInput,
  camera: Vec3Tuple
): boolean {
  const activeBound = input.activeBodyOcclusionBound;
  if (
    activeBound &&
    rayHitsSphereBefore(camera, candidate.direction, candidate.distance, activeBound.systemPosition, activeBound.radius)
  ) {
    return true;
  }

  for (const blocker of input.bodies) {
    if (blocker.worldId === candidate.worldId || blocker.worldId === input.activePlanetId) continue;
    const blockerDistance = distanceBetween(camera, blocker.systemPosition);
    if (blockerDistance >= candidate.distance) continue;
    if (
      rayHitsSphereBefore(
        camera,
        candidate.direction,
        candidate.distance,
        blocker.systemPosition,
        blocker.surfaceBoundRadius
      )
    ) {
      return true;
    }
  }
  return false;
}

function rayHitsSphereBefore(
  origin: Vec3Tuple,
  direction: Vec3Tuple,
  maxDistance: number,
  center: Vec3Tuple,
  radius: number
): boolean {
  if (!Number.isFinite(radius) || radius <= 0) return false;
  const toCenter = subtract(center, origin);
  const projection = dot(toCenter, direction);
  const perpendicularSq = Math.max(0, dot(toCenter, toCenter) - projection * projection);
  const radiusSq = radius * radius;
  if (perpendicularSq > radiusSq) return false;
  const halfChord = Math.sqrt(radiusSq - perpendicularSq);
  const exit = projection + halfChord;
  if (exit <= 1e-9) return false;
  const entry = Math.max(0, projection - halfChord);
  return entry < maxDistance - 1e-9;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  if (a.silhouetteHit !== b.silhouetteHit) return a.silhouetteHit ? -1 : 1;
  const alignmentDelta = b.alignment - a.alignment;
  if (Math.abs(alignmentDelta) > 1e-12) return alignmentDelta;
  const distanceDelta = a.distance - b.distance;
  if (Math.abs(distanceDelta) > 1e-9) return distanceDelta;
  return a.worldId < b.worldId ? -1 : a.worldId > b.worldId ? 1 : 0;
}

function finiteTuple(value: Vec3Tuple, label: string): Vec3Tuple {
  if (value.length !== 3 || value.some(component => !Number.isFinite(component))) {
    throw new Error(`System-body ${label} must contain three finite numbers.`);
  }
  return [value[0], value[1], value[2]];
}

function normalized(value: Vec3Tuple, label: string): Vec3Tuple {
  const tuple = finiteTuple(value, label);
  const magnitude = length(tuple);
  if (magnitude <= 1e-9) throw new Error(`System-body ${label} cannot be zero-length.`);
  return scale(tuple, 1 / magnitude);
}

function cloneAddress(address: PlanetAddress): PlanetAddress {
  return {
    system: { x: address.system.x, y: address.system.y },
    slot: address.slot
  };
}

function distanceBetween(a: Vec3Tuple, b: Vec3Tuple): number {
  return length(subtract(a, b));
}

function subtract(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(value: Vec3Tuple, scalar: number): Vec3Tuple {
  return [value[0] * scalar, value[1] * scalar, value[2] * scalar];
}

function dot(a: Vec3Tuple, b: Vec3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(value: Vec3Tuple): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
