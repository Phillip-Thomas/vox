import { describe, expect, it } from 'vitest';
import {
  coordinateKey,
  coordinateToSeed,
  coordinatesEqual,
  createCurrentWorld,
  normalizeCoordinate,
  seededUnit
} from './worldCoordinates';

describe('world coordinate identity', () => {
  it('derives the same seed for the same coordinate', () => {
    expect(coordinateToSeed(0, 0)).toBe(coordinateToSeed(0, 0));
    expect(coordinateToSeed(12, -7)).toBe(coordinateToSeed(12, -7));
  });

  it('normalizes coordinate input to integer grid cells', () => {
    expect(normalizeCoordinate({ x: 4.9, y: -2.9 })).toEqual({ x: 4, y: -2 });
    expect(createCurrentWorld({ x: 4.9, y: -2.9 })).toEqual(createCurrentWorld({ x: 4, y: -2 }));
  });

  it('supports negative coordinates without aliasing their positive counterparts', () => {
    expect(coordinateToSeed(-1, 0)).not.toBe(coordinateToSeed(1, 0));
    expect(coordinateToSeed(0, -1)).not.toBe(coordinateToSeed(0, 1));
  });

  it('gives nearby grid coordinates distinct seeds', () => {
    const seeds = new Set<number>();
    for (let x = -3; x <= 3; x++) {
      for (let y = -3; y <= 3; y++) {
        seeds.add(coordinateToSeed(x, y));
      }
    }
    expect(seeds.size).toBe(49);
  });

  it('creates a current world from normalized coordinates and seed', () => {
    const world = createCurrentWorld({ x: -2.2, y: 5.8 });
    expect(world.worldId).toBe('-2,5');
    expect(world.coordinate).toEqual({ x: -2, y: 5 });
    expect(world.seed).toBe(coordinateToSeed(-2, 5));
  });

  it('uses stable coordinate keys and equality', () => {
    expect(coordinateKey({ x: 1.9, y: -3.1 })).toBe('1,-3');
    expect(coordinatesEqual({ x: 1.9, y: -3.1 }, { x: 1, y: -3 })).toBe(true);
    expect(coordinatesEqual({ x: 1, y: -3 }, { x: -1, y: 3 })).toBe(false);
  });

  it('provides deterministic seeded unit values in [0, 1)', () => {
    const value = seededUnit(coordinateToSeed(3, 8), 12);
    expect(value).toBe(seededUnit(coordinateToSeed(3, 8), 12));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
