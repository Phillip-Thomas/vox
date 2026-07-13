// Lava immersion is published each physics step by EfficientPlayer and read by
// the HUD heat vignette (and any future audio/post hooks). Like playerSubmersion,
// it stays intentionally client-only — remote writes must never touch it.
//
// Unlike water (an EYE test — you can wade dry-chested), lava counts from the
// FEET: the melt has you the moment you step in. `immersion` is the smoothed
// 0..1 hold the melt has on the BODY (damage alarm — shows even when an external
// lens holds the camera elsewhere, like the health bar); `feetInLava` is the raw
// cell test that drives damage ticks; `cameraInLava` is the RENDER camera inside
// a lava cell — the molten-wash channel, kept separate from the body exactly
// like cameraSubmergence, so a burning character can't black out a dry overhead
// chart or side-lens view. (The voxel mesh has no interior faces, so the wash
// overlay IS the "inside lava" view.)

let immersion = 0;
let feetInLava = false;
let cameraInLava = false;

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

export function setLocalLavaImmersion(nextImmersion: number, nextFeetInLava: boolean, nextCameraInLava: boolean): void {
  immersion = clamp01(nextImmersion);
  feetInLava = nextFeetInLava;
  cameraInLava = nextCameraInLava;
}

/** Smoothed 0..1: how firm a hold the melt has on the body's movement. */
export function getLavaImmersion(): number {
  return immersion;
}

/** Raw feet-cell test — the damage-over-time trigger. */
export function isFeetInLava(): boolean {
  return feetInLava;
}

/** Is the RENDER camera inside a lava cell? Drives the molten wash overlay. */
export function isCameraInLava(): boolean {
  return cameraInLava;
}

export function resetLavaImmersion(): void {
  immersion = 0;
  feetInLava = false;
  cameraInLava = false;
}
