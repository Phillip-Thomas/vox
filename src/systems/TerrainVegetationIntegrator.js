import * as THREE from 'three';
import { WORLD_CONFIG, MATERIAL_TYPES } from '../constants/world.js';
import { VegetationSystem } from './VegetationSystem.js';
import { CoordinateDebug } from '../utils/CoordinateDebug.js';
import { globalCollisionSystem } from '../utils/VoxelCollisionSystem.js';

/**
 * Integrated Terrain-Vegetation System
 * Ensures vegetation placement coordinates match terrain surface
 * Creates guaranteed suitable areas for vegetation
 */
export class TerrainVegetationIntegrator {
  constructor() {
    this.vegetationSystem = new VegetationSystem();
    this.chunkTerrainCache = new Map(); // Cache terrain data for coordinate matching
    this.flatAreaCache = new Map(); // Cache guaranteed flat areas
    
    console.log('🌿 TerrainVegetationIntegrator initialized');
  }

  /**
   * Generate vegetation for a chunk with terrain-coordinate integration
   * @param {number} chunkX - Chunk X coordinate
   * @param {number} chunkZ - Chunk Z coordinate
   * @param {Array} terrainData - 3D terrain voxel data [x][z][y]
   * @returns {Object} - Vegetation geometry and placement data
   */
  async generateIntegratedVegetation(chunkX, chunkZ, terrainData) {
    const startTime = performance.now();
    
    // Cache terrain data for accurate surface detection
    this.cacheTerrainData(chunkX, chunkZ, terrainData);
    
    // Create guaranteed flat areas if needed
    const flatAreas = this.ensureMinimumFlatAreas(chunkX, chunkZ, terrainData);
    
    // Get accurate surface analysis using integrated coordinates
    const surfaceAnalysis = this.getAccurateSurfaceAnalysis(chunkX, chunkZ, terrainData);
    
    // Calculate terrain-driven vegetation parameters
    const vegetationParams = this.calculateTerrainDrivenParams(surfaceAnalysis);
    
    // Generate vegetation with coordinate-matched placement
    const vegetationResult = await this.vegetationSystem.generateChunkVegetation(
      chunkX, 
      chunkZ, 
      surfaceAnalysis,
      vegetationParams
    );
    
    // Validate and correct vegetation placement coordinates
    const validatedResult = this.validateVegetationPlacement(
      vegetationResult, 
      chunkX, 
      chunkZ, 
      terrainData
    );
    
    const generationTime = performance.now() - startTime;
    
    console.log(`🌳 Integrated vegetation for chunk (${chunkX},${chunkZ}): ${validatedResult.placedTrees || 0} trees in ${generationTime.toFixed(2)}ms`);
    
    return validatedResult;
  }

  /**
   * Cache terrain data for accurate coordinate matching
   */
  cacheTerrainData(chunkX, chunkZ, terrainData) {
    const chunkKey = `${chunkX},${chunkZ}`;
    
    // Build surface height map for precise coordinate matching
    const surfaceMap = new Map();
    
    for (let x = 0; x < WORLD_CONFIG.CHUNK_SIZE; x++) {
      for (let z = 0; z < WORLD_CONFIG.CHUNK_SIZE; z++) {
        // Find highest solid voxel at this x,z coordinate
        let surfaceHeight = 0;
        
        for (let y = WORLD_CONFIG.CHUNK_HEIGHT - 1; y >= 0; y--) {
          const materialType = terrainData[x][z][y];
          if (materialType !== MATERIAL_TYPES.AIR && materialType !== undefined) {
            // Additional validation: make sure this is actually a suitable material
            const isValidSurface = materialType === MATERIAL_TYPES.GRASS || 
                                 materialType === MATERIAL_TYPES.DIRT || 
                                 materialType === MATERIAL_TYPES.STONE;
            
            if (isValidSurface) {
              surfaceHeight = y + 1; // Surface is one voxel above solid terrain
              
              // Debug: Log surface detection for verification (only for center positions)
              if (x === 32 && z === 32) {
                const materialName = Object.keys(MATERIAL_TYPES).find(key => MATERIAL_TYPES[key] === materialType);
                console.log(`🏔️ Center surface detected: ${materialName} voxel at Y=${y}, surface at Y=${surfaceHeight}`);
              }
              break;
            }
          }
        }
        
        surfaceMap.set(`${x},${z}`, surfaceHeight);
      }
    }
    
    this.chunkTerrainCache.set(chunkKey, {
      terrainData,
      surfaceMap,
      timestamp: Date.now()
    });
  }

