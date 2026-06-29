Status: passed.

Canonical preview URL: `http://127.0.0.1:5173/tree-test.html`.

Required screenshots:
- `screenshots/stylized-tree-silhouettes.png`: 6 silhouettes, material keys `tree-bark-v5`, `tree-blossom-v5`, `tree-leaf-v5`, motion changed.
- `screenshots/stylized-tree-variety.png`: 24 trees, all silhouettes represented, material keys `tree-bark-v5`, `tree-blossom-v5`, `tree-leaf-v5`, motion changed.
- `screenshots/stylized-tree-weeping-mobile.png`: mobile 390x844 weeping close-up, motion changed.
- `screenshots/stylized-tree-world.png`: in-world `-92,-79`, material keys `tree-leaf-v5`, `tree-bark-v5`, `tree-blossom-v5`, `tree-impostor-v5`, motion changed.

Proof target:
- New material keys are present: passed.
- New species controls appear in `window.__treeTest.summary()`: passed.
- Leaf-like geometries expose `aTuftShade`: passed in-world for leaf, blossom, and impostor.
- No blank canvas or shader compile errors: passed.
- Relevant console issues: none after filtering favicon/driver/screenshot warnings.

Final capture command:
- `node .codex/design-runs/2026-06-28-stylized-tree-reference/capture-stylized-trees.mjs`
