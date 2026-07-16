# Paravoxia — Demo Foundation Plan

Owner direction: 2026-07-12

**OWNER LANE OVERRIDE — 2026-07-13:** this document remains the release gate for
the existing public demo, but it no longer freezes separately contracted
post-arrival implementation. The owner has authorized staged construction of
the A4 prelude and **Maw → dive → ship → local travel → Tidegarden** movement
through the Creative Triad. That work may not be published as part of the demo
until its own contracts, deterministic checks, headed taste, and release
decision pass. Existing shipped copy and audio remain protected baselines.

This is the source of truth for turning the current Paravoxia build into a
seemingly complete, impressive public demo while later story remains outside
that release surface. It supersedes any older review recommendation that calls for new story
beats, an audio-engine refactor, broad control remapping, more world breadth,
or a renderer migration before the demo gate.

## 1. North Star

Ship a browser demo that feels deliberate from the first menu frame through the
current W-7744 arrival and into a durable systems sandbox.

The demo does not need to imply that all of Paravoxia is finished. It must make
the part on display feel authored, coherent, stable, discoverable, and worth
remembering.

The demo has two honest layers:

1. **Story Demo** — the existing Prologue through `ch4-arrival`, with no later
   story beat, awakening, dialogue, lore, or progression payoff added.
2. **Systems Sandbox** — a clearly freeform space proving movement, harvesting,
   primitive crafting, shelter, survival, persistence, swimming, ship flight,
   and world travel without pretending that later narrative progression is live.

The central quality test is:

> Does the current game feel like a complete opening movement and a convincing
> foundation, rather than an unfinished collection of future systems?

## 2. Locked Owner Decisions

### Landing language

- `A Voxel Universe` becomes `Make no mistakes`.
- The existing uppercase styling renders it as `MAKE NO MISTAKES`.
- No other landing CTA or menu hierarchy change is approved by this decision.

### Story content lock

- The published demo story still stops at the existing W-7744 arrival.
- Post-arrival work is allowed only inside an explicit, hashed production lock;
  it must remain unshipped until its Creative-Triad and release gates pass.
- Do not add dialogue, lore, a teaser scene, or a new canonical ending.
- Allowed story work is limited to defects in what already exists: blockers,
  checkpoint/resume failures, pause-time leakage, camera collision, unreadable
  framing, exposure, pacing bugs, input handoffs, and other presentation defects.
- Any copy change inside the existing story requires an explicit owner decision.

### Audio lock

- The current audio and score engine is a protected baseline.
- Do not refactor loading, decoding, streaming, mixing, composition, assets, or
  runtime ownership as part of the demo lift.
- Audio work is regression testing only unless a reproducible demo-blocking bug
  is found and separately approved.
- The protected paths are `main/src/audio/`, `main/src/components/audio/`, and
  `main/public/audio/`.

### Controls lock

- Preserve current desktop movement, mouse look, bindings, sprint feel, ship
  handling, mining, building, and interaction timing.
- The demo lift may improve discoverability, pause/help access, focus handling,
  keyboard navigation, and touch parity.
- No broad remapping system or input rewrite is required for the demo.
- A binding changes only when a demonstrated conflict or broken flow requires it.

## 3. What “Demo Complete” Means

The public path is complete when:

- every visible action works and can be discovered without reading the README;
- every visible recipe or progression promise is currently achievable;
- every unavailable future system is hidden, honestly labeled, or outside the
  public route;
- Story can be started, paused, resumed, completed, revisited, and replayed
  without escaping its intended world or losing its clock/checkpoint state;
- the sandbox has one closed primitive survival loop rather than disconnected
  meters and crafting demonstrations;
- the hero world, water, vegetation, ship, HUD, and current story frames pass a
  real-GPU human visual review;
- graphics tiers materially change live work and keep required resources
  obtainable on every supported tier;
- a clean save survives the story, sandbox loop, reload, ship travel, and return;
- the release passes deterministic client/server checks and browser golden paths.

Completeness comes partly from **hiding unfinished breadth**. The demo should not
expose a future recipe, station, story reward, travel mode, multiplayer promise,
or setting merely because some underlying code exists.

## 4. Selected Delivery Direction

### Selected: Complete opening + honest systems sandbox

