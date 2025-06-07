// Vegetation system constants and configuration
export const VEGETATION_CONFIG = {
  // Global vegetation settings (optimized for high-density voxels)
  GENERATION: {
    DENSITY_SCALE: 0.0002, // Slightly increased density for finer detail
    MIN_FLAT_AREA: 3, // Smaller requirement to work with 0.25 voxel size
    MIN_DISTANCE_BETWEEN_TREES: 12, // Reduced spacing for finer detail (was 25)
    HEIGHT_PREFERENCE: { min: 8, max: 32 }, // Adjusted for flat terrain scale
    MAX_TREES_PER_CHUNK: 8, // Slightly more trees per chunk for density
    MAX_ANALYSIS_POINTS: 800, // Reduced for 64x64 chunks (was 1000 for 128x128)
  },

  // Tree generation parameters (scaled for high-density voxels)
  TREE: {
    // Base (trunk) parameters (adjusted for 0.25 voxel size)
    BASE: {
      MIN_HEIGHT: 16, // 4x larger for new voxel scale (was 8)
      MAX_HEIGHT: 32, // 4x larger for new voxel scale (was 20)
      MIN_RADIUS: 1.2, // Slightly larger for proportion (was 0.8)
      MAX_RADIUS: 2.5, // Larger for visual impact (was 1.5)
      TAPER_FACTOR: 0.7,
      SEGMENTS: 8,
    },

    // Branch parameters - still simplified for performance
    BRANCHES: {
      MIN_BRANCHES: 0,
      MAX_BRANCHES: 2, // Allow minimal branching for more detail
      BRANCH_LENGTH_FACTOR: 0.4, // Slightly longer branches
      BRANCH_RADIUS_FACTOR: 0.25,
      BRANCH_ANGLE_MIN: 25,
      BRANCH_ANGLE_MAX: 65,
      SUB_BRANCH_PROBABILITY: 0.0,
      MAX_BRANCH_LEVELS: 1, // Allow one level of branching
    },

    // Foliage parameters (scaled for higher detail)
    FOLIAGE: {
      CANOPY_RADIUS_FACTOR: 1.5, // Larger canopy for better visual impact
      CANOPY_HEIGHT_FACTOR: 0.4, // Slightly taller canopy
      LEAF_DENSITY: 0.15, // Slightly higher density for detail
      LEAF_SIZE: { min: 0.8, max: 1.5 }, // Adjusted for voxel scale
      FOLIAGE_LAYERS: 2, // Add another layer for richness
      LAYER_OVERLAP: 0.2,
    },

    // Visual parameters
    COLORS: {
      BARK: [0.4, 0.3, 0.2], // Brown bark color
      LEAVES: [0.2, 0.6, 0.2], // Green leaves color
      LEAVES_VARIATION: 0.3, // Color variation in leaves
    },

    // Placement parameters (adjusted for new terrain scale)
    PLACEMENT: {
      FLATNESS_TOLERANCE: 3, // Adjusted for flatter terrain
      PREFERRED_MATERIALS: ['GRASS', 'DIRT', 'STONE'], // Only allow solid, suitable terrain
      AVOID_MATERIALS: [],
      BIOME_DENSITY_MULTIPLIER: {
        plains: 1.0,
        forest: 2.5,
        desert: 0.1,
        mountain: 0.3,
      },
    },
  },

  // Future vegetation types can be added here
  BUSH: {
    // Bush parameters for future implementation
  },

  GRASS: {
    // Grass parameters for future implementation
  },
};

// Vegetation material types
export const VEGETATION_MATERIALS = {
  TREE_BARK: 'tree_bark',
  TREE_LEAVES: 'tree_leaves',
  BUSH_STEM: 'bush_stem',
  BUSH_LEAVES: 'bush_leaves',
  GRASS_BLADE: 'grass_blade',
};

// Vegetation placement types
export const PLACEMENT_TYPES = {
  FLAT_GROUND: 'flat_ground',
  SLOPE: 'slope',
  ROCK_FACE: 'rock_face',
  WATER_EDGE: 'water_edge',
}; 