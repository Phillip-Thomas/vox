# Implementation Plan

## Handoff Understanding

This pass turns pause and completion into a safe, truthful demo shell. It does
not redesign gameplay or add content.

## Code Mapping

- Add a pause-aware Story clock and split narrative time from raw world time.
- Gate director/autopilot, Rapier, on-foot actions, ship integration, and touch
  controls behind the active pause state.
- Add defensive Story travel rejection plus conditional Pause Star Map rendering.
- Add pure controls-reference data, tests, and a shared renderer.
- Add completed-demo panel and replay reset API with explicit confirmation.
- Restore browser zoom, focus-visible, reduced motion, and modal focus behavior.

## Ambition And Budget

- Ambition: moderate product-shell completion.
- Exploration depth: `1`.
- Execution budget: `standard`, one implementation plus critique/patch loop.
- Intentionally unchanged: audio, story text/timing values, bindings, renderer,
  world art, gameplay feel.

## Validation

- Targeted Vitest: Story timing/clock/state, controls model, progression reset.
- Full `npm --prefix main run verify` after targeted tests.
- Browser flows: Story pause, sandbox pause, completed-save landing, keyboard focus.
- Screenshots: landing controls, Story pause, sandbox pause, completion, mobile.
- Canonical preview: `http://127.0.0.1:5201/`, existing server reused.

## Gate

- Scope inspectable: `pass`
- Validation proportional to risk: `pass`
- No asset/audio/content dependency: `pass`
