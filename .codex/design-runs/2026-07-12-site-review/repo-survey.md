# Repo Survey

## Stack

- React 19, React Three Fiber, Drei, Three.js `0.160.1`, Rapier, postprocessing/n8ao, Firebase, Vite, TypeScript.
- Styling is mostly inline React style objects plus `src/ui/theme.ts` and a small global CSS file.
- State is distributed across React, module-singleton stores, refs, and frame-loop systems.
- Verification: TypeScript, 140 Vitest files / 1,060 tests, production build; server has 6 files / 58 tests.
- Render evidence: agent camera, story probes/strips, procedural atlas, score/FPS probes.
- Accessibility automation: none in the release gate.

## Architecture

- `App.tsx` owns menu, pause, world/system travel, input, debug surfaces, Canvas, and much orchestration: 1,675 lines.
- `EfficientPlayer.tsx` owns movement, physics, mining, survival, interaction, build integration, story policy, and state publication: 1,743 lines.
- `storyDirector.ts` is a 1,822-line timeline/state-effects coordinator.
- World preparation has typed worker transfer/hydration infrastructure, but initial boot still takes the synchronous world-generation path.
- World rendering uses strong instancing, but most terrain/ecology/water meshes disable frustum culling and remain monolithic.

## Routes And Surfaces

- One Vite route with state/query-driven surfaces rather than a page router.
- Entry points: landing menu, Story, Play Now sandbox, optional Co-op, story deep links, debug/agent/atlas URLs.
- In-game surfaces: suit HUD, inventory, crafting, build editor, pause/star map, cockpit/flight, underwater, mobile controls, co-op status, story overlays.

## Existing UI And Brand System

- Strong reusable signals: cyan-on-void telemetry, mono regulation copy, glass panels, live rendered cube-planet backdrop, diegetic story feed, sparse pill controls.
- Strongest language: regulation-versus-awakening story copy.
- Weakest language: generic `A Voxel Universe`, `Play Now`, single-letter HUD buttons, and early-build framing.
- Input/hint ownership is fragmented between Drei mappings, raw event listeners, ship/player components, story phases, and touch models.

## Brand And Asset Inventory

- The macro brand is the cube planet in space and the fidelity/consciousness ladder.
- Runtime visual asset folders contain no authored image/model/animation library; world, ship, vegetation, fauna, sky, and most VFX are generated in code.
- Runtime media assets are five music tracks totaling about 9.4 MB compressed; the score also has a procedural WebAudio layer.
- Procedural generation is a major differentiator, but hero characters, creatures, wreck/ship landmarks, and close-range surfaces currently inherit the same code-generated ceiling.
- Missing assets that would materially help: a small authored hero-prop/character animation layer, material-specific sound set, and spatial ambient palette. This need not replace procedural worlds.

## Data And State

- Offline persistence is localStorage with global and per-world state.
- Multiplayer uses Firebase Auth, Cloud Run WebSockets, Neon persistence, authoritative commands, snapshots, and party-locked travel.
- Story state is milestone/beat driven and query-deeplinkable.
- Graphics quality is a module singleton with a subscription API, but major consumers snapshot values at mount.

## Constraints And Opportunities

- Preserve the current dirty branch and concurrent edits.
- Preserve strong instancing, worker transfer protocol, atlas tooling, PBR/procedural shaders, and story premise.
- Highest leverage: finish one authored slice, make existing settings truthful, reduce first-load/main-thread pressure, close the primitive survival loop, and expose controls/accessibility.
- Main risks: feature breadth, accepted render exceptions, large eager audio/JS memory, non-reactive quality tiers, and absence of browser-journey release gates.

## Gate

- Components/tokens understood: `pass`
- Brand identity understood: `pass`
- Asset folders inspected: `pass`
- Candidate/missing assets identified: `pass`
- Data/state understood: `pass`
- Constraints documented: `pass`
