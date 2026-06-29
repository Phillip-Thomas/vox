# Implementation Plan

1. Add shared HUD chrome helpers for panels and buttons.
2. Add pure touch-control layout model and tests.
3. Restyle `VitalsMeter` as a top-left suit telemetry panel with value refs.
4. Allow `InventoryPanel` to be offset below the vitals stack.
5. Extract top-right build/craft/pause buttons from `App.tsx` into `HudCornerActions`.
6. Update `TouchControls` to use the model and remove Dive from normal mobile FPS controls.
7. Run focused tests, typecheck, and rendered screenshots.
8. Iteration 2: Fold Oxygen/Maw into `VitalsMeter`, remove standalone mounts, and make `InventoryPanel` collapsed-by-default with click-open contents.
9. Build, deploy to Firebase Hosting project `paravox-game`, and verify live asset hash on direct and custom domains.
10. Iteration 3: Fold Jetpack fuel into `VitalsMeter`, remove the standalone `JetpackMeter` mount/component, update screenshot proof, and verify.

## Risk Controls

- Preserve existing key codes.
- Do not change joystick dimensions or placement.
- Keep pointer events on action controls only.
- Keep rAF mutation pattern for vitals to avoid per-frame React churn.
