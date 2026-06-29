# Handoff

## Component Mapping

- `SurfaceEffectField`: render both sand and dirt effect layers.
- `surfaceEffects`: add dirt eligibility, count/build functions, geometry/material, wind/uniform update functions.
- `voxelTest`: add `?effects=dirt` harness using a dirt patch.

## Token / System Mapping

- Use existing `voxelEffectDensity` and `voxelEffectMaxDistance`.
- Use existing `buildWindProfile(terrainSeed)`.
- Use existing `voxelSystem` resource opt-out flag: `supportsSurfaceResources: false`.

## State Matrix

- HIGH/ULTRA: visible but subtle dirt flecks and crawling micro-ribbons.
- MEDIUM/LOW: reduced density and distance.
- POTATO: no spawned dirt effects.
- Unsupported material: no dirt effect.

## Acceptance Criteria

- Dirt effect is separate spawned geometry above dirt voxels.
- Tiny crawlers animate subtly and do not dominate the patch.
- Harness supports `?effects=dirt`.
- Tests cover dirt density, eligibility, geometry, and deterministic instance building.
