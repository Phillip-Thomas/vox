# Design Context

Run mode: single-surface
Exploration depth: 1
Execution budget: deep
Canonical preview URL: http://127.0.0.1:5173/?agent=1&world=-91%2C-4&dayphase=0.2458&profile=HIGH

## Hard Guardrails

- Preserve the prior cube-edge water height continuity fix.
- Do not clobber unrelated multiplayer/server work in the dirty worktree.
- Keep dynamic water flooding and replicated water registration intact.
- Keep water instance filling allocation-light; no new per-frame React churn.
- Do not change gameplay, terrain generation, water shader color, or production UI copy.

## Creative Brief

The water at cube edges should look continuous and smooth rather than like two perpendicular transparent sheets crossing into an X. A beveled or rounded visual read is preferred over a perfect cube-corner mathematical seam.

## Open Field

- Per-cell face deduplication for surface quads.
- Rounded/blended edge normals for water edge cells.
- Focused unit coverage around the geometry rule.

