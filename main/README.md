# Paravoxia

A procedurally generated cube-world voxel game built with React Three Fiber and Rapier.

## Scripts

```bash
npm run dev
npm run typecheck
npm run test
npm run build
npm run verify
```

## Flow

The app boots into a **landing screen** (`src/components/ui/LandingMenu.tsx`) that
renders over a live cinematic orbit of the actual world — this doubles as the
loading warm-up. Once the world has painted cleanly (`src/state/appState.ts`
scene-ready signal), **Play Now** flips the app phase to gameplay with no remount
(the warmed world carries over) and grabs pointer lock. `Esc` (or the HUD pause
button) opens the **pause / star map** (`src/components/ui/PauseMenu.tsx`) for
travel + settings. Append `?debug=1` to restore the developer overlays.

## Controls

- `WASD` or arrow keys move across the active cube face.
- Mouse controls the camera (pointer lock acquired on Play / canvas click).
- `Space` jumps / jetpacks.
- `E` mines the targeted voxel.
- `F` boards / exits the ship.
- `Esc` opens the pause menu + star map.
- `R` resets the player.

## Current Structure

- `src/App.tsx`: shell — canvas, world/warp wiring, phase routing
- `src/state/appState.ts`: app phase (menu/playing) + scene-ready store
- `src/components/ui/`: landing menu, pause/star-map; `src/components/hud/`: in-game HUD
- `src/components/MenuCamera.tsx`: cinematic landing-screen orbit camera
- `src/ui/theme.ts`: shared design tokens (elevated sci-fi)
- `src/components/EfficientScene.tsx`: physics scene and state wiring
- `src/components/EfficientPlanet.tsx`: terrain generation, instanced rendering, and streamed collision bodies
- `src/components/EfficientPlayer.tsx`: player movement, jumping, deletion, and face transitions
- `src/utils/surfaceControls.ts`: cube-face movement and transition math
- `src/utils/proceduralWorldGenerator.ts`: deterministic terrain and material generation
- `src/utils/efficientVoxelSystem.ts`: exposed voxel tracking and mesh slot allocation

## Architecture Notes

- `docs/planet-system-handoff.md`: current handoff for the planet profile, biome, block, resource, harvesting, scanner, and crafting architecture.
