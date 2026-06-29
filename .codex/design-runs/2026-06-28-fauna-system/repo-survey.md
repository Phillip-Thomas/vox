# Repo Survey

- `main/src/utils/floraField.ts` provides the closest architecture: deterministic placement, biome/wind profile, quality/reality uniforms, merged low-poly geometry, and instanced surface orientation.
- `main/src/components/FloraField.tsx` manages capacity, rebuilds on voxel edits, applies wind uniforms after shader compile, and updates reality-stage uniforms each frame.
- `main/src/config/graphicsSettings.ts` is the single source of truth for expensive rendering gates.
- `main/src/components/EfficientScene.tsx` mounts grass, flora, trees, spawned voxel effects, forage, and other world systems.
- `main/src/voxelTest.tsx` already has isolated harness routes for spawned sand/dirt effects and flora.
- `main/src/utils/windProfile.ts` exposes deterministic per-planet wind used by grass/flora/trees/effects.
- `main/src/utils/biomeProfile.ts` exposes deterministic climate axes and vegetation hues.

## Key Constraint

Fauna should mirror the flora system structurally so future AI/gameplay behavior can be added without coupling to the plant renderer.
