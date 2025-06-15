# Procedural World Generation System

This voxel world now uses a sophisticated procedural generation system that creates realistic layered terrain instead of random block placement.

## Layer Structure

### 1. Lava Core (Innermost)
- **Material**: Lava blocks (orange-red color)
- **Location**: Center of the world
- **Radius**: Configurable between 3-6 blocks
- **Purpose**: Represents the molten core of the planet

### 2. Surface Layer (Outermost)
- **Material**: Grass blocks (green color)
- **Location**: All 6 outer faces of the cube planet (top, bottom, left, right, front, back)
- **Purpose**: Represents the living surface of the cube world

### 3. Middle Layer (Between core and surface)
- **Rarity-Based Materials** (weighted random selection):
  - **Dirt**: Rarity 300 (Dominant) - brown color
  - **Stone**: Rarity 50 (Common) - gray color  
  - **Wood**: Rarity 25 (Uncommon) - burlywood color
  - **Copper**: Rarity 12 (Uncommon) - copper brown color
  - **Silver**: Rarity 8 (Rare) - silver color
  - **Gold**: Rarity 5 (Very Rare) - gold color
- **Selection**: Higher rarity = more likely to appear

## Configuration Options

The world generation can be customized using these parameters:

### Core Diameter
- **Range**: 3-6 blocks
- **Default**: 4 blocks
- **Effect**: Controls the diameter of the lava core at the center

### Material Rarity System
- **Method**: Weighted random selection based on rarity values
- **Higher rarity** = more common materials
- **Distribution**: Automatically balanced based on rarity weights
- **Materials**: All middle-layer materials compete based on their rarity

## How to Use

### In-Game Controls
The application now includes an on-screen control panel in the top-left corner with:
- **Core Diameter Slider**: Adjust the lava core diameter (3-6 blocks)
- **Material Rarity Display**: Shows the rarity values for all middle-layer materials

Changes take effect immediately when you adjust the sliders!

### Programmatic Usage

```typescript
import { updateWorldGenerationConfig } from './utils/materialGenerator';

// Update configuration
updateWorldGenerationConfig({
  coreRadius: 2.5,         // Diameter of 5 blocks
});
```

### Accessing Current Config

```typescript
import { getWorldGenerationConfig } from './utils/materialGenerator';

const currentConfig = getWorldGenerationConfig();
console.log(`Core radius: ${currentConfig.coreRadius}`);
console.log(`Mineral frequency: ${currentConfig.mineralFrequency * 100}%`);
```

## Technical Implementation

### Distance-Based Generation
The system calculates the 3D distance from each voxel to the center of the world:
- Distance ≤ core radius → Lava
- On any outer face of the cube → Grass (surface layer)
- Everything else → Stone/Dirt with chance for minerals

### Material Assignment Priority
1. **Lava Core**: Assigned first based on distance from center
2. **Surface Grass**: Assigned to all 6 outer faces of the cube planet
3. **Middle Layer**: Weighted random selection based on material rarity values

## World Structure Visualization

```
     [GRASS] ← Surface layer
   [STONE/DIRT] ← Middle layer with minerals
 [STONE/COPPER/GOLD] ← Mixed middle layer  
   [LAVA CORE] ← Innermost core
 [STONE/SILVER/DIRT] ← Mixed middle layer
   [STONE/DIRT] ← Middle layer
     [GRASS] ← Surface layer
```

This creates a much more realistic and interesting world structure compared to the previous random assignment system! 