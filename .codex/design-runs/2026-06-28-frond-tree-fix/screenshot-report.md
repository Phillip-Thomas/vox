Canonical preview:
- http://127.0.0.1:5173/tree-test.html?only=frond

Capture method:
- Playwright via `playwright-core` from `main/`.
- Browser plugin was unavailable, so the run used Chromium at `/home/thomasphillip/.cache/ms-playwright/chromium-1217/chrome-linux/chrome`.

Screenshots:
- `screenshots/iteration-1-frond.png`: trunk-only bark worked, but foliage was sparse and dashed.
- `screenshots/iteration-2-frond.png`: higher count, but still read like a hanging mop.
- `screenshots/iteration-3-frond.png`: broad overlapping blades, much fuller, but too smooth.
- `screenshots/iteration-4-frond.png`: final front view; broad attached blades, varied frond lengths, hidden guide ribs.
- `screenshots/iteration-4-frond-angled.png`: final angled view; radial crown reads in 3D, not just as a flat front silhouette.
- `screenshots/iteration-4-silhouettes.png`: six-silhouette regression view.

Geometry proof from final capture:
- Frond bark: 204 vertices, material key `tree-bark-v5`.
- Frond leaves: 5952 vertices, material key `tree-leaf-v6`.
- Other silhouettes rendered non-empty in the regression lineup.

Known non-blocking capture noise:
- Vite favicon 404 in console.
