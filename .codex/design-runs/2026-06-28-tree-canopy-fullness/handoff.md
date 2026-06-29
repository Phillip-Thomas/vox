# Design Handoff

## Component Mapping

- Tree geometry: `utils/treeGen.ts`.
- Tree species/profile: `utils/treeProfile.ts`.
- Tree shader/materials: `utils/treeMaterials.ts`.
- In-world placement: `components/TreeField.tsx`.
- Harness: `treeTest.tsx` via `tree-test.html`.

## Token Mapping

- Canopy colours remain profile uniforms.
- Density and leaf scale remain deterministic profile parameters.
- Wind comes from `WindProfile` and is copied into shader uniforms.

## State Matrix

- Silhouette row: all six named variants.
- Variety grid: mixed seeds/biomes.
- Single tree close-up: optional debugging route via `?only=...`.
- In-world: normal gameplay render.

## Responsive Notes

The main responsive concern is screenshot readability and game integration. No HUD/layout changes are part of this pass.

## Acceptance Criteria

- All six silhouettes have visibly fuller foliage.
- Wind uniforms are profile-driven and deterministic.
- Existing tree tests pass.
- Full repo verification passes.
- Screenshots exist for harness desktop, harness mobile, and in-world integration.
