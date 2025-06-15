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

// Create a global instance of the procedural world generator
let worldGenerator = new ProceduralWorldGenerator(DEFAULT_WORLD_CONFIG);

/**
 * Updates the world generation configuration and regenerates if needed
 */
export function updateWorldGenerationConfig(config: Partial<WorldGenerationConfig>): void {
  worldGenerator.updateConfig(config);
}

/**
 * Gets the current world generation configuration
 */
export function getWorldGenerationConfig(): WorldGenerationConfig {
  return worldGenerator.getConfig();
}

/**
 * Generates materials and colors for ALL voxel instances using procedural generation
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

  
  try {
    await textureManager.loadAllTextures();

  } catch (error) {
    console.warn('Some textures failed to load, using fallbacks:', error);
  }
  
  // Generate materials using the procedural world generator
  const proceduralMaterials = worldGenerator.generateWorldMaterials();
  
  // Convert materials to colors and textures
  const materialCounts = new Map<MaterialType, number>();
  
  // MEMORY LEAK FIX: Cache colors to avoid creating thousands of Color objects
  const colorCache = new Map<MaterialType, THREE.Color>();
  
  proceduralMaterials.forEach(materialType => {
    const material = MATERIALS[materialType];
    materials.push(materialType);
    
    // Use cached color or create once and cache
    let cachedColor = colorCache.get(materialType);
    if (!cachedColor) {
      cachedColor = material.color.clone();
      colorCache.set(materialType, cachedColor);
    }
    colors.push(cachedColor);
    
    // Count materials
    materialCounts.set(materialType, (materialCounts.get(materialType) || 0) + 1);
    

    // Get texture if material has one
    if (material.hasTexture) {
      const texture = textureManager.getTexture(materialType);
      textures.push(texture);
    } else {
      textures.push(null);
    }
  });
  
  // Debug: Log material distribution
  console.log('📊 Material Distribution:');
  materialCounts.forEach((count, materialType) => {
    console.log(`   ${materialType}: ${count} blocks`);
  });
  
  // Specifically highlight valuable materials
  const valuableMaterials = [MaterialType.GOLD, MaterialType.SILVER, MaterialType.COPPER];
  const valuableCount = valuableMaterials.reduce((sum, type) => sum + (materialCounts.get(type) || 0), 0);
  console.log(`💎 Total valuable blocks: ${valuableCount} (Gold: ${materialCounts.get(MaterialType.GOLD) || 0}, Silver: ${materialCounts.get(MaterialType.SILVER) || 0}, Copper: ${materialCounts.get(MaterialType.COPPER) || 0})`);

  
  return { instanceColors: colors, instanceMaterials: materials, instanceTextures: textures };
} 