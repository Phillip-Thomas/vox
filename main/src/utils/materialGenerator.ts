import * as THREE from 'three';
import { MaterialType, MATERIALS } from '../types/materials';
import { 
  CUBE_SIZE_X, 
  CUBE_SIZE_Y, 
  CUBE_SIZE_Z,
} from './voxelUtils';
import { ProceduralWorldGenerator } from './proceduralWorldGenerator';
import { WorldGenerationConfig, DEFAULT_WORLD_CONFIG } from '../config/worldGeneration';
import TextureManager from './textureLoader';

// OPTIMIZATION 3: Global material cache system to reduce memory usage
class MaterialCache {
  private static instance: MaterialCache;
  private colorCache = new Map<MaterialType, THREE.Color>();
  private materialCountCache = new Map<MaterialType, number>();
  private generatedMaterials: MaterialType[] = [];
  private lastGeneration = 0;
  
  static getInstance(): MaterialCache {
    if (!MaterialCache.instance) {
      MaterialCache.instance = new MaterialCache();
    }
    return MaterialCache.instance;
  }
  
  getCachedColor(materialType: MaterialType): THREE.Color {
    let cachedColor = this.colorCache.get(materialType);
    if (!cachedColor) {
      const material = MATERIALS[materialType];
      cachedColor = material.color.clone();
      this.colorCache.set(materialType, cachedColor);
    }
    return cachedColor;
  }
  
  // Cache procedural materials to avoid regeneration
  getCachedMaterials(): MaterialType[] {
    const currentTime = Date.now();
    // Regenerate materials every 30 seconds or if empty
    if (currentTime - this.lastGeneration > 30000 || this.generatedMaterials.length === 0) {
      this.generatedMaterials = worldGenerator.generateWorldMaterials();
      this.lastGeneration = currentTime;
      
      // Update material counts
      this.materialCountCache.clear();
      this.generatedMaterials.forEach(materialType => {
        this.materialCountCache.set(materialType, (this.materialCountCache.get(materialType) || 0) + 1);
      });
    }
    return this.generatedMaterials;
  }
  
  getMaterialCounts(): Map<MaterialType, number> {
    return this.materialCountCache;
  }
  
  clearCache(): void {
    this.colorCache.clear();
    this.materialCountCache.clear();
    this.generatedMaterials = [];
    this.lastGeneration = 0;
  }
}

// Create a global instance of the procedural world generator
let worldGenerator = new ProceduralWorldGenerator(DEFAULT_WORLD_CONFIG);

/**
 * Updates the world generation configuration and regenerates if needed
 */
export function updateWorldGenerationConfig(config: Partial<WorldGenerationConfig>): void {
  worldGenerator.updateConfig(config);
  // Clear material cache when config changes
  MaterialCache.getInstance().clearCache();
}

/**
 * Gets the current world generation configuration
 */
export function getWorldGenerationConfig(): WorldGenerationConfig {
  return worldGenerator.getConfig();
}

/**
 * OPTIMIZED: Generates materials and colors using cached system to reduce memory usage
 */
export async function generateInstanceMaterials(voxelSize: number): Promise<{
  instanceColors: THREE.Color[];
  instanceMaterials: MaterialType[];
  instanceTextures: (THREE.Texture | null)[];
}> {
  if (!voxelSize) return { instanceColors: [], instanceMaterials: [], instanceTextures: [] };
  
  const colors: THREE.Color[] = [];
  const materials: MaterialType[] = [];
  const textures: (THREE.Texture | null)[] = [];
  
  // Load all textures first
  const textureManager = TextureManager.getInstance();
  const materialCache = MaterialCache.getInstance();
  
  try {
    await textureManager.loadAllTextures();
  } catch (error) {
    console.warn('Some textures failed to load, using fallbacks:', error);
  }
  
  // OPTIMIZATION: Use cached materials instead of regenerating
  const proceduralMaterials = materialCache.getCachedMaterials();
  
  // Convert materials to colors and textures using cache
  proceduralMaterials.forEach(materialType => {
    const material = MATERIALS[materialType];
    materials.push(materialType);
    
    // OPTIMIZATION: Use cached color instead of creating new ones
    const cachedColor = materialCache.getCachedColor(materialType);
    colors.push(cachedColor);

    // Get texture if material has one
    if (material.hasTexture) {
      const texture = textureManager.getTexture(materialType);
      textures.push(texture);
    } else {
      textures.push(null);
    }
  });
  
  // OPTIMIZATION: Use cached material counts for debugging
  const materialCounts = materialCache.getMaterialCounts();
  
  // Debug: Log material distribution (throttled to reduce console spam)
  if (Math.random() < 0.1) { // Only log 10% of the time
    console.log('📊 Material Distribution:');
    materialCounts.forEach((count, materialType) => {
      console.log(`   ${materialType}: ${count} blocks`);
    });
    
    // Specifically highlight valuable materials
    const valuableMaterials = [MaterialType.GOLD, MaterialType.SILVER, MaterialType.COPPER];
    const valuableCount = valuableMaterials.reduce((sum, type) => sum + (materialCounts.get(type) || 0), 0);
    console.log(`💎 Total valuable blocks: ${valuableCount} (Gold: ${materialCounts.get(MaterialType.GOLD) || 0}, Silver: ${materialCounts.get(MaterialType.SILVER) || 0}, Copper: ${materialCounts.get(MaterialType.COPPER) || 0})`);
  }
  
  return { instanceColors: colors, instanceMaterials: materials, instanceTextures: textures };
} 