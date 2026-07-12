import { PLANET_SURFACE_BOUND_RADIUS } from './starSystem.ts';

/** Conservative p1-to-p2 separation: 3,300 + 4,600 plus quantization slack. */
export const MAX_LOCAL_SYSTEM_BODY_SEPARATION = 8_000;

/**
 * Flight camera depth budget. This leaves room behind every local body for the
 * remote-system marker layer while retaining a near plane of one world unit.
 */
export const LOCAL_SYSTEM_FLIGHT_CAMERA_FAR = 20_000;

/** Remote system sun markers occupy a stable background band behind local planets. */
export const REMOTE_SYSTEM_BASE_DISTANCE = 10_500;
export const REMOTE_SYSTEM_DISTANCE_PER_GRID = 500;
export const REMOTE_SYSTEM_DISTANCE_JITTER = 260;
export const REMOTE_SYSTEM_RADIUS_MIN = 18;
export const REMOTE_SYSTEM_RADIUS_MAX = 34;
export const REMOTE_SYSTEM_RADIUS_JITTER = 3;
/**
 * Remote systems render as SUN GLINTS, not planet discs: a white-hot additive
 * core with a wide soft halo and cross-flares, colored by the system's
 * deterministic StarProfile. The glow billboard's half-extent is core radius x
 * this scale. The hierarchy gate is two-tiered: the CORE silhouette (the only
 * part that could be mistaken for a body) stays 3x smaller than any local
 * planet, while the translucent halo is allowed real presence (capped below)
 * — a bright glow with flares reads as a distant light source, categorically
 * unlike a textured planet disc, so prominence does not confuse the tiers.
 */
export const REMOTE_SYSTEM_GLOW_SCALE = 6.5;
/** Hard cap on the halo's angular envelope (degrees) at its nearest/biggest. */
export const REMOTE_SYSTEM_MAX_HALO_DEGREES = 3;
export const REMOTE_SYSTEM_MAX_VISIBLE_MARKERS = 32;
export const REMOTE_SYSTEM_LOCK_RING_SEGMENTS = 48;

export function angularDiameterRadians(radius: number, centerDistance: number): number {
  if (!Number.isFinite(radius) || !Number.isFinite(centerDistance) || centerDistance <= 0) return 0;
  return 2 * Math.asin(Math.min(1, Math.max(0, radius) / centerDistance));
}

/** Worst-case hard CORE silhouette — the sun's "body". */
export function maxRemoteSystemCoreAngularDiameter(): number {
  const nearestCenterDistance = REMOTE_SYSTEM_BASE_DISTANCE + REMOTE_SYSTEM_DISTANCE_PER_GRID;
  const maximumCoreRadius = REMOTE_SYSTEM_RADIUS_MAX + REMOTE_SYSTEM_RADIUS_JITTER;
  return angularDiameterRadians(maximumCoreRadius, nearestCenterDistance);
}

/** Worst-case full marker envelope, including the entire translucent halo. */
export function maxRemoteSystemAngularDiameter(): number {
  const nearestCenterDistance = REMOTE_SYSTEM_BASE_DISTANCE + REMOTE_SYSTEM_DISTANCE_PER_GRID;
  const maximumCoreRadius = REMOTE_SYSTEM_RADIUS_MAX + REMOTE_SYSTEM_RADIUS_JITTER;
  return angularDiameterRadians(
    maximumCoreRadius * REMOTE_SYSTEM_GLOW_SCALE,
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
  // One instanced billboard quad per sun glint (single draw for the layer),
  // plus at most one otherwise-hidden targeting reticle ring.
  const quadTriangles = 2;
  return quadTriangles * REMOTE_SYSTEM_MAX_VISIBLE_MARKERS
    + REMOTE_SYSTEM_LOCK_RING_SEGMENTS * 2;
}
