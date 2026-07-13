# Design Handoff

## Accepted Direction

- Thesis: a mode-aware field reference and interruption shell.
- Preserve: Story content, audio, binding map, movement/ship feel, current tokens.
- Reject: new narrative, audio work, remapping, tutorial cards, nested settings maze.

## Component Mapping

| Element | Existing | Change |
| --- | --- | --- |
| Control data | fragmented input consumers | add pure read-only control model |
| Control rows | Landing `Row` | add shared `ControlsReference` renderer |
| Pause | `PauseMenu` | story travel gate, controls, dialog focus |
| Narrative clock | raw R3F/performance clocks | add pause-aware Story clock |
| Completion | none | add non-narrative completion panel |
| Physical pause | `EfficientScene`/controllers | pause Rapier and input integration |

## State Matrix

| State | User sees | Behavior |
| --- | --- | --- |
| Active Story pause | location, current controls, settings | no Star Map; Story/physics frozen |
| Sandbox pause | Star Map, current controls, settings | travel remains available |
| Completed arrival | Story Demo Complete | continue, menu, or replay |
| Completed landing | Return to Site + Replay Story | explicit completed-save truth |
| Replay confirmation | destructive-scope warning | confirm or cancel |

## Language Audit

- Existing story lines: untouched.
- Audio language: untouched.
- `Pause & star map` becomes context-truthful `Pause` where travel is absent.
- Completion copy states product status only.

## Responsive And Accessibility Notes

- Pause panel scrolls within the viewport.
- Landing content can scroll at zoom/narrow height.
- Resume receives initial modal focus; Tab stays inside; Escape resumes.
- Global focus-visible treatment and scalable viewport are required.
- Touch controls unmount while paused.

## Acceptance Criteria

- A1/A2 timing and captions do not advance during pause.
- Active Story cannot invoke any world travel callback.
- Controls are accurate for landing, on-foot, build, ship, and touch.
- Desktop bindings remain byte-for-byte unchanged.
- Completed save offers continue/menu/replay with confirmation.

## Gate

- Component/token/language/state/responsive mapping: `pass`
- Guardrails and acceptance criteria: `pass`
