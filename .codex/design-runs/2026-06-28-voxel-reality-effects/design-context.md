Hard guardrails:
- Preserve current Paravoxia look: stylized voxel, colorful, slightly cartoony, increasingly cinematic.
- Keep grass improvements intact.
- Do not reorder material IDs.
- Effects must degrade by quality profile and be independently controllable by story state.
- Avoid additional draw-call-heavy particles for block dust/frost/lava.

Creative brief:
- Bring sand, lava, ice, crystal, basalt, wood, stone, dirt, and ores up to the same perceived fidelity as grass.
- Use planet wind for surface motion: sand/dirt dust, basalt ash, frost streaks, subtle organic shimmer.
- Make lava feel hot and alive with boiling cells, emissive pulsing, and cooling crust.
- Make ice/crystal feel faceted, frosted, and internally luminous.
- Make wood and ores less flat through bark grain, knots, vein ridges, and catchlights.

Open field:
- Exact strength of each material effect.
- Names and values of narrative reality stages.
- Whether later stages exceed production intensity.

Selected run assumptions:
- Default stage remains `alive` to preserve current production richness.
- URL debug stage support is enough for now; future quest code can call the exported system API.
