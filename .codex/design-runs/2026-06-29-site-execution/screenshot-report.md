# Screenshot Report

## Batch 1

Canonical preview URL: `http://127.0.0.1:5173/?agent=1&atlas=1`
Atlas run: `main/captures/procedural-atlas/2026-06-29T03-16-21-302Z-ecology-migration-smoke/`

Screenshots captured:

- `verdant/-1_-1/alive/HIGH/overhead.png`
- `verdant/-1_-1/alive/HIGH/tree.png`
- `verdant/-1_-1/alive/HIGH/coast.png`
- `arid/1_0/alive/HIGH/overhead.png`
- `arid/1_0/alive/HIGH/tree.png`
- `arid/1_0/alive/HIGH/coast.png`
- `fungal/1_1/alive/HIGH/overhead.png`
- `fungal/1_1/alive/HIGH/tree.png`
- `fungal/1_1/alive/HIGH/coast.png`

Machine review:

- Blank frame: `pass`
- Console errors: `pass`
- Machine defects: `pass`
- Layer counts present: `pass`

## Baseline Matrix

Atlas run: `main/captures/procedural-atlas/2026-06-29T03-31-01-037Z-baseline-final-clean/`

- Cases: `36`
- Screenshots: `180`
- Archetypes: all current archetypes.
- Profiles: `HIGH`, `MEDIUM`.
- Stage: `alive`.
- Vantages: `overhead`, `horizon`, `coast`, `tree`, `underCanopy`.
- Console errors: `0`
- Machine defects: `0`

Human/adversarial visual review remains required for final approval.

## Batch 2 Smoke Matrix

Canonical preview URL: `http://127.0.0.1:5173/?agent=1&atlas=1`
Atlas run: `main/captures/procedural-atlas/2026-06-29T03-56-41-879Z-batch2-sky-post-surface-effects/`

Screenshots captured:

- `verdant/-1_-1/alive/HIGH/overhead.png`
- `verdant/-1_-1/alive/HIGH/tree.png`
- `verdant/-1_-1/alive/HIGH/coast.png`
- `arid/1_0/alive/HIGH/overhead.png`
- `arid/1_0/alive/HIGH/tree.png`
- `arid/1_0/alive/HIGH/coast.png`
- `fungal/1_1/alive/HIGH/overhead.png`
- `fungal/1_1/alive/HIGH/tree.png`
- `fungal/1_1/alive/HIGH/coast.png`

Machine review:

- Blank frame: `pass`
- Console errors: `pass`
- Machine defects: `pass`
- Layer counts present: `pass`
- New material phenomena counted in `surfaceEffects`: `pass`

Perf note:

- Worst smoke p95: fungal coast `20.1ms`.
- This does not fail the machine gate, but it should be reviewed in the next `atlas:perf` run.

## Batch 3 Material Showcase

Canonical preview URL: `http://127.0.0.1:5173/?agent=1&atlas=1`
Atlas run: `main/captures/procedural-atlas/2026-06-29T04-15-01-668Z-batch3-material-showcase-settled/`

- Cases: `9`
- Screenshots: `29`
- Archetypes: verdant, arid, frozen, volcanic, oceanic, crystal, metallic, fungal, anomaly.
- Profile: `HIGH`
- Stage: `alive`
- New vantages include `material`, `hazard`, `mineral`, and effect-specific views such as `sandDust`, `frost`, `lavaHeat`, `ash`, `crystalGlints`, `metallicFlecks`, and `fungalSpores`.
- Console errors: `0`
- Machine defects: `0`
- Worst p95: `18ms`

Machine review:

- Blank frame: `pass`
- Console errors: `pass`
- Machine defects: `pass`
- Material/effect vantages find actual effect meshes when present: `pass`
- `surfaceEffects` layer counts remain visible in metrics: `pass`

## Batch 3 Perf Matrix

Atlas run: `main/captures/procedural-atlas/2026-06-29T04-20-42-640Z-batch3-perf-budgeted/`

- Cases: `20`
- Screenshots: `60`
- Archetypes: verdant, volcanic, fungal, anomaly.
- Profiles: `ULTRA`, `HIGH`, `MEDIUM`, `LOW`, `POTATO`.
- Stage: `alive`
- Vantages: `overhead`, `tree`, `material`.
- Console errors: `0`
- Machine defects: `0`
- Worst p95: anomaly LOW `21.2ms`.
- Max estimated triangles: verdant ULTRA `8,834,849`.
- Max HIGH estimated triangles: verdant HIGH `3,941,558`.
- POTATO screenshots intentionally show no expensive spawned effects.

Human/adversarial visual review remains required for final approval.
