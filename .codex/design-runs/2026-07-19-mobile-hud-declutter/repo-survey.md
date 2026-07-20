# Repo Survey

## Stack

- React 19, Vite, TypeScript, Three.js / React Three Fiber.
- Inline style objects plus `src/ui/theme.ts` and `src/components/hud/hudChrome.ts`.
- Vitest; `playwright-core` browser probes; repo `verify` chain.

## Current Surface

- At 390x844, the objective card is about 354x103 and vitals about 216x136. Together with the 132px joystick and 152px action cluster, non-overlapping HUD rectangles cover roughly one third of the viewport before captions/markers.
- `StoryGuidanceHud.tsx` owns objective content and measurement.
- `storyHudLayout.ts`, `StoryCaptions.tsx`, and `FreeMarker.tsx` reserve/collide around the measured objective lane.
- `VitalsMeter.tsx` owns discovered survival telemetry; `InventoryPanel.tsx` already defaults collapsed.
- `HudCornerActions.tsx` permanently exposes up to three 44px Build/Fabricator/Pause buttons.
- `TouchControls.tsx` is a full-screen synthetic-input layer and releases held keys on unmount.

## Existing Patterns To Reuse

- Glass/cyan/mono tokens from `theme.ts` and `hudChrome.ts`.
- Accessible modal pattern from `CraftingPanel.tsx`: focus capture/restore, sibling inerting, Escape and Tab trap.
- Existing 44px HUD button primitive.
- Existing objective `data-objective-*` contract and `aria-label="Current story objective"` required by browser probes.

## Assets

- No bitmap or external visual assets are needed. CSS-native line/glyph treatments are more legible and avoid bundle/performance cost.

## Risks

- Hiding the objective without changing `storyHudLayout` leaves a phantom 150px lane.
- A local journal without App pause ownership can leave synthesized WASD held and let the story advance beneath the modal.
- `Crosshair.tsx` uses z-index 1000, above the shared menu band.
- The touched files already carry unrelated user changes; patches must be narrow.

## Gate

- Components/tokens understood: `pass`
- Brand/assets understood: `pass`
- Data/state understood: `pass`
- Constraints documented: `pass`
