# Fauna Realism And Topology Pass

## Outcome

The six procedural fauna families now use asymmetric curved lofts, continuous tapered limbs, secondary bend pivots, volumetric leaf ears, inset eyes, wedge feet, and region-specific materials instead of stacked primitive masses. Grazer, woolly, runner, hopper, dragonfly, and fish each have a distinct authored anatomical recipe while preserving deterministic phenotype variation.

The surface glitch was a real culling defect: curved sweep frames and the old triangle order produced inward-facing sidewalls. Side and cap winding are now outward, shared anatomical joints omit internal cap disks, and all species use deterministic opaque depth coverage. The alpha-hashed wing and fin treatment was removed because its stochastic stipple read as missing faces against terrain.

Planet seeds still produce deterministic phenotype variation for proportions, appendages, fleece, and stance. Locomotion advances by distance, uses hierarchical hip and lower-limb bends with matching normal rotation, keeps hopper motion coherent, and rejects land routes without scaled body clearance.

## Renderer Compatibility

- `faunaModel.ts` is the renderer-neutral source of truth.
- Species, region, joint, and material IDs are append-only and versioned.
- `FaunaRenderFrameV1` sends a shared morphology table plus JSON-safe agent snapshots.
- The WebGL renderer is an adapter that packs region, joint, joint weight, and material slot into `aFaunaSurface`.
- The current adapter uses 15 of the guaranteed 16 WebGL vertex attribute slots. Future rig data must reuse packed channels or move to textures/storage buffers.
- Current rendering remains one instanced draw per species and one fauna shader program.
- `aFaunaBend` adds a renderer-adapter lower-limb pivot without changing the versioned simulation contract.

## Verification

- Focused fauna tests: 26 passed, including finite geometry, index validity, nondegenerate faces, unit normals, and positive solid signed volume across every species.
- Full repository verification: 150 files and 1,126 tests passed; typecheck and production build passed.
- Final topology atlas: 54 of 54 cases passed across six species, three views, and front, back, and night lighting with no browser errors or attribute overflow on `MAX_VERTEX_ATTRIBS=16`.
- Four-phase land gait atlas: 32 of 32 cases passed with no disappearing faces or joint separation.
- Live HIGH world: 24-44 fauna instances, 41 total scene draws, 37 programs, 56-60 FPS, and 17.0-17.3 ms p95 against a 24 ms budget.
- Only the existing Vite large-chunk warning remains.

## Evidence

- Final topology atlas: `main/captures/fauna-atlas/2026-07-13T03-27-53-895Z-fauna-v9-topology-final-v2/`
- Gait topology atlas: `main/captures/fauna-atlas/2026-07-13T03-29-41-900Z-fauna-v9-topology-gait-v2/`
- Live captures: `main/captures/fauna-v9-topology-live-v2_*.png`
- Live metrics: `main/captures/fauna-v9-topology-live-v2.metrics.json`
