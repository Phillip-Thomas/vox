# Design Context Contract

Surface: procedural tree canopy and leaf motion across `tree-test.html` and in-world trees.
Run mode: single-surface.
Exploration depth: 3.
Execution budget: standard.
Approval threshold: 4.75 / 5.
Category floor: 4.3 / 5.
Canonical preview URL: `http://127.0.0.1:5173/tree-test.html` for the harness, with `http://127.0.0.1:5173/?agent=1&world=0,0&dayphase=0.4734` as in-world sanity.

## Hard Guardrails

- Keep the current procedural, deterministic, instanced tree architecture.
- Improve all tree silhouettes, not one hand-picked seed.
- Preserve the existing `TreeField` instanced rendering path and harvest hit mapping.
- Do not add texture assets or per-tree draw-call explosions.
- Keep material colours planet/profile driven.
- Tree wind must respect the shared per-planet wind profile introduced for grass.

## Creative Brief

- Trees should read much fuller and more credible at a glance.
- Leaves should feel dense, layered, and wind-reactive, closer to natural canopy texture than a few large cartoon cards.
- Silhouettes should stay recognizable: round, conical, umbrella, weeping, wispy, and frond.
- Motion should feel like gusts crossing patches, not a uniform metronome.

## Open Field

- Leaf budget, card distribution, frond count, and canopy layering.
- Per-silhouette density multipliers.
- Shader wind amplitude, gust veer, flutter, and profile wiring.
- Harness screenshot angles and evidence.
