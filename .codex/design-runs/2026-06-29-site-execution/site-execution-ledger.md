# Site Execution Ledger

## Batch 1: Procedural Harness And Shared Direction Foundation

Status: `first-pass complete`
Route/surface: procedural world systems via `?agent=1&atlas=1`
Budget: `flagship`
Iteration: `1`

### Changes

- Added deterministic atlas seed fixtures covering all planet archetypes.
- Added `PlanetArtDirection` with palette families, palette role colors, style reference, shape tokens, ecology rules, material phenomena weights, and quality hints.
- Added `planetEcology` helpers for profile-level material eligibility.
- Added procedural atlas report utilities and tests.
- Added `tools/procedural-atlas.mjs` with `smoke`, `baseline`, `reality`, `perf`, `full`, and `overnight` modes.
- Made `tools/capture.mjs` Linux-first with `CHROME_PATH`, `/snap/bin/chromium`, headed/headless support, and browser-mode metrics.
- Extended `window.__game` with profile summaries, quality/reality state, layer counts, material/program keys, estimated draw calls, and estimated triangles.
- Added `atlas=1` HUD-free capture mode.
- Migrated grass, tree, water, terrain tint, flora, and fauna colors to shared art-direction palette roles.
- Gated flora/fauna placement and travel through the shared ecology contract.

### Style Decision

Trees are the primary reference point for visual quality, artistic stylization, fullness, palette richness, branch-aligned foliage, and wind-coherent movement. Grass remains the secondary reference for ground-level density and close-detail fidelity.

### Checks

- `npm run typecheck`
- `npm test -- --run src/utils/proceduralAtlasSeeds.test.ts src/utils/planetArtDirection.test.ts src/utils/proceduralAtlasReport.test.ts`
- `npm test -- --run src/utils/grassProfile.test.ts src/utils/treeProfile.test.ts src/utils/waterProfile.test.ts src/utils/terrainProfile.test.ts src/utils/floraField.test.ts src/utils/faunaField.test.ts src/utils/planetArtDirection.test.ts`
- `npm run atlas:smoke -- --headless=true --label=ecology-migration-smoke`

### Evidence

- Atlas summary: `main/captures/procedural-atlas/2026-06-29T03-16-21-302Z-ecology-migration-smoke/summary.json`
- Atlas defects: `main/captures/procedural-atlas/2026-06-29T03-16-21-302Z-ecology-migration-smoke/defects.md`
- Screenshot count: `9`
- Console errors: `0`
- Machine defects: `0`

### Baseline Matrix

- Final clean atlas: `main/captures/procedural-atlas/2026-06-29T03-31-01-037Z-baseline-final-clean/summary.json`
- Final clean defects: `main/captures/procedural-atlas/2026-06-29T03-31-01-037Z-baseline-final-clean/defects.md`
- Cases: `36`
- Screenshots: `180`
- Console errors: `0`
- Machine defects: `0`
- HIGH max p95: `17.1ms`
- HIGH min FPS: `59`
- HIGH max estimated triangles: `2,203,808`
- MEDIUM max p95: `17.7ms`
- MEDIUM min FPS: `57`
- MEDIUM max estimated triangles: `1,429,382`

### Gate Status

First-pass foundation gate: `pass`

Remaining defects/deferred work:

- Sky and post-processing still need direct art-direction migration.
- Surface effects only have sand/dirt implementations; additional material phenomena remain planned.
- Reality-stage atlas strips are implemented in the runner but not yet reviewed.
- Perf atlas mode still needs longer execution.
- Add non-tree showcase vantages for sparse/mineral/hazard planets.

## Batch 2: Sky, Post Grade, And Material Phenomena

Status: `first-pass complete`
Route/surface: procedural world systems via `?agent=1&atlas=1`
Budget: `flagship`
Iteration: `2`

### Changes

- Added `planetVisualProfile` as the shared seam for atmosphere and post-processing color decisions.
- Migrated `SpaceSky` atmosphere low/high/glow colors to the planet art-direction palette.
- Migrated `SkyController` fog tint/density to the planet atmosphere profile.
- Migrated `PostFX` color grade to `postGradeTint`, art-direction contrast, saturation, and warm/cool bias.
- Expanded surface-effect material eligibility to include lava, basalt, ice, crystal, stone, and ore materials.
- Added a shared spawned surface-phenomena path for pollen, frost streamers, lava heat/embers, ash wisps, crystal glints, metallic flecks, and fungal spores.
- Kept all new spawned phenomena on the global wind/reality-stage uniforms so they move with grass/trees and can still be disabled by graphics/reality progression.
- Updated atlas diagnostics so generic material phenomena count as `surfaceEffects`.

