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
- Fauna-specific atlas vantages and review framing.
- Shader-cohesion audit note with current program families and open passes.

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

Next high-leverage batch:

1. Continue shader cohesion audit into water, surface effects, sky, and post FX.
2. Run and review reality-stage strips now that spawned phenomena, lit fauna, lit flora, and voxel materials respond to reality uniforms.
3. Re-run the full baseline matrix with the new `material` and fauna/flora vantages included.
4. Review atlas screenshots adversarially against the tree-led visual standard.
