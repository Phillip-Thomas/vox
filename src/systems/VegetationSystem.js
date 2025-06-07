import * as THREE from 'three';
import { WORLD_CONFIG, MATERIAL_TYPES } from '../constants/world';
import { VEGETATION_CONFIG, PLACEMENT_TYPES } from '../constants/vegetation';
import { TreeGenerator } from '../generators/TreeGenerator';
import { globalCollisionSystem } from '../utils/VoxelCollisionSystem';

export class VegetationSystem {
  constructor() {
    this.treeGenerator = new TreeGenerator();
    this.placedVegetation = new Map(); // Track placed vegetation by chunk
    this.vegetationMeshes = new Map(); // Store generated meshes
    this.noiseGenerator = this.createNoiseGenerator();
    
    // Performance tracking
    this.stats = {
      totalTrees: 0,
      totalVertices: 0,
      chunksProcessed: 0,
      placementAttempts: 0,
      successfulPlacements: 0,
    };
  }

  createNoiseGenerator() {
    // Simple noise function for vegetation density
    return {
      noise2D: (x, z, seed = 42) => {
        const a = 15485863;
        const b = 521288629;
        const c = 1376312589;
        const hash = ((x * a) ^ (z * b) ^ seed) * c;
        return ((hash % 2147483647) / 2147483647) * 2 - 1;
      }
    };
  }