### Checks

- `npm run typecheck`
- `npm test -- --run src/utils/planetVisualProfile.test.ts src/utils/surfaceEffects.test.ts src/utils/planetArtDirection.test.ts`
- `npm test -- --run src/utils/planetVisualProfile.test.ts src/utils/surfaceEffects.test.ts src/utils/planetArtDirection.test.ts src/utils/grassProfile.test.ts src/utils/treeProfile.test.ts src/utils/waterProfile.test.ts src/utils/terrainProfile.test.ts src/utils/floraField.test.ts src/utils/faunaField.test.ts`
- `npm run build`
- `npm run atlas:smoke -- --headless=true --label=batch2-sky-post-surface-effects`

### Evidence

- Atlas summary: `main/captures/procedural-atlas/2026-06-29T03-56-41-879Z-batch2-sky-post-surface-effects/summary.json`
- Atlas defects: `main/captures/procedural-atlas/2026-06-29T03-56-41-879Z-batch2-sky-post-surface-effects/defects.md`
- Screenshot count: `9`
- Console errors: `0`
- Machine defects: `0`
- Surface-effect counts in smoke: verdant `3,295`, arid `5,948`, fungal `3,896`.
- Worst smoke p95: fungal coast `20.1ms`.

### Gate Status

First-pass foundation gate: `pass`

Remaining defects/deferred work:

- Longer `atlas:perf` run is needed because the smoke matrix shows one p95 spike at `20.1ms`.
- Add non-tree material/hazard showcase vantages for sparse, mineral, frozen, and volcanic planets.
- Reality-stage strips need visual review now that spawned phenomena respond to reality uniforms.
- Full baseline should be re-run after the next material/hazard vantage batch.

## Batch 3: Material Showcase Vantages And Settled Perf Budgets

Status: `refined gate complete`
Route/surface: procedural world systems via `?agent=1&atlas=1`
Budget: `flagship`
Iteration: `3`

### Changes

- Added `atlas:showcase` mode for tree-led material review across verdant, arid, frozen, volcanic, oceanic, crystal, metallic, fungal, and anomaly planets.
- Added scripted `AgentCamera` vantages for `surfaceEffects`, `material`, `hazard`, `mineral`, `sandDust`, `dirtLife`, `pollen`, `frost`, `lavaHeat`, `ash`, `crystalGlints`, `metallicFlecks`, and `fungalSpores`.
- Framed material/effect vantages around actual instanced effect meshes rather than generic overhead fallback when matching effects exist.
- Added metric reset hooks so each atlas view records settled per-vantage frame data after camera movement.
- Added warmup/settle timing to the atlas runner and aggregate case metrics from the worst relevant view in each case.
- Added profile-specific performance budgets to both the runner and report utility, calibrated to the approved dense tree/grass reference.
- Kept POTATO as a deliberate no-expensive-effects profile so empty ecology/effect defects do not fail it.

### Checks

- `npm run typecheck`
- `npm test -- --run src/utils/proceduralAtlasReport.test.ts`
- `npm run atlas:showcase -- --headless=true --label=batch3-material-showcase-settled`
- `npm run atlas:perf -- --headless=true --label=batch3-perf-budgeted`

### Showcase Evidence

- Atlas summary: `main/captures/procedural-atlas/2026-06-29T04-15-01-668Z-batch3-material-showcase-settled/summary.json`
- Atlas defects: `main/captures/procedural-atlas/2026-06-29T04-15-01-668Z-batch3-material-showcase-settled/defects.md`
- Cases: `9`
- Screenshots: `29`
- Console errors: `0`
- Machine defects: `0`
- Worst p95: `18ms`
- Default HIGH material showcase max estimated triangles: verdant `3,401,490`, fungal `2,436,638`, oceanic `1,470,476`.
- Surface-effect showcase counts: arid `11,046`, verdant `6,045`, fungal `4,958`, frozen `4,061`, anomaly `3,286`.

### Perf Evidence

