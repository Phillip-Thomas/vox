# Run Summary

Implemented a procedural fauna foundation for Paravoxia.

## Changes

- Added `main/src/utils/faunaField.ts`.
- Added `main/src/components/FaunaField.tsx`.
- Added fauna quality gates to `main/src/config/graphicsSettings.ts`.
- Mounted fauna in `main/src/components/EfficientScene.tsx`.
- Added `?effects=fauna` to `main/src/voxelTest.tsx`.
- Added `main/src/utils/faunaField.test.ts`.
- Added CPU-side fauna locomotion via retained `FaunaAgent` route state and `updateFaunaAgents`.

## Archetypes

- `grazer` — larger quadruped silhouette with neck, ears, legs, tail, and mane accents.
- `woolly` — compact fluffy herd animal.
- `runner` — smaller lean fast critter.
- `hopper` — compact arid/sparse-world critter.
- `dragonfly` — aerial insect with thin flapping wings and hover offset.

## Locomotion

- Agents now advance their instance matrices over time instead of only animating vertices in place.
- Ground fauna picks deterministic neighboring surface voxels and faces its travel direction.
- Travel is species/material constrained: grazers and woollies stay off sand, hoppers prefer arid/sandy routes, runners can cross sand on hot/arid worlds, and dragonflies hover over eligible land anchors.
- If a route would enter an invalid material or missing surface cell, the agent turns/reseeds rather than continuing into empty/water space.
- Follow-up jitter fix: shader animation now uses stable per-instance `aFaunaSeed` instead of hashing moving `instanceMatrix[3].xyz`, so gait/wing phases stay smooth while the instance translates.
- Follow-up level-change fix: instance orientation now slerps toward route heading instead of snapping, and routes that change voxel levels add a short outward clearance arc so fauna step over height changes instead of lerping through the block.
- Follow-up size pass: grazers/horses and woollies/sheep now use larger species-specific scale ranges, while runners, hoppers, and dragonflies keep their smaller silhouettes.

## Validation

- `npm run typecheck` passed.
- `npx vitest run src/utils/faunaField.test.ts` passed: 9 tests.
- Harness screenshots captured on desktop and mobile.
- Motion proof passed with 3,905 changed pixels between desktop frames.
- Locomotion proof passed with 24,965 changed pixels between desktop frames.
- Smooth-seed regression pass captured five 350ms-spaced frames with no relevant console errors; consecutive frame changed ratios stayed around 0.009-0.011.
- Slerp/level-change Playwright pass captured desktop and mobile frames with no app console errors; desktop-only WebGL `ReadPixels` warnings came from screenshot capture.
- Large-quadruped Playwright pass captured desktop and mobile frames with no app console errors; desktop-only WebGL `ReadPixels` warnings came from screenshot capture.
- `npm run verify` passed: 77 test files, 531 tests, production build.

## Preview

`http://127.0.0.1:5173/voxel-test.html?effects=fauna&profile=ULTRA&seed=54321`
