# Implementation Plan

1. Add protocol/client helpers for converting state-server URLs and opening authenticated WebSocket sessions.
2. Add a module-level multiplayer session controller with subscription state.
3. Add `CoopPanel` to the landing menu.
4. Add a small in-game connection badge so status remains visible after entering play.
5. Add focused tests for URL conversion, config gating, and controller behavior where practical.
6. Run `npm run verify` in `main/`.
7. Run screenshot verification for desktop and mobile menu states.
