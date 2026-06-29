# Handoff

## Accepted Design

Shared planet wind profile with grass as first visual consumer.

## Component Mapping

- Add `main/src/utils/windProfile.ts` and tests.
- Update `grassProfile.ts` to consume `buildWindProfile()` and expose `wind`.
- Update `grassField.ts` to double strand density and add gust uniforms/shader motion.
- Keep `GrassField.tsx` lifecycle unchanged unless uniform application needs a new call path.

## State Matrix

- Calm planet: lower bend, slower broad gusts.
- Breezy planet: medium moving cells and mild veer.
- Turbulent planet: stronger local veer and faster gust cells.
- POTATO profile: no grass, unchanged.
- Animated shaders off: wind freezes, unchanged gating.

## Acceptance Criteria

- Wind profile is deterministic and has bounded parameter ranges.
- Grass density is doubled relative to previous pass.
- Grass shader uses at least two spatial gust fields so local direction differs across the surface.
- Focused tests and full `npm run verify` pass.
- Desktop and mobile screenshots captured from the canonical preview URL.

