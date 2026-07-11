// --- Spawn settle -------------------------------------------------------------------
//
// The world loads ASYNCHRONOUSLY under the player: terrain colliders stream in
// around the spawn a beat after the scene mounts. Until the ground under the
// player is REAL, EfficientPlayer pins the body at its spawn pose (no gravity
// steps, no falling through a world that isn't there yet) and this flag stays
// false. Consumers: the story director holds the descent cutscene on it, and
// the movie autopilot won't push (or rescue-nudge) an unsettled player.
//
// Module singleton, reset by EfficientPlayer on every mount (world swaps
// remount the player). Sandbox-safe: it gates nothing outside the player's own
// spawn guard unless story code chooses to read it.

let settled = false;

export function markSpawnSettled(): void {
  settled = true;
}

export function resetSpawnSettle(): void {
  settled = false;
}

export function isSpawnSettled(): boolean {
  return settled;
}
