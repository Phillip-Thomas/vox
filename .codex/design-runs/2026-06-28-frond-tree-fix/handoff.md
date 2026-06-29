Implementation handoff:
- Add a frond-only trunk geometry prune before `buildTrunkGeometry`.
- Add frond-only leaf emission before generic Vogel disk cluster emission.
- Preserve shared attributes: position, normal, uv, aStiff, aPhase, aCanopyY, aFlower, aLeafRand, aTuftShade.
- Keep deterministic RNG use local and bounded.
- Verify with `tree-test.html?only=frond`, variety board, and full test/build.
