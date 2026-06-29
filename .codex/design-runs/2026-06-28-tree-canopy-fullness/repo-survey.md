# Repo Survey

## Source Files

- `main/src/utils/treeGen.ts`: deterministic skeleton, trunk geometry, leaf card geometry, blossom geometry, impostor geometry.
- `main/src/utils/treeProfile.ts`: per-planet tree species, colours, silhouette, density, leaf scale.
- `main/src/utils/treeMaterials.ts`: bark/leaf/blossom/impostor PBR materials and shader wind.
- `main/src/components/TreeField.tsx`: in-world instanced tree placement, LOD, material/profile application.
- `main/src/treeTest.tsx`: isolated tree harness using the same generator and materials as the game.
- `main/src/utils/windProfile.ts`: shared deterministic per-planet wind profile already consumed by grass.

## Current Findings

- Tree generation is centralized and deterministic, so a shared fix can affect every planet and silhouette.
- Leaves are already alpha-cut cards with wind attributes, but density is still budgeted conservatively.
- Profile canopy density currently ranges below or equal to old baseline, which limits fullness.
- Frond palms still have a small rib count and can look sparse.
- Tree material wind is generic sine motion and does not yet consume the shared planet wind profile.

## Existing Validation

- `treeGen.test.ts` covers deterministic generation, wind attributes, and height bounds.
- `treeProfile.test.ts` covers profile determinism, reachable silhouettes, colour safety, and params.
- `tree-test.html` gives direct rendered evidence for all silhouettes.
