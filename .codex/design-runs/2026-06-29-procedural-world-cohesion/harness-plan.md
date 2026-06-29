# Procedural Atlas Harness Plan

## Objective

Create a long-running harness that proves all procedural systems work together across many planets, rather than validating grass, trees, blocks, flora, fauna, water, sky, and post FX in isolation.

## Proposed Files

- `main/tools/procedural-atlas.mjs`
- `main/src/utils/proceduralAtlasSeeds.ts`
- `main/src/utils/proceduralAtlasReport.ts`
- `main/src/utils/proceduralAtlasReport.test.ts`
- optional route: `main/procedural-atlas.html` only if standalone comparison panels become useful.

## Browser Strategy

- Resolve Chromium in this order:
  1. `process.env.CHROME_PATH`
  2. `/snap/bin/chromium`
  3. `chromium`
  4. Playwright bundled path if available
- Support `--headless=true` for CI-ish runs and `--headed` for real local GPU visual runs.
- Warn when running headless SwiftShader so visual color/perf results are not over-trusted.

## Capture Matrix

### Archetypes

Capture at least two seeds per archetype:

- verdant
- arid
- frozen
- volcanic
- oceanic
- crystal
- metallic
- fungal
- anomaly

Seed selection should be deterministic and checked into a fixture after discovery.

### Vantages

Use `window.__game.view()`:

- `overhead`: planet-level color/material composition.
- `horizon`: sky/terrain/fog/post relationship.
- `coast`: water/shore/terrain relationship.
- `tree`: tree scale/shape/color.
- `underCanopy`: ground-level ecology/scale/wind.

Add later:

- `materialBand`: high-density view of grass/dirt/sand/stone adjacency.
- `hazard`: volcanic/frozen/crystal material showcase.
- `fauna`: close-up on moving fauna if available.
- `flora`: close-up on mid-story flora if available.
- `waterline`: under/over water boundary.

### Time

- day: `0.25`
- golden: `0.08` and/or `0.42`
- night: `0.75`

### Reality Stage

- `bare`
- `color`
- `material`
- `alive`
- `paradox`

### Quality Profile

- Required every run: `HIGH`, `MEDIUM`
- Performance stress: `ULTRA`
- Fallback smoke: `LOW`, `POTATO`

## Output

Run folder:

`main/captures/procedural-atlas/<timestamp>-<label>/`

Files:

- `manifest.json`
- `summary.json`
- `metrics.json`
- `profiles/<seed>.json`
- `screenshots/<archetype>/<seed>/<stage>/<quality>/<vantage>.png`
- `contact-sheet-*.png` if generated later
- `defects.md`

## Data To Collect

From `window.__game.metrics()`:

- fps
- p50 frame time
- p95 frame time
- draw calls
- triangles

From scene traversal:

- instanced mesh counts by material key/name
- instance counts by layer: voxels, grass, trees, flora, fauna, water, surface effects, stones
- geometry vertex counts
- shader custom program keys
- material count

From profile builders:

- `PlanetProfile`
- `BiomeProfile`
- `PlanetArtDirection` once implemented
- `GrassProfile`
- `TreeProfile`
- `WaterProfile`
- `WindProfile`
- `FloraProfile`
- `FaunaProfile`
- active `GraphicsQuality`
- active `VoxelRealityStage`

From screenshot pixel analysis:

- average luma
- luma contrast percentiles
- saturation mean/percentiles
- dominant hue histogram
- accent hue percentage
- visual blankness/empty-frame detection
- screenshot diff against prior baseline

## Performance Budgets

Initial thresholds, to tune after baseline:

| Profile | p50 target | p95 target | FPS target | Notes |
| --- | ---: | ---: | ---: | --- |
| ULTRA | <= 20ms | <= 28ms | >= 45 | Quality showcase, may be heavy. |
| HIGH | <= 18ms | <= 24ms | >= 50 | Default target. |
| MEDIUM | <= 20ms | <= 28ms | >= 45 | Older laptop target. |
| LOW | <= 18ms | <= 24ms | >= 50 | Should be stable and visually coherent. |
| POTATO | <= 16.8ms | <= 20ms | >= 55 | Minimal but not broken. |

Metrics must be sampled after scene settles, not before stream/build finishes.

## Visual Defect Flags

The harness should generate machine flags before human review:

- `low_contrast`: terrain/water/sky or grass/tree values too close.
- `accent_overload`: accent hue covers too much of screenshot.
- `monotone_collapse`: dominant hue family covers too much of scene without value contrast.
- `neon_wash`: saturation too high across most pixels.
- `muddy_gray`: saturation and contrast too low.
- `blank_frame`: no meaningful geometry.
- `empty_ecology`: expected grass/tree/flora/fauna count absent for archetype.
- `spawn_invalid`: ecology appears on invalid material/water.
- `scale_suspicious`: trees/fauna/flora outside expected ranges.
- `perf_regression`: p95/draw/tri thresholds exceeded.
- `shader_explosion`: material/program count unexpectedly high.

## Execution Modes

- `--mode=smoke`: 3 seeds, HIGH, alive, overhead/tree/coast.
- `--mode=baseline`: all archetypes, HIGH/MEDIUM, alive, all vantages.
- `--mode=reality`: selected seeds, all reality stages.
- `--mode=perf`: selected heavy seeds, ULTRA/HIGH/MEDIUM/LOW/POTATO.
- `--mode=full`: all archetypes, all vantages, all stages, HIGH/MEDIUM plus ULTRA perf subset.
- `--mode=overnight`: large seed sweep with no screenshots for every case, periodic screenshots for representatives.

## Acceptance Criteria

- The atlas can run from a single command.
- It reuses the existing dev server if healthy.
- It records canonical URL and server ownership.
- It emits deterministic manifest and metrics JSON.
- It captures desktop screenshots for every selected case.
- It can run a smaller smoke mode in under a few minutes.
- It can run an overnight mode without manual intervention.
- It fails or flags when console errors occur, render blanks, or metrics exceed thresholds.
