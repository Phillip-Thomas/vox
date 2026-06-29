# Design Context

Run mode: single-surface.
Surface: procedural flora system.
Exploration depth: 3.
Execution budget: standard.
Approval threshold: 4.75 / 5.
Category floor: 4.3 / 5.

## Hard Guardrails

- Preserve existing grass, tree, forage, and spawned surface-effect behavior.
- Use repo-native Three/R3F instancing rather than porting a Shadertoy raymarcher.
- Flora must be deterministic from terrain seed and voxel coordinates.
- Flora must use existing biome, wind, graphics-quality, and voxel-reality systems.
- Flora must be quality-gated and disabled on potato-tier settings.
- Plants must orient to cube-face surface normals, matching grass and trees.
- No new external runtime dependency.

## Creative Brief

- Borrow the supplied reference's useful ideas: multiple plant archetypes, fan leaves, flowers, seed heads, cactus/succulent silhouettes, shrubs, and subtle wind bend.
- Make flora feel like a living ecology layer between grass and trees.
- Planets should differ: arid worlds get cactus/seedheads; lush worlds get flowers/fans/shrubs; mixed worlds get blended variety.
- Motion should follow the same planet wind as grass, trees, dust, and dirt.

## Open Field

- Exact plant geometry, density, palette, species weighting, and harness composition.
- Whether flora is one layer or multiple instanced layers.
- Test harness presentation and screenshot framing.
