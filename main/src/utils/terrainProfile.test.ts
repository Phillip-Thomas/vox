import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { coordinateToSeed } from './worldCoordinates';
import { buildTerrainProfile } from './terrainProfile';
import { buildPlanetArtDirection } from './planetArtDirection';

const _hsl = { h: 0, s: 0, l: 0 };
function hueOf(c: THREE.Color): number {
  c.clone().convertLinearToSRGB().getHSL(_hsl);
  return _hsl.h;
}

describe('buildTerrainProfile', () => {
  it('is byte-stable across repeated calls for the same seed', () => {
    const seed = coordinateToSeed(4, 9);
    const a = buildTerrainProfile(seed);
    const b = buildTerrainProfile(seed);
    expect(a.tintColor.getHex()).toBe(b.tintColor.getHex());
    expect(a.tintStrength).toBe(b.tintStrength);
    expect(a.surfaceOffset.toArray()).toEqual(b.surfaceOffset.toArray());
    expect(a.surfaceScale).toBe(b.surfaceScale);
    expect(a.weathering).toBe(b.weathering);
    expect(a.mineralization).toBe(b.mineralization);
  });

  it('keeps the tint a whisper (strength in a small, bounded range)', () => {
    for (let i = 0; i < 300; i++) {
      const p = buildTerrainProfile(coordinateToSeed(i * 13 + 1, i));
      expect(p.tintStrength).toBeGreaterThanOrEqual(0.05);
      expect(p.tintStrength).toBeLessThanOrEqual(0.2);
    }
  });

  it('coheres the terrain tint with the shared art-direction terrain role', () => {
    for (let i = 0; i < 200; i++) {
      const seed = coordinateToSeed(i, i * 17 + 3);
      const role = buildPlanetArtDirection(seed).palette.terrainSecondary;
      const tintHue = hueOf(buildTerrainProfile(seed).tintColor);
      let d = Math.abs(role.h - tintHue);
      d = Math.min(d, 1 - d); // circular
      expect(d).toBeLessThan(0.01);
    }
  });

  it('produces distinct terrain tints across a spread of seeds', () => {
    const tints = new Set<number>();
    for (let x = -10; x <= 10; x++) {
      for (let y = -10; y <= 10; y++) {
        tints.add(buildTerrainProfile(coordinateToSeed(x, y)).tintColor.getHex());
      }
    }
    expect(tints.size).toBeGreaterThan(20);
  });

  it('keeps the seeded material style diverse and bounded', () => {
    const offsets = new Set<string>();
    const scales = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const profile = buildTerrainProfile(coordinateToSeed(i * 7, i - 19));
      expect(profile.surfaceScale).toBeGreaterThanOrEqual(0.82);
      expect(profile.surfaceScale).toBeLessThanOrEqual(1.18);
      expect(profile.surfaceRelief).toBeGreaterThan(0);
      expect(profile.surfaceRelief).toBeLessThanOrEqual(1);
      expect(profile.weathering).toBeGreaterThanOrEqual(0.18);
      expect(profile.weathering).toBeLessThanOrEqual(1);
      expect(profile.mineralization).toBeGreaterThanOrEqual(0);
      expect(profile.mineralization).toBeLessThanOrEqual(1);
      offsets.add(profile.surfaceOffset.toArray().map(value => value.toFixed(2)).join(','));
      scales.add(profile.surfaceScale.toFixed(3));
    }
    expect(offsets.size).toBeGreaterThan(190);
    expect(scales.size).toBeGreaterThan(100);
  });
});
