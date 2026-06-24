// --- Waterskin (carried water) -----------------------------------------------
//
// A tiny fill-level store (mirrors mawSystem). Owning the `waterskin` item lets you
// fill it at water and drink anywhere; the fill level lives here (0..MAX) and rides
// the GLOBAL save. Drinking from it routes through survivalVitals.drink.

import { drink } from './survivalVitals.ts';

export const MAX_WATERSKIN = 100;
let fill = 0;

const listeners = new Set<() => void>();
function emit() { listeners.forEach(l => l()); }

export function getWaterskinFill(): number { return fill; }

export function subscribeWaterskin(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Top up at a water source. */
export function fillWaterskin(amount = MAX_WATERSKIN): void {
  const next = Math.max(0, Math.min(MAX_WATERSKIN, fill + amount));
  if (next !== fill) { fill = next; emit(); }
}

/** Drink from the skin: drains up to `amount` of stored water into thirst.
 *  Returns the amount actually drunk (0 if empty). */
export function useWaterskin(amount = 40): number {
  const drunk = Math.min(fill, amount);
  if (drunk <= 0) return 0;
  fill -= drunk;
  drink(drunk);
  emit();
  return drunk;
}

/** Restore from a save (clamped). */
export function setWaterskinFill(n: number): void {
  fill = Math.max(0, Math.min(MAX_WATERSKIN, n));
  emit();
}

export function resetWaterskin(): void {
  fill = 0;
  emit();
}
