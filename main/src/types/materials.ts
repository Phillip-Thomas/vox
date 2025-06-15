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
  hasTexture: boolean; // Whether this material should use texture instead of solid color
  emissive?: THREE.Color; // Emissive color for glow effects
  emissiveIntensity?: number; // Intensity of the glow (0-1)
  metalness?: number; // Metallic property (0-1)
  roughness?: number; // Surface roughness (0-1)
}

// Define materials with their properties and rarity values
export const MATERIALS: Record<MaterialType, Material> = {
  [MaterialType.STONE]: {
    type: MaterialType.STONE,
    color: new THREE.Color(0x858c90), // Light gray - works well with ambient lighting
    visible: true,
    rarity: 50, // Common, but much less than dirt
    hasTexture: true
  },
  [MaterialType.DIRT]: {
    type: MaterialType.DIRT,
    color: new THREE.Color(0x8B4513), // Rich brown - matches texture
    visible: true,
    rarity: 300, // Very dominant - most of the world
    hasTexture: true
  },
  [MaterialType.WOOD]: {
    type: MaterialType.WOOD,
    color: new THREE.Color(0x8B4513), // Rich brown - matches texture
    visible: true,
    rarity: 25, // Uncommon
    hasTexture: true
  },
  [MaterialType.WATER]: {
    type: MaterialType.WATER,
    color: new THREE.Color(0x4A90E2), // Blue water - matches texture
    visible: true,
    rarity: 0, // Not used in world generation
    hasTexture: true
  },
  [MaterialType.LAVA]: {
    type: MaterialType.LAVA,
    color: new THREE.Color(0xFF0000), // Pure red - matches texture
    visible: true,
    rarity: 0, // Only used for core, not in weighted selection
    hasTexture: true
  },
  [MaterialType.GRASS]: {
    type: MaterialType.GRASS,
    color: new THREE.Color(0x7CB342), // Vibrant green - matches texture
    visible: true,
    rarity: 0, // Only used for surface, not in weighted selection
    hasTexture: true
  },
  [MaterialType.COPPER]: {
    type: MaterialType.COPPER,
    color: new THREE.Color(0xB87333), // More vibrant copper color
    visible: true,
    rarity: 12, // Uncommon mineral
    hasTexture: true,
    emissive: new THREE.Color(0x441100), // Warmer copper glow
    emissiveIntensity: 0.5,
    metalness: 0.9, // High metalness for shine
    roughness: 0.1 // Low roughness for reflectivity
  },
  [MaterialType.GOLD]: {
    type: MaterialType.GOLD,
    color: new THREE.Color(0xFFD700), // Classic gold color
    visible: true,
    rarity: 100, // TEMPORARILY HIGH for testing - should be easy to find
    hasTexture: true,
    emissive: new THREE.Color(0x664400), // Rich golden glow
    emissiveIntensity: 0.6,
    metalness: 1.0, // Maximum metalness for gold
    roughness: 0.05 // Very low roughness for mirror-like shine
  },
  [MaterialType.SILVER]: {
    type: MaterialType.SILVER,
    color: new THREE.Color(0xC0C0C0), // Brighter silver color
    visible: true,
    rarity: 8, // Rare mineral (between copper and gold)
    hasTexture: true,
    emissive: new THREE.Color(0x333333), // Cool silver glow
    emissiveIntensity: 0.55,
    metalness: 0.95, // High metalness for silver shine
    roughness: 0.08 // Low roughness for high reflectivity
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