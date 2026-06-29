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

## Batch 4 Fauna Shader Cohesion

Canonical preview URL: `http://127.0.0.1:5173/?agent=1&atlas=1`
Atlas run: `main/captures/procedural-atlas/2026-06-29T04-44-57-353Z-batch4-fauna-shader-cohesion-accepted/`

- Cases: `9`
- Screenshots: `36`
- Archetypes: verdant, arid, frozen, volcanic, oceanic, crystal, metallic, fungal, anomaly.
- Profile: `HIGH`
- Stage: `alive`
- New fauna vantages: `fauna`, `grazer`, `woolly`, `hopper`, `dragonfly`.
- Console errors: `0`
- Machine defects: `0`
- Worst p95: `17.2ms`
- Fauna counts: verdant `141`, arid `51`, frozen `10`, volcanic `61`, oceanic `23`, crystal `7`, metallic `4`, fungal `58`, anomaly `15`.

Key screenshot paths:

- `verdant/-1_-1/alive/HIGH/grazer.png`
- `arid/1_0/alive/HIGH/hopper.png`
- `frozen/-1_0/alive/HIGH/woolly.png`
- `oceanic/0_0/alive/HIGH/dragonfly.png`
- `fungal/1_1/alive/HIGH/fauna.png`

Machine review:

- Blank frame: `pass`
- Console errors: `pass`
- Machine defects: `pass`
- Direct fauna closeup vantages resolve actual fauna instances: `pass`
- Shared fauna shader program remains bounded: `pass`

Perf run: `main/captures/procedural-atlas/2026-06-29T04-48-03-549Z-batch4-fauna-shader-cohesion-perf/`

- Cases: `20`
- Screenshots: `60`
- Console errors: `0`
- Machine defects: `0`
- Worst p95: `17.4ms`
- Dense ULTRA reference remains stable at `60fps`.

Human/adversarial visual review remains required for final approval.

## Batch 5 Fauna Roaming Continuity

Canonical preview URL: `http://127.0.0.1:5173/?agent=1&atlas=1`
Atlas run: `main/captures/procedural-atlas/2026-06-29T13-18-53-044Z-batch5-fauna-roaming-continuity/`

- Cases: `9`
- Screenshots: `36`
- Archetypes: verdant, arid, frozen, volcanic, oceanic, crystal, metallic, fungal, anomaly.
- Profile: `HIGH`
- Stage: `alive`
- Fauna program key: `fauna-field-v4`
- Console errors: `0`
- Machine defects: `0`
- Worst p95: `17.3ms`

Key screenshot paths:

- `verdant/-1_-1/alive/HIGH/fauna.png`
- `verdant/-1_-1/alive/HIGH/grazer.png`
- `arid/1_0/alive/HIGH/hopper.png`
- `frozen/-1_0/alive/HIGH/woolly.png`
- `oceanic/0_0/alive/HIGH/dragonfly.png`

Machine review:

- Blank frame: `pass`
- Console errors: `pass`
- Machine defects: `pass`
- Shared fauna shader program remains bounded: `pass`
- Rebuild continuity covered by unit regression: `pass`

Human/adversarial visual review remains required for final approval.

## Batch 6 Flora And Voxel Shader Cohesion

Canonical preview URL: `http://127.0.0.1:5173/?agent=1&atlas=1`
Showcase atlas run: `main/captures/procedural-atlas/2026-06-29T13-35-03-216Z-batch6-flora-voxel-cohesion/`

- Cases: `9`
- Screenshots: `36`
- Archetypes: verdant, arid, frozen, volcanic, oceanic, crystal, metallic, fungal, anomaly.
- Profile: `HIGH`
- Stage: `alive`
- Program keys: `flora-field-v2`, `voxel-pbr-v6`, `fauna-field-v4`
- Console errors: `0`
- Machine defects: `0`
- Worst p95: `17.4ms`

Key screenshot paths:

- `verdant/-1_-1/alive/HIGH/pollen.png`
- `verdant/-1_-1/alive/HIGH/material.png`
- `arid/1_0/alive/HIGH/material.png`
- `crystal/-2_1/alive/HIGH/material.png`
- `fungal/1_1/alive/HIGH/material.png`

Machine review:

- Blank frame: `pass`
- Console errors: `pass`
- Machine defects: `pass`
- Shared flora/voxel shader programs remain bounded: `pass`
- Flora/voxel material contracts covered by unit tests: `pass`

Perf atlas run: `main/captures/procedural-atlas/2026-06-29T13-37-32-285Z-batch6-flora-voxel-cohesion-perf/`

- Cases: `20`
- Screenshots: `60`
- Console errors: `0`
- Machine defects: `0`
- Worst p95: `17.4ms`
- Dense ULTRA reference stays at `60fps`.

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
