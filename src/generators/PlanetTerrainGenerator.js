import { TerrainGenerator } from './TerrainGenerator';
import { WORLD_CONFIG, MATERIAL_TYPES } from '../constants/world';

/**
 * Spherical Planet Terrain Generator
 * Generates a simple spherical planet made of voxels
 */
export class PlanetTerrainGenerator extends TerrainGenerator {
  constructor() {
    super();
  }

  /**
   * Override updateParameters - spherical planet doesn't need parameter updates
   */
  updateParameters(newParams) {

  }

  /**
   * Generate chunk data for spherical planet
   */
  generateChunkData(chunkX, chunkZ) {

    
    // Initialize empty voxel array
    const voxelData = this.initializeVoxelArray();
    
    // Fill with spherical terrain
    this.generateSphericalTerrain(voxelData, chunkX, chunkZ);
    
    return voxelData;
  }

  /**
   * Generate spherical terrain for a chunk
   */
  generateSphericalTerrain(voxelData, chunkX, chunkZ) {
    const chunkWorldSize = WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
    const chunkWorldOffsetX = chunkX * chunkWorldSize;
    const chunkWorldOffsetZ = chunkZ * chunkWorldSize;

    for (let x = 0; x < WORLD_CONFIG.CHUNK_SIZE; x++) {
      for (let z = 0; z < WORLD_CONFIG.CHUNK_SIZE; z++) {
        // Convert chunk coordinates to world coordinates
        const worldX = (x - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetX;
        const worldZ = (z - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetZ;
        
        // Generate spherical terrain column for this position
        this.generateSphericalColumn(voxelData, x, z, worldX, worldZ);
      }
    }
  }

  /**
   * Generate a vertical column of spherical terrain
   */
  generateSphericalColumn(voxelData, localX, localZ, worldX, worldZ) {
    const planetRadius = WORLD_CONFIG.PLANET.SIZE;
    const distanceFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ);
    
    // Skip if outside sphere
    if (distanceFromCenter > planetRadius) {
      return;
    }

    // Calculate sphere heights using Pythagorean theorem: y = ±√(r² - x² - z²)
    const radiusSquared = planetRadius * planetRadius;
    const horizontalDistanceSquared = distanceFromCenter * distanceFromCenter;
    const sphereHeightFromCenter = Math.sqrt(radiusSquared - horizontalDistanceSquared);
    
    // Add small terrain variation
    const terrainVariation = this.generateSimpleNoise(worldX, worldZ) * 2;
    
    // Convert to voxel coordinates (centered at chunk height middle)
    const centerY = WORLD_CONFIG.CHUNK_HEIGHT / 2;
    const topSurfaceY = Math.floor(centerY + (sphereHeightFromCenter + terrainVariation) / WORLD_CONFIG.VOXEL_SIZE);
    const bottomSurfaceY = Math.floor(centerY + (-sphereHeightFromCenter + terrainVariation) / WORLD_CONFIG.VOXEL_SIZE);

    // Fill voxels for the complete sphere
    for (let y = 0; y < WORLD_CONFIG.CHUNK_HEIGHT; y++) {
      if (y >= bottomSurfaceY && y <= topSurfaceY) {
        // Inside the sphere - determine material type based on distance from surface
        const distanceFromTopSurface = topSurfaceY - y;
        const distanceFromBottomSurface = y - bottomSurfaceY;
        const distanceFromNearestSurface = Math.min(distanceFromTopSurface, distanceFromBottomSurface);
        
        if (distanceFromNearestSurface <= 1) {
          voxelData[localX][localZ][y] = this.getSurfaceMaterial(worldX, worldZ);
        } else if (distanceFromNearestSurface <= 3) {
          voxelData[localX][localZ][y] = MATERIAL_TYPES.DIRT;
        } else {
          voxelData[localX][localZ][y] = MATERIAL_TYPES.STONE;
        }
      }
      // else remains AIR (default initialization)
    }
  }

  /**
   * Get surface material based on position
   */
  getSurfaceMaterial(worldX, worldZ) {
    const noiseValue = this.generateSimpleNoise(worldX, worldZ);
    
    if (noiseValue > 0.5) {
      return MATERIAL_TYPES.STONE;
    } else if (noiseValue > 0) {
      return MATERIAL_TYPES.GRASS;
    } else {
      return MATERIAL_TYPES.DIRT;
    }
  }

  /**
   * Simple noise generation for terrain variation
   */
  generateSimpleNoise(x, y) {
    const seed = WORLD_CONFIG.NOISE_SEED;
    const scale = 0.02;
    return Math.sin(x * scale + seed) * Math.cos(y * scale + seed);
  }

  /**
   * Initialize empty voxel array (all AIR)
   */
  initializeVoxelArray() {
    const voxelData = [];
    for (let x = 0; x < WORLD_CONFIG.CHUNK_SIZE; x++) {
      voxelData[x] = [];
      for (let z = 0; z < WORLD_CONFIG.CHUNK_SIZE; z++) {
        voxelData[x][z] = [];
        for (let y = 0; y < WORLD_CONFIG.CHUNK_HEIGHT; y++) {
          voxelData[x][z][y] = MATERIAL_TYPES.AIR;
        }
      }
    }
    return voxelData;
  }
}

export default PlanetTerrainGenerator; 