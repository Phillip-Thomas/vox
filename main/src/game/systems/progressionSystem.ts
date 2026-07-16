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

/**
 * Receipts produced exclusively by local presentation or embodied simulation.
 *
 * Co-op snapshots own economy, inventory, route, item, and settlement commits,
 * but the state server cannot observe camera alignment, rendered disclosures,
 * oxygen threshold crossings, the staged boarding camera handoff, or the Story
 * director's local beat checkpoints. Maw direction/resonance receipts are
 * server-owned in co-op even though their final visual proof remains local.
 * Keep this allow-list deliberately narrower
 * than `story:*`: server-owned `story:item:*`, `story:route:*`,
 * `story:salvage:*`, and most `story:tidegarden:*` facts must still be replaced
 * by authority.
 */
export const CLIENT_OWNED_MILESTONE_POLICY = Object.freeze({
  exact: Object.freeze([
    'story:started',
    'story:prologue-seen',
    'story:a1',
    'story:a2',
    'story:a3',
    'story:a4',
    'story:complete',
    'story:debris-stone-backfill:v2',
    'story:tone:low',
    'story:tone:high',
    'story:board:pressure-boundary-sealed',
    'story:board:physical-transaction-complete',
    'story:tidegarden:scanner-overload'
  ]),
  prefixes: Object.freeze([
    'story:ch1:',
    'story:ch2:',
    'story:ch3:',
    'story:ch4:',
    'story:ch5:',
    'story:ch6:',
    'story:ch7:',
    'story:ch8:',
    'story:ch9:',
    'story:sense:',
    'story:choice:',
    'story:name:',
    'story:musing:',
    'story:cell:',
    'story:debris:',
    'story:debris-scattered:',
    'story:pod:',
    'story:audit:',
    'story:comply:',
    'story:defy:',
    'story:a4:',
    'story:dive:',
    'story:capability:',
    'story:reconstruct:'
  ])
} as const);

const CLIENT_OWNED_MILESTONE_IDS = new Set<string>(CLIENT_OWNED_MILESTONE_POLICY.exact);

export function isClientOwnedMilestoneReceipt(milestone: string): boolean {
  return CLIENT_OWNED_MILESTONE_IDS.has(milestone)
    || CLIENT_OWNED_MILESTONE_POLICY.prefixes.some(prefix => milestone.startsWith(prefix));
}

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

/**
 * Exact rollback/migration seam for destructive replay and save repair.
 * Normal gameplay must continue to use `advanceEraTo`, which is monotonic.
 */
export function replaceEraForRollback(id: EraId, actorId?: ActorId): void {
  const state = stateFor(actorId);
  if (state.era === id) return;
  state.era = id;
  emit();
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

/** Exact rollback/migration seam. Normal progression remains monotonic. */
export function removeMilestone(id: string, actorId?: ActorId): boolean {
  if (!id) return false;
  const removed = stateFor(actorId).milestones.delete(id);
  if (removed) emit();
  return removed;
}

/** Snapshot of reached milestone ids (for persistence). */
export function getMilestones(actorId?: ActorId): string[] {
  return [...stateFor(actorId).milestones];
}

/** Remove one product-owned milestone namespace while preserving unrelated
 * progression. Story replay uses this instead of wiping sandbox achievements. */
export function removeMilestonesByPrefix(prefix: string, actorId?: ActorId): number {
  if (!prefix) return 0;
  const state = stateFor(actorId);
  let removed = 0;
  for (const milestone of state.milestones) {
    if (!milestone.startsWith(prefix)) continue;
    state.milestones.delete(milestone);
    removed++;
  }
  if (removed > 0) emit();
  return removed;
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

export function applyProgressionSnapshot(
  snapshot: ProgressionSnapshot,
  options: { replace?: boolean; preserveClientOwnedMilestones?: boolean } = {}
): void {
  const preservedClientReceipts = options.preserveClientOwnedMilestones
    ? new Map(
        [...progression].map(([actorId, state]) => [
          actorId,
          [...state.milestones].filter(isClientOwnedMilestoneReceipt)
        ] as const)
      )
    : null;
  if (options.replace ?? true) progression.clear();
  for (const [actorId, state] of Object.entries(snapshot) as [ActorId, ActorProgressionState][]) {
    const milestones = new Set(state.milestones ?? []);
    for (const receipt of preservedClientReceipts?.get(actorId) ?? []) milestones.add(receipt);
    progression.set(actorId, {
      era: state.era ?? 'primitive',
      milestones
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
