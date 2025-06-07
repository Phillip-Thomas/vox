// Universal world constants
export const WORLD_CONFIG = {
  // High-density voxel settings - 4x resolution upgrade
  // VOXEL_SIZE reduced from 1.0 to 0.25 = 4x more detail
  // This creates 64x more voxels in the same space (4x4x4)
  VOXEL_SIZE: 0.25, // Increased density: 4x smaller voxels (4x more detail)
  
  // Optimized chunk settings for high density
  // Reduced CHUNK_SIZE to maintain performance with 4x voxel count
  // Total voxels per chunk: 64x64x128 = 524,288 voxels (vs 128x128x64 = 1,048,576 before)
  CHUNK_SIZE: 128, // Reduced from 128 to maintain performance with smaller voxels  
  CHUNK_HEIGHT: 128, // Doubled height for more vertical detail
  
  // Terrain settings (flattened for better gameplay)
  TERRAIN_MAX_HEIGHT: 8, // Much flatter terrain
  TERRAIN_BASE_HEIGHT: 4, // Lower base height
  
  // Generation settings (optimized for flat terrain)
  NOISE_SEED: 42,
  NOISE_SCALE: 0.003, // Reduced for smoother, flatter terrain
  NOISE_OCTAVES: 1, // Single octave for simple, flat terrain
  NOISE_PERSISTENCE: 0.1, // Very low persistence for minimal variation
  
  // World bounds
  WORLD_BOUNDS: 200,
  
  // Default movement mode
  DEFAULT_MOVEMENT_MODE: 'dev', // Start in dev mode
  
  // Player settings (adjusted for flat terrain and high-density voxels)
  GROUND_LEVEL: 16, // Adjusted for new flatter terrain scale
  MOVEMENT_SPEED: 5,
  JUMP_SPEED: 35, // Much higher for proper jumping with small voxels
  
  // Player body configuration (compact for flat terrain navigation)
  PLAYER_BODY: {
    // Collision body dimensions (small and agile for flat terrain)
    WIDTH: 1.0, // 4 voxels wide - compact for navigation
    HEIGHT: 3.0, // 12 voxels tall - reasonable proportions
    DEPTH: 1.0, // 4 voxels deep - slim profile
    
    // Camera position relative to body center
    CAMERA_OFFSET: {
      x: 0,
      y: 1.2, // Adjusted for smaller body height
      z: 0
    },
    
    // Collision resolution settings (fine-tuned for small body)
    COLLISION_MARGIN: 0.1, // Small margin for precise movement
    PENETRATION_RESOLUTION: 0.8, // Strong but not overwhelming
    STEP_HEIGHT: 0.3, // Small step height for fine terrain
    VELOCITY_DAMPING: 0.95, // Good responsiveness
    
    // Ground attachment settings (jump-friendly)
    GROUND_ATTACHMENT: {
      ENABLED: true,
      TOLERANCE: 0.4, // Moderate tolerance for flat terrain
      SNAP_STRENGTH: 0.6, // Weaker snapping to allow jumps
      MIN_GROUND_CONTACT_AREA: 0.3, // Small contact area needed
      FORCE_GROUNDING: false, // Disabled to allow jumping
      ALLOW_JUMPING: true, // New flag to prioritize jump mechanics
    },
  },
  
  // Performance monitoring for high-density system
  PERFORMANCE: {
    MAX_VOXELS_PER_CHUNK: 600000, // Warn if chunk exceeds this
    TARGET_FPS: 60,
    MEMORY_WARNING_THRESHOLD: 200 * 1024 * 1024, // 200MB
    ENABLE_PERFORMANCE_MONITORING: true,
  },
  
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
  },

  // Terrain-Vegetation Integration
  VEGETATION: {
    ENABLED: true,
    CHUNK_GENERATION: true,
    DENSITY_MULTIPLIER: 1.0,
    LOD_ENABLED: true,
    
    // Terrain modification for vegetation
    GUARANTEED_FLAT_AREAS: {
      ENABLED: true,
      MIN_PATCHES_PER_CHUNK: 2, // Minimum flat patches per chunk
      PATCH_SIZE_MIN: 5, // Minimum patch radius in voxels
      PATCH_SIZE_MAX: 12, // Maximum patch radius in voxels
      FLATNESS_LEVEL: 2, // Maximum height variation in flat patches
    },
    
    // Coordinate system integration
    PLACEMENT_PRECISION: {
      SURFACE_DETECTION: 'ACCURATE', // Use accurate surface height detection
      COORDINATE_MATCHING: true, // Ensure vegetation coordinates match terrain
      HEIGHT_OFFSET: 0.1, // Small offset above surface
    },
    
    // Terrain-driven parameters
    TERRAIN_INFLUENCE: {
      HEIGHT_ZONES: {
        LOWLAND: { min: 0, max: 15, foliage_scale: 1.5 },
        MIDLAND: { min: 15, max: 35, foliage_scale: 1.0 },
        HIGHLAND: { min: 35, max: 64, foliage_scale: 0.3 },
      },
      SLOPE_INFLUENCE: {
        FLAT: { max_slope: 2, foliage_scale: 1.2 },
        GENTLE: { max_slope: 5, foliage_scale: 1.0 },
        STEEP: { max_slope: 10, foliage_scale: 0.5 },
        CLIFF: { max_slope: 999, foliage_scale: 0.1 },
      }
    }
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

// Material properties including collision settings
export const MATERIAL_PROPERTIES = {
  [MATERIAL_TYPES.AIR]: {
    name: 'Air',
    collisionEnabled: false,
    solid: false,
    friction: 0,
    bounciness: 0,
  },
  [MATERIAL_TYPES.STONE]: {
    name: 'Stone',
    collisionEnabled: true,
    solid: true,
    friction: 0.8,
    bounciness: 0.1,
  },
  [MATERIAL_TYPES.DIRT]: {
    name: 'Dirt',
    collisionEnabled: true,
    solid: true,
    friction: 0.7,
    bounciness: 0.05,
  },
  [MATERIAL_TYPES.GRASS]: {
    name: 'Grass',
    collisionEnabled: true,
    solid: true,
    friction: 0.6,
    bounciness: 0.1,
  },
  [MATERIAL_TYPES.SAND]: {
    name: 'Sand',
    collisionEnabled: true,
    solid: true,
    friction: 0.5,
    bounciness: 0.02,
  },
  [MATERIAL_TYPES.VEGETATION]: {
    name: 'Vegetation',
    collisionEnabled: false,
    solid: false,
    friction: 0.3,
    bounciness: 0,
  },
};

// Biome types for future expansion
export const BIOME_TYPES = {
  PLAINS: 'plains',
  FOREST: 'forest',
  DESERT: 'desert',
  MOUNTAIN: 'mountain',
}; 