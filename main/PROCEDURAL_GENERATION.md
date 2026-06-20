# Procedural World Generation

`src/utils/proceduralWorldGenerator.ts` creates deterministic voxel terrain from an explicit world radius and terrain seed. `EfficientPlanet` rebuilds the generator when the terrain preset changes.

## World Config

```typescript
const generator = new ProceduralWorldGenerator(
  {
    planetRadius: 12.5,
    coreRadiusPercent: 0.15
  },
  {
    seed: 12345,
    heightVariation: 15,
    mountainFrequency: 0.015,
    hillFrequency: 0.04,
    valleyDepth: 12,
    terrainScale: 0.08
  }
);
```

## Materials

- Lava fills the spherical core.
- Grass, dirt, and stone are chosen near the generated surface based on terrain height.
- Dirt, stone, wood, copper, silver, and gold compete in deeper layers by material rarity.

## Main API

- `getAllVoxelPositions()`: returns generated voxel coordinates for the current world.
- `generateMaterialForPosition(x, y, z)`: returns the material for a generated coordinate.

The generator uses an internal seeded noise implementation, so the same world and terrain config produce the same voxel layout and materials.
