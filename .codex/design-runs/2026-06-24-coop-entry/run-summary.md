# Run Summary

Status: first-pass complete.

Surface: landing co-op entry.
Run mode: single-surface.
Budget: standard.
Canonical preview URL: `https://paravoxia.com/`

## What Changed

- Added persistent client-side multiplayer session state.
- Added WebSocket protocol helper for `/play`.
- Added landing menu `Co-op` panel gated by `VITE_PARAVOXIA_COOP`.
- Added create-room, join-room, invite-code, copy, disconnect, and connection-status UI.
- Added in-game co-op status badge.
- Fixed mobile footer overlap when a compact menu panel is open.

## Checks

- Focused multiplayer tests: 11 passing.
- Full `main/` verification: typecheck, 64 test files, 419 tests, production build.
- Screenshot verification: desktop and mobile co-op panel config state.
- Live screenshot verification: desktop/mobile ready state and created-room state on `https://paravoxia.com`.
- Cloud Run smoke: two anonymous Firebase users created/joined one room through `paravoxia-state-server`.
- Hosting deploy: `https://paravoxia.com` serves bundle `index-DLKF3Lqq.js` with co-op enabled.

## Remaining

- Snapshot/event application into gameplay.
- Command dispatch adapter and authoritative online gameplay state.
- Reconnect UI and player list.
