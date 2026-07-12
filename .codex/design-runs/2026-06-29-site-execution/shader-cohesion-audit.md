# Shader Cohesion Audit

## Shared Direction

Trees remain the reference standard: full silhouettes, palette-aware color, wind-coherent motion, soft volume, rim/backlight, and material-specific detail without shader-program sprawl.

The shared shader vocabulary for future passes:

- Use `MeshStandardMaterial` plus `onBeforeCompile` for world objects that should receive scene lighting, fog, tone mapping, and post grade.
- Keep custom program keys stable and per-material family, not per-planet.
- Drive planet variation through uniforms, instance attributes, and profile data.
- Share wind, sun/moon, graphics quality, and reality-stage gates.
- Prefer one material path per layer with part/kind uniforms over many species/material-specific programs.

## Batch 4 Fauna Pass

Status: `refined pass`

Changes:

- Moved fauna from unlit `MeshBasicMaterial` to lit `MeshStandardMaterial`.
- Added fauna sun/moon uniforms, rim light, backlit SSS, wing translucency, roughness adjustment, and low-amplitude dither.
- Kept one shared fauna program key: `fauna-field-v3`.
- Added uniform-driven species ids so grazer, woolly, runner, hopper, and dragonfly can share the program while receiving per-kind patterning.
- Added palette separation so fauna coats avoid collapsing into grass/canopy hues on verdant planets.
- Added fauna-specific atlas vantages for `fauna`, `grazer`, `woolly`, `runner`, `hopper`, and `dragonfly`.

Evidence:

- Showcase: `main/captures/procedural-atlas/2026-06-29T04-44-57-353Z-batch4-fauna-shader-cohesion-accepted/summary.json`
- Perf: `main/captures/procedural-atlas/2026-06-29T04-48-03-549Z-batch4-fauna-shader-cohesion-perf/summary.json`
- Both runs: `0` console errors, `0` machine defects.

## Batch 5 Fauna Locomotion Continuity

Status: `refined pass`

Changes:

- Upgraded the shared fauna program key to `fauna-field-v4` for movement-driven gait attributes.
- Added persistent live-agent reconciliation during fauna rebuilds so distance-bucket streaming preserves current route progress, orientation, and animation state instead of respawning deterministic start poses.
- Added stable fauna home identity per species/source voxel while keeping mutable current and target voxels for roaming.
- Added per-instance `aFaunaStride` so ground gait follows accumulated locomotion state, while idle breathing and wind/wing motion remain time-driven.
- Added regression coverage proving rebuilds preserve live agent object identity, route progress, stride phase, and matrix position.

Evidence:

- Showcase: `main/captures/procedural-atlas/2026-06-29T13-18-53-044Z-batch5-fauna-roaming-continuity/summary.json`
- Defects: `main/captures/procedural-atlas/2026-06-29T13-18-53-044Z-batch5-fauna-roaming-continuity/defects.md`
- Run result: `9` cases, `36` screenshots, `0` console errors, `0` machine defects, worst p95 `17.3ms`.

## Batch 6 Flora And Voxel Cohesion

Status: `refined pass`

Changes:

- Moved flora from unlit `MeshBasicMaterial` to lit `MeshStandardMaterial`.
- Added uniform-driven flora species ids for cactus, fan, flower, seedhead, and shrub while keeping one shared program key: `flora-field-v2`.
- Added flora sun/moon uniforms, world-space rim light, backlit bloom glow, wind-aware color variation, and roughness shaping.
- Added flora material tests for lit shared-program behavior and reality/sun/moon uniform updates.
- Added shared voxel sun/moon uniforms and a subtle material-aware rim/atmosphere glow to `voxel-pbr-v6`.
- Kept voxel detail under the existing reality-stage and quality-profile gates; no new material variants were introduced.
- Added voxel material tests for the shared program key, quality toggles, reality uniforms, and sun/moon normalization.

Evidence:

