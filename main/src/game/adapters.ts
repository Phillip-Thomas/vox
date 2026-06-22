// --- Compatibility adapters (the ONE seam between new model and old render) ----
//
// Temporary scaffolding, NOT a second engine. New systems are the source of truth;
// MaterialType is a PROJECTION. All conversions live HERE so no other file mixes
// the models. Exit condition: once terrain emits BlockIds and rendering consumes
// `blockToRenderMaterial` directly, `materialToLegacyBlock` (the reverse hack)
// can be deleted.

import { MaterialType } from '../types/materials.ts';
import { BLOCKS, CANONICAL_BLOCK_FOR_MATERIAL, type BlockId } from './data/blocks.ts';

/** Block → how it renders. The forward projection (keeps MaterialType render-only). */
export function blockToRenderMaterial(blockId: BlockId): MaterialType {
  return BLOCKS[blockId].renderMaterial;
}

/**
 * Legacy MaterialType → its canonical Block. Reverse adapter for the migration
 * window, while terrain still emits MaterialType. Remove once generation is
 * block-first.
 */
export function materialToLegacyBlock(material: MaterialType): BlockId {
  return CANONICAL_BLOCK_FOR_MATERIAL[material] ?? 'stone';
}
