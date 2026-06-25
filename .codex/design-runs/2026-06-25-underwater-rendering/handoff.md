# Handoff

Component mapping:

- Underwater artifact fix: `main/src/components/effects/UnderwaterEffect.ts`
- Screenshot harness fidelity: `main/src/components/debug/AgentCamera.tsx`
- Harness prop wiring: `main/src/components/EfficientScene.tsx`

Acceptance criteria:

- `-48,59` underwater screenshot no longer shows dense repeated yellow artifact bands.
- Godray effect remains visible as soft aperture light.
- Agent captures activate underwater post FX when the scripted camera eye is in a water voxel.
- Dry agent captures reset local submersion on unmount.

State matrix:

- Underwater success: captured.
- Mobile underwater: captured.
- Dry cross-check: captured.
- Loading/error/empty: out of scope; no UI flow changed.