  /**
   * Ensure minimum flat areas for vegetation placement
   */
  ensureMinimumFlatAreas(chunkX, chunkZ, terrainData) {
    const config = WORLD_CONFIG.VEGETATION.GUARANTEED_FLAT_AREAS;
    if (!config.ENABLED) return [];
    
    const chunkKey = `${chunkX},${chunkZ}`;
    const existingFlatAreas = this.findExistingFlatAreas(terrainData);
    
    const flatAreas = [];
    
    if (existingFlatAreas.length < config.MIN_PATCHES_PER_CHUNK) {
      const neededPatches = config.MIN_PATCHES_PER_CHUNK - existingFlatAreas.length;
      
      for (let i = 0; i < neededPatches; i++) {
        const flatArea = this.createGuaranteedFlatArea(
          chunkX, 
          chunkZ, 
          terrainData, 
          existingFlatAreas.concat(flatAreas)
        );
        
        if (flatArea) {
          flatAreas.push(flatArea);
          this.applyFlatAreaToTerrain(flatArea, terrainData);
        }
      }
      
      console.log(`🏞️ Created ${flatAreas.length} guaranteed flat areas for chunk (${chunkX},${chunkZ})`);
    }
    
    this.flatAreaCache.set(chunkKey, existingFlatAreas.concat(flatAreas));
    return flatAreas;
  }

  /**
   * Find existing naturally flat areas in terrain
   */
  findExistingFlatAreas(terrainData) {
    const flatAreas = [];
    const config = WORLD_CONFIG.VEGETATION.GUARANTEED_FLAT_AREAS;
    const minSize = config.PATCH_SIZE_MIN;
    const maxVariation = config.FLATNESS_LEVEL;
    
    // Sample terrain to find flat regions
    for (let centerX = minSize; centerX < WORLD_CONFIG.CHUNK_SIZE - minSize; centerX += minSize) {
      for (let centerZ = minSize; centerZ < WORLD_CONFIG.CHUNK_SIZE - minSize; centerZ += minSize) {
        
        // Check if this area is flat enough
        const area = this.analyzeAreaFlatness(terrainData, centerX, centerZ, minSize);
        
        if (area.heightVariation <= maxVariation && area.avgHeight > 0) {
          flatAreas.push({
            centerX,
            centerZ,
            radius: minSize,
            height: area.avgHeight,
            heightVariation: area.heightVariation,
            natural: true
          });
        }
      }
    }
    
    return flatAreas;
  }

  /**
   * Create a guaranteed flat area at a suitable location
   */
  createGuaranteedFlatArea(chunkX, chunkZ, terrainData, existingAreas) {
    const config = WORLD_CONFIG.VEGETATION.GUARANTEED_FLAT_AREAS;
    const attempts = 20; // Maximum placement attempts
    
    for (let attempt = 0; attempt < attempts; attempt++) {
      const centerX = Math.floor(
        config.PATCH_SIZE_MAX + 
        Math.random() * (WORLD_CONFIG.CHUNK_SIZE - 2 * config.PATCH_SIZE_MAX)
      );
      const centerZ = Math.floor(
        config.PATCH_SIZE_MAX + 
        Math.random() * (WORLD_CONFIG.CHUNK_SIZE - 2 * config.PATCH_SIZE_MAX)
      );
      
      // Check distance from existing areas
      const tooClose = existingAreas.some(area => {
        const distance = Math.sqrt(
          Math.pow(centerX - area.centerX, 2) + 
          Math.pow(centerZ - area.centerZ, 2)
        );
        return distance < config.PATCH_SIZE_MIN * 2;
      });
      
      if (!tooClose) {
        const radius = Math.floor(
          config.PATCH_SIZE_MIN + 
          Math.random() * (config.PATCH_SIZE_MAX - config.PATCH_SIZE_MIN)
        );
        
        // Determine target height from surrounding terrain
        const area = this.analyzeAreaFlatness(terrainData, centerX, centerZ, radius + 2);
        const targetHeight = Math.max(1, area.avgHeight);
        
        return {
          centerX,
          centerZ,
          radius,
          height: targetHeight,
          heightVariation: 0,
          natural: false,
          created: true
        };
      }
    }
    
    return null; // Could not find suitable location
  }

