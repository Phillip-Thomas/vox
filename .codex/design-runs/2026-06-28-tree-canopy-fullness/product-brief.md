# Product Brief

## Page Goal

Make procedural planet trees look credible enough to sit beside the improved grass system: fuller, denser, less toy-like, and animated by shared atmospheric wind.

## Target User

A player exploring alien voxel planets who should perceive vegetation as a coherent living biome rather than isolated placeholder props.

## User Motivation

World exploration should feel richer and more natural without sacrificing the game's fast procedural rendering.

## Success Proxy

- All six tree silhouettes look materially fuller in `tree-test.html`.
- In-world trees remain performant and visibly integrated with grass/wind.
- No severe clipping, bare leader spikes, square-card look, or uniform synchronized sway.

## Language Constraints

No user-facing UI language changes are part of this pass.

## Required States

- Harness: silhouette row and variety grid.
- Game: normal world view with trees, grass, and wind.
- Mobile: at least one screenshot confirms no visual regression in the first viewport.
