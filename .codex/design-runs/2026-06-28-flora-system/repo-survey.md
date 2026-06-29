# Repo Survey

## Existing Vegetation Systems

- `main/src/components/GrassField.tsx` renders dense instanced grass with `grassField.ts` geometry, wind shader uniforms, and `buildGrassProfile`.
- `main/src/components/TreeField.tsx` renders deterministic tree species from `treeProfile.ts` / `treeGen.ts`, quality-gated by `treeDensity`.
- `main/src/components/ForageField.tsx` renders collectible edible plants on grass voxels.
- `main/src/components/SurfaceEffectField.tsx` renders spawned material phenomena for sand and dirt, using spec-driven instanced layers.

## Environmental Inputs

- `buildBiomeProfile` gives climate axes and vegetation hues.
- `buildWindProfile` gives deterministic planet wind direction, strength, gusts, turbulence, veer, and offset.
- `getVoxelRealityEffects` exposes `organic`, `atmosphere`, and `detail` for plot-stage rendering gates.
- `getGraphicsQuality` owns density/distance/animation knobs.

## Harness

- `main/src/voxelTest.tsx` already supports `?effects=sand` and `?effects=dirt`; it is the right place for `?effects=flora`.

## Constraints

- Existing worktree contains many user/agent changes. Do not revert unrelated files.
- Keep the flora layer separate from collectible forage so visuals do not change gameplay pickup behavior.
