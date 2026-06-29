# Run Summary

Run mode: single-surface.
Surface: spawned voxel surface phenomena.
Execution budget: standard.
Canonical preview URL: http://127.0.0.1:5174/voxel-test.html?effects=sand&profile=HIGH&seed=12345
Server: existing Vite server on 127.0.0.1:5174; no new server started.
Browser path: Browser plugin unavailable; used Playwright screenshots with `/snap/bin/chromium`.

## Design Context

Goal: make material effects read as rendered world phenomena above voxels, not only shader edits on the voxel skin.
Primary action: inspect spawned sand dust in the dev-only voxel effect harness and confirm it follows the planet wind language.
Hard guardrails: keep the existing grass/tree wind model, gate cost by graphics quality, and keep the effect separate from `voxelMaterial`.
Selected direction: a shared instanced `SurfaceEffectField` that places low transparent geometry on eligible block faces, driven by the same deterministic planet wind profile used by grass and trees.

## Final Changes

- Added `main/src/components/SurfaceEffectField.tsx`, a material-driven spawned effect layer mounted in the main scene after grass and trees.
- Added `main/src/utils/surfaceEffects.ts`, starting with sand dust wisps placed over eligible sand voxels and animated as separate instanced geometry.
- Wired sand dust to `buildWindProfile(terrainSeed)` and passed wind direction, strength, gust scale, gust speed, turbulence, and offset into the dust shader.
- Added `voxelEffectDensity` and `voxelEffectMaxDistance` quality gates in `main/src/config/graphicsSettings.ts`, including a hard off path for `POTATO`.
- Extended `main/src/voxelTest.tsx` with `?effects=sand` to render an isolated sand patch plus spawned dust, and made the harness title responsive.
- Added `main/src/utils/surfaceEffects.test.ts` for density, voxel eligibility, deterministic instance building, and geometry attributes.

## Evidence

- Desktop screenshot: `sand-dust-harness-desktop.png`.
- Mobile screenshot: `sand-dust-harness-mobile.png`.
- PNG pixel proof:
  - desktop: 1280 x 820, nonblank 1,049,600 pixels, luminance span 210
  - mobile: 390 x 844, nonblank 329,160 pixels, luminance span 210
- Console review: no app, shader, or program errors. WebGL `ReadPixels` warnings came from screenshot capture.
- Verification: `npm run verify` passed: typecheck, 75 test files / 513 tests, and production build.
- Deploy: `npx -y firebase-tools@latest deploy --only hosting --project paravox-game` completed.
- Live check: `https://paravox-game.web.app` returned HTTP 200 and served build assets `index-DfcQWFvH.js` / `index-D6K7awqN.css`.

## Score

Weighted score: 4.76 / 5 for the sand-dust slice.
Gate status: passed for this surface slice.
Open scope: dirt worms, frost wind, lava boil, ash, and other material phenomena still need to be added as additional consumers of the same `SurfaceEffectField` pattern.

## Lessons

- Voxel shader detail and spawned surface phenomena should remain separate systems. The former changes the block skin; the latter makes the world feel alive.
- Shared wind must include both placement orientation and shader gust direction. CPU placement alone is not enough, because animated gust cells can visually clash with grass/tree motion.
- The dev harness needs both shader-stage views and spawned-effect views; they answer different rendering questions.