- Preserve the current narrative boundary.
- Polish the existing cut rather than extend it.
- Close one primitive systems loop outside the story.
- Make unstable or future-facing breadth unavailable in the public demo.
- Keep sandbox freedom and technical spectacle without presenting it as completed
  narrative progression.

### Rejected: Extend the story to manufacture a finale

Rejected because it would spend narrative capital before the current systems and
story have become the foundation for the remaining work.

### Rejected: Pure technical showcase

Rejected because a menu plus unconstrained sandbox would hide Paravoxia's strongest
identity: the fidelity ladder and the emergence of embodied perception.

## 5. Lift Plan

### Batch 0 — Contract and public-surface truth

Budget: `fast`, approximately 1-2 days.

1. Land the `Make no mistakes` tagline.
2. Record the story, audio, and desktop-control locks in the active design context.
3. Create a public-feature matrix with one status per surface:
   `ship`, `hide`, `label experimental`, or `internal only`.
4. Choose the canonical demo world/seed and one supported default graphics profile.
5. Decide whether Co-op meets the narrow two-player demo gate. If it does not,
   remove it from the public menu without removing the underlying system.
6. Replace player-visible `early build`, placeholder, or future-facing promises
   only when the replacement is truthful and owner-approved.

Gate:

- No visible surface makes a promise the demo cannot fulfill.
- Story/audio/control locks are visible to every future implementation agent.

### Batch 1 — Interruption, controls, and recovery

Budget: `standard`, approximately 2-4 days.

Preserve control feel. Add only the missing product shell:

1. Pause must freeze story time, including A1/A2 transitions and all scheduled
   captions/effects.
2. Active Story cannot use the Star Map or leave the pinned story world through
   pause/settings controls.
3. Add a read-only, mode-aware Controls surface to landing and pause:
   - global;
   - on foot;
   - interaction/survival;
   - build mode;
   - ship flight;
   - touch equivalents.
4. Keep every current desktop binding unchanged unless a failing test proves a
   conflict.
5. Add visible `:focus-visible` treatment, browser zoom, modal focus return, and
   keyboard-operable menu/pause controls.
6. Add touch sprint if mobile remains a supported demo target; otherwise label
   touch/mobile as preview and require only a smoke pass.
7. Resolve completed-save semantics without adding story:
   - continue at the completed site;
   - return to menu;
   - replay from a clean story state.

Gate:

- A player can recover the active control set from pause in one action.
- Pause/resume cannot advance story, leak input, change world, or strand pointer lock.
- Desktop feel and bindings match the baseline.

### Batch 2 — Close the primitive systems foundation

Budget: `deep`, approximately 5-10 days.

Build one narrow loop in Systems Sandbox and, where already appropriate, in the
post-arrival world:

```text
gather wood/fiber/stone
  -> craft primitive tools, waterskin, and campfire
  -> build a sealed shelter
  -> night exposure lowers warmth
  -> shelter and fire restore warmth
  -> gentle downed/recovery state
  -> respawn at shelter or wreck
  -> reload restores the base and player state
```

Required work:

1. Sealed-enclosure detection.
2. Sheltered and near-fire warmth recovery.
3. One understandable night-cold/exposure rule.
4. Demo-level downed/respawn behavior with no corpse or inventory-loss system.
5. Home/rest spawn selection between shelter and wreck.
6. Clean-save and reload persistence for the complete loop.
7. Restrict the portable Fabricator to primitive recipes.
8. Hide Emergent recipes, placeable stations, Maw repair, scanner/warp gates, and
   later-era rewards. They remain future story payoffs.
9. Ensure every required primitive resource is obtainable when visual vegetation
   is disabled by LOW/POTATO profiles.

Explicit deferrals:

- structural integrity;
- corpse recovery;
- multiple building-material tiers;
- broad planetary hazard balancing;
- device crafting;
- Maw repair and era advancement.

Gate:

- The complete loop succeeds from a clean save with no debug commands.
- Every shown primitive recipe is reachable.
- Reload restores the shelter, world edits, inventory, vitals, and spawn truth.

### Batch 3 — Existing-story and hero-route polish

Budget: `flagship`, approximately 4-8 days.

