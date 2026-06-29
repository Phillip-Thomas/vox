# Implementation Plan

1. Add pure deterministic `WindProfile` utility with direction, strength, gust, scale, speed, turbulence, veer, and variability.
2. Move grass wind fields to consume `WindProfile` while preserving existing `windDir` and `windStrength` compatibility fields.
3. Double `BLADES_PER_CLUMP` and update density tests.
4. Extend grass material uniforms and shader logic for moving gust cells and local direction veer.
5. Run focused tests, full verify, then capture desktop/mobile screenshots.

