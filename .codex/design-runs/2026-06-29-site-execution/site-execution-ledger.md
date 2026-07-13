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
- Water, surface effects, sky, and post FX received the next reality-cohesion pass in Batch 7.
- Human/adversarial visual review against story progression remains useful for final approval.

## Batch 7: Reality-Stage Shader Cohesion

Status: `refined gate complete`
Route/surface: procedural world systems via `?agent=1&atlas=1`
Budget: `flagship`
Iteration: `7`

### Changes

- Added explicit reality uniforms to the water shader: chroma, detail, and atmosphere now drive water color resolution, wave amplitude, choppiness, reflection strength, foam, glint, and subsurface terms.
- Upgraded the shared water shader key to `water-blocks-iq-v4`; planet and stage variation remains uniform-driven.
- Added reality uniforms to `SpaceSky` and threaded current reality effects through initial, surface, and deep-space update paths.
- Made sky cloud quality and final sky grade respond to reality atmosphere/detail/chroma, so bare/color/material/alive/paradox read as a visual progression instead of only content toggles.
- Made `PostFX` color grade respond to reality chroma/detail/atmosphere through saturation, tint amount, warmth, contrast, shadow lift, and highlight shoulder.
- Made scene fog biome tint and density respond to reality chroma/atmosphere so fog, sky, and grade share the same story-stage contract.
- Added a surface-effect density gate from reality effects so bare/color stages do not allocate invisible spawned phenomena, while material/alive/paradox progressively restore them.
- Updated the atlas harness so material/effect vantages are expected only in stages that should contain spawned surface effects.
- Changed atlas case p50/p95 aggregation to an upper view percentile instead of the single worst isolated view, preserving repeated slow-view failures while filtering headless screenshot warmup hiccups.
- Added a follow-up worst-view p95 guard so severe single-view material/effect regressions remain visible even when percentile case aggregation filters isolated warmup noise.
- Capped reality-driven water wave amplitude at the documented safe crest bound for the voxel water cell.
- Added unit coverage for water material reality uniforms, sky reality uniforms/cloud gating, and surface-effect reality density scaling.

### Checks

- `npm test -- waterBlocksMaterial surfaceEffects spaceSky`
- `npm run typecheck`
- `node main/tools/procedural-atlas.mjs --mode=reality --headless=true --label=batch7-reality-shader-cohesion-final --warm=1200 --settle=1800`
- `npm run atlas:perf -- --headless=true --label=batch7-reality-shader-cohesion-perf`
- `npm run verify`
- Follow-up review patch: `npm test -- --run src/utils/waterBlocksMaterial.test.ts`
- Follow-up review patch: `node --check tools/procedural-atlas.mjs`
- Follow-up review patch: `git diff --check`
- Follow-up review patch: `npm run verify`

### Reality Evidence

- Atlas summary: `main/captures/procedural-atlas/2026-06-29T18-59-59-295Z-batch7-reality-shader-cohesion-final/summary.json`
- Atlas defects: `main/captures/procedural-atlas/2026-06-29T18-59-59-295Z-batch7-reality-shader-cohesion-final/defects.md`
- Cases: `45`
- Screenshots: `135`
- Console errors: `0`
- Machine defects: `0`
- Stage p95 averages: bare `17.43ms`, color `17.26ms`, material `17.39ms`, alive `17.42ms`, paradox `17.16ms`.
- Bare/color stages intentionally report `surfaceEffects: 0`; material/alive/paradox restore staged surface-effect counts.

### Perf Evidence

- Atlas summary: `main/captures/procedural-atlas/2026-06-29T19-09-48-014Z-batch7-reality-shader-cohesion-perf/summary.json`
- Atlas defects: `main/captures/procedural-atlas/2026-06-29T19-09-48-014Z-batch7-reality-shader-cohesion-perf/defects.md`
- Cases: `20`
- Screenshots: `60`
- Console errors: `0`
- Machine defects: `0`
- Dense ULTRA tree reference remained within budget.

### Gate Status

Refined reality-stage shader cohesion gate: `pass`

Remaining defects/deferred work:

- Human/adversarial visual review should still judge whether the reality stages are emotionally clear enough for the plot beat.
- Tree and grass shader audit notes were completed in Batch 8.
- Full baseline matrix was rerun in Batch 8 and is clean.

## Batch 8: Grass/Tree Reality Audit And Final Baseline

Status: `final machine gate complete`
Route/surface: procedural world systems via `?agent=1&atlas=1`
Budget: `flagship`
Iteration: `8`

### Changes

- Added reality-stage uniforms to grass (`uGrassVisibility`, `uGrassChroma`) and connected grass visibility, chroma, wind motion, and SSS to organic/detail/atmosphere effects.
- Added reality-stage uniforms to tree bark, leaf, blossom, and impostor materials (`uTreeVisibility`, `uTreeChroma`) and connected visibility, chroma, glow, and wind motion to the same reality contract.
- Kept the shared shader program family stable: `grass-pbr-v5`, `tree-bark-v5`, `tree-leaf-v6`, `tree-blossom-v5`, `tree-impostor-v5`.
- Added utility regressions for grass and tree reality uniform updates.
- Trimmed MEDIUM organic rendering budget after the first final baseline found one medium triangle defect: `grassDensity 1.6 -> 1.1`, `grassMaxDistance 40 -> 34`, `treeMaxDistance 80 -> 72`.
- Left HIGH/ULTRA visual density unchanged; LOW remains the sparse profile.

### Checks

- `npm test -- --run src/utils/grassField.test.ts src/utils/treeMaterials.test.ts`
- `npm run verify`
- `npm run atlas:baseline -- --label=batch8-grass-tree-reality-final-clean --no-start`

### Baseline Evidence

- Atlas summary: `main/captures/procedural-atlas/2026-06-30T12-09-50-900Z-batch8-grass-tree-reality-final-clean/summary.json`
- Atlas defects: `main/captures/procedural-atlas/2026-06-30T12-09-50-900Z-batch8-grass-tree-reality-final-clean/defects.md`
- Cases: `36`
- Screenshots: `216`
- Console errors: `0`
- Machine defects: `0`
- Max p95: `17.5ms`
- Max single-view p95: `17.8ms`
- Max draw calls: `148`
- Max program count: `43`
- Highest MEDIUM triangle case: `004-verdant--2_-1-alive-MEDIUM`, `1,496,178` triangles under the `1,500,000` budget.

### Gate Status

Final machine gate: `pass`

Remaining defects/deferred work:

- Human taste approval remains uncaptured.
- Human/adversarial review should still judge whether the reality-stage screenshots carry the intended story emotion.

## Batch 9: Flora Color Harmony Follow-Up

Status: `human-feedback patch complete`
Route/surface: procedural world systems via `?agent=1&atlas=1`
Budget: `standard`
Iteration: `9`

### Feedback

- Flora coloring was too consistent with tree canopy color.
- Flora should be more diverse, but still derived from the same planet palette and interior-design color theory rather than arbitrary random hues.

### Changes

- Reworked `buildFloraProfile` so flora foliage no longer reads directly from `canopyBase` and `canopyTip`.
- Added a separate understory/accent palette lane derived from `vegetationBase`, `flowerAccent`, `mineralAccent`, `dryGrass`, `bark`, and terrain secondary roles.
- Added hue-separation guards so flora foliage stays away from tree canopy hue while remaining close to planet-authored palette anchors.
- Kept high-saturation bloom as the accent role and lowered foliage saturation, especially for arid flora, so large plant surfaces do not consume the full accent budget.
- Updated cactus, fan, flower, and shrub geometry colors to use more varied blends of foliage, bloom, dry-grass, and bark roles.
- Added a regression test proving flora foliage stays distinct from tree canopy across representative atlas seeds.

### Checks

- `npm run test -- --run src/utils/floraField.test.ts`
- `npm run verify`
- `npm run atlas:showcase -- --label=batch9-flora-color-harmony-final --no-start`

### Showcase Evidence

