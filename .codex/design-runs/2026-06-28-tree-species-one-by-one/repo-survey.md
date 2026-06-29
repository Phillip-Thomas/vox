Relevant files:
- `main/src/utils/treeGen.ts`: branch skeleton, leaf candidates, leaf cluster placement.
- `main/src/utils/treeProfile.ts`: deterministic species parameters and budgets.
- `main/src/utils/treeMaterials.ts`: tuft shader from previous pass.
- `main/src/treeTest.tsx`: per-species harness and summary hook.
- `main/src/utils/treeGen.test.ts`: candidate and geometry tests.
- `main/src/utils/treeProfile.test.ts`: profile bounds.

Root causes found:
- `foliageThreshold` can move a leaf cluster inward from a tip to a parent branch, which makes leaves look detached from branch ends or wrapped around stems.
- The conical candidate rule includes central leader nodes above 30% height, which can put foliage directly on the main stem.
- Global card multipliers improve fullness but do not repair weak species-specific branch attachment.
- The wide grid can hide a bad species; close-up per-species screenshots are required.
