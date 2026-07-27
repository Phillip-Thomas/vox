# Paravoxia — the Anchorage: station mechanics, NPCs, and the intersystem economy

**Status: PLANNING DRAFT, mechanics-first. Not a production lock.**
Date: 2026-07-27 · Revised same day after owner direction: *"we don't need to overthink the
story connections — let's get the mechanics in place and have something cool to test."*

This plans a deep-space station destination, a trading economy, and an NPC layer including
live model-driven characters. It is deliberately **sequenced to reach a playable, testable
loop as early as possible**, with story and canon deferred until the mechanics tell us what
the place actually wants to be.

---

## 0. The shape of this, in one paragraph

Build the anchorage as a **dev-flag-gated sandbox** (`?anchorage=1`), code-split so it does
not enter the demo bundle at all. No canon, no story beats, no named characters that anyone
has to live with later. Get to *fly there → dock → walk around → trade → talk to someone* as
fast as the architecture honestly allows, instrument it from the first commit, and let the
place earn its fiction by being interesting to play. The architectural decisions that are
expensive to retrofit — the portal graph, the order-book shape of the market, the catalog
codegen, the material budget — get made correctly **now**; everything else can be ugly and
provisional until the loop is fun.

---

## 1. Why the sandbox framing matters

`PARAVOXIA_DEMO_FOUNDATION_PLAN.md` gates *post-arrival story content* and *publishing*. It
does not gate an unreachable development surface. The repo already has the idiom —
`?bench` (`BenchmarkProbe`), `?systemprobe=1` (`SystemTravelProbe`), `?movie=1` (autopilot),
and the `?story=` dev flows — and the sandbox-no-op prime directive is established practice.

So: **the anchorage is a dev surface until someone decides otherwise.** That buys three
things.

- **No story-council dependency.** The A5 decision and the Makers question leave the critical
  path entirely. They become decisions you make later, with a playable thing in front of you,
  which is a much better position to decide from.
- **Much lighter governance.** You are not adding dialogue, lore, a teaser, or a canonical
  ending to the demo. You are adding a dev route. Still keep it honest: it must be
  genuinely unreachable from the shipped build, not merely undocumented.
- **Bundle safety.** Batch-4 holds a **1.60 MB gzip guard**, and a station system plus an
  economy plus an NPC layer will not fit inside the remaining headroom. **Dynamic-import the
  entire anchorage module behind the flag** so the demo bundle is unaffected. This is not an
  optimization to do later — it is the difference between this feature being free and being
  a release blocker.

Two constraints survive the reframing and are worth respecting anyway:

- **Protected audio paths** (`main/src/audio/`, `main/src/components/audio/`,
  `main/public/audio/`) are unchanged. Positional audio does not exist in the codebase and
  lives inside them. **Ship the sandbox text-only**; spatial dialogue is a separate packet.
- **The 77-file uncommitted worktree.** Downgraded from hard blocker to strong
  recommendation, since we are not running a production-lock workflow. But four green-verified
  waves sitting uncommitted while you start a large feature is how you lose a bisect later.
  Commit in coherent batches first; it costs an hour.

---

## 2. What already exists (the seams)

The most useful finding of the survey: **this is far less greenfield than it looks.** The
substrate for multi-system travel, deterministic generation, server authority, and NPC motion
is shipped and tested. What's missing is a market, an interior, and a conversation surface.

