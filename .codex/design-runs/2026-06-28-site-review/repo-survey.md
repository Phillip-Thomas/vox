# Repo Survey

## Stack

- App root: `main/`
- Frontend: React 19, Vite, TypeScript.
- 3D/runtime: React Three Fiber, Drei, Three, Rapier.
- Tests: Vitest. No committed Playwright test suite, but local Playwright Core is available and prior run scripts use `/usr/bin/chromium-browser`.
- Styling: mostly inline React styles backed by shared tokens in `src/ui/theme.ts`; HUD chrome helpers live in `src/components/hud/hudChrome.ts`.
- Assets: audio files under `main/public/audio/music/`; no `main/src/assets` folder exists.

## Current UI Surfaces

- `src/components/ui/LandingMenu.tsx`
  - Live cinematic background over the actual world.
  - Panels: Controls, Graphics, Audio, optional Co-op.
  - Controls panel is static help copy, not a bindings system.
- `src/components/ui/PauseMenu.tsx`
  - Production pause/star-map/settings home.
  - Sections: Star Map, Graphics, Audio, Resume, Quit to Menu.
  - Does not currently include Controls or key bindings.
- `src/components/ui/CraftingPanel.tsx`
  - Fabricator modal, inventory-aware recipes, station grouping.
- `src/components/ui/CoopPanel.tsx`
  - Create/join invite flow, roster, status, disconnect.
- `src/components/hud/`
  - Vitals, inventory, build editor, minimap, cockpit readout, co-op badge, interaction prompt, mining progress, target reticle, crash flash, looked-at indicator, corner actions.
- `src/components/mobile/TouchControls.tsx`
  - Virtual joystick, full-screen look plane, action cluster.
  - The action grid is data-modeled in `TouchControls.model.ts`.

## Input Ownership

Input is currently split across several places:

- `App.tsx` `KeyboardControls` map owns base action names: movement, jump, reset, delete/mine, interact, deconstruct, sprint, eat, descend.
- `App.tsx` raw key handlers own `C` fabricator, `B` build mode, build `R` rotate, digit selection, `H` HUD visibility, ship exit `F`, and pointer-lock pause behavior.
- `EfficientPlayer.tsx` consumes Drei controls for movement, sprint, jump/jetpack, mining, build placement, deconstruct, context interaction, consume, reset, swim descend, and pose action publishing.
- `ShipController.tsx` consumes raw key events for Escape, Q/E roll, F land, Space launch, plus Drei controls for thrust and boost.
- `TouchControls.tsx` synthesizes keyboard and mouse events through `mobileInput.ts`.
- `LandingMenu.tsx`, `BuildIndicator.tsx`, `CockpitReadout.tsx`, and `TargetReticle.tsx` each contain their own visible key/hint copy.

This fragmentation is the main reason a production controls/bindings menu should be data-driven.

## Existing Strengths

- Strong first impression when the world render is ready: the menu over a live cube-world is memorable and product-specific.
- Recently validated mobile HUD is already in a strong place: top-left suit telemetry, collapsed inventory, clear thumb lanes, and compact action cluster.
- The build editor has distinct desktop and mobile treatments rather than pretending keyboard hints work on touch.
- The minimap, co-op badge, cockpit readout, target reticle, interaction prompt, and mining progress are product-specific HUD pieces, not generic web UI.
- Shared `theme.ts` and `hudChrome.ts` provide enough design vocabulary for controls/bindings work without a redesign.

## Existing Risks

- No canonical control registry. Defaults, labels, touch equivalents, mode availability, and visible help text can drift.
- No in-game Controls section in `PauseMenu`, even though pause is the correct always-available settings surface.
- No remapping flow, no conflict detection, no reset defaults, and no persisted user binding profile.
- Several user-facing shortcuts are hidden unless the player reads code or README: `C`, `B`, `H`, `G`, `X`, build digits, build rotate, ship roll, launch/land, HUD visibility.
- Some production states are not fully visible from screenshots or source: save status, failed persistence, failed audio unlock, co-op reconnect/error recovery from in-game pause, empty crafting categories, remap conflicts.
- Focus management for modal surfaces is not yet explicit. The app relies heavily on pointer-lock state, so modals need clear focus and escape contracts.

## Screenshot Evidence

- Current run screenshots:
  - `screenshots/landing-ready-desktop.png`
  - `screenshots/landing-controls-desktop.png`
  - `screenshots/landing-graphics-desktop.png`
- Prior validated HUD screenshots:
  - `../2026-06-28-mobile-hud-controls/screenshots/desktop-hud.png`
  - `../2026-06-28-mobile-hud-controls/screenshots/mobile-hud.png`
  - `../2026-06-28-mobile-hud-controls/screenshots/mobile-inventory-open.png`

## Verification Notes

- Existing server reused: `127.0.0.1:5173`, Vite from `vox/main`.
- Playwright MCP failed because it expects Chrome at `/opt/google/chrome/chrome`.
- A local Chromium screenshot run produced landing screenshots but was too slow/fragile for the full matrix while another agent was active.
- The review therefore uses current source inventory plus current landing screenshots and prior validated HUD screenshots.
