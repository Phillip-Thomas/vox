// --- Harvesting (mined voxel -> resources) -----------------------------------
//
// Wraps the world edit: when a voxel is mined, resolve its BLOCK (via the legacy
// material adapter for now), roll the block's drops against each resource's yield
// range, and bank them in the inventory. Returns the drops for HUD feedback.
// Reads block/resource definitions only — no rendering logic.

import { MaterialType } from '../../types/materials.ts';
import { materialToLegacyBlock } from '../adapters.ts';
import { BLOCKS } from '../data/blocks.ts';
import { RESOURCES, type ResourceId } from '../data/resources.ts';
import { addResource } from './inventorySystem.ts';

export interface Drop {
  id: ResourceId;
  qty: number;
}

/** Pure: which resources a material's block yields (no RNG) — for tests/scanner. */
export function dropsForMaterial(material: MaterialType): ResourceId[] {
  return BLOCKS[materialToLegacyBlock(material)].drops;
}

/**
 * Harvest a mined voxel of `material`: roll each drop's yield range, bank it in
 * the inventory, and return what was obtained. Uses Math.random (runtime player
 * action — not part of deterministic world generation).
 */
export function harvestMaterial(material: MaterialType): Drop[] {
  const drops: Drop[] = [];
  for (const id of dropsForMaterial(material)) {
    const [lo, hi] = RESOURCES[id].yield;
    const qty = lo + Math.floor(Math.random() * (hi - lo + 1));
    if (qty <= 0) continue;
    addResource(id, qty);
    drops.push({ id, qty });
  }
  return drops;
}
