# Design Context Contract

Surface: procedural tree scale and canopy presence across `tree-test.html` and in-world `TreeField`.
Run mode: single-surface.
Exploration depth: 3.
Execution budget: standard.
Approval threshold: 4.75 / 5.
Category floor: 4.3 / 5.
Canonical preview URL: `http://127.0.0.1:5173/tree-test.html?mode=silhouettes`.
Browser path: Browser plugin unavailable; used repo-local Playwright via `playwright-core`.

## Hard Guardrails

- Preserve deterministic per-planet tree profiles.
- Keep one generated archetype per planet and the existing instanced `TreeField` path.
- Do not introduce asset dependencies, texture loads, or per-tree draw call expansion.
- Keep trees harvestable through the existing instanced raycast mapping.
- Avoid giant-tree scale; the target is believable canopies, not fantasy redwoods.

## Creative Brief

- Tree tops should no longer sit around character height.
- The player should be able to look up into the canopy.
- Minimum trees should feel like young trees, not shrubs.
- Range should be wider and more natural while keeping planet silhouettes readable.

## Open Field

- Profile height curve and silhouette-specific minimums.
- Crown and trunk mass scaling with height.
- In-world per-instance scale floor and spread.
- Tree-test framing and summary instrumentation.
