import { describe, expect, it } from 'vitest';
import { coordinateToSeed } from './worldCoordinates';
import { buildBiomeProfile, type BiomeKind } from './biomeProfile';

describe('buildBiomeProfile', () => {
  it('is deterministic for a seed', () => {
    const seed = coordinateToSeed(8, -2);
    const a = buildBiomeProfile(seed);
    const b = buildBiomeProfile(seed);
    expect(a.kind).toBe(b.kind);
    expect(a.lushness).toBe(b.lushness);
    expect(a.aridity).toBe(b.aridity);
    expect(a.hue).toBe(b.hue);
    expect(a.grassHue).toBe(b.grassHue);
    expect(a.leafHue).toBe(b.leafHue);
    expect(a.alien).toBe(b.alien);
  });

  it('keeps climate axes in [0,1]', () => {
    for (let i = 0; i < 300; i++) {
      const p = buildBiomeProfile(coordinateToSeed(i, i * 7 + 2));
      for (const v of [p.lushness, p.aridity, p.temperature, p.hue, p.grassHue, p.leafHue, p.saturation]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('splits grass and canopy into a distinct-but-coordinated pair', () => {
    // Grass + canopy must NOT be the same hue (they collapse to one flat colour),
    // and must sit symmetrically around the identity hue ~0.20 apart (the moderate
    // split-complementary pair).
    const circDist = (a: number, b: number) => {
      const d = Math.abs(a - b);
      return Math.min(d, 1 - d);
    };
    for (let i = 0; i < 200; i++) {
      const p = buildBiomeProfile(coordinateToSeed(i, i * 13 + 5));
      // grass and canopy are clearly distinct
      expect(circDist(p.grassHue, p.leafHue)).toBeGreaterThan(0.15);
      // each sits ~half the split from the identity hue (symmetric pair)
      expect(circDist(p.grassHue, p.hue)).toBeGreaterThan(0.06);
      expect(circDist(p.leafHue, p.hue)).toBeGreaterThan(0.06);
    }
  });

  it('produces a real spread of biome kinds across the galaxy', () => {
    const kinds = new Set<BiomeKind>();
    let alienCount = 0;
    const total = 25 * 25;
    for (let x = -12; x <= 12; x++) {
      for (let y = -12; y <= 12; y++) {
        const p = buildBiomeProfile(coordinateToSeed(x, y));
        kinds.add(p.kind);
        if (p.alien) alienCount++;
      }
    }
    // Expect several distinct biome kinds, not one dominant type.
    expect(kinds.size).toBeGreaterThanOrEqual(4);
    // Alien (non-green) planets should be a substantial fraction (~45%), so the
    // galaxy shows bold non-green worlds, but not the majority.
    const frac = alienCount / total;
    expect(frac).toBeGreaterThan(0.25);
    expect(frac).toBeLessThan(0.6);
  });
});
