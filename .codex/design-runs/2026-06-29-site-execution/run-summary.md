# Run Summary

This execution run started implementation of the procedural world cohesion plan.

Completed:

- Harness foundation.
- Shared planet art-direction contract.
- Palette role tests.
- Deterministic archetype seed fixtures.
- HUD-free atlas capture mode.
- Profile summary bridge.
- Main color consumer migration.
- Flora/fauna ecology gating.
- Sky, fog, and post-processing grade migration.
- Generic material-phenomena surface effects.
- Surface-effect ecology eligibility for lava, basalt, ice, crystal, stone, and ore materials.
- Material/hazard/mineral/effect-specific atlas vantages.
- Settled per-vantage metric sampling and aggregated worst-view case metrics.
- Profile-specific atlas performance budgets.
- Lit fauna shader cohesion and locomotion continuity pass with one shared current `fauna-field-v4` program.
- Lit flora shader cohesion pass with one shared current `flora-field-v2` program.
- Voxel material soft rim/atmosphere cohesion pass with current `voxel-pbr-v6`.
- Reality-stage shader cohesion pass for water, surface effects, sky, scene fog, and post grade.
- Review follow-up patch: water reality wave amplitude now stays under the documented voxel-cell crest bound, and atlas metrics now retain a worst-view p95 guard alongside percentile case aggregation.
- Grass/tree reality audit: grass and tree material families now share reality-stage visibility/chroma/motion gates without shader-program sprawl.
- Final baseline matrix after MEDIUM organic-budget trim.
- Fauna-specific atlas vantages and review framing.
- Shader-cohesion audit note with current program families and open passes.
- Human flora-color follow-up: flora foliage now uses a separate palette-derived understory/accent lane instead of duplicating tree canopy roles.

Current validated atlas:

Smoke: `main/captures/procedural-atlas/2026-06-29T03-16-21-302Z-ecology-migration-smoke/`

Baseline: `main/captures/procedural-atlas/2026-06-29T03-31-01-037Z-baseline-final-clean/`

Baseline result:

- `36` cases.
- `180` screenshots.
- `0` console errors.
- `0` machine defects.
- HIGH max p95 `17.1ms`.
- MEDIUM max p95 `17.7ms`.

Latest smoke:

`main/captures/procedural-atlas/2026-06-29T03-56-41-879Z-batch2-sky-post-surface-effects/`

- `3` cases.
- `9` screenshots.
- `0` console errors.
- `0` machine defects.
- New spawned surface effects are counted in atlas metrics.
- Worst smoke p95 `20.1ms`; needs longer perf follow-up.

Latest material showcase:

`main/captures/procedural-atlas/2026-06-29T04-15-01-668Z-batch3-material-showcase-settled/`

- `9` cases.
- `29` screenshots.
- `0` console errors.
- `0` machine defects.
- Worst p95 `18ms`.
- Surface-effect counts ranged from crystal `525` to arid `11,046`.

Latest perf matrix:

`main/captures/procedural-atlas/2026-06-29T04-20-42-640Z-batch3-perf-budgeted/`

- `20` cases.
- `60` screenshots.
- `0` console errors.
- `0` machine defects.
- Profiles covered: `ULTRA`, `HIGH`, `MEDIUM`, `LOW`, `POTATO`.
- Worst p95 anomaly LOW `21.2ms`, within calibrated budget.
- Dense tree-led ULTRA reference reached `8,834,849` estimated triangles while holding `60fps`.

Latest fauna/shader showcase:

`main/captures/procedural-atlas/2026-06-29T04-44-57-353Z-batch4-fauna-shader-cohesion-accepted/`

- `9` cases.
- `36` screenshots.
- `0` console errors.
- `0` machine defects.
- Direct fauna vantages captured grazer, hopper, woolly, dragonfly, and fungal fauna.
- Worst p95 `17.2ms`.

Latest fauna/shader perf:

`main/captures/procedural-atlas/2026-06-29T04-48-03-549Z-batch4-fauna-shader-cohesion-perf/`

- `20` cases.
- `60` screenshots.
- `0` console errors.
- `0` machine defects.
- Worst p95 `17.4ms`.
- Dense ULTRA reference stayed at `60fps`.

Latest fauna roaming-continuity showcase:

`main/captures/procedural-atlas/2026-06-29T13-18-53-044Z-batch5-fauna-roaming-continuity/`

- `9` cases.
- `36` screenshots.
- `0` console errors.
- `0` machine defects.
- Worst p95 `17.3ms`.
- Shared fauna program key is now `fauna-field-v4`.
- Unit regression verifies visible rebuilds preserve live agent identity, route progress, stride phase, and matrix position.

Latest flora/voxel shader showcase:

`main/captures/procedural-atlas/2026-06-29T13-35-03-216Z-batch6-flora-voxel-cohesion/`

- `9` cases.
- `36` screenshots.
- `0` console errors.
- `0` machine defects.
- Worst p95 `17.4ms`.
- Program keys: `flora-field-v2`, `voxel-pbr-v6`, `fauna-field-v4`.

Latest flora/voxel shader perf:

