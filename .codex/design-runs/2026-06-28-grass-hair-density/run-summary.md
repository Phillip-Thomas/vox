# Run Summary

Run mode: single-surface.
Surface: procedural grass density / blade silhouette.
Execution budget: standard.
Canonical preview URL: http://127.0.0.1:5173/?agent=1&world=0,0&dayphase=0.4734
Server: existing Vite server on 127.0.0.1:5173; no new server started.

## Iterations

1. First pass narrowed blades from `0.18` to `0.075`, increased strands per density unit from 3 to 6, and replaced fan tufts with micro-cluster placement. Focused tests passed, but screenshots still looked too sparse/tall.
2. Second pass narrowed/shortened further to `0.068` x `0.62`, raised strands per density unit to 12, capped profile width, and tuned density multiplier to balance visual density against instance growth.

## Final Changes

- `main/src/utils/grassField.ts`: thinner/shorter blade geometry, denser strand budget, micro-cluster root placement, reduced lean/wind amplitude, shader cache key bump.
- `main/src/utils/grassProfile.ts`: narrower width multiplier and balanced density multiplier for the finer strand unit.
- `main/src/utils/grassField.test.ts`: added hairlike width and density invariants.
- `main/src/utils/grassProfile.test.ts`: added profile width cap invariant.
- `capture-grass.mjs`: rendered validation helper for this run.

## Evidence

- Screenshots: `screenshots/desktop-wide-grass.png`, `screenshots/desktop-close-hair-grass.png`, `screenshots/mobile-close-hair-grass.png`.
- Render proof: `grass-pbr-v4`, 8,344 live grass instances on the validation world, no framework overlay, no relevant console issues.

## Remaining Limitations

- The old stored `-1,-70` grass-grid seed did not surface a grass mesh inside the headless timeout, so final screenshots used `world=0,0`.
- Headless metrics reported zero FPS/draw calls in this capture path; instance-count proof and visual screenshots were used instead.
- The surface is still strand geometry, not true fur shading.