No new story content. Review what exists as a complete cut:

1. Run clean-save manual screenings and repeated movie-mode screenings.
2. Fix only existing-beat defects:
   - unclear goals or interaction prompts;
   - bad camera handoffs/collisions;
   - sky-heavy or subject-empty framing;
   - exposure and transition readability;
   - rough-seed traversal blockers;
   - loading or spawn-settle dead air;
   - pause/resume/checkpoint defects;
   - stalls and timeout rescues.
3. Build a curated demo hero atlas rather than judging every procedural frame equally:
   - landing desktop/mobile;
   - representative 1-bit, raster, color, first-person, A3, vigil, and arrival frames;
   - hero surface, shelter/fire, underwater, ship exterior/cockpit, local departure,
     destination approach, and return;
   - subject occupancy, camera-intersection, exposure, console-error, and human-taste checks.
4. Polish the canonical demo route using existing systems and art language:
   - visible subject/focal hierarchy;
   - coast and water-edge continuity;
   - player/ship/fauna grounding;
   - landmark and negative-space composition;
   - HUD density/readability;
   - collision and interaction reliability.
5. Audio is auditioned during the screening but remains untouched.

Gate:

- Three cold movie runs reach the current `done` state with zero timeout rescues.
- One clean manual run reaches W-7744 with no blocking ambiguity.
- Every hero frame passes headed real-GPU human review.

### Batch 4 — Runtime truth and travel closure

Budget: `deep`, approximately 4-8 days.

1. Make live graphics-profile changes actually reconfigure the scene.
2. Add a HIGH/POTATO browser assertion proving material scene deltas.
3. Route initial/resume/world-jump preparation through the existing worker/hydration
   path; remove long main-thread activation tasks.
4. Add a production failure path around the Canvas/world-ready boundary:
   - immediate first-paint loading shell;
   - render/WebGL error boundary;
   - context-loss handling;
   - 20-second ready watchdog with `Retry` and `Lower Graphics` actions.
5. Complete the current P3/P4 local-system travel gate:
   - source proxy/demotion ownership;
   - target promotion and exact-shell handoff;
   - no black/loading frame or teleport;
   - cold/warm A -> B -> A on supported profiles;
   - persistent edits and pose survive return.
6. If travel cannot pass the gate by demo freeze, hide sibling-planet travel in the
   public demo rather than shipping a visibly incomplete transition.
7. Do not increase the current JS, shader-program, heap, or audio-memory baseline
   without an explicit budget decision.

Gate:

- No cold activation task exceeds 100 ms; the target is the existing <50 ms
  per-feature travel budget.
- HIGH meets the existing >=50 fps / <=24 ms p95 atlas floor on the demo route.
- HIGH and POTATO produce materially different live work.
- The loading shell paints within 1 second on Fast 4G and the reference scene is
  ready within 8 seconds on the reference machine.
- Initial JS stays at or below the current 1.60 MB gzip guard unless a separately
  measured/code-split budget replaces it.
- The audio baseline has no regressions and no protected audio file changed.

### Batch 5 — Demo release candidate

Budget: `standard`, approximately 3-5 days.

Required golden journeys:

1. Fresh Story Demo start -> current arrival -> completed-site continuation.
2. Systems Sandbox primitive loop -> reload -> restored base.
3. Surface -> swim -> surface recovery.
4. Board -> launch -> local travel -> land -> return, if travel ships.
5. Desktop keyboard/mouse pause, controls, modal, and pointer-lock recovery.
6. Mobile/touch smoke if mobile is supported.
7. Two-player create/join/reconnect/travel only if Co-op remains public.

Release checks:

- client and server verify gates;
- story probe and frame strip;
- primitive-loop browser journey;
- profile-delta browser test;
- local-travel probe when enabled;
- persistence/reload proof;
- no console/page errors;
- 20-minute sandbox soak with no context loss and less than 20% settled heap growth;
- headed desktop and mobile screenshot approval;
- deployed live smoke against the exact released bundle.

## 6. Public Feature Matrix

This matrix must be finalized in Batch 0 and kept honest through release.

