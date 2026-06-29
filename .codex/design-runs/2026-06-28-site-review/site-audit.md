# Site Audit

## Executive Assessment

Paravoxia's UI and HUD are visually strong and product-specific. The current problem is not taste or surface polish. The problem is production completeness: control semantics, mode transitions, help/bindings availability, settings reachability, modal focus behavior, and state coverage.

The best path is `refactor-existing`, not `build-from-scratch`.

## High-Impact Findings

### P0 - Controls and bindings are not production-ready

Evidence:

- Landing has a static Controls panel with only six basic rows.
- Pause menu has Star Map, Graphics, and Audio, but no Controls section.
- Actual controls are split across `KeyboardControls`, App-level raw key handlers, `EfficientPlayer`, `ShipController`, `TouchControls`, and multiple HUD hint components.
- Hidden or under-exposed actions include `C` fabricator, `B` build, `H` hide HUD, `G` consume, `X` deconstruct, build digit selection, build rotate, ship roll, launch/land, deep-space warp charge, and swim descend.

Risk:

- Players can get stuck or miss core systems.
- Any future binding change will drift across help copy, touch labels, and runtime behavior.
- Remapping cannot be implemented safely until there is one canonical action registry.

Right-sized fix:

- Add an input/action registry first.
- Rebuild landing controls, pause controls, HUD hints, touch labels, README controls, and tests from that registry.
- Ship a read-only mode-aware Controls panel before full remapping if speed matters.

### P1 - Pause menu is missing the most important settings surface

Evidence:

- Pause is always available during play and already owns settings/travel.
- It has no Controls tab/section.

Risk:

- The user asked for a readily available control bindings menu; landing-only controls do not satisfy that.

Right-sized fix:

- Add a Controls section to `PauseMenu`.
- Add a HUD quick-action `?` or equivalent help button that opens pause directly to Controls, or opens a lightweight controls drawer with a "Bindings" path.

### P1 - Mode-aware guidance is incomplete

Evidence:

- Cockpit readout is mode-aware.
- Target reticle is mode-aware.
- Build indicator is mode-aware.
- Landing Controls panel is not mode-aware.
- Pause menu exposes no mode-aware controls.

Risk:

- Controls change materially between on-foot, build mode, parked ship, descent, deep space, fabricator, and touch.

Right-sized fix:

- Controls UI should group actions by mode:
  - Global
  - On foot
  - Survival/interaction
  - Build mode
  - Fabricator
  - Ship parked
  - Ship flight/descent
  - Deep space/warp
  - Touch equivalents

### P1 - Modal and pointer-lock contracts need hardening

Evidence:

- Fabricator intentionally releases pointer lock.
- Pause opens on pointer-lock loss.
- Escape closes Fabricator but also participates in pointer-lock pause.
- Resume reacquires pointer lock.

Risk:

- A controls binding menu with key-capture can easily trigger pause, close itself, or fail to return control if focus handling is loose.

Right-sized fix:

- Define a shared modal controller contract before binding capture:
  - open reason
  - cursor/pointer-lock mode
  - return-focus target
  - Escape behavior
  - key-capture suppression
  - resume behavior

### P2 - HUD preferences exist as hidden controls, not product settings

Evidence:

- Desktop HUD visibility toggles with `H`.
- The HUD quick-action cluster does not expose HUD visibility or compactness.

Risk:

- Useful quality-of-life behavior is undiscoverable.

Right-sized fix:

- Add HUD preferences to Pause: HUD visible, compact HUD, maybe opacity scale.
- Keep the live HUD uncluttered; use pause/settings for preferences.

### P2 - In-game co-op management is landing-heavy

Evidence:

- Co-op panel lives in landing when enabled.
- In-game HUD has a status badge.
- Pause menu does not expose room code, roster, copy invite, reconnect/disconnect.

Risk:

- Players in a room need production recovery paths after gameplay begins.

Right-sized fix:

- Add Co-op section to Pause when co-op is configured or connected.
- Reuse `CoopPanel` states or extract a compact in-game room panel.

### P2 - State coverage needs formal acceptance criteria

Needed states:

- Controls: default, listening for key, conflict, invalid/reserved key, duplicate binding, saved, reset defaults, restore previous, keyboard/touch tabs.
- Pause: route from pointer-lock loss, HUD button, help button, resume, quit, travel.
- Fabricator: empty inventory, insufficient materials, craft success, no stations if that ever becomes possible.
- Co-op: config missing, auth fail, reconnecting, closed, connected, invite copied.
- HUD: low vitals, empty inventory, overflow inventory, build blocked, no target, underwater, flight, deep space, disconnected co-op.

## Visual/UX Assessment

### What is already working

- Landing menu has a strong identity and uses the actual game render as the visual asset.
- The current HUD reads as a game interface, not a web dashboard.
- Top-left suit telemetry is a good anchor.
- Mobile thumb lanes are sensible and previously validated.
- Build mode on mobile is treated as a real editor, not just keyboard hints.

### What should not change now

- Do not redesign the rendering scene, shader style, trees, grass, fauna, terrain, or water as part of this UI/HUD pass.
- Do not replace the HUD system with a general component library.
- Do not add tutorial-card clutter into the live game viewport.

## Technical Assessment

The first implementation should be a small shared foundation:

- `src/game/input/controlBindings.ts`
- `src/components/ui/ControlsPanel.tsx`
- `src/components/ui/ControlsBindingRow.tsx` if needed
- tests for registry uniqueness, conflict rules, mode filtering, and touch labels

Then wire:

- `App.tsx` `KeyboardControls` map from registry
- `LandingMenu` Controls panel from `ControlsPanel`
- `PauseMenu` Controls section from `ControlsPanel`
- `TouchControls.model.ts` labels from registry where practical
- `BuildIndicator`, `CockpitReadout`, and `TargetReticle` hints from registry or a small mode-hint selector

Full remapping should come after the read-only registry ships, unless the user wants it all in one deeper pass.
