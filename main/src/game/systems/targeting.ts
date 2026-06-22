// Targeting readout: the material the player is currently looking at (set by a
// cheap voxel ray-march in EfficientPlayer, read by the HUD). Module-singleton so
// no per-frame React state churn.

import type { MaterialType } from '../../types/materials.ts';

let lookedAt: MaterialType | null = null;

export function setLookedAtMaterial(material: MaterialType | null): void {
  lookedAt = material;
}

export function getLookedAtMaterial(): MaterialType | null {
  return lookedAt;
}
