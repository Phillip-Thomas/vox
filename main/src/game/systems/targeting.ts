// Targeting readout: what the player is currently looking at (set by EfficientPlayer
// each frame, read by the HUD). Module-singleton so no per-frame React churn. Covers
// voxels AND the non-voxel harvestables (trees, loose stones) so all three get a
// crosshair label.

import type { MaterialType } from '../../types/materials.ts';
import { materialToLegacyBlock } from '../adapters.ts';
import type { BlockId } from '../data/blocks.ts';
import type { ResourceDeposit } from '../generation/resourceDeposits.ts';

export interface LookedAtVoxel {
  kind: 'voxel';
  material: MaterialType;
  blockId: BlockId;
  deposit: ResourceDeposit | null;
}

export type LookedAt =
  | LookedAtVoxel
  | { kind: 'tree' }
  | { kind: 'stone' };

let lookedAt: LookedAt | null = null;

export function setLookedAt(value: LookedAt | null): void {
  lookedAt = value;
}

export function getLookedAt(): LookedAt | null {
  return lookedAt;
}

// --- Back-compat voxel helpers ----------------------------------------------
export function setLookedAtVoxel(voxel: Omit<LookedAtVoxel, 'kind'> | null): void {
  lookedAt = voxel ? { kind: 'voxel', ...voxel } : null;
}

export function setLookedAtMaterial(material: MaterialType | null): void {
  lookedAt = material
    ? { kind: 'voxel', material, blockId: materialToLegacyBlock(material), deposit: null }
    : null;
}

export function getLookedAtVoxel(): LookedAtVoxel | null {
  return lookedAt?.kind === 'voxel' ? lookedAt : null;
}

export function getLookedAtMaterial(): MaterialType | null {
  return lookedAt?.kind === 'voxel' ? lookedAt.material : null;
}