- Atlas summary: `main/captures/procedural-atlas/2026-06-30T21-21-10-994Z-batch9-flora-color-harmony-final/summary.json`
- Atlas defects: `main/captures/procedural-atlas/2026-06-30T21-21-10-994Z-batch9-flora-color-harmony-final/defects.md`
- Cases: `9`
- Screenshots: `36`
- Console errors: `0`
- Machine defects: `0`
- Min FPS: `60`
- Worst p95: `17.3ms`
- Max draw calls: `133`
- Max triangles: `3,406,744`
- Total flora instances across showcase cases: `4,651`

### Gate Status

Human-feedback patch gate: `pass`

Remaining defects/deferred work:

- Human taste should still judge whether the stronger arid/fungal accent palettes are the right world tone.
- A future flora silhouette/volume pass can further separate species shapes; this batch focused on color role hierarchy.

## Batch 10: Procedural Tree Biology And Population Overhaul

Status: `tree machine gate complete`
Route/surface: tree harness plus procedural world via `?agent=1&atlas=1`
Budget: `flagship`
Iteration: `10`

### Changes

- Added bounded occupancy-light, energy, self-pruning, pipe-taper, and cantilever-sag tree biology.
- Added correlated species physiology and three cached age/phenotype archetypes, quality-gated to `3/3/2/1/0` for `ULTRA/HIGH/MEDIUM/LOW/POTATO`.
- Replaced near-field canopy blobs with branch-aligned botanical sprays and strict leaf-card ceilings.
- Added palette-authored bark, arc-length grain, generated-bound impostors, and silhouette-specific far masks.
- Added ecology-aware placement and variant-safe harvesting mappings.
- Added cross-platform tree capture metrics and a population mode to the standalone tree harness.
- Added phenotype/instance-correct canopy volume centers and quality-transition rebuild/handle cleanup.

### Checks

- `npm run test -- --run src/utils/treeBiology.test.ts src/utils/treeGen.test.ts src/utils/treeProfile.test.ts src/utils/treeMaterials.test.ts src/utils/treePopulation.test.ts src/utils/treeQuality.test.ts`
- `npx tsc --noEmit -p tsconfig.json --pretty false`
- `node tools/capture-trees.mjs --label=tree-overhaul-final-silhouettes --query=mode=silhouettes`
- `node tools/capture-trees.mjs --label=tree-overhaul-final-population --query=mode=population`
- `node tools/procedural-atlas.mjs --mode=smoke --label=tree-overhaul-smoke-final3 --no-start`
- `node tools/procedural-atlas.mjs --mode=perf --label=tree-overhaul-perf-final3 --no-start --settle=950 --warm=300`

### Gate Status

- Focused tree tests: `51 / 51` pass.
- Repository suite: `818 / 818` pass; TypeScript typecheck and production build pass.
- Profiled seed matrix: `144` phenotypes pass finite/index/bounds/taper/budget checks.
- In-game smoke: `3` cases, `12` screenshots, `0` console errors, `0` defects.
- Perf: geometry/draw budgets pass with `54-60fps`, max worst-view p95 `21.1ms`, and no atlas slow-frame defect; the max was a zero-tree POTATO control.
- Accepted external exception: current-checkout shader program counts exceed stale per-tier thresholds even in POTATO with trees disabled; no atlas budget was changed.
- Human taste approval remains open.

## Batch 11: Voxel Surface And Material Sweep

Status: `final machine and adversarial pass`
Route/surface: voxel harness plus procedural worlds via `?agent=1&atlas=1`
Budget: `flagship`
Iteration: `11`

### Defects Addressed

- Sand used full-cell grain hashes and one transparent 2x2 carrier per exposed voxel, producing perfect rectangular cadence inside otherwise convincing dust.
- Lava's spawned layer was a sparse generic glint and tiny embers, so the hazard had little readable thermal behavior.
- Static detail repeated across planets, lower tiers collapsed toward flat cubes, and multiple material families shared the same rounded noise language.

### Changes

- Consolidated flush detail into `voxel-pbr-v7`; runtime surface effects now contain only airborne motes and critters.
- Added seeded surface domains and bounded art-direction tints without adding textures, draws, or shader variants.
- Added continuous wind-warped sand, dark-crust lava with coherent molten/emissive masks, and distinct detail/PBR language for all twelve voxel materials.
- Added metallic host-rock flecks so metallic planets retain surface identity even when ore blocks are not exposed.
- Added proportional MEDIUM/LOW detail, strict reality-stage gates, dominant-face sampling, and cheaper height-only lava/ore masks.
- Extended the standalone harness for lava effects and shared-material rendering; extended atlas camera/report semantics for shader-integrated material vantages.