  /**
   * Apply flat area modification to terrain data
   */
  applyFlatAreaToTerrain(flatArea, terrainData) {
    const { centerX, centerZ, radius, height } = flatArea;
    const targetHeight = Math.floor(height);
    
    for (let x = Math.max(0, centerX - radius); x < Math.min(WORLD_CONFIG.CHUNK_SIZE, centerX + radius); x++) {
      for (let z = Math.max(0, centerZ - radius); z < Math.min(WORLD_CONFIG.CHUNK_SIZE, centerZ + radius); z++) {
        const distance = Math.sqrt(
          Math.pow(x - centerX, 2) + 
          Math.pow(z - centerZ, 2)
        );
        
        if (distance <= radius) {
          // Smooth transition at edges
          const edgeFactor = Math.min(1, (radius - distance) / Math.max(1, radius * 0.2));
          const adjustedHeight = Math.floor(targetHeight * edgeFactor + 
            this.getSurfaceHeight(terrainData, x, z) * (1 - edgeFactor));
          
          // Set terrain to target height
          for (let y = 0; y < WORLD_CONFIG.CHUNK_HEIGHT; y++) {
            if (y < adjustedHeight) {
              if (y === adjustedHeight - 1) {
                terrainData[x][z][y] = MATERIAL_TYPES.GRASS; // Surface
              } else {
                terrainData[x][z][y] = terrainData[x][z][y] || MATERIAL_TYPES.DIRT;
              }
            } else {
              terrainData[x][z][y] = MATERIAL_TYPES.AIR;
            }
          }
        }
      }
    }
  }

