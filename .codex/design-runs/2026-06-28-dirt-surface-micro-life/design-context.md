# Design Context

Run mode: single-surface.
Surface: spawned dirt voxel surface effects.
Exploration depth: 3.
Execution budget: standard.
Approval threshold: 4.75 / 5.
Category floor: 4.3 / 5.

## Hard Guardrails

- Dirt effects must be spawned/rendered surface phenomena, not only edits to `voxelMaterial`.
- Keep the effect subtle at normal gameplay distance and legible only on close inspection.
- Use the same deterministic planet wind model as grass, trees, and sand dust where motion could otherwise clash.
- Gate density and distance through the existing graphics quality settings.
- Keep `POTATO` effectively off through `voxelEffectDensity = 0`.
- Provide a dev harness route for inspection before approval.

## Creative Brief

The dirt should feel like loose soil sitting on top of a voxel face: crumbly, uneven, organic, and slightly alive. Tiny crawling shapes should exist, but not present as obvious creatures from ordinary camera distance.

## Open Field

- Shape language for soil flecks and tiny crawlers.
- Exact density, opacity, scale, and animation amplitude.
- Harness framing and screenshot distance.

## Stop Conditions

- Typecheck, tests, and build pass.
- Desktop and mobile screenshots render nonblank with no app/shader errors.
- The dirt read is subtle and close-inspection-only, not a distracting bug swarm.