| Surface/system | Demo target | Rule |
| --- | --- | --- |
| Current Story through W-7744 | ship | polish existing content only |
| Story after W-7744 / A4+ | hide | frozen |
| Systems Sandbox | ship | primitive loop must be complete |
| Current audio/score | ship unchanged | regression testing only |
| Desktop controls | ship unchanged | discoverability and recovery polish only |
| Mobile/touch | ship or label preview | choose after device smoke |
| Advanced/Emergent crafting | hide | future story payoff |
| Maw repair/devices/tech tree | hide | future story payoff |
| Local multi-planet travel | ship only if gate passes | otherwise hide |
| Two-player Co-op | ship only if narrow gate passes | otherwise experimental/internal |
| 3-8 player/MMO features | hide | out of demo scope |
| WebGPU/TSL migration | internal future work | out of demo scope |

## 7. Final Demo Exit Gates

### Narrative and presentation

- No story beat exists beyond the current arrival in the demo lane.
- The current final line, world handoff, persistent landmarks, and completed-save
  behavior work cleanly.
- Three cold movie runs finish with zero timeout rescues.
- Manual owner screening approves the full current cut.

### Systems

- Primitive gather/craft/shelter/warmth/recovery/persistence loop passes from a clean save.
- No visible recipe, station, upgrade, or resource is unreachable.
- Required resources remain obtainable on every supported profile.
- All public interactions have success, blocked, and recovery feedback.

### Controls and accessibility

- Current desktop bindings and feel remain stable.
- All public actions are discoverable from landing or pause.
- Story pause freezes time and cannot open world travel.
- Pointer lock, focus return, keyboard navigation, zoom, and reduced-motion behavior pass.

### Runtime

- Supported profiles meet their frame-time budgets on the canonical route.
- No activation task exceeds 100 ms.
- Boot total blocking time is at most 300 ms on the reference machine.
- Live profile changes produce measurable work/quality changes.
- HIGH -> POTATO settles within 2 seconds and reduces estimated triangles by at
  least 60%, with grass/trees/fauna/expensive effects disabled.
- Mobile MEDIUM, if supported, sustains >=30 fps with <=33 ms p95 at 390x844 on
  a real touch device.
- The production loading shell can recover from scene timeout, renderer failure,
  and WebGL context loss.
- No shader/console/page errors occur on the golden journeys.
- Current audio behavior passes without modifying protected audio paths.

### Release truth

- Every public feature is marked `ship` in the feature matrix.
- Anything else is hidden, explicitly preview/experimental, or internal.
- Client/server verification and deployed smoke pass against the release candidate.

## 8. Explicit Non-Goals

- No uncontracted story content, awakening, canon, dialogue, or later chapter
  may enter the public demo release.
- No audio engine or asset changes.
- No desktop input rewrite or remapping system.
- No new planet/biome breadth solely for the demo.
- No combat system.
- No full structural-integrity/corpse/hazard simulation.
- No Emergent/Paravox Machina progression.
- No MMO hardening or 8-player promise.
- No WebGPU/TSL production migration.

## 9. Resume Here

Batch 2 implementation completed on 2026-07-12. The public field kit now exposes
only six reachable primitive recipes; resource fallback, sealed shelter, warmth,
fire, downed recovery, shelter/landing respawn, build feedback, solo/co-op authority,
and complete reload state are integrated. Active Story retains its authored economy.
Evidence is recorded under
`.codex/design-runs/2026-07-12-primitive-foundation/`.

The deterministic machine gate passes. Final Batch 2 approval remains open because
the extended headless browser run reaches Play readiness but cannot cross the trusted
pointer-lock click; the headed journey is still required. The separate fauna-realism
branch also exceeds its existing triangle-budget test (`1,004 > 800`); do not weaken
that budget as part of this lane.

Resume with the remaining Batch 2 approval gate:

1. rerun `main/tools/primitive-loop-probe.mjs` with a headed trusted pointer-lock click;
2. complete one headed clean-save gather -> craft -> shelter/fire -> night ->
   recover -> reload journey and approve pointer lock, feedback, and feel;
3. resolve the separate fauna triangle-budget regression, then rerun full client verify;
4. only after those gates pass, begin Batch 3 screening of existing Story content.

Do not publish later story or alter the shipped audio baseline through this demo
lane. Post-arrival production proceeds only through its separate lock.
