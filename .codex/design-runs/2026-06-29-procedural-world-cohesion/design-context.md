# Design Context Contract

## Run Mode

- Mode: `site-wide-review-plan`, adapted to the full procedural world rendering system.
- Future execution mode: `site-wide-execution / refactor-existing`.
- Execution budget for this planning pass: `deep`.
- Execution budget for implementation: `flagship`, broken into staged gates so we do not polish one subsystem while the whole planet remains incoherent.
- Exploration depth: `3` for system architecture and art direction; depth `4` requires human taste approval before radical style shifts.

## Hard Guardrails

- Preserve Paravoxia's core visual thesis: cubic worlds gradually reveal richer reality as the player transcends dimensions.
- Preserve deterministic generation. Same seed must always produce the same planet art direction, terrain, ecology, materials, and harness report unless schema version changes intentionally.
- Preserve diversity. A cohesion system cannot collapse all planets into one tasteful green-blue look.
- Preserve device quality separation. `GraphicsQuality` remains a performance profile; `VoxelRealityStage` remains story/rendering progression.
- Preserve current working systems unless a measured defect requires refactor: `BiomeProfile`, `PlanetProfile`, `WindProfile`, `GrassProfile`, `TreeProfile`, `WaterProfile`, flora, fauna, surface effects, voxel material, sky, and post FX.
- Avoid texture asset dependency for core terrain/ecology unless performance and quality evidence justify it. Procedural color and geometry remain the main lane.
- All expensive render features must be gated by quality profiles and measurable in the harness.
- No subsystem may choose colors, spawn ecology, scale, or shape in isolation after the cohesion refactor.
- Spawned objects must remain surface-valid: no underwater sheep, no arid cacti in lush meadows unless explicitly authored as rare contrast, no flora/fauna floating or sinking through voxels, no tree roots detached from surface normals.
- New harnesses must work on Linux with the local Chromium path or a configurable browser path.
- The plan may not approve itself without rendered screenshots and adversarial review once implementation starts.

## Creative Brief

- Target feeling: planets should feel like authored showcases of color theory, ecology, scale, silhouette, and atmosphere, while remaining mathematically generated.
- Each planet should read like an intentional room/world composition: dominant color family, supporting colors, accent colors, value hierarchy, texture rhythm, negative space, density, and focal contrast.
- Borrow principles from color theory and interior design:
  - dominant / secondary / accent proportions,
  - warm-cool balance,
  - value contrast,
  - material contrast,
  - repetition with variation,
  - rhythm and breathing room,
  - one memorable focal accent per scene,
  - harmony by analogy, split-complement, triad, monochrome-with-accent, earth-neutral-with-jewel-accent, or high-key pastel schemes.
- Do not make the world beige, purple-blue, or single-hue by default. Palette families must vary by archetype and seed.
- Shapes should feel intentional: voxel blocks, grass hair, trees, flora, fauna, rocks, water, dust, sky, and post FX should share a deliberate stylization language.
- Performance must remain part of beauty. A visually richer world that tanks old laptops fails.

## Open Field

- Create a new shared `PlanetArtDirection`/palette contract.
- Add mathematical palette families and harmony scoring.
- Refactor consumers to pull color, density, scale, and style decisions from the shared contract.
- Add a long-running procedural atlas harness that captures many seeds, archetypes, vantages, quality profiles, and reality stages.
- Add objective checks for color harmony, ecology validity, scale sanity, shader/material complexity, draw calls, triangles, frame timing, and visual regression.
- Add adversarial visual review prompts and scorecards for screenshots.
- Add data exports so screenshots can be reviewed beside the exact seed profile, palette, counts, and performance metrics.

## Quality Config

- Final approval threshold: `4.85 / 5` for the whole world-cohesion system.
- Category floor: `4.45 / 5`.
- Interim gates:
  - foundation gate: tests and harness compile, no visual approval claim.
  - first-pass atlas gate: `4.30 / 5`.
  - refined atlas gate: `4.60 / 5`.
  - final atlas gate: `4.85 / 5`.
- Human taste checkpoint: required before final palette family lock and before any depth-4 radical style shift.
- Claude second opinion: risk-triggered for taste ties, stalled score, or severe visual defect with unclear fix.
- Canonical preview URL for implementation: existing healthy dev server, normally `http://127.0.0.1:5173/?agent=1`.
- Existing harnesses to preserve:
  - `tree-test.html`
  - `rock-test.html`
  - `voxel-test.html`
  - `?agent=1` game harness with `window.__game`

## Reference Policy

| Reference class | Principle borrowed | Explicitly not copying |
| --- | --- | --- |
| Color theory | harmony models, value structure, accent control, saturation balance | fixed brand palette or one universal color formula |
| Interior design | dominant/secondary/accent proportions, material layering, negative space, texture rhythm | literal room styles or furniture metaphors in code |
| Cinematic games | strong silhouettes, atmosphere, readable focal points, staged contrast | asset cloning or uncontrolled post-processing |
| Stylized nature references | leaf/grass/tree fullness, biome-specific ecology, wind coherence | photorealism that breaks voxel identity |

## Stop Conditions

- Stop planning when a durable checklist exists with clear phases, owners, files, validation, and gates.
- Stop implementation phase if screenshots pass technically but look incoherent; return to art-direction contract.
- Stop implementation phase if harness metrics show unacceptable frame degradation on HIGH or MEDIUM.
- Stop implementation phase if palette diversity collapses below configured thresholds.
- Stop implementation phase if spawn validity defects repeat across seeds.

## Gate

- Hard guardrails separated from creative brief: `pass`
- Open field broad enough for creative exploration: `pass`
- Quality config recorded: `pass`
- Reference policy recorded: `pass`
- Stop conditions recorded: `pass`
