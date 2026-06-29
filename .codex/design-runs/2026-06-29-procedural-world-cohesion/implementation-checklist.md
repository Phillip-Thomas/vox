# Master Implementation Checklist: Procedural World Cohesion

This checklist is intentionally long. It is the execution ledger for turning good individual procedural systems into a cohesive, scalable, beautiful world generator.

## Phase 0: Planning Gate

- [x] Choose run mode: `site-wide-review-plan`.
- [x] Choose future execution mode: `refactor-existing`.
- [x] Read Paravoxia synopsis and preserve story/rendering progression.
- [x] Survey current procedural systems.
- [x] Identify existing harnesses and metrics.
- [x] Create durable design-run artifacts.
- [x] Human confirms this checklist as the execution source of truth.

Exit gate:

- [x] Checklist is accepted or amended.
- [x] First implementation batch is selected.

## Phase 1: Harness Foundation

- [x] Make `main/tools/capture.mjs` Linux-first:
  - [x] support `CHROME_PATH`,
  - [x] default to `/snap/bin/chromium` when present,
  - [x] keep existing Windows path as fallback only,
  - [x] support headless/headed mode,
  - [x] write browser mode into metrics.
- [x] Add `main/tools/procedural-atlas.mjs`.
- [x] Add deterministic archetype seed discovery:
  - [x] helper lists seeds for every `ArchetypeId`,
  - [x] fixture stores at least two representative seeds per archetype,
  - [x] tests prove every archetype has representative seeds.
- [x] Extend `window.__game` bridge:
  - [x] expose active terrain seed/world coordinate,
  - [x] expose active quality profile,
  - [x] expose active reality stage,
  - [x] expose scene layer counts,
  - [x] expose material/program keys,
  - [x] expose settled metrics after warmup.
- [x] Add atlas output structure:
  - [x] manifest,
  - [x] screenshots,
  - [x] metrics,
  - [x] profile summaries,
  - [x] machine defect flags.
- [x] Implement smoke mode:
  - [x] 3 seeds,
  - [x] HIGH profile,
  - [x] alive stage,
  - [x] overhead/tree/coast vantages.
- [x] Implement baseline mode:
  - [x] all archetypes,
  - [x] HIGH and MEDIUM,
  - [x] alive stage,
  - [x] overhead/horizon/coast/tree/underCanopy.
- [x] Implement reality mode:
  - [x] representative seeds,
  - [x] all reality stages,
  - [x] overhead and ground-level vantages.
- [x] Implement perf mode:
  - [x] selected heavy seeds,
  - [x] ULTRA/HIGH/MEDIUM/LOW/POTATO,
  - [x] frame and scene metrics.
- [x] Add `npm` scripts:
  - [x] `atlas:smoke`,
  - [x] `atlas:baseline`,
  - [x] `atlas:perf`,
  - [x] `atlas:showcase`.

Exit gate:

- [x] `atlas:smoke` completes without app console errors.
- [x] Screenshots are nonblank.
- [x] Metrics JSON includes fps, p50, p95, draw calls, triangles, layer counts.
- [x] Baseline report is saved in this run folder or linked from it.

## Phase 2: Planet Art Direction Contract

- [x] Create `main/src/utils/planetArtDirection.ts`.
- [x] Define `PlanetArtDirection` type:
  - [x] seed,
  - [x] archetype,
  - [x] biome,
  - [x] palette family,
  - [x] palette role colors,
  - [x] contrast/saturation/accent budgets,
  - [x] ecology richness,
  - [x] shape tokens,
  - [x] wind drama,
  - [x] material phenomenon weights,
  - [x] quality/performance hints.
- [x] Implement palette families:
  - [x] analogous,
  - [x] split-complement,
  - [x] triadic-muted,
  - [x] earth-and-jewel,
  - [x] warm-cool-polar,
  - [x] monochrome-accent,
  - [x] alien-iridescent,
  - [x] volcanic-ember,
  - [x] frozen-mineral,
  - [x] fungal-bioglow.
- [x] Assign palette families by archetype plus seeded variation.
- [x] Define role proportions:
  - [x] dominant 60-70%,
  - [x] secondary 20-30%,
  - [x] accent 5-10%,
  - [x] hazard accent separately capped.
- [x] Define value structure:
  - [x] sky high/low separation,
  - [x] ground/water separation,
  - [x] grass/canopy separation,
  - [x] fauna/flora visibility against ground.
- [x] Add pure utilities:
  - [x] circular hue distance,
  - [x] relative luma estimate,
  - [x] saturation clamp,
  - [x] role contrast score,
  - [x] palette diversity score,
  - [x] accent budget score.
- [x] Add tests:
  - [x] deterministic for same seed,
  - [x] all color roles finite/in range,
  - [x] sufficient hue/value separation for key pairs,
  - [x] no accent overload,
  - [x] no diversity collapse across 100+ seeds,
  - [x] archetype family expectations hold.

