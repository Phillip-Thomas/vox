import * as THREE from 'three';
import { MaterialType } from '../types/materials';

// Simple 16x16 Minecraft-style texture data URLs (base64 encoded)
// These are basic placeholder textures that we can use immediately
export const TEXTURE_DATA_URLS: Record<MaterialType, string> = {
  [MaterialType.STONE]: createMinecraftTexture(MaterialType.STONE), // Realistic gray stone pattern
  [MaterialType.DIRT]: createMinecraftTexture(MaterialType.DIRT), // Rich brown dirt pattern  
  [MaterialType.WOOD]: createMinecraftTexture(MaterialType.WOOD), // Wood plank with grain pattern
  [MaterialType.WATER]: createMinecraftTexture(MaterialType.WATER), // Blue water with ripples
  [MaterialType.LAVA]: createMinecraftTexture(MaterialType.LAVA), // Bright red lava pattern
  [MaterialType.GRASS]: createMinecraftTexture(MaterialType.GRASS), // Vibrant grass pattern
  [MaterialType.COPPER]: createMinecraftTexture(MaterialType.COPPER), // Copper ore pattern
  [MaterialType.GOLD]: createMinecraftTexture(MaterialType.GOLD), // Gold ore pattern
  [MaterialType.SILVER]: createMinecraftTexture(MaterialType.SILVER), // Silver ore pattern
};

/**
 * Creates a realistic 16x16 Minecraft-style texture with proper patterns
 */
function createMinecraftTexture(materialType: MaterialType): string {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  
  // Log the color being used for each material type
  const colorMap: Record<MaterialType, string> = {
    [MaterialType.STONE]: '#808080 (gray)',
    [MaterialType.DIRT]: '#8B4513 (brown)', 
    [MaterialType.WOOD]: '#8B4513 (brown)',
    [MaterialType.WATER]: '#4A90E2 (blue)',
    [MaterialType.LAVA]: '#FF0000 (red)',
    [MaterialType.GRASS]: '#7CB342 (green)',
    [MaterialType.COPPER]: '#808080 base + #996633 veins (copper)',
    [MaterialType.GOLD]: '#808080 base + #FFFF00 veins (gold)',
    [MaterialType.SILVER]: '#808080 base + #C0C0C0 veins (silver)'
  };
  
  
  switch (materialType) {
    case MaterialType.STONE:
      return createStoneTexture(ctx);
    case MaterialType.DIRT:
      return createDirtTexture(ctx);
    case MaterialType.WOOD:
      return createWoodTexture(ctx);
    case MaterialType.WATER:
      return createWaterTexture(ctx);
    case MaterialType.LAVA:
      return createLavaTexture(ctx);
    case MaterialType.GRASS:
      return createGrassTexture(ctx);
    case MaterialType.COPPER:
      return createCopperOreTexture(ctx);
    case MaterialType.GOLD:
      return createGoldOreTexture(ctx);
    case MaterialType.SILVER:
      return createSilverOreTexture(ctx);
    default:
      return createDefaultTexture(ctx);
  }
}

function createStoneTexture(ctx: CanvasRenderingContext2D): string {
  // Base gray stone color - clearly gray
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 16, 16);
  
  // Add realistic stone pattern with clear grays
  const stonePattern = [
    { x: 1, y: 2, color: '#606060' },
    { x: 4, y: 1, color: '#A0A0A0' },
    { x: 7, y: 3, color: '#606060' },
    { x: 10, y: 1, color: '#A0A0A0' },
    { x: 13, y: 2, color: '#606060' },
    { x: 2, y: 5, color: '#A0A0A0' },
    { x: 6, y: 6, color: '#606060' },
    { x: 9, y: 7, color: '#A0A0A0' },
    { x: 12, y: 5, color: '#606060' },
    { x: 15, y: 6, color: '#A0A0A0' },
    { x: 1, y: 9, color: '#606060' },
    { x: 5, y: 10, color: '#A0A0A0' },
    { x: 8, y: 11, color: '#606060' },
    { x: 11, y: 9, color: '#A0A0A0' },
    { x: 14, y: 10, color: '#606060' },
    { x: 3, y: 13, color: '#A0A0A0' },
    { x: 6, y: 14, color: '#606060' },
    { x: 10, y: 13, color: '#A0A0A0' },
    { x: 13, y: 15, color: '#606060' },
  ];
  
  stonePattern.forEach(({ x, y, color }) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  });
  
  return ctx.canvas.toDataURL();
}

