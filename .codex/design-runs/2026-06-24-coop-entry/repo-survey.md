# Repo Survey

## Existing Surface

- `main/src/components/ui/LandingMenu.tsx` owns the first-screen menu over the live cinematic canvas.
- Existing menu panels use `Panel`, `GhostLink`, `Row`, `theme`, and `glassPanel`.
- App state lives in `main/src/state/appState.ts`; `enterPlaying()` transitions into the game.
- Firebase anonymous auth seam exists in `main/src/game/multiplayerAuth.ts`.
- State server protocol exists in `server/src/protocol.ts`; create/join is supported over WebSocket `/play`.

## Tokens And Components

- Use `theme.font.ui`, `theme.font.mono`, `theme.color.accent`, `theme.color.textDim`, `theme.glass`.
- Current controls are inline styles inside `LandingMenu`; extend locally rather than introducing a styling framework.
- No icon package exists in `main/package.json`; do not add one for this small slice.

## Brand And Assets

- Main visual asset is the rendered game canvas behind the menu.
- Public assets currently include audio only.
- Paravoxia identity is elevated sci-fi, glass cockpit UI, cyan accent, compact telemetry.

## Constraints

- Vite + React 19 + TypeScript strict mode.
- No persistent multiplayer gameplay wiring yet.
- Offline single-player must remain unchanged.
