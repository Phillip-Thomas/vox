# Screenshot Report

Canonical preview URL: http://127.0.0.1:5173/?agent=1&world=0,0&dayphase=0.4734
Browser path: Browser plugin not available; used repo-local `playwright-core` with `/usr/bin/chromium-browser`.

## Screenshots

- Desktop wide: `screenshots/desktop-wide-grass.png`
- Desktop close: `screenshots/desktop-close-hair-grass.png`
- Mobile close: `screenshots/mobile-close-hair-grass.png`

## Render Proof

- Page title: `Paravoxia`
- Framework overlay: false
- Grass material key: `grass-pbr-v4`
- Close grass instances: 8,344
- Close grass capacity: 44,496
- Relevant console issues: none
- Known benign console warnings: headless WebGL `ReadPixels` GPU-stall warnings and Firebase SDK deprecation warning.

## Review

- Desktop wide confirms the grass surface is visible at gameplay scale and no longer only reads as a few large decorative leaves.
- Desktop close confirms the blade silhouette is thinner and denser, with many strand crossings instead of broad fan clumps.
- Mobile close confirms the denser hairlike read survives a narrow viewport with the HUD present.
- Stored debug seed `-1,-70` did not produce a grass mesh within the headless validation timeout, so final screenshots used `world=0,0`, which produced a live `grass-pbr-v4` mesh.

