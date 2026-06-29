# Screenshot Report

Canonical preview URL: `http://127.0.0.1:5174/voxel-test.html?effects=flora&profile=HIGH&seed=54321`
Browser path: Browser plugin unavailable; used Playwright Core with `/snap/bin/chromium`.

## Captures

- Lush desktop: `flora-harness-desktop.png` at 1280 x 800, seed `54321`.
- Lush desktop motion comparison: `flora-harness-desktop-t1.png` at 1280 x 800, seed `54321`.
- Arid desktop: `flora-harness-arid-desktop.png` at 1280 x 800, seed `98765`.
- Mobile: `flora-harness-mobile.png` at 390 x 844, seed `54321`.

## Render Checks

- Page identity: `voxel-test.html?effects=flora&profile=HIGH`.
- Harness summary: mode `effects`, profile `HIGH`, materials `sand`, `dirt`, `grass`.
- Blank-page check: passed.
- Framework overlay: none.
- Console health: no app, shader, or program errors. WebGL `ReadPixels` warnings came from screenshot capture.
- Motion proof: desktop frame A/B comparison changed 7,975 of 1,024,000 pixels (0.78%) with max RGB delta 328.

## Screenshot Review

The lush seed shows flowers, fan/grasslike stalks, and shrubs distributed across grass, dirt, and sand. The arid seed shifts toward cacti and dry seedheads. Mobile framing remains readable and does not overlap the harness labels.
