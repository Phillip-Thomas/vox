# Handoff

## Accepted Design

Micro-cluster hair field: replace large tuft silhouettes with many narrower strands that cover the block surface more evenly.

## Component Mapping

- `GrassField.tsx`: keep architecture and capacity growth logic.
- `grassField.ts`: adjust blade geometry, count, placement, wind shader constants, cache key if shader changes.
- `grassProfile.ts`: lower per-planet width range and slightly tune density multiplier if needed.
- `grassField.test.ts` / `grassProfile.test.ts`: update invariants so hairlike density and width are protected.

## Token Mapping

No CSS tokens. Procedural constants are the design tokens for this surface:

- `BLADE_WIDTH`
- `BLADE_HEIGHT`
- `BLADES_PER_CLUMP`
- placement scatter ranges
- shader bend/flutter constants
- profile `widthMul` range

## State Matrix

- Grass enabled on HIGH/ULTRA: dense hairlike strands.
- Grass disabled on POTATO: unchanged.
- Sparse/arid biome coverage: still allows bare ground patches.
- Distance culling: unchanged.
- Seed determinism: unchanged.

## Acceptance Criteria

- `bladesPerVoxel(1)` increases from the old 3-blade tuft unit.
- Base geometry is materially thinner than the old `0.18` width.
- Per-planet width multiplier range remains below the old common upper range.
- Cached and live grass builders remain identical.
- Rendered screenshots show a denser surface without a framework overlay.

