import * as THREE from 'three';
import { MaterialType, MATERIALS, getRandomMaterialType } from '../types/materials';
import { 
  CUBE_SIZE_X, 
  CUBE_SIZE_Y, 
  CUBE_SIZE_Z,
  createVoxelPositionSet,
  isVoxelExposed,
  getCenterCubeCoordinates
} from './voxelUtils';

/**
 * Generates materials and colors for ALL voxel instances (including hidden ones)
 */
export function generateInstanceMaterials(voxelSize: number): {
  instanceColors: THREE.Color[];
  instanceMaterials: MaterialType[];
} {
  if (!voxelSize) return { instanceColors: [], instanceMaterials: [] };
  
  const colors: THREE.Color[] = [];
  const materials: MaterialType[] = [];
  
  // Generate materials for ALL voxels (both exposed and hidden)
  for (let x = 0; x < CUBE_SIZE_X; x++) {
    for (let y = 0; y < CUBE_SIZE_Y; y++) {
      for (let z = 0; z < CUBE_SIZE_Z; z++) {
        const randomMaterialType = getRandomMaterialType();
        const material = MATERIALS[randomMaterialType];
        materials.push(randomMaterialType);
        colors.push(material.color.clone());
      }
    }
  }
  
  // Add material for the additional cube
  const randomMaterialType = getRandomMaterialType();
  const material = MATERIALS[randomMaterialType];
  materials.push(randomMaterialType);
  colors.push(material.color.clone());
  
  console.log(`Generated ${materials.length} materials for all voxels`);
  
  return { instanceColors: colors, instanceMaterials: materials };
} 