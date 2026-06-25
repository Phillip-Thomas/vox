# Screenshot Report

Canonical preview URL: `http://127.0.0.1:5173/`

Browser availability: Browser plugin not available. Playwright fallback used.

Primary underwater vantage:

- Route: `/?agent=1&world=-48%2C59&dayphase=0.8579&profile=HIGH`
- Camera position: `[17.702, -2.942, 46.99]`
- Camera quaternion: `[-0.1249, 0.4965, 0.8296, -0.2229]`
- Before desktop: `evidence/water-underwater-before-artifacts-desktop.png`
- Before mobile: `evidence/water-underwater-before-artifacts-mobile.png`
- Final desktop: `evidence/water-underwater-after-pass2-desktop.png`
- Final mobile: `evidence/water-underwater-after-pass2-mobile.png`
- Crystal clarity desktop: `evidence/water-underwater-crystal-pass3-desktop.png`
- Crystal clarity mobile: `evidence/water-underwater-crystal-pass3-mobile.png`

Cross-check:

- Route: `/?agent=1&world=39%2C-71&dayphase=0.4156&profile=HIGH`
- Desktop screenshot: `evidence/water-underwater-godray-crosscheck-desktop.png`

Result:

- Baseline showed dense repeated warm/yellow bands across nearby voxel faces.
- Final capture shows teal underwater haze, particles, breath UI, readable terrain, and softened sun aperture without terrain-texture smearing.
- Crystal pass capture keeps terrain more visible through the water and reduces the milky opacity from the previous pass.

Bubble motion check:

- Same page/session start screenshot: `evidence/water-underwater-bubble-motion-start.png`
- Same page/session forward-move screenshot: `evidence/water-underwater-bubble-motion-forward.png`
- Result: particle systems remain visible after a forward move and use local-up uniforms for rise direction.

Runtime evidence:

- Relevant console errors: none.
- Console warnings: existing deprecated initialization parameter warning.
- Primary final desktop: `fps=57`, `p50=16.7`, `p95=17.4`.
- Primary final mobile: `fps=59`, `p50=16.7`, `p95=17.2`.
- Crystal pass desktop: `fps=56`, `p50=16.7`, `p95=17.3`.
- Crystal pass mobile: `fps=59`, `p50=16.7`, `p95=17.5`.
- Bubble motion check: `fps=60`, `p50=16.7`, `p95=17.3`.
