# Design Handoff

## Accepted Direction

- Selected thesis: Suit Telemetry Stack.
- Exploration depth: `3`
- Rejected direction(s): Edge Split Minimal, Bottom Command Console.
- Product rationale: Gameplay remains primary while survival state and mobile actions become clear, thumb-safe, and coherent.
- Visual rationale: Shared cyan glass HUD language, compact telemetry panel, stronger button hierarchy.
- Goal effectiveness rationale: Vitals move away from joystick; normal mobile actions reduce to three; Jump anchors the bottom-right corner.
- Asset strategy: No new assets; use existing theme tokens.
- Hard guardrails respected: Joystick stays put; Dive is removed from normal mobile FPS controls; touch/key bridge remains.

## Layout Structure

- Top-left: Suit HUD glass panel with health, food, water, temp, stamina, oxygen, jetpack fuel, and optional Maw charge.
- Below top-left: Inventory starts as a compact `INV` button and expands only on click.
- Top-right: Build/craft/pause buttons use shared HUD button chrome.
- Bottom-left: Existing joystick unchanged.
- Bottom-right: Touch action cluster uses an L shape for normal FPS controls.

## Component Mapping

| Design element | Existing component | New/modified component | Notes |
| --- | --- | --- | --- |
| Vitals stack | `VitalsMeter` | `VitalsMeter`, `VitalsMeter.model` | top-left, styled, values update via refs |
| Oxygen meter | `OxygenMeter` | moved into `VitalsMeter` | standalone mount removed |
| Jetpack meter | `JetpackMeter` | moved into `VitalsMeter` | standalone component deleted |
| Maw charge | `MawChargeMeter` | moved into `VitalsMeter` | optional row appears when the charge-using Maw is owned |
| Inventory button | `InventoryPanel` | `InventoryPanel` | starts collapsed, click opens contents |
| Mobile actions | `TouchControls` | `TouchControls`, `TouchControls.model` | no Dive in normal FPS |
| Top action chrome | inline `App.tsx` buttons | `HudCornerActions` | reduces scattered inline code |
| Shared HUD tokens | `theme.ts` | `hudChrome.ts` | common glass/button styles |

## Token Mapping

| Use | Token/style | Notes |
| --- | --- | --- |
| HUD panel | `theme.glass`, `theme.radius`, `theme.font.mono` | consistent glass telemetry |
| HUD accent | `theme.color.accent` | cyan borders/glows |
| Danger/warning | vital-specific colors | keep non-one-note survival semantics |
| Z index | `theme.z.hud` | keep HUD below menus |

## State Matrix

| State | User sees | Interaction behavior | Required screenshot |
| --- | --- | --- | --- |
| Mobile normal FPS | Vitals top-left, joystick bottom-left, 3-button L cluster bottom-right | Mine/use/jump only | yes |
| Desktop normal FPS | Vitals top-left, no touch controls | keyboard/mouse unchanged | yes |
| Inventory closed | `INV` button below suit HUD | click opens panel | yes |
| Inventory open | Inventory contents below suit HUD | click closes panel | yes |
| Build mode | Build action controls retain required actions | no keyboard regression | test/model |
| Flight | Flight touch controls retain required actions | no ship regression | model |

## Acceptance Criteria

- Normal mobile FPS controls render exactly three action buttons and no Dive.
- Vitals are top-left, not bottom-left.
- Vitals and inventory do not overlap.
- Oxygen appears in the top-left suit HUD, not as a separate center-bottom breath meter.
- Jetpack appears in the top-left suit HUD, not as a separate center-bottom meter.
- Maw charge appears in the top-left suit HUD when applicable.
- Inventory is collapsed to a button by default and opens on click.
- Buttons and vitals share a cohesive HUD style.
- Typecheck and focused tests pass.
- Desktop and mobile screenshots show no critical overlap.
