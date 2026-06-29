Status: complete.

Canonical preview:
- http://127.0.0.1:5173/tree-test.html?only=frond

Browser path:
- Browser plugin unavailable; used Playwright with project-local `playwright-core`.

Changes:
- Rebuilt frond skeleton generation with more ribs, one extra rib segment, varied length/lift/droop, and less forced downward collapse.
- Pruned frond trunk geometry so bark renders only the palm trunk, not the invisible guide ribs.
- Added a frond-specific leaf builder that emits overlapping blade ribbons and side blades along rib tangents.
- Added a crown rosette for the inner frond nodes to reduce the exposed central spike.
- Widened the procedural frond alpha mask and bumped the leaf shader cache key to `tree-leaf-v6`.
- Added regression coverage for trunk-only frond bark with foliage carrying the crown.

Final evidence:
- `screenshots/iteration-4-frond.png`
- `screenshots/iteration-4-frond-angled.png`
- `screenshots/iteration-4-silhouettes.png`

Verification:
- `npm run test -- treeGen treeProfile`: passed.
- `npm run verify`: passed.
