import { describe, expect, it } from 'vitest';
import { ALL_ARCHETYPE_IDS } from '../game/data/planetArchetypes.ts';
import { buildPlanetProfile } from '../game/PlanetProfile.ts';
import {
  PROCEDURAL_ATLAS_SEEDS,
  atlasRepresentativeSeeds,
  findRepresentativeSeedsForArchetype,
  validateAtlasSeedFixtures
} from './proceduralAtlasSeeds.ts';

describe('procedural atlas seed fixtures', () => {
  it('keeps at least two deterministic representatives per archetype', () => {
    expect(validateAtlasSeedFixtures(2)).toEqual([]);
    for (const archetype of ALL_ARCHETYPE_IDS) {
      expect(PROCEDURAL_ATLAS_SEEDS[archetype].length).toBeGreaterThanOrEqual(2);
      for (const fixture of PROCEDURAL_ATLAS_SEEDS[archetype].slice(0, 2)) {
        expect(buildPlanetProfile(fixture.seed).archetype).toBe(archetype);
      }
    }
  });

  it('can rediscover fixture-compatible archetype seeds deterministically', () => {
    for (const archetype of ALL_ARCHETYPE_IDS) {
      const found = findRepresentativeSeedsForArchetype(archetype, 2, 24);
      expect(found.length).toBeGreaterThanOrEqual(2);
      expect(found.every(entry => buildPlanetProfile(entry.seed).archetype === archetype)).toBe(true);
    }
  });

  it('exports a flat atlas case list', () => {
    const cases = atlasRepresentativeSeeds(2);
    expect(cases).toHaveLength(ALL_ARCHETYPE_IDS.length * 2);
    expect(new Set(cases.map(entry => entry.archetype)).size).toBe(ALL_ARCHETYPE_IDS.length);
  });
});
