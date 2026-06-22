// Targeting readout: the voxel the player is currently looking at (set by a
// cheap voxel ray-march in EfficientPlayer, read by the HUD). Module-singleton so
// no per-frame React state churn.

import type { MaterialType } from '../../types/materials.ts';
import { materialToLegacyBlock } from '../adapters.ts';
import type { BlockId } from '../data/blocks.ts';
import type { ResourceDeposit } from '../generation/resourceDeposits.ts';

export interface LookedAtVoxel {
  material: MaterialType;
  blockId: BlockId;
  deposit: ResourceDeposit | null;
}

let lookedAt: LookedAtVoxel | null = null;

export function setLookedAtMaterial(material: MaterialType | null): void {
  lookedAt = material ? { material, blockId: materialToLegacyBlock(material), deposit: null } : null;
}

export function setLookedAtVoxel(voxel: LookedAtVoxel | null): void {
  lookedAt = voxel;
}

export function getLookedAtMaterial(): MaterialType | null {
  return lookedAt?.material ?? null;
}

export function getLookedAtVoxel(): LookedAtVoxel | null {
  return lookedAt;
}
