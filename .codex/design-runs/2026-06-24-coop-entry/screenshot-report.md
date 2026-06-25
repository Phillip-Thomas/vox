# Screenshot Report

Canonical preview URL: `http://127.0.0.1:5174/`

Server ownership: existing `http://localhost:5173/` was healthy but started without co-op env flags, so a temporary co-op-configured Vite server was started on `127.0.0.1:5174`.

Browser path: Browser plugin not available; used Playwright Core with system Chromium.

## Flow

Landing route -> click `Co-op` -> disabled/config state renders in the landing menu.

## Evidence

- Desktop: `/tmp/paravoxia-coop-screens-enabled/desktop-coop-panel.png`
- Mobile: `/tmp/paravoxia-coop-screens-enabled/mobile-coop-panel.png`
- Live desktop ready state: `/tmp/paravoxia-coop-screens-live/desktop-coop-panel.png`
- Live mobile ready state: `/tmp/paravoxia-coop-screens-live/mobile-coop-panel.png`
- Live created-room state: `/tmp/paravoxia-live-create-room/created-room.png`

## Checks

- Page identity: pass, title `Paravoxia`.
- Blank-page check: pass, landing menu rendered.
- Framework overlay: pass, no Vite/runtime overlay.
- Interaction proof: pass, `Co-op` tab opens the panel.
- Desktop layout: pass, panel fits existing left-side menu rhythm.
- Mobile layout: pass after patch; footer no longer overlaps the panel.
- Console health: no app errors. Chromium emitted WebGL readback performance warnings and one existing deprecated-parameter warning.
- Live create-room proof: pass, browser UI reached `Linked` and displayed room, world, and invite code.

## Scoped-Out State

Two-computer browser-to-browser manual confirmation is still pending. The server-side smoke test verified two authenticated anonymous players can create/join the same room through Cloud Run.
