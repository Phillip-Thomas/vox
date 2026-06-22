import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createTerrainConfig } from './terrainConfig';
import {
  deriveWorldPreviewTraits,
  previewSurfaceValue
} from './worldPreview';
import { buildPlanetProfile } from '../game/PlanetProfile';

describe('world preview traits', () => {
  it('derives preview ocean coverage from the same terrain config used by real worlds', () => {
    const seed = 627655627;
    const traits = deriveWorldPreviewTraits(seed);
    const terrainConfig = createTerrainConfig(seed, 25);
    const profile = buildPlanetProfile(seed);

    expect(traits.terrainProfile).toBe(terrainConfig.terrainProfile);
    expect(traits.terrainProfile).toBe(profile.terrainProfile);
    expect(traits.archetype).toBe(profile.archetype);
    expect(traits.oceanCoverage).toBe(terrainConfig.seaLevelPercentile);
    expect(traits.relief).toBeCloseTo(terrainConfig.heightVariation / 25);
    expect(traits.valleyStrength).toBeCloseTo(terrainConfig.valleyDepth / 25);
  });

  it('is deterministic for the same seed', () => {
    const a = deriveWorldPreviewTraits(123456);
    const b = deriveWorldPreviewTraits(123456);

    expect(a.terrainConfig).toEqual(b.terrainConfig);
    expect(a.landColor.getHex()).toBe(b.landColor.getHex());
    expect(a.oceanColor.getHex()).toBe(b.oceanColor.getHex());
  });

  it('varies terrain profile parameters across arbitrary coordinate seeds', () => {
    const samples = [627655627, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(seed => deriveWorldPreviewTraits(seed));
    const profiles = new Set(samples.map(sample => sample.terrainProfile));
    const oceanCoverages = new Set(samples.map(sample => sample.oceanCoverage.toFixed(3)));

    expect(profiles.size).toBeGreaterThan(1);
    expect(oceanCoverages.size).toBeGreaterThan(1);
  });

  it('uses trait parameters in the preview surface function', () => {
    const watery = deriveWorldPreviewTraits(24680);
    const mountainous = deriveWorldPreviewTraits(54321);
    const direction = new THREE.Vector3(0.35, 0.8, -0.2);

    expect(previewSurfaceValue(direction, watery)).toBeGreaterThanOrEqual(0);
    expect(previewSurfaceValue(direction, watery)).toBeLessThanOrEqual(1);
    expect(previewSurfaceValue(direction, watery)).not.toBe(previewSurfaceValue(direction, mountainous));
  });
});
