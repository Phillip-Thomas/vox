# Screenshot Report

Canonical preview URL: http://127.0.0.1:5173/?agent=1&world=0,0&dayphase=0.4734
Browser path: Browser plugin not available; used repo-local `playwright-core` with `/usr/bin/chromium-browser`.

## Screenshots

- Desktop wide: `screenshots/desktop-wide-wind-grass.png`
- Desktop close: `screenshots/desktop-close-wind-grass.png`
- Mobile close: `screenshots/mobile-close-wind-grass.png`

## Render Proof

- Page title: `Paravoxia`
- Framework overlay: false
- Grass material key: `grass-pbr-v5`
- Live grass instances: 16,688
- Live grass capacity: 88,736
- Previous pass validation count: 8,344 on the same world/view.
- Relevant console issues: none

## Wind Uniform Proof

- Direction: `(-0.6456, 0.7637)`
- Strength: `1.2048`
- Gust strength: `1.0708`
- Gust scale: `0.0340`
- Gust speed: `0.5080`
- Turbulence: `0.8192`
- Veer: `1.1928`
- Offset: `(85.3229, 49.6212)`

## Motion Proof

Same camera, same grass-area crop, two screenshots 1.2 seconds apart:

- PNG bytes A: 329,551
- PNG bytes B: 328,289
- Changed bytes: 326,302
- Relevant console issues: none

## Review

- Grass density is visibly thicker on desktop and mobile.
- Static screenshots cannot show the gust field directly, but shader uniform proof and screenshot-diff motion proof confirm the rendered scene is animating under `grass-pbr-v5`.
- HUD remains readable in the mobile screenshot.

