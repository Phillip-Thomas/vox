# Run Summary

## Outcome

- Repo: `/home/thomasphillip/Projects/vox`
- Surface: complete Paravoxia browser game
- Date: `2026-07-12`
- Final decision: `owner-directed demo foundation plan ready; focused execution required`
- Baseline score: `3.78 / 5`
- Plan score: `4.82 / 5`
- Human approval: pending

## Quality Configuration

- Mode: `site-wide-review-plan`
- Exploration depth: `3`
- Budget: `flagship review`
- Final threshold: `4.75`
- Category floor: `4.3`
- Human taste checkpoint: required
- External references: current Three.js WebGPU/TSL, Web Interface Guidelines, and web performance guidance
- Model diversity: three independent read-only audits for rendering/performance, gameplay/product, and visual/art direction

## Preview And Server Ownership

- Canonical preview: `http://127.0.0.1:5201/`
- Four existing Vite servers were found for the checkout.
- The strict-port 5201 server was reused.
- No server was started or stopped.
- One transient HMR error occurred while the branch changed; clean build evidence superseded that poisoned capture.

## Reasoning Summary

- Initial read: the project has more real systems and verification depth than a typical browser-game prototype.
- Strongest product thesis: visual fidelity as the birth of consciousness.
- Strongest visual: cube planet against the cosmos.
- Strongest technical foundations: instancing, worker transfer protocol, procedural PBR/ecology, multiplayer authority, atlas/probe tooling, and a large deterministic test suite.
- Key critique: breadth has outrun finish; the unique story, sandbox progression, co-op product layer, and high-fidelity rendering promises stop at different boundaries.
- Final rationale: make one intentional slice excellent before adding more planets, MMO hardening, or renderer novelty.

## Evidence And Checks

- `npm --prefix main run verify`: typecheck; 140 test files / 1,060 tests; production build.
- Production bundle: one 4.67 MB minified JS file, about 1.57 MB gzip, plus a 96 KB worker.
- Server verification: typecheck; 6 test files / 58 tests; production build.
- Cold runtime audit: worldgen about 844.6 ms; >1 s Long Tasks.
- Live quality audit: HIGH -> POTATO left tested geometry/layer counts unchanged.
- Current audit capture: 40 draw calls and about 1.27M-1.48M estimated triangles across representative HIGH views.
- Prior dense atlas: about 3.83M HIGH and 8.51M ULTRA estimated triangles; shader-explosion exception remains recorded.

## Gate Results

| Gate | Result | Notes |
| --- | --- | --- |
| Product intent | pass | unusually clear and distinctive |
| Repo survey | pass | surfaces, systems, assets, tests, checkpoints inspected |
| Screenshot matrix | partial | representative desktop/mobile/story/world; missing real-device/error/stress matrix |
| Adversarial critique | pass | independent product/render/visual audits agree on priorities |
| Baseline score | fail | 3.78 vs 4.75 final target |
| Plan quality | pass | 4.82 |
| Implementation | partial | exact landing tagline landed; broader lift remains planned |
| Lessons saved | pass | local run folder only |

## Defect Trend

| Stage | Critical | High | Medium | Low |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 1 | 8 | 10 | several |
| After owner direction | 1 | 8 | 9 | generic landing subtitle resolved; remaining demo lift is staged |

## Next Action

Batch 1 passed in `.codex/design-runs/2026-07-12-demo-shell/`: Story-safe pause,
travel exclusion, mode-aware control help, focus/zoom behavior, and completed-save
replay semantics are implemented with bindings unchanged and audio untouched.

Batch 2 implementation is recorded in
`.codex/design-runs/2026-07-12-primitive-foundation/`: the six-recipe primitive
loop, shelter/fire warmth, retained-inventory recovery, spawn truth, persistence,
and co-op authority parity pass deterministic gates. Browser/headed approval remains
open because headless Chromium reaches Play readiness but stalls at the trusted
pointer-lock gesture; do not begin Batch 3 screening until the headed journey and
the separate fauna triangle budget pass.

Owner follow-up evidence: the live landing DOM and 1440x900 menu capture confirm
`MAKE NO MISTAKES`; TypeScript validation passed after the production copy change.