function createDirtTexture(ctx: CanvasRenderingContext2D): string {
  // Rich brown dirt color - clearly brown
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(0, 0, 16, 16);
  
  // Add dirt particle variations with obvious browns
  const dirtPattern = [
    { x: 2, y: 1, color: '#654321' },
    { x: 5, y: 2, color: '#A0522D' },
    { x: 8, y: 1, color: '#654321' },
    { x: 11, y: 3, color: '#A0522D' },
    { x: 14, y: 2, color: '#654321' },
    { x: 1, y: 5, color: '#A0522D' },
    { x: 4, y: 6, color: '#654321' },
    { x: 7, y: 7, color: '#A0522D' },
    { x: 10, y: 5, color: '#654321' },
    { x: 13, y: 6, color: '#A0522D' },
    { x: 3, y: 9, color: '#654321' },
    { x: 6, y: 10, color: '#A0522D' },
    { x: 9, y: 11, color: '#654321' },
    { x: 12, y: 9, color: '#A0522D' },
    { x: 15, y: 10, color: '#654321' },
    { x: 2, y: 13, color: '#A0522D' },
    { x: 5, y: 14, color: '#654321' },
    { x: 9, y: 13, color: '#A0522D' },
    { x: 12, y: 15, color: '#654321' },
  ];
  
  dirtPattern.forEach(({ x, y, color }) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  });
  
  return ctx.canvas.toDataURL();
}

function createWoodTexture(ctx: CanvasRenderingContext2D): string {
  // Wood plank color - clearly brown
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(0, 0, 16, 16);
  
  // Add wood grain lines (horizontal) with obvious brown shades
  for (let y = 2; y < 16; y += 4) {
    ctx.fillStyle = '#654321'; // Dark brown
    ctx.fillRect(0, y, 16, 1);
    ctx.fillStyle = '#A0522D'; // Light brown
    ctx.fillRect(0, y + 1, 16, 1);
  }
  
  // Add some wood knots with dark brown
  ctx.fillStyle = '#654321';
  ctx.fillRect(3, 6, 2, 1);
  ctx.fillRect(11, 10, 2, 1);
  ctx.fillRect(7, 14, 1, 1);
  
  return ctx.canvas.toDataURL();
}

function createWaterTexture(ctx: CanvasRenderingContext2D): string {
  // Blue water color
  ctx.fillStyle = '#4A90E2';
  ctx.fillRect(0, 0, 16, 16);
  
  // Add water ripple pattern
  const waterPattern = [
    { x: 1, y: 3, color: '#5BA0F2' },
    { x: 4, y: 2, color: '#3A7BC8' },
    { x: 7, y: 4, color: '#5BA0F2' },
    { x: 10, y: 1, color: '#3A7BC8' },
    { x: 13, y: 3, color: '#5BA0F2' },
    { x: 2, y: 7, color: '#3A7BC8' },
    { x: 6, y: 8, color: '#5BA0F2' },
    { x: 9, y: 6, color: '#3A7BC8' },
    { x: 12, y: 7, color: '#5BA0F2' },
    { x: 15, y: 5, color: '#3A7BC8' },
    { x: 1, y: 11, color: '#5BA0F2' },
    { x: 5, y: 12, color: '#3A7BC8' },
    { x: 8, y: 10, color: '#5BA0F2' },
    { x: 11, y: 13, color: '#3A7BC8' },
    { x: 14, y: 11, color: '#5BA0F2' },
  ];
  
  waterPattern.forEach(({ x, y, color }) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  });
  
  return ctx.canvas.toDataURL();
}

