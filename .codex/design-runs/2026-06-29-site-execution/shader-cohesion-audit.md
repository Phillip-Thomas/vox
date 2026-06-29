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

## Current Program Families Seen In Atlas

- `voxel-pbr-v6`
- `water-blocks-iq-v3`
- `grass-pbr-v5`
- `tree-bark-v5`
- `tree-leaf-v6`
- `tree-impostor-v5`
- `flora-field-v2`
- `fauna-field-v4`
- `sand-dust-v2`
- `dirt-life-v4`
- `surface-phenomenon-v1`
- `loose-stone-v1`

## Open Shader Passes

- Voxel material: continue branch/noise cost review after `voxel-pbr-v6`; visual cohesion pass is complete.
- Water: keep physically readable but review whether sparkle/foam harshness matches the current softer fauna/tree grade.
- Flora: later geometry pass can improve petal/leaf volume and per-kind silhouettes; shader cohesion pass is complete.
- Surface effects: keep shared `surface-phenomenon-v1`, but review effect-specific alpha/readability at material vantages.
- Sky/post: verify tone mapping does not over-harshen animal and vegetation highlights on lower-quality screens.
