# Handoff

## Component Mapping

- Mesh topology: `main/src/utils/treeGen.ts`.
- Regression coverage: `main/src/utils/treeGen.test.ts`.
- Visual QA: `tree-test.html?only=frond`, `tree-test.html?only=round`, `tree-test.html?mode=silhouettes`, and in-world `?agent=1&world=0,45`.

## Acceptance Criteria

- Interior stem rings are shared across adjacent vertical chunks.
- Frond trunk close-up shows a continuous main stem.
- Silhouette row does not reveal disconnected bases.
- Focused tree tests and full verification pass.
