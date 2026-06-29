# Design Context

Run mode: single-surface.
Surface: procedural fauna system.
Exploration depth: 3.
Execution budget: standard.
Approval threshold: 4.75 / 5.
Category floor: 4.3 / 5.

## Hard Guardrails

- Preserve existing grass, flora, trees, forage, spawned surface effects, and voxel rendering behavior.
- Use repo-native Three/R3F instancing rather than porting a Shadertoy raymarcher.
- Fauna must be deterministic from terrain seed and voxel coordinates.
- Fauna must consume existing biome, wind, graphics-quality, and voxel-reality systems.
- Fauna must be quality-gated and disabled on potato-tier settings.
- Animals must orient to cube-face surface normals, matching grass, flora, and trees.
- Keep density sparse enough that older laptops can disable or reduce the layer.
- No new external runtime dependency.

## Creative Brief

- Borrow the supplied reference's useful animal ideas: quadruped body construction, bobbing heads, running/grazing cycles, wagging tails, fluffy bodies, and simple readable silhouettes.
- Make fauna feel like another living ecology layer, not a cartoon raymarch pasted onto the terrain.
- Planets should differ: lush worlds support woolly/grazer herds; arid worlds favor smaller runners/hoppers; alien hues subtly tint coats and accents.
- Motion should follow the same planet wind and reality-stage controls as grass, trees, dust, dirt, and flora.

## Open Field

- Exact animal archetype geometry, density, palette, species weighting, and harness composition.
- Whether fauna is one layer or multiple instanced layers.
- Screenshot framing and test harness labels.
