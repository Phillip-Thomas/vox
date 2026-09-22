import { describe, expect, it } from 'vitest';
import { ProceduralWorldGenerator } from './proceduralWorldGenerator.ts';

// Batch 2 of PARAVOXIA_WORLD_GEN_OFFTHREAD_PLAN.md: the worker's memoised
// answers travel to the main thread instead of being recomputed there. These
// pin the two things that make that safe — a hydrated generator answers
// exactly like a cold one, and the float fields only ship when they round-trip.

const SEED = 12345;

function scanned(): ProceduralWorldGenerator {
  const gen = new ProceduralWorldGenerator(undefined, { seed: SEED });
  gen.getAllVoxelPositions(); // fills the caches the way the worker does
  return gen;
}

describe('prepared terrain fields', () => {
  it('exports every memoised answer with an exact numeric key', () => {
    const fields = scanned().exportPreparedFields();
    expect(fields.existence.keys.length).toBeGreaterThan(1000);
    expect(fields.existence.keys.length).toBe(fields.existence.values.length);
    for (let i = 0; i < fields.existence.keys.length; i += 97) {
      expect(Number.isSafeInteger(fields.existence.keys[i])).toBe(true);
    }
  });

  it('a hydrated generator answers existence exactly like a cold one', () => {
    const fields = scanned().exportPreparedFields();
    const cold = new ProceduralWorldGenerator(undefined, { seed: SEED });
    const warm = new ProceduralWorldGenerator(undefined, { seed: SEED });
    warm.hydratePreparedFields(fields);
    let mismatches = 0;
    for (let x = -26; x <= 26; x += 2) for (let y = -26; y <= 26; y += 3) for (let z = -26; z <= 26; z += 5) {
      if (cold.shouldVoxelExist(x, y, z) !== warm.shouldVoxelExist(x, y, z)) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it('ships heights and offsets exactly — Float32 was measured inexact for all of them', () => {
    const gen = scanned();
    const fields = gen.exportPreparedFields();
    const heights = (gen as unknown as { surfaceHeightCache: Map<number, number> }).surfaceHeightCache;
    const offsets = (gen as unknown as { landOffsetCache: Map<number, number> }).landOffsetCache;
    expect(fields.surfaceHeight.values).toBeInstanceOf(Float64Array);
    for (let i = 0; i < fields.surfaceHeight.keys.length; i++) {
      expect(heights.get(fields.surfaceHeight.keys[i])).toBe(fields.surfaceHeight.values[i]);
    }
    for (let i = 0; i < fields.landOffset.keys.length; i++) {
      expect(offsets.get(fields.landOffset.keys[i])).toBe(fields.landOffset.values[i]);
    }
  });

  it('a hydrated generator generates the same blocks and water as a cold one', () => {
    // The point of the fields: the main thread answers from the worker's work
    // and the world it sees is byte-identical to the one it would have computed.
    const fields = scanned().exportPreparedFields();
    const cold = new ProceduralWorldGenerator(undefined, { seed: SEED });
    const warm = new ProceduralWorldGenerator(undefined, { seed: SEED });
    warm.hydratePreparedFields(fields);
    for (let x = -26; x <= 26; x += 3) for (let y = -26; y <= 26; y += 4) for (let z = -26; z <= 26; z += 5) {
      expect(warm.isWaterVoxel(x, y, z)).toBe(cold.isWaterVoxel(x, y, z));
      if (cold.shouldVoxelExist(x, y, z)) {
        expect(warm.generateBlockForPosition(x, y, z)).toBe(cold.generateBlockForPosition(x, y, z));
      }
    }
  });

  it('refuses to hydrate a generator that has already answered', () => {
    const fields = scanned().exportPreparedFields();
    const used = new ProceduralWorldGenerator(undefined, { seed: SEED });
    used.shouldVoxelExist(3, 22, 1);
    expect(() => used.hydratePreparedFields(fields)).toThrow(/fresh generator/);
  });

  it('cooperative and synchronous hydration install identical maps in the original order', () => {
    const fields = scanned().exportPreparedFields();
    const sync = new ProceduralWorldGenerator(undefined, { seed: SEED });
    const cooperative = new ProceduralWorldGenerator(undefined, { seed: SEED });
    sync.hydratePreparedFields(fields);
    const count = fields.existence.keys.length + fields.surfaceHeight.keys.length + fields.landOffset.keys.length;
    let yields = 0;
    for (const chunk of cooperative.hydratePreparedFieldsInChunks(fields, 257)) { void chunk; yields++; }
    expect(yields).toBe(Math.floor(count / 257));
    expect(cooperative.exportPreparedFields()).toEqual(sync.exportPreparedFields());
    expect(() => cooperative.hydratePreparedFieldsInChunks(fields).next()).toThrow(/fresh generator/);
  });

  for (const seed of [12345, 3215739679, 627655627]) {
    it(`matches every voxel query across the complete terrain band for seed ${seed}`, () => {
      const cold = new ProceduralWorldGenerator(undefined, { seed });
      cold.getAllVoxelPositions();
      const warm = new ProceduralWorldGenerator(undefined, { seed });
      warm.hydratePreparedFields(cold.exportPreparedFields());
      let comparisons = 0;
      let mismatch: string | null = null;
      for (let x = -31; x <= 31; x++) for (let y = -31; y <= 31; y++) for (let z = -31; z <= 31; z++) {
        const exists = cold.shouldVoxelExist(x, y, z);
        if (exists !== warm.shouldVoxelExist(x, y, z)
          || cold.isWaterVoxel(x, y, z) !== warm.isWaterVoxel(x, y, z)
          || (exists && cold.generateBlockForPosition(x, y, z) !== warm.generateBlockForPosition(x, y, z))) {
          mismatch ??= `${x},${y},${z}`;
        }
        comparisons++;
      }
      expect(comparisons).toBe(63 ** 3);
      expect(mismatch).toBeNull();
    }, 30_000);
  }
});
