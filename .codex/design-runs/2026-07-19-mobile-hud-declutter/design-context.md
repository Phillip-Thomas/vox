# Design Context Contract

## Hard Guardrails

- Paravoxia is a first-person survival/exploration game; the world, not the HUD, is the primary visual surface.
- Preserve the current desktop objective card and desktop controls.
- Directional markers, the crosshair, contextual interaction prompts, and critical survival warnings stay immediately visible.
- Do not regress the dirty touch-token, consume-button, caption-placement, or marker-collision work already in this checkout.
- Mobile touch targets remain at least 44px, honor device safe areas, expose accessible names/focus, and release synthesized input before any blocking panel opens.
- A blocking mobile panel must pause story/physics input, unmount touch controls, close on Escape/backdrop, trap focus, and restore focus.
- Use the existing elevated-sci-fi glass, cyan, mono telemetry, and shared z-index bands. No new bitmap assets or live-service badge clutter.

## Creative Brief

- Tone: a quiet field suit, not a debug dashboard.
- Density: sparse by default; detail appears only when requested.
- Interaction: one tap to inspect, one tap/backdrop/Escape to return to the world; one navigation level.
- Primary controls remain in thumb zones. Information and utilities stay in a compact top rail or temporary sheet.
- Preserve progression confidence: hiding the journal must never hide where to go.

## Open Field

- Mobile objective trigger placement and visual treatment.
- Mobile vitals summary treatment and expanded state.
- Grouping of Build, Fabricator, and Pause.
- Sheet composition, visible labels, hierarchy, and status language.

## Quality Config

- Exploration depth: `3`
- Approval threshold: `4.75 / 5`
- Category floor: `4.3 / 5`
- Execution budget: `standard`
- Current staged gate: `final`
- Human taste checkpoint: self-selected from the user's explicit request; later playtest review invited.
- External references: allowed and used for interaction-density principles.
- Claude second opinion: risk-triggered; not triggered at direction selection.
- Canonical preview URL: `http://127.0.0.1:5173/`
- Server ownership: no existing server was found; Codex started Vite session `11920`.

## Reference Policy

| Reference | Relevance | Principle borrowed | Explicitly not copying |
| --- | --- | --- | --- |
| Epic, Designing for Mobile | Mobile HUD hierarchy | 5–6 active controls, context-adaptive HUD, thumb zones, collapsible information | Fortnite styling or game loop |
| Fortnite HUD Layout Tool | Player comfort | Ship a clean default that can later support tuning | Requiring users to repair a bad default |
| Warzone Mobile controls | Touch action hierarchy | Presets and secondary controls behind a control surface | Dense combat-button constellations |
| Diablo Immortal UI/accessibility | Viewport and legibility | Protect the viewport; keep touch targets legible | Live-service menu density |

## Stop Conditions

- Mobile closed state no longer reserves the full objective-card lane.
- Objective details remain one tap away while the marker remains live.
- Full vitals and secondary system actions are on demand.
- Portrait, landscape/tablet, and desktop screenshots pass; interactions and focused tests pass.
- No high-severity or unaccepted medium goal, interaction, accessibility, or visual defects remain.

## Gate

- Hard guardrails separated from creative brief: `pass`
- Open field broad enough: `pass`
- Quality config recorded: `pass`
- Reference policy recorded: `pass`
- Stop conditions recorded: `pass`
