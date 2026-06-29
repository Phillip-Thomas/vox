# Site-Wide UI/HUD Plan

## Recommendation

Use `site-wide-execution` in `refactor-existing` mode.

The existing UI/HUD should be preserved and extended. The app does not need a visual rebuild. It needs a production input/settings foundation and a few player-facing quality-of-life surfaces.

## Phase 1: Canonical Controls Registry

Create a single source of truth for player actions.

Suggested file:

```text
main/src/game/input/controlBindings.ts
```

Data shape should cover:

- action id
- runtime action name, if mapped through Drei `KeyboardControls`
- default keyboard codes
- display label
- touch label/equivalent
- category/mode
- whether remappable
- whether hold/tap
- conflict group
- reserved/system flag
- visibility in landing, pause, HUD hints, build, flight, touch

Initial groups:

- Global: Pause/Star Map, HUD visibility, Resume/Back.
- On foot: Move, Look, Jump/Jetpack, Sprint, Mine/Harvest, Interact, Consume, Reset.
- Build: Toggle Build, Place, Remove, Rotate, Select piece, Select material when implemented.
- Fabricator: Open/Close, Craft, Back.
- Ship parked: Launch, Exit ship.
- Ship flight/descent: Thrust, reverse thrust, boost, roll left/right, land, look.
- Deep space: target lock, hold forward to warp.
- Touch: joystick, drag look, USE, MINE, JUMP, PLACE, REMOVE, ROT, THR, LAND, roll.

Tests:

- all action ids unique
- default key conflicts intentional and mode-scoped
- display labels present
- every remappable action has a default
- every visible action has a category
- touch model can be derived or cross-checked

## Phase 2: Shared Controls Panel

Create a reusable panel for landing and pause.

Suggested files:

```text
main/src/components/ui/ControlsPanel.tsx
main/src/components/ui/ControlsPanel.model.ts
main/src/components/ui/ControlsPanel.model.test.ts
```

Behavior:

- Tabs or segmented controls for Keyboard and Touch.
- Mode filters: Essentials, On Foot, Build, Ship, System.
- Read-only defaults in first pass.
- Plain action labels, compact key chips, and mode-specific notes.
- No verbose tutorial copy in the game viewport.

Wire it into:

- Landing Controls panel, replacing static rows.
- Pause menu as a new Controls section.
- Optional HUD quick button that opens pause directly to Controls.

## Phase 3: Readily Available In-Game Access

The control menu should be reachable while playing.

Recommended path:

- Add a small `?` control to `HudCornerActions`.
- On desktop and touch, the button opens Pause directly to Controls.
- Do not create a large live HUD overlay unless the game is paused.
- Keep `B`, `C`, and `M` behavior intact for existing players.

Acceptance:

- From active gameplay, a player can reach controls in one click/tap.
- Returning from the menu reacquires pointer lock correctly on desktop.
- On touch, the controls menu does not leave synthetic keys stuck down.

## Phase 4: Key Remapping

After read-only controls are stable, add remapping.

Required states:

- listening for key
- duplicate key conflict
- reserved key rejection
- clear binding
- restore defaults
- save local profile
- unsaved changes
- remap disabled for non-remappable/system actions

Storage:

- localStorage with versioned schema.
- Migration strategy for future renamed action ids.

Runtime:

- `KeyboardControls` map must be generated from active bindings.
- Raw App/Ship handlers should read the binding resolver, not hardcoded `KeyC`, `KeyB`, etc.
- Touch labels stay separate unless touch customization is explicitly implemented.

## Phase 5: Production Quality-of-Life

Add these after controls foundation:

- Pause Co-op section when configured or connected.
- HUD preferences in Pause: visible, compact, opacity.
- Save status/recovery feedback if persistence fails.
- Modal focus/focus-return utility for Pause, Fabricator, Controls, Co-op.
- First-run or mode-transition hint system with strict suppression rules.
- Optional controller/gamepad data model, even if gamepad runtime is later.

## Non-Goals For This Plan

- Rendering changes.
- Procedural world art direction.
- Shader/post-processing polish.
- Replacing the HUD visual style.
- Rewriting game input from scratch.

## Acceptance Criteria

- Controls and pause screenshots at desktop and mobile.
- Landing controls and pause controls show the same defaults.
- Mode-specific actions are discoverable.
- Tests cover action registry and conflict rules.
- No pointer-lock regression when opening/resuming pause, fabricator, or controls.
- Mobile thumb lanes remain clear.
- No UI/HUD overlap regressions against the previously validated mobile HUD screenshots.
