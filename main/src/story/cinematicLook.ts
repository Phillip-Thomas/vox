import type * as THREE from 'three';

// --- Cinematic look pull -------------------------------------------------------
//
// During staged sun events (the first dusk, the A3 dawn) the story briefly takes
// the camera: CameraControls' free-look path reads this weight each frame and,
// while it is > 0, steers the look toward a target — a WORLD POSITION when one
// is set (the autopilot aiming at the stone/tree/fire), else the LIVE sun
// direction (the director drives the forced day phase, so the sun is exactly
// where the scene wants it). Mouse input keeps flowing underneath — as the
// weight decays, the player's own hand wins back the camera with no snap.

let weight = 0;
let target: THREE.Vector3 | null = null;

export function setCinematicLookWeight(value: number): void {
  weight = Math.min(1, Math.max(0, value));
}

export function getCinematicLookWeight(): number {
  return weight;
}

/** World position to steer toward; null = the sun direction. */
export function setCinematicLookTarget(position: THREE.Vector3 | null): void {
  target = position;
}

export function getCinematicLookTarget(): THREE.Vector3 | null {
  return target;
}
