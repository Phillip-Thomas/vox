# Implementation Plan

1. Add dirt effect helpers to `surfaceEffects.ts`.
2. Refactor `SurfaceEffectField` so sand and dirt are sibling effect layers with shared rebuild logic.
3. Extend `voxelTest.tsx` from sand-only to `?effects=sand|dirt`.
4. Add unit tests for dirt coverage, eligibility, geometry, and instance building.
5. Run typecheck/tests/build.
6. Capture desktop and mobile screenshots for `?effects=dirt&profile=HIGH&seed=12345`.
7. Critique visibility and tune density/contrast if needed.
