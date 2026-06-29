# Repo Survey

## Files Inspected

- `main/src/utils/treeGen.ts`: trunk/branch tube geometry, normals, indices, and leaf geometry.
- `main/src/utils/treeMaterials.ts`: bark shader and procedural grain.
- `main/src/utils/treeGen.test.ts`: geometry regression tests.
- `main/src/treeTest.tsx`: visual tree harness.

## Diagnosis

`buildTrunkGeometry` emitted every parent-to-child segment as its own two-ring tube. On straight stems, adjacent vertical chunks had duplicated coincident rings with independent frames and normals. That made horizontal breaks visible between chunks.

## Preview Server

Existing healthy server reused at `http://127.0.0.1:5173`; no duplicate server started.
