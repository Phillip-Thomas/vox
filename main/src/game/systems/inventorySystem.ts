// --- Inventory (runtime resource store) --------------------------------------
//
// Module-singleton store (same pattern as getJetpackFuel/getCrashFlash): harvested
// ResourceIds accumulate here; the HUD subscribes for live updates. Reads from the
// resource registry only via ids — no rendering/material knowledge.

import type { ResourceId } from '../data/resources.ts';

const counts: Partial<Record<ResourceId, number>> = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

export function addResource(id: ResourceId, qty: number): void {
  if (qty <= 0) return;
  counts[id] = (counts[id] ?? 0) + qty;
  emit();
}

export function getInventory(): Partial<Record<ResourceId, number>> {
  return { ...counts };
}

export function getResourceCount(id: ResourceId): number {
  return counts[id] ?? 0;
}

export function totalItems(): number {
  return Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
}

export function resetInventory(): void {
  for (const k of Object.keys(counts)) delete counts[k as ResourceId];
  emit();
}

/** Subscribe to inventory changes; returns an unsubscribe fn. */
export function subscribeInventory(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
