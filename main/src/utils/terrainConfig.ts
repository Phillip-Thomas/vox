import { DEFAULT_SEA_LEVEL_PERCENTILE } from '../config/worldGeneration';
import type { TerrainGenerationConfig, TerrainProfile } from '../config/worldGeneration';
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
 *   default  0.42  (balanced earth-like)
 *   islands  0.38  (archipelago — land pokes out of a broad sea)
 *   hills    0.28  (water in the low spots)
 *   mountains 0.15 (rare but PRESENT — small seas in the deepest valleys)
 *   random   default (0.42)
 */
export function createTerrainConfig(seed: number, planetRadius: number): TerrainGenerationConfig {
  if (seed === 54321) {
    // Mountains: rare but present water.
    return {
      seed,
      terrainProfile: 'mountains',
      heightVariation: Math.max(15, Math.floor(planetRadius * 0.6)),
      mountainFrequency: 0.01,
      hillFrequency: 0.025,
      valleyDepth: Math.max(8, Math.floor(planetRadius * 0.2)),
      terrainScale: 0.06,
      seaLevelPercentile: 0.15
    };
  }

  if (seed === 98765) {
    // Rolling hills: water in the low spots.
    return {
      seed,
      terrainProfile: 'hills',
      heightVariation: Math.max(3, Math.floor(planetRadius * 0.15)),
      mountainFrequency: 0.03,
      hillFrequency: 0.08,
      valleyDepth: Math.max(2, Math.floor(planetRadius * 0.08)),
      terrainScale: 0.12,
      seaLevelPercentile: 0.28
    };
  }

  if (seed === 13579) {
    // Deep valleys: very common water.
    return {
      seed,
      terrainProfile: 'valleys',
      heightVariation: Math.max(12, Math.floor(planetRadius * 0.4)),
      mountainFrequency: 0.02,
      hillFrequency: 0.05,
      valleyDepth: Math.max(18, Math.floor(planetRadius * 0.5)),
      terrainScale: 0.07,
      seaLevelPercentile: 0.30
    };
  }

  if (seed === 24680) {
    // Islands: broad sea with land poking out.
    return {
      seed,
      terrainProfile: 'islands',
      heightVariation: Math.max(5, Math.floor(planetRadius * 0.25)),
      mountainFrequency: 0.04,
      hillFrequency: 0.1,
      valleyDepth: Math.max(4, Math.floor(planetRadius * 0.2)),
      terrainScale: 0.15,
      seaLevelPercentile: 0.38
    };
  }

  return createSeededTerrainConfig(seed, planetRadius);
}

function createSeededTerrainConfig(seed: number, planetRadius: number): TerrainGenerationConfig {
  const profile = terrainProfileForSeed(seed);
  const roughness = seededUnit(seed, 211);
  const scaleJitter = seededUnit(seed, 223);
  const waterJitter = seededUnit(seed, 227) - 0.5;

  if (profile === 'mountains') {
    return {
      seed,
      terrainProfile: profile,
      heightVariation: Math.max(12, Math.floor(planetRadius * (0.54 + roughness * 0.24))),
      mountainFrequency: 0.009 + scaleJitter * 0.01,
      hillFrequency: 0.02 + seededUnit(seed, 229) * 0.02,
      valleyDepth: Math.max(6, Math.floor(planetRadius * (0.18 + seededUnit(seed, 233) * 0.14))),
      terrainScale: 0.052 + seededUnit(seed, 239) * 0.035,
      seaLevelPercentile: clamp01(0.12 + waterJitter * 0.08)
    };
  }

  if (profile === 'hills') {
    return {
      seed,
      terrainProfile: profile,
      heightVariation: Math.max(4, Math.floor(planetRadius * (0.16 + roughness * 0.14))),
      mountainFrequency: 0.022 + scaleJitter * 0.02,
      hillFrequency: 0.06 + seededUnit(seed, 241) * 0.05,
      valleyDepth: Math.max(3, Math.floor(planetRadius * (0.08 + seededUnit(seed, 251) * 0.1))),
      terrainScale: 0.1 + seededUnit(seed, 257) * 0.07,
      seaLevelPercentile: clamp01(0.25 + waterJitter * 0.1)
    };
  }

  if (profile === 'valleys') {
    return {
      seed,
      terrainProfile: profile,
      heightVariation: Math.max(9, Math.floor(planetRadius * (0.32 + roughness * 0.2))),
      mountainFrequency: 0.014 + scaleJitter * 0.014,
      hillFrequency: 0.035 + seededUnit(seed, 263) * 0.035,
      valleyDepth: Math.max(10, Math.floor(planetRadius * (0.38 + seededUnit(seed, 269) * 0.24))),
      terrainScale: 0.06 + seededUnit(seed, 271) * 0.04,
      seaLevelPercentile: clamp01(0.36 + waterJitter * 0.12)
    };
  }

  if (profile === 'islands') {
    return {
      seed,
      terrainProfile: profile,
      heightVariation: Math.max(5, Math.floor(planetRadius * (0.2 + roughness * 0.18))),
      mountainFrequency: 0.03 + scaleJitter * 0.025,
      hillFrequency: 0.075 + seededUnit(seed, 277) * 0.06,
      valleyDepth: Math.max(5, Math.floor(planetRadius * (0.2 + seededUnit(seed, 281) * 0.2))),
      terrainScale: 0.12 + seededUnit(seed, 283) * 0.06,
      seaLevelPercentile: clamp01(0.42 + waterJitter * 0.12)
    };
  }

  return {
    seed,
    terrainProfile: profile,
    heightVariation: Math.max(10, Math.floor(planetRadius * (0.34 + roughness * 0.24))),
    mountainFrequency: 0.012 + scaleJitter * 0.014,
    hillFrequency: 0.035 + seededUnit(seed, 293) * 0.035,
    valleyDepth: Math.max(8, Math.floor(planetRadius * (0.24 + seededUnit(seed, 307) * 0.18))),
    terrainScale: 0.07 + seededUnit(seed, 311) * 0.045,
    seaLevelPercentile: clamp01(DEFAULT_SEA_LEVEL_PERCENTILE + 0.08 + waterJitter * 0.12)
  };
}

function terrainProfileForSeed(seed: number): TerrainProfile {
  const roll = seededUnit(seed, 199);
  if (roll < 0.18) return 'mountains';
  if (roll < 0.36) return 'hills';
  if (roll < 0.54) return 'valleys';
  if (roll < 0.72) return 'islands';
  return 'balanced';
}

function clamp01(value: number) {
  return Math.min(0.95, Math.max(0.02, value));
}
