// --- Flora harvesting -------------------------------------------------------
//
// One procedural flora plant may occupy a surface voxel. Collection is therefore
// coord-exclusive even though the plant kind travels with the command/event to
// select its canonical drop. The plain coord set matches the existing world
// resource-marker persistence shape and keeps rendering decoupled from inventory.

import { FLORA_HARVEST, type FloraHarvestKind } from '../data/floraHarvest.ts';
import type { ItemStack } from '../data/items.ts';
import type { ActorId } from '../playerActors.ts';
import { defaultSimulationRng, type SimulationRng } from '../rng.ts';
import { addItem } from './inventorySystem.ts';

const harvested = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function key(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function isFloraHarvested(x: number, y: number, z: number): boolean {
  return harvested.has(key(x, y, z));
}

export function getFloraHarvestVersion(): number {
  return version;
}

export function getHarvestedFlora(): Array<[number, number, number]> {
  return [...harvested].map(value => value.split(',').map(Number) as [number, number, number]);
}

/** Restore/replicate a marker without granting its inventory drop again. */
export function markFloraHarvested(x: number, y: number, z: number): void {
  const coord = key(x, y, z);
  if (harvested.has(coord)) return;
  harvested.add(coord);
  version++;
  emit();
}

export function unmarkFloraHarvested(x: number, y: number, z: number): boolean {
  if (!harvested.delete(key(x, y, z))) return false;
  version++;
  emit();
  return true;
}

export function resetFloraHarvest(): void {
  if (harvested.size === 0) return;
  harvested.clear();
  version++;
  emit();
}

export function subscribeFloraHarvest(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function collectFlora(
  x: number,
  y: number,
  z: number,
  kind: FloraHarvestKind,
  rng: SimulationRng = defaultSimulationRng,
  actorId?: ActorId
): ItemStack | null {
  const coord = key(x, y, z);
  if (harvested.has(coord)) return null;

  const definition = FLORA_HARVEST[kind];
  const qty = rng.int(definition.quantity[0], definition.quantity[1]);
  harvested.add(coord);
  version++;
  emit();
  addItem(definition.itemId, qty, actorId);
  return { id: definition.itemId, qty };
}
