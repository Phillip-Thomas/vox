# Handoff

## Accepted Design

Add a `Co-op` panel to the landing menu as a peer to Controls, Graphics, and Audio.

## Component Mapping

- Extend `LandingMenu.tsx` panel selector with `coop`.
- Add `CoopPanel.tsx` for create/join/status UI.
- Add multiplayer socket utilities under `main/src/game/`.

## Token Mapping

- Panel surface: `glassPanel`.
- Positive status: `theme.color.good`.
- Errors: `theme.color.danger`.
- Action buttons: existing accent gradients and compact ghost controls.
- Inputs: dark glass fields with cyan borders.

## State Matrix

- Disabled: env flag off.
- Config missing: flag on but Firebase/server URL incomplete.
- Idle: ready to create or join.
- Busy: signing in, connecting, creating, joining.
- Connected: room id, invite code, player id, world id.
- Error: visible message and reconnect action.

## Responsive Notes

The panel must fit inside the existing lower-left menu column at mobile widths. Buttons and inputs wrap vertically below 520px.

## Acceptance Criteria

- Offline Play still works.
- Co-op panel is hidden unless selected.
- Create/join calls the real WebSocket protocol.
- The socket connection persists after Play.
- Typecheck, tests, and build pass.
- Desktop and mobile screenshots reviewed.
