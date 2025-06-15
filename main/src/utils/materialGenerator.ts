import * as THREE from 'three';
import { MaterialType, MATERIALS } from '../types/materials';
import { 
  CUBE_SIZE_X, 
  CUBE_SIZE_Y, 
  CUBE_SIZE_Z,
} from './voxelUtils';
import { ProceduralWorldGenerator } from './proceduralWorldGenerator';
import { WorldGenerationConfig, DEFAULT_WORLD_CONFIG } from '../config/worldGeneration';

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
export function generateInstanceMaterials(voxelSize: number): {
  instanceColors: THREE.Color[];
  instanceMaterials: MaterialType[];
} {
  if (!voxelSize) return { instanceColors: [], instanceMaterials: [] };
  
  const colors: THREE.Color[] = [];
  const materials: MaterialType[] = [];
  
  // Generate materials using the procedural world generator
  const proceduralMaterials = worldGenerator.generateWorldMaterials();
  
  // Convert materials to colors
  proceduralMaterials.forEach(materialType => {
    const material = MATERIALS[materialType];
    materials.push(materialType);
    colors.push(material.color.clone());
  });
  
  console.log(`Generated ${materials.length} procedural materials for all voxels`);
  
  return { instanceColors: colors, instanceMaterials: materials };
} 