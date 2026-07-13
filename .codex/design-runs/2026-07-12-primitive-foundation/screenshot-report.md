# Screenshot And Browser Report

## Attempted Matrix

| State | Route | Result |
| --- | --- | --- |
| Primitive Fabricator on POTATO | `?profile=POTATO` | reached Play readiness; blocked at headless pointer-lock activation |
| Persisted downed recovery | `?profile=POTATO` | not run after readiness block |

## Observations

- Chromium launched successfully.
- The page reported no uncaught exceptions.
- The initial 30-second attempt did not reach readiness; an extended bounded attempt
  reached an enabled `Play Now`.
- Playwright's native click stalled while performing the pointer-lock gesture.
- Untrusted DOM activation did not transition the app, so it was not accepted as a substitute.
- The host has long-lived Chromium render workers outside this checkout occupying
  the shared SwiftShader path; none were terminated.
- No screenshot is accepted as proof from this attempt.

## Required Re-run

Run `node tools/primitive-loop-probe.mjs` from `main/` with a headed trusted click
or a browser harness that explicitly owns pointer lock, then complete one headed
clean-save gather/craft/build/night/recover/reload journey.
Pointer lock, player feel, blocked feedback, and restored shelter spawn require human
approval before Batch 2 closes.
