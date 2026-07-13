# Flora Harvest System

Status: Phase 1 vertical slice LANDED (2026-07-12).

## Owner ruling

Visible procedural flora is gameplay flora. A plant under the crosshair must be
targetable and harvestable; graphics settings may reduce distant presentation,
but may never remove nearby economy resources.

## Stable contract

- Identity: `(worldId, source: "flora", voxelCoord)`.
- `kind` selects the canonical drop, but does not create a second claim at the
  same coordinate.
- The server owns item ID and deterministic quantity. Client-supplied `id` and
  `qty` are ignored.
- Local prediction, rejection rollback, snapshots, per-world saves, late join,
  warp remounts, and Neon persistence all use the existing `resource_taken`
  pipeline.
- Instance IDs are never gameplay identity; they are rebuilt presentation slots
  resolved through a slot-to-voxel map.

## Current flora catalog

| Plant | Inventory drop | Yield |
| --- | --- | ---: |
| Cactus | Cactus Pulp | 1-2 |
| Fan Plant | Fan Frond | 1-2 |
| Wild Flower | Wild Bloom | 1-2 |
| Seedhead | Seedpod | 2-3 |
| Berry Shrub | Wildberries | 1-2 |

The four non-food drops use the new `ingredient` item kind. Berries remain both
edible and available to future alchemy recipes.

## Landed vertical slice

- Canonical flora population is seeded and quality-independent.
- Every graphics profile renders canonical plants inside interaction range;
  distant density and animation remain presentation-only.
- A coarse per-instance sphere ray avoids expensive merged-geometry triangle
  raycasts while preserving crosshair/terrain occlusion ordering.
- A short hand-gather hold dispatches `harvestFloraCommand`.
- Harvested plants disappear, enter inventory, persist per world, replicate to
  peers, survive late join/warp remounts, and restore on non-conflict rejection.
- Story-hidden flora cannot be targeted.
- Neon needs no migration: `world_collectibles`, `world_events`, and
  `player_inventory` already store generic text resource/item identities.

## Next phases

1. Add the first alchemy station and ordinary data-driven recipes using the four
   ingredient IDs; inventory shape does not need to change.
2. Add rarity/biome traits to the definition catalog, not individual item stacks,
   so saves remain fungible counts.
3. Port the pure canonical flora placement predicate to the state server. The
   present authority validates known kind, plausible terrain coordinate, first
   claim, and canonical yield, but does not yet prove that terrain generation
   placed a plant at the submitted coordinate.
4. Add regrowth policy explicitly (season/time/event based). Until then,
   harvested flora is permanently removed per world, matching trees and forage.
5. Add scanner and recipe-discovery presentation without changing harvest or
   persistence contracts.

## Verification

- Client `npm run verify`: 139 files / 1,056 tests plus production build.
- Server `npm run verify`: 6 files / 58 tests plus production build.
- SwiftShader score-leading frame gate: 60.39 fps median, PASS.
- Server coverage includes canonicalization and alternate-kind duplicate claims;
  client coverage includes render, proxy picking, command, rollback, persistence,
  snapshot replacement, and replication.
