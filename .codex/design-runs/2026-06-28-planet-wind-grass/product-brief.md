# Product Brief

## Goal

Double the amount of grass and make wind a planet-level dynamic that makes grass move in less predictable, more natural gust fields.

## User Motivation

The player should read grass as a thick living surface. Wind should make the planet feel atmospheric and distinct, not like every blade follows one synchronized sway.

## Success Proxy

- `bladesPerVoxel(4)` is roughly doubled from the previous 48-strand HIGH baseline to at least 96 strands before biome multiplier.
- Grass shader consumes a `WindProfile` with deterministic per-planet gust parameters.
- Rendered screenshots show denser grass and no framework overlay.
- Focused tests and full verification pass.

## Language And Claims

No visible text is introduced.

