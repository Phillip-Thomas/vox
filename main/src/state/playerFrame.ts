import * as THREE from 'three';

// The player's current local UP (outward from the planet), published each physics
// step by EfficientPlayer and read by SkyController / SpaceSky to drive LOCAL
// day/night (sunDir · up). Module-singleton, same pattern as getSunDirection.
// Defaults to +Y (top face) so non-player contexts (agent/overview cameras,
// headless) behave like the old world-Y model until a real up is published.

const _up = new THREE.Vector3(0, 1, 0);
const _pos = new THREE.Vector3(0, 0, 0);
// Camera look: surface-tangent forward (yaw) + pitch. Published by CameraControls,
// read by persistence (save) and seeded on restore so a reload faces the same way.
const _forward = new THREE.Vector3(0, 0, -1);
let _pitch = 0;

export function setPlayerUp(up: THREE.Vector3): void {
  if (up.lengthSq() > 1e-9) _up.copy(up).normalize();
}

export function getPlayerUp(): THREE.Vector3 {
  return _up;
}

// The player's current WORLD position, published each frame by EfficientPlayer.
// Read by non-Canvas code (e.g. the crafting panel placing a campfire at the
// player's feet). Returns a clone so callers can't mutate the singleton.
export function setPlayerWorldPosition(pos: THREE.Vector3): void {
  _pos.copy(pos);
}

export function getPlayerWorldPosition(): THREE.Vector3 {
  return _pos.clone();
}

export function setPlayerLook(forward: THREE.Vector3, pitch: number): void {
  if (forward.lengthSq() > 1e-9) _forward.copy(forward).normalize();
  _pitch = pitch;
}

export function getPlayerLook(): { forward: THREE.Vector3; pitch: number } {
  return { forward: _forward.clone(), pitch: _pitch };
}