function createLavaTexture(ctx: CanvasRenderingContext2D): string {
  // Bright red lava base - clearly red
  ctx.fillStyle = '#FF0000';
  ctx.fillRect(0, 0, 16, 16);
  
  // Add hot spots and texture with obvious reds/oranges
  const lavaPattern = [
    { x: 2, y: 1, color: '#FF6600' }, // Orange
    { x: 5, y: 2, color: '#CC0000' }, // Dark red
    { x: 8, y: 1, color: '#FF6600' },
    { x: 11, y: 3, color: '#CC0000' },
    { x: 14, y: 2, color: '#FFFF00' }, // Yellow hot spot
    { x: 1, y: 5, color: '#CC0000' },
    { x: 4, y: 6, color: '#FF6600' },
    { x: 7, y: 7, color: '#FFFF00' },
    { x: 10, y: 5, color: '#CC0000' },
    { x: 13, y: 6, color: '#FF6600' },
    { x: 3, y: 9, color: '#FF6600' },
    { x: 6, y: 10, color: '#CC0000' },
    { x: 9, y: 11, color: '#FFFF00' },
    { x: 12, y: 9, color: '#FF6600' },
    { x: 15, y: 10, color: '#CC0000' },
    { x: 2, y: 13, color: '#CC0000' },
    { x: 5, y: 14, color: '#FF6600' },
    { x: 9, y: 13, color: '#FFFF00' },
    { x: 12, y: 15, color: '#CC0000' },
  ];
  
  lavaPattern.forEach(({ x, y, color }) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  });
  
  return ctx.canvas.toDataURL();
}

function createGrassTexture(ctx: CanvasRenderingContext2D): string {
  // Vibrant grass green
  ctx.fillStyle = '#7CB342';
  ctx.fillRect(0, 0, 16, 16);
  
  // Add grass blade variations
  const grassPattern = [
    { x: 1, y: 2, color: '#689F38' },
    { x: 4, y: 1, color: '#8BC34A' },
    { x: 7, y: 3, color: '#689F38' },
    { x: 10, y: 1, color: '#8BC34A' },
    { x: 13, y: 2, color: '#689F38' },
    { x: 2, y: 5, color: '#8BC34A' },
    { x: 6, y: 6, color: '#689F38' },
    { x: 9, y: 7, color: '#8BC34A' },
    { x: 12, y: 5, color: '#689F38' },
    { x: 15, y: 6, color: '#8BC34A' },
    { x: 1, y: 9, color: '#689F38' },
    { x: 5, y: 10, color: '#8BC34A' },
    { x: 8, y: 11, color: '#689F38' },
    { x: 11, y: 9, color: '#8BC34A' },
    { x: 14, y: 10, color: '#689F38' },
    { x: 3, y: 13, color: '#8BC34A' },
    { x: 6, y: 14, color: '#689F38' },
    { x: 10, y: 13, color: '#8BC34A' },
    { x: 13, y: 15, color: '#689F38' },
  ];
  
  grassPattern.forEach(({ x, y, color }) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  });
  
  return ctx.canvas.toDataURL();
}

function createCopperOreTexture(ctx: CanvasRenderingContext2D): string {
  // Darker stone base with bright copper veins
  ctx.fillStyle = '#555555';
  ctx.fillRect(0, 0, 16, 16);
  
  // Add bright, distinct copper veins
  const copperSpots = [
    { x: 2, y: 1, color: '#D4AF37', size: 2 }, // Bright gold-copper
    { x: 7, y: 3, color: '#CD853F', size: 2 }, // Sandy brown copper
    { x: 12, y: 2, color: '#B87333', size: 1 }, // Dark copper
    { x: 3, y: 6, color: '#D4AF37', size: 1 },
    { x: 9, y: 8, color: '#CD853F', size: 3 }, // Larger vein
    { x: 14, y: 9, color: '#B87333', size: 1 },
    { x: 1, y: 12, color: '#D4AF37', size: 2 },
    { x: 6, y: 14, color: '#CD853F', size: 1 },
  ];
  
  copperSpots.forEach(({ x, y, color, size }) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
  });
  
  return ctx.canvas.toDataURL();
}

function createGoldOreTexture(ctx: CanvasRenderingContext2D): string {
  // Dark stone base with extremely bright gold spots
  ctx.fillStyle = '#333333';
  ctx.fillRect(0, 0, 16, 16);
  
  // Add extremely bright, unmistakable gold veins
  const goldSpots = [
    { x: 2, y: 2, color: '#FFD700', size: 2 }, // Classic gold
    { x: 6, y: 1, color: '#FFF700', size: 1 }, // Bright yellow gold
    { x: 10, y: 4, color: '#FFED4E', size: 2 }, // Light gold
    { x: 13, y: 2, color: '#FFD700', size: 1 },
    { x: 1, y: 7, color: '#FFF700', size: 1 },
    { x: 8, y: 8, color: '#FFED4E', size: 3 }, // Large gold vein
    { x: 12, y: 11, color: '#FFD700', size: 2 },
    { x: 4, y: 13, color: '#FFF700', size: 1 },
  ];
  
  goldSpots.forEach(({ x, y, color, size }) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
  });
  
  return ctx.canvas.toDataURL();
}

