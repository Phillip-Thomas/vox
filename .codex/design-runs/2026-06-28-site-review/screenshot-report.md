# Screenshot Report

## Canonical Preview

- Landing URL: `http://127.0.0.1:5173/`
- HUD URL: `http://127.0.0.1:5173/?agent=1&world=0,0`
- Existing server reused: Vite on `127.0.0.1:5173`
- Browser tooling: Playwright MCP failed because Chrome is missing at `/opt/google/chrome/chrome`. Local Chromium screenshot capture was attempted, but the full matrix was intentionally stopped to avoid interfering with the parallel rendering agent.

## Current Run Screenshots

| State | Path | Notes |
| --- | --- | --- |
| Landing menu before full render readiness | `screenshots/landing-ready-desktop.png` | Shell, title, Play button, menu links. Background still hidden/dark in this capture. |
| Landing Controls panel | `screenshots/landing-controls-desktop.png` | Static six-row controls list over live world render. |
| Landing Graphics panel | `screenshots/landing-graphics-desktop.png` | Strong live-world background and glass settings panel. |

## Reused Evidence From Prior HUD Run

| State | Path | Notes |
| --- | --- | --- |
| Desktop gameplay HUD | `../2026-06-28-mobile-hud-controls/screenshots/desktop-hud.png` | Suit telemetry, inventory, minimap, HUD controls. |
| Mobile gameplay HUD | `../2026-06-28-mobile-hud-controls/screenshots/mobile-hud.png` | Validated touch lanes and compact HUD. |
| Mobile inventory open | `../2026-06-28-mobile-hud-controls/screenshots/mobile-inventory-open.png` | Inventory opens without overlapping joystick/action cluster. |

## Screenshot Review

- Appealing: pass. Existing visual system is strong and game-specific.
- Purposeful: pass for HUD, partial for controls. The HUD surfaces serve active play; the controls help is too static and not available from pause.
- Meaningful: pass for telemetry and minimap; partial for settings/control affordances.
- Space-aware: pass for validated mobile HUD; landing controls panel is acceptable.
- Brand-consistent: pass. Glass/cyan elevated sci-fi language is coherent.
- Goal-effective: partial. The player can start, pause, travel, craft, build, and read vitals, but cannot reliably discover all controls from gameplay.
- Production-language ready: partial. Existing text is concise, but the controls menu lacks full mode coverage and production binding states.

## Evidence-Based Defects

- Static Controls panel exists only in landing menu.
- Pause menu lacks Controls/Bindings.
- Binding/remap states are absent.
- Mode-specific controls are scattered across components.
- HUD mobile layout should be preserved; it is not the main defect.
