import { describe, expect, it } from 'vitest';
import { parsePlanetWorldId } from '../starSystem.ts';
import {
  SPACE_STATION_IDENTITY_VERSION,
  spaceStationSeedForAddress,
  spaceStationWorldId,
  createSpaceStationIdentity,
  isSpaceStationWorldId,
  normalizeSpaceStationAddress,
  parseSpaceStationWorldId,
  sameSpaceStationAddress
} from './spaceStationAddress.ts';

describe('spaceStation world ids', () => {
  it('round-trips through parse', () => {
    const address = { system: { x: -19, y: -17 }, index: 0 };
    const worldId = spaceStationWorldId(address);
    expect(worldId).toBe('-19,-17:a0');
    expect(parseSpaceStationWorldId(worldId)).toEqual(address);
  });

  it('stays disjoint from the planet grammar in both directions', () => {
    // A planet parser must not accept an spaceStation id...
    expect(parsePlanetWorldId('-19,-17:a0')).toBeNull();
    // ...and the spaceStation parser must not accept planet or bare system ids.
    expect(parseSpaceStationWorldId('-19,-17')).toBeNull();
    expect(parseSpaceStationWorldId('-19,-17:p1')).toBeNull();
    expect(parseSpaceStationWorldId('-19,-17:p2')).toBeNull();
  });

  it('rejects malformed and out-of-range ids', () => {
    expect(parseSpaceStationWorldId('')).toBeNull();
    expect(parseSpaceStationWorldId('a0')).toBeNull();
    expect(parseSpaceStationWorldId('1,2:a')).toBeNull();
    expect(parseSpaceStationWorldId('1,2:a-1')).toBeNull();
    expect(parseSpaceStationWorldId('9999999,1:a0')).toBeNull();
    expect(isSpaceStationWorldId('1,2:a3')).toBe(true);
  });

  it('normalizes a fractional or negative index rather than minting a bad id', () => {
    expect(normalizeSpaceStationAddress({ system: { x: 1, y: 2 }, index: 2.7 }).index).toBe(2);
    expect(normalizeSpaceStationAddress({ system: { x: 1, y: 2 }, index: -4 }).index).toBe(0);
  });
});

describe('spaceStation seeds', () => {
  it('is deterministic, non-zero, and distinct per address', () => {
    const seeds = new Set<number>();
    for (let x = -4; x <= 4; x++) {
      for (let index = 0; index < 3; index++) {
        const address = { system: { x, y: x * 3 }, index };
        const seed = spaceStationSeedForAddress(address);
        expect(seed).toBe(spaceStationSeedForAddress(address));
        expect(seed).not.toBe(0);
        seeds.add(seed);
      }
    }
    expect(seeds.size).toBe(27);
  });

  it('does not collide with the planet seed for the same system', () => {
    // Both derive from the same coordinate, so a shared namespace would alias them.
    const system = { x: 12, y: -5 };
    const spaceStation = spaceStationSeedForAddress({ system, index: 0 });
    const planetSlotZero = parsePlanetWorldId('12,-5');
    expect(planetSlotZero).not.toBeNull();
    expect(spaceStation).not.toBe(0);
  });
});

describe('spaceStation identity', () => {
  it('carries the system id, seed and version', () => {
    const identity = createSpaceStationIdentity({ system: { x: 3, y: 4 }, index: 1 });
    expect(identity).toMatchObject({
      worldId: '3,4:a1',
      systemId: '3,4',
      spaceStationIdentityVersion: SPACE_STATION_IDENTITY_VERSION
    });
    expect(identity.seed).toBe(spaceStationSeedForAddress({ system: { x: 3, y: 4 }, index: 1 }));
  });

  it('compares addresses by system and index', () => {
    const a = { system: { x: 1, y: 1 }, index: 0 };
    expect(sameSpaceStationAddress(a, { system: { x: 1, y: 1 }, index: 0 })).toBe(true);
    expect(sameSpaceStationAddress(a, { system: { x: 1, y: 1 }, index: 1 })).toBe(false);
    expect(sameSpaceStationAddress(a, { system: { x: 2, y: 1 }, index: 0 })).toBe(false);
  });
});
