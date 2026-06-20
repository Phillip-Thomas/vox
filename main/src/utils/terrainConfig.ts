import { DEFAULT_SEA_LEVEL_PERCENTILE } from '../config/worldGeneration';
import type { TerrainGenerationConfig } from '../config/worldGeneration';

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
      heightVariation: Math.max(5, Math.floor(planetRadius * 0.25)),
      mountainFrequency: 0.04,
      hillFrequency: 0.1,
      valleyDepth: Math.max(4, Math.floor(planetRadius * 0.2)),
      terrainScale: 0.15,
      seaLevelPercentile: 0.38
    };
  }

  return {
    seed,
    heightVariation: Math.max(15, Math.floor(planetRadius * 0.5)),
    mountainFrequency: 0.015,
    hillFrequency: 0.04,
    valleyDepth: Math.max(12, Math.floor(planetRadius * 0.3)),
    terrainScale: 0.08,
    seaLevelPercentile: DEFAULT_SEA_LEVEL_PERCENTILE
  };
}
