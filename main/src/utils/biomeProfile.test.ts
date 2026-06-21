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
    expect(a.alien).toBe(b.alien);
  });

  it('keeps climate axes in [0,1]', () => {
    for (let i = 0; i < 300; i++) {
      const p = buildBiomeProfile(coordinateToSeed(i, i * 7 + 2));
      for (const v of [p.lushness, p.aridity, p.temperature, p.hue, p.saturation]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
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
    // Alien planets should be a real minority (~20-40%), not absent or universal.
    const frac = alienCount / total;
    expect(frac).toBeGreaterThan(0.1);
    expect(frac).toBeLessThan(0.5);
  });
});
