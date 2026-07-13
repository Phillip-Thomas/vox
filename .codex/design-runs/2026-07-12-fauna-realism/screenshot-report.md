# Fauna Screenshot Report

## Baseline

The baseline captures showed disconnected icosahedral masses, bead-like tails, capsule fleece, planar appendages, rigid stilt limbs, and frequent terrain occlusion:

- `main/captures/fauna-baseline-verdant_grazer.png`
- `main/captures/fauna-baseline-frozen_woolly.png`
- `main/captures/fauna-baseline-arid_hopper.png`
- `main/captures/fauna-baseline-oceanic_dragonfly.png`
- `main/captures/fauna-baseline-oceanic_fish.png`

## Final Review

The isolated final atlas verifies all six unobstructed silhouettes from side, top, and three-quarter cameras under front light, backlight, and night lighting. Bodies and heads retain outward front faces, overlap joints no longer reveal internal caps, feet and appendages preserve semantic motion, and opaque wings and fins keep stable authored outlines without alpha sparkle.

The four-phase gait atlas verifies grazer, woolly, runner, and hopper topology throughout articulation. No phase produces disappearing sidewalls, exposed inside faces, detached lower limbs, or browser/WebGL errors.

The live-world captures confirm the same meshes render in dense ecology, water, cube-face transitions, and the active planet palette. Runner and fish are now mandatory atlas subjects rather than untested variants.

Evidence:

- `main/captures/fauna-atlas/2026-07-13T03-27-53-895Z-fauna-v9-topology-final-v2/`
- `main/captures/fauna-atlas/2026-07-13T03-29-41-900Z-fauna-v9-topology-gait-v2/`
- `main/captures/fauna-v9-topology-live-v2.metrics.json`

## Remaining Direction

The current style remains procedural and single-draw-per-species. The next renderer can add mesh LOD tiers, groom/normal detail, sorted per-material fin transmission, and a shared near-field contact-shadow pass through the versioned frame and morphology contract without changing simulation or saved species IDs.
