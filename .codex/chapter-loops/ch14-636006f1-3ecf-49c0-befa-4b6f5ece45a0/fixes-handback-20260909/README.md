Chapter14 fixes implemented and verified on hardware GPU.

- Manual:8 accepted ordinary actions, complete chapter path.
- Real Continue:equal saved state,6 newly accepted actions, complete chapter path.
- Pause/Resume:6 newly accepted actions after interruption, complete chapter path.
- Both interruption recordings:hardware renderer, decodable audio/video and cleanup PASS.
- Motion:6 calibrations across42 walk actions; continuous movement and route-aware diagonal steering.
- Continue:unfinished chapter takes precedence over historical completion; shell enters playing; staged prior route is restored through existing actor/world validation; visible pointer-capture recovery is clicked by the driver.
- Review entry:ordinary earned checkpoint, unchanged saved values, installed Chromium/Playwright paths. Final review remains pending.

Tests:42 menu/story,45 restore/state,155 transport; TypeScript PASS.

Evidence: `/home/thomasphillip/Projects/vox/.codex/chapter-loops/ch14-636006f1-3ecf-49c0-befa-4b6f5ece45a0/evidence/verify-final-377e625e-73de-4c76-8e56-fe2b635737c2`.
Preview: http://127.0.0.1:46451/?story=ch13-survey&journeyprobe=1&profile=HIGH (supported CommonGround diagnostic entry leading into Chapter14).
Earned Chapter14 browser profile: `/home/thomasphillip/Projects/vox/.codex/chapter-loops/ch14-636006f1-3ecf-49c0-befa-4b6f5ece45a0/fixes-handback-20260909/player-storage.json` (normal Continue at ch14-scar).

Broader certification remains BLOCKED_INFRASTRUCTURE: the fresh full-story run stayed at Chapter1's camera-crossing objective for 360 seconds before its600-second session deadline. It never reached Chapter14. AV capture and the final independent reviews/release remain pending. Failed evidence retained; no publication.

Original clock 2026-09-08T20:33:28.000Z to advisory target 2026-09-09T04:33:28.000Z; unchanged. Recorded role usage {'roleLaunches': 12, 'modelTurns': 323, 'inputTokens': 646604, 'cacheReadTokens': 20528640, 'outputTokens': 100201}. Builder7 terminal usage remains unknown; root engineering excluded. No active goal token budget.
