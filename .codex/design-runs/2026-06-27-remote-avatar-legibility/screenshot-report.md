# Screenshot Report

Canonical preview URL:

`http://127.0.0.1:5173/?agent=1&world=0,0&avatarDemo=1`

## Capture Method

- Playwright MCP attempted first but could not launch because its Chrome distribution was missing.
- Fallback used repo-local `playwright-core` with system Chromium through `capture-avatar-demo.mjs`.
- Agent camera placed the view with `window.__game.lookFrom(0, 56, 7.5, 0, 52.7, -2.6)`.

## Screenshots

| View | Viewport | Path |
| --- | --- | --- |
| Desktop | 1440x900 | `screenshots/desktop-avatar-demo.png` |
| Mobile | 390x844 | `screenshots/mobile-avatar-demo.png` |

## Review

- Desktop: pass. Four remote states are visible together; label, beacon, body posture, and action accessory are readable. The scene is bright because the agent camera is above the horizon, but the avatar signals remain clear.
- Mobile: pass. Labels and beacons remain readable at 390px width. HUD elements do not occlude the avatar group; action buttons stay below it.
- Required states shown: swim, jetpack, mine, build.
- Stress state shown: multiple remote avatars with labels in one view.
- Remaining limitation: live co-op screenshots were not recaptured against Cloud Run; this run validates the render surface and debug harness locally.
