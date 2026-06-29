# Repo Survey

## Stack

- Framework: Vite, React 19, React Three Fiber, Three.js.
- Rendering: instanced voxel mesh, procedural shader injection via `onBeforeCompile`, R3F scene components, optional postprocessing composer.
- Physics: `@react-three/rapier`.
- Tests: Vitest unit/integration tests.
- Browser harnessing: Playwright Core, `?agent=1` runtime bridge, standalone HTML harnesses.
- Performance instrumentation:
  - `main/src/components/debug/AgentCamera.tsx` exposes `window.__game.metrics()`.
  - `main/src/utils/warpMetrics.ts` records timed generation/rebuild events when `?warpprobe=1`.
  - `main/tools/capture.mjs` captures vantages and metrics, but is currently Windows-path biased.

## Procedural Source Modules

| Area | Current source | Notes |
| --- | --- | --- |
| Planet identity | `main/src/game/PlanetProfile.ts`, `main/src/game/data/planetArchetypes.ts` | Archetype, climate, resource bias, hazards, progression tier. |
| Shared biome | `main/src/utils/biomeProfile.ts` | Lushness, aridity, temperature, vegetation hue, split grass/leaf hues. |
| Terrain config | `main/src/utils/terrainConfig.ts`, `main/src/config/worldGeneration.ts` | Archetype selects terrain preset and sea level behavior. |
| Terrain material skin | `main/src/utils/proceduralWorldGenerator.ts` | Archetype restyles land material, but ecology consequences are only partly formalized. |
| Voxel material | `main/src/utils/voxelMaterial.ts` | Rich procedural material shader with story-stage uniforms and material-specific detail. |
| Reality stage | `main/src/game/systems/realityRenderSystem.ts` | `bare`, `color`, `material`, `alive`, `paradox`; separate from device quality. |
| Quality gates | `main/src/config/graphicsSettings.ts` | Density, distance, post, AO, outlines, water effects, shader gates. |
| Wind | `main/src/utils/windProfile.ts` | Deterministic wind consumed by grass/trees/flora/fauna/surface effects/voxels. |
| Grass | `main/src/utils/grassProfile.ts`, `main/src/utils/grassField.ts`, `main/src/components/GrassField.tsx` | Good biome anchoring and wind; needs art-direction contract integration. |
| Trees | `main/src/utils/treeProfile.ts`, `main/src/utils/treeGen.ts`, `main/src/utils/treeMaterials.ts`, `main/src/components/TreeField.tsx` | Mature species system; still local profile logic and needs atlas-level review. |
| Flora | `main/src/utils/floraField.ts`, `main/src/components/FloraField.tsx` | Biome-aware but needs ecology/shape/palette governance. |
| Fauna | `main/src/utils/faunaField.ts`, `main/src/components/FaunaField.tsx` | Biome-aware, moving, size hierarchy improved; needs broader ecology/scaling contract. |
| Surface effects | `main/src/utils/surfaceEffects.ts`, `main/src/components/SurfaceEffectField.tsx` | Sand/dirt spawned effects; needs full material ecology and common effect registry. |
| Water | `main/src/utils/waterProfile.ts`, `main/src/components/WaterBlocks.tsx` | Biome-derived water palette; needs art-direction relationship to whole planet. |
| Sky/atmosphere | `main/src/components/SpaceSky.tsx`, `main/src/utils/spaceSky.ts`, `main/src/components/SkyController.tsx` | Archetype sky palettes exist separately from biome palette. |
| Post FX | `main/src/components/effects/PostFX.tsx`, `ColorGradeEffect.ts` | Cohesion pass exists but not driven by a full planet art direction contract. |
| Rocks/stones | `main/src/utils/looseStone.ts`, `main/src/components/LooseStoneField.tsx`, `main/rock-test.html` | Good local harness; needs full planet inclusion. |

## Existing Harnesses

- `main/voxel-test.html`: material stage grid, material focus, spawned surface effects, flora/fauna effect patches.
- `main/tree-test.html`: tree variety/silhouette harness with `window.__treeTest.summary()`.
- `main/rock-test.html`: loose stone winding/orientation harness.
- `?agent=1`: in-game scriptable camera with `window.__game.view`, `lookFrom`, `metrics`, and `ready`.
- `main/tools/capture.mjs`: headed capture runner for game vantages, currently hardcoded to a Windows Chromium path.
- Prior capture scripts in `.codex/design-runs/**/capture-*.mjs`: useful patterns for Linux Playwright and screenshot metrics.

## Current Strengths

- Procedural systems are deterministic and already mostly seed/profile driven.
- Quality profiles gate nearly every expensive visual feature.
- Story-based `VoxelRealityStage` is separated from device quality.
- Wind is a shared planet dynamic and already consumed by several systems.
- Recent grass, tree, flora, fauna, voxel surface, and post-FX work added strong visual material to build from.
- Existing tests already cover deterministic profile behavior, spawn eligibility, water invariants, and geometry attributes.

## Current Gaps

- There is no single `PlanetArtDirection` contract that every subsystem consumes.
- Color choices are parallel and sometimes compatible by convention rather than enforced by a palette system.
- Sky archetype palette, biome palette, water palette, terrain tint, flora/fauna colors, and post grade are not scored together.
- Shape language is implicit. Voxel material detail, grass hair, tree leaf cards, flora SDF-like props, fauna low-poly bodies, rocks, water, and dust are not checked as one style.
- Spawn ecology is partly local. Flora/fauna/material effects know basic materials, but not a unified biome/archetype ecology model.
- Scale hierarchy is locally tuned but not globally verified across trees, fauna, flora, grass, rocks, ship, player, and voxels.
- Harnesses are subsystem-specific; no long-running all-planet atlas exists.
- Performance measurements are fragmented and sometimes unreliable if captured before scene metrics settle.
- `main/tools/capture.mjs` is not Linux-first yet.

## Gate

- Components/profiles understood: `pass`
- Harnesses inventoried: `pass`
- Performance constraints captured: `pass`
- Visual-system gaps separated from implementation tasks: `pass`
