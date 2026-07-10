// --- Cinematic look pull -------------------------------------------------------
//
// During staged sun events (the first dusk, the A3 dawn) the story briefly takes
// the camera: CameraControls' free-look path reads this weight each frame and,
// while it is > 0, steers the look toward the LIVE sun direction (the director
// drives the forced day phase, so the sun is exactly where the scene wants it).
// Mouse input keeps flowing underneath — as the weight decays, the player's own
// hand wins back the camera with no snap.

let weight = 0;

export function setCinematicLookWeight(value: number): void {
  weight = Math.min(1, Math.max(0, value));
}

export function getCinematicLookWeight(): number {
  return weight;
}