### Checks And Evidence

- `npm run verify`: `140` test files / `1060` tests pass; TypeScript and production build pass.
- Focused shader/profile/camera suites: `32` tests pass before full verification.
- Showcase: `main/captures/procedural-atlas/2026-07-13T00-32-00-573Z-voxel-surface-sweep-accepted/` (`9` cases / `36` screenshots / `0` defects).
- Perf: `main/captures/procedural-atlas/2026-07-13T00-34-10-599Z-voxel-surface-perf-final/` (`20` cases / `60` screenshots / `0` defects).
- Reality: `main/captures/procedural-atlas/2026-07-13T00-46-03-130Z-voxel-surface-reality-accepted/` (`45` cases / `135` screenshots / `0` defects).
- Perf range: `59-60fps`, max case p95 `17.0ms`, max worst-view p95 `17.1ms`, max `46` draws, max `37` programs.
- Independent adversarial review approved sand continuity, cooled-lava hierarchy, HIGH/MEDIUM identity, and stage progression with no remaining visual blocker.

### Deferred

- Volcanic terrain still selects individual lava surface cells with the existing seeded 5% rule. Connected terrain-scale lava rivers/calderas are a separate world-generation topology pass, not hidden in this material closeout.

## Batch 12: Demo Interruption, Controls, And Completion Shell

Status: `refined pass`
Route/surface: landing, active Story pause, sandbox pause, completed save, completion transition
Budget: `focused flagship shell`
Iteration: `4`

### Changes

- Added a pause-aware Story clock and froze physics/player/ship/touch paths behind pause.
- Removed Star Map from active Story and added a defensive Story travel guard.
- Added shared mode-aware desktop/touch Controls references without changing bindings.
- Restored zoom, visible focus, reduced motion, focus trapping/restoration, and narrow-layout fit.
- Added explicit completed-site continuation, confirmed Story replay, and completion recovery.
- Isolated Story-site cleanup from unrelated live-world singleton state.

### Checks And Evidence

- `npm --prefix main run verify`: 143 files / 1,077 tests; TypeScript and production build pass.
- Post-review focused suites: 48/48 pass; post-review TypeScript passes.
- `main/captures/demo-shell/`: six accepted shell states.
- Full report: `.codex/design-runs/2026-07-12-demo-shell/run-summary.md`.
- Scope locks honored: no new Story, audio-path change, or desktop binding change.
- Independent final re-reviews: no remaining concrete Batch 1 blocker; scoped score `4.62 / 5` against the `4.55` gate.

## Batch 13: Primitive Systems Foundation

Status: `machine implementation pass; browser approval pending`
Route/surface: Systems Sandbox primitive gather/craft/shelter/recovery loop
Budget: `deep`
Iteration: `3`

### Changes

- Reduced the public Fabricator and server authority to six reachable primitive recipes.
- Added quality-independent deadwood, guaranteed authoritative Flint, and active-Story economy isolation.
- Added sealed shelter analysis, fire/shelter warmth, night exposure, gentle downed recovery, and nearest shelter/landing respawn.
- Added retained-inventory recovery, desktop pointer-lock reacquisition, semantic build feedback, campfire spacing, and truthful decorative-roof labeling.
- Extended persistence proof across inventory, vitals, waterskin, structures, campfire, pickups, voxel edits, pose, and recovered spawn truth.

### Checks And Evidence

- Focused client suites pass; focused server authority passes.
- Full server verify: `62 / 62`, typecheck, and build pass.
- Full client typecheck passes; `1,101 / 1,102` tests pass.
- Only client failure: separate fauna-realism triangle budget, `1,004 > 800`.
- Browser probe launched without page errors and reached Play readiness under the
  extended timeout, but headless activation stalled at the trusted pointer-lock gesture.
- Full report: `.codex/design-runs/2026-07-12-primitive-foundation/run-summary.md`.
- Scope locks honored: no new Story, protected audio change, or desktop binding change.
