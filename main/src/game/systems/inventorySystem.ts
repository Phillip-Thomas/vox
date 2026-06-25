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
import { getLocalActorId, type ActorId } from '../playerActors.ts';

type InventoryCounts = Partial<Record<ItemId, number>>;
export type InventorySnapshot = Record<ActorId, InventoryCounts>;

const inventories = new Map<ActorId, InventoryCounts>();
const listeners = new Set<() => void>();

function actorKey(actorId?: ActorId): ActorId {
  return actorId ?? getLocalActorId();
}

function inventoryFor(actorId?: ActorId): InventoryCounts {
  const key = actorKey(actorId);
  let counts = inventories.get(key);
  if (!counts) {
    counts = {};
    inventories.set(key, counts);
  }
  return counts;
}

function emit() {
  listeners.forEach(l => l());
}

export function addItem(id: ItemId, qty: number, actorId?: ActorId): void {
  if (qty <= 0) return;
  const counts = inventoryFor(actorId);
  counts[id] = (counts[id] ?? 0) + qty;
  emit();
}

/**
 * Remove `qty` of an item. Returns false (and changes nothing) if fewer than
 * `qty` are held — callers (crafting) rely on this all-or-nothing semantics.
 */
export function removeItem(id: ItemId, qty: number, actorId?: ActorId): boolean {
  if (qty <= 0) return true;
  const counts = inventoryFor(actorId);
  const have = counts[id] ?? 0;
  if (have < qty) return false;
  const left = have - qty;
  if (left <= 0) delete counts[id];
  else counts[id] = left;
  emit();
  return true;
}

export function getItemCount(id: ItemId, actorId?: ActorId): number {
  return inventoryFor(actorId)[id] ?? 0;
}

/** True only if every stack is fully covered by the current inventory. */
export function hasItems(stacks: ItemStack[], actorId?: ActorId): boolean {
  return stacks.every(s => getItemCount(s.id, actorId) >= s.qty);
}

export function getInventory(actorId?: ActorId): Partial<Record<ItemId, number>> {
  return { ...inventoryFor(actorId) };
}

export function totalItems(actorId?: ActorId): number {
  return Object.values(inventoryFor(actorId)).reduce((s, n) => s + (n ?? 0), 0);
}

export function resetInventory(actorId?: ActorId): void {
  const counts = inventoryFor(actorId);
  for (const k of Object.keys(counts)) delete counts[k as ItemId];
  emit();
}

export function resetAllInventories(): void {
  inventories.clear();
  emit();
}

export function getInventorySnapshot(): InventorySnapshot {
  const out: InventorySnapshot = {};
  for (const [actorId, counts] of inventories) out[actorId] = { ...counts };
  return out;
}

export function applyInventorySnapshot(snapshot: InventorySnapshot, options: { replace?: boolean } = {}): void {
  if (options.replace ?? true) inventories.clear();
  for (const [actorId, counts] of Object.entries(snapshot) as [ActorId, InventoryCounts][]) {
    inventories.set(actorId, { ...counts });
  }
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
export function addResource(id: ResourceId, qty: number, actorId?: ActorId): void {
  addItem(id, qty, actorId);
}

export function getResourceCount(id: ResourceId, actorId?: ActorId): number {
  return getItemCount(id, actorId);
}
