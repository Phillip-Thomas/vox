export interface WorldGenerationConfig {
  planetRadius: number;
  coreRadiusPercent: number;
}

// Terrain generation configuration for varied landscapes
export interface TerrainGenerationConfig {
  seed: number; // Deterministic seed for terrain generation
  heightVariation: number; // Maximum height variation in blocks
  mountainFrequency: number; // Frequency of mountain features (0.01-0.05)
  hillFrequency: number; // Frequency of hill features (0.03-0.1)
  valleyDepth: number; // Maximum depth of valleys in blocks
  terrainScale: number; // Overall scale of terrain features (0.05-0.2)
  // Fraction (0..1) of the planet's terrain surface that should sit AT OR BELOW
  // sea level — i.e. the chosen percentile of the actual surface-radius
  // distribution. The generator samples its own terrain and sets the waterline
  // at this percentile, GUARANTEEING that this fraction of the planet floods.
  // Higher => more ocean. This is what makes water vary per preset yet always
  // be present (even mountains get a small but visible sea at ~0.15).
  seaLevelPercentile: number;
}

export const DEFAULT_WORLD_CONFIG: WorldGenerationConfig = {
  planetRadius: 25,
  coreRadiusPercent: 0.15,
};

// --- Sea level (Phase 4) -----------------------------------------------------
// Single source of truth for ocean height, shared by the world generator (to
// decide where coastline/seabed SAND replaces GRASS) and by <WaterShell> (which
// renders the transparent ocean sphere at this radius).
//
// Expressed as a fraction of `planetRadius`, in COORDINATE units. A flat patch
// of terrain (terrainOffset = 0) sits at the full `planetRadius`, so the terrain
// top radius spans roughly [planetRadius - valleyDepth, planetRadius +
// heightVariation*~1.5] with a MEAN near `planetRadius` itself. To get a
// false-earth look (oceans in the lowlands, continents/islands on the higher
// ground) the waterline must sit close to that mean rather than far below it.
//
// 0.95 -> 0.95 * 25 = 23.75 coordinate units (world ~47.5 after VOXEL_SCALE 2).
// Terrain whose top sits below 23.75 coord (i.e. terrainOffset < -1.25, the
// lowlands and valleys) is submerged and rendered as ocean + SAND seabed, while
// hills/mountains (terrainOffset >= -1.25) stay dry land. The player spawns on a
// hilltop at world ~54 (coord ~27, terrainOffset ~ +2), comfortably above the
// 23.75 waterline, so spawn is never underwater while ocean is visible nearby.
//
// Tune this single constant to change global ocean coverage: lower = more land,
// higher = more flooding. It is the ONLY place sea level is defined; both the
// world generator (coastline SAND) and <WaterShell> (getSeaLevelRadius) read it.
export const SEA_LEVEL_RADIUS_PERCENT = 0.95;

// Fallback sea-level percentile used when a terrain config does not specify one
// (e.g. a bare config in a test). The percentile-based mechanism (computed from
// the actual terrain) is the real driver of coverage per preset.
export const DEFAULT_SEA_LEVEL_PERCENTILE = 0.22;

/**
 * Sea-level radius in COORDINATE units for a given world config.
 *
 * NOTE: this is the LEGACY fixed-fraction fallback (planetRadius * 0.95). The
 * generator now prefers a per-terrain PERCENTILE of the actual surface-radius
 * distribution (see ProceduralWorldGenerator.getSeaLevelRadius). This helper is
 * kept for callers that only have a world config and as the documented default.
 */
export function getSeaLevelRadius(config: WorldGenerationConfig = DEFAULT_WORLD_CONFIG): number {
  return config.planetRadius * SEA_LEVEL_RADIUS_PERCENT;
}

// Default terrain generation settings - MUCH more dramatic
export const DEFAULT_TERRAIN_CONFIG: TerrainGenerationConfig = {
  seed: 12345, // Default deterministic seed
  heightVariation: 15, // Up to 15 blocks of height variation (almost doubled)
  mountainFrequency: 0.015, // Slightly lower frequency for larger mountains
  hillFrequency: 0.04, // Slightly lower frequency for larger hills
  valleyDepth: 12, // Up to 12 blocks deep valleys (doubled)
  terrainScale: 0.08, // Slightly smaller scale for more detail
  seaLevelPercentile: DEFAULT_SEA_LEVEL_PERCENTILE,
};