- Atlas summary: `main/captures/procedural-atlas/2026-06-29T04-20-42-640Z-batch3-perf-budgeted/summary.json`
- Atlas defects: `main/captures/procedural-atlas/2026-06-29T04-20-42-640Z-batch3-perf-budgeted/defects.md`
- Cases: `20`
- Screenshots: `60`
- Console errors: `0`
- Machine defects: `0`
- Profiles covered: `ULTRA`, `HIGH`, `MEDIUM`, `LOW`, `POTATO`.
- Worst p95: anomaly LOW `21.2ms`, within the calibrated LOW budget.
- ULTRA heavy reference: verdant `8,834,849` estimated triangles at `60fps`, p95 `17.2ms`.
- HIGH default reference: verdant `3,941,558` estimated triangles at `60fps`, p95 `17ms`.
- POTATO reference: no expensive surface effects, no broken frames, p95 `16.9-17ms`.

### Gate Status

Refined material/perf gate: `pass`

Remaining defects/deferred work:

- Reality-stage strips still need visual review against the story progression.
- Full baseline should be re-run now that material vantages are part of baseline/full modes.
- Shader complexity audit notes are still pending, even though program counts stayed bounded in the perf run.
- Human/adversarial visual review is still needed before final approval.

## Batch 4: Fauna Shader Cohesion And Animal Quality

Status: `refined gate complete`
Route/surface: procedural world systems via `?agent=1&atlas=1`
Budget: `flagship`
Iteration: `4`

### Changes

- Moved fauna from unlit `MeshBasicMaterial` to lit `MeshStandardMaterial`, so animals now participate in scene lights, fog, tone mapping, and post grade like trees and grass.
- Added fauna sun/moon uniforms, rim light, backlit SSS, wing translucency, roughness shaping, and subtle dither.
- Added species ids through uniforms rather than new program variants, keeping fauna on one shared shader key: `fauna-field-v3`.
- Added per-kind shader patterning for grazers, woollies, runners, hoppers, and dragonflies.
- Added palette separation so fauna coats avoid collapsing into grass/canopy hues on verdant worlds.
- Added fauna-specific atlas vantages: `fauna`, `grazer`, `woolly`, `runner`, `hopper`, and `dragonfly`.
- Added species-specific fauna camera framing for review shots.
- Added regression tests for the lit shared fauna material program and readable verdant fauna coats.
- Added `shader-cohesion-audit.md` with the current shader vocabulary, program families, and remaining shader passes.

### Checks

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run atlas:showcase -- --headless=true --label=batch4-fauna-shader-cohesion-accepted`
- `npm run atlas:perf -- --headless=true --label=batch4-fauna-shader-cohesion-perf`

### Showcase Evidence

- Atlas summary: `main/captures/procedural-atlas/2026-06-29T04-44-57-353Z-batch4-fauna-shader-cohesion-accepted/summary.json`
- Atlas defects: `main/captures/procedural-atlas/2026-06-29T04-44-57-353Z-batch4-fauna-shader-cohesion-accepted/defects.md`
- Cases: `9`
- Screenshots: `36`
- Console errors: `0`
- Machine defects: `0`
- Worst p95: `17.2ms`
- Fauna counts in showcase: verdant `141`, arid `51`, frozen `10`, volcanic `61`, oceanic `23`, crystal `7`, metallic `4`, fungal `58`, anomaly `15`.

### Perf Evidence

- Atlas summary: `main/captures/procedural-atlas/2026-06-29T04-48-03-549Z-batch4-fauna-shader-cohesion-perf/summary.json`
- Atlas defects: `main/captures/procedural-atlas/2026-06-29T04-48-03-549Z-batch4-fauna-shader-cohesion-perf/defects.md`
- Cases: `20`
- Screenshots: `60`
- Console errors: `0`
- Machine defects: `0`
- Worst p95: verdant POTATO `17.4ms`, within calibrated budget.
- Dense ULTRA reference remains stable: verdant `8,834,849` estimated triangles at `60fps`.

### Gate Status

Refined fauna/shader gate: `pass`

Remaining defects/deferred work:

- Fauna silhouettes are improved materially, but individual species geometry can still be pushed further in later art passes.
- Voxel, water, flora, surface effects, sky, and post FX still need the same shader-audit treatment.
- Reality-stage strips still need visual review against story progression.

## Batch 5: Fauna Roaming Continuity

Status: `refined gate complete`
Route/surface: procedural world systems via `?agent=1&atlas=1`
Budget: `flagship`
Iteration: `5`

### Changes

- Changed fauna rebuilds from fresh respawns into live-agent reconciliation.
- Preserved live agent identity, route progress, orientation, stride phase, and current world position across distance-bucket rebuilds.
- Added stable home voxel identity for deterministic placement while allowing mutable current/target voxels for ongoing roaming.
- Added per-instance `aFaunaStride` and moved ground gait to movement-driven stride phase instead of a short global-time loop.
- Kept idle breathing, wind motion, tail motion, and dragonfly wings time/wind-driven for ambient life.
- Upgraded the shared fauna shader key to `fauna-field-v4`.
- Added a regression test that rebuilds visible fauna with existing agents and verifies no position/progress/gait rewind.

### Checks

- `npm test -- faunaField`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run atlas:showcase -- --headless=true --label=batch5-fauna-roaming-continuity`

