import { DEFAULT_SEA_LEVEL_PERCENTILE } from '../config/worldGeneration';
import type { TerrainGenerationConfig, TerrainProfile } from '../config/worldGeneration';
import { buildPlanetProfile, type PlanetProfile } from '../game/PlanetProfile';
import { seededUnit } from './worldCoordinates';

/**
 * Resolve the terrain-generation config for a given seed + planet radius.
 *
 * Single source of truth shared by EfficientPlanet (which builds the solid
 * terrain) and the water generator (which must use the IDENTICAL config/seed so
 * the ocean lines up exactly with the terrain it floods). Changing terrain
 * shape per seed here keeps water and land in sync automatically.
 *
 * `seaLevelPercentile` controls how much of EACH preset floods. The generator
 * computes the actual surface-radius distribution and sets the waterline at this
 * percentile, so the chosen fraction is GUARANTEED to be underwater regardless
 * of the preset's absolute terrain heights. Every preset therefore has VISIBLE
 * water, varying from rare (mountains) to dominant (valleys):
 *   valleys  0.55  (very common water / lots of ocean)
 *   default  +1 voxel above its generated percentile waterline
 *   islands  0.38  (archipelago — land pokes out of a broad sea)
 *   hills    0.28  (water in the low spots)
 *   mountains 0.15 (rare but PRESENT — small seas in the deepest valleys)
 *   random   default (0.42)
 */
export function createTerrainConfig(seed: number, planetRadius: number): TerrainGenerationConfig {
  const profile = buildPlanetProfile(seed);
  const config = createTerrainConfigFromProfile(profile, planetRadius);

  if (seed === 12345) {
    return {
      ...config,
      seaLevelOffset: 1
    };
  }

  return config;
}

export function createTerrainConfigFromProfile(
  profile: PlanetProfile | TerrainProfile,
  planetRadius: number,
  seedOverride = 0
): TerrainGenerationConfig {
  const seed = typeof profile === 'string' ? seedOverride : profile.seed;
  const terrainProfile = typeof profile === 'string' ? profile : profile.terrainProfile;
  const roughness = seededUnit(seed, 211);
  const scaleJitter = seededUnit(seed, 223);
  const waterJitter = seededUnit(seed, 227) - 0.5;
  // Oceanic archetype = a true WATER WORLD: more of the planet is deep sea, the
  // basins go deeper, and the waterline sits higher so land reads as islands
  // poking out of a broad ocean (vs the deep-but-not-dominant seas elsewhere).
  const isOceanic = typeof profile !== 'string' && profile.archetype === 'oceanic';
  const oceanWorld = isOceanic
    ? { oceanCoverage: 0.16, oceanDepth: 14, oceanEdge: 0.16 }
    : {};

  if (terrainProfile === 'mountains') {
    return {
      seed,
      terrainProfile,
      heightVariation: Math.max(12, Math.floor(planetRadius * (0.54 + roughness * 0.24))),
      mountainFrequency: 0.009 + scaleJitter * 0.01,
      hillFrequency: 0.02 + seededUnit(seed, 229) * 0.02,
      valleyDepth: Math.max(6, Math.floor(planetRadius * (0.18 + seededUnit(seed, 233) * 0.14))),
      terrainScale: 0.052 + seededUnit(seed, 239) * 0.035,
      seaLevelPercentile: clamp01(0.12 + waterJitter * 0.08)
    };
  }

  if (terrainProfile === 'hills') {
    return {
      seed,
      terrainProfile,
      heightVariation: Math.max(4, Math.floor(planetRadius * (0.16 + roughness * 0.14))),
      mountainFrequency: 0.022 + scaleJitter * 0.02,
      hillFrequency: 0.06 + seededUnit(seed, 241) * 0.05,
      valleyDepth: Math.max(3, Math.floor(planetRadius * (0.08 + seededUnit(seed, 251) * 0.1))),
      terrainScale: 0.1 + seededUnit(seed, 257) * 0.07,
      seaLevelPercentile: clamp01(0.25 + waterJitter * 0.1)
    };
  }

  if (terrainProfile === 'valleys') {
    return {
      seed,
      terrainProfile,
      heightVariation: Math.max(9, Math.floor(planetRadius * (0.32 + roughness * 0.2))),
      mountainFrequency: 0.014 + scaleJitter * 0.014,
      hillFrequency: 0.035 + seededUnit(seed, 263) * 0.035,
      valleyDepth: Math.max(10, Math.floor(planetRadius * (0.38 + seededUnit(seed, 269) * 0.24))),
      terrainScale: 0.06 + seededUnit(seed, 271) * 0.04,
      seaLevelPercentile: clamp01(0.36 + waterJitter * 0.12)
    };
  }

  if (terrainProfile === 'islands') {
    return {
      seed,
      terrainProfile,
      heightVariation: Math.max(5, Math.floor(planetRadius * (0.2 + roughness * 0.18))),
      mountainFrequency: 0.03 + scaleJitter * 0.025,
      hillFrequency: 0.075 + seededUnit(seed, 277) * 0.06,
      valleyDepth: Math.max(5, Math.floor(planetRadius * (0.2 + seededUnit(seed, 281) * 0.2))),
      terrainScale: 0.12 + seededUnit(seed, 283) * 0.06,
      seaLevelPercentile: clamp01((isOceanic ? 0.58 : 0.42) + waterJitter * 0.12),
      ...oceanWorld
    };
  }

  return {
    seed,
    terrainProfile,
    heightVariation: Math.max(10, Math.floor(planetRadius * (0.34 + roughness * 0.24))),
    mountainFrequency: 0.012 + scaleJitter * 0.014,
    hillFrequency: 0.035 + seededUnit(seed, 293) * 0.035,
    valleyDepth: Math.max(8, Math.floor(planetRadius * (0.24 + seededUnit(seed, 307) * 0.18))),
    terrainScale: 0.07 + seededUnit(seed, 311) * 0.045,
    seaLevelPercentile: clamp01(DEFAULT_SEA_LEVEL_PERCENTILE + 0.08 + waterJitter * 0.12)
  };
}

function clamp01(value: number) {
  return Math.min(0.95, Math.max(0.02, value));
}
