// --- Inventory (runtime item store) ------------------------------------------
//
// Module-singleton store (same pattern as getJetpackFuel/getCrashFlash): held
// items accumulate here and the HUD subscribes for live updates. Generalized from
// ResourceId to ItemId so it holds raw resources AND crafted goods (refined,
// components, tools, suits, modules) — see data/items.ts. The harvest path keeps
// using the `addResource`/`getResourceCount` aliases, so it is untouched.
//
// State is plain JSON (Partial<Record<ItemId, number>>) on purpose: a persistence
// layer (keyed by GENERATION_SCHEMA_VERSION) drops in later with no shape change.

import type { ItemId } from '../data/items.ts';
import type { ItemStack } from '../data/items.ts';
import type { ResourceId } from '../data/resources.ts';

const counts: Partial<Record<ItemId, number>> = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

export function addItem(id: ItemId, qty: number): void {
  if (qty <= 0) return;
  counts[id] = (counts[id] ?? 0) + qty;
  emit();
}

/**
 * Remove `qty` of an item. Returns false (and changes nothing) if fewer than
 * `qty` are held — callers (crafting) rely on this all-or-nothing semantics.
 */
export function removeItem(id: ItemId, qty: number): boolean {
  if (qty <= 0) return true;
  const have = counts[id] ?? 0;
  if (have < qty) return false;
  const left = have - qty;
  if (left <= 0) delete counts[id];
  else counts[id] = left;
  emit();
  return true;
}

export function getItemCount(id: ItemId): number {
  return counts[id] ?? 0;
}

/** True only if every stack is fully covered by the current inventory. */
export function hasItems(stacks: ItemStack[]): boolean {
  return stacks.every(s => getItemCount(s.id) >= s.qty);
}

export function getInventory(): Partial<Record<ItemId, number>> {
  return { ...counts };
}

export function totalItems(): number {
  return Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
}

export function resetInventory(): void {
  for (const k of Object.keys(counts)) delete counts[k as ItemId];
  emit();
}

/** Subscribe to inventory changes; returns an unsubscribe fn. */
export function subscribeInventory(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// --- Back-compat aliases (harvest path & existing callers) -------------------
// ResourceId ⊆ ItemId, so these are exact behavioural aliases with a narrower
// (resource-only) type at the call site.
export function addResource(id: ResourceId, qty: number): void {
  addItem(id, qty);
}

export function getResourceCount(id: ResourceId): number {
  return getItemCount(id);
}
