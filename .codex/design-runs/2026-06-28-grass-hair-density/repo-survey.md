# Repo Survey

## Relevant Stack

- React + Vite + Three.js via `@react-three/fiber`.
- Grass rendering lives in `main/src/components/GrassField.tsx` and `main/src/utils/grassField.ts`.
- Per-planet grass look comes from `main/src/utils/grassProfile.ts`.
- Quality knobs live in `main/src/config/graphicsSettings.ts`.
- Tests cover blade geometry, matrices, density counts, culling, cached buffer parity, and profile ranges.

## Existing Grass Architecture

- A single `THREE.InstancedMesh` renders all grass blades.
- `createBladeGeometry()` builds a tapered plane with baked curve.
- `BLADES_PER_CLUMP = 3`; effective per-voxel blade count is `graphicsQuality.grassDensity * BLADES_PER_CLUMP * profile.densityMul`.
- Current default HIGH quality uses `grassDensity = 4`, so nominal count is 12 blades per covered grass voxel before biome multiplier.
- `computeBladeMatrix()` groups blades into clumps and fans them using per-clump position and heading.
- Shader handles wind, per-blade tint, dry patches, rounded normals, translucency, and sheen.

## Brand And Asset Inventory

- No dedicated grass image assets are used; visual identity is procedural.
- Existing stored screenshot/vantage assets include `main/captures/prestyle_-1_-70-approach-grass-grid.png` and debug vantages in `main/src/components/debug/vantages.json`.
- The stored `-1_-70-approach-grass-grid` vantage explicitly documents the grass-grid problem.

## Constraints

- Instance count can increase, but should remain controlled through existing quality profiles and culling.
- Geometry must stay cheap; adding extra materials or transparent textures would risk sorting and fill-rate issues.
- The change should be visible without requiring new art.

