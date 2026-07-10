import type * as THREE from 'three';

// --- Movie-mode player nudge -----------------------------------------------------
//
// The screening's last-resort unstick: when the autopilot has failed several
// break-out attempts against the same geometry, it requests a small teleport
// toward its goal. EfficientPlayer consumes this in its physics step — and ONLY
// while the autopilot is driving, so nothing here can ever move a real player.

let pending: THREE.Vector3 | null = null;

export function requestPlayerNudge(offset: THREE.Vector3): void {
  pending = offset.clone();
}

export function consumePlayerNudge(): THREE.Vector3 | null {
  const nudge = pending;
  pending = null;
  return nudge;
}
