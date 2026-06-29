# Design Directions

## Direction A: Ecology Layer

Create a new `FloraField` with multiple instanced plant archetypes. It consumes biome, wind, graphics quality, and reality effects. This keeps flora reusable in the game and the harness.

Pros: clean system boundary, story/reality gating, no gameplay coupling.
Risk: new renderer and tests.

## Direction B: Extend Forage Visuals

Upgrade `ForageField` with more visual archetypes and wind animation.

Pros: fewer new files.
Risk: mixes cosmetic ecology with collectible gameplay and makes density constrained by pickup balance.

## Direction C: Fold Into Grass

Add flowers/fans/seedheads as extra blade variants inside `GrassField`.

Pros: one existing renderer.
Risk: grass becomes too broad, cactus/shrub shapes do not fit the blade abstraction, harder to tune separately.
