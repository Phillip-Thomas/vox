# Site-Wide Plan

## Decision

- Mode: `refactor-existing`
- Goal: make one award-jury-ready 30-60 minute experience, then let that slice establish foundations for the broader sandbox and co-op game.
- Audience: players who want strange authored discovery and browser-native technical ambition, not a generic voxel survival clone.
- Quality threshold: final `4.75 / 5`, no category below `4.3`, no unresolved high player-journey/accessibility/performance defects.
- Execution budget: `flagship` for the story slice, `deep` for shared foundations, `standard` for secondary surfaces.
- Human checkpoint: full story screening and curated hero-atlas review are required.

## Design Thesis

Paravoxia should feel like a mind becoming embodied inside a universe that is also becoming materially real. Every system must reinforce that: visual fidelity, sound, control freedom, survival sensations, ecology, the ship, and co-op discovery. The next phase should increase consequence, composition, and memory—not system count.

Keep:

- cube-planet macro silhouette;
- fidelity-as-consciousness story structure;
- regulation versus awakening language;
- procedural ecology and generative score;
- seamless surface/space/system travel;
- strong instancing, typed worker transfer, and atlas tooling.

Reject:

- additional planets/biomes before the first slice is resolved;
- generic combat as the default ecology payoff;
- more shader variants without culling/precompile budgets;
- presenting future or stubbed systems as complete;
- a production WebGPU rewrite before an isolated TSL spike proves value.

## Phase 0: Establish Trust (1-3 days)

1. Make `Begin/Continue Story` primary and rename `Play Now` to `Enter Sandbox`.
2. Turn the current W-7744 arrival into an intentional finale: closing image, short recap/credits/tease, and explicit earned sandbox handoff.
3. Create a canonical action registry; expose mode-aware Controls from landing and pause; add touch sprint.
4. Restore browser zoom and focus-visible states; remove `transition: all`; add reduced-motion and modal focus/return contracts.
5. Make graphics profiles reactive. Add a browser assertion that HIGH and POTATO differ in scene counts/features.
6. Unlock audio only on an intentional action and demand-load/stream long beds.

Acceptance:

- A new player chooses the authored experience without guessing.
- The story ends on purpose.
- Controls are recoverable in one action.
- POTATO materially reduces live work.
- Landing does not decode all music.

## Phase 1: Finish The Award Slice (1-3 weeks)

1. Close the primitive loop: sealed shelter -> exposure/warmth -> fire -> recovery -> forgiving failure/respawn.
2. Restrict the field fabricator to primitive recipes; make wreck salvage/Maw repair a real objective; unlock one physical station as payoff.
3. Run a complete movie-mode and manual play screening. Produce a cut-by-cut defect list for composition, exposure, transition legibility, pacing, and control handoff.
4. Build a curated hero atlas with camera collision rejection, subject scale/occupancy bounds, exposure checks, and human scores.
5. Add material footsteps/mining transients, positional campfire/ship/water ambience, and a few fauna calls.
6. Add golden browser journeys: fresh Story; sandbox gather/craft/build/ship/warp; create/join/reconnect co-op; mobile touch; keyboard/a11y.

Acceptance:

- The slice has a beginning, escalation, payoff, and ending.
- Existing meters/building/crafting matter to each other.
- No critical shot is clipped, empty, sky-heavy, or unreadable.
- The browser journeys and performance budgets gate release.

## Phase 2: Recover And Spend Render Budget (2-5 weeks)

1. Use `WorldPrepClient` for initial/resume/jump worlds and hydrate without >50 ms activation tasks.
2. Code-split story chapters, co-op/Firebase, debug/atlas, post effects, and non-current audio; keep the menu/world shell as the critical chunk.
3. Partition terrain, water, and ecology by face/cell; compute bounds; restore frustum/horizon culling.
4. Add water LOD; then move from full exposed cubes toward exposed-face/greedy chunk meshes.
5. Consolidate shader programs and precompile the committed scene under the loading cover; fail shader-explosion reports.
6. Remove invisible collider debug meshes in production; pool/merge colliders next.
7. Spend recovered headroom on cheap actor/ship grounding, a tightly bounded near-player shadow budget, composer-free AA, planet-correct water, shoreline wetness/foam, underwater caustics/palette/ambience.

Acceptance:

- No startup Long Task over the agreed budget.
- Initial JS, audio memory, shader count, heap, frame time, and tier deltas have release budgets.
- HIGH/ULTRA look visibly better without making MEDIUM/mobile structurally broken.

## Phase 3: Signature Expansion (1-3 months)

1. Add a xenology/survey journal: observe, scan, photograph, infer behaviors, name discoveries, and share them in co-op.
2. Add deterministic wonder grammar: one major landmark per face, medium clusters, protected negative-space corridors, spawn-facing focal composition, and coast overlooks.
3. Author a small premium near-camera kit: player suit, W-7744, ship/cockpit, wreck, anomaly stone, and 2-3 fauna; keep procedural/far LODs.
4. Add procedural joints/foot planting/head tracking and secondary motion to close fauna/character animation.
5. Add one signature co-op objective with pings and in-game room recovery.
6. Add gamepad support and a PWA/offline-cache plan if installation/return-play is a product goal.

## WebGPU / Cutting-Edge Track

- Upgrade Three.js deliberately from r160 with migration tests; current releases are far ahead.
- Create an isolated `WebGPURenderer`/TSL branch for one planet material, one water path, one ecology compute experiment, and one post chain.
- Keep WebGL 2 production until browser/device coverage and visual parity pass.
- Do not promise a drop-in migration: the current custom `onBeforeCompile`/ShaderMaterial and EffectComposer work must be ported to TSL/node materials and the new post stack.

## Risks

| Risk | Trigger | Response |
| --- | --- | --- |
| More breadth displaces finish | new planet/system proposed before Phase 1 passes | defer to signature-expansion backlog |
| Headless captures distort color | visual decision depends on exposure/AA | require headed real-GPU and human screening |
| Profile fix causes rebuild hitches | tier swap crosses frame budget | stage rebuilds and test during active play |
| Authored assets fracture style | hero kit feels imported | art bible, same silhouette/palette/reality-stage contracts |
| WebGPU rewrite consumes roadmap | parity stalls or browser support blocks | keep spike isolated and WebGL production intact |

## Gate

- Site-wide plan: `pass`
- Refactor-existing mode explicit: `pass`
- Foundation and surface work separated: `pass`
- Sequence justified: `pass`
- Goals and acceptance criteria present: `pass`
