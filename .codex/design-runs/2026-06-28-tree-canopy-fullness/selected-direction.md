# Selected Direction

Selected: Direction A, Bounded Fullness System.

## Rationale

The current tree architecture is already the right abstraction: one deterministic procedural tree species per planet, instanced across the world, with shared materials. The weakness is the density/profile/material tuning, not a missing rendering system.

## Taste Assumptions

- Fuller and more natural is more important than preserving the exact current sparse silhouettes.
- Wispy should remain lighter than broadleaf, but not look unfinished.
- Fronds can gain more ribs and leaflet cards while staying readable as palms.
- Wind should feel atmospheric and local, not synchronized across the whole planet.

## Handoff Summary

- Raise profile canopy density above old baseline.
- Add per-silhouette budget multipliers.
- Increase frond rib/rib-step richness.
- Make tree materials consume `profile.wind`.
- Verify in `tree-test.html` and one in-world view.
