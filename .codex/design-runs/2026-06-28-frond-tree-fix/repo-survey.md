Relevant files:
- `main/src/utils/treeGen.ts`: frond skeleton, trunk geometry pruning, leaf geometry generation.
- `main/src/utils/treeProfile.ts`: species profile density and shape parameters.
- `main/src/utils/treeGen.test.ts`: tree geometry and candidate-selection tests.
- `.codex/design-runs/2026-06-28-tree-species-one-by-one/capture-species.mjs`: reusable Playwright capture script.

Current defects:
- Frond bark geometry includes many rib segments, causing brown spokes through the crown.
- Generic leaf clusters spray around rib nodes, reading as a dense tassel instead of palm leaflets.
- The shape is overly vertical/curtain-like near the trunk and not enough like arcing fronds.

Canonical preview:
- Existing healthy dev server at `http://127.0.0.1:5173/tree-test.html`.
