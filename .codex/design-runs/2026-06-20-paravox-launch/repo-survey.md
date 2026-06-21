# Repo Survey

Target repo: `/home/thomasphillip/Projects/vox`

Observed structure after branch alignment:

- `master` fast-forwarded to `origin/collision-efficiency-test` at `89b417a`.
- `main/`: Vite React/Three/Rapier app and selected deploy target.
- Legacy demo folders were removed by the branch fast-forward.
- No Firebase config existed on the branch before this launch pass.

Deploy-relevant files:

- `main/package.json`: `npm run verify`, `npm run build`, and Playwright Core dependency.
- `main/index.html`: browser metadata and favicon.
- `main/dist/`: generated Firebase Hosting public directory.

Brand/asset inventory: no dedicated brand folder or production logo was present. Initial launch uses existing favicon plus text metadata.
