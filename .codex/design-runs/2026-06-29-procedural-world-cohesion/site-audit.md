# Procedural World Audit

## Summary

- Repo: `/home/thomasphillip/Projects/vox`
- System goal: make every procedural planet feel like a cohesive, intentional, visually striking authored world while preserving deterministic diversity and performance scalability.
- Recommended execution mode: `refactor-existing`.
- Recommended first implementation target: foundation module plus atlas harness, before visual tuning.

## Baseline Scores

| Category | Score | Evidence |
| --- | ---: | --- |
| Product truth | 4.6 | Reality-stage rendering already supports Paravoxia's progression concept. |
| Color cohesion | 3.7 | Biome split hues exist, but sky/water/post/terrain/ecology are not governed by one harmony contract. |
| Palette diversity | 4.0 | Alien and green families exist, but future cohesion could collapse variety unless guarded. |
| Shape language | 3.6 | Individual systems improved; cross-system silhouette and material language is not formalized. |
| Ecology logic | 3.8 | Flora/fauna have material rules, but biome/archetype ecology is not globally testable. |
| Scale hierarchy | 3.7 | Recent trees/fauna improved, but no global scale/placement audit exists. |
| Performance scalability | 4.1 | Quality flags are strong; long-run perf budgets and shader complexity gates are missing. |
| Harness coverage | 3.5 | Good local harnesses; no all-system atlas across seeds/archetypes/stages/qualities. |
| Maintainability | 3.8 | Profiles are clean but parallel; one art-direction contract would reduce drift. |

Baseline weighted score: `3.86 / 5`.

## Site-Level Defects

| Severity | Defect | Evidence | Likely cause | Response |
| --- | --- | --- | --- | --- |
| High | No single planet art-direction contract | `BiomeProfile`, `WaterProfile`, sky palette, post grade, flora/fauna/tree colors each derive locally | Organic growth of systems | Add `PlanetArtDirection` and refactor consumers. |
| High | No long-running all-system atlas harness | Existing harnesses are `voxel-test`, `tree-test`, `rock-test`, and ad-hoc captures | Harnesses were built per feature | Build `procedural-atlas` runner with seed matrix and metrics. |
| High | Cohesion is not objectively testable | No tests for harmony, value contrast, palette ratios, ecology validity, scale ranges | Current tests focus determinism/eligibility | Add profile and rendered-data tests. |
| Medium | Sky palette partly bypasses biome palette | `SpaceSky.tsx` uses `ARCHETYPE_SKY`, with anomaly override | Separate implementation lane | Drive sky from art direction with archetype constraints. |
| Medium | Surface effects registry is incomplete | Sand/dirt only; ice/lava/basalt/crystal/grass/wood not covered by spawned effects | Feature sequencing | Build material phenomenon registry. |
| Medium | Shape language is implicit | Grass/tree/flora/fauna/rocks/voxels use different geometry idioms | Separate feature iterations | Define stylization rules and shape tokens. |
| Medium | Performance thresholds are not encoded | `window.__game.metrics()` exists; no failing long-run thresholds | Manual review path | Add harness thresholds and CI-friendly report. |
| Medium | Existing capture runner is Windows-biased | `main/tools/capture.mjs` hardcodes Windows Chromium path | Prior local setup | Make browser path configurable and Linux-first. |

## Foundation Vs Local Work

| Issue | Foundation or local? | Affected systems | Why |
| --- | --- | --- | --- |
| Palette harmony | Foundation | all visual systems | Must be one contract. |
| Sky/post color drift | Foundation + local consumers | sky, post, water, terrain | Contract plus consumer refactor. |
| Flora/fauna biome fit | Foundation + local rules | flora, fauna, surface effects | Needs ecology model and local enforcement. |
| Shader perf budgets | Foundation | voxel, water, trees, grass, post | Needs common metrics and thresholds. |
| Tree species visual tuning | Local after foundation | trees | Already has strong local harness. |
| Surface effects per material | Local under registry | surface effects, voxel material | Extend registry once art contract exists. |

## Gate

- Audit based on real code: `pass`
- Site-level and local defects separated: `pass`
- Recommended execution mode justified: `pass`
