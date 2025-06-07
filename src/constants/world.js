// Universal world constants
export const WORLD_CONFIG = {
  // Voxel settings
  VOXEL_SIZE: 1,
  
  // Chunk settings
  CHUNK_SIZE: 64,
  CHUNK_HEIGHT: 64,
  
  // Terrain settings
  TERRAIN_MAX_HEIGHT: 40,
  TERRAIN_BASE_HEIGHT: 10,
  
  // Generation settings
  NOISE_SEED: 42,
  NOISE_SCALE: 0.02,
  NOISE_OCTAVES: 6,
  NOISE_PERSISTENCE: 0.6,
  
  // World bounds
  WORLD_BOUNDS: 200,
  
  // Default movement mode
  DEFAULT_MOVEMENT_MODE: 'dev', // Start in dev mode
  
  // Player settings
  GROUND_LEVEL: 20,
  MOVEMENT_SPEED: 5,
  JUMP_SPEED: 8,
  
  // Movement modes
  MOVEMENT_MODES: {
    PLAYER: 'player',
    DEV: 'dev'
  },
  
  // Planet-specific physics (for future use)
  PLANET_PHYSICS: {
    DEFAULT: {
      GRAVITY: -20,
      ATMOSPHERE: 1.0,
      FRICTION: 0.8
    }
  },
  
  // Colors
  COLORS: {
    GRASS: [0.2, 0.8, 0.3],
    STONE: [0.6, 0.6, 0.7],
    DIRT: [0.4, 0.3, 0.2],
    SAND: [0.9, 0.8, 0.6],
  }
};

// Material types for voxels
export const MATERIAL_TYPES = {
  AIR: 0,
  STONE: 1,
  DIRT: 2,
  GRASS: 3,
  SAND: 4,
  VEGETATION: 5,
};

// Biome types for future expansion
export const BIOME_TYPES = {
  PLAINS: 'plains',
  FOREST: 'forest',
  DESERT: 'desert',
  MOUNTAIN: 'mountain',
}; 