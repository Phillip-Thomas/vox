# Implementation Plan

1. Replace the broad angular surface classification with a dominant-axis rule.
2. Keep near-edge non-edge cells aligned to their dominant cube face.
3. Remove the render-time dedupe path from `WaterBlocks.tsx` so actual adjacent edge faces can both render.
4. Replace the diagonal blended-normal placement in `waterFacePlacement.ts` with a face-aligned surface basis.
5. Add `surfaceEdgeTrimForWaterFace` so only true edge/corner cells detect sibling outward faces and shorten the tangent span that would otherwise cross the shared cube edge.
6. Keep shoreline wall and inward floor placement unchanged.
7. Update `waterFacePlacement.test.ts` to assert near-edge non-edge behavior, edge trim offsets, trim scales, and face-aligned normals.
8. Verify the reported regression vantage, the previous cross-over vantage, focused water tests, typecheck, and production build.
