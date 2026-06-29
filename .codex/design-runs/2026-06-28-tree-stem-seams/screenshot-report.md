# Screenshot Report

Canonical preview URL: `http://127.0.0.1:5173/tree-test.html?only=frond`.
Browser path: Browser plugin unavailable; used repo-local `playwright-core` with `/usr/bin/chromium-browser`.

## Captures

- `screenshots/desktop-frond-stem-close.png`
  - frond trunk close-up; main stem reads continuous.
  - bark vertices: 132.
- `screenshots/desktop-round-stem-close.png`
  - broadleaf close-up; visible base/stem area no longer shows stacked chunk breaks.
- `screenshots/desktop-tree-silhouettes.png`
  - all six silhouettes present.
  - visible stems and bases pass seam check.
- `screenshots/mobile-frond-stem-close.png`
  - mobile viewport 390 x 844.
- `screenshots/desktop-inworld-stem.png`
  - in-world under-canopy view with continuous trunk/base.

## Console And Overlay

- Framework overlay: none observed.
- Console: one generic 404 resource message, WebGL `ReadPixels` screenshot warnings, and one third-party deprecation warning. No relevant tree render error.
