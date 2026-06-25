# Run Summary

Iteration: 4

Changed:

- Replaced the broad angular surface classifier with a dominant-axis tie classifier.
- Kept near-edge non-edge cells aligned to their dominant cube face.
- Preserved exact edge/corner treatment only for actual cube-edge/corner cells.
- Removed render-time surface dedupe from `WaterBlocks.tsx`.
- Added `surfaceEdgeTrimForWaterFace` in `waterFacePlacement.ts`.
- Added exact-edge rounded cap geometry for actual adjacent surface-face pairs.
- Fixed the cap geometry winding so the rounded cap is visible with the water material's `FrontSide` culling.
- Updated focused tests to assert near-edge non-edge behavior, trim offsets, trim scale, and face-aligned normals.
- Captured desktop/mobile screenshots for the `-48,59` visible-seams vantage, the edge-band regression vantage, and the earlier cross-over vantage.

Checks:

- `npm run test -- waterFacePlacement waterVoxels`: passed, 30 tests.
- `npm run typecheck`: passed.
- `npm run build`: passed with the existing large bundle warning.
- Playwright render check: passed at desktop and mobile for the seam vantage; desktop cross-check captures also passed for the older two vantages.

Harness note:

- The local `main/tools/shadegent.mjs` harness is shader-only and Windows-path bound. The applicable harness for this geometry defect is the `?agent=1` Playwright game capture path.
- True rounded exact-edge water is now handled with dedicated edge-cap geometry, not by rotating or broadening existing planes.

Server:

- Reused the existing Vite dev server at `http://127.0.0.1:5173/`.
