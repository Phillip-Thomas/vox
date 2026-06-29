# Handoff

## Component Mapping

- Add `main/src/utils/floraField.ts` for profile, geometry, density, placement, material, wind, and reality updates.
- Add `main/src/components/FloraField.tsx` for React/R3F instanced layers.
- Mount `FloraField` in `EfficientScene` near grass/trees.
- Extend `voxelTest.tsx` with `?effects=flora`.

## Token / System Mapping

- Graphics quality: add `floraDensity` and `floraMaxDistance`.
- Biome: species weights, colors, density multiplier.
- Wind: uniforms mirror grass/surface effects.
- Reality: `organic`, `detail`, and `atmosphere` drive visibility and motion strength.

## Acceptance Criteria

- Cactus, fan, flower, seedhead, and shrub archetypes exist.
- Flora spawns on eligible grass/dirt/sand surfaces with material-aware weighting.
- Wind animation is driven by shared planet wind profile.
- Reality stage can reduce/hide the layer.
- Tests cover deterministic profile/placement/geometry.
- Desktop and mobile harness screenshots pass.
