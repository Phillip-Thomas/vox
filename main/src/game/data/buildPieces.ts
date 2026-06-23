// --- Build pieces (shelter structure parts) ----------------------------------
//
// Prefab pieces snapped to the voxel grid as thin FACE PANELS (one cube-face in
// size, 2u×2u, thin). NOT inventory items — placing one consumes its resource cost
// directly (build mode has its own palette, separate from the Fabricator). Pieces
// attach foundation-first: a foundation sits on the top face of a solid voxel; walls
// and ceilings only attach to a cell that has a foundation.
//
// S1 ships WOOD only; thatch/stone are a later data-only tier (cost + colour + stats).

import type { ItemStack } from './items.ts';

export type BuildPieceType = 'foundation' | 'wall' | 'ceiling';

export interface BuildPieceDef {
  type: BuildPieceType;
  name: string;
  /** Resources consumed to place one (checked/spent against the inventory). */
  cost: ItemStack[];
  /** Structural HP (for future deconstruct/decay/integrity). */
  hp: number;
  /** Hazard insulation 0..1 — DESIGNED HOOK for the later survival layer. */
  insulation: number;
}

export const BUILD_PIECES: Record<BuildPieceType, BuildPieceDef> = {
  foundation: { type: 'foundation', name: 'Wood Foundation', cost: [{ id: 'wood', qty: 4 }], hp: 240, insulation: 0.35 },
  wall:       { type: 'wall',       name: 'Wood Wall',       cost: [{ id: 'wood', qty: 2 }], hp: 140, insulation: 0.5 },
  ceiling:    { type: 'ceiling',    name: 'Wood Ceiling',    cost: [{ id: 'wood', qty: 3 }], hp: 140, insulation: 0.5 }
};

/** Build-palette order (cycled with the number keys / select in build mode). */
export const BUILD_PIECE_ORDER: BuildPieceType[] = ['foundation', 'wall', 'ceiling'];

export function getBuildPiece(type: BuildPieceType): BuildPieceDef {
  return BUILD_PIECES[type];
}
