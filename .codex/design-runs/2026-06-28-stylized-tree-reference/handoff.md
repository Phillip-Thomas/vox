Implementation handoff:

1. `treeProfile.ts`
- Add seeded species controls and include them in byte-stability tests.
- Keep ranges conservative and deterministic.

2. `treeGen.ts`
- Extend `TreeGenParams`.
- Map species controls into `lsFromParams`, growth gnarl, branch sag, trunk flare/roughness, fine-branch thinning, foliage threshold, foliage spacing, and foliage angle.
- Add `aTuftShade` to leaf, blossom, and impostor geometry.

3. `treeMaterials.ts`
- Add `aTuftShade`, `vTreeBase`, and `vTreeUp` to leaf vertex path.
- Add broad tuft-shaped alpha and clustered tint variation.
- Add crown-center volumetric lighting and camera/up-biased normals.
- Update shader cache keys.

4. `treeTest.tsx`
- Surface species control summary for rendered proof.

5. Tests and visual QA
- Run targeted tests, capture `tree-test.html` screenshots, then run full verify.
