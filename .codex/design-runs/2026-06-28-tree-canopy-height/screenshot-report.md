# Screenshot Report

Canonical preview URL: `http://127.0.0.1:5173/tree-test.html?mode=silhouettes`.
Game sanity URL: `http://127.0.0.1:5173/?agent=1&world=0,45&dayphase=0.4734&profile=HIGH`.
Browser path: Browser plugin unavailable; used repo-local `playwright-core` with `/usr/bin/chromium-browser`.

## Captures

- `screenshots/desktop-tree-silhouettes.png`
  - `treeCount`: 6
  - silhouettes: conical, frond, round, umbrella, weeping, wispy
  - measured height range: `5.92..10.35`
  - measured crown radius range: `2.18..3.17`
- `screenshots/desktop-tree-variety-grid.png`
  - `treeCount`: 24
  - all six silhouettes present
  - measured height range: `6.36..10.28`
  - measured crown radius range: `2.00..3.62`
- `screenshots/mobile-round-close.png`
  - mobile viewport: 390 x 844
  - measured height: `5.92`
  - measured crown radius: `2.18`
- `screenshots/desktop-inworld-under-canopy.png`
  - in-world route: `world=0,45`
  - confirms player-scale under-canopy framing with a canopy overhead.

## Console And Overlay

- Framework overlay: none observed.
- Console: one generic 404 resource message, WebGL `ReadPixels` screenshot warnings, and one third-party deprecation warning. No relevant app crash or tree render error.
