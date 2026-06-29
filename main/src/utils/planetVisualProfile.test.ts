import { describe, expect, it } from 'vitest';
import { atlasRepresentativeSeeds } from './proceduralAtlasSeeds';
import {
  buildPlanetAtmosphereProfile,
  buildPlanetPostGradeProfile
} from './planetVisualProfile';

function finiteColor(color: { r: number; g: number; b: number }) {
  expect(Number.isFinite(color.r)).toBe(true);
  expect(Number.isFinite(color.g)).toBe(true);
  expect(Number.isFinite(color.b)).toBe(true);
  expect(color.r).toBeGreaterThanOrEqual(0);
  expect(color.g).toBeGreaterThanOrEqual(0);
  expect(color.b).toBeGreaterThanOrEqual(0);
}

describe('planet visual profiles', () => {
  it('derives sky, fog, and glow colors from the shared art direction', () => {
    for (const seed of atlasRepresentativeSeeds(2).map(entry => entry.seed)) {
      const profile = buildPlanetAtmosphereProfile(seed);
      expect(profile.artDirection.styleReference.primary).toBe('trees');
      finiteColor(profile.lowSky);
      finiteColor(profile.highSky);
      finiteColor(profile.sunGlow);
      finiteColor(profile.fogTint);
      expect(profile.fogDensityMul).toBeGreaterThanOrEqual(0.74);
      expect(profile.fogDensityMul).toBeLessThanOrEqual(1.28);
      expect(profile.lowSky.getHexString()).not.toBe(profile.highSky.getHexString());
    }
  });

  it('keeps post grades subtle and deterministic', () => {
    for (const seed of atlasRepresentativeSeeds(2).map(entry => entry.seed)) {
      const a = buildPlanetPostGradeProfile(seed);
      const b = buildPlanetPostGradeProfile(seed);
      expect(a.tint.getHexString()).toBe(b.tint.getHexString());
      expect(a.tintAmount).toBeGreaterThanOrEqual(0.05);
      expect(a.tintAmount).toBeLessThanOrEqual(0.12);
      expect(a.saturation).toBeGreaterThanOrEqual(0.96);
      expect(a.saturation).toBeLessThanOrEqual(1.08);
      expect(a.contrast).toBeGreaterThanOrEqual(0.98);
      expect(a.contrast).toBeLessThanOrEqual(1.08);
    }
  });
});
