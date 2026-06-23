import { describe, it, expect } from 'vitest';
import {
  STARTING_ARCHETYPES, isHospitableStart, findHospitableStart, archetypeForSeed
} from './planetArchetypes.ts';
import { coordinateToSeed } from '../../utils/worldCoordinates.ts';

describe('hospitable crash-landing start', () => {
  it('starting archetypes are the lush, hazard-free, treed ones', () => {
    expect(STARTING_ARCHETYPES).toEqual(['verdant', 'oceanic']);
  });

  it('isHospitableStart agrees with archetypeForSeed', () => {
    for (let s = 0; s < 50; s++) {
      const expected = STARTING_ARCHETYPES.includes(archetypeForSeed(s));
      expect(isHospitableStart(s)).toBe(expected);
    }
  });

  it('findHospitableStart always returns a coordinate on a hospitable planet', () => {
    // Deterministic pseudo-random so the test is stable but exercises the search.
    let n = 0.123456;
    const rand = () => (n = (n * 9301 + 49297) % 233280 / 233280);
    for (let i = 0; i < 25; i++) {
      const coord = findHospitableStart(rand);
      expect(isHospitableStart(coordinateToSeed(coord.x, coord.y))).toBe(true);
    }
  });

  it('not every coordinate is hospitable (the constraint is meaningful)', () => {
    let hostile = 0;
    for (let x = -10; x <= 10; x++) {
      for (let y = -10; y <= 10; y++) {
        if (!isHospitableStart(coordinateToSeed(x, y))) hostile++;
      }
    }
    expect(hostile).toBeGreaterThan(0);
  });
});
