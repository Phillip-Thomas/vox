# Design Context Contract

Run mode: `single-surface`
Surface: remote player avatar legibility in live Paravoxia co-op gameplay.
Execution budget: `standard`
Exploration depth: `3`
Canonical preview URL: `http://127.0.0.1:5173/?agent=1&world=0,0&avatarDemo=1` once Vite is started for this run.
Server ownership: no healthy Vite server was listening on the usual ports at intake; this run may start one and keep it available for preview.

## Hard Guardrails

- Product facts: Paravoxia is a first-person voxel survival/crafting/space-travel game with invited co-op.
- Legal/claim/availability limits: do not imply MMO-scale authority or public matchmaking; this is Phase 1 invited co-op polish.
- Accessibility requirements: remote state must be readable by shape and motion cues, not color alone.
- Technical constraints: `PlayerAvatar` remains render-only and must not write local player singleton stores.
- Design-system contracts: preserve elevated sci-fi cockpit tone, cyan accent, dark void palette, compact telemetry language.
- Required states/workflows: walk/idle, swim, jetpack, mine, build, long names, multiple remote players, active-world filtering.

## Creative Brief

- Desired tone: practical diegetic EVA suit readability, not a decorative mascot.
- Audience/user taste: players need instant recognition of friend identity and intent at gameplay distance.
- Density: compact 3D signals; no large HUD panel or screen-space clutter.
- Motion/interaction feel: readable but restrained, with small pulses or silhouettes that support action state.
- Reference principles: multiplayer games use silhouette, nameplate, and role/action markers together.
- Preferred patterns: billboarded nameplates, colored team rings, small icon-like state chips, action-specific props.
- Disliked patterns: relying only on body tint, oversized floating UI, generic MMO nameplates.
- Category expectations: a remote co-op avatar should answer "who is that, where are they facing, what are they doing?"

## Open Field

- Layout composition: 3D avatar internals, nameplate stack, ground/footing marker.
- Asset treatment: code-native geometry only; no new bitmap/model asset required for this scoped pass.
- Visual rhythm: small readable beacon above the body plus orientation marker near the ground.
- Interaction emphasis: action changes should read immediately from silhouette and accessory geometry.
- Copy structure: player label only; no extra prose in-game.
- Component composition: extend `PlayerAvatar` and presentation helpers; preserve `PlayerAvatarPoseHarness` API if possible.
- Information hierarchy: body silhouette first, action beacon second, player label third.

## Quality Config

- Exploration depth: `3`
- Approval threshold: `4.75`
- Category floor: `4.3`
- Execution budget: `standard`
- Current staged gate: final `4.75`
- Human taste checkpoint: skipped for autonomy; selected/rejected directions and assumptions recorded.
- External references: not used; existing game/product context is sufficient.
- Claude second opinion: risk-triggered only; not triggered at direction stage because scope is constrained and code direction is clear.
- Autonomous loops: continue while score improves and no hard blocker exists.
- Budget/risk limit: avoid networking changes and avoid expensive avatar models.

## Stop Conditions

- Score passes configured threshold and no serious defects remain.
- Remote avatars are visibly legible by non-color cues.
- `PlayerAvatar` remains render-only and tests cover presentation helpers.
- Desktop and mobile screenshots are captured or the remaining screenshot blocker is documented.
- `npm run verify` or right-sized targeted checks pass.

## Gate

- Hard guardrails separated from creative brief: `pass`
- Open field is broad enough for creative exploration: `pass`
- Quality config recorded: `pass`
- Relevant reference policy recorded: `pass`
- Stop conditions recorded: `pass`
