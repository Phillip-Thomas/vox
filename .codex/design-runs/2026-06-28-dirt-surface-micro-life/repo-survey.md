# Repo Survey

- `main/src/components/SurfaceEffectField.tsx` currently owns spawned voxel effects and uses `buildWindProfile(terrainSeed)`.
- `main/src/utils/surfaceEffects.ts` currently implements sand dust as instanced geometry with shader-driven gust animation.
- `main/src/voxelTest.tsx` has a dev-only `?effects=sand` harness that seeds `voxelSystem` with a test patch and renders `SurfaceEffectField`.
- `main/src/config/graphicsSettings.ts` already exposes `voxelEffectDensity` and `voxelEffectMaxDistance`.
- `main/src/utils/voxelMaterial.ts` already gives dirt shader-level clods, pebbles, and thread marks; the new pass should sit above that as separate geometry.

Opportunity: extend `SurfaceEffectField` into multiple material consumers rather than adding dirt-specific rendering in the scene or voxel material.
