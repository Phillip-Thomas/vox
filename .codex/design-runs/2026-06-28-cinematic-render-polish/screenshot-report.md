Canonical preview URL:
- http://127.0.0.1:5173/

Capture method:
- Browser plugin unavailable; used Playwright with project-local `playwright-core`.
- Desktop viewport: 1280x720.
- Mobile viewport: iPhone 13 emulation.
- Deterministic world vantages used `?agent=1&profile=HIGH&world=-2,9&dayphase=0.0977`.
- In-game captures clicked through Play and used `?bench=1&debug=1`.

Baseline screenshots:
- `screenshots/baseline-agent-coast.png`
- `screenshots/baseline-agent-underCanopy.png`
- `screenshots/baseline-agent-overhead.png`
- `screenshots/baseline-agent-horizon.png`
- `screenshots/baseline-desktop-high.png`
- `screenshots/baseline-mobile-medium.png`

After screenshots:
- `screenshots/after-agent-coast.png`
- `screenshots/after-agent-underCanopy.png`
- `screenshots/after-agent-overhead.png`
- `screenshots/after-agent-horizon.png`
- `screenshots/after-desktop-high.png`
- `screenshots/after-mobile-medium.png`

Observed visual change:
- Tree and grass silhouettes are less crunchy from the softened outline.
- High-contrast terrain/water transitions retain shape but lose some hard black edge pressure.
- Sky/water/terrain highlights feel less clipped because the color grade no longer clamps HDR before final ACES.
- Color identity remains vivid and recognizably Paravoxia.

Perf notes:
- Desktop HIGH after patch: settled around 59-60 FPS, p95 around 17.1-17.3ms in the local run.
- Mobile MEDIUM after patch: settled around 60 FPS, p95 around 18.3ms, about 114 draw calls / 1.22M triangles.
- HIGH draw/triangle stats remain unreliable in the bench overlay because the composer path reports `gl.info` after postprocessing.

Known non-blocking console warning:
- Firebase warning: deprecated initialization parameters; unrelated to this render pass.
