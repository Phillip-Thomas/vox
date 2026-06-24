// --- Forage pickup -----------------------------------------------------------
//
// Edible plants scattered on the ground, collected by walking near (no tool/aim) —
// the FOOD bootstrap (mirrors loose stones / treeHarvest). A collected-coord Set +
// version that ForageField folds into its rebuild signature so a picked node
// vanishes. Each node yields berries or a starch root. Reset/loaded per world.

import { addItem } from './inventorySystem.ts';
import type { ItemId } from '../data/items.ts';

const collected = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function emit() { listeners.forEach(l => l()); }
function key(x: number, y: number, z: number): string { return `${x},${y},${z}`; }

export function isForageCollected(x: number, y: number, z: number): boolean {
  return collected.has(key(x, y, z));
}

export function getForagePickupVersion(): number { return version; }

/** Snapshot of collected-forage coords (for persistence). */
export function getCollectedForage(): Array<[number, number, number]> {
  return [...collected].map(k => k.split(',').map(Number) as [number, number, number]);
}

/** Mark collected WITHOUT banking (for restoring a save — inventory restored separately). */
export function markForageCollected(x: number, y: number, z: number): void {
  if (!collected.has(key(x, y, z))) {
    collected.add(key(x, y, z));
    version++;
    emit();
  }
}

export function resetForagePickup(): void {
  if (collected.size > 0) {
    collected.clear();
    version++;
    emit();
  }
}

export function subscribeForagePickup(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Collect a forage node: mark gone + bank its yield. `kind` (decided by the field
 *  from a seeded hash) picks berries vs a root. Returns the granted stack, or null. */
export function collectForage(x: number, y: number, z: number, kind: 'berry' | 'root'): { id: ItemId; qty: number } | null {
  if (collected.has(key(x, y, z))) return null;
  collected.add(key(x, y, z));
  version++;
  emit();
  if (kind === 'root') { addItem('root', 1); return { id: 'root', qty: 1 }; }
  const n = 1 + Math.floor(Math.random() * 2); // 1-2 berries
  addItem('berry', n);
  return { id: 'berry', qty: n };
}