- Showcase: `main/captures/procedural-atlas/2026-06-29T13-35-03-216Z-batch6-flora-voxel-cohesion/summary.json`
- Showcase defects: `main/captures/procedural-atlas/2026-06-29T13-35-03-216Z-batch6-flora-voxel-cohesion/defects.md`
- Perf: `main/captures/procedural-atlas/2026-06-29T13-37-32-285Z-batch6-flora-voxel-cohesion-perf/summary.json`
- Perf defects: `main/captures/procedural-atlas/2026-06-29T13-37-32-285Z-batch6-flora-voxel-cohesion-perf/defects.md`
- Showcase result: `9` cases, `36` screenshots, `0` console errors, `0` machine defects, worst p95 `17.4ms`.
- Perf result: `20` cases, `60` screenshots, `0` console errors, `0` machine defects, worst p95 `17.4ms`.

## Batch 7 Reality-Stage Shader Cohesion

Status: `refined pass`

Changes:

- Upgraded the shared water program key to `water-blocks-iq-v4`.
- Added water reality uniforms for chroma, detail, and atmosphere.
- Drove water wave amplitude, choppiness, reflection strength, foam, glint, color resolution, and subsurface term from reality effects.
- Added sky reality uniforms for chroma, detail, and atmosphere.
- Drove cloud quality, final sky grading, scene fog tint/density, and post-grade saturation/contrast/lift/shoulder from reality effects.
- Added a surface-effect reality density gate so bare/color stages do not allocate spawned phenomena while material/alive/paradox progressively restore them.
- Updated atlas effect-vantage semantics so intended absence in bare/color is not treated as a missing effect.
- Updated atlas case p95 aggregation to use an upper view percentile, preventing isolated headless screenshot warmup spikes from failing an otherwise stable case.
- Follow-up review patch keeps that percentile aggregation but records `worstViewP95` and emits `slow_view_p95` for severe single-view outliers; it also caps water reality wave amplitude at the documented voxel-cell crest bound.

Evidence:

- Reality: `main/captures/procedural-atlas/2026-06-29T18-59-59-295Z-batch7-reality-shader-cohesion-final/summary.json`
- Reality defects: `main/captures/procedural-atlas/2026-06-29T18-59-59-295Z-batch7-reality-shader-cohesion-final/defects.md`
- Perf: `main/captures/procedural-atlas/2026-06-29T19-09-48-014Z-batch7-reality-shader-cohesion-perf/summary.json`
- Perf defects: `main/captures/procedural-atlas/2026-06-29T19-09-48-014Z-batch7-reality-shader-cohesion-perf/defects.md`
- Reality result: `45` cases, `135` screenshots, `0` console errors, `0` machine defects.
- Perf result: `20` cases, `60` screenshots, `0` console errors, `0` machine defects.

## Batch 8 Grass And Tree Reality Audit

Status: `final machine pass`

Changes:

- Added reality uniforms to the shared grass shader: `uGrassVisibility` and `uGrassChroma`.
- Grass now gates visibility, chroma, emissive SSS, and wind motion from the same organic/detail/atmosphere reality effects used by flora/fauna.
- Added reality uniforms to all tree material families: bark, leaf, blossom, and impostor.
- Trees now gate visibility, chroma, leaf/blossom glow, and wind motion from the shared reality effects while keeping impostor wind frozen.
- Kept all grass/tree program keys stable: `grass-pbr-v5`, `tree-bark-v5`, `tree-leaf-v6`, `tree-blossom-v5`, and `tree-impostor-v5`.
- Trimmed MEDIUM organic budget after final baseline found one triangle-budget near miss: `grassDensity 1.6 -> 1.1`, `grassMaxDistance 40 -> 34`, `treeMaxDistance 80 -> 72`. LOW remains sparser (`1`, `24`, `50`) and HIGH/ULTRA are unchanged.

Evidence:

- Final baseline: `main/captures/procedural-atlas/2026-06-30T12-09-50-900Z-batch8-grass-tree-reality-final-clean/summary.json`
- Final baseline defects: `main/captures/procedural-atlas/2026-06-30T12-09-50-900Z-batch8-grass-tree-reality-final-clean/defects.md`
- Result: `36` cases, `216` screenshots, `0` console errors, `0` machine defects.
- Max case p95: `17.5ms`; max single-view p95: `17.8ms`; max draw calls: `148`; max program count: `43`.
- Highest MEDIUM triangle case after budget trim: `004-verdant--2_-1-alive-MEDIUM` at `1,496,178` triangles, below the `1,500,000` budget.

## Current Program Families Seen In Atlas