| Need | Where it lives | Note |
|---|---|---|
| Multi-body system manifests, deterministic seeds | `main/src/game/starSystem.ts` | `PlanetSlot` is a hard `0\|1\|2` union — widen it or add a parallel body array |
| System-space frame authority | `main/src/state/systemFlight.ts` | Single pose-writer lease; the anchorage must register here |
| Flight/landing/warp state machine | `main/src/state/spaceFlight.ts` | Already has interceptable boarding/exit hooks |
| Physical approach-and-board choreography | `main/src/story/physicalBoarding.ts` | Very close to a docking sequence already — clone the phase machine |
| Distance-driven LOD and residency | `main/src/game/planetResidency.ts` | Body-agnostic; takes an anchorage with almost no change |
| Deterministic worker gen + packed transfer + cache | `main/src/workers/worldPrep.worker.ts`, `utils/worldGenCache.ts` | Reusable for baking interiors |
| Gravity-aligned walking, arbitrary up-vector | `main/src/components/EfficientPlayer.tsx`, `utils/gravityField.ts` | Station-local "down" feeds the same struct |
| Surface A* with injectable terrain interface | `main/src/utils/agentSurfaceNavigation.ts` | Interior nav implements `AgentSurfaceTerrainQuery` |
| A working NPC (body, gait, pathfinding, speech) | `main/src/story/world/AuditWorker.tsx` + `emergentStoryDirector.ts:898` | Director-writes-pose, component-renders. Copy verbatim. |
| Speaker-attributed dialogue delivery | `main/src/story/storyText.ts` — `showAuditLine(text, header, ttl)` | Speaker header already supported |
| Pure, rng-injectable branching engine | `main/src/story/voyageDeck.ts` | Correct skeleton for dialogue trees |
| Single-key contextual interaction | `main/src/game/systems/interactionSystem.ts` | Add IDs and a resolver branch; no new key, no new prompt component |
| Server authority, auth, persistence schema | `server/src/stateServer.ts`, Neon Postgres, 13 tables | Firebase-admin auth and CORS allowlist in place |
| Client/server contract codegen with a verify gate | `shared/economyCatalog.json` → `scripts/generate-economy-catalog.mjs` | Drift structurally impossible. Extend it; never bypass it. |

### Genuinely absent

- **Any market, price, currency, or trade concept** — zero occurrences repo-wide.
  `server/src/economyAuthority.ts` is misnamed: a 2,538-line *stateless command validator*
  with no tick loop and no market state. Excellent anti-cheat, zero economy.
- **Any runtime LLM call.** Neither `package.json` has an AI dependency.
- **Any positional audio.** `playSfx(event)` takes no position; no `PannerNode` anywhere.
- **Any 3D asset.** No GLTF loader, no `SkinnedMesh`, no model file. `main/public/` is 9.4 MB
  of audio and nothing else. Procedural geometry only.
- **Any conversation UI.** Closest is `VoyageWorkerNameInput` (`prologue/VoyageLedger.tsx:455`),
  a mobile-safe, game-input-isolated text field already running a two-turn exchange.
- **Cross-player transfer of anything.** Rooms are isolated islands.

### The real constraint

**High framerate at high fidelity on real target hardware.** That is the goal, and it is the
only thing that gets to gate a decision.

`ATLAS_PERF_BUDGETS` in `utils/proceduralAtlasReport.ts:69` is **advisory telemetry, not a
gate**. `procedural-atlas.mjs` is not in the `verify` chain, and when run manually it exits
nonzero only on console/page errors — budget overruns are written into a `defects.md` report
and nothing else. The table exists to keep contributors from being casually wasteful with
compute. It is a smoke alarm, and a rough one. Designing the architecture around staying under
a number in it would be optimizing the instrument instead of the system, and the numbers
themselves should be revised upward as the engine earns it.

For reference rather than as a limit: HIGH currently reports 145 draws, 988,566 triangles, 41
shader programs against advisory figures of 440 / 4.2M / 46.

**What actually costs frames**, roughly in order of how much they matter here:

1. **Batch count** — CPU submission plus GPU state changes. The dominant cost in WebGL, and
   the thing portal culling and `BatchedMesh` exist to attack.
2. **Overdraw and fill rate** — transparency, volumetrics, and fullscreen post passes, priced
   per covered pixel. This is what actually kills mobile, where tile-based deferred GPUs punish
   render-target switches and transparent layering hard.
3. **Fragment shader cost** on the pixels that survive — ALU and texture fetches times coverage.
4. **Vertex throughput**, only where geometry is genuinely heavy.
5. **Shader compilation stalls** — one-time jank on first appearance, not steady-state
   framerate, and properly solved with `compileAsync()` during the dock sequence rather than by
   having fewer shaders.

Shader *program count* barely appears on that list. It matters for compile stalls (solved
above) and a little memory. It is a proxy for material sprawl, which is worth watching, but it
is not a frame-time cost in itself, and optimizing it directly trades away fidelity for nothing.

---

## 3. Art direction (borrowed, not committed)

Three directors independently authored full station theses; all three are preserved in
`.codex/design-runs/2026-07-27-anchorage-directions/`. With story deprioritized, we are not
choosing a *story* — we are choosing a **look and a spatial program** to build against, and
we can change our mind later at low cost.

