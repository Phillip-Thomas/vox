// The player's current submersion state — published each physics step by
// EfficientPlayer and read by audio (muffle), SkyController (underwater fog),
// PostFX (underwater pass), the underwater particles, and the camera sway. This is
// the SINGLE SOURCE OF TRUTH so every effect stays phase-locked to the same
// waterline (the #1 thing that breaks the underwater illusion is effects
// disagreeing about where the surface is). Module-singleton, same pattern as
// playerFrame.ts — computed once per physics step, read everywhere, no extra work.

let _submergence = 0; // 0 = eye fully in air, 1 = eye fully underwater (smoothed)
let _depthBelow = 0;  // metres the eye is below the sea surface (>= 0)

export function setPlayerSubmerged(submergence: number, depthBelow: number): void {
  _submergence = submergence;
  _depthBelow = depthBelow;
}

/** Smoothed 0..1: how far the camera EYE is below the water surface. */
export function getPlayerSubmergence(): number {
  return _submergence;
}

/** Metres the eye is below the sea surface (>= 0), for fog/extinction falloff. */
export function getPlayerDepthBelow(): number {
  return _depthBelow;
}

/** Convenience boolean: is the eye meaningfully underwater? */
export function isPlayerSubmerged(): boolean {
  return _submergence > 0.5;
}
