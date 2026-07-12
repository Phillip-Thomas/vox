import { getLocalActorId, type ActorId } from '../game/playerActors.ts';

// Local effect state is published each physics step by EfficientPlayer and read
// by audio, fog, post FX, particles, and camera sway. It stays intentionally
// client-only. Actor-keyed state below is the multiplayer seam for vitals/pose
// and remote presentation; remote writes must not affect these local effects.

export interface PlayerSubmersionState {
  actorId: ActorId;
  submergence: number;
  depthBelow: number;
}

let localSubmergence = 0; // 0 = eye fully in air, 1 = eye fully underwater (smoothed)
let localDepthBelow = 0;  // metres the eye is below the sea surface (>= 0)
const playerSubmersions = new Map<ActorId, PlayerSubmersionState>();

// The RENDER camera's submersion — distinct from the character's eye whenever an
// external lens holds the camera away from the body (side/nav/iso rigs, the
// survey chart). Rendering + audio effects (fog, post, dome, particles, muffle)
// key on this; swim physics, oxygen, and the breath HUD stay on the character
// channel above.
let cameraSubmergence = 0;
let cameraDepthBelow = 0;

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function normalize(actorId: ActorId, submergence: number, depthBelow: number): PlayerSubmersionState {
  return {
    actorId,
    submergence: Math.max(0, Math.min(1, finite(submergence))),
    depthBelow: Math.max(0, finite(depthBelow))
  };
}

export function setPlayerSubmersion(actorId: ActorId, submergence: number, depthBelow: number): PlayerSubmersionState {
  const state = normalize(actorId, submergence, depthBelow);
  playerSubmersions.set(actorId, state);
  return state;
}

export function setLocalPlayerSubmersion(submergence: number, depthBelow: number): PlayerSubmersionState {
  const state = setPlayerSubmersion(getLocalActorId(), submergence, depthBelow);
  localSubmergence = state.submergence;
  localDepthBelow = state.depthBelow;
  return state;
}

export function setPlayerSubmerged(submergence: number, depthBelow: number): void {
  setLocalPlayerSubmersion(submergence, depthBelow);
}

export function getPlayerSubmersion(actorId: ActorId = getLocalActorId()): PlayerSubmersionState {
  return playerSubmersions.get(actorId) ?? normalize(actorId, 0, 0);
}

export function resetPlayerSubmersion(actorId?: ActorId): void {
  if (actorId) {
    playerSubmersions.delete(actorId);
    if (actorId === getLocalActorId()) {
      localSubmergence = 0;
      localDepthBelow = 0;
      cameraSubmergence = 0;
      cameraDepthBelow = 0;
    }
    return;
  }
  playerSubmersions.clear();
  localSubmergence = 0;
  localDepthBelow = 0;
  cameraSubmergence = 0;
  cameraDepthBelow = 0;
}

export function setCameraSubmersion(submergence: number, depthBelow: number): void {
  cameraSubmergence = Math.max(0, Math.min(1, finite(submergence)));
  cameraDepthBelow = Math.max(0, finite(depthBelow));
}

/** Smoothed 0..1: how far the RENDER CAMERA is below the water surface. */
export function getCameraSubmergence(): number {
  return cameraSubmergence;
}

/** Metres the render camera is below the sea surface (>= 0). */
export function getCameraDepthBelow(): number {
  return cameraDepthBelow;
}

/** Smoothed 0..1: how far the camera EYE is below the water surface. */
export function getPlayerSubmergence(): number {
  return localSubmergence;
}

/** Metres the eye is below the sea surface (>= 0), for fog/extinction falloff. */
export function getPlayerDepthBelow(): number {
  return localDepthBelow;
}

/** Convenience boolean: is the eye meaningfully underwater? */
export function isPlayerSubmerged(): boolean {
  return localSubmergence > 0.5;
}
