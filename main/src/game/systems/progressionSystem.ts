// --- Progression (current era + reached milestones) --------------------------
//
// Module-singleton store (same pattern as inventory/maw): holds the player's
// current era and a set of reached milestone ids. The crafting/era logic advances
// it; the HUD and recipe gating read it. Plain JSON state, persistence-ready.
//
// Eras only ever move FORWARD (advanceEraTo ignores a lower target) so a milestone
// can't accidentally regress the player.

import { type EraId, eraRank } from '../data/eras.ts';

let currentEra: EraId = 'primitive';
const milestones = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

export function getCurrentEra(): EraId {
  return currentEra;
}

/** True if the player has reached `id` or a later era. */
export function isEraAtLeast(id: EraId): boolean {
  return eraRank(currentEra) >= eraRank(id);
}

/** Advance to `id` if it is strictly later than the current era. */
export function advanceEraTo(id: EraId): void {
  if (eraRank(id) > eraRank(currentEra)) {
    currentEra = id;
    emit();
  }
}

export function markMilestone(id: string): void {
  if (!milestones.has(id)) {
    milestones.add(id);
    emit();
  }
}

export function hasMilestone(id: string): boolean {
  return milestones.has(id);
}

export function resetProgression(): void {
  currentEra = 'primitive';
  milestones.clear();
  emit();
}

export function subscribeProgression(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
