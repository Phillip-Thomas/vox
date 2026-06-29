# Repo Survey

## Stack

- Framework: React 19 with Vite and `@react-three/fiber`.
- Styling: Mostly inline React style objects plus shared tokens in `src/ui/theme.ts`.
- Component system: Local components under `src/components/hud` and `src/components/mobile`.
- Testing: Vitest, TypeScript typecheck, Vite build.
- Screenshot tooling: Existing repo-local `playwright-core`; Playwright MCP is discoverable but Browser plugin is absent.

## Routes and Surfaces

- Target route: `/?agent=1&world=0,0` for deterministic in-game validation.
- Adjacent surfaces: desktop HUD, flight HUD, build-mode HUD, pause/crafting overlays.
- Navigation entry points: Existing dev harness enters playing state through agent/game bridge.

## Existing UI System

- Components to reuse: `VitalsMeter`, `InventoryPanel`, `TouchControls`, `CockpitReadout`, top action buttons in `App.tsx`.
- Tokens to reuse: `theme`, `glassPanel` from `src/ui/theme.ts`.
- Layout patterns: Top-right pause/build/craft buttons, top-left inventory, center meters, bottom-left joystick, bottom-right touch actions.
- Interaction patterns: Mobile controls synthesize keyboard/mouse events through `mobileInput.ts`.
- Current defect: `VitalsMeter` sits bottom-left and competes with the joystick; mobile action buttons include Dive and read as generic black circles.

## Brand and Asset Inventory

- Brand identity signals already present: Deep space backdrop, cyan glass HUD, compact telemetry, monospace labels.
- Logo/mark assets: None needed for gameplay HUD.
- Image/video assets: None relevant; HUD should not add bitmap assets.
- Audio assets: Present but irrelevant to this surface.
- Candidate assets: Existing token palette and glass style.
- Assets to avoid: New decorative art or icons that increase clutter.

## Data and State

- Data models: `VitalsState`, inventory entries, touch control mode, build mode.
- State ownership: Vitals are polled via rAF; inventory subscribes to `inventorySystem`; mobile controls synthesize key events.
- Synthetic stress data needed: varied vitals and mobile viewport screenshots.

## Constraints and Opportunities

- Must preserve: Joystick position, touch input bridge, desktop keyboard controls, build/flight controls.
- Can improve: Shared HUD style helpers, top-left survival/inventory stack, button cluster model, action labels.
- Risks: Top-left vitals can collide with inventory or minimap if offset is not explicit; mobile buttons can block look surface if pointer regions grow too far.

## Gate

- Components/tokens understood: `pass`
- Brand identity understood: `pass`
- Asset folders inspected: `pass`
- Candidate assets selected or rejected with reason: `pass`
- Data/state understood: `pass`
- Constraints documented: `pass`
