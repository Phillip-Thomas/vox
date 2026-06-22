# Paravoxia — TODO / Ideas

A living parking lot for planned work. Newest ideas at the top of each section.

## Day/night dynamics (builds on the chase-the-light system, shipped 2026-06-22)

- [ ] **Tidally-locked planets** — a per-planet trait where the sun does **not**
  rotate, so the terminator is *fixed*: a permanent day side, night side, and a
  dusk ribbon between. The only way to change your light is to move. Instant,
  memorable identity ("perpetual-night world — bring a light").
  - Slot it into the `PlanetProfile` / archetype system (e.g. a `rotates: boolean`
    or `dayLength` of ∞ per archetype, or a seeded chance). Anomaly/metallic/frozen
    feel like natural candidates.
  - Implementation: the day phase normally advances `sunDirection`; for a locked
    planet, freeze the global phase (sun stays at a fixed world direction). The
    local-up day/night model already does the rest — daylight = `sunDir·playerUp`,
    so moving across the planet sweeps you through day→dusk→night with a static sun.
  - Surface the trait in the scanner/planet manifest so it's a travel decision.

- [ ] **Day/night-gated content** — give chasing the terminator a payoff:
  - Flora / creatures / resources that only appear (or are harvestable) in light
    vs dark — read the local daylight (`localDaylight(sunDir, up)` from
    `utils/dayNight.ts`) at the spawn/harvest site.
  - Per-side hazards: heat on the day side, cold on the night side (ties into the
    archetype hazards already defined in `game/data/planetArchetypes.ts`).
  - Hook into the harvest/inventory loop so time-of-day + location both matter.

## Deferred / known issues

- [ ] **B3 — water edge-step** at cube-face edges (water surface ramps up toward
  edges; flood fill is dominant-axis while a level ocean wants Euclidean). Needs a
  focused water-surface-leveling pass. (Also the source of the occasionally-flaky
  `waterVoxels` "dry land on every preset" test.)
- [ ] **Discrete-gravity cleanup** — now that smooth gravity is the default and
  solid, delete the dead discrete machinery (`surfaceResolver`,
  `chooseFaceFromPosition`, `beginTransition`, wrap/cooldown/rotation-animation,
  the `?gravity=discrete` branch). See [[gravity-model]] memory.
- [ ] **Atmosphere polish** — lit clouds from the shadegent sandbox; tune per-planet
  palettes (`ARCHETYPE_SKY` in `SpaceSky.tsx`); volcanic day sky read a touch dark.

## Main thread

- [ ] **Crafting / recipes** — turn the inventory + multi-biome resources into the
  travel loop (the original next-step before the gravity/atmosphere detour).

## Dev harnesses (debugging tools — not shipped)

- **Tree test harness** — `main/tree-test.html` + `main/src/treeTest.tsx`. Renders
  EVERY tree silhouette side-by-side in a clean, centered, evenly-lit empty scene
  using the real `generateTree` + `treeMaterials` (no game/menu/biome/LOD to fight).
  Open `http://localhost:5173/tree-test.html`; orbit with the mouse; labels show
  each tree's actual silhouette. Edit the `SPECIES` array to add/force species.
  Use this to debug tree geometry instead of hunting in the live game.
  Known issue it surfaced: **weeping** canopy is upside-down (foliage low, bare
  branches spike up); `conical`/`wispy` have milder bare-top versions.
- **Shadegent shader sandbox** — `main/tools/shadegent.mjs` drives the
  `../shadegent` WebGL2 player to render Shadertoy-style shaders at exact iTime and
  screenshot them (used to prototype the atmosphere before porting to spaceSky).
- **Game capture harness** — `main/tools/capture.mjs` (headed real-GPU Playwright)
  drives `?agent=1`'s `window.__game` to screenshot named/pinned vantages + FPS.
