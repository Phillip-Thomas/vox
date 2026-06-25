# Implementation Plan

1. Add a protocol-level `room_roster` server message to client and server validators.
2. Add server helper to summarize room members with connected/local-independent state.
3. Broadcast roster after room join and after socket close/session removal.
4. Extend `MultiplayerSessionSnapshot` with roster players.
5. Render roster rows and better status/error text in `CoopPanel`.
6. Render compact player count in `MultiplayerStatusBadge`.
7. Update tests for protocol validation and roster broadcast.
8. Update checklist evidence and run verification.
