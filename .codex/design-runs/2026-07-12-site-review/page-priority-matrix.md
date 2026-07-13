# Page Priority Matrix

## Matrix

| Rank | Surface/workstream | Importance | Gap | Reuse | Risk | Readiness | Recommended action |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Award slice: story front door + arrival finale | 5 | 5 | 5 | 2 | 5 | Make Story primary and turn the current terminal into a deliberate ending |
| 2 | Reactive/device-adaptive graphics settings | 5 | 5 | 5 | 3 | 5 | Fix current settings contract before more rendering work |
| 3 | Demand-loaded/streamed audio | 5 | 5 | 4 | 2 | 5 | Prevent needless ~183 MiB decoded footprint |
| 4 | Canonical controls + accessibility | 5 | 4 | 5 | 2 | 5 | Registry, pause/landing panel, focus, zoom, reduced motion, touch sprint |
| 5 | Primitive survival/progression closure | 5 | 5 | 5 | 3 | 4 | Shelter/exposure/fire/failure/repair and honest recipe gating |
| 6 | Initial world worker + boot/chunk split | 5 | 4 | 5 | 3 | 4 | Remove Long Tasks and shrink critical JS |
| 7 | Spatial chunk/culling + truthful high-fidelity tiers | 4 | 4 | 5 | 4 | 4 | Recover GPU budget, then add local shadows/caustics |
| 8 | Golden browser journeys/CI | 5 | 4 | 5 | 3 | 4 | Story, sandbox, co-op, mobile, a11y and performance gates |
| 9 | Xenology/discovery journal | 4 | 4 | 4 | 3 | 4 | Turn procedural ecology into memory and meaning |
| 10 | Co-op product layer | 3 | 4 | 3 | 3 | 3 | Pings, shared survey, joint goal, in-game room recovery |
| 11 | WebGPU/TSL modernization spike | 3 | 3 | 4 | 5 | 2 | Isolated branch only after renderer budget/award slice stabilize |

## Recommended Batches

| Batch | Work | Goal | Stop condition |
| --- | --- | --- | --- |
| 1: Truth & entry | Story-first landing, intentional finale, controls/a11y, reactive profiles, audio loading | Stop losing players before the unique experience appears | Story is obvious; settings make measurable changes; no basic a11y blockers |
| 2: Consequence & boot | Primitive loop, worker boot, JS split, golden browser journeys | One coherent 30-60 minute experience | Fresh story and sandbox loop pass browser/perf budgets |
| 3: Fidelity with budget | Chunk/cull, shader consolidation/precompile, local shadows, underwater palette/caustics/audio | Spend recovered headroom on visible authored quality | Stable mobile/desktop frame-time and human-approved captures |
| 4: Signature expansion | Xenology and one co-op objective | Procedural worlds become memorable and social | Discovery persists and co-op has one distinctive shared payoff |

## Gate

- Priority tied to award-slice goal: `pass`
- Risk/readiness explicit: `pass`
- First batch can start without replanning: `pass`
