Implemented:
- `main/src/game/systems/realityRenderSystem.ts`
  - New plot-facing stage API: `bare`, `color`, `material`, `alive`, `paradox`.
  - Independent effect families: chroma, detail, organic, atmosphere, thermal, crystalline, metal.
  - Overrides, reset, parse, snapshot, and subscription helpers.
- `main/src/utils/voxelMaterial.ts`
  - Added reality-stage uniforms and planet-wind uniforms.
  - Added `chroma` desaturation for unresolved voxel block reality.
  - Added authored detail for wood and lava, and expanded detail coverage to every material.
  - Added wind dust/dry wisps for sand and dirt.
  - Added ash/embers for basalt.
  - Added lava boiling cells, cooling scum, thermal roughness, and emissive heat.
  - Added frost wind, ice/crystal glints, and internal glow gating.
  - Added bark grain/knots and ore vein/catchlight detail.
- `main/src/components/EfficientPlanet.tsx`
  - Applies deterministic per-planet wind to voxel material.
  - Updates voxel material with current reality effects each frame.
- `main/src/App.tsx`
  - Added debug URL control: `?voxelStage=bare|color|material|alive|paradox`.
- Tests:
  - Added `realityRenderSystem.test.ts`.
  - Expanded material coverage test in `planetSystem.test.ts`.

Screenshots:
- `runtime-paradox.png`: production preview, high quality, heightened stage.
- `runtime-bare.png`: same route with procedural voxel effects disabled by story stage.
