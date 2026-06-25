# Critic Report

Scope: co-op UX closeout for player identity, roster visibility, status copy, and verification ergonomics.

Defects checked:

- Host and joiner must both receive player roster state.
- Roster cannot rely only on local fallback state after a second player joins.
- Remote avatars need player labels, but labels must remain compact and not dominate the scene.
- Error copy needs to distinguish auth failure, missing rooms, version mismatch, and unavailable server.
- Local validation should not depend on Firebase auth latency when the state server is intentionally auth-disabled.

Resolved:

- Added server `room_roster` broadcasts on create, join, resume, and disconnect.
- Added client roster snapshot state and menu roster rendering.
- Added remote avatar nameplates from roster display names.
- Added compact `shortPlayerId` fallback labels.
- Added dev-only `VITE_PARAVOXIA_LOCAL_AUTH=1` for local browser validation against auth-disabled state servers.

Deferred:

- Host kick/ban controls remain out of Phase 1 scope.
- Ping/marker UI is explicitly deferred.
- Capture harness could be moved into a formal Playwright test once the app has a lighter test scene or render toggle.
