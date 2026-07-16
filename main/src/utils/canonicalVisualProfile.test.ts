import { describe, expect, it } from 'vitest';
import { MaterialType } from '../types/materials.ts';
import {
  TIDEGARDEN_SEED,
  TIDEGARDEN_WORLD_ID,
  buildPlanetProfile,
  resolvePlanetProfile
} from '../game/PlanetProfile.ts';
import { createPlanetIdentity } from '../game/starSystem.ts';
import { buildPlanetArtDirection } from './planetArtDirection.ts';
import { buildPlanetAtmosphereProfile } from './planetVisualProfile.ts';
import { isMaterialEligibleForEcology } from './planetEcology.ts';
import { buildWaterProfile } from './waterProfile.ts';
import { buildTerrainProfile } from './terrainProfile.ts';
import { buildGrassProfile } from './grassProfile.ts';
import { buildTreeProfile } from './treeProfile.ts';
import { buildWindProfile } from './windProfile.ts';
import { buildFloraProfile } from './floraField.ts';
import { buildFaunaProfile } from './faunaField.ts';
import { deriveWorldPreviewTraits } from './worldPreview.ts';

describe('canonical visual profile integration', () => {
  it('keeps the procedural p0 profile byte-compatible through explicit seams', () => {
    const origin = createPlanetIdentity({ system: { x: -1, y: -1 }, slot: 0 });
    const profile = resolvePlanetProfile({
      worldId: origin.worldId,
      seed: origin.seed
    }).profile;

    expect(profile).toEqual(buildPlanetProfile(origin.seed));
    expect(buildPlanetArtDirection(origin.seed, profile)).toEqual(buildPlanetArtDirection(origin.seed));
    expect(buildWaterProfile(origin.seed, profile)).toEqual(buildWaterProfile(origin.seed));
    expect(buildTerrainProfile(origin.seed, profile)).toEqual(buildTerrainProfile(origin.seed));
    expect(buildGrassProfile(origin.seed, profile)).toEqual(buildGrassProfile(origin.seed));
    expect(buildTreeProfile(origin.seed, profile)).toEqual(buildTreeProfile(origin.seed));
    expect(buildWindProfile(origin.seed, profile)).toEqual(buildWindProfile(origin.seed));
    expect(buildFloraProfile(origin.seed, profile)).toEqual(buildFloraProfile(origin.seed));
    expect(buildFaunaProfile(origin.seed, undefined, profile)).toEqual(buildFaunaProfile(origin.seed));
    expect(deriveWorldPreviewTraits(origin.seed, 25, profile)).toEqual(
      deriveWorldPreviewTraits(origin.seed)
    );
  });

  it('never previews or grades canonical Tidegarden as its volcanic seed roll', () => {
    const generic = buildPlanetProfile(TIDEGARDEN_SEED);
    const tidegarden = resolvePlanetProfile({
      worldId: TIDEGARDEN_WORLD_ID,
      seed: TIDEGARDEN_SEED
    }).profile;
    const preview = deriveWorldPreviewTraits(TIDEGARDEN_SEED, 25, tidegarden);
    const genericPreview = deriveWorldPreviewTraits(TIDEGARDEN_SEED);
    const art = buildPlanetArtDirection(TIDEGARDEN_SEED, tidegarden);
    const atmosphere = buildPlanetAtmosphereProfile(TIDEGARDEN_SEED, tidegarden);

    expect(generic.archetype).toBe('volcanic');
    expect(genericPreview.archetype).toBe('volcanic');
    expect(genericPreview.terrainProfile).toBe('mountains');
    expect(preview.archetype).toBe('verdant');
    expect(preview.terrainProfile).toBe('hills');
    expect(preview.landColor.getHex()).not.toBe(genericPreview.landColor.getHex());
    expect(art.archetype).toBe('verdant');
    expect(art.paletteFamily).not.toBe('volcanic-ember');
    expect(art.materialPhenomena.ash).toBe(0);
    expect(art.materialPhenomena.lavaHeat).toBe(0);
    expect(isMaterialEligibleForEcology(art, 'grass', MaterialType.GRASS)).toBe(true);
    expect(isMaterialEligibleForEcology(art, 'surfaceEffects', MaterialType.LAVA)).toBe(false);
    expect(atmosphere.artDirection.archetype).toBe('verdant');
  });

  it('feeds the same resolved Tidegarden biome through every live ecology profile', () => {
    const profile = resolvePlanetProfile({
      worldId: TIDEGARDEN_WORLD_ID,
      seed: TIDEGARDEN_SEED
    }).profile;
    const wind = buildWindProfile(TIDEGARDEN_SEED, profile);
    const water = buildWaterProfile(TIDEGARDEN_SEED, profile);
    const terrain = buildTerrainProfile(TIDEGARDEN_SEED, profile);
    const grass = buildGrassProfile(TIDEGARDEN_SEED, profile);
    const tree = buildTreeProfile(TIDEGARDEN_SEED, profile);
    const flora = buildFloraProfile(TIDEGARDEN_SEED, profile);
    const fauna = buildFaunaProfile(TIDEGARDEN_SEED, undefined, profile);

    expect(wind.biome).toBe(profile.biome);
    expect(water.biome).toBe(profile.biome);
    expect(terrain.biome).toBe(profile.biome);
    expect(grass.biome).toBe(profile.biome);
    expect(grass.wind.biome).toBe(profile.biome);
    expect(tree.wind.biome).toBe(profile.biome);
    expect(flora.biome).toBe(profile.biome);
    expect(flora.wind.biome).toBe(profile.biome);
    expect(fauna.biome).toBe(profile.biome);
    expect(fauna.wind.biome).toBe(profile.biome);
    expect(flora.artDirection.archetype).toBe('verdant');
    expect(fauna.artDirection.archetype).toBe('verdant');
    expect(flora.ecology).toBe(flora.artDirection.ecology);
    expect(fauna.ecology).toBe(fauna.artDirection.ecology);
    expect(flora.weights.fan).toBeGreaterThan(flora.weights.cactus);
    expect(fauna.weights.grazer).toBeGreaterThan(fauna.weights.runner);
  });

  it('rejects a resolved profile paired with another world seed', () => {
    const profile = resolvePlanetProfile({
      worldId: TIDEGARDEN_WORLD_ID,
      seed: TIDEGARDEN_SEED
    }).profile;

    expect(() => buildPlanetArtDirection(TIDEGARDEN_SEED + 1, profile))
      .toThrow(/does not match visual seed/);
    expect(() => deriveWorldPreviewTraits(TIDEGARDEN_SEED + 1, 25, profile))
      .toThrow(/does not match visual seed/);
    expect(() => buildWindProfile(TIDEGARDEN_SEED + 1, profile))
      .toThrow(/does not match visual seed/);
  });
});
