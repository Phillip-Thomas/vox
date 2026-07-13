// --- Forage pickup -----------------------------------------------------------
//
// Edible plants scattered on the ground, collected by walking near (no tool/aim) —
// the FOOD bootstrap (mirrors loose stones / treeHarvest). A collected-coord Set +
// version that ForageField folds into its rebuild signature so a picked node
// vanishes. Each node yields berries or a starch root. Reset/loaded per world.

import { addItem } from './inventorySystem.ts';
import type { ItemId } from '../data/items.ts';
import { defaultSimulationRng, type SimulationRng } from '../rng.ts';
import type { ActorId } from '../playerActors.ts';
import { seededVoxelUnit } from '../../utils/seededHash.ts';

export type ForageKind = 'berry' | 'root' | 'deadwood';
export const DEADWOOD_BASE = 0.022;
export const FORAGE_HASH_SALT = 32;
// Grass densityMul is bounded to 0.45..1.8, and the forage base is 0.04.
// Excluding every possible food hash keeps deadwood and food mutually exclusive,
// so multiplayer authority can derive deadwood kind without trusting the client.
export const FORAGE_MAX_DENSITY = 0.04 * 1.8;
const DEADWOOD_SALT = 35;

export function isDeadwoodNode(x: number, y: number, z: number, seed: number): boolean {
  return seededVoxelUnit(x, y, z, DEADWOOD_SALT, seed) < DEADWOOD_BASE
    && seededVoxelUnit(x, y, z, FORAGE_HASH_SALT, seed) >= FORAGE_MAX_DENSITY;
}

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

export function unmarkForageCollected(x: number, y: number, z: number): boolean {
  if (!collected.delete(key(x, y, z))) return false;
  version++;
  emit();
  return true;
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

/** Collect a ground node: food, or a sparse deadwood fallback whose gameplay
 *  availability is independent of decorative tree quality. */
export function collectForage(
  x: number,
  y: number,
  z: number,
  kind: ForageKind,
  rng: SimulationRng = defaultSimulationRng,
  actorId?: ActorId
): { id: ItemId; qty: number } | null {
  if (collected.has(key(x, y, z))) return null;
  collected.add(key(x, y, z));
  version++;
  emit();
  if (kind === 'deadwood') { addItem('wood', 2, actorId); return { id: 'wood', qty: 2 }; }
  if (kind === 'root') { addItem('root', 1, actorId); return { id: 'root', qty: 1 }; }
  const n = rng.int(1, 2); // 1-2 berries
  addItem('berry', n, actorId);
  return { id: 'berry', qty: n };
}