**Build against "The Stacks"** (direction C), for reasons that are mechanical rather than
narrative:

- **It is by far the cheapest to render at the largest apparent scale.** The structure is a
  light-eating, near-zero-albedo, low-poly *absence*; everything visible is human clutter
  bolted onto it — crates, rails, pipes, scaffold, desk lamps. That is exactly what procedural
  box geometry is best at, and it means the triangle budget goes where it reads.
- **Its central mechanic is free and generates the economy's drama.** The structure silently
  re-files its own volumes on a published schedule. Those are transform matrices. They are
  also, conveniently, the market's shock events (§5) — the thing the economy research says
  matters more than elegant production chains.
- **Its spatial program is a clean test harness**: `Apron` (dock) → `Counter` (trade tutorial,
  as a corridor so it can't be skipped) → `Floor` (the market, staged as an open-plan office
  — a grid of desk lamps on a dark plain) → `Shelves` (warehousing, in the volumes that move)
  → `Blank` (sealed, for later). Five cells, each legible at a glance, each testing something
  different.

**No canon is being committed.** NPCs get functional placeholder identities. Nothing here
forces a decision about the Makers, about A5, or about where this sits in the arc. If the
mechanics later suggest a different fiction — or if you prefer direction A's exterior reveal
or B's suspended-cargo hero image — the plan below survives the swap with only this section
and the dressing changing.

---

## 4. Generator and renderer

Build the generator, not the station. Ship one hand-tuned instance as its first output. But
in the mechanics-first ordering, the generator starts *dumb* — a fixed macro layout with
seeded dressing — and grows knobs in Phase F.

**Naming:** `main/src/game/data/stations.ts` already exists and means *crafting* stations
(`hand`, `smelter`, `assembler`, `survey_console`). Do not overload the noun. Use
**`anchorage`** throughout.

### The portal/cell graph is the keystone

**The single highest-leverage decision in this document, and the one thing that must be right
in Phase A.** Have the generator emit the cell/portal adjacency graph as a first-class
artifact. That one structure solves four problems:

1. **Visibility.** Three.js has no occlusion culling and won't get it. Classic portal culling
   — BFS from the camera's cell, clip each portal's screen-space AABB against the accumulated
   frustum rect, stop when it degenerates — is exact, cheap, CPU-side, and avoids the 1–2
   frame readback latency that makes GPU occlusion queries pop.
2. **Streaming.** Residency ring of 2 cells, evict beyond 3. Airlocks and elevators are
   deliberate load-hiding devices.
3. **Light-probe placement** — one per cell, automatic.
4. **Audio reverb zones** — one impulse per cell type, when audio is eventually in scope.

This is why a procedural station can *beat* a hand-built one rather than approximate it: the
generator knows adjacency that a hand-built level would have to be annotated with.

### Materials and batching

The goal is **few batches**, not few shaders. Those are different things and conflating them
costs fidelity for no framerate.

**Share one material across the repeated architectural kit** — wall panels, grates, rails,
scaffold, crates — and drive per-piece variation through instance attributes (tint, roughness,
wear, atlas region, emissive mask) read at runtime. The win is that the entire kit collapses
into a handful of `BatchedMesh` draws. `BatchedMesh` allows different geometries in one draw
call with per-instance visibility and frustum culling; identical repeats stay `InstancedMesh`.
A 40-cell station should render its architecture in tens of batches, not hundreds.

**Spend dedicated shaders freely wherever a distinct look needs one.** The light-eating hull
with view-dependent parallax, glass, emissive strips, volumetrics, water, the post chain —
each of these is *cheaper per pixel* as a specialized shader than as another branch in a
mega-shader. GPUs execute in lockstep across a wave, so a branchy uber-shader makes every
pixel pay for paths it doesn't take. Collapsing genuinely different materials into one program
is a pessimization dressed as an optimization.

