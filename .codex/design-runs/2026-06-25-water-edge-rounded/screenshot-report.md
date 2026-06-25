# Screenshot Report

Canonical preview URL: `http://127.0.0.1:5173/`

Browser availability: Browser plugin not available. Playwright fallback used.

Regression vantage:

- Route: `/?agent=1&world=-91%2C-4&dayphase=0.6444&profile=HIGH`
- Camera position: `[-54.134, 46.605, -18.392]`
- Camera quaternion: `[-0.1675, -0.0136, 0.6847, 0.7092]`
- Desktop screenshot: `.codex/design-runs/2026-06-25-water-edge-rounded/evidence/water-edgeband-desktop.png`
- Mobile screenshot: `.codex/design-runs/2026-06-25-water-edge-rounded/evidence/water-edgeband-mobile.png`
- Result: the broad near-edge water band is no longer cattycorner; non-edge cells remain aligned to the dominant cube face.

Visible-seams vantage:

- Route: `/?agent=1&world=-48%2C59&dayphase=0.0218&profile=HIGH`
- Camera position: `[51.242, 51.191, 0.64]`
- Camera quaternion: `[-0.1564, 0.062, -0.3813, 0.909]`
- Desktop screenshot: `.codex/design-runs/2026-06-25-water-edge-rounded/evidence/water-visible-seams-fixedcap-desktop.png`
- Mobile screenshot: `.codex/design-runs/2026-06-25-water-edge-rounded/evidence/water-visible-seams-fixedcap-mobile.png`
- Result: the rounded cap is visible after fixing triangle winding, so the edge is not left as a larger empty cut.

Cross-over check vantage:

- Route: `/?agent=1&world=-91%2C-4&dayphase=0.2458&profile=HIGH`
- Camera position: `[-51.996, 53.793, 36.882]`
- Camera quaternion: `[-0.1576, -0.0463, 0.2509, 0.954]`
- Desktop screenshot: `.codex/design-runs/2026-06-25-water-edge-rounded/evidence/water-edgeonly-crosscheck-desktop.png`
- Mobile screenshot: `.codex/design-runs/2026-06-25-water-edge-rounded/evidence/water-edgeonly-crosscheck-mobile.png`

Runtime evidence:

- Page title: `Paravoxia`
- Water mesh: visible
- Water instance count after trim fix: 8456
- Relevant console errors: none
- Console warnings: existing deprecated initialization parameter warning

State coverage:

- Loading: scoped out; this is steady-state rendered game geometry.
- Empty: scoped out; target world intentionally contains water geometry.
- Error: scoped out; no UI error flow changed.
- Success: captured in desktop and mobile screenshots for the active seam vantage and prior regression vantages.
- Stress data: captured through the live water mesh count at the target world.

Quality review: the broad near-edge diagonal/cattycorner water band is gone from the reported view. The earlier cube-edge view still avoids the original crossed-X overlap. The `-48,59` seam view now uses dedicated edge-cap geometry rather than a turned water plane.
