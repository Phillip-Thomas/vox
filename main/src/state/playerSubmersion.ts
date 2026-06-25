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
    }
    return;
  }
  playerSubmersions.clear();
  localSubmergence = 0;
  localDepthBelow = 0;
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
