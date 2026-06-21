# Handoff

Implementation target: Firebase Hosting serving `main/dist`.

Component mapping:

- Existing React canvas/game components remain unchanged after branch alignment.
- Browser metadata is updated in `main/index.html`.
- Hosting cache behavior is configured in `firebase.json`.

Acceptance criteria:

- `npm run verify` passes in `main/` or any failures are triaged before deploy.
- Firebase predeploy can build from repo root.
- Hosted URL loads the app shell and WebGL canvas.
- Desktop and mobile smoke screenshots are captured before final approval.
- Custom domain setup is completed or blocked only by external DNS/provider access.
