import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { coordinateToSeed } from './worldCoordinates';
import { buildGrassProfile } from './grassProfile';
import { buildBiomeProfile } from './biomeProfile';

const _hsl = { h: 0, s: 0, l: 0 };
function hueOf(c: THREE.Color): number {
  c.clone().convertLinearToSRGB().getHSL(_hsl);
  return _hsl.h;
}
function lightOf(c: THREE.Color): number {
  c.clone().convertLinearToSRGB().getHSL(_hsl);
  return _hsl.l;
}

describe('buildGrassProfile', () => {
  it('is byte-stable across repeated calls for the same seed', () => {
    const seed = coordinateToSeed(5, -3);
    const a = buildGrassProfile(seed);
    const b = buildGrassProfile(seed);
    expect(a.baseColor.getHex()).toBe(b.baseColor.getHex());
    expect(a.tipColor.getHex()).toBe(b.tipColor.getHex());
    expect(a.dryColor.getHex()).toBe(b.dryColor.getHex());
    expect(a.sssColor.getHex()).toBe(b.sssColor.getHex());
    expect(a.dryness).toBe(b.dryness);
    expect(a.heightMul).toBe(b.heightMul);
    expect(a.widthMul).toBe(b.widthMul);
    expect(a.windDir.x).toBe(b.windDir.x);
    expect(a.windDir.y).toBe(b.windDir.y);
    expect(a.windStrength).toBe(b.windStrength);
    expect(a.wind.gustStrength).toBe(b.wind.gustStrength);
    expect(a.wind.gustScale).toBe(b.wind.gustScale);
    expect(a.wind.gustSpeed).toBe(b.wind.gustSpeed);
    expect(a.wind.turbulence).toBe(b.wind.turbulence);
    expect(a.wind.veer).toBe(b.wind.veer);
  });

  it('produces distinct grass biomes across a spread of seeds', () => {
    const baseColors = new Set<number>();
    for (let x = -10; x <= 10; x++) {
      for (let y = -10; y <= 10; y++) {
        baseColors.add(buildGrassProfile(coordinateToSeed(x, y)).baseColor.getHex());
      }
    }
    expect(baseColors.size).toBeGreaterThan(20);
  });

  it('coheres the grass hue with the biome GRASS side of the veg pair', () => {
    // Grass derives from biome.grassHue (the warm side of the split-complementary
    // pair, plus a small temperature nudge), NOT the raw identity hue — so it
    // complements the canopy. Check circular distance to biome.grassHue is tight.
    for (let i = 0; i < 200; i++) {
      const seed = coordinateToSeed(i, i * 17 + 3);
      const grassSide = buildBiomeProfile(seed).grassHue;
      const grassHue = hueOf(buildGrassProfile(seed).baseColor);
      let d = Math.abs(grassSide - grassHue);
      d = Math.min(d, 1 - d); // circular
      expect(d).toBeLessThan(0.08);
    }
  });

  it('keeps colours ACES-safe (conservative lightness) and params in range', () => {
    for (let i = 0; i < 300; i++) {
      const p = buildGrassProfile(coordinateToSeed(i * 13 + 1, i));
      expect(lightOf(p.baseColor)).toBeLessThanOrEqual(0.42);
      expect(lightOf(p.tipColor)).toBeLessThanOrEqual(0.62);
      expect(p.dryness).toBeGreaterThanOrEqual(0);
      expect(p.dryness).toBeLessThanOrEqual(0.9);
      expect(p.heightMul).toBeGreaterThanOrEqual(0.6);
      expect(p.heightMul).toBeLessThanOrEqual(1.9);
      expect(p.widthMul).toBeGreaterThan(0.5);
      expect(p.widthMul).toBeLessThanOrEqual(0.91);
      expect(p.densityMul).toBeGreaterThan(0.3);
      expect(p.coverage).toBeGreaterThanOrEqual(0.35);
      expect(p.coverage).toBeLessThanOrEqual(1);
      // wind direction is a unit vector
      expect(p.windDir.length()).toBeCloseTo(1, 5);
      expect(p.wind.direction.length()).toBeCloseTo(1, 5);
      expect(p.windStrength).toBe(p.wind.strength);
    }
  });

  it('spreads the dynamic biome parameters across a wide, readable range', () => {
    let minDen = Infinity, maxDen = -Infinity, minH = Infinity, maxH = -Infinity;
    let dryPlanets = 0;
    for (let x = -12; x <= 12; x++) {
      for (let y = -12; y <= 12; y++) {
        const p = buildGrassProfile(coordinateToSeed(x, y));
        minDen = Math.min(minDen, p.densityMul); maxDen = Math.max(maxDen, p.densityMul);
        minH = Math.min(minH, p.heightMul); maxH = Math.max(maxH, p.heightMul);
        if (p.dryness > 0.4) dryPlanets++;
      }
    }
    // density and height must genuinely span a wide range planet-to-planet.
    expect(maxDen - minDen).toBeGreaterThan(0.8);
    expect(maxH - minH).toBeGreaterThan(0.7);
    // and a meaningful minority of worlds should read as properly arid.
    expect(dryPlanets).toBeGreaterThan(10);
  });
});
