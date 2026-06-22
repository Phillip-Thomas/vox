import * as THREE from 'three';

// The player's current local UP (outward from the planet), published each physics
// step by EfficientPlayer and read by SkyController / SpaceSky to drive LOCAL
// day/night (sunDir · up). Module-singleton, same pattern as getSunDirection.
// Defaults to +Y (top face) so non-player contexts (agent/overview cameras,
// headless) behave like the old world-Y model until a real up is published.

const _up = new THREE.Vector3(0, 1, 0);

export function setPlayerUp(up: THREE.Vector3): void {
  if (up.lengthSq() > 1e-9) _up.copy(up).normalize();
}

export function getPlayerUp(): THREE.Vector3 {
  return _up;
}
