# Design Context Contract

Run mode: `single-surface`
Surface: Landing menu co-op entry panel
Exploration depth: 3
Execution budget: standard
Approval threshold: 4.75 / 5
Category floor: 4.3 / 5

## Hard Guardrails

- Preserve existing offline play as the default path.
- Do not imply full synchronized gameplay is complete until command/snapshot integration lands.
- Use existing Paravoxia menu styling: live canvas backdrop, glass panels, cyan accent, compact controls, production-ready sci-fi language.
- Keep Firebase Auth optional behind `VITE_PARAVOXIA_COOP`.
- Use `VITE_PARAVOXIA_STATE_SERVER_URL` for the realtime server.
- The multiplayer socket session should survive the landing menu unmounting after Play.
- No new visual asset dependencies; the live game canvas remains the primary asset.

## Creative Brief

The co-op entry should feel like a quiet cockpit/radio link, not a marketing page. It should make the alpha state clear, expose create/join quickly, and show operational status without cluttering the first viewport.

## Open Field

- Exact panel layout and language.
- How to expose invite copy and status details.
- Whether the panel is a peer to Controls/Graphics/Audio or a larger secondary panel.

## Quality Config

- Human taste checkpoint: skipped for this continuation; record assumptions.
- Claude second opinion: not triggered; direction is low-risk and codebase-constrained.
- Required screenshots: desktop menu, mobile menu, joined/success state or best available simulated/manual state, and error/config state if practical.
