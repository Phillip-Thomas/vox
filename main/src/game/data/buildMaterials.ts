// --- Build materials (the material axis of every piece) ----------------------

import { ECONOMY_CATALOG } from './generatedEconomyCatalog.ts';
import type { ItemId, ItemStack } from './items.ts';
import { BUILD_PIECES, type BuildPieceType } from './buildPieces.ts';

export type BuildMaterialId = (typeof ECONOMY_CATALOG.buildMaterials)[number]['id'];

export interface BuildMaterialDef {
  id: BuildMaterialId;
  name: string;
  colorHex: number;
  resource: ItemId;
  costMul: number;
  hpMul: number;
  insulationMul: number;
}

export const BUILD_MATERIALS = Object.fromEntries(
  ECONOMY_CATALOG.buildMaterials.map(material => [
    material.id,
    { ...material } as BuildMaterialDef
  ])
) as Record<BuildMaterialId, BuildMaterialDef>;

export const ALL_BUILD_MATERIALS: BuildMaterialId[] = ECONOMY_CATALOG.buildMaterials.map(
  material => material.id
);

export function getBuildMaterial(id: BuildMaterialId): BuildMaterialDef {
  return BUILD_MATERIALS[id];
}

/** Resource cost to place one piece of `type` in `material`. */
export function pieceCost(type: BuildPieceType, material: BuildMaterialId): ItemStack[] {
  const definition = BUILD_MATERIALS[material];
  return [{
    id: definition.resource,
    qty: Math.max(1, Math.ceil(BUILD_PIECES[type].costUnits * definition.costMul))
  }];
}