Exit gate:

- [x] Unit tests pass.
- [x] A profile summary can be exported for each atlas seed.
- [x] Render consumer migration was deferred to Phase 3 instead of mixed into pure-contract scaffolding.

## Phase 3: Palette Consumer Migration

- [ ] Refactor `BiomeProfile` to either delegate palette roles to `PlanetArtDirection` or become an input to it with no conflicting color ownership.
- [x] Refactor `GrassProfile`:
  - [x] use `vegetationBase`, `vegetationTip`, `dryGrass`, `sss`,
  - [x] preserve density/height climate logic,
  - [x] test color roles track art direction.
- [x] Refactor `TreeProfile`:
  - [x] use `canopyBase`, `canopyTip`, `canopySSS`, `flowerAccent`, `bark`,
  - [x] preserve species shape controls,
  - [x] test leaf/grass distinction.
- [x] Refactor `WaterProfile`:
  - [x] use `waterDeep`, `waterShallow`, `waterFoam`, `waterSSS`,
  - [x] preserve water readability on alien worlds,
  - [x] test water/land contrast.
- [x] Refactor `TerrainProfile` and `voxelMaterial`:
  - [x] use soil/rock/sand/material roles,
  - [x] preserve per-material identity,
  - [ ] no hard-coded palette drift unless material-specific.
- [x] Refactor `SpaceSky`:
  - [x] drive sky low/high/glow from art direction,
  - [x] keep archetype identity,
  - [x] avoid generic blue override except where palette calls for it.
- [x] Refactor `PostFX` color grade:
  - [x] use `postGradeTint`, contrast, saturation, warmth from art direction,
  - [x] keep subtlety and ACES safety.
- [x] Refactor flora/fauna colors:
  - [x] use plant/fauna role colors,
  - [x] preserve species differentiation.
- [x] Add migration tests for role usage.

Exit gate:

- [x] Atlas smoke shows sky/water/terrain/vegetation in one coherent palette.
- [x] Unit tests prove consumers read the shared contract.
- [x] No major performance regression from profile construction.

## Phase 4: Ecology And Spawn Validity

- [x] Add `planetEcology.ts` or include ecology in art direction.
- [x] Define material eligibility for:
  - [x] grass,
  - [x] trees,
  - [x] flora kinds,
  - [x] fauna kinds,
  - [x] rocks/stones,
  - [x] surface effects,
  - [x] forage/resources.
- [ ] Define archetype/ecology expectations:
  - [ ] verdant: dense grass, trees, flowers, grazers, insects.
  - [ ] arid: sand dust, cacti, seedheads, hoppers/runners, sparse trees.
  - [ ] frozen: ice/frost, sparse hardy flora, no warm fauna unless adapted.
  - [ ] volcanic: basalt/lava/ash, minimal organic growth, heat effects.
  - [ ] oceanic: coast/water life emphasis, island vegetation.
  - [ ] crystal: crystal/facet phenomena, sparse alien flora.
  - [ ] metallic: rock/mineral phenomena, low organic density.
  - [ ] fungal: bioluminescent/mushroom-like flora, spores.
  - [ ] anomaly: paradox growths, unusual colors, constrained weirdness.
- [x] Refactor flora weights to use ecology rules.
- [x] Refactor fauna weights/travel rules to use ecology rules.
- [x] Refactor surface effect registry:
  - [x] sand dust,
  - [x] dirt loose soil/micro-life,
  - [x] grass pollen/seed motes,
  - [x] ice frost streamers,
  - [x] snow/ice crystal sparkle,
  - [x] lava heat shimmer/embers,
  - [x] basalt ash wisps,
  - [x] crystal glints/refraction motes,
  - [x] metallic magnetic flecks,
  - [x] fungal spores/bioluminescent motes.
- [ ] Add spawn validity tests over seed matrix:
  - [x] no unsupported material placement,
  - [ ] no water placement unless intended,
  - [ ] no missing required ecology for archetype,
  - [ ] rare exceptions are explicitly flagged.

Exit gate:

- [x] Ecology tests pass.
- [x] Atlas flags no high-severity invalid spawns.

## Phase 5: Shape, Scale, And Stylization System

- [ ] Define shape tokens:
  - [ ] roundness,
  - [ ] angularity,
  - [ ] verticality,
  - [ ] leaf-card density,
  - [ ] blade thinness,
  - [ ] prop softness,
  - [ ] shard/spike amount,
  - [ ] surface relief scale.
- [ ] Apply shape tokens to:
  - [ ] grass width/height/bend,
  - [ ] tree silhouette/branch density/leaf mode,
  - [ ] flora scale/kind frequency,
  - [ ] fauna scale/material/shape emphasis,
  - [ ] rock facets,
  - [ ] surface effect dimensions,
  - [ ] voxel detail frequencies.
