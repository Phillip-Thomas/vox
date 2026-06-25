# Design Directions

## Direction A: Face-Aligned Edge Trim

Design thesis: preserve the existing cube-face water language and only remove the geometric overlap. Adjacent outward water sheets at a cube edge should both remain face-aligned, but each sheet is shortened along the tangent that points toward the neighboring outward face. That makes the two sheets meet at the shared water edge instead of crossing through each other.

Layout strategy: keep `WaterBlocks.tsx` as the single instanced renderer and keep all placement logic in `waterFacePlacement.ts`. Do not add a new mesh class or camera-dependent decision.

Asset strategy: no new visual assets or materials. Reuse the existing water shader, water profile, and plane geometry.

State strategy: success is the reported `-91,-4` night-side vantage without the diagonal slash regression, plus the earlier cross-over vantage without the original X. Loading, empty, and error states are scoped out because this is a live game-geometry defect.

## Direction B: Dedupe To One Surface Sheet

Design thesis: prevent crossing by rendering only one canonical outward face at each cube edge/corner.

Why rejected: this was close to the previous implementation and caused the water to read worse from other angles because the retained diagonal/rounded sheet became a large visible slash. Even face-aligned one-sheet dedupe would drop legitimate adjacent water surface area and create missing-side artifacts.

## Direction C: Dedicated Curved Edge Meshes

Design thesis: create separate rounded strips or curved corner patches for cube-face boundaries.

Why rejected for this pass: it could produce the smoothest silhouette, but it is a larger renderer architecture change with more capacity, shader, dynamic flood, and performance risk than the reported regression needs.