### Showcase Evidence

- Atlas summary: `main/captures/procedural-atlas/2026-06-29T13-18-53-044Z-batch5-fauna-roaming-continuity/summary.json`
- Atlas defects: `main/captures/procedural-atlas/2026-06-29T13-18-53-044Z-batch5-fauna-roaming-continuity/defects.md`
- Cases: `9`
- Screenshots: `36`
- Console errors: `0`
- Machine defects: `0`
- Worst p95: `17.3ms`
- Program key observed in atlas: `fauna-field-v4`

### Gate Status

Refined fauna locomotion gate: `pass`

Remaining defects/deferred work:

- The atlas verifies static frames and runtime shader health; it does not yet record a video clip proving subjective long-duration roam feel.
- Individual species geometry can still be pushed further in later art passes.
- Voxel, water, flora, surface effects, sky, and post FX still need the same shader-audit treatment.

## Batch 6: Flora And Voxel Shader Cohesion

Status: `refined gate complete`
Route/surface: procedural world systems via `?agent=1&atlas=1`
Budget: `flagship`
Iteration: `6`

### Changes

- Moved flora from unlit `MeshBasicMaterial` to lit `MeshStandardMaterial`.
- Added flora species ids, rim/backlight, bloom glow, wind-aware tonal variation, and roughness shaping while keeping one shared shader key: `flora-field-v2`.
- Passed sun/moon directions into `FloraField` so flora participates in the same day/night lighting vocabulary as trees/fauna.
- Added voxel sun/moon uniforms and a subtle material-aware rim/atmosphere term to `voxel-pbr-v6`.
- Kept voxel shader behavior under existing quality-profile and reality-stage gates.
- Added unit tests for the flora material contract and voxel material contract.

### Checks

- `npm test -- floraField voxelMaterial`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run atlas:showcase -- --headless=true --label=batch6-flora-voxel-cohesion`
- `npm run atlas:perf -- --headless=true --label=batch6-flora-voxel-cohesion-perf`

### Showcase Evidence

- Atlas summary: `main/captures/procedural-atlas/2026-06-29T13-35-03-216Z-batch6-flora-voxel-cohesion/summary.json`
- Atlas defects: `main/captures/procedural-atlas/2026-06-29T13-35-03-216Z-batch6-flora-voxel-cohesion/defects.md`
- Cases: `9`
- Screenshots: `36`
- Console errors: `0`
- Machine defects: `0`
- Worst p95: `17.4ms`
- Program keys observed: `flora-field-v2`, `voxel-pbr-v6`, `fauna-field-v4`
- Flora counts in showcase: verdant `1292`, arid `757`, frozen `278`, volcanic `515`, oceanic `719`, crystal `40`, metallic `50`, fungal `843`, anomaly `157`.

### Perf Evidence

- Atlas summary: `main/captures/procedural-atlas/2026-06-29T13-37-32-285Z-batch6-flora-voxel-cohesion-perf/summary.json`
- Atlas defects: `main/captures/procedural-atlas/2026-06-29T13-37-32-285Z-batch6-flora-voxel-cohesion-perf/defects.md`
- Cases: `20`
- Screenshots: `60`
- Console errors: `0`
- Machine defects: `0`
- Worst p95: `17.4ms`
- Dense ULTRA reference stayed stable at `60fps` with `8,834,849` estimated triangles.

### Gate Status

Refined flora/voxel shader gate: `pass`

Remaining defects/deferred work:

- Flora geometry can still get a later silhouette/volume pass; this batch focused on shader cohesion.
- Water, surface effects, sky, and post FX still need the same current-state audit treatment.
- Reality-stage strips still need visual review against story progression.
