# Repo Survey

## Relevant Surfaces

- `main/src/components/ui/CoopPanel.tsx`: landing menu co-op create/join/invite UI.
- `main/src/components/hud/MultiplayerStatusBadge.tsx`: in-game co-op connection badge.
- `main/src/game/multiplayerSession.ts`: client session state, reconnect, world-event application, pose forwarding.
- `main/src/game/multiplayerClient.ts`: browser WebSocket protocol validation.
- `server/src/protocol.ts`: Cloud Run WebSocket protocol validation.
- `server/src/rooms.ts`: room members and active sessions already exist server-side.
- `server/src/stateServer.ts`: join/disconnect handlers and room broadcasts.

## Existing Capabilities

- Rooms already track durable `members` and active `sessions`.
- Server already broadcasts room messages to connected sessions.
- Client already subscribes UI to multiplayer session snapshots.
- Remote avatars are render-only and use pose state.
- Player identity has `displayName` in both client and server protocol types.

## Constraints

- The current client snapshot does not include roster data.
- The existing protocol has no explicit room roster message.
- The menu panel is compact and already shares space with play/settings controls.
- The in-game HUD must not compete with vitals, inventory, minimap, or touch controls.
