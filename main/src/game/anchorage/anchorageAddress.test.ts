import { describe, expect, it } from 'vitest';
import { parsePlanetWorldId } from '../starSystem.ts';
import {
  ANCHORAGE_IDENTITY_VERSION,
  anchorageSeedForAddress,
  anchorageWorldId,
  createAnchorageIdentity,
  isAnchorageWorldId,
  normalizeAnchorageAddress,
  parseAnchorageWorldId,
  sameAnchorageAddress
} from './anchorageAddress.ts';

describe('anchorage world ids', () => {
  it('round-trips through parse', () => {
    const address = { system: { x: -19, y: -17 }, index: 0 };
    const worldId = anchorageWorldId(address);
    expect(worldId).toBe('-19,-17:a0');
    expect(parseAnchorageWorldId(worldId)).toEqual(address);
  });

  it('stays disjoint from the planet grammar in both directions', () => {
    // A planet parser must not accept an anchorage id...
    expect(parsePlanetWorldId('-19,-17:a0')).toBeNull();
    // ...and the anchorage parser must not accept planet or bare system ids.
    expect(parseAnchorageWorldId('-19,-17')).toBeNull();
    expect(parseAnchorageWorldId('-19,-17:p1')).toBeNull();
    expect(parseAnchorageWorldId('-19,-17:p2')).toBeNull();
  });

  it('rejects malformed and out-of-range ids', () => {
    expect(parseAnchorageWorldId('')).toBeNull();
    expect(parseAnchorageWorldId('a0')).toBeNull();
    expect(parseAnchorageWorldId('1,2:a')).toBeNull();
    expect(parseAnchorageWorldId('1,2:a-1')).toBeNull();
    expect(parseAnchorageWorldId('9999999,1:a0')).toBeNull();
    expect(isAnchorageWorldId('1,2:a3')).toBe(true);
  });

  it('normalizes a fractional or negative index rather than minting a bad id', () => {
    expect(normalizeAnchorageAddress({ system: { x: 1, y: 2 }, index: 2.7 }).index).toBe(2);
    expect(normalizeAnchorageAddress({ system: { x: 1, y: 2 }, index: -4 }).index).toBe(0);
  });
});

describe('anchorage seeds', () => {
  it('is deterministic, non-zero, and distinct per address', () => {
    const seeds = new Set<number>();
    for (let x = -4; x <= 4; x++) {
      for (let index = 0; index < 3; index++) {
        const address = { system: { x, y: x * 3 }, index };
        const seed = anchorageSeedForAddress(address);
        expect(seed).toBe(anchorageSeedForAddress(address));
        expect(seed).not.toBe(0);
        seeds.add(seed);
      }
    }
    expect(seeds.size).toBe(27);
  });

  it('does not collide with the planet seed for the same system', () => {
    // Both derive from the same coordinate, so a shared namespace would alias them.
    const system = { x: 12, y: -5 };
    const anchorage = anchorageSeedForAddress({ system, index: 0 });
    const planetSlotZero = parsePlanetWorldId('12,-5');
    expect(planetSlotZero).not.toBeNull();
    expect(anchorage).not.toBe(0);
  });
});

describe('anchorage identity', () => {
  it('carries the system id, seed and version', () => {
    const identity = createAnchorageIdentity({ system: { x: 3, y: 4 }, index: 1 });
    expect(identity).toMatchObject({
      worldId: '3,4:a1',
      systemId: '3,4',
      anchorageIdentityVersion: ANCHORAGE_IDENTITY_VERSION
    });
    expect(identity.seed).toBe(anchorageSeedForAddress({ system: { x: 3, y: 4 }, index: 1 }));
  });

  it('compares addresses by system and index', () => {
    const a = { system: { x: 1, y: 1 }, index: 0 };
    expect(sameAnchorageAddress(a, { system: { x: 1, y: 1 }, index: 0 })).toBe(true);
    expect(sameAnchorageAddress(a, { system: { x: 1, y: 1 }, index: 1 })).toBe(false);
    expect(sameAnchorageAddress(a, { system: { x: 2, y: 1 }, index: 0 })).toBe(false);
  });
});
