import { describe, expect, it } from 'vitest';
import { ALL_BLOCK_IDS, BLOCKS, isLiquidBlock } from './blocks.ts';

describe('liquid blocks', () => {
  it('flags lava as liquid — it streams no collider; the body wades in', () => {
    expect(isLiquidBlock('lava')).toBe(true);
  });

  it('keeps every walkable block solid', () => {
    for (const id of ALL_BLOCK_IDS) {
      if (id === 'lava') continue;
      expect(isLiquidBlock(id), `${id} must stay solid`).toBe(false);
    }
  });

  it('agrees with the tag registry (the collider gate honors tags, not ids)', () => {
    for (const id of ALL_BLOCK_IDS) {
      expect(isLiquidBlock(id)).toBe(BLOCKS[id].tags.includes('liquid'));
    }
  });
});
