import fixtures from './proceduralAtlasSeeds.json';
import { buildPlanetProfile } from '../game/PlanetProfile.ts';
import { ALL_ARCHETYPE_IDS, type ArchetypeId } from '../game/data/planetArchetypes.ts';
import { coordinateToSeed, type WorldCoordinate } from './worldCoordinates.ts';

export interface AtlasSeedFixture extends WorldCoordinate {
  seed: number;
}

export type AtlasSeedFixtureMap = Record<ArchetypeId, AtlasSeedFixture[]>;

export const PROCEDURAL_ATLAS_SEEDS = fixtures as AtlasSeedFixtureMap;

export function atlasSeedsForArchetype(archetype: ArchetypeId, count = 2): AtlasSeedFixture[] {
  return PROCEDURAL_ATLAS_SEEDS[archetype].slice(0, count);
}

export function atlasRepresentativeSeeds(countPerArchetype = 2): Array<AtlasSeedFixture & { archetype: ArchetypeId }> {
  return ALL_ARCHETYPE_IDS.flatMap(archetype =>
    atlasSeedsForArchetype(archetype, countPerArchetype).map(seed => ({ ...seed, archetype }))
  );
}

export function findRepresentativeSeedsForArchetype(
  archetype: ArchetypeId,
  count = 2,
  maxRadius = 160
): AtlasSeedFixture[] {
  const found: AtlasSeedFixture[] = [];
  for (let radius = 0; radius <= maxRadius && found.length < count; radius++) {
    for (let x = -radius; x <= radius && found.length < count; x++) {
      for (let y = -radius; y <= radius && found.length < count; y++) {
        if (Math.max(Math.abs(x), Math.abs(y)) !== radius) continue;
        const seed = coordinateToSeed(x, y);
        if (buildPlanetProfile(seed).archetype === archetype) found.push({ x, y, seed });
      }
    }
  }
  return found;
}

export function validateAtlasSeedFixtures(minPerArchetype = 2): string[] {
  const errors: string[] = [];
  for (const archetype of ALL_ARCHETYPE_IDS) {
    const seeds = PROCEDURAL_ATLAS_SEEDS[archetype] ?? [];
    if (seeds.length < minPerArchetype) {
      errors.push(`${archetype}: expected ${minPerArchetype} fixtures, got ${seeds.length}`);
      continue;
    }
    for (const fixture of seeds) {
      const actualSeed = coordinateToSeed(fixture.x, fixture.y);
      if (actualSeed !== fixture.seed) {
        errors.push(`${archetype}: ${fixture.x},${fixture.y} seed drifted from ${fixture.seed} to ${actualSeed}`);
      }
      const actualArchetype = buildPlanetProfile(actualSeed).archetype;
      if (actualArchetype !== archetype) {
        errors.push(`${archetype}: ${fixture.x},${fixture.y} now resolves to ${actualArchetype}`);
      }
    }
  }
  return errors;
}
