# Site Inventory

## Run Info

- Repo: `/home/thomasphillip/Projects/vox`
- Mode: `site-review`
- Date: `2026-07-12`
- Reviewed commit during capture: `60e12fe` on `agent/paravoxia-story-audio-world-update`
- Design context: `design-context.md`

## Route And Surface Inventory

| Surface | Owner | User goal | Primary action | Known states/evidence | Priority |
| --- | --- | --- | --- | --- | ---: |
| Landing/loading | `LandingMenu`, `App` | Understand game and enter | Play/Story | generating, ready, desktop/mobile | 1 |
| Story prologue | `story/prologue/*` | Accept deployment and begin voyage | advance/choose/deflect | crawl, manifest, branching voyage, game | 2 |
| Fidelity ladder | `StoryOverlays`, `sideLens`, `storyDirector` | Experience perception becoming embodied | move/extract/touch | 1-bit, raster, depth, nav, iso, feed, color | 2 |
| Embodied story world | `story/world/*`, HUD | Survive first day and meet W-7744 | gather/craft/rest/drink/eat/run | story ends temporarily at arrival | 1 |
| Sandbox surface | `EfficientScene`, `EfficientPlayer` | Explore, harvest, build, survive | move/mine/interact/build | on-foot, day/night, hazards, stages | 1 |
| Underwater | water/swim/post/audio systems | Cross medium and explore oceans | swim/dive/surface | entry/submerged/exit/oxygen | 4 |
| Crafting/building | `CraftingPanel`, `BuildIndicator`, systems | Convert resources and create shelter | craft/place/remove | recipes, blocked placement, materials | 2 |
| Ship/space/system travel | ship components, star system | Leave, fly, target, travel, land | board/thrust/warp/land | cockpit, cruise, target handoff | 3 |
| Pause/star map/settings | `PauseMenu` | Recover, configure, travel, quit | resume/set course | graphics/audio/travel; controls absent | 2 |
| Co-op | `CoopPanel`, multiplayer HUD/avatar | Create/join and play with crew | create/join/invite | connect/reconnect/roster/status | 4 |
| Touch/mobile | `TouchControls`, mobile HUD/build | Complete core actions on phone/tablet | joystick/actions | FPS/build/flight; sprint absent | 2 |
| Debug/agent/atlas | debug components and tools | Validate content/performance | scripted capture/probe | many query-driven states | internal |

## Journey Map

- Current primary path: landing -> `Play Now` sandbox -> self-directed systems.
- Owner-selected demo path: landing -> existing Story through W-7744 arrival -> completed-site continuation or honest Systems Sandbox. No later story beat is part of this lift.
- Sandbox loop today: gather -> craft/build -> persist, but shelter, exposure, failure, repair, and era unlock do not yet close the loop.
- Co-op networking is deeper than co-op goals and in-game management.
- Demo gaps: completed-save continuation, exposed future recipes, non-lethal meters, and missing controls recovery. Maw repair and later story progression are intentionally hidden/deferred.

## Shared Patterns

| Pattern | Quality | Reuse opportunity | Risk |
| --- | --- | --- | --- |
| Cyan glass HUD chrome | strong | controls/settings/room management | small-letter density on mobile |
| Regulation feed | distinctive | story/tutorial/state communication | overuse can obscure world |
| Query-driven probes | technically strong | golden browser journeys | not in release gate |
| Module singleton state | fast frame access | settings/actions | fragmented subscriptions/ownership |
| Procedural material/ecology | ambitious | discovery journal | becomes set dressing without outcomes |

## Technical Inventory

- Build: Vite single-page app.
- Renderer: WebGL/Three.js r160 through React Three Fiber.
- Test gate: node Vitest + typecheck + production build.
- Screenshot gate: manual scripts; not CI/release gating.
- Accessibility gate: manual only.

## Gate

- Important surfaces inventoried: `pass`
- Shared patterns identified: `pass`
- User goals/actions captured: `pass`
- Brand/assets captured: `pass`
- Technical constraints captured: `pass`
