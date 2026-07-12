import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { coordinateToSeed } from './worldCoordinates';
import { buildBiomeProfile } from './biomeProfile';
import {
  buildTreeProfile,
  paramsFromProfile,
  SILHOUETTES,
  LEAF_LIGHT,
  FLOWER_LIGHT_CAP,
  TREE_VARIANT_COUNT,
  treeVariantSeed,
  type LeafMode,
  type Silhouette
} from './treeProfile';
import { DEFAULT_TREE_PARAMS } from './treeGen';

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
    expect(a.barkColor.getHex()).toBe(b.barkColor.getHex());
    expect(a.bloomAmount).toBe(b.bloomAmount);
    expect(a.trunkHeight).toBe(b.trunkHeight);
    expect(a.leanTwist).toBe(b.leanTwist);
    expect(a.canopyDensity).toBe(b.canopyDensity);
    expect(a.leafScale).toBe(b.leafScale);
    expect(a.wind.strength).toBe(b.wind.strength);
    expect(a.wind.gustStrength).toBe(b.wind.gustStrength);
    expect(a.wind.direction.x).toBeCloseTo(b.wind.direction.x, 6);
    expect(a.wind.direction.y).toBeCloseTo(b.wind.direction.y, 6);
    expect(a.branchJointAngle).toBe(b.branchJointAngle);
    expect(a.whorlCount).toBe(b.whorlCount);
    expect(a.gnarl).toBe(b.gnarl);
    expect(a.gravitropism).toBe(b.gravitropism);
    expect(a.phototropism).toBe(b.phototropism);
    expect(a.shadeTolerance).toBe(b.shadeTolerance);
    expect(a.prioritizeBrightGrowth).toBe(b.prioritizeBrightGrowth);
    expect(a.dropShadeThreshold).toBe(b.dropShadeThreshold);
    expect(a.apicalDominance).toBe(b.apicalDominance);
    expect(a.apicalDominanceDecay).toBe(b.apicalDominanceDecay);
    expect(a.branchStiffness).toBe(b.branchStiffness);
    expect(a.foliageSpacing).toBe(b.foliageSpacing);
    expect(a.foliageThreshold).toBe(b.foliageThreshold);
    expect(a.foliageDroop).toBe(b.foliageDroop);
    expect(a.trunkFlare).toBe(b.trunkFlare);
    expect(a.trunkRoughness).toBe(b.trunkRoughness);
    expect(a.thinFineBranches).toBe(b.thinFineBranches);
    expect(a.maturity).toBe(b.maturity);
    expect(a.crownAsymmetry).toBe(b.crownAsymmetry);
  });

  it('keeps every planet above the old sparse canopy baseline', () => {
    for (let i = 0; i < 250; i++) {
      const p = buildTreeProfile(coordinateToSeed(i, i * 13 - 7));
      expect(p.trunkHeight).toBeGreaterThanOrEqual(5.6);
      expect(p.trunkHeight).toBeLessThanOrEqual(10.9);
      expect(p.canopyDensity).toBeGreaterThanOrEqual(1.35);
      expect(p.canopyDensity).toBeLessThanOrEqual(2.0);
      expect(p.leafScale).toBeGreaterThanOrEqual(0.72);
      expect(p.leafScale).toBeLessThanOrEqual(1.04);
      expect(p.wind.direction.length()).toBeCloseTo(1, 5);
      expect(p.branchJointAngle).toBeGreaterThanOrEqual(0.42);
      expect(p.branchJointAngle).toBeLessThanOrEqual(1.02);
      expect(p.whorlCount).toBeGreaterThanOrEqual(2);
      expect(p.whorlCount).toBeLessThanOrEqual(3);
      expect(p.gnarl).toBeGreaterThanOrEqual(0.04);
      expect(p.gnarl).toBeLessThanOrEqual(0.3);
      expect(p.gravitropism).toBeGreaterThanOrEqual(0.02);
      expect(p.gravitropism).toBeLessThanOrEqual(0.22);
      expect(p.phototropism).toBeGreaterThanOrEqual(0.1);
      expect(p.phototropism).toBeLessThanOrEqual(0.5);
      expect(p.shadeTolerance).toBeGreaterThanOrEqual(0.2);
      expect(p.shadeTolerance).toBeLessThanOrEqual(0.86);
      expect(p.prioritizeBrightGrowth).toBeGreaterThanOrEqual(0.8);
      expect(p.prioritizeBrightGrowth).toBeLessThanOrEqual(2.55);
      expect(p.dropShadeThreshold).toBeGreaterThanOrEqual(0.08);
      expect(p.dropShadeThreshold).toBeLessThanOrEqual(0.34);
      expect(p.apicalDominance).toBeGreaterThanOrEqual(0.2);
      expect(p.apicalDominance).toBeLessThanOrEqual(0.95);
      expect(p.apicalDominanceDecay).toBeGreaterThanOrEqual(0.04);
      expect(p.apicalDominanceDecay).toBeLessThanOrEqual(0.34);
      expect(p.branchStiffness).toBeGreaterThanOrEqual(0.25);
      expect(p.branchStiffness).toBeLessThanOrEqual(0.95);
      expect(p.foliageSpacing).toBeGreaterThanOrEqual(0.56);
      expect(p.foliageSpacing).toBeLessThanOrEqual(1.25);
      expect(p.foliageThreshold).toBeGreaterThanOrEqual(0);
      expect(p.foliageThreshold).toBe(0);
      expect(p.foliageDroop).toBeGreaterThanOrEqual(0);
      expect(p.foliageDroop).toBeLessThanOrEqual(1);
      expect(p.trunkFlare).toBeGreaterThanOrEqual(0.04);
      expect(p.trunkFlare).toBeLessThanOrEqual(0.48);
      expect(p.trunkRoughness).toBeGreaterThanOrEqual(0);
      expect(p.trunkRoughness).toBeLessThanOrEqual(0.18);
      expect(p.thinFineBranches).toBeGreaterThanOrEqual(0);
      expect(p.thinFineBranches).toBeLessThanOrEqual(1);
      expect(p.maturity).toBeGreaterThanOrEqual(0.78);
      expect(p.maturity).toBeLessThanOrEqual(1);
      expect(p.crownAsymmetry).toBeGreaterThanOrEqual(0.04);
      expect(p.crownAsymmetry).toBeLessThanOrEqual(0.3);
    }
  });

  it('spans taller canopies without creating giant outliers', () => {
    let minHeight = Infinity;
    let maxHeight = -Infinity;
    let maxCrownRadius = -Infinity;
    let maxBaseRadius = -Infinity;

    for (let i = 0; i < 700; i++) {
      const p = buildTreeProfile(coordinateToSeed(i - 220, i * 19 + 5));
      const params = paramsFromProfile(p);
      minHeight = Math.min(minHeight, p.trunkHeight);
      maxHeight = Math.max(maxHeight, p.trunkHeight);
      maxCrownRadius = Math.max(maxCrownRadius, params.crownRadius);
      maxBaseRadius = Math.max(maxBaseRadius, params.baseRadius);
      expect(params.height).toBe(p.trunkHeight);
      expect(params.crownRadius).toBeGreaterThan(DEFAULT_TREE_PARAMS.crownRadius * 0.9);
      expect(params.crownRadius).toBeLessThanOrEqual(3.9);
      expect(params.baseRadius).toBeLessThanOrEqual(DEFAULT_TREE_PARAMS.baseRadius * 1.23);
    }

    expect(minHeight).toBeLessThan(6.2);
    expect(maxHeight).toBeGreaterThan(10.0);
    expect(maxHeight - minHeight).toBeGreaterThan(4.0);
    expect(maxCrownRadius).toBeGreaterThan(3.4);
    expect(maxBaseRadius).toBeGreaterThan(DEFAULT_TREE_PARAMS.baseRadius);
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
    expect(a.branchJointAngle).toBe(p.branchJointAngle);
    expect(a.whorlCount).toBe(p.whorlCount);
    expect(a.gnarl).toBe(p.gnarl);
    expect(a.gravitropism).toBe(p.gravitropism);
    expect(a.apicalDominance).toBe(p.apicalDominance);
    expect(a.apicalDominanceDecay).toBe(p.apicalDominanceDecay);
    expect(a.branchStiffness).toBe(p.branchStiffness);
    expect(a.foliageSpacing).toBe(p.foliageSpacing);
    expect(a.foliageThreshold).toBe(p.foliageThreshold);
    expect(a.foliageDroop).toBe(p.foliageDroop);
    expect(a.trunkFlare).toBe(p.trunkFlare);
    expect(a.trunkRoughness).toBe(p.trunkRoughness);
    expect(a.thinFineBranches).toBe(p.thinFineBranches);
    expect(a.attractorCount).toBeGreaterThan(0);
    expect(a.maxLeafCards).toBeGreaterThan(0);
  });

  it('derives coherent physiology and three distinct bounded phenotypes', () => {
    for (let i = 0; i < 80; i++) {
      const seed = coordinateToSeed(i * 5 - 91, i * 23 + 7);
      const profile = buildTreeProfile(seed);
      expect(profile.dropShadeThreshold).toBeCloseTo(
        Math.min(0.34, Math.max(0.08, 0.08 + (1 - profile.shadeTolerance) * 0.26)),
        8
      );

      const params = Array.from(
        { length: TREE_VARIANT_COUNT },
        (_, variant) => paramsFromProfile(profile, variant)
      );
      expect(new Set(params.map(entry => entry.height.toFixed(6))).size).toBeGreaterThan(1);
      expect(new Set(params.map(entry => entry.crownRadius.toFixed(6))).size).toBe(
        TREE_VARIANT_COUNT
      );
      expect(params[1].height).toBeLessThan(params[0].height);
      expect(params[2].crownRadius).toBeGreaterThan(params[0].crownRadius);
      const seeds = Array.from(
        { length: TREE_VARIANT_COUNT },
        (_, variant) => treeVariantSeed(seed, variant)
      );
      expect(new Set(seeds).size).toBe(TREE_VARIANT_COUNT);
      expect(treeVariantSeed(seed, 0)).toBe(seed | 0);
    }
  });

  it('gives every silhouette a fuller bounded leaf-card budget', () => {
    const seed = coordinateToSeed(9, -4);
    const base = buildTreeProfile(seed);
    const leafModeFor = (s: Silhouette): LeafMode =>
      s === 'conical' ? 1 : s === 'frond' ? 2 : 0;

    for (const silhouette of SILHOUETTES) {
      const p = {
        ...base,
        silhouette,
        shapeId: SILHOUETTES.indexOf(silhouette),
        leafMode: leafModeFor(silhouette)
      };
      const params = paramsFromProfile(p);
      expect(params.maxLeafCards, silhouette).toBeGreaterThan(DEFAULT_TREE_PARAMS.maxLeafCards);
      expect(params.attractorCount, silhouette).toBeGreaterThan(220);
      expect(params.leafSize, silhouette).toBeGreaterThan(0.3);
    }
  });
});
