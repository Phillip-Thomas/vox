import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { coordinateToSeed } from './worldCoordinates';
import { buildWaterProfile } from './waterProfile';

const _hsl = { h: 0, s: 0, l: 0 };
function lightOf(c: THREE.Color): number {
  c.clone().convertLinearToSRGB().getHSL(_hsl);
  return _hsl.l;
}
function hueOf(c: THREE.Color): number {
  c.clone().convertLinearToSRGB().getHSL(_hsl);
  return _hsl.h;
}

describe('buildWaterProfile', () => {
  it('is byte-stable across repeated calls for the same seed', () => {
    const seed = coordinateToSeed(7, -2);
    const a = buildWaterProfile(seed);
    const b = buildWaterProfile(seed);
    expect(a.deepColor.getHex()).toBe(b.deepColor.getHex());
    expect(a.shallowColor.getHex()).toBe(b.shallowColor.getHex());
    expect(a.sssColor.getHex()).toBe(b.sssColor.getHex());
    expect(a.foamColor.getHex()).toBe(b.foamColor.getHex());
    expect(a.nightFloor.getHex()).toBe(b.nightFloor.getHex());
  });

  it('produces distinct oceans across a spread of seeds', () => {
    const shallows = new Set<number>();
    for (let x = -10; x <= 10; x++) {
      for (let y = -10; y <= 10; y++) {
        shallows.add(buildWaterProfile(coordinateToSeed(x, y)).shallowColor.getHex());
      }
    }
    expect(shallows.size).toBeGreaterThan(20);
  });

  it('keeps depths dark and below the shallow tone, ACES-safe lightness', () => {
    for (let i = 0; i < 300; i++) {
      const p = buildWaterProfile(coordinateToSeed(i * 13 + 1, i));
      const deepL = lightOf(p.deepColor);
      const shalL = lightOf(p.shallowColor);
      expect(deepL).toBeLessThanOrEqual(0.22); // depths stay dark
      expect(shalL).toBeLessThanOrEqual(0.62); // hero tone ACES-safe
      expect(deepL).toBeLessThan(shalL); // depths darker than shallows
      // night floor is dimmer than the deep body
      expect(lightOf(p.nightFloor)).toBeLessThan(deepL + 1e-6);
    }
  });

  it('carries per-planet colour identity (water hues span a range, not all cyan)', () => {
    const hues: number[] = [];
    for (let x = -12; x <= 12; x++) {
      for (let y = -12; y <= 12; y++) {
        hues.push(hueOf(buildWaterProfile(coordinateToSeed(x, y)).shallowColor));
      }
    }
    const min = Math.min(...hues);
    const max = Math.max(...hues);
    // Alien worlds drag the sea well off the cyan anchor, so hues must spread.
    expect(max - min).toBeGreaterThan(0.25);
  });
});