  /**
   * Analyze terrain chunk for vegetation placement opportunities
   * @param {number} chunkX - Chunk X coordinate
   * @param {number} chunkZ - Chunk Z coordinate
   * @param {Array} voxelData - 3D voxel data array
   * @returns {Array} - Array of placement opportunities
   */
  analyzeTerrainForPlacement(chunkX, chunkZ, voxelData) {
    const placements = [];
    const minFlatArea = VEGETATION_CONFIG.GENERATION.MIN_FLAT_AREA;
    const flatnessTolerance = VEGETATION_CONFIG.TREE.PLACEMENT.FLATNESS_TOLERANCE;
    
    // Emergency: Sample every 8th position to reduce analysis load
    const sampleStride = 8;
    const maxAnalysisPoints = VEGETATION_CONFIG.GENERATION.MAX_ANALYSIS_POINTS;
    let analysisCount = 0;
    
    // Scan for potential tree placement locations with reduced sampling
    for (let x = minFlatArea; x < WORLD_CONFIG.CHUNK_SIZE - minFlatArea; x += sampleStride) {
      for (let z = minFlatArea; z < WORLD_CONFIG.CHUNK_SIZE - minFlatArea; z += sampleStride) {
        
        // Hard limit to prevent memory explosion
        if (++analysisCount > maxAnalysisPoints) {
          console.log(`⚠️ Hit analysis limit of ${maxAnalysisPoints} points, stopping terrain scan`);
          break;
        }
        
        // Find surface height at this location
        const surfaceHeight = this.findSurfaceHeight(voxelData, x, z);
        if (surfaceHeight === -1) continue; // No surface found
        
        // Check if this location is suitable for vegetation
        const suitability = this.analyzePlacementSuitability(
          voxelData, x, z, surfaceHeight, minFlatArea, flatnessTolerance
        );
        
        if (suitability.suitable) {
          // Convert to world coordinates
          const chunkWorldSize = WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
          const chunkWorldOffsetX = chunkX * chunkWorldSize;
          const chunkWorldOffsetZ = chunkZ * chunkWorldSize;
          
          const worldX = (x - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetX;
          const worldZ = (z - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetZ;
          const worldY = (surfaceHeight + 1) * WORLD_CONFIG.VOXEL_SIZE; // Place on top of surface
          
          placements.push({
            position: new THREE.Vector3(worldX, worldY, worldZ),
            localPosition: { x, z, y: surfaceHeight },
            suitability,
            chunkX,
            chunkZ,
          });
        } else if (placements.length < 10) {
          // Log first 10 rejections for debugging
          console.log(`❌ Rejected placement at (${x},${z}) height ${surfaceHeight}: ${suitability.reason}`);
        }
      }
      // Break outer loop if we hit the analysis limit
      if (analysisCount > maxAnalysisPoints) break;
    }
    
    return placements;
  }

  /**
   * Find the surface height at a specific x,z location in voxel data
   */
  findSurfaceHeight(voxelData, x, z) {
    for (let y = WORLD_CONFIG.CHUNK_HEIGHT - 1; y >= 0; y--) {
      const materialType = voxelData[x][z][y];
      if (materialType !== MATERIAL_TYPES.AIR) {
        return y;
      }
    }
    return -1; // No surface found
  }

  /**
   * Analyze placement suitability for vegetation
   */
  analyzePlacementSuitability(voxelData, centerX, centerZ, surfaceHeight, minFlatArea, tolerance) {
    const result = {
      suitable: false,
      flatness: 0,
      materialSuitability: 0,
      reason: '',
    };

    // Check flatness in the required area
    let heightSum = 0;
    let validPoints = 0;
    let minHeight = surfaceHeight;
    let maxHeight = surfaceHeight;

    for (let dx = -minFlatArea; dx <= minFlatArea; dx++) {
      for (let dz = -minFlatArea; dz <= minFlatArea; dz++) {
        const checkX = centerX + dx;
        const checkZ = centerZ + dz;
        
        // Ensure we're within chunk bounds
        if (checkX < 0 || checkX >= WORLD_CONFIG.CHUNK_SIZE || 
            checkZ < 0 || checkZ >= WORLD_CONFIG.CHUNK_SIZE) {
          continue;
        }
        
        const height = this.findSurfaceHeight(voxelData, checkX, checkZ);
        if (height !== -1) {
          heightSum += height;
          validPoints++;
          minHeight = Math.min(minHeight, height);
          maxHeight = Math.max(maxHeight, height);
        }
      }
    }

    if (validPoints === 0) {
      result.reason = 'No valid surface points found';
      return result;
    }

    // Calculate flatness
    const heightVariation = maxHeight - minHeight;
    result.flatness = Math.max(0, 1 - (heightVariation / tolerance));

    if (heightVariation > tolerance) {
      result.reason = `Too steep: ${heightVariation} > ${tolerance}`;
      return result;
    }

    // Check material suitability
    const surfaceMaterial = Object.keys(MATERIAL_TYPES).find(
      key => MATERIAL_TYPES[key] === voxelData[centerX][centerZ][surfaceHeight]
    );
    
    const preferredMaterials = VEGETATION_CONFIG.TREE.PLACEMENT.PREFERRED_MATERIALS;
    const avoidMaterials = VEGETATION_CONFIG.TREE.PLACEMENT.AVOID_MATERIALS;
    
    if (avoidMaterials.includes(surfaceMaterial)) {
      result.reason = `Avoiding material: ${surfaceMaterial}`;
      return result;
    }
    
    // For testing, accept all materials with decent suitability
    result.materialSuitability = preferredMaterials.includes(surfaceMaterial) ? 1.0 : 0.8;

    // Check height preference
    const heightPref = VEGETATION_CONFIG.GENERATION.HEIGHT_PREFERENCE;
    const heightSuitability = surfaceHeight >= heightPref.min && surfaceHeight <= heightPref.max ? 1.0 : 0.3;

    // Overall suitability calculation - ultra permissive for testing
    const overallSuitability = result.flatness * result.materialSuitability * heightSuitability;
    
    if (overallSuitability > 0.01) { // Ultra-low threshold for testing
      result.suitable = true;
    } else {
      result.reason = `Low suitability: ${overallSuitability.toFixed(2)}`;
    }

    return result;
  }

  /**
   * Filter placement opportunities using density and spacing rules
   */
  filterPlacements(placements) {
    const filtered = [];
    const minDistance = VEGETATION_CONFIG.GENERATION.MIN_DISTANCE_BETWEEN_TREES;
    const densityScale = VEGETATION_CONFIG.GENERATION.DENSITY_SCALE;

    for (const placement of placements) {
      this.stats.placementAttempts++;
      
      // Use noise for natural distribution
      const densityNoise = this.noiseGenerator.noise2D(
        placement.position.x * densityScale,
        placement.position.z * densityScale
      );
      
      // Adjust density based on suitability and noise - ultra permissive for testing
      const densityThreshold = 0.95; // Very high threshold = very low barrier for tree placement
      
      if (densityNoise < densityThreshold) continue;
      
      // Check distance from existing vegetation
      let tooClose = false;
      for (const existing of filtered) {
        const distance = placement.position.distanceTo(existing.position);
        if (distance < minDistance) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        filtered.push(placement);
        this.stats.successfulPlacements++;
      }
    }

    return filtered;
  }

  /**
   * Generate vegetation for a chunk
   * @param {number} chunkX - Chunk X coordinate
   * @param {number} chunkZ - Chunk Z coordinate
   * @param {Array} voxelData - 3D voxel data array
   * @returns {Object} - Generated vegetation data
   */
  generateVegetationForChunk(chunkX, chunkZ, voxelData) {
    const startTime = performance.now();
    console.log(`🌲 Generating vegetation for chunk (${chunkX},${chunkZ})`);
    
    // Analyze terrain for placement opportunities
    const placements = this.analyzeTerrainForPlacement(chunkX, chunkZ, voxelData);
    console.log(`🔍 Found ${placements.length} potential placement locations`);
    
    // Filter placements based on density and spacing
    let filteredPlacements = this.filterPlacements(placements);
    
    // Enforce hard limit to prevent memory crashes
    const maxTrees = VEGETATION_CONFIG.GENERATION.MAX_TREES_PER_CHUNK;
    if (filteredPlacements.length > maxTrees) {
      filteredPlacements = filteredPlacements.slice(0, maxTrees);
      console.log(`⚠️ Limiting trees to ${maxTrees} per chunk to prevent crashes`);
    }
    
    // Emergency: If we still have too many potential placements, skip this chunk
    if (placements.length > 5000) {
      console.log(`💥 Emergency: Skipping chunk (${chunkX},${chunkZ}) - too many placement candidates (${placements.length})`);
      return { trees: [], chunkX, chunkZ };
    }
    
    console.log(`✅ Selected ${filteredPlacements.length} locations for vegetation`);
    
    // Generate trees at selected locations
    const vegetationData = {
      trees: [],
      chunkX,
      chunkZ,
    };
    

    
    for (const placement of filteredPlacements) {
      try {
        const tree = this.treeGenerator.generateTree({
          position: placement.position,
          suitability: placement.suitability,
          localPosition: placement.localPosition,
        });
        
        if (tree) {
          vegetationData.trees.push(tree);
          this.stats.totalTrees++;
          console.log(`✅ Successfully generated tree at (${Math.round(placement.position.x)}, ${Math.round(placement.position.y)}, ${Math.round(placement.position.z)})`);
        } else {
          console.log(`❌ Failed to generate tree at (${Math.round(placement.position.x)}, ${Math.round(placement.position.y)}, ${Math.round(placement.position.z)})`);
        }
      } catch (error) {
        console.error(`💥 Error generating tree:`, error);
      }
    }
    
    // Store vegetation data for this chunk
    const chunkKey = `${chunkX},${chunkZ}`;
    this.placedVegetation.set(chunkKey, vegetationData);
    this.stats.chunksProcessed++;
    
    const endTime = performance.now();
    const generationTime = endTime - startTime;
    
    console.log(`🌳 Generated ${vegetationData.trees.length} trees for chunk (${chunkX},${chunkZ}) in ${generationTime.toFixed(1)}ms`);
    
    if (vegetationData.trees.length > 0) {
      console.log(`🎯 Tree positions:`, vegetationData.trees.map(t => ({ 
        x: Math.round(t.position.x), 
        y: Math.round(t.position.y), 
        z: Math.round(t.position.z) 
      })));
    }
    
    // Warn if generation took too long
    if (generationTime > 1000) {
      console.warn(`⚠️ Vegetation generation took ${generationTime.toFixed(1)}ms - consider reducing density`);
    }
    
    // Emergency memory cleanup
    if (performance.memory && performance.memory.usedJSHeapSize > 100 * 1024 * 1024) { // 100MB threshold
      console.warn(`💥 High memory usage detected: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`);
      // Force garbage collection hint
      if (global.gc) {
        global.gc();
      }
    }
    
    return vegetationData;
  }

  /**
   * Generate vegetation for a chunk with provided surface analysis
   * Used by the integrated terrain-vegetation system
   */
  async generateChunkVegetation(chunkX, chunkZ, surfaceAnalysis, vegetationParams = {}) {
    const startTime = performance.now();
    
    // Use provided parameters or defaults
    const maxTrees = vegetationParams.maxTrees || VEGETATION_CONFIG.GENERATION.MAX_TREES_PER_CHUNK;
    const densityMultiplier = vegetationParams.densityMultiplier || 1.0;
    
    console.log(`🌱 Generating vegetation for chunk (${chunkX},${chunkZ}) with ${surfaceAnalysis.validPlacements?.length || 0} valid placements`);
    
    const vegetationData = {
      trees: [],
      chunkX,
      chunkZ,
      metadata: {
        generationTime: 0,
        placementStrategy: vegetationParams.placementStrategy || 'DEFAULT',
        terrainAdaptive: vegetationParams.terrainAdaptive || false
      }
    };

    if (!surfaceAnalysis.validPlacements || surfaceAnalysis.validPlacements.length === 0) {
      console.log(`⚠️ No valid placements for chunk (${chunkX},${chunkZ})`);
      return vegetationData;
    }

    // Filter and select placement locations using distance filtering
    const filteredPlacements = this.filterPlacementsByDistance(
      surfaceAnalysis.validPlacements, 
      VEGETATION_CONFIG.GENERATION.MIN_DISTANCE_BETWEEN_TREES
    );

    // Apply noise-based filtering with high threshold for sparsity
    const noisyFilteredPlacements = filteredPlacements.filter(placement => {
      const noiseValue = this.noiseGenerator.noise2D(
        placement.worldX * 0.01, 
        placement.worldZ * 0.01
      );
      return (noiseValue + 1) / 2 > 0.95; // Very high threshold for sparse placement
    });

    // Limit tree count
    const selectedPlacements = noisyFilteredPlacements.slice(0, maxTrees);
    
    console.log(`🎯 Selected ${selectedPlacements.length} out of ${filteredPlacements.length} potential placements`);

    // Generate trees at selected locations
    for (const placement of selectedPlacements) {
      try {
        // FINAL VALIDATION: Check collision system before generating tree
        const groundCheck = globalCollisionSystem.isSolid(
          placement.worldX, 
          placement.worldY - 1, // Check the voxel below where tree will be placed
          placement.worldZ
        );
        
        if (!groundCheck) {
          console.error(`🚫 FINAL CHECK FAILED: No solid terrain found at tree placement position (${placement.worldX.toFixed(1)}, ${(placement.worldY - 1).toFixed(1)}, ${placement.worldZ.toFixed(1)})`);
          this.stats.placementAttempts++;
          continue; // Skip this placement
        }
        
        const tree = this.treeGenerator.generateTree({
          position: new THREE.Vector3(placement.worldX, placement.worldY, placement.worldZ),
          suitability: { 
            flatness: placement.flatness || 1.0, 
            materialSuitability: placement.suitability || 0.8 
          },
          localPosition: { 
            x: placement.chunkX, 
            z: placement.chunkZ, 
            y: placement.chunkY 
          },
        });
        
        if (tree) {
          vegetationData.trees.push(tree);
          this.stats.totalTrees++;
          this.stats.successfulPlacements++;
          console.log(`✅ Tree generated at (${Math.round(placement.worldX)}, ${Math.round(placement.worldY)}, ${Math.round(placement.worldZ)})`);
          
          // CRITICAL: Cross-check with collision system to verify solid terrain exists
          const collisionCheck = globalCollisionSystem.isSolid(
            placement.worldX, 
            placement.worldY - 1, // Check the voxel below the tree
            placement.worldZ
          );
          console.log(`🔍 Collision system check: solid terrain at (${placement.worldX.toFixed(1)}, ${(placement.worldY - 1).toFixed(1)}, ${placement.worldZ.toFixed(1)}) = ${collisionCheck}`);
          
          if (!collisionCheck) {
            console.error(`❌ MISMATCH: Tree placed at position with no solid terrain according to collision system!`);
          }
        }
      } catch (error) {
        console.error(`💥 Error generating tree at (${placement.worldX}, ${placement.worldY}, ${placement.worldZ}):`, error);
      }
      
      this.stats.placementAttempts++;
    }

    // Store vegetation data for this chunk
    const chunkKey = `${chunkX},${chunkZ}`;
    this.placedVegetation.set(chunkKey, vegetationData);
    this.stats.chunksProcessed++;
    
    const endTime = performance.now();
    vegetationData.metadata.generationTime = endTime - startTime;
    
    console.log(`🌳 Generated ${vegetationData.trees.length} trees for chunk (${chunkX},${chunkZ}) in ${vegetationData.metadata.generationTime.toFixed(2)}ms`);
    
    return vegetationData;
  }

  /**
   * Filter placements by minimum distance to avoid overcrowding
   * @param {Array} placements - Array of placement objects
   * @param {number} minDistance - Minimum distance between placements
   * @returns {Array} - Filtered placements
   */
  filterPlacementsByDistance(placements, minDistance) {
    if (!placements || placements.length === 0) return [];
    
    const selected = [];
    const minDistSquared = minDistance * minDistance;
    
    // Sort by suitability score (highest first) to prioritize best locations
    const sortedPlacements = [...placements].sort((a, b) => {
      const scoreA = (a.suitability || 0.5) + (a.flatness || 0.5);
      const scoreB = (b.suitability || 0.5) + (b.flatness || 0.5);
      return scoreB - scoreA;
    });
    
    for (const placement of sortedPlacements) {
      let tooClose = false;
      
      // Check distance to all previously selected placements
      for (const selectedPlacement of selected) {
        const dx = placement.worldX - selectedPlacement.worldX;
        const dz = placement.worldZ - selectedPlacement.worldZ;
        const distSquared = dx * dx + dz * dz;
        
        if (distSquared < minDistSquared) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        selected.push(placement);
      }
    }
    
    return selected;
  }

  /**
   * Clear vegetation data for a specific chunk
   */
  clearChunk(chunkX, chunkZ) {
    const chunkKey = `${chunkX},${chunkZ}`;
    
    if (this.placedVegetation.has(chunkKey)) {
      const data = this.placedVegetation.get(chunkKey);
      this.stats.totalTrees -= data.trees.length;
      this.placedVegetation.delete(chunkKey);
    }
    
    if (this.vegetationMeshes.has(chunkKey)) {
      this.vegetationMeshes.delete(chunkKey);
    }
  }

  /**
   * Get vegetation statistics
   */
  getStats() {
    return {
      ...this.stats,
      placementSuccessRate: this.stats.placementAttempts > 0 
        ? (this.stats.successfulPlacements / this.stats.placementAttempts * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  /**
   * Reset all vegetation data
   */
  resetAll() {
    this.placedVegetation.clear();
    this.vegetationMeshes.clear();
    this.stats = {
      totalTrees: 0,
      totalVertices: 0,
      chunksProcessed: 0,
      placementAttempts: 0,
      successfulPlacements: 0,
    };
    console.log('Vegetation system reset complete');
  }
}

// Create global vegetation system instance
export const globalVegetationSystem = new VegetationSystem(); 