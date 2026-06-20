import { describe, expect, it } from 'vitest';
import { coordinateToSeed } from './worldCoordinates';
import { seededVoxelUnit } from './seededHash';

describe('seededVoxelUnit', () => {
  it('keeps 32-bit world seeds spatially distributed instead of striped', () => {
    const seed = coordinateToSeed(0, 0);
    const selected: Array<[number, number]> = [];

    for (let x = -25; x <= 25; x++) {
      for (let z = -25; z <= 25; z++) {
        if (seededVoxelUnit(x, 25, z, 7, seed) < 0.04) {
          selected.push([x, z]);
        }
      }
    }

    expect(selected.length).toBeGreaterThan(30);
    expect(new Set(selected.map(([x]) => x)).size).toBeGreaterThan(10);
    expect(new Set(selected.map(([, z]) => z)).size).toBeGreaterThan(10);
  });
});
