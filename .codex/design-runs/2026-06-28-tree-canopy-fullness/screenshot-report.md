# Screenshot Report

Canonical preview URL: `http://127.0.0.1:5173/tree-test.html`
Game sanity URL: `http://127.0.0.1:5173/?agent=1&world=-92,-79&dayphase=0.4734&profile=HIGH`
Browser path: Browser plugin unavailable, used repo-local `playwright-core` with `/usr/bin/chromium-browser`.

## Captures

- `screenshots/desktop-tree-silhouettes.png`
  - `treeCount`: 6
  - silhouettes: conical, frond, round, umbrella, weeping, wispy
  - material keys: `tree-bark-v5`, `tree-blossom-v4`, `tree-leaf-v4`
  - leaf vertices: round 2100, conical 5880, umbrella 5280, weeping 6944, wispy 3840, frond 6148
  - frame-to-frame motion proof: passed
- `screenshots/desktop-tree-variety-grid.png`
  - `treeCount`: 24
  - all six silhouettes present
  - material keys: `tree-bark-v5`, `tree-blossom-v4`, `tree-leaf-v4`
  - frame-to-frame motion proof: passed
- `screenshots/mobile-tree-weeping-close.png`
  - mobile viewport 390 x 844
  - weeping close-up leaf vertices: 6944
  - frame-to-frame motion proof: passed
- `screenshots/desktop-inworld-tree.png`
  - game world: `-92,-79`
  - active meshes: bark count 4, leaf count 4, blossom count 4, impostor count 13
  - in-world leaf vertices: 6944
  - wind uniforms populated on bark, leaf, blossom, and impostor materials
  - frame-to-frame motion proof: passed

## Console And Overlay

- Framework overlay: none.
- Relevant console issues: none.
- Browser reported WebGL `ReadPixels` warnings during screenshot capture; treated as screenshot tooling noise.
