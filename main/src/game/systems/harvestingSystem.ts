// --- Harvesting (mined voxel -> resources) -----------------------------------
//
// The primary path is block/deposit based. Material harvesting remains only as a
// compatibility wrapper while the renderer still stores MaterialType for draw
// state.

import { MaterialType } from '../../types/materials.ts';
import { materialToLegacyBlock } from '../adapters.ts';
import { BLOCKS, type BlockId } from '../data/blocks.ts';
import { RESOURCES, type ResourceId } from '../data/resources.ts';
import type { ResourceDeposit } from '../generation/resourceDeposits.ts';
import { addResource } from './inventorySystem.ts';

export interface Drop {
  id: ResourceId;
  qty: number;
}

export interface HarvestVoxelInput {
  blockId: BlockId;
  deposit?: ResourceDeposit | null;
  toolTier?: number;
  bank?: boolean;
}

export interface HarvestResult {
  success: boolean;
  drops: Drop[];
  requiredToolTier: number;
  reason?: 'tool_tier';
}

/** Pure: which resources a block/deposit yields (no RNG). */
export function dropsForBlock(blockId: BlockId, deposit?: ResourceDeposit | null): ResourceId[] {
  const out: ResourceId[] = [];
  if (deposit) out.push(deposit.resourceId);
  for (const id of BLOCKS[blockId].drops) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** Pure: which resources a material's canonical block yields (legacy wrapper). */
export function dropsForMaterial(material: MaterialType): ResourceId[] {
  return dropsForBlock(materialToLegacyBlock(material));
}

export function requiredToolTierForVoxel(blockId: BlockId, deposit?: ResourceDeposit | null): number {
  const depositTier = deposit ? RESOURCES[deposit.resourceId].toolTier : 0;
  return Math.max(BLOCKS[blockId].toolTier, depositTier);
}

export function canHarvestVoxel(input: HarvestVoxelInput): boolean {
  return (input.toolTier ?? 0) >= requiredToolTierForVoxel(input.blockId, input.deposit);
}

export function harvestVoxel(input: HarvestVoxelInput): HarvestResult {
  const requiredToolTier = requiredToolTierForVoxel(input.blockId, input.deposit);
  if ((input.toolTier ?? 0) < requiredToolTier) {
    return {
      success: false,
      drops: [],
      requiredToolTier,
      reason: 'tool_tier'
    };
  }

  const drops: Drop[] = [];
  for (const id of dropsForBlock(input.blockId, input.deposit)) {
    const [lo, hi] = RESOURCES[id].yield;
    const rolled = lo + Math.floor(Math.random() * (hi - lo + 1));
    const richness = input.deposit?.resourceId === id ? input.deposit.richness : 1;
    const qty = Math.max(0, Math.round(rolled * richness));
    if (qty <= 0) continue;
    if (input.bank !== false) addResource(id, qty);
    drops.push({ id, qty });
  }

  return {
    success: true,
    drops,
    requiredToolTier
  };
}

// --- Mining time (hold-to-harvest) -------------------------------------------
//
// Breaking a voxel is NOT instant: it takes time proportional to the block's
// hardness, divided by how capable the tool is. A low-tier tool on a hard block
// is deliberately slow ("tools start bad"); each tool tier — and exceeding the
// block's required tier — speeds it up. Pure + tunable so the feel can be
// balanced without touching the player loop.
//
// Examples (BASE 2000): Iron Maw (t1) on stone ~1.1s, on copper ~2.4s;
// Void Maw (t4) on copper ~0.42s. A tool below the required tier returns
// Infinity (can never break it).
export const BASE_MINE_MS = 2000; // ms to break a hardness-1 block at tool tier 0
export const MIN_MINE_MS = 150;   // floor so top-tier mining still feels physical

export function mineDurationMs(input: HarvestVoxelInput): number {
  const required = requiredToolTierForVoxel(input.blockId, input.deposit);
  const tier = input.toolTier ?? 0;
  if (tier < required) return Infinity; // wrong tool — cannot break
  const hardness = BLOCKS[input.blockId].hardness;
  const tierSpeed = 1 + 0.8 * tier;              // better tool = faster
  const overBonus = 1 + 0.5 * (tier - required); // overkill tool = faster still
  return Math.max(MIN_MINE_MS, (hardness * BASE_MINE_MS) / (tierSpeed * overBonus));
}

/**
 * Legacy material wrapper. It grants a high tool tier so existing tests and
 * temporary material-based callers keep working during the block-first migration.
 */
export function harvestMaterial(material: MaterialType): Drop[] {
  return harvestVoxel({ blockId: materialToLegacyBlock(material), toolTier: 99 }).drops;
}
