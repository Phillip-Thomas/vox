import SimplexNoise from '../utils/noise';
import { WORLD_CONFIG, MATERIAL_TYPES } from '../constants/world';

export class TerrainGenerator {
  constructor(seed = WORLD_CONFIG.NOISE_SEED, customParams = {}) {
    this.noise = new SimplexNoise(seed);
    this.config = WORLD_CONFIG;
    this.customParams = customParams;
  }

  // Update parameters for real-time changes
  updateParameters(newParams) {
    this.customParams = { ...this.customParams, ...newParams };
    if (newParams.seed !== undefined) {
      this.noise = new SimplexNoise(newParams.seed);
    }
  }

  // Get current parameter value with fallback to config
  getParam(key) {
    const paramMap = {
      noiseScale: 'NOISE_SCALE',
      octaves: 'NOISE_OCTAVES', 
      persistence: 'NOISE_PERSISTENCE',
      maxHeight: 'TERRAIN_MAX_HEIGHT',
      baseHeight: 'TERRAIN_BASE_HEIGHT',
      seed: 'NOISE_SEED'
    };
    
    const configKey = paramMap[key];
    return this.customParams[key] !== undefined 
      ? this.customParams[key] 
      : this.config[configKey];
  }

  // Generate height map for a chunk
  generateHeightMap(chunkX = 0, chunkZ = 0) {
    const heightMap = [];
    
    for (let x = 0; x < this.config.CHUNK_SIZE; x++) {
      heightMap[x] = [];
      for (let z = 0; z < this.config.CHUNK_SIZE; z++) {
        // Convert local coordinates to world coordinates
        const worldX = chunkX * this.config.CHUNK_SIZE + x;
        const worldZ = chunkZ * this.config.CHUNK_SIZE + z;
        
        // Generate height using fractal noise with custom parameters
        const height = Math.floor(
          this.noise.fractalNoise2D(
            worldX * this.getParam('noiseScale') / this.config.NOISE_SCALE, 
            worldZ * this.getParam('noiseScale') / this.config.NOISE_SCALE, 
            this.getParam('octaves'), 
            this.getParam('persistence')
          ) * this.getParam('maxHeight') + this.getParam('baseHeight')
        );
        
        heightMap[x][z] = Math.max(0, Math.min(height, this.config.CHUNK_HEIGHT - 1));
      }
    }
    
    return heightMap;
  }

  // Generate material type based on height and biome
  getMaterialType(x, z, y, height, biome = 'plains') {
    if (y > height) return MATERIAL_TYPES.AIR;
    
    // Surface layer
    if (y === height) {
      if (height > this.getParam('maxHeight') * 0.7) {
        return MATERIAL_TYPES.STONE; // High mountains are stone
      }
      return MATERIAL_TYPES.GRASS; // Default surface
    }
    
    // Sub-surface layers
    if (y > height - 3) {
      return MATERIAL_TYPES.DIRT; // Dirt layer below grass
    }
    
    return MATERIAL_TYPES.STONE; // Deep stone
  }

  // Generate voxel data for a chunk
  generateChunkData(chunkX = 0, chunkZ = 0) {
    const heightMap = this.generateHeightMap(chunkX, chunkZ);
    const voxelData = [];
    
    // Initialize 3D array
    for (let x = 0; x < this.config.CHUNK_SIZE; x++) {
      voxelData[x] = [];
      for (let z = 0; z < this.config.CHUNK_SIZE; z++) {
        voxelData[x][z] = [];
        const height = heightMap[x][z];
        
        for (let y = 0; y < this.config.CHUNK_HEIGHT; y++) {
          voxelData[x][z][y] = this.getMaterialType(x, z, y, height);
        }
      }
    }
    
    return voxelData;
  }

  // Check if a voxel face should be rendered (optimization)
  shouldRenderFace(voxelData, x, z, y, face) {
    const { CHUNK_SIZE, CHUNK_HEIGHT } = this.config;
    
    // Define face offsets
    const offsets = {
      'front': [0, 0, 1],
      'back': [0, 0, -1],
      'left': [-1, 0, 0],
      'right': [1, 0, 0],
      'top': [0, 1, 0],
      'bottom': [0, -1, 0]
    };
    
    const [dx, dy, dz] = offsets[face];
    const nx = x + dx;
    const ny = y + dy;
    const nz = z + dz;
    
    // Check bounds
    if (nx < 0 || nx >= CHUNK_SIZE || 
        ny < 0 || ny >= CHUNK_HEIGHT || 
        nz < 0 || nz >= CHUNK_SIZE) {
      return true; // Render faces at chunk boundaries
    }
    
    // Don't render if neighboring voxel is solid
    return voxelData[nx][nz][ny] === MATERIAL_TYPES.AIR;
  }
} 