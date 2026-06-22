import * as THREE from 'three';

// --- Local day/night model ("chase the light") -------------------------------
//
// Day/night is SPATIAL, not global: the sun lights the hemisphere facing it, and
// the boundary (the terminator) sweeps as the sun rotates AND as the player moves
// around the planet. A location's daylight is the sun's elevation relative to the
// LOCAL up (sunDir · up), NOT world-Y — so the sun rises/sets on your own horizon,
// the visible sun/moon line up with the lighting on every face, and you can walk
// toward the sub-solar point to chase daylight (or the anti-solar point for dark)
// and never be permanently stuck in either.
//
// Centralized + pure so SkyController (lights/fog), SpaceSky (dome), and tests all
// share ONE definition (they previously duplicated the world-Y math, which drifted).

/** Sun elevation relative to a local up: +1 overhead (noon), 0 horizon (the
 *  terminator / dawn-dusk), −1 underfoot (midnight). Inputs assumed ~unit. */
export function localSunElevation(sunDir: THREE.Vector3, up: THREE.Vector3): number {
  return sunDir.dot(up);
}

/** Daylight 0..1 from an elevation (0 below the horizon → 1 sun well up). */
export function daylightFromElevation(elevation: number): number {
  return THREE.MathUtils.smoothstep(elevation, -0.12, 0.18);
}

/** Golden-hour factor 0..1 — peaks as the sun sits near the local horizon by day. */
export function goldenFromElevation(elevation: number): number {
  const daylight = daylightFromElevation(elevation);
  return daylight * (1 - THREE.MathUtils.smoothstep(elevation, 0.05, 0.32));
}

/** Convenience: daylight directly from sun direction + local up. */
export function localDaylight(sunDir: THREE.Vector3, up: THREE.Vector3): number {
  return daylightFromElevation(localSunElevation(sunDir, up));
}

/** Convenience: golden directly from sun direction + local up. */
export function localGolden(sunDir: THREE.Vector3, up: THREE.Vector3): number {
  return goldenFromElevation(localSunElevation(sunDir, up));
}
