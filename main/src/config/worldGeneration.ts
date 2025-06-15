// World generation configuration
export interface WorldGenerationConfig {
  coreRadius: number; // Radius of the lava core (1.5-3 blocks for diameter of 3-6)
}

// Default world generation settings
export const DEFAULT_WORLD_CONFIG: WorldGenerationConfig = {
  coreRadius: 2, // Default core radius of 2 blocks (diameter of 4)
}; 