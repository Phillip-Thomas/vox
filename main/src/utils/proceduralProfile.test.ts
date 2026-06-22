import { describe, it, expect } from 'vitest';
import { ProceduralWorldGenerator } from './proceduralWorldGenerator.ts';
import { createTerrainConfig } from './terrainConfig.ts';
import { DEFAULT_WORLD_CONFIG } from '../config/worldGeneration.ts';
import { MaterialType } from '../types/materials.ts';
import { coordinateToSeed } from './worldCoordinates.ts';
import { buildPlanetProfile } from '../game/PlanetProfile.ts';
import type { ArchetypeId } from '../game/data/planetArchetypes.ts';

const R = 24; // within floor(planetRadius=25)

function genForSeed(seed: number) {
  return new ProceduralWorldGenerator(DEFAULT_WORLD_CONFIG, createTerrainConfig(seed, DEFAULT_WORLD_CONFIG.planetRadius));
}

function seedForArchetype(archetype: ArchetypeId): number {
  for (let x = -80; x <= 80; x++) {
    for (let y = -80; y <= 80; y++) {
      const s = coordinateToSeed(x, y);
      if (buildPlanetProfile(s).archetype === archetype) return s;
    }
  }
  throw new Error(`no seed found for archetype ${archetype}`);
}

// Material counts of the EXPOSED surface across ALL 6 cube faces (the outermost
// existing voxel per column), so we sample the whole planet, not one hemisphere.
function surfaceCounts(gen: ProceduralWorldGenerator): Map<MaterialType, number> {
  const counts = new Map<MaterialType, number>();
  for (let axis = 0; axis < 3; axis++) {
    const t0 = (axis + 1) % 3;
    const t1 = (axis + 2) % 3;
    for (const sign of [1, -1]) {
      for (let u = -R; u <= R; u += 2) {
        for (let v = -R; v <= R; v += 2) {
          for (let d = R; d >= 0; d--) {
            const c = [0, 0, 0];
            c[axis] = sign * d; c[t0] = u; c[t1] = v;
            if (gen.shouldVoxelExist(c[0], c[1], c[2])) {
              const m = gen.generateMaterialForPosition(c[0], c[1], c[2]);
              counts.set(m, (counts.get(m) ?? 0) + 1);
              break;
            }
          }
        }
      }
    }
  }
  return counts;
}

// Material counts of deep (inner) voxels — where ore veins live.
function deepCounts(gen: ProceduralWorldGenerator): Map<MaterialType, number> {
  const counts = new Map<MaterialType, number>();
  for (let x = -9; x <= 9; x += 1) {
    for (let y = -9; y <= 9; y += 1) {
      for (let z = -9; z <= 9; z += 1) {
        if (gen.shouldVoxelExist(x, y, z)) {
          const m = gen.generateMaterialForPosition(x, y, z);
          counts.set(m, (counts.get(m) ?? 0) + 1);
        }
      }
    }
  }
  return counts;
}

describe('profile-driven generation determinism', () => {
  it('same seed yields identical surface material at every sampled position', () => {
    const seed = coordinateToSeed(3, 7);
    const a = genForSeed(seed);
    const b = genForSeed(seed);
    for (let x = -R; x <= R; x += 5) {
      for (let z = -R; z <= R; z += 5) {
        for (let y = R; y >= 0; y--) {
          if (a.shouldVoxelExist(x, y, z) && !a.shouldVoxelExist(x, y + 1, z)) {
            expect(a.generateMaterialForPosition(x, y, z)).toBe(b.generateMaterialForPosition(x, y, z));
            break;
          }
        }
      }
    }
  });
});

describe('archetype drives the surface skin', () => {
  it('arid planets are sandy, not grassy', () => {
    const counts = surfaceCounts(genForSeed(seedForArchetype('arid')));
    const sand = counts.get(MaterialType.SAND) ?? 0;
    const grass = counts.get(MaterialType.GRASS) ?? 0;
    expect(sand).toBeGreaterThan(0);
    expect(grass).toBe(0); // desert has no grass surface
  });

  it('volcanic planets expose basalt (and the look is non-grassy)', () => {
    const counts = surfaceCounts(genForSeed(seedForArchetype('volcanic')));
    expect(counts.get(MaterialType.BASALT) ?? 0).toBeGreaterThan(0);
    expect(counts.get(MaterialType.GRASS) ?? 0).toBe(0);
  });

  it('frozen planets expose ice', () => {
    const counts = surfaceCounts(genForSeed(seedForArchetype('frozen')));
    expect(counts.get(MaterialType.ICE) ?? 0).toBeGreaterThan(0);
    expect(counts.get(MaterialType.GRASS) ?? 0).toBe(0);
  });

  it('verdant planets keep grass (approved look preserved)', () => {
    const counts = surfaceCounts(genForSeed(seedForArchetype('verdant')));
    expect(counts.get(MaterialType.GRASS) ?? 0).toBeGreaterThan(0);
    // and never paints them sandy/basalt as a side effect
    expect(counts.get(MaterialType.BASALT) ?? 0).toBe(0);
    expect(counts.get(MaterialType.ICE) ?? 0).toBe(0);
  });
});

describe('archetype drives ore distribution (contextual rarity)', () => {
  it('metallic worlds carry metal ore veins', () => {
    const counts = deepCounts(genForSeed(seedForArchetype('metallic')));
    const metal =
      (counts.get(MaterialType.COPPER) ?? 0) +
      (counts.get(MaterialType.SILVER) ?? 0) +
      (counts.get(MaterialType.GOLD) ?? 0);
    expect(metal).toBeGreaterThan(0);
  });

  it('crystal/anomaly worlds carry crystal veins; verdant worlds do not', () => {
    const crystalCounts = deepCounts(genForSeed(seedForArchetype('crystal')));
    expect(crystalCounts.get(MaterialType.CRYSTAL) ?? 0).toBeGreaterThan(0);

    // verdant has no charged_crystal/void_glass bias → no crystal veins
    const verdantCounts = deepCounts(genForSeed(seedForArchetype('verdant')));
    expect(verdantCounts.get(MaterialType.CRYSTAL) ?? 0).toBe(0);
  });
});
