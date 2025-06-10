import * as THREE from 'three';

// Material system
export enum MaterialType {
  STONE = 'stone',
  DIRT = 'dirt',
  WOOD = 'wood',
  WATER = 'water'
}

export interface Material {
  type: MaterialType;
  color: THREE.Color;
  visible: boolean;
}

// Define materials with their properties
export const MATERIALS: Record<MaterialType, Material> = {
  [MaterialType.STONE]: {
    type: MaterialType.STONE,
    color: new THREE.Color(0x808080), // Gray
    visible: true
  },
  [MaterialType.DIRT]: {
    type: MaterialType.DIRT,
    color: new THREE.Color(0x8B4513), // Brown
    visible: true
  },
  [MaterialType.WOOD]: {
    type: MaterialType.WOOD,
    color: new THREE.Color(0xDEB887), // Burlywood
    visible: true
  },
  [MaterialType.WATER]: {
    type: MaterialType.WATER,
    color: new THREE.Color(0x000000), // Black (invisible)
    visible: false
  }
};

// Helper function to get a random material type
export const getRandomMaterialType = (): MaterialType => {
  const materialTypes = Object.values(MaterialType);
  return materialTypes[Math.floor(Math.random() * materialTypes.length)];
}; 