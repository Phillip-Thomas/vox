# Design Context Contract

## Hard Guardrails

- Product facts: Paravoxia is a first-person voxel survival/exploration game with on-foot, ship, build, crafting, inventory, multiplayer, and touch control paths.
- Technical constraints: Preserve existing keyboard/event bridge for mobile controls. Do not move the joystick; it remains bottom-left. Do not regress desktop controls.
- Design-system contracts: Use the existing elevated sci-fi glass language from `src/ui/theme.ts`; prefer shared HUD helpers over one-off inline style copies.
- Brand token/component constraints: Deep navy/black glass, cyan accent, compact telemetry, monospace labels for HUD data, no decorative card soup.
- Required states/workflows: On-foot mobile HUD, on-foot desktop HUD, build mode touch controls, flight touch controls, empty inventory, populated inventory.
- Accessibility requirements: Touch targets must remain at least 44px, buttons need labels, pointer regions must not block joystick/look input.

## Creative Brief

- Desired tone: Integrated suit telemetry, not debug bars.
- Audience/user taste: Game HUD should feel intentional and useful without stealing the first-person view.
- Density: Compact but readable; mobile should reserve bottom-left for joystick and bottom-right for thumb actions.
- Motion/interaction feel: Stable, fluid, no layout jumps; bar fills can update with existing rAF mutation pattern.
- Preferred patterns: Top-left status stack, bottom-right mobile action corner, shared glass/accent style.
- Disliked patterns: Bottom-left decay bars under joystick, scattered black circles, mobile Dive button clutter.

## Open Field

- Layout composition: Vitals panel, inventory offset, action cluster shape, top action cluster styling.
- Visual rhythm: Bar height, label/value layout, edge glows, touch button hierarchy.
- Interaction emphasis: Primary jump/thrust/place should occupy the bottom-right thumb target.
- Component composition: New small HUD style/model modules are allowed if they reduce repeated inline style.
- Information hierarchy: Health and resource decay must be glanceable before inventory detail.

## Quality Config

- Exploration depth: `3`
- Approval threshold: `4.75`
- Category floor: `4.3`
- Execution budget: `standard`
- Human taste checkpoint: preferred at depth 3; skipped for now because the user gave a concrete direction and asked for execution.
- External references: not needed; existing game HUD context is more relevant.
- Claude second opinion: risk-triggered, not triggered at intake because direction is clear.
- Canonical preview URL: `http://127.0.0.1:5173/?agent=1&world=0,0`
- Server ownership: Prefer existing Vite server on 5173 if it serves this repo.

## Stop Conditions

- Stop when desktop/mobile screenshots show no joystick overlap, Dive is gone from normal mobile controls, and the HUD reads as one system.
- Stop when targeted tests, typecheck, and build/verify pass or when a hard validation blocker repeats.

## Gate

- Hard guardrails separated from creative brief: `pass`
- Open field is broad enough for creative exploration: `pass`
- Quality config recorded: `pass`
- Relevant reference policy recorded: `pass`
- Stop conditions recorded: `pass`
