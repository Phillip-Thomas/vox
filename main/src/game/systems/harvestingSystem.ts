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

/**
 * Legacy material wrapper. It grants a high tool tier so existing tests and
 * temporary material-based callers keep working during the block-first migration.
 */
export function harvestMaterial(material: MaterialType): Drop[] {
  return harvestVoxel({ blockId: materialToLegacyBlock(material), toolTier: 99 }).drops;
}
