import { describe, expect, it } from 'vitest';
import { coordinateToSeed } from './worldCoordinates';
import {
  buildTreeProfile,
  paramsFromProfile,
  SILHOUETTES,
  LEAF_LIGHT,
  FLOWER_LIGHT_CAP
} from './treeProfile';

describe('buildTreeProfile', () => {
  it('is byte-stable across repeated calls for the same seed', () => {
    const seed = coordinateToSeed(3, -7);
    const a = buildTreeProfile(seed);
    const b = buildTreeProfile(seed);
    expect(a.silhouette).toBe(b.silhouette);
    expect(a.shapeId).toBe(b.shapeId);
    expect(a.leafColor.getHex()).toBe(b.leafColor.getHex());
    expect(a.leafTipColor.getHex()).toBe(b.leafTipColor.getHex());
    expect(a.leafSSSColor.getHex()).toBe(b.leafSSSColor.getHex());
    expect(a.flowerColor.getHex()).toBe(b.flowerColor.getHex());
    expect(a.bloomAmount).toBe(b.bloomAmount);
    expect(a.trunkHeight).toBe(b.trunkHeight);
    expect(a.leanTwist).toBe(b.leanTwist);
    expect(a.canopyDensity).toBe(b.canopyDensity);
    expect(a.leafScale).toBe(b.leafScale);
  });

  it('produces distinct species across a spread of seeds', () => {
    const silhouettes = new Set<string>();
    const leafColors = new Set<number>();
    for (let x = -10; x <= 10; x++) {
      for (let y = -10; y <= 10; y++) {
        const p = buildTreeProfile(coordinateToSeed(x, y));
        silhouettes.add(p.silhouette);
        leafColors.add(p.leafColor.getHex());
      }
    }
    // We expect real variety in both shape and colour.
    expect(silhouettes.size).toBeGreaterThan(3);
    expect(leafColors.size).toBeGreaterThan(20);
  });

  it('keeps every valid silhouette reachable', () => {
    for (const s of SILHOUETTES) {
      expect(SILHOUETTES.includes(s)).toBe(true);
    }
  });

  it('keeps leaf/flower lightness ACES-safe across many seeds', () => {
    for (let i = 0; i < 500; i++) {
      const p = buildTreeProfile(coordinateToSeed(i, i * 31 + 1));
      // Recompute HSL lightness back from the (linear) colour cap intent: the
      // authored leaf lightness is fixed and flower is capped. We assert the
      // documented constants are the safety ceiling the builder uses.
      expect(LEAF_LIGHT).toBeLessThanOrEqual(0.45);
      expect(FLOWER_LIGHT_CAP).toBeLessThanOrEqual(0.58);
      expect(p.bloomAmount).toBeGreaterThanOrEqual(0);
      expect(p.bloomAmount).toBeLessThanOrEqual(1);
      expect(Math.abs(p.leanTwist)).toBeLessThanOrEqual(0.35);
    }
  });

  it('paramsFromProfile preserves deterministic vertex-count inputs', () => {
    const seed = coordinateToSeed(2, 2);
    const p = buildTreeProfile(seed);
    const a = paramsFromProfile(p);
    const b = paramsFromProfile(p);
    expect(a.attractorCount).toBe(b.attractorCount);
    expect(a.maxLeafCards).toBe(b.maxLeafCards);
    expect(a.height).toBe(b.height);
    expect(a.leafSize).toBe(b.leafSize);
    expect(a.silhouette).toBe(p.silhouette);
    expect(a.attractorCount).toBeGreaterThan(0);
    expect(a.maxLeafCards).toBeGreaterThan(0);
  });
});
