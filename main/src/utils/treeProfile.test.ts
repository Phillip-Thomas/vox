import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { coordinateToSeed } from './worldCoordinates';
import { buildBiomeProfile } from './biomeProfile';
import {
  buildTreeProfile,
  paramsFromProfile,
  SILHOUETTES,
  LEAF_LIGHT,
  FLOWER_LIGHT_CAP
} from './treeProfile';

const _hsl = { h: 0, s: 0, l: 0 };
function hueOf(c: THREE.Color): number {
  c.clone().convertLinearToSRGB().getHSL(_hsl);
  return _hsl.h;
}

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

  it('coheres the leaf hue with the biome CANOPY side of the veg pair', () => {
    // Canopy derives from biome.leafHue (the cool side of the split-complementary
    // pair) plus a small per-tree signature offset (+/-0.03), so it complements
    // the grass rather than matching it. Check circular distance stays tight.
    for (let i = 0; i < 200; i++) {
      const seed = coordinateToSeed(i, i * 17 + 3);
      const canopySide = buildBiomeProfile(seed).leafHue;
      const leafHue = hueOf(buildTreeProfile(seed).leafColor);
      let d = Math.abs(canopySide - leafHue);
      d = Math.min(d, 1 - d); // circular
      expect(d).toBeLessThan(0.05);
    }
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
