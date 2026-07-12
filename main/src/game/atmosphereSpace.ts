/**
 * Shared atmosphere ⇄ space transition band.
 *
 * ShipController's phase machine flips `descent`/`deep_space` at a discrete
 * altitude (with the mini-warp flash at its midpoint), but the ship keeps flying
 * normally through the whole warp — so anything CELESTIAL that keys off that
 * discrete flip (the star dome, the system companion bodies, the fog/light
 * grade) reads as "the sky warps with the player, then snaps back". Every
 * celestial representation instead blends on this continuous altitude signal,
 * so by the time the phase flag flips the picture has already converged and the
 * flip changes nothing visually.
 */

/** Flying DOWN past this altitude enters the atmosphere (mini-warp 'enter'). */
export const ATMOS_ENTER_ALTITUDE = 100;
/** Climbing UP past this altitude reaches space (mini-warp 'leave'). The gap
 *  from ATMOS_ENTER_ALTITUDE is hysteresis so the phase can't flap. */
export const ATMOS_LEAVE_ALTITUDE = 135;

/**
 * Blend starts exactly at the enter threshold: an 'enter' warp can only begin
 * once the blend has already settled at 0, and everything below it (the whole
 * on-surface/low-atmosphere experience) is untouched.
 */
export const ATMOSPHERE_SPACE_BLEND_START_ALTITUDE = ATMOS_ENTER_ALTITUDE;
/**
 * Blend completes shortly above the leave threshold, so a climbing ship reaches
 * the pure-space picture during the atmospheric veil without stretching the
 * transition across ordinary system cruise.
 */
export const ATMOSPHERE_SPACE_BLEND_END_ALTITUDE = 150;

export interface RenderPositionLike {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type SystemPositionTuple = readonly [number, number, number];

/**
 * Camera radius around the active planet, independent of the current floating
 * render origin. Render-space camera coordinates are first lifted into canonical
 * system space, then measured from the active planet center.
 */
export function planetLocalCameraRadius(
  cameraRenderPosition: RenderPositionLike,
  renderOrigin: SystemPositionTuple,
  planetSystemPosition: SystemPositionTuple
): number {
  return Math.hypot(
    cameraRenderPosition.x + renderOrigin[0] - planetSystemPosition[0],
    cameraRenderPosition.y + renderOrigin[1] - planetSystemPosition[1],
    cameraRenderPosition.z + renderOrigin[2] - planetSystemPosition[2]
  );
}

/**
 * 0 = fully inside the atmosphere band (sky-dome surrogates, day sky, surface
 * fog); 1 = fully in space (physical celestial placement, cosmos, no fog).
 * Smoothstepped and monotonic in altitude; pure and frame-rate independent.
 */
export function atmosphereSpaceBlend(cameraRadius: number, surfaceRadius: number): number {
  if (!Number.isFinite(cameraRadius) || !Number.isFinite(surfaceRadius)) return 0;
  const altitude = cameraRadius - surfaceRadius;
  const t = (altitude - ATMOSPHERE_SPACE_BLEND_START_ALTITUDE)
    / (ATMOSPHERE_SPACE_BLEND_END_ALTITUDE - ATMOSPHERE_SPACE_BLEND_START_ALTITUDE);
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}
