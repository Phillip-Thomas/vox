# Priority Matrix

## Scoring Key

Scores use `1-5`. Higher means more important, more leverage, or more risk/readiness.

| Rank | Workstream | Importance | Quality gap | Reuse leverage | Risk | Readiness | Recommended action | Rationale |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 1 | Procedural atlas harness | 5 | 5 | 5 | 4 | 4 | Build first | Without cross-seed evidence, visual iteration will drift and regress. |
| 2 | `PlanetArtDirection` contract | 5 | 5 | 5 | 4 | 4 | Build with tests | All palette/ecology/shape consumers need one source. |
| 3 | Palette harmony math and tests | 5 | 4 | 5 | 4 | 4 | Implement after contract | Controls beauty without killing diversity. |
| 4 | Ecology and spawn validity model | 5 | 4 | 4 | 4 | 4 | Implement after contract | Prevents misplaced biome actors and effects. |
| 5 | Performance budget harness | 5 | 4 | 5 | 4 | 3 | Implement with atlas | Must protect older laptops during visual upgrades. |
| 6 | Sky/water/post refactor | 4 | 4 | 4 | 3 | 4 | Refactor early | Big perceived cohesion gain. |
| 7 | Voxel/material phenomenon registry | 4 | 4 | 4 | 4 | 3 | Refactor after palette | Extends rich effects across all materials. |
| 8 | Flora/fauna/tree/grass consumer refactors | 4 | 3 | 4 | 3 | 4 | Batch by biome | Existing systems are usable but need contract alignment. |
| 9 | Shape and scale audit | 4 | 3 | 3 | 3 | 3 | Run after atlas baseline | Requires screenshots and profile stats. |
| 10 | Adversarial visual review loop | 5 | 4 | 4 | 2 | 3 | Run after first atlas | Converts screenshots into targeted patches. |

## Recommended Batches

| Batch | Workstreams | Goal | Stop condition |
| --- | --- | --- | --- |
| 0 | Checklist, artifacts, baseline atlas spec | Prevent drift before code | Plan and checklist pass review. |
| 1 | Harness foundation + Linux capture | Get repeatable evidence | Atlas captures selected seed matrix and emits metrics JSON. |
| 2 | Art direction contract + palette tests | Make cohesion mathematically inspectable | Unit tests pass and data report exposes palette roles. |
| 3 | Consumer refactor: sky/water/post/terrain | Biggest whole-frame cohesion gain | Atlas shows coherent frame-level palette. |
| 4 | Consumer refactor: grass/tree/flora/fauna/effects | Ecology/shape cohesion | Spawn validity and scale tests pass across seed matrix. |
| 5 | Performance and shader scrutiny | Keep visuals scalable | HIGH and MEDIUM thresholds pass. |
| 6 | Deep iterative visual refinement | Raise from good to exceptional | Final score >= 4.85 and no high/critical defects. |

## Gate

- Priority order tied to goal: `pass`
- Risk and readiness explicit: `pass`
- First batch can start without re-planning: `pass`
