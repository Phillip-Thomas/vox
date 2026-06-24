// --- Build materials (the material axis of every piece) ----------------------
//
// Build pieces are material-AGNOSTIC: a Wall/Foundation/Stairs is one shape; the
// MATERIAL parameterizes its cost (which resource + how much), colour, and the
// structural/insulation stats. So adding thatch/stone later is pure data here — no
// change to the piece types or the build system. Wood ships first.

import type { ItemId, ItemStack } from './items.ts';
import { BUILD_PIECES, type BuildPieceType } from './buildPieces.ts';

export type BuildMaterialId = 'wood';

export interface BuildMaterialDef {
  id: BuildMaterialId;
  name: string;
  /** Albedo tint for the piece meshes. */
  colorHex: number;
  /** Resource spent (per cost-unit) to build with this material. */
  resource: ItemId;
  /** Multiplier on a piece's abstract costUnits → resource quantity. */
  costMul: number;
  hpMul: number;
  insulationMul: number;
}

export const BUILD_MATERIALS: Record<BuildMaterialId, BuildMaterialDef> = {
  wood: { id: 'wood', name: 'Wood', colorHex: 0x8a5a2c, resource: 'wood', costMul: 1, hpMul: 1, insulationMul: 1 }
  // thatch: { ...biofiber, cheap, weak, low insulation } — later
  // stone:  { ...stone, dear, strong, high insulation } — later
};

export const ALL_BUILD_MATERIALS = Object.keys(BUILD_MATERIALS) as BuildMaterialId[];

export function getBuildMaterial(id: BuildMaterialId): BuildMaterialDef {
  return BUILD_MATERIALS[id];
}

/** Resource cost to place one piece of `type` in `material`. */
export function pieceCost(type: BuildPieceType, material: BuildMaterialId): ItemStack[] {
  const m = BUILD_MATERIALS[material];
  return [{ id: m.resource, qty: Math.max(1, Math.ceil(BUILD_PIECES[type].costUnits * m.costMul)) }];
}
