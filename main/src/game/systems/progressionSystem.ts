// --- Progression (current era + reached milestones) --------------------------
//
// Actor-keyed progression store. The default-local APIs preserve the original
// single-player call sites, while multiplayer can snapshot/replicate per-player
// era + milestone state independently of a world shard.
//
// Eras only ever move FORWARD (advanceEraTo ignores a lower target) so a milestone
// can't accidentally regress the player.

import { type EraId, eraRank } from '../data/eras.ts';
import { getLocalActorId, type ActorId } from '../playerActors.ts';

export interface ActorProgressionState {
  era: EraId;
  milestones: string[];
}

export type ProgressionSnapshot = Record<ActorId, ActorProgressionState>;

interface MutableActorProgressionState {
  era: EraId;
  milestones: Set<string>;
}

export const PROGRESSION_OWNERSHIP = {
  scope: 'per_player',
  persistence: 'global player state in offline single-player; server-owned player state in co-op',
  rationale: 'era and milestone unlocks follow the player inventory/loadout/Maw, not a planet shard'
} as const;

const progression = new Map<ActorId, MutableActorProgressionState>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

export function getCurrentEra(actorId?: ActorId): EraId {
  return stateFor(actorId).era;
}

/** True if the player has reached `id` or a later era. */
export function isEraAtLeast(id: EraId, actorId?: ActorId): boolean {
  return eraRank(stateFor(actorId).era) >= eraRank(id);
}

/** Advance to `id` if it is strictly later than the current era. */
export function advanceEraTo(id: EraId, actorId?: ActorId): void {
  const state = stateFor(actorId);
  if (eraRank(id) > eraRank(state.era)) {
    state.era = id;
    emit();
  }
}

export function markMilestone(id: string, actorId?: ActorId): void {
  const state = stateFor(actorId);
  if (!state.milestones.has(id)) {
    state.milestones.add(id);
    emit();
  }
}

export function hasMilestone(id: string, actorId?: ActorId): boolean {
  return stateFor(actorId).milestones.has(id);
}

/** Snapshot of reached milestone ids (for persistence). */
export function getMilestones(actorId?: ActorId): string[] {
  return [...stateFor(actorId).milestones];
}

export function resetProgression(actorId?: ActorId): void {
  if (actorId) progression.delete(actorId);
  else progression.clear();
  emit();
}

export function subscribeProgression(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getProgressionSnapshot(): ProgressionSnapshot {
  const out: ProgressionSnapshot = {};
  for (const [actorId, state] of progression) {
    out[actorId] = {
      era: state.era,
      milestones: [...state.milestones]
    };
  }
  return out;
}

export function applyProgressionSnapshot(snapshot: ProgressionSnapshot, options: { replace?: boolean } = {}): void {
  if (options.replace ?? true) progression.clear();
  for (const [actorId, state] of Object.entries(snapshot) as [ActorId, ActorProgressionState][]) {
    progression.set(actorId, {
      era: state.era ?? 'primitive',
      milestones: new Set(state.milestones ?? [])
    });
  }
  emit();
}

function actorKey(actorId?: ActorId): ActorId {
  return actorId ?? getLocalActorId();
}

function stateFor(actorId?: ActorId): MutableActorProgressionState {
  const key = actorKey(actorId);
  let state = progression.get(key);
  if (!state) {
    state = { era: 'primitive', milestones: new Set<string>() };
    progression.set(key, state);
  }
  return state;
}
