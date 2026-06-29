# Site-Wide Plan: Procedural World Cohesion

## Decision

- Mode: `refactor-existing`.
- System goal: create a deterministic procedural art-direction system where every planet is visually cohesive, diverse, performant, biome-logical, and emotionally striking.
- Audience: the player exploring Paravoxia across many generated cube worlds.
- Quality threshold: final atlas score `>= 4.85 / 5`.
- Category floor: `4.45 / 5`.
- Human checkpoint policy: required before final palette family lock and before final visual approval.

## Design Thesis

Each planet should feel like a generated but authored showcase: a coherent palette, atmosphere, material family, ecology, scale hierarchy, and movement language that all express one planet identity. The system should not pick colors independently. It should compose a world like a strong interior designer or art director: dominant base, supporting families, controlled accents, material contrast, silhouette rhythm, negative space, and focal moments.

## Core Architecture

### 1. Planet Art Direction Contract

Add a pure deterministic module, likely:

`main/src/utils/planetArtDirection.ts`

It should expose:

- `buildPlanetArtDirection(seed): PlanetArtDirection`
- palette family: `analogous`, `splitComplement`, `triadicMuted`, `earthAndJewel`, `monochromeAccent`, `polarWarmCool`, `alienIridescent`, etc.
- palette roles:
  - `skyLow`
  - `skyHigh`
  - `sunGlow`
  - `terrainPrimary`
  - `terrainSecondary`
  - `soilDark`
  - `sandLight`
  - `vegetationBase`
  - `vegetationTip`
  - `canopyBase`
  - `canopyAccent`
  - `flowerAccent`
  - `waterDeep`
  - `waterShallow`
  - `rockBase`
  - `mineralAccent`
  - `hazardAccent`
  - `faunaCoat`
  - `faunaAccent`
  - `fogTint`
  - `postGradeTint`
- numeric style knobs:
  - `valueContrast`
  - `saturationBudget`
  - `accentBudget`
  - `organicDensity`
  - `surfaceDetailScale`
  - `shapeRoundness`
  - `shapeSpikiness`
  - `windDrama`
  - `ecologyRichness`
  - `scaleBias`
  - `negativeSpace`
- ecology masks:
  - allowed materials per flora/fauna/effect kind
  - archetype rarity multipliers
  - water/shore/grass/dirt/sand/stone/ice/basalt/crystal eligibility
- performance budgets:
  - expected max instance counts per quality tier
  - shader feature caps per quality tier

### 2. Palette Math

Use deterministic palette families, not ad hoc hue offsets:

- Analogous: safe verdant/oceanic cohesion.
- Split complement: current grass/canopy direction, extended to water/sky/accent.
- Triadic muted: high-energy alien worlds without clash.
- Earth + jewel accent: arid/metallic/fungal worlds with one vivid focus.
- Warm/cool polar: frozen/volcanic contrast.
- Monochrome + accent: early reality stages and metallic moons.
- Iridescent anomaly: paradox worlds only, carefully budgeted.

Every palette must produce:

- sufficient value contrast,
- limited accent area,
- readable terrain/water separation,
- no accidental all-one-hue planets,
- no oversaturated full-frame wash,
- no low-contrast grass/tree/water soup.

### 3. Ecology Model

Add a shared ecology definition that consumers query:

- flora kinds per archetype/material,
- fauna kinds per archetype/material,
- surface effects per material/reality stage,
- tree silhouette/frequency constraints by archetype,
- grass density/height constraints by climate/material,
- rock/stone placement constraints,
- water/coast constraints,
- hazard material constraints.

This prevents local modules from inventing conflicting rules.

### 4. Shape And Style Language

Define procedural shape tokens:

- voxel surfaces: chunky planar base with controlled relief.
- grass: hair-density layer, wind-coherent.
- trees: fuller stylized silhouettes with branch-aligned foliage.
- flora: small SDF-like ornamental growths, not noisy confetti.
- fauna: low-poly/soft stylized bodies with readable scale hierarchy.
- rocks: faceted, grounded, material-matching.
- surface effects: thin, semi-transparent, wind-aligned phenomena.
- water: smooth counterpoint to cubes with controlled shimmer.
- sky/post: cinematic framing, not separate color filter.

### 5. Atlas Harness

Build a long-running harness that captures:

- all archetypes,
- selected seed exemplars,
- day phases,
- reality stages,
- quality profiles,
- vantages,
- standalone subsystem harnesses,
- metrics JSON,
- profile/art-direction JSON,
- screenshots,
- adversarial defect report.

### 6. Iterative Refinement Loop

After harness exists:

1. Capture baseline atlas.
2. Score with visual rubric.
3. Patch the highest-leverage foundation defect.
4. Capture same matrix.
5. Compare screenshots and metrics.
6. Classify late defects.
7. Repeat until final gate passes.

## Foundation Plan

| Foundation area | Change | Why it matters | Risk | Acceptance criteria |
| --- | --- | --- | --- | --- |
| Art direction | Add `PlanetArtDirection` module | Central source for colors/style/ecology | Medium | Unit tests cover determinism, hue ranges, contrast, diversity. |
| Palette tests | Add harmony/diversity tests over seed matrix | Prevents tasteful sameness and ugly randomness | Medium | Tests fail on low contrast, hue collapse, accent overload. |
| Harness | Add procedural atlas runner | Evidence across planets | Medium | Captures screenshots + metrics + JSON reports. |
| Capture tooling | Linux-first browser resolution | Local reliability | Low | Works with `/snap/bin/chromium` or env override. |
| Consumer migration | Refactor sky/water/post/terrain first | Biggest coherence gain | Medium | Same seed palette roles visible in summaries. |
| Ecology registry | Shared spawn/material rules | Prevents out-of-place spawning | Medium | Tests assert material/archetype validity. |
| Perf budgets | Add thresholds per profile | Protects old laptops | Medium | Atlas report flags p95/draw/triangle/instance regressions. |
| Visual review | Add adversarial rubric | Avoids “technically passes but ugly” | Low | Every atlas batch has defect table and score. |

## Risk Plan

| Risk | Trigger | Response |
| --- | --- | --- |
| Cohesion reduces diversity | Seed matrix shows same-looking worlds | Increase palette family selection and diversity constraints. |
| Diversity becomes chaotic | Screenshots clash or lose value hierarchy | Tighten palette role budgets and accent ratios. |
| Performance collapses | HIGH p95 > 24ms or MEDIUM p95 > 28ms on harness | Reduce density/distance, shader branches, or post cost. |
| Ecology feels wrong | Spawn validity or visual review flags mismatch | Adjust shared ecology registry before local tuning. |
| System gets too abstract | Consumers become hard to trace | Keep pure typed profiles and explicit role names. |
| Screenshots pass but user sees no changes | Preview mismatch | Inspect server ownership, route, HMR, DOM/harness summary. |

## Gate

- Plan is system-wide, not one subsystem polish: `pass`
- Mode explicit: `pass`
- Foundation and local work separated: `pass`
- Sequencing justified: `pass`
- Harness-first execution ready: `pass`
