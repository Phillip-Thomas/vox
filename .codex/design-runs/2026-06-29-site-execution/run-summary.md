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

Next high-leverage batch:

1. Run and review reality-stage strips now that spawned phenomena respond to reality uniforms.
2. Re-run the full baseline matrix with the new `material` vantage included.
3. Add shader complexity audit notes for the major custom material paths.
4. Review atlas screenshots adversarially against the tree-led visual standard.
