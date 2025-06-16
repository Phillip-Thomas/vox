// World generation configuration
export interface WorldGenerationConfig {
  coreRadius: number; // Radius of the lava core (1.5-3 blocks for diameter of 3-6)
  // New proportional configuration
  coreRadiusPercent?: number; // Core radius as percentage of planet radius (0.15 = 15%)
  surfaceThickness?: number; // Fixed thickness of surface grass layer in blocks
  planetRadius?: number; // Dynamic planet radius for proportional calculations
}

// Default world generation settings
export const DEFAULT_WORLD_CONFIG: WorldGenerationConfig = {
  coreRadius: 2, // Legacy default core radius of 2 blocks (diameter of 4)
  // New proportional defaults
  coreRadiusPercent: 0.15, // Core is 15% of planet radius
  surfaceThickness: 1, // Surface grass is 1 block thick
  planetRadius: 25, // Default planet radius (for legacy compatibility)
}; 