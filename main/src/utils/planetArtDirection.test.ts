import { describe, expect, it } from 'vitest';
import { MaterialType } from '../types/materials.ts';
import { ALL_ARCHETYPE_IDS } from '../game/data/planetArchetypes.ts';
import { buildPlanetProfile } from '../game/PlanetProfile.ts';
import { atlasRepresentativeSeeds } from './proceduralAtlasSeeds.ts';
import {
  buildPlanetArtDirection,
  circularHueDistance,
  paletteDiversityScore,
  relativeLuma,
  roleContrastScore
} from './planetArtDirection.ts';
import {
  isMaterialEligibleForEcology,
  shouldExpectOrganicCanopy,
  surfaceEffectWeight
} from './planetEcology.ts';
import { coordinateToSeed } from './worldCoordinates.ts';

describe('buildPlanetArtDirection', () => {
  it('is deterministic and follows the planet archetype', () => {
    const seed = coordinateToSeed(5, -9);
    const a = buildPlanetArtDirection(seed);
    const b = buildPlanetArtDirection(seed);
    expect(a.archetype).toBe(buildPlanetProfile(seed).archetype);
    expect(a.styleReference.primary).toBe('trees');
    expect(a.styleReference.secondary).toBe('grass');
    expect(a.paletteFamily).toBe(b.paletteFamily);
    expect(a.palette.terrainPrimary.hex).toBe(b.palette.terrainPrimary.hex);
    expect(a.shape.verticality).toBe(b.shape.verticality);
    expect(a.ecology.richness).toBe(b.ecology.richness);
  });

  it('keeps every palette role finite and in range', () => {
    for (const seed of atlasRepresentativeSeeds(2).map(entry => entry.seed)) {
      const direction = buildPlanetArtDirection(seed);
      for (const color of Object.values(direction.palette)) {
        expect(Number.isFinite(color.h)).toBe(true);
        expect(Number.isFinite(color.s)).toBe(true);
        expect(Number.isFinite(color.l)).toBe(true);
        expect(color.h).toBeGreaterThanOrEqual(0);
        expect(color.h).toBeLessThanOrEqual(1);
        expect(color.s).toBeGreaterThanOrEqual(0);
        expect(color.s).toBeLessThanOrEqual(1);
        expect(color.l).toBeGreaterThanOrEqual(0);
        expect(color.l).toBeLessThanOrEqual(1);
        expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('maintains value and hue separation between key world roles', () => {
    for (const seed of atlasRepresentativeSeeds(2).map(entry => entry.seed)) {
      const { palette, scores } = buildPlanetArtDirection(seed);
      expect(roleContrastScore(palette)).toBeGreaterThan(0.72);
      expect(scores.roleContrast).toBeGreaterThan(0.72);
      expect(Math.abs(relativeLuma(palette.skyHigh) - relativeLuma(palette.terrainPrimary))).toBeGreaterThan(0.12);
      expect(Math.abs(relativeLuma(palette.waterDeep) - relativeLuma(palette.waterShallow))).toBeGreaterThan(0.1);
      expect(circularHueDistance(palette.vegetationBase.h, palette.canopyBase.h)).toBeGreaterThan(0.12);
    }
  });

  it('does not collapse diversity across the atlas seed matrix', () => {
    const families = new Set<string>();
    const terrainHues = new Set<string>();
    for (const seed of atlasRepresentativeSeeds(3).map(entry => entry.seed)) {
      const direction = buildPlanetArtDirection(seed);
      families.add(direction.paletteFamily);
      terrainHues.add(direction.palette.terrainPrimary.hex);
      expect(paletteDiversityScore(direction.palette)).toBeGreaterThan(0.24);
      expect(direction.scores.accentBudget).toBeGreaterThan(0.85);
    }
    expect(families.size).toBeGreaterThanOrEqual(6);
    expect(terrainHues.size).toBeGreaterThanOrEqual(8);
  });

  it('keeps ecology expectations archetype-specific', () => {
    const byArchetype = Object.fromEntries(
      atlasRepresentativeSeeds(1).map(entry => [entry.archetype, buildPlanetArtDirection(entry.seed)])
    );
    expect(isMaterialEligibleForEcology(byArchetype.verdant, 'grass', MaterialType.GRASS)).toBe(true);
    expect(isMaterialEligibleForEcology(byArchetype.arid, 'grass', MaterialType.GRASS)).toBe(false);
    expect(isMaterialEligibleForEcology(byArchetype.volcanic, 'surfaceEffects', MaterialType.BASALT)).toBe(true);
    expect(isMaterialEligibleForEcology(byArchetype.volcanic, 'surfaceEffects', MaterialType.LAVA)).toBe(true);
    expect(isMaterialEligibleForEcology(byArchetype.crystal, 'surfaceEffects', MaterialType.CRYSTAL)).toBe(true);
    expect(isMaterialEligibleForEcology(byArchetype.metallic, 'surfaceEffects', MaterialType.COPPER)).toBe(true);
    expect(surfaceEffectWeight(byArchetype.volcanic, 'ash')).toBeGreaterThan(0.8);
    expect(surfaceEffectWeight(byArchetype.volcanic, 'lavaHeat')).toBeGreaterThan(0.8);
    expect(surfaceEffectWeight(byArchetype.frozen, 'frost')).toBeGreaterThan(0.8);
    expect(surfaceEffectWeight(byArchetype.crystal, 'crystalGlints')).toBeGreaterThan(0.8);
    expect(surfaceEffectWeight(byArchetype.metallic, 'metallicFlecks')).toBeGreaterThan(0.8);
    expect(surfaceEffectWeight(byArchetype.fungal, 'fungalSpores')).toBeGreaterThan(0.8);
    expect(shouldExpectOrganicCanopy(byArchetype.metallic)).toBe(false);
    expect(shouldExpectOrganicCanopy(byArchetype.verdant)).toBe(true);
    expect(Object.keys(byArchetype).sort()).toEqual([...ALL_ARCHETYPE_IDS].sort());
  });
});
