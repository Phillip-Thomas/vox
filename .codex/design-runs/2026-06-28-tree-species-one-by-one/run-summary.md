Status: completed.

Goal:
- Refine every tree species one by one so leaves align with branches and all species are full enough.

Canonical preview URL:
- `http://127.0.0.1:5173/tree-test.html`

Browser path:
- Browser plugin not available; using Playwright.

Implementation summary:
- Reworked `selectLeafCandidates` so each species is evaluated one by one and foliage is branch/rib-owned instead of trunk-owned.
- Removed visible inward foliage attachment from `buildLeafGeometry`; selected leaf nodes now attach at the selected branch node.
- Blended leaf-cluster direction toward the local branch tangent so leaves follow branches instead of orbiting stems.
- Increased bounded per-species density/card budgets for thin species, especially wispy/conical/frond.
- Hardened conical growth by adding side whorls, shortening the leader, and capping generator apical dominance for conifers.
- Pruned broadleaf terminal leader tips from trunk geometry so round/umbrella/wispy canopies do not show bare order-0 stumps.

Final evidence:
- Screenshots: `screenshots/final-round.png`, `screenshots/final-conical.png`, `screenshots/final-umbrella.png`, `screenshots/final-weeping.png`, `screenshots/final-wispy.png`, `screenshots/final-frond.png`, `screenshots/final-variety.png`, `screenshots/final-world.png`.
- Capture command: `TREE_CAPTURE_LABEL=final node .codex/design-runs/2026-06-28-tree-species-one-by-one/capture-species.mjs`.
- Verification: `npm run verify` passed from `main/` with 73 test files / 501 tests and production build.
