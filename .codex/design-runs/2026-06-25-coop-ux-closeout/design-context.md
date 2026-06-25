# Design Context

Run mode: single-surface
Surface: Co-op room awareness across the landing Co-op panel and in-game status badge
Exploration depth: 1
Execution budget: standard
Canonical preview URL: http://127.0.0.1:5173/

## Hard Guardrails

- Preserve the current Paravoxia menu and HUD visual system.
- Do not replace the existing co-op flow; improve clarity and feedback inside it.
- Keep Firebase Hosting as the SPA surface and Cloud Run as the realtime server.
- Do not make remote players authoritative UI-only illusions; roster status must come from session/server state.
- Keep single-player/offline flow unaffected.

## Creative Brief

The co-op UI should feel like a compact ship/instrument readout: direct, useful, and quiet. It should answer "am I connected, who is here, what is the invite, and what went wrong" without adding a large social overlay.

## Open Field

- Exact roster row layout.
- In-game badge density.
- Status language for connecting/reconnecting/error states.
- Whether ping/markers are implemented or explicitly deferred in this pass.

## Quality Configuration

- Approval threshold: 4.75 / 5
- Category floor: 4.3 / 5
- Human taste checkpoint: skipped for depth 1 stabilization
- Claude second opinion: not triggered unless rendered evidence stalls or layout fails
