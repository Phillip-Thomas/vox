# Procedural System Inventory

## Run Info

- Repo: `/home/thomasphillip/Projects/vox`
- Mode: `site-review`, adapted to procedural world systems.
- Date: 2026-06-29
- Source context: Paravoxia synopsis plus current procedural rendering modules.
- Design context: `design-context.md`

## System Inventory

| System | Owner files | User-facing goal | Dependencies | Current evidence | Priority |
| --- | --- | --- | --- | --- | --- |
| Planet art direction | new planned module | One coherent planet identity for every seed | PlanetProfile, BiomeProfile, archetype data | Missing | P0 |
| Palette generation | `biomeProfile.ts`, planned palette module | Beautiful deterministic color harmony with diversity | seeded hashes, color utilities | Partial split-complement logic | P0 |
| Atlas harness | `AgentCamera.tsx`, `tools/capture.mjs`, planned runner | Long-running visual and perf proof across systems | Playwright, `window.__game`, harness summaries | Partial | P0 |
| Terrain material ecology | `proceduralWorldGenerator.ts`, `voxelMaterial.ts` | Terrain supports biome and story stage visually | PlanetProfile, reality stage, quality | Strong material shader, weak global art contract | P1 |
| Sky/atmosphere/post | `SpaceSky.tsx`, `PostFX.tsx`, `ColorGradeEffect.ts` | Whole-frame cinematic cohesion | biome/archetype/daylight | Partial | P1 |
| Water | `waterProfile.ts`, `WaterBlocks.tsx` | Oceans match planet palette and archetype | biome, terrain config | Partial | P1 |
| Grass | `grassProfile.ts`, `grassField.ts`, `GrassField.tsx` | Hair-like ground cover with biome personality | biome, wind, quality | Strong | P1 |
| Trees | `treeProfile.ts`, `treeGen.ts`, `treeMaterials.ts`, `TreeField.tsx` | Fuller, species-like canopy silhouettes | biome, wind, quality, tree harness | Strong but needs global style review | P1 |
| Flora | `floraField.ts`, `FloraField.tsx` | Mid-story plants appropriate to biome/material | biome, wind, quality, reality stage | First pass | P2 |
| Fauna | `faunaField.ts`, `FaunaField.tsx` | Believable creature ecology and movement | biome, wind, quality, reality stage | First pass plus locomotion | P2 |
| Spawned voxel effects | `surfaceEffects.ts`, `SurfaceEffectField.tsx` | Material phenomena above voxels | material type, wind, reality stage | Sand/dirt only | P2 |
| Rocks/stones | `looseStone.ts`, `LooseStoneField.tsx` | Ground material detail and scale anchor | terrain/material, placement rules | Narrow harness | P2 |
| Quality/perf | `graphicsSettings.ts`, `warpMetrics.ts`, `AgentCamera.tsx` | Scalable visuals across machines | all renderers | Good flags, missing long-run budget | P0 |
| Story rendering progression | `realityRenderSystem.ts`, `voxelMaterial.ts`, render consumers | Visual progression from flat cube to rich reality | plot state, material systems | Good foundation | P1 |

## Cross-System Journeys

- First crash world: must be hospitable, readable, wondrous, and not over-noisy.
- Looking over a planet from ship/overview: archetype, color family, water/land contrast, and focal features must read.
- Walking through grass/trees: scale, density, wind, surface attachment, and color must feel coherent.
- Crossing biome/material bands: sand, dirt, grass, water, stone, ice, basalt, lava, crystal must each host appropriate surface phenomena.
- Reality progression: `bare -> color -> material -> alive -> paradox` should feel like increasing perception, not unrelated toggles.
- Low-end device fallback: same planet identity with fewer layers, not a broken or empty world.

## Technical Inventory

- Test commands:
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
  - `npm run verify`
- Existing preview/harness routes:
  - `/`
  - `/?agent=1`
  - `/voxel-test.html`
  - `/tree-test.html`
  - `/rock-test.html`
- Existing metrics:
  - `window.__game.metrics()`
  - `window.__game.ready()`
  - `window.__treeTest.summary()`
  - `window.__voxelTest.summary()`
  - `window.__lastWarpMetrics`

## Gate

- Important systems inventoried: `pass`
- Shared patterns identified: `pass`
- User goal captured: `pass`
- Technical constraints captured: `pass`
