# Repo Survey

## Source Files

- `main/src/utils/treeProfile.ts`: deterministic per-planet tree profile, silhouette presets, and `paramsFromProfile`.
- `main/src/utils/treeGen.ts`: shared procedural geometry generator; height is consumed as `TreeGenParams.height`.
- `main/src/components/TreeField.tsx`: instanced in-world placement and per-instance scale.
- `main/src/treeTest.tsx`: isolated visual harness for tree silhouettes, variety grids, and close-ups.
- `main/src/utils/treeProfile.test.ts`: deterministic profile and parameter bounds tests.

## Current Behavior Found

- Profile height used `3.5 + roll * 4`, so many non-frond species could be `3.5..5.5` world units.
- Frond and wispy only lifted to a `5.5` minimum.
- In-world instance scale could shrink any tree to `0.8x`.
- The harness did not expose trunk height or crown radius in `window.__treeTest.summary()`.

## Preview Server

Existing healthy server found at `http://127.0.0.1:5173`; no duplicate dev server started.