function createSilverOreTexture(ctx: CanvasRenderingContext2D): string {
  // Dark stone base with bright silver spots
  ctx.fillStyle = '#444444';
  ctx.fillRect(0, 0, 16, 16);
  
  // Add bright, reflective silver veins
  const silverSpots = [
    { x: 3, y: 1, color: '#E5E5E5', size: 1 }, // Bright silver
    { x: 7, y: 3, color: '#F8F8FF', size: 2 }, // Ghost white silver
    { x: 11, y: 2, color: '#DCDCDC', size: 1 }, // Gainsboro silver
    { x: 2, y: 6, color: '#E5E5E5', size: 1 },
    { x: 9, y: 8, color: '#F8F8FF', size: 3 }, // Large silver vein
    { x: 13, y: 10, color: '#DCDCDC', size: 1 },
    { x: 1, y: 13, color: '#E5E5E5', size: 2 },
    { x: 6, y: 14, color: '#F8F8FF', size: 1 },
  ];
  
  silverSpots.forEach(({ x, y, color, size }) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
  });
  
  return ctx.canvas.toDataURL();
}

function createDefaultTexture(ctx: CanvasRenderingContext2D): string {
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, 16, 16);
  return ctx.canvas.toDataURL();
}

class TextureManager {
  private static instance: TextureManager;
  private textureLoader: THREE.TextureLoader;
  private loadedTextures: Map<MaterialType, THREE.Texture>;

  private constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.loadedTextures = new Map();
  }

  static getInstance(): TextureManager {
    if (!TextureManager.instance) {
      TextureManager.instance = new TextureManager();
    }
    return TextureManager.instance;
  }

  /**
   * Load a texture for a specific material type
   */
  async loadTexture(materialType: MaterialType): Promise<THREE.Texture> {
    // Return cached texture if already loaded
    if (this.loadedTextures.has(materialType)) {
      return this.loadedTextures.get(materialType)!;
    }

    const dataUrl = TEXTURE_DATA_URLS[materialType];
    
    // Handle water (invisible)
    if (materialType === MaterialType.WATER || !dataUrl) {
      const texture = new THREE.Texture();
      texture.format = THREE.RGBAFormat;
      this.loadedTextures.set(materialType, texture);
      return texture;
    }

    return new Promise<THREE.Texture>((resolve, reject) => {
      this.textureLoader.load(
        dataUrl,
        (texture) => {
          // Configure texture for pixelated Minecraft-style look
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestFilter;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.generateMipmaps = false;
          
          this.loadedTextures.set(materialType, texture);
          resolve(texture);
        },
        undefined,
        (error) => {
          console.error(`Failed to load texture for ${materialType}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Load all textures at once
   */
  async loadAllTextures(): Promise<Map<MaterialType, THREE.Texture>> {
    const materialTypes = Object.values(MaterialType);
    
    const loadingPromises = materialTypes.map(async (materialType) => {
      try {
        const texture = await this.loadTexture(materialType);
        return [materialType, texture] as [MaterialType, THREE.Texture];
      } catch (error) {
        console.error(`Failed to load texture for ${materialType}:`, error);
        // Create a simple fallback texture
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#888888';
        ctx.fillRect(0, 0, 16, 16);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        return [materialType, texture] as [MaterialType, THREE.Texture];
      }
    });

    const results = await Promise.all(loadingPromises);
    const textureMap = new Map<MaterialType, THREE.Texture>();
    
    results.forEach(([materialType, texture]) => {
      textureMap.set(materialType, texture);
    });

    return textureMap;
  }

  /**
   * Get a loaded texture (returns null if not loaded)
   */
  getTexture(materialType: MaterialType): THREE.Texture | null {
    return this.loadedTextures.get(materialType) || null;
  }

  /**
   * Check if a texture is loaded
   */
  isTextureLoaded(materialType: MaterialType): boolean {
    return this.loadedTextures.has(materialType);
  }
}

export default TextureManager; 