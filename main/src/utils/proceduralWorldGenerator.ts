import { MaterialType, getWeightedRandomMaterial } from '../types/materials';
import { CUBE_SIZE_X, CUBE_SIZE_Y, CUBE_SIZE_Z } from './voxelUtils';
import { WorldGenerationConfig, DEFAULT_WORLD_CONFIG } from '../config/worldGeneration';

/**
 * Procedural world generation system that creates realistic layered terrain
 */
export class ProceduralWorldGenerator {
  private config: WorldGenerationConfig;

  constructor(config: WorldGenerationConfig = DEFAULT_WORLD_CONFIG) {
    this.config = config;
  }

  /**
   * Updates the world generation configuration
   */
  updateConfig(config: Partial<WorldGenerationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Calculates the distance from the center of the world
   * Supports both legacy cube-based coordinates and new planet-based coordinates
   */
  private getDistanceFromCenter(x: number, y: number, z: number): number {
    // Check if we're using proportional planet-based generation
    if (this.config.planetRadius && this.config.planetRadius > 0) {
      // For planet-based generation, center is at (0, 0, 0)
      return Math.sqrt(x * x + y * y + z * z);
    }
    
    // Legacy cube-based generation
    const centerX = (CUBE_SIZE_X - 1) / 2;
    const centerY = (CUBE_SIZE_Y - 1) / 2;
    const centerZ = (CUBE_SIZE_Z - 1) / 2;
    
    return Math.sqrt(
      Math.pow(x - centerX, 2) + 
      Math.pow(y - centerY, 2) + 
      Math.pow(z - centerZ, 2)
    );
  }

  /**
   * Gets the effective core radius based on configuration
   */
  private getCoreRadius(): number {
    // Use proportional radius if available
    if (this.config.planetRadius && this.config.coreRadiusPercent) {
      return this.config.planetRadius * this.config.coreRadiusPercent;
    }
    
    // Fallback to legacy static radius
    return this.config.coreRadius;
  }

  /**
   * Gets the effective planet radius
   */
  private getPlanetRadius(): number {
    return this.config.planetRadius || Math.max(CUBE_SIZE_X, CUBE_SIZE_Y, CUBE_SIZE_Z) / 2;
  }

  /**
   * Determines if a position is on the surface
   * Always uses cube-based surface detection, but supports dynamic cube sizes
   */
  private isOnSurface(x: number, y: number, z: number): boolean {
    // Check if we're using proportional planet-based generation
    if (this.config.planetRadius && this.config.planetRadius > 0) {
      // For proportional generation, cube extends from -planetRadius to +planetRadius
      const cubeHalfSize = this.config.planetRadius;
      
      // Surface is any of the 6 outer faces of the cube
      return (
        x === -cubeHalfSize ||        // Left face
        x === cubeHalfSize ||         // Right face
        y === -cubeHalfSize ||        // Bottom face  
        y === cubeHalfSize ||         // Top face
        z === -cubeHalfSize ||        // Front face
        z === cubeHalfSize            // Back face
      );
    }
    
    // Legacy cube-based surface detection
    return (
      x === 0 ||                    // Left face
      x === CUBE_SIZE_X - 1 ||      // Right face
      y === 0 ||                    // Bottom face  
      y === CUBE_SIZE_Y - 1 ||      // Top face
      z === 0 ||                    // Front face
      z === CUBE_SIZE_Z - 1         // Back face
    );
  }

  /**
   * Determines if a position should be air (outside the world bounds or in cavities)
   */
  private isAir(x: number, y: number, z: number): boolean {
    // Check if we're using proportional planet-based generation
    if (this.config.planetRadius && this.config.planetRadius > 0) {
      const cubeHalfSize = this.config.planetRadius;
      // Air is outside the cube boundaries
      return x < -cubeHalfSize || x > cubeHalfSize || 
             y < -cubeHalfSize || y > cubeHalfSize || 
             z < -cubeHalfSize || z > cubeHalfSize;
    }
    
    // Legacy cube-based bounds checking
    return x < 0 || x >= CUBE_SIZE_X || 
           y < 0 || y >= CUBE_SIZE_Y || 
           z < 0 || z >= CUBE_SIZE_Z;
  }

  /**
   * Gets a material using weighted random selection based on rarity
   */
  private getWeightedMaterial(): MaterialType {
    return getWeightedRandomMaterial();
  }

  /**
   * Generates the material type for a specific voxel position
   */
  generateMaterialForPosition(x: number, y: number, z: number): MaterialType {
    const distanceFromCenter = this.getDistanceFromCenter(x, y, z);
    const coreRadius = this.getCoreRadius();
    
    // TEMPORARY TEST: Force some gold blocks in specific locations for testing
    if ((x === 5 && y === 5 && z === 5) || 
        (x === 10 && y === 10 && z === 10) ||
        (x === 15 && y === 8 && z === 12)) {
      console.log(`🧪 FORCED GOLD BLOCK at (${x}, ${y}, ${z})`);
      return MaterialType.GOLD;
    }
    
    // TEMPORARY TEST: Force some copper and silver blocks too
    if ((x === 7 && y === 7 && z === 7) || (x === 12 && y === 6 && z === 8)) {
      console.log(`🧪 FORCED COPPER BLOCK at (${x}, ${y}, ${z})`);
      return MaterialType.COPPER;
    }
    
    if (x === 8 && y === 9 && z === 6) {
      console.log(`🧪 FORCED SILVER BLOCK at (${x}, ${y}, ${z})`);
      return MaterialType.SILVER;
    }
    
    // Skip air positions
    if (this.isAir(x, y, z)) {
      return MaterialType.STONE; // Fallback for air positions (shouldn't happen in practice)
    }
    
    // Layer 1: Lava Core
    if (distanceFromCenter <= coreRadius) {
      return MaterialType.LAVA;
    }
    
    // Layer 2: Surface (grass on top)
    if (this.isOnSurface(x, y, z)) {
      return MaterialType.GRASS;
    }
    
    // Layer 3: Middle layer - use weighted random selection based on material rarity
    return this.getWeightedMaterial();
  }

  /**
   * Generates materials for all voxels in the world
   */
  generateWorldMaterials(): MaterialType[] {
    const materials: MaterialType[] = [];
    
    // Generate materials for the main world grid
    for (let x = 0; x < CUBE_SIZE_X; x++) {
      for (let y = 0; y < CUBE_SIZE_Y; y++) {
        for (let z = 0; z < CUBE_SIZE_Z; z++) {
          materials.push(this.generateMaterialForPosition(x, y, z));
        }
      }
    }
    
    // Add material for the additional center cube (make it grass since it's on top)
    materials.push(MaterialType.GRASS);
    

    
    return materials;
  }

  /**
   * Gets the current configuration
   */
  getConfig(): WorldGenerationConfig {
    return { ...this.config };
  }
} 