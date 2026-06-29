# Design Context Contract

Surface: procedural grass blade field on exposed grass voxels.
Run mode: single-surface.
Exploration depth: 3.
Execution budget: standard.
Approval threshold: 4.75 / 5.
Category floor: 4.3 / 5.
Canonical preview URL: http://127.0.0.1:5173/?agent=1&world=0,0
Server ownership: existing Vite server on 127.0.0.1:5173, PID 25586; no duplicate server started.

## Hard Guardrails

- Preserve the existing instanced `GrassField` architecture: one primary grass instanced mesh, shader-driven wind, and quality-profile density controls.
- Keep grass deterministic by voxel coordinate, blade index, and terrain seed.
- Do not touch unrelated dirty HUD/avatar changes.
- Keep mobile/HUD behavior out of scope for this run.
- Do not add texture assets or alpha-tested transparency unless performance evidence requires it.
- Grass must still orient to cube-face surface normals and render on all planet faces.
- Keep POTATO profile grass disabled.

## Creative Brief

The current grass reads like a few large, cartoony blades on a voxel. The desired effect is finer, denser, and whisperier: the top face should read as hair or a soft bristle layer, while still retaining Paravox's stylized alien color identity and wind shimmer.

## Open Field

- Blade count per density unit.
- Blade width, height, taper, curve, and bend.
- Per-voxel scatter pattern and clump breakup.
- Per-planet width/density profile ranges.
- Shader motion intensity, sheen, and root/tip treatment.

## Required States

- Desktop and mobile rendered screenshots.
- Close grass surface view and wider approach-grid view.
- Page load without framework overlay.
- Console health check.