  /**
   * Get accurate surface analysis with coordinate matching
   */
  getAccurateSurfaceAnalysis(chunkX, chunkZ, terrainData) {
    const chunkKey = `${chunkX},${chunkZ}`;
    const cached = this.chunkTerrainCache.get(chunkKey);
    
    if (!cached) {
      console.warn(`⚠️ No cached terrain data for chunk (${chunkX},${chunkZ})`);
      return { validPlacements: [] };
    }
    
    const validPlacements = [];
    const chunkWorldSize = WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
    const chunkWorldOffsetX = chunkX * chunkWorldSize;
    const chunkWorldOffsetZ = chunkZ * chunkWorldSize;
    
    // Analyze every 4th voxel position (increased precision for better placement)
    for (let x = 2; x < WORLD_CONFIG.CHUNK_SIZE; x += 4) {
      for (let z = 2; z < WORLD_CONFIG.CHUNK_SIZE; z += 4) {
        const surfaceHeight = cached.surfaceMap.get(`${x},${z}`);
        
        if (surfaceHeight > 0) {
          // Use EXACT same coordinate calculation as terrain generation
          const worldX = (x - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetX;
          const worldZ = (z - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetZ;
          const worldY = surfaceHeight * WORLD_CONFIG.VOXEL_SIZE;
          
          // STRICT material validation - only allow trees on solid, suitable surfaces
          const surfaceMaterial = terrainData[x][z][surfaceHeight - 1];
          
          // Double-check that the surface position is valid
          if (surfaceHeight <= 0 || surfaceHeight >= WORLD_CONFIG.CHUNK_HEIGHT) {
            continue; // Invalid surface height
          }
          
          // Check that there's actually a solid block below the surface
          const solidBlockExists = surfaceMaterial !== MATERIAL_TYPES.AIR && surfaceMaterial !== undefined;
          
          // Check that the position above is AIR (so tree can grow)
          const spaceAbove = terrainData[x][z][surfaceHeight] === MATERIAL_TYPES.AIR;
          
          // Only allow specific materials
          const allowedMaterials = [MATERIAL_TYPES.GRASS, MATERIAL_TYPES.DIRT, MATERIAL_TYPES.STONE];
          const materialSuitable = allowedMaterials.includes(surfaceMaterial);
          
          const suitable = solidBlockExists && spaceAbove && materialSuitable;
          
          if (!suitable) {
            // Debug why this position was rejected
            if (!solidBlockExists) {
              console.log(`❌ Rejected (${x},${z}): No solid block (material: ${surfaceMaterial})`);
            } else if (!spaceAbove) {
              console.log(`❌ Rejected (${x},${z}): No space above (Y=${surfaceHeight} has ${terrainData[x][z][surfaceHeight]})`);
            } else if (!materialSuitable) {
              const materialName = Object.keys(MATERIAL_TYPES).find(key => MATERIAL_TYPES[key] === surfaceMaterial) || 'UNKNOWN';
              console.log(`❌ Rejected (${x},${z}): Unsuitable material (${materialName})`);
            }
            continue;
          }
          
          if (suitable) {
            // Debug: Log placement coordinates and verify them (only for first few placements)
            if (validPlacements.length < 2) {
              const materialName = Object.keys(MATERIAL_TYPES).find(key => MATERIAL_TYPES[key] === surfaceMaterial);
              console.log(`✅ VALID placement: chunk(${x},${z},${surfaceHeight}) -> world(${worldX.toFixed(1)}, ${worldY.toFixed(1)}, ${worldZ.toFixed(1)}) on ${materialName}`);
              
              // Show terrain structure around this position
              console.log(`🔍 Terrain structure at (${x},${z}):`);
              for (let checkY = Math.max(0, surfaceHeight - 2); checkY <= Math.min(WORLD_CONFIG.CHUNK_HEIGHT - 1, surfaceHeight + 1); checkY++) {
                const material = terrainData[x][z][checkY];
                const materialName = Object.keys(MATERIAL_TYPES).find(key => MATERIAL_TYPES[key] === material) || 'UNKNOWN';
                const marker = checkY === surfaceHeight - 1 ? '🌲' : (checkY === surfaceHeight ? '⬆️' : '  ');
                console.log(`    Y=${checkY}: ${materialName} ${marker}`);
              }
            }
            
            validPlacements.push({
              chunkX: x,
              chunkZ: z,
              chunkY: surfaceHeight,
              worldX,
              worldY,
              worldZ,
              surfaceHeight,
              suitability: 0.8,
              materialType: surfaceMaterial,
              slope: 0,
              flatness: 1.0
            });
          }
        }
      }
    }
    
    console.log(`📍 Found ${validPlacements.length} valid placement points for chunk (${chunkX},${chunkZ})`);
    
    // Debug: Show chunk world bounds for verification
    console.log(`🗺️ Chunk (${chunkX},${chunkZ}) world bounds:`);
    console.log(`   X: ${chunkWorldOffsetX - WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE / 2} to ${chunkWorldOffsetX + WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE / 2}`);
    console.log(`   Z: ${chunkWorldOffsetZ - WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE / 2} to ${chunkWorldOffsetZ + WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE / 2}`);
    
    if (validPlacements.length > 0) {
      const firstPlacement = validPlacements[0];
      const lastPlacement = validPlacements[validPlacements.length - 1];
      console.log(`🎯 Placement range: (${firstPlacement.worldX.toFixed(1)}, ${firstPlacement.worldZ.toFixed(1)}) to (${lastPlacement.worldX.toFixed(1)}, ${lastPlacement.worldZ.toFixed(1)})`);
    }
    
    return {
      validPlacements,
      chunkX,
      chunkZ,
      terrainData,
      coordinateMatched: true
    };
  }

  /**
   * Calculate terrain-driven vegetation parameters
   */
  calculateTerrainDrivenParams(surfaceAnalysis) {
    const validCount = surfaceAnalysis.validPlacements?.length || 0;
    
    // Adjust tree count based on available suitable areas
    const baseTreeCount = Math.min(3, Math.max(1, Math.floor(validCount / 10)));
    
    return {
      maxTrees: baseTreeCount,
      densityMultiplier: 1.0,
      placementStrategy: 'COORDINATE_MATCHED',
      terrainAdaptive: true
    };
  }

  /**
   * Validate vegetation placement coordinates match terrain
   */
  validateVegetationPlacement(vegetationResult, chunkX, chunkZ, terrainData) {
    const chunkKey = `${chunkX},${chunkZ}`;
    const cached = this.chunkTerrainCache.get(chunkKey);
    
    if (!cached || !vegetationResult.trees) {
      return vegetationResult;
    }
    
    const validatedTrees = [];
    const corrections = [];
    
    for (const tree of vegetationResult.trees) {
      const correction = this.validateTreePlacement(tree, cached, chunkX, chunkZ);
      
      if (correction.valid) {
        validatedTrees.push({
          ...tree,
          position: correction.correctedPosition,
          coordinateMatched: true
        });
      } else {
        corrections.push({
          original: tree.position,
          reason: correction.reason
        });
      }
    }
    
    if (corrections.length > 0) {
      console.log(`🔧 Corrected ${corrections.length} tree placements for coordinate matching`);
    }
    
    return {
      ...vegetationResult,
      trees: validatedTrees,
      placedTrees: validatedTrees.length,
      corrections,
      coordinateValidated: true
    };
  }

  /**
   * Validate individual tree placement
   */
  validateTreePlacement(tree, cached, chunkX, chunkZ) {
    const { position } = tree;
    const chunkWorldSize = WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
    const chunkWorldOffsetX = chunkX * chunkWorldSize;
    const chunkWorldOffsetZ = chunkZ * chunkWorldSize;
    
    // Convert world position back to chunk coordinates
    const chunkLocalX = Math.floor(position.x - chunkWorldOffsetX + WORLD_CONFIG.CHUNK_SIZE / 2);
    const chunkLocalZ = Math.floor(position.z - chunkWorldOffsetZ + WORLD_CONFIG.CHUNK_SIZE / 2);
    
    // Check bounds
    if (chunkLocalX < 0 || chunkLocalX >= WORLD_CONFIG.CHUNK_SIZE ||
        chunkLocalZ < 0 || chunkLocalZ >= WORLD_CONFIG.CHUNK_SIZE) {
      return {
        valid: false,
        reason: 'outside_chunk_bounds'
      };
    }
    
    // Get accurate surface height
    const accurateSurfaceHeight = cached.surfaceMap.get(`${chunkLocalX},${chunkLocalZ}`);
    
    if (!accurateSurfaceHeight || accurateSurfaceHeight === 0) {
      return {
        valid: false,
        reason: 'no_surface_found'
      };
    }
    
    // Place tree exactly on top of the solid voxel surface
    // Surface height is Y+1 of the highest solid voxel, so tree base sits exactly on top
    const accurateWorldY = accurateSurfaceHeight * WORLD_CONFIG.VOXEL_SIZE;
    
    // Use EXACT same coordinate calculation as terrain generation for tree base position
    const correctedWorldX = (chunkLocalX - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetX;
    const correctedWorldZ = (chunkLocalZ - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetZ;
    
    // Tree base position - exactly on top of solid voxel surface
    // Note: Tree trunk geometry is centered, so we need to account for trunk height when positioning
    const correctedPosition = new THREE.Vector3(
      correctedWorldX,
      accurateWorldY,
      correctedWorldZ
    );
    
    // Debug logging for coordinate verification
    const heightCorrected = Math.abs(position.y - accurateWorldY) > 0.5;
    const xCorrected = Math.abs(position.x - correctedWorldX) > 0.1;
    const zCorrected = Math.abs(position.z - correctedWorldZ) > 0.1;
    
    if (heightCorrected || xCorrected || zCorrected) {
      console.log(`🔧 Tree position corrected: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}) -> (${correctedWorldX.toFixed(1)}, ${accurateWorldY.toFixed(1)}, ${correctedWorldZ.toFixed(1)})`);
      console.log(`   Chunk local: (${chunkLocalX}, ${chunkLocalZ}) Surface height: ${accurateSurfaceHeight}`);
    }
    
    return {
      valid: true,
      correctedPosition,
      heightCorrected,
      coordinateCorrected: xCorrected || zCorrected
    };
  }

  // Utility methods
  getSurfaceHeight(terrainData, x, z) {
    for (let y = WORLD_CONFIG.CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (terrainData[x][z][y] !== MATERIAL_TYPES.AIR) {
        return y + 1;
      }
    }
    return 0;
  }

  analyzeAreaFlatness(terrainData, centerX, centerZ, radius) {
    const heights = [];
    
    for (let x = Math.max(0, centerX - radius); x < Math.min(WORLD_CONFIG.CHUNK_SIZE, centerX + radius); x++) {
      for (let z = Math.max(0, centerZ - radius); z < Math.min(WORLD_CONFIG.CHUNK_SIZE, centerZ + radius); z++) {
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(z - centerZ, 2));
        if (distance <= radius) {
          heights.push(this.getSurfaceHeight(terrainData, x, z));
        }
      }
    }
    
    if (heights.length === 0) return { avgHeight: 0, heightVariation: 999 };
    
    const avgHeight = heights.reduce((sum, h) => sum + h, 0) / heights.length;
    const maxHeight = Math.max(...heights);
    const minHeight = Math.min(...heights);
    
    return {
      avgHeight,
      heightVariation: maxHeight - minHeight,
      minHeight,
      maxHeight
    };
  }

  calculateSlope(terrainData, x, z, surfaceHeight) {
    const neighbors = [
      { dx: -1, dz: 0 }, { dx: 1, dz: 0 },
      { dx: 0, dz: -1 }, { dx: 0, dz: 1 }
    ];
    
    let maxHeightDiff = 0;
    
    for (const neighbor of neighbors) {
      const nx = x + neighbor.dx;
      const nz = z + neighbor.dz;
      
      if (nx >= 0 && nx < WORLD_CONFIG.CHUNK_SIZE && nz >= 0 && nz < WORLD_CONFIG.CHUNK_SIZE) {
        const neighborHeight = this.getSurfaceHeight(terrainData, nx, nz);
        const heightDiff = Math.abs(surfaceHeight - neighborHeight);
        maxHeightDiff = Math.max(maxHeightDiff, heightDiff);
      }
    }
    
    return maxHeightDiff;
  }

  calculateLocalFlatness(terrainData, x, z, surfaceHeight, radius) {
    const area = this.analyzeAreaFlatness(terrainData, x, z, radius);
    return Math.max(0, 1 - (area.heightVariation / 10)); // 0-1 scale
  }

  getMaterialSuitability(materialType) {
    const preferences = {
      [MATERIAL_TYPES.GRASS]: 1.0,
      [MATERIAL_TYPES.DIRT]: 0.8,
      [MATERIAL_TYPES.STONE]: 0.4,
      [MATERIAL_TYPES.SAND]: 0.6
    };
    
    return preferences[materialType] || 0.3;
  }

  /**
   * Clear cache for specific chunk
   */
  clearChunkCache(chunkX, chunkZ) {
    const chunkKey = `${chunkX},${chunkZ}`;
    this.chunkTerrainCache.delete(chunkKey);
    this.flatAreaCache.delete(chunkKey);
  }

  /**
   * Get integration statistics
   */
  getIntegrationStats() {
    return {
      cachedChunks: this.chunkTerrainCache.size,
      flatAreaCache: this.flatAreaCache.size,
      coordinateMatching: true,
      guaranteedAreas: false
    };
  }
}

// Export singleton
export const globalTerrainVegetationIntegrator = new TerrainVegetationIntegrator(); 