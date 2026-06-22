# Planet System Architecture Handoff

Last reviewed: 2026-06-22

This document captures the current direction for the planet, biome, resource, harvesting, and crafting foundation. It is intended for the next implementation pass, with enough context to avoid rebuilding a parallel system or accidentally tying gameplay economy back to render materials.

## Goal

Build a structured, deterministic world economy that can support:

- distinctive planet archetypes
- local biome variety
- resource distribution by biome, depth, archetype, and progression tier
- scanner previews that match actual generation
- harvesting and inventory
- future crafting and tool progression
- cohesive visuals across terrain, water, sky, grass, trees, and impostors

The core rule is:

```txt
PlanetProfile -> BlockDefinition -> render MaterialType
                            -> harvest ResourceId
                            -> scanner PlanetManifest
```

New systems should become the source of truth. Old systems should become projections or compatibility wrappers.

## Current State

The repo now has a new `src/game` domain layer:

```txt
src/game/
  schema.ts
  adapters.ts
  PlanetProfile.ts
  planetSystem.test.ts
  data/
    blocks.ts
    biomes.ts
    planetArchetypes.ts
    resources.ts
  systems/
    harvestingSystem.ts
    harvest.test.ts
    inventorySystem.ts
    targeting.ts
```

The existing engine still depends heavily on:

```txt
src/types/materials.ts
src/utils/proceduralWorldGenerator.ts
src/utils/worldGenCache.ts
src/utils/worldPreview.ts
src/components/EfficientPlayer.tsx
src/App.tsx
```

### What Is Working

- `BlockDefinition`, `ResourceDefinition`, `BiomeDefinition`, and `PlanetArchetypeDefinition` exist.
- `PlanetProfile` provides deterministic archetype, biome mix, resource bias, hazards, palette, and progression tier.
- `GENERATION_SCHEMA_VERSION` exists and is included in `worldGenCache` keys.
- `MaterialType` has been extended with `BASALT`, `ICE`, and `CRYSTAL`, appended safely to `MATERIAL_ORDER`.
- `adapters.ts` centralizes `BlockId <-> MaterialType` compatibility.
- `harvestingSystem` maps mined material to block drops and banks resources in `inventorySystem`.
- `App` displays a small inventory panel and looked-at block readout.
- Tests cover registry integrity, deterministic `PlanetProfile`, broad distribution guarantees, archetype surface skin, ore distribution, harvesting, and inventory.

### Current Compatibility Boundary

`MaterialType` is still the active terrain/render identity. The intended compatibility seam is:

```ts
blockToRenderMaterial(blockId): MaterialType
materialToLegacyBlock(material): BlockId
```

All reverse conversion from material to block should stay in `src/game/adapters.ts`. Do not add ad hoc material-to-block conversion in components, generators, or systems.

## Important Source-of-Truth Rules

### `MaterialType`

Answers: how does this voxel render?

It is shader/render state. It should not gain more gameplay meaning.

Allowed:

- render color
- roughness, metalness, emissive
- stable shader id through `MATERIAL_ORDER`

Avoid:

- tool requirements
- crafting categories
- harvest rules
- biome eligibility
- resource rarity

### `BlockId`

Answers: what is this voxel?

This should become the long-term terrain identity.

Allowed:

- render projection
- hardness
- tool tier
- default drops
- tags such as `rock`, `ore`, `soil`, `crystal`

### `ResourceId`

Answers: what did the player obtain?

Resources are inventory and crafting entities. Resource definitions own contextual availability and scanner visibility.

Allowed:

- tier
- category
- base frequency when eligible
- archetype affinity
- biome affinity
- depth bands
- cluster size
- harvest yield
- scan level

### `PlanetProfile`

Answers: why does this world exist this way?

Everything high-level should derive from it:

- terrain profile
- archetype
- local biome mix
- resource biases
- hazards
- palette
- progression tier
- scanner tags

## Current Architectural Risks

### 1. Generator Is Still Material-First

`ProceduralWorldGenerator.generateMaterialForPosition()` now directly paints archetype surfaces with `MaterialType` and maps resource biases to ore render materials.

This is useful for immediate visual diversity, but it means the new registries are not yet authoritative.

Current risk:

```txt
PlanetProfile/resource data says one thing
generator paints a MaterialType directly
harvesting infers BlockId from MaterialType
```

That works only while every visual material maps cleanly to one gameplay block/resource. It will break down for cases like:

- `charged_crystal` vs `void_glass`, both rendered as `CRYSTAL`
- `iron_trace` rendered as `SILVER`
- a future block sharing a render material with another block

Convergence target:

```ts
generateBlockForPosition(x, y, z): BlockId
generateMaterialForPosition(x, y, z): MaterialType {
  return blockToRenderMaterial(generateBlockForPosition(x, y, z));
}
```

Then resource/deposit identity must be sampled separately:

```ts
generateDepositForPosition(x, y, z): ResourceDeposit | null
```

