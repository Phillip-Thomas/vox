import { describe, expect, it } from 'vitest';
import { MaterialType } from '../types/materials.ts';
import { buildPlanetArtDirection } from './planetArtDirection.ts';
import { PROCEDURAL_ATLAS_SEEDS } from './proceduralAtlasSeeds.ts';
import {
  isTreePlacementEligible,
  resolveTreeVariantCount,
  shouldPlaceTreeAtVoxel,
  treePlacementChance,
  treeVariantIndexForVoxel,
  writeTreeInstanceVariation,
  type TreeInstanceVariation
} from './treePopulation.ts';

function variationTarget(): TreeInstanceVariation {
  return { scaleX: 0, scaleY: 0, scaleZ: 0, leanRadians: 0, leanAzimuth: 0 };
}

describe('tree population', () => {
  it('bounds requested variant counts by graphics quality', () => {
    expect(resolveTreeVariantCount('ULTRA')).toBe(4);
    expect(resolveTreeVariantCount('HIGH')).toBe(3);
    expect(resolveTreeVariantCount('MEDIUM')).toBe(2);
    expect(resolveTreeVariantCount('LOW')).toBe(1);
    expect(resolveTreeVariantCount('POTATO')).toBe(0);
    expect(resolveTreeVariantCount('HIGH', 99)).toBe(3);
    expect(resolveTreeVariantCount('ULTRA', 2.9)).toBe(2);
    expect(resolveTreeVariantCount('ULTRA', -3)).toBe(0);
  });

  it('assigns voxels deterministically across the active variant range', () => {
    const seen = new Set<number>();
    for (let x = -30; x <= 30; x++) {
      const index = treeVariantIndexForVoxel(x, x * 3, 7 - x, 12345, 4);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(4);
      expect(treeVariantIndexForVoxel(x, x * 3, 7 - x, 12345, 4)).toBe(index);
      seen.add(index);
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
    expect(treeVariantIndexForVoxel(1, 2, 3, 12345, 0)).toBe(-1);
  });

  it('writes bounded, non-uniform, correlated scale and lean values', () => {
    const first = variationTarget();
    const second = variationTarget();
    expect(writeTreeInstanceVariation(4, 5, 6, 9876, first)).toBe(first);
    writeTreeInstanceVariation(4, 5, 6, 9876, second);
    expect(second).toEqual(first);

    let sumHeight = 0;
    let sumWidth = 0;
    let sumLean = 0;
    let sumHeightWidth = 0;
    let sumHeightLean = 0;
    let nonUniform = 0;
    const count = 256;
    for (let i = 0; i < count; i++) {
      const sample = writeTreeInstanceVariation(i - 128, i * 7, 31 - i * 3, 9876, variationTarget());
      const width = (sample.scaleX + sample.scaleZ) * 0.5;
      expect(sample.scaleX).toBeGreaterThanOrEqual(0.75);
      expect(sample.scaleX).toBeLessThanOrEqual(1.32);
      expect(sample.scaleY).toBeGreaterThanOrEqual(0.82);
      expect(sample.scaleY).toBeLessThanOrEqual(1.4);
      expect(sample.scaleZ).toBeGreaterThanOrEqual(0.75);
      expect(sample.scaleZ).toBeLessThanOrEqual(1.32);
      expect(sample.leanRadians).toBeGreaterThanOrEqual(0);
      expect(sample.leanRadians).toBeLessThanOrEqual(0.155);
      expect(sample.leanAzimuth).toBeGreaterThanOrEqual(0);
      expect(sample.leanAzimuth).toBeLessThan(Math.PI * 2);
      if (Math.abs(sample.scaleX - sample.scaleZ) > 1e-5) nonUniform++;
      sumHeight += sample.scaleY;
      sumWidth += width;
      sumLean += sample.leanRadians;
      sumHeightWidth += sample.scaleY * width;
      sumHeightLean += sample.scaleY * sample.leanRadians;
    }

    const covarianceHeightWidth = sumHeightWidth / count - (sumHeight / count) * (sumWidth / count);
    const covarianceHeightLean = sumHeightLean / count - (sumHeight / count) * (sumLean / count);
    expect(nonUniform).toBeGreaterThan(count * 0.95);
    expect(covarianceHeightWidth).toBeGreaterThan(0);
    expect(covarianceHeightLean).toBeLessThan(0);
  });

  it('uses ecology material eligibility and surface-resource support', () => {
    const arid = buildPlanetArtDirection(PROCEDURAL_ATLAS_SEEDS.arid[0].seed);
    const metallic = buildPlanetArtDirection(PROCEDURAL_ATLAS_SEEDS.metallic[0].seed);

    expect(isTreePlacementEligible({ material: MaterialType.SAND }, arid)).toBe(true);
    expect(isTreePlacementEligible({ material: MaterialType.GRASS }, arid)).toBe(false);
    expect(isTreePlacementEligible({ material: MaterialType.SAND, supportsSurfaceResources: false }, arid)).toBe(false);
    expect(isTreePlacementEligible({ material: MaterialType.DIRT }, metallic)).toBe(false);
  });

  it('scales placement density with ecology while staying deterministic', () => {
    const base = buildPlanetArtDirection(PROCEDURAL_ATLAS_SEEDS.verdant[0].seed);
    const lush = {
      ...base,
      ecology: { ...base.ecology, richness: 1 },
      shape: { ...base.shape, canopyScale: 1, negativeSpace: 0 }
    };
    const sparse = {
      ...base,
      ecology: { ...base.ecology, richness: 0.1 },
      shape: { ...base.shape, canopyScale: 0.2, negativeSpace: 1 }
    };
    const grass = { material: MaterialType.GRASS };
    const dirt = { material: MaterialType.DIRT };

    expect(treePlacementChance(0, grass, lush)).toBe(0);
    expect(treePlacementChance(0.04, grass, lush)).toBeGreaterThan(
      treePlacementChance(0.04, grass, sparse)
    );
    expect(treePlacementChance(0.04, grass, lush)).toBeGreaterThan(
      treePlacementChance(0.04, dirt, lush)
    );

    let placed = 0;
    for (let i = 0; i < 512; i++) {
      const first = shouldPlaceTreeAtVoxel(grass, i, i * 5, -i * 3, 0.04, 2026, lush);
      const second = shouldPlaceTreeAtVoxel(grass, i, i * 5, -i * 3, 0.04, 2026, lush);
      expect(second).toBe(first);
      if (first) placed++;
    }
    expect(placed).toBeGreaterThan(0);
    expect(placed).toBeLessThan(512);
  });
});
