# Screenshot Report

Preview URL: `http://127.0.0.1:5174/`

Local validation used `VITE_PARAVOXIA_LOCAL_AUTH=1` against the auth-disabled local state server so browser capture does not depend on Firebase anonymous sign-in.

Screenshots reviewed:

- `screenshots/desktop-1440x900.png`
- `screenshots/mobile-390x844.png`

Findings:

- Desktop and mobile both show the co-op panel with `CREW 2/2 linked`.
- Host roster shows local player as `YOU` and the second player as `LINKED`.
- Mobile panel text remains inside the container and the roster rows do not overlap adjacent controls.
- WebSocket traces from the capture include `room_roster` for both host and joiner with no console errors.

Residual issue:

- The page is WebGL-heavy and Playwright polling/screenshot operations can be slow under repeated headless runs. The capture script was hardened with local auth, longer screenshot timeouts, and case-insensitive roster checks.
