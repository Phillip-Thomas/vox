# Implementation Plan

## Handoff Understanding

- Reclaim the mobile playfield with progressive disclosure while preserving all progression-critical guidance.
- Keep desktop unchanged and preserve existing dirty marker/caption/touch work.

## Code Mapping

- Modify: `StoryGuidanceHud.tsx`, `StoryOverlays.tsx`, `App.tsx`, `storyHudLayout.ts`, `VitalsMeter.tsx`, `VitalsMeter.model.ts`, `InventoryPanel.tsx`, `HudCornerActions.tsx`, `hudChrome.ts`, `Crosshair.tsx`.
- Add/update focused tests for journal presentation, compact layout, tool menu modeling, layer order, and pause ownership where feasible.
- Extend the browser capture/probe only if the existing selector contract cannot express both closed/open states.

## Ambition

- Level: `moderate`, depth `3`, budget `standard`, final gate.
- Complete means a coherent default hierarchy, not merely a smaller objective card.
- Intentionally unchanged: action mapping, desktop HUD, authored objective copy, and marker semantics. Joystick/action edge offsets may change only to prevent narrow-screen hit-region overlap.

## Validation

- Canonical preview: `http://127.0.0.1:5173/`, agent-owned Vite session `11920`.
- Focused Vitest suites, typecheck, build/verify proportional to touched shared HUD code.
- Browser: portrait closed/open, systems/suit state, 320x568 stress, landscape/tablet, desktop comparison; console/page errors.
- Adversarial screenshot critique followed by one patch loop.

## Gate

- Intent restated: `pass`
- Scope inspectable: `pass`
- Asset plan explicit: `pass`
- Validation matches risk: `pass`
