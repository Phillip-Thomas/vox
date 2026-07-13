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

## Batch 7 Reality-Stage Shader Cohesion

Canonical preview URL: `http://127.0.0.1:5173/?agent=1&atlas=1`
Reality atlas run: `main/captures/procedural-atlas/2026-06-29T18-59-59-295Z-batch7-reality-shader-cohesion-final/`

- Cases: `45`
- Screenshots: `135`
- Archetypes: verdant, arid, frozen, volcanic, oceanic, crystal, metallic, fungal, anomaly.
- Profile: `HIGH`
- Stages: `bare`, `color`, `material`, `alive`, `paradox`
- Console errors: `0`
- Machine defects: `0`
- Stage p95 averages: bare `17.43ms`, color `17.26ms`, material `17.39ms`, alive `17.42ms`, paradox `17.16ms`

Key screenshot paths:

- `verdant/-1_-1/bare/HIGH/overhead.png`
- `verdant/-1_-1/color/HIGH/horizon.png`
- `verdant/-1_-1/material/HIGH/material.png`
- `oceanic/0_0/material/HIGH/material.png`
- `volcanic/0_-2/alive/HIGH/material.png`
- `fungal/1_1/paradox/HIGH/horizon.png`
- `anomaly/0_-1/paradox/HIGH/material.png`

Machine review:

- Blank frame: `pass`
- Console errors: `pass`
- Machine defects: `pass`
- Bare/color suppress spawned surface-effect allocation: `pass`
- Material/alive/paradox restore material phenomena: `pass`
- Water, sky, fog, surface effects, and post grade respond to reality uniforms/effects: `pass`

Perf atlas run: `main/captures/procedural-atlas/2026-06-29T19-09-48-014Z-batch7-reality-shader-cohesion-perf/`

- Cases: `20`
- Screenshots: `60`
- Profiles: `ULTRA`, `HIGH`, `MEDIUM`, `LOW`, `POTATO`
- Console errors: `0`
- Machine defects: `0`

Human/adversarial visual review remains required for final approval, especially whether each reality stage reads clearly enough for the plot progression.

## Batch 8 Grass/Tree Reality Audit And Final Baseline

Canonical preview URL: `http://127.0.0.1:5173/?agent=1&atlas=1`
Final baseline atlas run: `main/captures/procedural-atlas/2026-06-30T12-09-50-900Z-batch8-grass-tree-reality-final-clean/`

- Cases: `36`
- Screenshots: `216`
- Archetypes: verdant, arid, frozen, volcanic, oceanic, crystal, metallic, fungal, anomaly.
- Profiles: `HIGH`, `MEDIUM`
- Stage: `alive`
- Console errors: `0`
- Machine defects: `0`
- Max p95: `17.5ms`
- Max single-view p95: `17.8ms`
- Max draw calls: `148`
- Max program count: `43`
- Highest MEDIUM triangle case: `004-verdant--2_-1-alive-MEDIUM`, `1,496,178` triangles under the `1,500,000` budget.

Key screenshot paths:

- `verdant/-1_-1/alive/HIGH/overhead.png`
- `verdant/-2_-1/alive/MEDIUM/overhead.png`
- `fungal/1_1/alive/HIGH/tree.png`
- `fungal/1_-2/alive/MEDIUM/underCanopy.png`
- `anomaly/-2_0/alive/MEDIUM/material.png`

Machine review:

- Blank frame: `pass`
- Console errors: `pass`
- Machine defects: `pass`
- Shared grass/tree shader programs remain bounded: `pass`
- MEDIUM dense organic cases remain under triangle budget after profile trim: `pass`

Human/adversarial visual review remains required for taste and story-stage emotional clarity.

## Batch 9 Flora Color Harmony Follow-Up

Canonical preview URL: `http://127.0.0.1:5173/?agent=1&atlas=1`
Showcase atlas run: `main/captures/procedural-atlas/2026-06-30T21-21-10-994Z-batch9-flora-color-harmony-final/`

- Cases: `9`
- Screenshots: `36`
- Archetypes: verdant, arid, frozen, volcanic, oceanic, crystal, metallic, fungal, anomaly.
- Profile: `HIGH`
- Stage: `alive`
- Console errors: `0`
- Machine defects: `0`
- Min FPS: `60`
- Worst p95: `17.3ms`
- Total flora instances across showcase cases: `4,651`

Key screenshot paths:

- `verdant/-1_-1/alive/HIGH/material.png`
- `verdant/-1_-1/alive/HIGH/tree.png`
- `arid/1_0/alive/HIGH/material.png`
- `fungal/1_1/alive/HIGH/material.png`
- `crystal/-2_1/alive/HIGH/material.png`

Machine review:

- Blank frame: `pass`
- Console errors: `pass`
- Machine defects: `pass`
- Flora palette derives from planet roles instead of tree canopy roles: `pass`
- Flora/tree hue separation covered by unit regression: `pass`

Human taste review remains useful for deciding whether the stronger accent-world flora should be toned down further or kept as the bolder planet identity.

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

## Batch 11 Voxel Surface Sweep

Evidence:

- Material showcase: `main/captures/procedural-atlas/2026-07-13T00-32-00-573Z-voxel-surface-sweep-accepted/`
- Cross-quality perf views: `main/captures/procedural-atlas/2026-07-13T00-34-10-599Z-voxel-surface-perf-final/`
- Five-stage reality strips: `main/captures/procedural-atlas/2026-07-13T00-46-03-130Z-voxel-surface-reality-accepted/`

Visual review:

- Arid sand shows continuous wind-oriented dunes and dusty micrograin with no square carrier edges or per-voxel brightness checker.
- Volcanic lava reads as broad dark cooling crust, connected orange channels, sparse hot cores, and rising embers rather than a generic glint layer.
- Stone, dirt, wood, grass, basalt, ice, crystal, copper, gold, and silver retain distinct macro/micro/PBR identities in the all-material board.
- HIGH carries relief and full phenomena; MEDIUM retains material identity with a one-sample fallback; POTATO intentionally avoids expensive spawned layers.
- `bare -> color -> material -> alive -> paradox` is visually monotonic. Bare/color remain flat and do not pulse or allocate ecology/effects.

Adversarial result: `pass`. The first lava revision was rejected as uniformly white-hot; the accepted revision increased cooled negative space and narrowed emission to connected thermal channels. No visual blocker remains.

Machine result: `74` cases, `231` screenshots, `0` console errors, `0` defects. Max accepted case p95 across the three suites is `17.3ms`; max single-view p95 is `18.6ms`.
