// --- Loose-stone pickup ------------------------------------------------------
//
// Small stones scattered on the ground that the player collects just by walking
// near them (no tool, no aim). They're the BOOTSTRAP for stone: the Faulty Maw
// can't break stone voxels (tier 0), so loose stones give the first `stone` needed
// to craft a Pickaxe — which can then mine stone/ore. Same shape as treeHarvest: a
// collected-coord Set + version that LooseStoneField folds into its rebuild
// signature so a picked-up stone vanishes. Reset on world swap.

import { addItem } from './inventorySystem.ts';
import { defaultSimulationRng, type SimulationRng } from '../rng.ts';
import type { ActorId } from '../playerActors.ts';

const STONE_MIN = 1;
const STONE_MAX = 2;

const collected = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

function key(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function isStoneCollected(x: number, y: number, z: number): boolean {
  return collected.has(key(x, y, z));
}

export function getStonePickupVersion(): number {
  return version;
}

/** Snapshot of collected-stone coords (for persistence). */
export function getCollectedStones(): Array<[number, number, number]> {
  return [...collected].map(k => k.split(',').map(Number) as [number, number, number]);
}

/** Mark a stone collected WITHOUT banking stone (for restoring a save — the
 *  inventory is restored separately). */
export function markStoneCollected(x: number, y: number, z: number): void {
  if (!collected.has(key(x, y, z))) {
    collected.add(key(x, y, z));
    version++;
    emit();
  }
}

export function unmarkStoneCollected(x: number, y: number, z: number): boolean {
  if (!collected.delete(key(x, y, z))) return false;
  version++;
  emit();
  return true;
}

export function resetStonePickup(): void {
  if (collected.size > 0) {
    collected.clear();
    version++;
    emit();
  }
}

export function subscribeStonePickup(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Collect the loose stone at a voxel coord: mark it gone and bank the stone. */
export function collectStone(x: number, y: number, z: number, rng: SimulationRng = defaultSimulationRng, actorId?: ActorId): number {
  if (collected.has(key(x, y, z))) return 0;
  collected.add(key(x, y, z));
  version++;
  emit();
  const n = rng.int(STONE_MIN, STONE_MAX);
  addItem('stone', n, actorId);
  return n;
}
