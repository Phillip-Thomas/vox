Run mode: single-surface
Surface: dev-only voxel material shader harness
Execution budget: fast
Preview URL used: http://127.0.0.1:5174/voxel-test.html?focus=dirt&profile=HIGH&seed=12345
Browser path: Browser plugin unavailable; used Playwright with CDP screenshots.

Implemented:
- Added `main/voxel-test.html`, matching the existing `tree-test.html` / `rock-test.html` dev-harness pattern.
- Added `main/src/voxelTest.tsx`, an isolated Vite entry that renders the shared in-game voxel material with real `aInstanceData` material IDs and instance colors.
- Added stage columns for `bare`, `color`, `material`, `alive`, and `paradox` so shader progression can be compared side-by-side.
- Added query modes:
  - default: all render materials
  - `?focus=dirt`: dirt plus grass/sand/stone comparison
  - `?only=dirt`: close dirt-only stage strip
  - `?seed=`: deterministic terrain tint/wind seed
  - `?profile=`: quality profile gate
- Exposed `window.__voxelTest.summary()` for headless QA.
- Tuned dirt shader readability:
  - stronger clod/pebble/dry-wisp contrast
  - warmer living burrow/thread marks gated by organic reality effects
  - lower dirt-specific bump intensity so later stages do not crush to black
- Fixed the stage chroma gate by moving it after Three's `color_fragment`, so `bare` is actually monochrome after instance colors are applied.

Validation:
- `npm run typecheck`
- `npm run test` — 509 tests passed
- `npm run build`
- Render smoke:
  - `focus-dirt.png`
  - `only-dirt.png`
- Browser console had no shader/program/app errors. ReadPixels warnings came from CDP screenshot capture.

Remaining risk:
- The harness validates voxel material shading, not gameplay placement density or biome frequency.
- Dirt still uses shader-level “living soil” marks, not actual instanced worm meshes. Real worms should be a separate micro-life layer if we decide it is worth the draw calls.
