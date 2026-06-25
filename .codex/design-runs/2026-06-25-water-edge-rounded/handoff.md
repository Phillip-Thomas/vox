# Handoff

Component mapping: `main/src/components/WaterBlocks.tsx` remains the instanced renderer and owns the per-face loop. `main/src/utils/waterFacePlacement.ts` owns classification, face-aligned surface basis construction, cube-edge tangent trimming, wall/floor placement, and matrix composition. `main/src/utils/waterFacePlacement.test.ts` owns focused regression coverage for cube-edge and corner water behavior.

Token mapping: no UI theme tokens changed. The relevant visual constants are `WATER_FACE_OFFSET`, `WATER_QUAD_SIZE`, `FACE_NORMALS`, `SURFACE_EDGE_TRIM_SCALE`, and `SURFACE_EDGE_TRIM_CENTER`. The fix must reuse the existing water material and plane geometry.

State matrix: success state includes both captured vantages. The new reported night-side view at dayphase `0.6444` must not show the repeated diagonal water slash regression. The earlier cross-over view at dayphase `0.2458` must not show the old X-shaped overlap. Dynamic/flooded water uses the same placement helper path and remains covered by the existing `waterVoxels` invariant tests. Loading, empty, and error states are scoped out because no UI state flow changed.

Responsive notes: desktop and mobile screenshots are captured for both vantages from the same canonical preview URL. The fix is geometric and should not depend on viewport framing.

Acceptance criteria: adjacent cube-edge water sheets stay face-aligned, each sheet trims at the shared edge instead of crossing through the neighbor, shoreline wall/floor cases remain unchanged, tests pass, typecheck passes, build passes, and screenshot evidence shows the water is purposeful, brand-consistent, and no longer visibly worse from the reported view.

Language audit: no visible UI copy changed.
