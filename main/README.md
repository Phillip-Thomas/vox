# Voxel Game

A procedurally generated cube-world voxel game built with React Three Fiber and Rapier.

## Scripts

```bash
npm run dev
npm run typecheck
npm run test
npm run build
npm run verify
```

## Controls

- Click the canvas to enter pointer lock.
- `WASD` or arrow keys move across the active cube face.
- Mouse controls the camera.
- `Space` jumps.
- `R` resets the player.
- `E` deletes the targeted voxel.

## Current Structure

- `src/App.tsx`: canvas setup and debug UI
- `src/components/EfficientScene.tsx`: physics scene and state wiring
- `src/components/EfficientPlanet.tsx`: terrain generation, instanced rendering, and streamed collision bodies
- `src/components/EfficientPlayer.tsx`: player movement, jumping, deletion, and face transitions
- `src/utils/surfaceControls.ts`: cube-face movement and transition math
- `src/utils/proceduralWorldGenerator.ts`: deterministic terrain and material generation
- `src/utils/efficientVoxelSystem.ts`: exposed voxel tracking and mesh slot allocation

## Architecture Notes

- `docs/planet-system-handoff.md`: current handoff for the planet profile, biome, block, resource, harvesting, scanner, and crafting architecture.