- [ ] Define global scale expectations:
  - [ ] voxel block = 2 world units.
  - [ ] grass hair remains small.
  - [ ] flora remains below fauna/tree except special cacti/shrubs.
  - [ ] sheep/grazers are large enough to read.
  - [ ] trees are canopy-scale, not player-height.
  - [ ] rocks do not overpower fauna or trees.
  - [ ] surface effects stay thin/atmospheric.
- [ ] Add tests for scale ranges:
  - [ ] tree min/max height,
  - [ ] fauna tiers,
  - [ ] flora tiers,
  - [ ] surface effect offsets,
  - [ ] no underground/float by transform sampling.
- [ ] Add atlas scene traversal scale report.

Exit gate:

- [ ] Scale tests pass.
- [ ] Visual review confirms hierarchy in ground-level screenshots.

## Phase 6: Shader And Material Performance Scrutiny

- [ ] Inventory shader programs and custom keys.
- [ ] For each shader path, document:
  - [ ] quality gate,
  - [ ] reality-stage gate,
  - [ ] uniform count,
  - [ ] texture count,
  - [ ] procedural noise cost,
  - [ ] branch strategy,
  - [ ] distance fade,
  - [ ] animation toggle.
- [x] Add performance thresholds to atlas report.
- [ ] Add shader complexity audit notes for:
  - [ ] voxel material,
  - [ ] water,
  - [ ] tree materials,
  - [ ] grass material,
  - [ ] flora material,
  - [ ] fauna material,
  - [ ] surface effects,
  - [ ] sky,
  - [ ] post FX.
- [x] Verify quality profiles:
  - [x] ULTRA: showcase, acceptable heavy.
  - [x] HIGH: default visually rich.
  - [x] MEDIUM: old laptop target, coherent but cheaper.
  - [x] LOW: sparse but still readable.
  - [x] POTATO: no expensive layers, no broken visuals.
- [ ] Optimize high-cost offenders:
  - [ ] reduce branchy shader paths,
  - [ ] share program keys,
  - [ ] increase culling,
  - [ ] lower instance density,
  - [ ] fade high-frequency detail with distance,
  - [ ] prefer instancing over many meshes.

Exit gate:

- [x] Atlas perf mode meets thresholds or records accepted exceptions.
- [x] No shader/program explosion.
- [x] No profile produces broken frame.

## Phase 7: Reality Stage Progression

- [ ] Define visual promise for each stage:
  - [ ] `bare`: monochrome/low-detail cube construct.
  - [ ] `color`: color awakens but material is flat.
  - [ ] `material`: material properties and surface detail emerge.
  - [ ] `alive`: organic/spawned world layer fully present.
  - [ ] `paradox`: heightened, impossible, but still art-directed.
- [ ] Audit all systems for stage response:
  - [ ] voxel material,
  - [ ] grass,
  - [ ] trees,
  - [ ] flora,
  - [ ] fauna,
  - [ ] surface effects,
  - [ ] water,
  - [ ] sky/post.
- [ ] Add stage gates where missing.
- [ ] Atlas reality mode captures stage strips.
- [ ] Visual review checks stage continuity.

Exit gate:

- [ ] Reality progression reads as intentional in screenshots.
- [ ] Device quality and story stage remain separate.

## Phase 8: Deep Iterative Visual Refinement

For each atlas batch:

- [ ] Capture baseline matrix.
- [x] Generate machine report.
- [ ] Review screenshots with adversarial rubric.
- [x] Score each category.
- [ ] Select highest-leverage defect.
- [ ] Patch foundation before local polish when systemic.
- [x] Re-run same matrix.
- [x] Compare visual and perf changes.
- [ ] Classify late defects if improvement < 0.05.
- [x] Update scorecard, screenshot report, run summary, and lessons.

Iteration targets:

- [x] first-pass atlas score >= 4.30.
- [x] refined atlas score >= 4.60.
- [ ] final atlas score >= 4.85.
- [x] no category below 4.45.
- [x] no critical/high defects.
- [ ] no unaccepted medium palette/ecology/scale/perf defects.

## Phase 9: Documentation And Maintainability

- [ ] Document art direction module.
- [ ] Document palette families and examples.
- [ ] Document ecology rules.
- [x] Document performance budgets.
- [x] Document harness command usage.
- [ ] Add inline comments only for non-obvious math.
- [ ] Keep all profile modules pure and deterministic.
- [ ] Avoid hidden runtime mutable art state.
- [x] Update design-run lessons.

Final gate:

- [ ] `npm run verify` passes.
- [ ] `atlas:baseline` passes.
- [x] `atlas:perf` passes or accepted exceptions documented.
- [ ] Desktop and mobile or relevant viewport screenshots reviewed.
- [ ] Human taste approval captured.
- [ ] Final scorecard approves the system.
