# Page Priority Matrix

| Priority | Surface/workstream | Importance | Current quality | Risk | Reuse value | Recommendation |
| ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Controls/bindings foundation | 5 | 2 | 4 | 5 | Start here. Create canonical action registry, then read-only controls UI. |
| 2 | Pause Controls section | 5 | 2 | 3 | 5 | Add readily available Controls/Bindings from pause. |
| 3 | HUD quick access to controls | 5 | 3 | 3 | 4 | Add a small help/controls affordance that opens pause to Controls or a lightweight panel. |
| 4 | Binding remap flow | 4 | 1 | 5 | 5 | Implement after registry; include conflicts, reserved keys, reset defaults, local persistence. |
| 5 | Mode-aware hint unification | 4 | 3 | 3 | 4 | Pull build/cockpit/warp/touch hints from the same action metadata. |
| 6 | Pause Co-op management | 3 | 2 | 3 | 3 | Reuse `CoopPanel` or extract in-game room state. |
| 7 | HUD preferences | 3 | 2 | 2 | 3 | Expose HUD visibility/compactness/opacity in pause; keep live HUD clean. |
| 8 | Modal focus and pointer-lock hardening | 4 | 3 | 4 | 4 | Add as part of controls/remap, because key capture depends on it. |
| 9 | Fabricator production states | 3 | 4 | 2 | 2 | Add empty/error/success polish after controls foundation. |
| 10 | Landing controls refresh | 3 | 3 | 2 | 4 | Replace static landing controls with the shared Controls panel. |

## First Surface To Run Through Full Design Loop

`Controls and Bindings Surface`

Reason:

- It directly addresses the user request.
- It is a foundation for landing, pause, HUD hints, touch controls, README/docs, tests, and future gamepad support.
- It can be implemented without touching rendering/procedural source files.

## Suggested Execution Budget

- First pass: `standard`
- If full remapping is included in the same pass: `deep`

## Interim Gates

- First-pass gate: read-only controls panel available from landing and pause, generated from registry, with tests.
- Refined gate: mode-aware groups, touch labels, HUD quick access, and no pointer-lock regressions.
- Final gate: remapping with conflict states, local persistence, reset defaults, screenshot matrix, and keyboard interaction proof.
