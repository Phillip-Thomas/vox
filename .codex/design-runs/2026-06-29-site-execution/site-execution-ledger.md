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
