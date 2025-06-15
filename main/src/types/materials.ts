import * as THREE from 'three';

// Material system
export enum MaterialType {
  STONE = 'stone',
  DIRT = 'dirt',
  WOOD = 'wood',
  WATER = 'water',
  LAVA = 'lava',
  GRASS = 'grass',
  COPPER = 'copper',
  GOLD = 'gold',
  SILVER = 'silver'
}

export interface Material {
  type: MaterialType;
  color: THREE.Color;
  visible: boolean;
  rarity: number; // Higher values = more common (used for weighted selection)
}

// Define materials with their properties and rarity values
export const MATERIALS: Record<MaterialType, Material> = {
  [MaterialType.STONE]: {
    type: MaterialType.STONE,
    color: new THREE.Color(0x808080), // Gray
    visible: true,
    rarity: 50 // Common, but much less than dirt
  },
  [MaterialType.DIRT]: {
    type: MaterialType.DIRT,
    color: new THREE.Color(0x8B4513), // Brown
    visible: true,
    rarity: 300 // Very dominant - most of the world
  },
  [MaterialType.WOOD]: {
    type: MaterialType.WOOD,
    color: new THREE.Color(0xDEB887), // Burlywood
    visible: true,
    rarity: 25 // Uncommon
  },
  [MaterialType.WATER]: {
    type: MaterialType.WATER,
    color: new THREE.Color(0x000000), // Black (invisible)
    visible: false,
    rarity: 0 // Not used in world generation
  },
  [MaterialType.LAVA]: {
    type: MaterialType.LAVA,
    color: new THREE.Color(0xFF4500), // Orange-red
    visible: true,
    rarity: 0 // Only used for core, not in weighted selection
  },
  [MaterialType.GRASS]: {
    type: MaterialType.GRASS,
    color: new THREE.Color(0x228B22), // Forest green
    visible: true,
    rarity: 0 // Only used for surface, not in weighted selection
  },
  [MaterialType.COPPER]: {
    type: MaterialType.COPPER,
    color: new THREE.Color(0xB87333), // Copper brown
    visible: true,
    rarity: 12 // Uncommon mineral
  },
  [MaterialType.GOLD]: {
    type: MaterialType.GOLD,
    color: new THREE.Color(0xFFD700), // Gold
    visible: true,
    rarity: 5 // Rare mineral (closer to other minerals)
  },
  [MaterialType.SILVER]: {
    type: MaterialType.SILVER,
    color: new THREE.Color(0xC0C0C0), // Silver
    visible: true,
    rarity: 8 // Rare mineral (between copper and gold)
  }
};

// Helper function to get a random material type
export const getRandomMaterialType = (): MaterialType => {
  const materialTypes = Object.values(MaterialType);
  return materialTypes[Math.floor(Math.random() * materialTypes.length)];
};

// Materials that can appear in the middle layer (have rarity > 0)
export const getMiddleLayerMaterials = (): MaterialType[] => {
  return Object.values(MaterialType).filter(type => MATERIALS[type].rarity > 0);
};

// Weighted random selection based on rarity values
export const getWeightedRandomMaterial = (): MaterialType => {
  const materials = getMiddleLayerMaterials();
  const totalWeight = materials.reduce((sum, type) => sum + MATERIALS[type].rarity, 0);
  
  let random = Math.random() * totalWeight;
  
  for (const materialType of materials) {
    random -= MATERIALS[materialType].rarity;
    if (random <= 0) {
      return materialType;
    }
  }
  
  // Fallback (should never reach here)
  return MaterialType.STONE;
}; 