# Repo Survey

## Current State

- Grass rendering: `main/src/components/GrassField.tsx`, `main/src/utils/grassField.ts`.
- Grass appearance: `main/src/utils/grassProfile.ts`.
- Biome climate anchor: `main/src/utils/biomeProfile.ts`.
- Trees have their own wind shader helpers in `main/src/utils/treeMaterials.ts`, but do not consume a shared wind profile yet.
- Audio has a procedural `wind` channel, but current tests intentionally keep persistent planet noise at zero.

## Constraints

- The current grass renderer uses CPU-built instance matrices plus shader wind; keep that division.
- The profile/cache keys must include any CPU-affecting params, but shader-only gust params do not require instance rebuilds.
- Wind API should be pure and deterministic, with test coverage so trees/audio can safely consume it later.

