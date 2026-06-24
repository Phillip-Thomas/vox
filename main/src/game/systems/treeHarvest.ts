// --- Tree harvesting ---------------------------------------------------------
//
// Trees are NOT stored objects: TreeField derives one wherever a grass voxel's
// hash beats the tree density, and draws them as shared InstancedMeshes. So
// "harvesting a tree" can't remove a voxel — instead we record the tree's voxel
// coord in a harvested SET. TreeField folds `getTreeHarvestVersion()` into its
// rebuild signature and skips any harvested coord, so a felled tree disappears on
// the next rebuild. State is keyed by voxel coord (world-relative) — reset it on
// world swap (TreeField does, on terrainSeed change).
//
// Module-singleton, plain state (persistence-ready, same as inventory/maw).

import { addItem } from './inventorySystem.ts';

/** Hold-time feel for felling a tree (fed to computeMineDuration). */
export const TREE_HARDNESS = 1.2;
/** Trees are soft organic matter — any tool (incl. the tier-0 Faulty Maw) fells them. */
export const TREE_TOOL_TIER = 0;

const WOOD_MIN = 2;
const WOOD_MAX = 4;

const harvested = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

function key(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function isTreeHarvested(x: number, y: number, z: number): boolean {
  return harvested.has(key(x, y, z));
}

export function markTreeHarvested(x: number, y: number, z: number): void {
  if (!harvested.has(key(x, y, z))) {
    harvested.add(key(x, y, z));
    version++;
    emit();
  }
}

/** Bumped whenever the harvested set changes — TreeField watches this to rebuild. */
export function getTreeHarvestVersion(): number {
  return version;
}

/** Snapshot of harvested-tree coords (for persistence). */
export function getHarvestedTrees(): Array<[number, number, number]> {
  return [...harvested].map(k => k.split(',').map(Number) as [number, number, number]);
}

export function resetTreeHarvest(): void {
  if (harvested.size > 0) {
    harvested.clear();
    version++;
    emit();
  }
}

export function subscribeTreeHarvest(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Fell the tree at a voxel coord: mark it gone and bank the wood. */
export function harvestTree(x: number, y: number, z: number): { wood: number } {
  if (isTreeHarvested(x, y, z)) return { wood: 0 };
  markTreeHarvested(x, y, z);
  const wood = WOOD_MIN + Math.floor(Math.random() * (WOOD_MAX - WOOD_MIN + 1));
  addItem('wood', wood);
  return { wood };
}
