# Repo Survey

Relevant files:

- `main/src/components/WaterBlocks.tsx`: builds live water face instances against static and dynamic water cells.
- `main/src/utils/waterFacePlacement.ts`: pure placement/classification utility for water face matrices.
- `main/src/utils/waterFacePlacement.test.ts`: focused geometry tests.
- `main/src/utils/waterVoxels.ts`: face direction order and water face data contract.
- `main/src/components/debug/AgentCamera.tsx`: `?agent=1` verification bridge.

Existing state:

- The first water continuity pass already classified cube-edge/corner outward faces as `surface`.
- That fixed height mismatch but allowed multiple outward surface quads from the same edge cell to cross.
- The worktree contains unrelated multiplayer/server changes; this run only edits the water placement files.

Verification route:

- Browser plugin was not available in this session.
- Playwright was used against local Vite at `http://127.0.0.1:5173/`.

