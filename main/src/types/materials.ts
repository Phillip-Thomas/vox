import * as THREE from 'three';

export enum MaterialType {
  STONE = 'stone',
  DIRT = 'dirt',
  WOOD = 'wood',
  LAVA = 'lava',
  GRASS = 'grass',
  COPPER = 'copper',
  GOLD = 'gold',
  SILVER = 'silver',
  SAND = 'sand'
}

interface Material {
  color: THREE.Color;
  rarity: number; // Higher values = more common (used for weighted selection)
  // PBR properties consumed by the voxel shader (onBeforeCompile) via the
  // per-instance material id. Optional so future materials can omit them.
  roughness?: number;
  metalness?: number;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
}

export const MATERIALS: Record<MaterialType, Material> = {
  [MaterialType.STONE]: {
    color: new THREE.Color(0x858c90),
    rarity: 50,
    roughness: 0.92,
    metalness: 0.0
  },
  [MaterialType.DIRT]: {
    color: new THREE.Color(0x8B4513),
    rarity: 300,
    roughness: 0.98,
    metalness: 0.0
  },
  [MaterialType.WOOD]: {
    color: new THREE.Color(0x8B4513),
    rarity: 25,
    roughness: 0.85,
    metalness: 0.0
  },
  [MaterialType.LAVA]: {
    color: new THREE.Color(0xFF0000),
    rarity: 0,
    roughness: 0.6,
    metalness: 0.0,
    emissive: new THREE.Color(0xff5a1e),
    emissiveIntensity: 1.6
  },
  [MaterialType.GRASS]: {
    color: new THREE.Color(0x7CB342),
    rarity: 0,
    roughness: 0.9,
    metalness: 0.0
  },
  [MaterialType.COPPER]: {
    color: new THREE.Color(0xB87333),
    rarity: 12,
    roughness: 0.35,
    metalness: 0.9,
    emissive: new THREE.Color(0x441100),
    emissiveIntensity: 0.18
  },
  [MaterialType.GOLD]: {
    color: new THREE.Color(0xFFD700), // Classic gold color
    rarity: 3,
    roughness: 0.22,
    metalness: 1.0,
    emissive: new THREE.Color(0x332200),
    emissiveIntensity: 0.18
  },
  [MaterialType.SILVER]: {
    color: new THREE.Color(0xC0C0C0),
    rarity: 8,
    roughness: 0.18,
    metalness: 0.95
  },
  // Coastline / seabed surface near sea level (Phase 4). rarity 0 so it is never
  // picked by the weighted ore selection; it is only placed deterministically by
  // the surface logic in proceduralWorldGenerator.
  [MaterialType.SAND]: {
    color: new THREE.Color(0xC2B280),
    rarity: 0,
    roughness: 0.95,
    metalness: 0.0
  }
};

// Stable integer id per material, packed into the per-instance shader attribute
// (aInstanceData.x). Order is the source of truth for the shader LUTs — append
// new materials at the END so existing ids never shift.
export const MATERIAL_ORDER: MaterialType[] = [
  MaterialType.STONE,
  MaterialType.DIRT,
  MaterialType.WOOD,
  MaterialType.LAVA,
  MaterialType.GRASS,
  MaterialType.COPPER,
  MaterialType.GOLD,
  MaterialType.SILVER,
  // APPEND ONLY — never reorder. Existing ids are baked into the per-instance
  // shader attribute (aInstanceData.x). SAND is the newest id (Phase 4).
  MaterialType.SAND
];

export const MATERIAL_ID: Record<string, number> = Object.fromEntries(
  MATERIAL_ORDER.map((mat, index) => [mat, index])
);

export function materialId(material: string): number {
  return MATERIAL_ID[material] ?? 0;
}
