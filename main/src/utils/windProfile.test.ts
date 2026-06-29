import { describe, expect, it } from 'vitest';
import { coordinateToSeed } from './worldCoordinates';
import { buildWindProfile } from './windProfile';

describe('buildWindProfile', () => {
  it('is deterministic for a terrain seed', () => {
    const seed = coordinateToSeed(5, -3);
    const a = buildWindProfile(seed);
    const b = buildWindProfile(seed);

    expect(a.direction.x).toBe(b.direction.x);
    expect(a.direction.y).toBe(b.direction.y);
    expect(a.strength).toBe(b.strength);
    expect(a.gustStrength).toBe(b.gustStrength);
    expect(a.gustScale).toBe(b.gustScale);
    expect(a.gustSpeed).toBe(b.gustSpeed);
    expect(a.turbulence).toBe(b.turbulence);
    expect(a.veer).toBe(b.veer);
    expect(a.offset.x).toBe(b.offset.x);
    expect(a.offset.y).toBe(b.offset.y);
  });

  it('keeps wind parameters bounded for shader consumers', () => {
    for (let i = 0; i < 300; i++) {
      const p = buildWindProfile(coordinateToSeed(i * 7 - 20, i * 13 + 2));
      expect(p.direction.length()).toBeCloseTo(1, 5);
      expect(p.strength).toBeGreaterThanOrEqual(0.58);
      expect(p.strength).toBeLessThanOrEqual(1.7);
      expect(p.gustStrength).toBeGreaterThanOrEqual(0.45);
      expect(p.gustStrength).toBeLessThanOrEqual(1.6);
      expect(p.gustScale).toBeGreaterThanOrEqual(0.022);
      expect(p.gustScale).toBeLessThanOrEqual(0.078);
      expect(p.gustSpeed).toBeGreaterThanOrEqual(0.22);
      expect(p.gustSpeed).toBeLessThanOrEqual(0.92);
      expect(p.turbulence).toBeGreaterThanOrEqual(0.16);
      expect(p.turbulence).toBeLessThanOrEqual(0.98);
      expect(p.veer).toBeGreaterThan(0.45);
      expect(p.veer).toBeLessThan(1.8);
    }
  });

  it('creates meaningfully different planet winds across seeds', () => {
    const directions = new Set<string>();
    let minStrength = Infinity;
    let maxStrength = -Infinity;
    let minSpeed = Infinity;
    let maxSpeed = -Infinity;

    for (let x = -10; x <= 10; x++) {
      for (let y = -10; y <= 10; y++) {
        const p = buildWindProfile(coordinateToSeed(x, y));
        directions.add(`${p.direction.x.toFixed(2)},${p.direction.y.toFixed(2)}`);
        minStrength = Math.min(minStrength, p.strength);
        maxStrength = Math.max(maxStrength, p.strength);
        minSpeed = Math.min(minSpeed, p.gustSpeed);
        maxSpeed = Math.max(maxSpeed, p.gustSpeed);
      }
    }

    expect(directions.size).toBeGreaterThan(60);
    expect(maxStrength - minStrength).toBeGreaterThan(0.55);
    expect(maxSpeed - minSpeed).toBeGreaterThan(0.35);
  });
});

