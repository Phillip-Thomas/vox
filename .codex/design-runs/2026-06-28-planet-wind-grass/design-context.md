# Design Context Contract

Surface: planet grass density and wind motion.
Run mode: single-surface.
Exploration depth: 3.
Execution budget: standard.
Approval threshold: 4.75 / 5.
Category floor: 4.3 / 5.
Canonical preview URL: http://127.0.0.1:5173/?agent=1&world=0,0&dayphase=0.4734
Server ownership: existing Vite server on 127.0.0.1:5173, PID 25586; no duplicate server started.

## Hard Guardrails

- Preserve the single-instanced-mesh grass renderer and quality-profile culling.
- Keep wind deterministic by terrain seed so the same planet always has the same atmospheric character.
- Build wind as a reusable planet dynamic, not an ad hoc grass-only constant.
- Do not touch unrelated dirty HUD/avatar changes.
- Keep POTATO grass disabled.
- Avoid texture/alpha pipelines; shader-driven wind and instancing remain the performance lane.

## Creative Brief

The previous pass made grass much better, but it still needs more coverage per square foot and a less predictable motion pattern. Wind should feel like local gust cells moving over the surface from varied directions, and planets should differ in calm, breezy, turbulent, and stormy character.

## Open Field

- Wind profile data shape and seed parameters.
- How grass consumes wind fields.
- Strand density budget.
- Gust scale, speed, turbulence, direction veer, and planet-to-planet variation.
- Screenshot validation framing.

