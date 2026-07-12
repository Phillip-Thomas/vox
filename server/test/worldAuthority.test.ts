import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  canonicalWorldId,
  coordinateToSeed,
  parseWorldId,
  seedForWorldId
} from '../src/worldAuthority.js';

interface IdentityFixture {
  worldId: string;
  system: { x: number; y: number };
  slot: 0 | 1 | 2;
  seed: number;
}

const CLIENT_COMPATIBILITY_FIXTURES = JSON.parse(readFileSync(
  new URL('../../fixtures/star-system-identity.json', import.meta.url),
  'utf8'
)) as IdentityFixture[];

describe('server world authority', () => {
  it('matches explicit client identity and seed fixtures', () => {
    for (const fixture of CLIENT_COMPATIBILITY_FIXTURES) {
      expect(parseWorldId(fixture.worldId)).toEqual({ ...fixture.system, slot: fixture.slot });
      expect(canonicalWorldId(fixture.worldId)).toBe(fixture.worldId);
      expect(seedForWorldId(fixture.worldId)).toBe(fixture.seed);
    }
  });

  it('preserves legacy slot-zero IDs and seeds exactly', () => {
    expect(canonicalWorldId('004,-002')).toBe('4,-2');
    expect(parseWorldId('004,-002')).toEqual({ x: 4, y: -2, slot: 0 });
    expect(coordinateToSeed(4, -2)).toBe(1711462742);
    expect(seedForWorldId('4,-2')).toBe(coordinateToSeed(4, -2));
  });

  it('canonicalizes secondary IDs without aliasing planets in one system', () => {
    expect(canonicalWorldId(' 004,-002:p1 ')).toBe('4,-2:p1');
    const seeds = [
      seedForWorldId('4,-2'),
      seedForWorldId('4,-2:p1'),
      seedForWorldId('4,-2:p2')
    ];
    expect(new Set(seeds).size).toBe(3);
  });

  it.each([
    '4,-2:p0',
    '4,-2:p3',
    '4,-2:p01',
    '4,-2:P1',
    '4,-2:p',
    '4,-2:p-1',
    '4,-2:p1:extra',
    '4,-2:planet1',
    '1.5,-2:p1',
    '+4,-2:p1',
    '1000001,0',
    '-1000001,0:p2',
    '0,1000001:p1',
    'not-a-world'
  ])('rejects malformed or out-of-bounds world ID %s', worldId => {
    expect(parseWorldId(worldId)).toBeNull();
    expect(canonicalWorldId(worldId)).toBeNull();
    expect(seedForWorldId(worldId)).toBeNull();
  });

  it('accepts the inclusive coordinate bounds for secondary planets', () => {
    expect(parseWorldId('-1000000,1000000:p2')).toEqual({
      x: -1_000_000,
      y: 1_000_000,
      slot: 2
    });
    expect(seedForWorldId('-1000000,1000000:p2')).toBe(471922824);
  });
});
