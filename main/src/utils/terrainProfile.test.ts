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
});
