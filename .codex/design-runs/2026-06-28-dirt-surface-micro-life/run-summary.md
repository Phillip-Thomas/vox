# Run Summary

Run mode: single-surface.
Surface: spawned dirt voxel micro-life.
Execution budget: standard.
Canonical preview URL: `http://127.0.0.1:5174/voxel-test.html?effects=dirt&profile=HIGH&seed=12345`
Server: existing Vite server on 127.0.0.1:5174; no new server started.
Browser path: Browser plugin unavailable; used Playwright screenshots with `/snap/bin/chromium`.

## Final Changes

- Extended `main/src/utils/surfaceEffects.ts` with dirt eligibility, density/coverage, raised crumb/clod geometry, micro-crawler animation, wind uniforms, and deterministic instance building.
- Refactored `main/src/components/SurfaceEffectField.tsx` into spec-driven sibling layers for sand dust and dirt micro-life.
- Extended `main/src/voxelTest.tsx` with `?effects=dirt` for isolated dirt patch review.
- Expanded `main/src/utils/surfaceEffects.test.ts` from 4 to 9 tests covering dirt density, eligibility, geometry, and instance building.
- Corrected the failed first visual read by replacing flat scratch-like details with larger lifted soil clods and warmer direct-shaded loam variation.

## Evidence

- Desktop screenshot: `dirt-life-harness-desktop.png`.
- Desktop motion screenshot: `dirt-life-harness-desktop-t1.png`.
- Mobile screenshot: `dirt-life-harness-mobile.png`.
- Motion proof: two desktop captures 1.8s apart changed 34,315 of 1,024,000 pixels (3.35%) with max RGB delta 329.
- Verification: `npm run verify` passed: typecheck, 75 test files / 518 tests, and production build.
- Build asset: `dist/assets/index-CCojWwe9.js`.
- Deploy: `npx -y firebase-tools@latest deploy --only hosting --project paravox-game` completed.
- Live check: `https://paravox-game.web.app` returned HTTP 200 and served `index-CCojWwe9.js` / `index-D6K7awqN.css`.

## Iterations

1. First pass had correct architecture but looked like flat static lines rather than loose soil.
2. Second pass raised the geometry but PBR lighting made it read as dark blotches.
3. Final corrective pass kept the raised geometry, moved the dirt effect to a warm direct-shaded material, enlarged clods, and exposed subtle crawler motion.

## Score

Weighted score: 4.78 / 5.
Gate status: passed for this dirt slice.

## Remaining Scope

The shared `SurfaceEffectField` is now ready for frost wind, lava boil, ash, and similar material phenomena.