The discipline worth keeping is the ordinary one: don't let *accidental* material variants
proliferate (a stray `transparent` flag or an inconsistent map assignment forking a program
that didn't need to exist), and precompile everything during docking. Deliberate,
fidelity-bearing shaders are a cost worth paying and should be paid.

### Lighting — build the hooks early, land the bake late

Baked lighting fights procedural generation. The resolution is per-module baked AO in local
space (survives arbitrary reassembly), plus a **bake-on-load** pass for the assembled station:
render a cheap cubemap per probe point, project to SH-L2, store an irradiance volume, and
**cache to IndexedDB keyed by seed** so a revisit is free. Budget 1–3 s during the dock
sequence — which is what the dock sequence is *for*.

**This is the step that makes it stop looking like real-time Three.js, and it is the step
most likely to be cut under schedule pressure.** In a mechanics-first ordering it lands in
Phase E, which is fine — but the *hooks* (probe points emitted from the portal graph, a
lighting-data slot in the cell payload, the IndexedDB cache key) must exist in Phase A or
Phase E becomes a retrofit instead of a fill-in.

### Scale and awe (Phase E, but design for it now)

Per-cell exponential fog with coloured extinction; instanced dust motes with parallax;
portal-gated god rays; three depth planes on every long sightline; human-scale referents
everywhere — 1.0 m handrails, 2.1 m doorframes, known-height signage. A featureless 200 m wall
reads *smaller* than a 50 m wall with three doors in it. Interior FOV 55–65°, hero reveals
40–50°, zero roll except as a deliberate beat.

### Two cheap decisions with long tails

- Use `renderer.compileAsync()` with `KHR_parallel_shader_compile` to warm material variants
  during docking. First-entry jank would undo the reveal.
- **Author new materials in TSL/NodeMaterial, not raw GLSL.** Ship `WebGLRenderer`. WebGPU is
  ~84% available with Linux Firefox still pending and a fallback backend that isn't reliably
  as fast, so don't bet on it — but TSL keeps the eventual port cheap for free.

---

## 5. The economy

### The model: reservoir pricing exposed as a finite-depth order book

Every market holds `stock` per commodity; price comes from a convex reservoir curve; the
server publishes that curve as a **quantised NPC order ladder**; all trades execute against
**one matching engine**.

```
fill = clamp(stock / capacity, 0, 1)
p    = p_min + (p_max - p_min) * (1 - fill)^k        // k ≈ 1.5–2.5
```

Single-player is the multiplayer engine with only NPC orders in the book. **When players
arrive, nothing is deleted — you just stop being the only participant.** This is the entire
reason to pick this shape over something simpler, and it satisfies the "build so cross-player
works later" requirement without building any of it now.

### Three mechanics, in this order

1. **Integral pricing with finite depth.** Never transact N units at spot — charge
   `∫ p(s) ds` across the quantity. Roughly five lines, and it delivers price impact,
   diminishing returns, bot resistance, and multiplayer-safety at once. **Every NPC quote
   carries a finite quantity from commit one.** An NPC that buys unbounded quantity at a fixed
   price is a money printer the day players can trade, and a lookup table before that.
2. **Lazy closed-form catch-up plus an event shock queue.** Store
   `(stock, lastUpdatedTick)`; integrate forward on read:
   `s = s_eq + (s - s_eq) * exp(-dt / τ)`. O(1) per commodity per visit, deterministic,
   replayable, and it gives a galaxy of live markets for near-zero CPU. **No continuous
   per-station tick, ever.** Ship the shock queue *before* pretty production chains — a static
   chain with a war on feels alive; a perfect chain at equilibrium is a lookup table. The
   resettlement events are the shock queue.
3. **Stale, partial, purchasable market information.** Store
   `(price, observedAtTick, confidence)` per player per market. A six-hour-old quote three
   jumps away is a bet, not a fact. Converts trading from arithmetic into judgment, and costs
   almost nothing.

### System identity

Four axes combined by seed: **endowment**, **industry tier**, **population** (the demand
faucet that never sleeps), **regime** (tariffs, contraband, accessibility).
`main/src/game/data/planetArchetypes.ts` and `biomes.ts` already carry per-archetype resource
affinity — the differential scarcity exists and simply has no price layer on it.

Legibility is a requirement, not polish: one-line archetype label, two glyphs on the map pin
(top export, top shortage), **colour the deficit rather than the price**, days-of-cover as a
bar rather than a number. If the player has to read a table, they'll build the wiki and play
that instead.

### Where it lives

- **Commodities extend `shared/economyCatalog.json`** — already the single source of truth,
  codegenned into client and server, gated by `catalog:check` in both verify scripts. Never a
  parallel registry.
- **The market is new server state.** Add a sibling `marketAuthority.ts`; leave
  `economyAuthority.ts` stateless.
- **Cargo capacity must become real.** `inventorySystem.ts` is a flat count map with no stack
  limits, weight, or capacity. Profit-per-m³-per-jump is the interesting quantity and doesn't
  exist until capacity does.
- **Persistence.** The Neon schema exists but `DATABASE_URL` appears unset on Cloud Run, so
  production is likely running in-memory rooms with the persistence layer written but
  unengaged. For a sandbox this is fine — **run the economy client-side-authoritative or
  in-memory in Phase B** and wire durable persistence only when it stops being a toy.

### Sinks from day one

Fuel, repairs, docking fees, tariffs, and a transaction tax that is **deleted, not paid to
anyone**, scaling with activity rather than flat. Log every faucet and sink by category from
the first commit — by the time inflation is visible in play, it's a year of accumulated
currency and the only fixes left are unpopular.

---

## 6. NPCs

**Authored NPCs remember. Model-driven NPCs have opinions about prices.**

With story deprioritized this split gets *more* attractive, not less: the model tier
substitutes for authored content, so a sparse sandbox can feel populated without anyone
writing a character bible. Phase C can ship with almost no authored dialogue — enough to prove
the interaction and delivery path — and let Phase D do the heavy lifting.

**Bodies and motion:** extend the existing pattern rather than inventing one.
`AuditWorker.tsx` (box humanoid, hand-written sine gait, module-level pose written by a
director, component only renders) plus `emergentStoryDirector.ts:898` (`moveAuditor`: A* route,
arc-length sampling, rate-limited heading) is a working NPC and is copyable verbatim. Crowd
individuality is procedural — one silhouette varied by gait parameters and badge geometry.
Interior navigation implements the existing `AgentSurfaceTerrainQuery` interface.

There is no behaviour tree or planner anywhere in the codebase, only per-beat `switch`
directors. Extend the director pattern; don't import a BT library for this.

---

## 7. AI-powered NPCs

Highest-risk element here, and the one that most needs its contract right the first time.

### Architecture

Add `POST /v1/npc/converse` to `server/src/stateServer.ts`. The seam is genuinely ready: a
versioned `/v1/*` REST namespace, Firebase-admin bearer auth, a CORS origin allowlist, and
Node ≥22 with native `fetch` all already exist. This is a small change to a well-shaped server.

`ANTHROPIC_API_KEY` is a Cloud Run server-side env var. **Never a `VITE_*`** — those are
public by definition. The client never talks to a model provider directly. Default to the
latest Claude models.

### Four containment rules

1. **Constrain the output surface, not just the prompt.** The model fills fields in a
   structured response — an offer, a refusal, a short line of flavour — rather than emitting
   free prose into the world. Caps cost, caps drift, makes validation mechanical.
2. **Bounded context.** The model gets a local fact table (prices, schedules, recent events)
   and its own character sheet. Not the story bible — which, conveniently, we are not writing
   yet.
3. **Authored fallback on every failure.** Timeout, error, rate limit, or a response failing
   validation falls back to canned dialogue. The feature degrades to a working game, never a
   broken one.
4. **An in-world reason the NPCs are unreliable.** Give the sandbox a diegetically noisy
   information environment — rumour, stale prices, gossip — so model drift reads as texture
   rather than as a bug. This is nearly free and it is the difference between "the NPC said
   something odd" being charming and being a defect.

*(Deferred until there is canon to protect: the register lock — model NPCs get the REGULATION
voice only, never AWAKENING — and blindness-as-prompt-boundary. All three directors converged
independently on that pair, so adopt both the moment story work resumes. Noted here so it
isn't rediscovered later.)*

### Determinism is a real conflict, not a theoretical one

`npm run verify` chains `story:authority`, `chapter:journey:check`, `catalog:check`, and a
full 1,930-test vitest suite, against a codebase that treats determinism as a contract. **A
live model call will fail these gates.**

Build a **fixture/transcript mode from day one**, following the precedent already set by
`voyageDeck`'s injected `rng`: CI and movie-mode replay recorded transcripts; only live play
calls the model. Cheap to build first, genuinely painful to retrofit.

### Cost, latency, and audio

Per-conversation token budget, a hard turn cap, prompt and fact-table caching, and a
per-session spend ceiling. Hide latency diegetically — a clerk consulting a ledger before
answering is in character; a spinner is not. **Text-only for the sandbox**; positional audio
is greenfield *and* inside a protected path, so it is a separate packet.

---

## 8. Phasing

Reordered for "something cool to test." Each phase ends in a **playable check**, not a
document.

**Phase 0 — Housekeeping (~1 hour).** Commit the 77-file worktree in coherent batches.
Confirm verify green from a clean tree.
*Check: clean tree, verify green.*

**Phase A — Get there and walk around.** The skeleton, and the phase that must be
architecturally correct because everything else hangs off it.
- `anchorage` addressing in `starSystem.ts`; registration in `systemFlight.ts`;
  `beginDock()`/`undock()` cloned from `physicalBoarding.ts`; residency integration.
  - **Done:** the dock choreography itself — `anchorageDock.ts`, a pure phase machine
    (clamps → pressurise → hatch → disembark → handback) shaped after
    `physicalBoarding.ts`, driving the camera dolly and the lock readout, skippable,
    frame-rate independent, 15 tests. `&dock=0` bypasses it for captures.
  - **Done:** prop collision — `anchorageCollision.ts`. Swept, axis-separated slide
    against a bucketed blocker index, plus step-up, standing on props and headroom.
    Walls and doorways stay with the cell/portal graph; furniture only narrows.
  - **Not done:** the *fly-to*. The anchorage still has no presence in
    `systemFlight.ts` and no exterior, so you cannot approach it from space. The dock
    sequence is written to be the thing that flight hands off to when that lands.
- Greybox interior: the five-cell program from §3, **emitting the portal/cell graph**, portal
  culling, `BatchedMesh` batching, station-local gravity through the existing `SurfaceState`.
- Dev flag + dynamic import; lighting-data hooks stubbed but empty; instrumented from the
  first commit.
- *Check:* **fly there, dock, walk in, walk around five distinct spaces, walk out, fly away.**
  Draws/tris/programs/p95 measured on HIGH, an iGPU, and a mid Android device.

After Phase A the work splits into **two tracks that do not block each other** and should run
concurrently. The systems track is data and server work; the fidelity track is rendering work.
Serializing them was an error in the previous revision — they touch different files and answer
different questions.

### Track 1 — systems (is it fun?)

**B — Make trade real.** Catalog extension, `marketAuthority.ts`, integral pricing with finite
depth, lazy catch-up, the shock queue, cargo capacity, minimal legible UI, faucet/sink
telemetry. In-memory or client-authoritative; durability comes later.
- *Check:* **a route is profitable, then measurably less profitable because you traded it.**
  A shock event visibly moves a price.

**C — Populate it.** NPC bodies, interior nav, the interaction prompt, dialogue delivery
through `showAuditLine` and the deck engine. Minimal authored content — enough to prove the
path.
- *Check:* **the place feels inhabited rather than empty.**

**D — The AI tier.** Server proxy, the four containment rules, fixture mode, cost ceilings,
fallback. With no canon to protect this is *lower* risk now than it would be later.
- *Check:* **haggling feels alive and surprising**; `verify` green in fixture mode; every
  failure path degrades to canned dialogue.

### Track 2 — fidelity (is it beautiful?)

**E1 — One hero cell at target quality.** Take a single space — the Floor is the obvious
candidate — and push it to the look you actually want, with real lighting, materials,
atmosphere, and scale referents. Do this **early, not last.** It sets the bar the kit has to
reach, proves the aesthetic works at all, and is far cheaper to iterate on one cell than on
forty. This is the phase that decides whether the whole thing is worth building.
- *Check:* **a fresh viewer calls it breathtaking without being prompted**, and it holds frame
  rate on the worst target device.

**E2 — The lighting pipeline.** Bake-on-load GI with the IndexedDB seed cache, probe placement
driven off the portal graph, reflection probes per cell. This is the difference between
"award" and "nice Three.js demo," and it is architectural rather than cosmetic.
- *Check:* warm revisit is free; cold bake fits inside the dock sequence; the hero cell's look
  survives being generated rather than hand-placed.

**E3 — Atmosphere and scale as systems.** Per-cell fog with coloured extinction, dust,
portal-gated god rays, the human-referent prop library. Owned and budgeted, not bolted on.

### Converge

**F — The generator.** Grow the knobs: primitive vocabulary, occupancy ratio, sort key,
dressing. Second and third instances from different seeds.
- *Check:* **a fresh viewer can't tell which instance was hand-tuned.**

### How the perf checks actually work

Every check above is measured, not asserted against a table. Capture frame time on the three
targets that matter — a discrete GPU, an integrated GPU, and a mid-range Android device — at
the fidelity you intend to ship, using the existing harness (`BenchmarkProbe`,
`ProfiledSystemSubsystem` spans, `React.Profiler`). Look at the p95 and the shape of the frame,
not just the average.

When a number in `ATLAS_PERF_BUDGETS` is exceeded but the frame time is good on real hardware,
**raise the number and note why.** That table should track what the engine has earned, not
constrain what it's allowed to attempt.

---

## 9. Decisions still worth making early

Story decisions are deferred by your call. These are not story decisions and they get more
expensive with every phase:

1. **Kit material strategy.** One shared material with instance-attribute variation for the
   repeated architecture (so it batches), plus dedicated shaders for the genuinely distinct
   surfaces. Worth settling before the kit exists, because instance attributes are awkward to
   retrofit onto geometry authored without them. Not a budget question.
2. **Confirm the anchorage is dev-flag-gated and dynamically imported.** Blocks Phase A
   scaffolding. Recommendation: yes to both — mostly so the demo bundle doesn't carry a
   feature its players can't reach.
3. **Positional audio in or out?** Recommendation: out for now — greenfield and inside a
   protected path. Worth revisiting on its own merits, since spatialized sound is one of the
   highest-ROI fidelity levers available and the station is the right place to want it.
4. **Economy durability in Phase B — in-memory, or wire `DATABASE_URL` on Cloud Run?**
   Recommendation: in-memory for the sandbox; revisit when it stops being a toy.
5. **Target hardware.** Name the three devices the perf checks run on, once, so "high FPS"
   means something specific and every later decision can be measured against it.

Everything else — A5, the Makers, which direction becomes canon, whether this is even in the
same continuity — can wait until there's something to play.

---

## 10. Top risks

| Risk | Why it bites | Mitigation |
|---|---|---|
| **Batch count, overdraw, fill rate** | The actual frame-time costs, especially on mobile tile GPUs | Portal culling + `BatchedMesh`; watch transparent and volumetric layering; measure on device (§2) |
| **Optimizing the instrument** | Advisory budgets get mistaken for gates and quietly cap ambition | Budgets are telemetry; raise them when real hardware says the engine earned it (§8) |
| **Bundle bloat** | This feature is large | Dynamic-import behind the dev flag (§1) |
| **Lighting becomes a retrofit** | Deferring the bake makes it a rewrite instead of a fill-in | Emit probe points and cache keys from the portal graph in Phase A; run track 2 concurrently |
| **Live model calls break determinism gates** | `verify` runs 1,930 tests and three determinism gates | Fixture/transcript mode built first, per `voyageDeck` precedent |
| **Unbounded NPC liquidity** | Money printer the day players trade | Finite depth on every quote from commit one |
| **Economy solved and then boring** | Static optima are publishable | Shocks faster than relaxation, plus price impact from the player's own trades |
| **Generated mush** | Valid topology, no landmark hierarchy | Authored macro layout, one silhouette-dominant landmark per deck as a generator assertion |
| **LOW tier forks and rots** | Bar set on a good GPU, mobile hits the tile-GPU cliff | Quality tier is a data object the generator consumes; one scene graph, never two |
| **Sandbox leaks into the demo** | Dev routes have a way of shipping | Make unreachability a test, not a convention |

---

## 11. Summary

Get to *fly there, dock, walk around, trade, talk* as fast as honestly possible, behind a dev
flag, code-split, with no canon attached — then run the systems track and the fidelity track
concurrently, because they answer different questions and don't block each other.

Four things must be right early because they are expensive to retrofit: the portal/cell graph
(it solves visibility, streaming, light probes, and reverb in one artifact), the order-book
shape of the market (so the eventual cross-player economy is the same code path),
instance-attribute variation on the kit geometry (so the architecture batches), and fixture
mode for the model calls (so live AI doesn't fight the determinism gates). Everything else can
be provisional.

The bar is high framerate at high fidelity on named hardware, measured. Advisory budgets in
the repo are there to keep contributors from being casually wasteful; they are not the target,
and where the engine outgrows them the right move is to raise them and say why. Spend compute
where it produces perceived quality — lighting, atmosphere, materiality, sound — and take it
back from batch count and overdraw, which cost frames without buying anything.