### 2. `PlanetProfile.terrainProfile` Can Disagree With Actual Terrain

`PlanetProfile` reports `arch.terrainProfile`, but `createTerrainConfig(seed, radius)` still rolls terrain profile independently from seed.

This means a planet can be labeled by archetype terrain profile while the actual terrain config used by `ProceduralWorldGenerator` may be different.

Convergence target:

```ts
createTerrainConfigFromProfile(profile, planetRadius)
```

or:

```ts
buildPlanetProfile(seed).terrainConfig
```

Then all terrain, water, arrival pose, preview, and scanner systems consume the same config.

### 3. Preview/Impostors Do Not Use `PlanetProfile`

`worldPreview.ts` still derives preview traits from `createTerrainConfig()` and `terrainProfile`, not from `PlanetProfile`.

Result: distant planet colors can disagree with the loaded archetype skin.

Convergence target:

```ts
deriveWorldPreviewTraits(seed) {
  const profile = buildPlanetProfile(seed);
  ...
}
```

Preview should show archetype color families:

- arid: sand/mesa
- frozen: ice
- volcanic: basalt/lava
- crystal: cyan crystal fields
- metallic: dark stone/metal ridges
- verdant/oceanic/fungal: vegetation families

### 4. Resource Definitions Are Richer Than Placement

`ResourceDefinition` includes `depthBands`, `clusterSize`, `toolTier`, `yield`, and `scanLevel`, but actual ore placement currently uses only `profile.resourceBiases`.

Convergence target:

```ts
sampleResourceDepositAt(position, profile, localBiome, depthBand): ResourceDeposit | null
```

This function should be shared by:

- terrain/deposit generation
- scanner manifest
- harvesting
- tests

### 5. Harvesting Is Runtime-Random And Material-Based

`harvestMaterial(material)` uses `Math.random()` for yield. This is acceptable for runtime action quantity, but the resource identity currently comes from `MaterialType`.

Convergence target:

```ts
harvestVoxel({
  blockId,
  deposit,
  toolTier,
  position,
  profile
}): Drop[]
```

Voxel deletion should only happen after harvest permission succeeds.

### 6. New Materials Are Not Fully Authored In Shader Detail

`BASALT`, `ICE`, and `CRYSTAL` are appended safely to `MATERIAL_ORDER`, but `voxelMaterial.ts` still gives unhandled material ids the generic fallback surface detail.

This is not a correctness bug, but the visuals may feel less intentional than stone/dirt/grass/sand.

Next visual pass should add explicit shader branches for:

- basalt: dark fractured strata, slight warm lava speckle
- ice: translucent blue-white facet detail, low roughness, subtle internal glow
- crystal: angular facet/ridge detail, stronger emissive highlights

## Recommended Implementation Order

### Phase 1: Lock The Contract

Status: mostly done.

Keep:

- `src/game/data/*`
- `src/game/adapters.ts`
- `src/game/schema.ts`
- registry integrity tests

Add:

- short comments in `proceduralWorldGenerator` marking current direct material painting as transitional
- tests that every new `MaterialType` has a shader detail strategy or intentionally uses fallback

Do not:

- add more gameplay meaning to `MaterialType`
- add more reverse adapters outside `adapters.ts`

### Phase 2: Make `PlanetProfile` Authoritative For Terrain Config

Goal: one source for terrain profile.

Steps:

1. Add `terrainConfig` or `terrainConfigParams` to `PlanetProfile`.
2. Refactor `createTerrainConfig(seed, radius)` so it delegates to `buildPlanetProfile(seed)` or accepts a profile.
3. Update `worldPreview.ts` to use `PlanetProfile`.
4. Add tests:
   - preview terrain profile equals profile terrain profile
   - generator profile equals profile used by terrain config
   - water/arrival pose still deterministic

Expected affected files:

```txt
src/game/PlanetProfile.ts
src/utils/terrainConfig.ts
src/utils/worldPreview.ts
src/utils/proceduralWorldGenerator.ts
src/utils/worldArrival.ts
src/utils/worldGenCache.ts
```

### Phase 3: Add Block-First Generator API

Goal: current visuals stay compatible, but terrain identity becomes `BlockId`.

Steps:

1. Add:

   ```ts
   generateBlockForPosition(x, y, z): BlockId
   ```

2. Move `archetypeSurface()` to return `BlockId`, not `MaterialType`.
3. Make legacy material wrapper:

   ```ts
   generateMaterialForPosition(x, y, z) {
     return blockToRenderMaterial(this.generateBlockForPosition(x, y, z));
   }
   ```

4. Add tests comparing old material output to `blockToRenderMaterial(generateBlockForPosition())`.
5. Update `worldGenCache` terrain materialization to store `blockId` as an additional field while preserving `material` for render.

Suggested transitional terrain type:

