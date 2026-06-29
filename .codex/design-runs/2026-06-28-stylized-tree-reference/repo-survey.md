Relevant repo files:
- `main/src/utils/treeProfile.ts`: deterministic per-planet species profile.
- `main/src/utils/treeGen.ts`: procedural L-system, branch tubes, leaf/blossom/impostor geometry.
- `main/src/utils/treeMaterials.ts`: bark/leaf/blossom/impostor shader hooks, wind, SSS, colors.
- `main/src/treeTest.tsx`: isolated tree viewer for visual QA.
- `main/src/utils/treeGen.test.ts`: deterministic geometry and attribute tests.
- `main/src/utils/treeProfile.test.ts`: deterministic profile tests and canopy budget assertions.
- `.codex/design-runs/2026-06-28-tree-canopy-fullness/`: prior fullness run and capture script to adapt.

Current implementation shape:
- Recent work replaced sparse trees with a recursive L-system and denser leaf cards.
- Wind is already planet-dynamic through `WindProfile`.
- Leaf cards already carry `aCanopyY`, `aFlower`, and `aLeafRand`.
- Materials currently key leaf, blossom, and impostor shaders as v4.

Implementation fit:
- Add species parameters in `TreeProfile` and consume them in `TreeGenParams`.
- Keep controls compact and deterministic rather than building a Florasynth-style simulation editor.
- Add tuft coherence as a new geometry attribute to support clustered shader tint and lighting.
- Use `tree-test.html` as first validation, then in-world screenshot sanity.
