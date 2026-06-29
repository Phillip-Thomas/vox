# Handoff

## Component Mapping

- Species scale: `buildTreeProfile` in `treeProfile.ts`.
- Generator params: `paramsFromProfile` in `treeProfile.ts`.
- In-world variation: `TreeField.tsx` instance scale matrix.
- Visual QA: `treeTest.tsx` and `capture-tree-height.mjs`.

## Acceptance Criteria

- Profile height floor is at least `5.6`.
- Profile height cap is no more than `10.9`.
- Height spread across sampled seeds exceeds `4.0`.
- Crown radius remains bounded below `3.9`.
- Desktop and mobile screenshots prove the new range.
- `npm run verify` passes.

## Responsive Notes

Tree-test harness has desktop silhouette, desktop variety, and mobile close-up captures. The in-world proof uses desktop under-canopy framing.
