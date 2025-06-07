// Vegetation system constants and configuration
export const VEGETATION_CONFIG = {
  // Global vegetation settings
  GENERATION: {
    DENSITY_SCALE: 0.0001, // Ultra-low density for memory safety
    MIN_FLAT_AREA: 5, // Larger flat area requirement to reduce candidates
    MIN_DISTANCE_BETWEEN_TREES: 25, // Much larger spacing
    HEIGHT_PREFERENCE: { min: 10, max: 30 }, // Narrower height range
    MAX_TREES_PER_CHUNK: 5, // Emergency limit - only 5 trees per chunk
    MAX_ANALYSIS_POINTS: 1000, // Limit terrain analysis to prevent memory bloat
  },

  // Tree generation parameters
  TREE: {
    // Base (trunk) parameters
    BASE: {
      MIN_HEIGHT: 8, // Increased minimum height to make trees more visible
      MAX_HEIGHT: 20, // Increased maximum height
      MIN_RADIUS: 0.8, // Increased minimum radius
      MAX_RADIUS: 1.5, // Increased maximum radius
      TAPER_FACTOR: 0.7, // How much the trunk tapers toward the top
      SEGMENTS: 8, // Number of segments around trunk circumference
    },

    // Branch parameters - drastically simplified
    BRANCHES: {
      MIN_BRANCHES: 0, // No branches for performance
      MAX_BRANCHES: 0, // No branches for performance
      BRANCH_LENGTH_FACTOR: 0.3, // Shorter branches if any
      BRANCH_RADIUS_FACTOR: 0.2, // Thinner branches
      BRANCH_ANGLE_MIN: 30, // Simplified angles
      BRANCH_ANGLE_MAX: 60, // Simplified angles
      SUB_BRANCH_PROBABILITY: 0.0, // No sub-branches
      MAX_BRANCH_LEVELS: 0, // No branching levels
    },

    // Foliage parameters - simplified for performance
    FOLIAGE: {
      CANOPY_RADIUS_FACTOR: 1.0, // Smaller canopy to reduce geometry
      CANOPY_HEIGHT_FACTOR: 0.3, // Shorter canopy
      LEAF_DENSITY: 0.1, // Very low density to reduce vertex count
      LEAF_SIZE: { min: 1.0, max: 2.0 }, // Larger but fewer leaves
      FOLIAGE_LAYERS: 1, // Single layer only
      LAYER_OVERLAP: 0.1, // Minimal overlap
    },

    // Visual parameters
    COLORS: {
      BARK: [0.4, 0.3, 0.2], // Brown bark color
      LEAVES: [0.2, 0.6, 0.2], // Green leaves color
      LEAVES_VARIATION: 0.3, // Color variation in leaves
    },

    // Placement parameters - ultra-permissive for testing
    PLACEMENT: {
      FLATNESS_TOLERANCE: 15, // Much larger tolerance - allow very steep terrain
      PREFERRED_MATERIALS: ['GRASS', 'DIRT', 'SAND', 'STONE'], // Accept almost any material
      AVOID_MATERIALS: [], // No materials to avoid 
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