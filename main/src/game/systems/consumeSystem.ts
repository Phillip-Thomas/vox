// --- Waterskin (carried water) -----------------------------------------------
//
// A tiny fill-level store (mirrors mawSystem). Owning the `waterskin` item lets you
// fill it at water and drink anywhere; the fill level lives here (0..MAX) and rides
// the GLOBAL save. Drinking from it routes through survivalVitals.drink.

import { drink } from './survivalVitals.ts';
import { getLocalActorId, type ActorId } from '../playerActors.ts';

export const MAX_WATERSKIN = 100;
const fills = new Map<ActorId, number>();
export type WaterskinSnapshot = Record<ActorId, number>;

const listeners = new Set<() => void>();
function emit() { listeners.forEach(l => l()); }

function actorKey(actorId?: ActorId): ActorId {
  return actorId ?? getLocalActorId();
}

function fillFor(actorId?: ActorId): number {
  return fills.get(actorKey(actorId)) ?? 0;
}

function setFillFor(actorId: ActorId | undefined, n: number): void {
  fills.set(actorKey(actorId), Math.max(0, Math.min(MAX_WATERSKIN, n)));
}

export function getWaterskinFill(actorId?: ActorId): number { return fillFor(actorId); }

export function subscribeWaterskin(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Top up at a water source. */
export function fillWaterskin(amount = MAX_WATERSKIN, actorId?: ActorId): void {
  const fill = fillFor(actorId);
  const next = Math.max(0, Math.min(MAX_WATERSKIN, fill + amount));
  if (next !== fill) { setFillFor(actorId, next); emit(); }
}

/** Drink from the skin: drains up to `amount` of stored water into thirst.
 *  Returns the amount actually drunk (0 if empty). */
export function useWaterskin(amount = 40, actorId?: ActorId): number {
  const fill = fillFor(actorId);
  const drunk = Math.min(fill, amount);
  if (drunk <= 0) return 0;
  setFillFor(actorId, fill - drunk);
  drink(drunk, actorId);
  emit();
  return drunk;
}

/** Restore from a save (clamped). */
export function setWaterskinFill(n: number, actorId?: ActorId): void {
  setFillFor(actorId, n);
  emit();
}

export function resetWaterskin(actorId?: ActorId): void {
  setFillFor(actorId, 0);
  emit();
}

export function resetAllWaterskins(): void {
  fills.clear();
  emit();
}

export function getWaterskinSnapshot(): WaterskinSnapshot {
  return Object.fromEntries(fills) as WaterskinSnapshot;
}

export function applyWaterskinSnapshot(snapshot: WaterskinSnapshot, options: { replace?: boolean } = {}): void {
  if (options.replace ?? true) fills.clear();
  for (const [actorId, amount] of Object.entries(snapshot) as [ActorId, number][]) {
    setFillFor(actorId, amount);
  }
  emit();
}