```ts
interface TerrainVoxel {
  x: number;
  y: number;
  z: number;
  blockId?: BlockId;     // new source
  material: string;      // render projection, kept for current renderer
  color: THREE.Color;
}
```

Do not remove `material` yet. The renderer and shader path still need it.

### Phase 4: Add Resource Deposit Sampling

Goal: scanner and harvesting agree on what resources exist.

Add:

```txt
src/game/generation/resourceDeposits.ts
```

Suggested API:

```ts
interface ResourceDeposit {
  resourceId: ResourceId;
  richness: number;
  scanLevel: number;
}

sampleDepositAt(input: {
  x: number;
  y: number;
  z: number;
  blockId: BlockId;
  profile: PlanetProfile;
  localBiome: BiomeId;
  depthBand: DepthBand;
}): ResourceDeposit | null
```

Rules:

- use salted coordinate hashes, not order-dependent random streams
- respect `depthBands`
- respect archetype and biome affinities
- keep tier 0 resources guaranteed
- make rare resources rare but testably present

### Phase 5: Planet Manifest And Scanner

Goal: make travel decisions meaningful and truthful.

Add:

```txt
src/game/generation/buildPlanetManifest.ts
src/game/systems/scannerSystem.ts
```

Suggested manifest:

```ts
interface PlanetManifest {
  schemaVersion: number;
  seed: number;
  archetype: ArchetypeId;
  traits: string[];
  hazards: HazardId[];
  commonResources: ResourceId[];
  rareResources: ResourceId[];
  hiddenResources: ResourceId[];
  dominantBiomes: BiomeId[];
}
```

Manifest must be derived from the same profile/resource rules that placement uses.

Tests:

- manifest resources all have nonzero placement probability
- scan level hides/reveals the correct resources
- scanner does not claim impossible resources

### Phase 6: Harvesting Becomes Block/Deposit-Based

Goal: no material-based gameplay.

Replace:

```ts
harvestMaterial(material)
```

with:

```ts
harvestVoxel({
  blockId,
  deposit,
  toolTier,
  profile
})
```

Then `EfficientPlayer` should:

1. raycast or ray-march target voxel
2. read voxel `blockId` from `voxelSystem` or terrain cache
3. check tool requirements
4. roll drops
5. add to inventory
6. remove voxel
7. expose neighbors

Until `voxelSystem` stores `blockId`, keep the current material adapter path as the wrapper.

### Phase 7: Persistence And Crafting

Not yet implemented.

Future systems should include:

```txt
src/game/systems/craftingSystem.ts
src/game/data/recipes.ts
src/game/systems/worldEditPersistence.ts
src/game/systems/discoverySystem.ts
```

Persistence must include:

- generation schema version
- current coordinate/seed
- removed voxels
- placed voxels
- inventory
- discovered scans
- crafted upgrades

## Tests To Maintain

Existing targeted commands:

```bash
npm run typecheck
npm run test -- src/game/planetSystem.test.ts src/game/systems/harvest.test.ts src/utils/proceduralProfile.test.ts src/utils/proceduralWorldGenerator.test.ts src/utils/worldGenCache.test.ts
```

Full verification:

```bash
npm run verify
```

Important test categories:

- registry references are valid
- adapters round-trip
- planet profiles are deterministic
- archetype distribution is healthy
- tier 0 resources exist everywhere
- tier 1 resources appear on a healthy fraction of planets
- rare resources are rare but not impossible
- generator material output remains deterministic
- block-first output projects to the same render material during migration
- scanner manifest agrees with placement rules
- harvesting respects block drops, tool tier, and deposit identity

## Current Worktree Notes

As of this handoff, there are uncommitted changes in:

```txt
src/App.tsx
src/components/EfficientPlayer.tsx
src/types/materials.ts
src/utils/cubeGravityConstants.ts
src/utils/proceduralWorldGenerator.ts
src/utils/worldGenCache.ts
src/game/
src/utils/proceduralProfile.test.ts
```

There are also untracked capture artifacts under:

```txt
captures/
```

Decide whether those are visual references worth committing. If they are temporary screenshots/metrics, keep them out of the code change.

## Practical Next Commit Shape

Best commit boundary:

1. `src/game` registries, systems, tests
2. `MaterialType` additions
3. `PlanetProfile` integration into generator
4. harvest HUD integration
5. cache schema versioning
6. docs

Do not combine this with unrelated graphics or movement tuning unless already intentional.

## Convergence Checklist

Before adding a new planet feature, ask:

- Does this read from `PlanetProfile`?
- Does gameplay identity use `BlockId`, not `MaterialType`?
- Does inventory/crafting use `ResourceId`, not `BlockId` or `MaterialType`?
- Does scanner read from the same rules as actual generation?
- Is expensive generated data prewarmable and cache-keyed by schema version?
- Is deterministic generation done with salted hashes?
- Is any compatibility wrapper marked with an exit condition?

If the answer is no, the change is likely adding bloat instead of moving toward the target architecture.

