import { PLANET_SURFACE_BOUND_RADIUS } from './starSystem.ts';

/** Conservative p1-to-p2 separation: 3,300 + 4,600 plus quantization slack. */
export const MAX_LOCAL_SYSTEM_BODY_SEPARATION = 8_000;

/**
 * Flight camera depth budget. This leaves room behind every local body for the
 * remote-system marker layer while retaining a near plane of one world unit.
 */
export const LOCAL_SYSTEM_FLIGHT_CAMERA_FAR = 20_000;

/** Remote system markers occupy a stable background band behind local planets. */
export const REMOTE_SYSTEM_BASE_DISTANCE = 10_500;
export const REMOTE_SYSTEM_DISTANCE_PER_GRID = 500;
export const REMOTE_SYSTEM_DISTANCE_JITTER = 260;
export const REMOTE_SYSTEM_RADIUS_MIN = 6;
export const REMOTE_SYSTEM_RADIUS_MAX = 18;
export const REMOTE_SYSTEM_RADIUS_JITTER = 2;
export const REMOTE_SYSTEM_RING_SCALE = 1.75;
export const REMOTE_SYSTEM_RING_OUTER_SCALE = REMOTE_SYSTEM_RING_SCALE * 1.05;
export const REMOTE_SYSTEM_MAX_VISIBLE_MARKERS = 32;
export const REMOTE_SYSTEM_SURFACE_DETAIL = 2;
export const REMOTE_SYSTEM_CLOUD_DETAIL = 1;
export const REMOTE_SYSTEM_ATMOSPHERE_SEGMENTS = 16;
export const REMOTE_SYSTEM_ATMOSPHERE_RINGS = 8;
export const REMOTE_SYSTEM_RING_SEGMENTS = 40;

export function angularDiameterRadians(radius: number, centerDistance: number): number {
  if (!Number.isFinite(radius) || !Number.isFinite(centerDistance) || centerDistance <= 0) return 0;
  return 2 * Math.asin(Math.min(1, Math.max(0, radius) / centerDistance));
}

/** Worst-case full marker envelope, including a resolved ring. */
export function maxRemoteSystemAngularDiameter(): number {
  const nearestCenterDistance = REMOTE_SYSTEM_BASE_DISTANCE + REMOTE_SYSTEM_DISTANCE_PER_GRID;
  const maximumSurfaceRadius = REMOTE_SYSTEM_RADIUS_MAX + REMOTE_SYSTEM_RADIUS_JITTER;
  return angularDiameterRadians(
    maximumSurfaceRadius * REMOTE_SYSTEM_RING_OUTER_SCALE,
    nearestCenterDistance
  );
}

/** Smallest local companion silhouette from any active planet slot. */
export function minLocalPlanetAngularDiameter(): number {
  return angularDiameterRadians(
    PLANET_SURFACE_BOUND_RADIUS,
    MAX_LOCAL_SYSTEM_BODY_SEPARATION
  );
}

/** Conservative all-markers-visible triangle budget for the unresolved tier. */
export function remoteSystemProxyTriangleBudget(): number {
  const icosahedronTriangles = (detail: number) => 20 * 4 ** detail;
  const perMarker = icosahedronTriangles(REMOTE_SYSTEM_SURFACE_DETAIL)
    + icosahedronTriangles(REMOTE_SYSTEM_CLOUD_DETAIL)
    + REMOTE_SYSTEM_ATMOSPHERE_SEGMENTS * 2 * (REMOTE_SYSTEM_ATMOSPHERE_RINGS - 1)
    + REMOTE_SYSTEM_RING_SEGMENTS * 2;
  // At most one otherwise-hidden targeting reticle is visible.
  return perMarker * REMOTE_SYSTEM_MAX_VISIBLE_MARKERS + REMOTE_SYSTEM_RING_SEGMENTS * 2;
}
