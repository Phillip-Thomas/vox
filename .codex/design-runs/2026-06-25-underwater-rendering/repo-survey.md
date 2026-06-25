# Repo Survey

Relevant files:

- `main/src/components/effects/UnderwaterEffect.ts`: underwater post pass, depth extinction, haze, godrays, wobble, vignette.
- `main/src/components/effects/PostFX.tsx`: drives underwater post uniforms from `playerSubmersion`.
- `main/src/components/UnderwaterDome.tsx`: surface from below, Snell window, sun aperture.
- `main/src/components/UnderwaterParticles.tsx`: marine snow and bubble volume.
- `main/src/components/debug/AgentCamera.tsx`: `?agent=1` screenshot harness.
- `main/src/components/EfficientScene.tsx`: mounts `AgentCamera`.
- `main/src/state/playerSubmersion.ts`: local underwater state source.
- `main/src/components/EfficientPlayer.tsx`: gameplay submersion classifier.

Finding:

- The baseline `?agent=1` capture was not initially exercising underwater post FX because the agent camera did not publish submersion.
- The godray shader blurred all bright scene pixels toward the sun. Nearby voxel highlights could therefore become repeated radial artifacts.