`main/captures/procedural-atlas/2026-06-29T13-37-32-285Z-batch6-flora-voxel-cohesion-perf/`

- `20` cases.
- `60` screenshots.
- `0` console errors.
- `0` machine defects.
- Worst p95 `17.4ms`.
- Dense ULTRA reference stayed at `60fps`.

Latest reality-stage shader cohesion:

`main/captures/procedural-atlas/2026-06-29T18-59-59-295Z-batch7-reality-shader-cohesion-final/`

- `45` cases.
- `135` screenshots.
- `0` console errors.
- `0` machine defects.
- Stages covered: `bare`, `color`, `material`, `alive`, `paradox`.
- Stage p95 averages: bare `17.43ms`, color `17.26ms`, material `17.39ms`, alive `17.42ms`, paradox `17.16ms`.
- Bare/color suppress spawned surface-effect allocation; material/alive/paradox restore staged surface phenomena.
- Current water program key is `water-blocks-iq-v4`.
- Follow-up verification: `npm test -- --run src/utils/waterBlocksMaterial.test.ts`, `node --check tools/procedural-atlas.mjs`, `git diff --check`, and `npm run verify` passed after the water-bound and atlas slow-view guard patch.

Latest Batch 7 perf matrix:

`main/captures/procedural-atlas/2026-06-29T19-09-48-014Z-batch7-reality-shader-cohesion-perf/`

- `20` cases.
- `60` screenshots.
- `0` console errors.
- `0` machine defects.
- Profiles covered: `ULTRA`, `HIGH`, `MEDIUM`, `LOW`, `POTATO`.

Latest Batch 8 final baseline:

`main/captures/procedural-atlas/2026-06-30T12-09-50-900Z-batch8-grass-tree-reality-final-clean/`

- `36` cases.
- `216` screenshots.
- `0` console errors.
- `0` machine defects.
- Max p95 `17.5ms`.
- Max single-view p95 `17.8ms`.
- Max draw calls `148`.
- Max program count `43`.
- Highest MEDIUM triangle case: `004-verdant--2_-1-alive-MEDIUM` at `1,496,178` triangles under the `1,500,000` budget.
- Program keys remain bounded: `grass-pbr-v5`, `tree-bark-v5`, `tree-leaf-v6`, `tree-blossom-v5`, `tree-impostor-v5`.

Latest Batch 9 flora color harmony follow-up:

`main/captures/procedural-atlas/2026-06-30T21-21-10-994Z-batch9-flora-color-harmony-final/`

- `9` cases.
- `36` screenshots.
- `0` console errors.
- `0` machine defects.
- Min FPS `60`.
- Worst p95 `17.3ms`.
- Total flora instances across showcase cases: `4,651`.
- Regression added for flora foliage hue separation from tree canopy while remaining close to planet palette anchors.

Next high-leverage batch:

1. Human/adversarial review of the final baseline, Batch 9 flora color screenshots, and Batch 7 reality-stage screenshots against the tree-led visual standard and story-stage promise.
2. Capture human taste approval or list the specific subjective fixes required.
3. Patch only visual-stage clarity issues found by that review; no known machine defect remains.

## 2026-07-11 Tree Biology And Population Upgrade

Paravoxia trees now grow through a deterministic, bounded biological graph rather than unconditional depth-first recursion. Active tips compete for open sky, convert exposure to vigor, self-prune in shade, reinforce supporting wood through a pipe model, and bend under clamped downstream load. Six silhouette families retain distinct crown envelopes while each planet now caches young, canonical, and veteran phenotypes.

Foliage is branch-aligned and botanical at near range, bark follows planet palette roles and branch arc length, and impostors preserve the generated crown aspect/family outline. Forest placement now honors ecology material eligibility and shape-density tokens. Variant meshes keep separate harvest mappings, preserving gameplay targeting.

Volumetric canopy lighting now follows each generated phenotype's actual crown center through per-instance scale and lean. Runtime graphics-quality changes rebuild swapped archetypes and clear disabled-tree pick handles, so visual and harvesting state remain coherent across every quality tier.

Evidence:

- `main/captures/tree-overhaul-final-silhouettes.png`
- `main/captures/tree-overhaul-final-population.png`
- `main/captures/tree-overhaul-final-variety.png`
- `main/captures/procedural-atlas/2026-07-12T02-07-11-018Z-tree-overhaul-smoke-final3/summary.json`
- `main/captures/procedural-atlas/2026-07-12T02-08-03-280Z-tree-overhaul-perf-final3/summary.json`

Machine result: focused `51 / 51` tree tests and the full `818 / 818` repository suite pass; TypeScript typecheck and production build pass. All `144` profiled phenotypes pass all-attribute determinism plus structural/budget invariants, and smoke is clean. The perf matrix has no slow-frame defect, spans `54-60fps`, and peaks at `21.1ms` in a zero-tree POTATO control; HIGH/ULTRA tree cases hold `60fps` with max p95 `17.1ms`. Program-count defects remain in the broader current checkout, including POTATO where trees are disabled, and are recorded as an external accepted exception rather than hidden by threshold changes.
