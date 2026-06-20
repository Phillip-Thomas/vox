# Voxel Game

A procedurally generated voxel game built with React, React Three Fiber, Three.js, and Rapier physics.

The active app lives in `main/`.

## Getting Started

```bash
cd main
npm install
npm run dev
```

Open the Vite URL printed by the dev server, usually `http://localhost:5173`.

## Controls

- `W` / `ArrowUp`: move forward
- `S` / `ArrowDown`: move backward
- `A` / `ArrowLeft`: move left
- `D` / `ArrowRight`: move right
- `Space`: jump
- `R`: reset
- `E`: delete the targeted voxel

## Current Entry Points

- `main/src/App.tsx`: React UI shell and scene controls
- `main/src/components/EfficientScene.tsx`: Rapier scene composition
- `main/src/components/EfficientPlanet.tsx`: procedural terrain rendering and streamed colliders
- `main/src/components/EfficientPlayer.tsx`: surface-relative player controller
- `main/src/utils/proceduralWorldGenerator.ts`: deterministic terrain and material generation
- `main/src/utils/efficientVoxelSystem.ts`: exposed-voxel storage and mesh slot management