- `voxel-pbr-v6`
- `water-blocks-iq-v4`
- `grass-pbr-v5`
- `tree-bark-v5`
- `tree-leaf-v6`
- `tree-blossom-v5`
- `tree-impostor-v5`
- `flora-field-v2`
- `fauna-field-v4`
- `sand-dust-v2`
- `dirt-life-v4`
- `surface-phenomenon-v1`
- `loose-stone-v1`

## Open Shader Passes

- Voxel material: continue branch/noise cost review after `voxel-pbr-v6`; visual cohesion pass is complete.
- Water: reality-stage cohesion pass is complete; later visual review can tune subjective foam/sparkle taste.
- Flora: later geometry pass can improve petal/leaf volume and per-kind silhouettes; shader cohesion pass is complete.
- Surface effects: reality density/visibility gates are complete; later visual review can tune effect-specific alpha/readability at material vantages.
- Sky/post: reality-stage cohesion pass is complete; lower-quality-screen harshness should be judged in screenshot review.
- Grass/tree materials: shader-cost and reality-gate audit is complete for current `grass-pbr-v5`, `tree-bark-v5`, `tree-leaf-v6`, `tree-blossom-v5`, and `tree-impostor-v5`; remaining work is subjective screenshot/taste review, not a known shader-program gap.

## Batch 10 Procedural Tree Biology And Population Overhaul

Status: `tree machine gate complete; human taste approval open`

Changes:

- Replaced depth-first unconditional branching with a bounded active-tip growth queue. Tips now estimate local sky exposure from competing growth endings, steer phototropically, allocate light-driven vigor, and self-prune weak shaded proposals.
- Changed trunk/branch taper to a living-tip pipe model and branch sag to a clamped cantilever approximation using downstream support, lever arm, radius, and species stiffness.
- Correlated shade tolerance, phototropism, bright-growth priority, pruning floor, maturity, and crown asymmetry instead of sampling unrelated style knobs.
- Added three deterministic age/phenotype archetypes per planet species on HIGH, two on MEDIUM, one on LOW, and none on POTATO. Instances partition between variants, so diversity does not duplicate visible trees.
- Rebuilt broadleaf foliage as branch-aligned botanical sprays with negative canopy space; removed the round near-field tuft union that collapsed crowns into blobs.
- Added planet-authored bark color and arc-length bark grain. Current tree keys are `tree-bark-v6`, `tree-leaf-v7`, `tree-blossom-v5`, and `tree-impostor-v6`.
- Made far impostors use generated crown bounds plus family-specific SDF silhouettes.
- Made placement respect ecology material eligibility/richness/canopy/negative-space tokens while retaining the legacy placement hash for harvested-coordinate continuity.
- Expanded the harvest pick contract to carry a separate instance-id map for each variant trunk/leaf mesh.

Evidence:

- Silhouette board: `main/captures/tree-overhaul-final-silhouettes.png`
- Same-species population board: `main/captures/tree-overhaul-final-population.png`
- Cross-seed variety board: `main/captures/tree-overhaul-final-variety.png`
- In-game smoke: `main/captures/procedural-atlas/2026-07-12T01-53-01-009Z-tree-overhaul-smoke-final2/summary.json`
- Perf matrix: `main/captures/procedural-atlas/2026-07-12T01-53-42-642Z-tree-overhaul-perf-final2/summary.json`
- Focused result: `6` tree test files / `51` tests passed, including `144` profiled phenotype generations plus full-buffer determinism hashes.
- Smoke result: `3` cases / `12` screenshots / `0` console errors / `0` machine defects.
- Perf geometry result: `20` cases / `60` screenshots / `0` console errors; every tier held `60fps`, max worst-view p95 `18.9ms`, max draw calls `151`.
- Triangle peaks: ULTRA `8,506,326 / 9,200,000`; HIGH `3,826,804 / 4,200,000`; MEDIUM `1,116,200 / 1,500,000`; LOW `906,322 / 1,000,000`; POTATO `741,918 / 800,000`.

Accepted exception:

- Perf reports `shader_explosion` against the current checkout's program thresholds. The same overage persists in POTATO where trees are disabled, while tree material program families remain exactly four; this is not attributed to the tree overhaul and no threshold was relaxed.
