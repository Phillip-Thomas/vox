# Design Handoff

## Accepted Direction

- Mobile persistent layer: compact suit summary, journal trigger, collapsed inventory trigger, single systems trigger, marker, immediate prompts, joystick, contextual actions.
- Mobile journal: one-level bottom sheet with full authored objective copy and route health.
- Desktop: preserve current card, vitals, inventory, and quick actions.
- No new art assets; use existing elevated-sci-fi tokens and lightweight CSS glyphs.

## Component Mapping

| Design element | Component | Change |
| --- | --- | --- |
| Journal trigger/sheet | `StoryGuidanceHud` | Touch-only compact trigger and accessible modal; desktop card retained |
| Objective/caption collision | `storyHudLayout` | No full-card reservation on touch |
| Suit summary | `VitalsMeter` | Touch defaults compact; full telemetry expands on demand |
| Inventory | `InventoryPanel` | Keep compact default and align below compact rail |
| Systems trigger/menu | `HudCornerActions` | Touch-only single trigger plus Build/Fabricator/Pause menu |
| Input pause | `App` / `StoryOverlays` | App owns journal-open state; pauses director/physics and unmounts touch controls |
| Layer order | `Crosshair` | Move into shared HUD z-band below menus |

## State Matrix

| State | User sees | Behavior | Evidence |
| --- | --- | --- | --- |
| Closed | Compact rail and controls | World fully playable | Mobile portrait + landscape |
| Journal | Objective sheet | World/story frozen, focus trapped | Open sheet screenshot + flow |
| Missing marker | Warning dot/label + recalibration copy | Marker remains required/health visible | Component/probe |
| Suit expanded | Full telemetry panel | Temporary, no permanent footprint | Mobile state screenshot |
| Systems expanded | Build/Fabricator/Pause menu | One level; gated actions only | Mobile state screenshot |
| Long copy | Scrollable bounded sheet | Safe-area contained | 320x568 stress |
| Desktop | Existing full HUD | Unchanged | Desktop screenshot |

## Acceptance Criteria

- Closed mobile journal is a 44px+ trigger, not a full card.
- Exactly one objective owner preserves the existing aria/data contract.
- Opening journal releases held input, pauses story/physics, hides touch controls, and supports Escape/backdrop/focus return.
- Mobile captions/marker no longer reserve the 150px objective fallback.
- Full vitals and system actions are on demand; critical status/marker remain visible.
- No desktop visual/behavior regression.
- Focus, safe-area, reduced-motion, targeted tests, typecheck, and screenshots pass.

## Known Risks

- Short landscape viewports need bounded sheet scrolling.
- Current action cluster still exposes four gameplay actions; contextual action reduction is a separate control-design pass.

## Gate

- Mapping, states, language, responsiveness, assets, and acceptance criteria: `pass`.
