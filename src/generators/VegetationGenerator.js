import SimplexNoise from '../utils/noise';
import { WORLD_CONFIG, MATERIAL_TYPES } from '../constants/world';

export class VegetationGenerator {
  constructor(seed = WORLD_CONFIG.NOISE_SEED + 1000) { // Different seed for vegetation
    this.noise = new SimplexNoise(seed);
    this.config = WORLD_CONFIG;
  }

  // Generate vegetation density map
  generateVegetationDensity(chunkX = 0, chunkZ = 0) {
    const densityMap = [];
    
    for (let x = 0; x < this.config.CHUNK_SIZE; x++) {
      densityMap[x] = [];
      for (let z = 0; z < this.config.CHUNK_SIZE; z++) {
        const worldX = chunkX * this.config.CHUNK_SIZE + x;
        const worldZ = chunkZ * this.config.CHUNK_SIZE + z;
        
        // Use different noise parameters for vegetation
        const density = this.noise.fractalNoise2D(
          worldX * 0.05, // Different scale for vegetation
          worldZ * 0.05,
          3, // Fewer octaves for smoother distribution
          0.6
        );
        
        densityMap[x][z] = Math.max(0, density);
      }
    }
    
    return densityMap;
  }

  // Determine if vegetation should be placed at a position
  shouldPlaceVegetation(x, z, height, densityMap, terrainData) {
    const density = densityMap[x][z];
    
    // Only place vegetation on grass surfaces
    if (terrainData[x][z][height] !== MATERIAL_TYPES.GRASS) {
      return false;
    }
    
    // Use density threshold for placement
    const threshold = 0.3; // Adjust for vegetation frequency
    return density > threshold;
  }

  // Generate different types of vegetation
  getVegetationType(x, z, height, density) {
    // Simple vegetation types based on density and height
    if (density > 0.7) {
      return 'tree'; // Dense areas get trees
    } else if (density > 0.4) {
      return 'bush'; // Medium density gets bushes
    } else {
      return 'grass'; // Low density gets grass patches
    }
  }

  // Generate vegetation data for a chunk (to be integrated with terrain)
  generateVegetationData(chunkX = 0, chunkZ = 0, terrainData, heightMap) {
    const vegetationData = [];
    const densityMap = this.generateVegetationDensity(chunkX, chunkZ);
    
    for (let x = 0; x < this.config.CHUNK_SIZE; x++) {
      vegetationData[x] = [];
      for (let z = 0; z < this.config.CHUNK_SIZE; z++) {
        const height = heightMap[x][z];
        
        if (this.shouldPlaceVegetation(x, z, height, densityMap, terrainData)) {
          const type = this.getVegetationType(x, z, height, densityMap[x][z]);
          vegetationData[x][z] = {
            type,
            height: height + 1, // Place on top of terrain
            density: densityMap[x][z]
          };
        } else {
          vegetationData[x][z] = null;
        }
      }
    }
    
    return vegetationData;
  }

  // Generate simple tree structure (for future implementation)
  generateTreeStructure(x, z, baseHeight, size = 'medium') {
    const treeVoxels = [];
    
    // This is a placeholder for tree generation logic
    // Will be expanded when we implement vegetation rendering
    
    return treeVoxels;
  }
} 