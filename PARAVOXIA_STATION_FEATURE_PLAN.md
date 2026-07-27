# Paravoxia — Deep-Space Station, NPCs, and the Intersystem Economy

**Status: PLANNING DRAFT. Not a production lock. Nothing here is authorized for implementation.**
Date: 2026-07-27 · Branch: `agent/paravoxia-story-audio-world-update`

This document plans a new destination type (a deep-space station), a robust NPC layer
including live model-driven characters, and an intersystem trading economy. It is written
to be consumed by the Terra orchestration route described in §9 — it is preproduction
material, not a scene contract and not a signed authority.

---

## 1. What is permitted right now

`PARAVOXIA_DEMO_FOUNDATION_PLAN.md` remains the binding release gate, as amended by the
**Owner Lane Override of 2026-07-13**. Reading it precisely:

**Permitted today.** Agent definitions, production workflow, scene contracts, continuity
docs, review artifacts, non-mutating validation, and drafting a future scene *provided it
is not represented as shipped*. This document sits squarely inside that permission.

**Gated.** Implementation of any post-arrival content requires a **new owner-signed
production lock** with `mutationBoundary` widened past `planning-only`. Publishing requires
that lock's gates *plus* the four open demo gates (`headed-primitive-journey`,
`fauna-triangle-budget`, `full-client-verify`, `batch-3-existing-story-screening`) *plus* a
separate owner publish decision.

**Protected paths — exactly three.** `main/src/audio/`, `main/src/components/audio/`,
`main/public/audio/`. Regression testing only, unless a reproducible demo-blocking bug is
found and separately approved. **This matters more than it looks:** §7 requires positional
audio, which does not exist anywhere in the codebase today and which lives inside a
protected path. Treat that as a separately-negotiated carve-out, not as part of the station
work packet.

**Hard blocker for any production run.** The worktree currently carries **77 uncommitted
files** across four green-verified waves — 29 in `main/src/story`, 21 in
`main/src/components`, 15 in `main/src/audio`. The `lock-production-scope` step cannot
certify a dirty worktree, and `CLAUDE_FABLE_HANDOFF_2026-07-20.md` warns that `HEAD` does
not represent current behavior. **Commit in coherent batches before anything in this
document begins.**

---

## 2. What already exists (the seams worth knowing)

The single most important finding of this survey: **this feature is far less greenfield than
it appears.** The substrate for multi-system travel, deterministic generation, server
authority, and NPC motion is already shipped and tested. What is missing is a market layer,
an interior, and a conversation surface.

### Already shipped and directly reusable

| Need | Where it lives | Note |
|---|---|---|
| Multi-body system manifests, deterministic seeds | `main/src/game/starSystem.ts` | `PlanetSlot` is a hard `0\|1\|2` union — must widen or add a parallel body array |
| Canonical system-space frame authority | `main/src/state/systemFlight.ts` | Single pose-writer lease; a station must register here |
| Flight/landing/warp state machine | `main/src/state/spaceFlight.ts` | Has interceptable boarding/exit hooks already |
| A physical approach-and-board choreography | `main/src/story/physicalBoarding.ts` | Near-perfect template for dock → airlock → step out |
| Distance-driven LOD and residency | `main/src/game/planetResidency.ts` | Body-agnostic; takes a station with almost no change |
| Deterministic worker generation + packed transfer + cache | `main/src/workers/worldPrep.worker.ts`, `utils/worldGenCache.ts` | Reusable for baking station interiors |
| Gravity-aligned walking with arbitrary up-vector | `main/src/components/EfficientPlayer.tsx`, `utils/gravityField.ts` | Station-local "down" feeds the same struct |
| Surface A* with an injectable terrain interface | `main/src/utils/agentSurfaceNavigation.ts` | Station interior nav implements `AgentSurfaceTerrainQuery` |
| A working NPC (body, gait, pathfinding, dialogue) | `main/src/story/world/AuditWorker.tsx` + `emergentStoryDirector.ts:898` | Director-writes-pose / component-renders. Copy this pattern. |
| Speaker-attributed dialogue delivery | `main/src/story/storyText.ts` (`showAuditLine(text, header, ttl)`) | Already supports a speaker header |
| Pure, rng-injectable branching card engine | `main/src/story/voyageDeck.ts` | The correct skeleton for authored dialogue trees |
| Single-key contextual interaction | `main/src/game/systems/interactionSystem.ts` | Add IDs + a resolver branch; no new key, no new prompt |
| Server authority, auth, persistence schema | `server/src/stateServer.ts`, `persistence.ts`, Neon Postgres, 13 tables | Firebase-admin auth and CORS allowlist already in place |
| Client/server contract codegen with a hard verify gate | `shared/economyCatalog.json` → `scripts/generate-economy-catalog.mjs` | Drift is structurally impossible. Extend this, never bypass it. |

### Genuinely absent

- **Any market, price, currency, or trade concept.** Zero occurrences repo-wide.
  `server/src/economyAuthority.ts` is misnamed: it is a 2538-line *stateless command
  validator* with no tick loop and no market state. It is excellent anti-cheat scaffolding
  and it is not an economy.
- **Any runtime LLM call.** Neither `package.json` has an AI dependency. Dev-time agent
  tooling is extensive; shipped-game AI is nil.
- **Any positional audio.** `playSfx(event)` takes no position. No `PannerNode`, no
  `AudioListener` anywhere. Spatial dialogue is greenfield *and* inside a protected path.
- **Any 3D asset.** No GLTF loader, no `SkinnedMesh`, no model file. `main/public/` is 9.4 MB
  of audio and nothing else. The aesthetic contract is procedural geometry only.
- **Any conversation UI.** Closest precedent is `VoyageWorkerNameInput`
  (`prologue/VoyageLedger.tsx:455`) — a mobile-safe, game-input-isolated text field that
  already runs a two-turn exchange.
- **Cross-player transfer of anything.** Rooms are isolated islands. A market needs a
  shard-transcending ledger, which does not exist.

### The binding technical constraint, and it is not what you would guess

The HIGH-tier budget (`utils/proceduralAtlasReport.ts:69`) is 440 draw calls, 4.2M triangles,
**46 shader programs**. Currently measured: 145 draws, 988,566 tris, **41 programs**.

Draw-call and triangle headroom is comfortable (~295 draws, ~3.2M tris). **Shader program
headroom is five.** All three creative directions independently estimated they needed
about five new programs, which means the station consumes the entire remaining program
budget with zero margin for the economy UI, the NPC crowd, or any later feature.

This is the number that will actually bite. Two options, and the owner should pick one
before the kit is designed:

1. **Design to one uber-material** for the station kit, varying appearance by per-instance
   attributes rather than by `defines` permutations (every `defines` permutation is another
   program). Budget: 2 programs for the whole station.
2. **Deliberately raise the HIGH program budget** as a recorded, owner-approved baseline
   change, with a stated new ceiling.

Option 1 is strongly preferred. Option 2 without option 1 will simply defer the same wall.

---

## 3. Creative direction

Three independent directors each authored one strongly-committed thesis, without sight of
each other's work. All three are genuinely good and none is a safe default. Summaries here;
the full treatments should be preserved as run artifacts.

### A — **The Agreement** (`RECONCILIATION WORKS R-4180`)

A clearing house where two star systems reconcile their books. The Regulation's voice turns
out to be *composed* — aggregated from pooled worker telemetry and read back to the workers
as instruction. There is no author anywhere in the building. Terra was never the audience;
Terra is an input. Colossal exterior (a kilometres-long amber "strike cycle" of stamping
cells) resolving to a mundane 2.4 m office corridor.

*Strongest:* the exterior reveal, and the thematic gut-punch of a power with no one at the
top. *Weakest:* commodities (`attestation`, `latency`, `variance`) are abstract and risk
failing the legibility bar. Its dock sequence removes player control, which the
player-experience-auditor lane would flag.

### B — **The Remainder**

A station physically assembled from accounting residue — the 0.4 of a container, the pallet
written down twice. Not lawless: drowning in *handmade* law, twelve currencies because
twelve people each decided what value was. Freedom is not the absence of the form; it is
holding the pen. Introduces a third register: REGULATION form, AWAKENING content — caps-and-
monospace bills of lading filled in by hand with jokes in the margin.

*Strongest:* the best single image of the three (standing on the floor of a 180 m hold
looking up through a slowly rotating cloud of suspended cargo, warm sodium light rising into
one cold star-shaft) and the warmest emotional register. Also the best LLM cost control —
the model fills fields in a contract template rather than speaking prose. *Weakest:* the
"no cool light indoors" law is too absolute to survive a generator.

### C — **The Stacks** ← **recommended**

A city-sized structure of unknown authorship that is not a ruin or a temple but a **sorting
apparatus**: on a published schedule, it silently re-files its own volumes. Everyone treats
this as weather. The Regulation has stamped it as a service and built its offices, queues,
and bonded warehouses in the gaps. Terra — a *route intelligence*, an entity whose whole
nature is indexing and lookup — walks in and recognises what nobody else can perceive: this
is a query being answered. The cubicle thesis carried to its endpoint: administrations all
the way down, each moving into the last one's filing cabinet and calling it real estate.

**Why it wins.**

- **Its fiction natively generates the mechanic the economy needs.** The single most
  important finding of the economy research is that equilibrium kills trading, and that
  *event-driven shocks* — not elegant production chains — are what make a market feel alive.
  The Stacks' resettlement events **are** the shock queue. Fiction and simulation are the
  same object, which is rare and worth a great deal.
- **It is the cheapest direction to render at the largest apparent scale.** The artifact is
  a light-eating, near-zero-albedo, low-poly *absence*. The triangle budget goes entirely to
  human clutter — crates, rails, pipes, boxes — which is precisely what procedural box
  geometry is best at. Resettlements are transform matrices.
- **It has the strongest containment story for model-driven NPCs.** The station's
  information environment is *diegetically unreliable*, so model drift and confabulation
  read as market gossip rather than as a defect. This converts the single riskiest part of
  the whole feature from a failure mode into flavour. Nothing else on the table does that.
- **It generalises best.** Three independent generator knobs — primitive vocabulary (stacked
  slabs / nested shells / continuous helical void), sort key, and occupancy ratio
  (settlement volume ÷ enclosed volume, which alone swings an instance from boomtown to
  ghost town).
- **Its economy is the most legible and the most thematic.** `allowances` — the tradeable
  right to produce — is literally the buying and selling of cubicles. The player learns in
  the wallet that value is an administrative fiction.

**Graft from the runners-up** (synthesise from the winner, keep the best of the rest):

- From **B**: the model-fills-a-form output surface (§7), and the third register as a
  physical prop.
- From **A**: the hard rule that model-driven NPCs may never use the awakening voice.
- From **B**: an A5 seed visible from hour one and unreachable.

**Reject:** A's forced loss of player control at dock. B's absolute warm-light law.

**Preserved dissent.** A's exterior reveal is better than C's, and B's hero image is better
than C's. If the owner's taste runs toward spectacle over ideas, B is the stronger pick and
the plan below survives the substitution with only §4 and §6 changing.

---

## 4. The station generator

Build the generator first and ship one hand-tuned station as its first instance. Do not
build a one-off and retrofit.

**Naming.** `main/src/game/data/stations.ts` already exists and means *crafting* stations
(`hand`, `smelter`, `assembler`, `survey_console`). Do not overload the noun. Use
**`anchorage`** for the new destination type throughout.

### The macro-graph hybrid

Pure procedural layout produces topologically valid, visually monotonous mush. What ships in
practice — Starfield's POIs, Deep Rock's carved caves — is authored macro structure with
generated fill. Adopt that:

- **Authored graph templates** define district sequence, landmark placement, and sightline
  intent: `Apron → Counter → Floor → Shelves → Blank`.
- **The seed chooses** which template, which modules fill each node, dressing, damage state,
  palette, lighting mood, and occupancy ratio.
- **Landmark rule:** every deck contains exactly one silhouette-dominant element visible from
  at least two other cells. Enforce this as a generator assertion, not a guideline.
- Use WFC for *surface dressing* only (panel layout, pipe runs) — never for level layout.
- Socket-typed modular kit (`corridor-2m`, `airlock-round`, `hangar-wide`) so geometry stays
  watertight under arbitrary assembly.

### The portal/cell graph is the keystone

**This is the highest-leverage architectural decision in the document.** Have the generator
emit the cell/portal adjacency graph as a first-class artifact. That single data structure
solves four separate problems at once:

1. **Visibility.** Three.js has no occlusion culling and will not get it. Classic portal
   culling — BFS from the camera's cell, clip each portal's screen-space AABB against the
   accumulated frustum rect, stop when it degenerates — is exact, cheap, CPU-side, and free
   of the 1–2 frame readback latency that makes GPU occlusion queries pop.
2. **Streaming.** Residency ring of 2 cells, evict beyond 3. Airlocks and elevators are
   deliberate load-hiding devices.
3. **Light-probe placement.** One irradiance probe per cell, placed automatically.
4. **Audio reverb zones.** One impulse per cell type.

Procedural generation is normally a cost paid against hand-built quality. Here it is the
reason the station can outperform a hand-built one, because the generator *knows* the
adjacency a hand-built level would have to be annotated with.

### Batching and materials

One `BatchedMesh` per cell per material class (opaque hull / emissive / glass / alpha-test).
`BatchedMesh` — unlike `InstancedMesh` — allows different geometries in one draw call with
per-instance visibility and frustum culling. Truly identical repeats (bolts, rails, lights)
stay `InstancedMesh`. Target 60–150 draw calls for a 40-cell station.

Given the five-program ceiling in §2, the material taxonomy must be decided **before any
geometry is authored**, and it must be ≤2 programs achieved through per-instance attributes
rather than shader variants.

### Lighting — the central tension

Baked lighting fights procedural generation. The resolution:

1. **Bake per-module, not per-level.** Each kit piece gets AO/lightmap baked in *local*
   space. Survives arbitrary reassembly, costs nothing at runtime.
2. **Bake-on-load for the assembled station.** After generation, render a cheap cubemap at
   each probe point, project to SH-L2, store an irradiance volume. Budget 1–3 s during the
   dock sequence — which is exactly what the dock choreography is for — then **cache to
   IndexedDB keyed by seed**, so a revisited station is free.
3. **Runtime:** 2–4 dynamic lights maximum. Everything else baked or probe-fed.

This step is what makes it stop looking like real-time Three.js. It is also the step most
likely to be cut under schedule pressure, and cutting it forfeits the entire "award-winning"
premise. Protect it.

### Scale and awe

Per-cell exponential fog with coloured extinction; instanced dust motes with parallax;
portal-gated god rays; three depth planes on every long sightline; human-scale referents
everywhere (1.0 m handrails, 2.1 m doorframes, known-height warning text — a featureless
200 m wall reads *smaller* than a 50 m wall with three doors in it); 55–65° interior FOV,
40–50° for hero reveals, zero roll except as a deliberate beat.

### Shader compilation

Use `renderer.compileAsync()` with `KHR_parallel_shader_compile` to warm every material
variant during the dock sequence. Jank on first entry would undo the reveal.

### WebGPU

Do not bet the ship date on it. Global availability is ~84%, Linux Firefox still pending,
and the WebGL2 fallback backend is not reliably as fast as the mature `WebGLRenderer`. But
**stop writing raw GLSL now** — author new materials in TSL/NodeMaterial, ship
`WebGLRenderer`, and keep `WebGPURenderer` behind a HIGH-tier flag. This keeps the port
cheap without depending on it.

---

## 5. The economy

### The model: reservoir pricing exposed as a finite-depth order book

Every market holds `stock` per commodity. Price comes from a convex reservoir curve. The
server publishes that curve as a **quantised NPC order ladder**. All trades — player-to-NPC
now, player-to-player later — execute against **one matching engine**.

```
fill  = clamp(stock / capacity, 0, 1)
p     = p_min + (p_max - p_min) * (1 - fill)^k        // k ≈ 1.5–2.5
```

Single-player is the multiplayer engine with only NPC orders in the book. **When players
arrive, no code is deleted; you simply stop being the only participant.** That is the whole
reason to pick this model over a simpler one, and it is exactly the "build in a way that
enables it later" requirement.

### Three mechanics to build first, in this order

1. **Integral pricing with finite depth.** Never transact N units at spot — charge
   `∫ p(s) ds` across the traded quantity. Roughly five lines of code, and it delivers price
   impact, diminishing returns, bot resistance, and multiplayer-safety simultaneously. **Every
   NPC quote carries a finite quantity from commit one, even in single-player.** An NPC that
   buys unbounded quantity at a fixed price is a money printer the day players can trade, and
   a lookup table before that.
2. **Lazy closed-form catch-up plus an event shock queue.** Store `(stock, lastUpdatedTick)`;
   integrate forward on read: `s = s_eq + (s - s_eq) * exp(-dt / τ)`. O(1) per commodity per
   visit, exact, deterministic, replayable, and it gives a galaxy of live markets for
   near-zero CPU. No continuous per-station tick, ever. **Ship the shock queue before the
   pretty production chains** — a static chain with a war on feels alive; a perfect chain at
   equilibrium is a lookup table. In direction C the resettlement events are the shock queue.
3. **Stale, partial, purchasable market information.** Store `(price, observedAtTick,
   confidence)` per player per market. A six-hour-old quote three jumps away is a bet, not a
   fact. This converts trading from arithmetic into judgment and costs almost nothing.

### System identity

Four independent axes, combined by seed: **endowment** (what the bodies actually hold),
**industry tier** (extraction → refining → components → assembly), **population** (the demand
faucet that never sleeps), **regime** (tariffs, contraband, blockades, accessibility).
`main/src/game/data/planetArchetypes.ts` and `biomes.ts` already carry per-archetype resource
affinity — the differential scarcity input already exists and simply has no price layer on it.

Legibility is a hard requirement, not polish: one-line archetype label, two glyphs (top
export, top shortage) on the map pin, **colour the deficit rather than the price**,
days-of-cover as a bar rather than a number, and ship the production-chain flowchart in-game.
If the player has to read a table, they will build the wiki and play that instead.

### Where it lives in the code

- **Commodity definitions extend `shared/economyCatalog.json`.** It is already the single
  source of truth, codegenned into both client and server and gated by `catalog:check` in
  both `verify` scripts. Drift is structurally impossible. Do not create a parallel registry.
- **The market layer is new server state.** `economyAuthority.ts` is a stateless validator
  and should stay one; add a sibling `marketAuthority.ts` rather than growing it.
- **Persistence is a prerequisite, not a detail.** The Neon schema exists but `DATABASE_URL`
  appears unset on Cloud Run, which means production is very likely running in-memory rooms
  with the whole persistence layer written but unengaged. A durable economy requires that
  actually be wired. Treat it as an infrastructure task with its own gate.
- **Cargo capacity must become real.** `inventorySystem.ts` is a flat count map with no
  stack limits, weight, or capacity. Profit-per-m³-per-jump-per-risk is the interesting
  quantity, and it does not exist until capacity does.

### Sinks from day one

Fuel, repairs, docking fees, tariffs, and a transaction tax that is **deleted, not paid to
anyone**. Sinks must scale with activity, not be flat. Log every faucet and sink by category
with server timestamps from the first commit — by the time inflation is visible in play, it
is a year of accumulated currency and the only remaining fixes are unpopular ones.

---

## 6. NPCs

### Two tiers, and the split rule is a canon rule

**Authored NPCs remember. Model-driven NPCs have opinions about prices.**

Anything canon-bearing — history, meaning, the Paradox Machina, Terra's nature — is authored
line by line in `storyScript.ts` and delivered through the existing typewriter path. Anything
that is weather, haggling, rumour, or the texture of a crowd may be model-driven.

All three directors independently arrived at the same containment principle, which is a
strong signal it is correct: **the existing canon rule "other workers are blind to what the
player sees" is not just fiction — it is the prompt boundary.** A model-driven NPC is
structurally incapable of discussing what Terra perceives, because its character genuinely
cannot perceive it. The safety rail and the story are the same rule.

### Bodies and motion

Extend the existing pattern rather than inventing one. `AuditWorker.tsx` (box humanoid,
hand-written sine gait, module-level pose written by a director, component only renders) plus
`emergentStoryDirector.ts:898` (`moveAuditor`: A* route via `planAgentSurfaceRoute`, arc-length
sampling, rate-limited heading) is a working NPC and is copyable verbatim. Crowd individuality
is procedural: one stamped silhouette varied by gait parameters and badge geometry. Interior
navigation implements the existing `AgentSurfaceTerrainQuery` interface.

There is no behaviour tree or planner anywhere in the codebase — only per-beat `switch`
directors. Extend the director pattern (`enterBeat` / `tick` / milestone receipt); do not
import a behaviour-tree library for this.

---

## 7. AI-powered NPCs

This is the highest-risk element in the document and needs the tightest contract.

### Architecture

Add `POST /v1/npc/converse` to `server/src/stateServer.ts`. The seam is genuinely ready: a
versioned `/v1/*` REST namespace already exists, Firebase-admin bearer auth already exists,
the CORS origin allowlist already exists, and Node ≥22 gives native `fetch`. This is a small
change to a well-shaped server.

`ANTHROPIC_API_KEY` is a Cloud Run server-side env var. **It must never be a `VITE_*`** —
those are public by definition. The client never talks to a model provider directly.

### Five containment rules

1. **Constrain the output surface, not just the prompt.** The model fills fields in a
   structured response — an offer, a refusal, a short line of margin text — rather than
   emitting free prose into the world. This caps cost, caps register drift, and (in direction
   C, and especially in B) is diegetically exactly what the place is about.
2. **Register lock.** Model-driven NPCs get the REGULATION register and trade-floor idiom
   only. The AWAKENING voice is structurally unavailable to a model. The interior voice is
   the story's most precious asset and no model output ever touches it.
3. **Blindness as prompt boundary.** The system prompt describes a character who cannot
   perceive the Paradox Machina. Canon leakage becomes character-inconsistent, not merely
   disallowed.
4. **Bounded context.** The model receives a local fact table — current prices, schedules,
   resettlement times, active rumours — and its own character sheet. It does not receive the
   story bible.
5. **Authored fallback on every failure.** Timeout, error, rate limit, or a response failing
   validation falls back to authored dialogue. The feature degrades to a working game, never
   to a broken one.

### Determinism is a real conflict, not a theoretical one

`npm run verify` chains `story:authority`, `chapter:journey:check`, `catalog:check`, and a
full 1930-test vitest suite. The codebase treats determinism as a contract — seeded
`mulberry32` flicker, rng-injectable deck engine, deterministic tangents. **A live model call
will fail these gates.**

Build a **fixture/transcript mode from day one**, following the precedent already set by
`voyageDeck`'s injected `rng`: CI and the movie-mode autoplaythrough replay recorded
transcripts; only live play calls the model. This is not optional and it is much cheaper to
build first than to retrofit.

### Cost and latency

Per-conversation token budget, a hard turn cap, aggressive caching of the system prompt and
fact table, and a per-session spend ceiling. Latency must be hidden diegetically — a clerk
consulting a ledger before answering is in-character; a spinner is not.

### The prose bar

`storyScript.ts:4-20` explicitly calls filler language a defect and enforces two strictly
separated registers. Raw model output will violate this. The mitigation is the structured
output surface in rule 1 plus a validation pass — not editorial hope.

### Positional audio

Spatialised NPC dialogue requires an `AudioListener` bound to the camera and a `PannerNode`
per emitter. None of this exists, and it lives in a protected path. **Recommendation: ship
the first station with text-only dialogue.** Positional audio is a separately-scoped,
separately-approved packet. Do not smuggle it into this one.

---

## 8. Phasing

Each phase ends in a gate. Do not begin a phase before its predecessor's gate is green.

**Phase 0 — Unblock.** Commit the 77-file worktree in coherent batches. Confirm
`full-client-verify` green from a clean tree. Resolve the `fauna-triangle-budget` regression
(1,004 > 800), which is an open blocker and which NPC geometry will make worse.
*Gate: clean tree, verify green, budgets green.*

**Phase 1 — Canon.** Run the `story-review` skill in story-council mode (docs-only) to
resolve the owner decisions in §10 and produce a signed canon candidate.
*Gate: owner-signed canon decision recorded.*

**Phase 2 — Renderer harness, no art.** Greybox 40-cell station. Prove portal-culling
correctness, `BatchedMesh` draw-call counts, streaming, and the ≤2-program material taxonomy.
Instrument on an iGPU and a mid Android device **before anyone models a wall.**
*Gate: measured draws/tris/programs/p95 inside budget on all three tiers.*

**Phase 3 — Bake-on-load pipeline** end to end on the greybox: probe placement, SH bake,
IndexedDB seed cache, cold vs warm load timing.
*Gate: warm revisit free; cold bake inside the dock-sequence budget.*

**Phase 4 — One hero module at final quality** (the Floor, or an observation volume) to set
the bar the generator must reach and to prove the lighting model produces the target image
at all. *Gate: naive-viewer review says "breathtaking" without being told to.*

**Phase 5 — Destination plumbing.** Anchorage addressing in `starSystem.ts`, `systemFlight.ts`
registration, `beginDock()`/`undock()` modelled on `physicalBoarding.ts`, residency
integration, interaction IDs.
*Gate: fly there, dock, walk in, walk out, fly away — with objective/marker lifecycle proof
from `story-verifier` and a fresh `player-experience-auditor` report.*

**Phase 6 — Economy, single-player.** Catalog extension, `marketAuthority.ts`, integral
pricing with finite depth, lazy catch-up, shock queue, cargo capacity, legibility UI,
faucet/sink telemetry. *Gate: a route is profitable, then measurably less profitable because
you traded it. Wiki-proof by construction.*

**Phase 7 — NPCs, authored only.** Bodies, interior nav, dialogue via the deck engine and
`showAuditLine`. *Gate: two named characters land emotionally in a blind read.*

**Phase 8 — Model-driven tier.** Server proxy, containment rules, fixture mode, cost
ceilings, fallback. *Gate: verify green in fixture mode; live mode never emits awakening
register; every failure path degrades to authored dialogue.*

**Phase 9 — Generator.** Second and third instances from different seeds, proving the knobs.
*Gate: a naive viewer cannot tell which instance was hand-tuned.*

Only the generator gate justifies calling this a system rather than a level.

---

## 9. Orchestration route

"Terra orchestrators" resolves to the TerraForm workflow system in the sibling repo
`/home/thomasphillip/Projects/TerraForm`. Its surface in this repo is `.terra/` (context
bindings and durable workflow runs), the npm operators, and the Claude-side skills.

- **Phase 1 (canon)** → the **`story-review`** skill in story-council mode. This is whole-story
  direction, not a bounded scene, so it needs the council rather than the triad. Produces a
  signed canon candidate and an owner decision.
- **Phases 4–9 (each scene/chapter)** → the **`creative-triad`** skill, which runs Chapter,
  Score, and Cinematography as peers through independent treatments, cross-notes, a frozen
  `scene-contract.json` signed by all three over the same hash, implementation, six
  independent reviews, a cohesion judge, and a human taste decision. Gate with
  `npm --prefix main run creative:gate -- --run <run> --phase contract|implementation|final`.
- **Certification** → `npm --prefix main run chapter:accept:workflow`.

Note the honest limitation recorded in the workflow README: there is no evidence-backed
deterministic step executor yet, so deterministic steps stop at `missing_deterministic_adapter`
and human decisions stop at `human_operator_required`. The operator is executable and
resumable but is **not** an unattended end-to-end council. Plan for a human in the loop at
every gate.

---

## 10. Owner decisions required

These block Phase 1 and only you can make them.

1. **Does this spend A5 — "Light"?** Canon is emphatic that the local Tidegarden trip must
   *not* spend A5, and that the first interstellar warp is "the later baptism." A deep-space
   station is either (a) in-system and pre-A5, or (b) the A5 payoff itself. This changes the
   station's meaning, its placement in the arc, and how much of the economy can be
   *inter*system at all. **Recommendation: in-system, pre-A5, with the wider sky visible and
   unreachable** — it preserves A5's power, and an isolated test area is exactly what you
   asked for.
2. **Which direction** — A, B, or C? Recommendation in §3 is C, with grafts. This is a taste
   call and the plan survives any of the three.
3. **The Makers.** Direction C forces a minimum commitment: the Makers did not build the
   station; they were *prior tenants who filed here too*. This reframes them from creators to
   a previous administration — strengthening the cubicle thesis without touching their
   identity, number, or motive. A and B do not force this. If you want the Makers wholly
   untouched, that is an argument for B.
4. **Shader program budget** — uber-material (recommended) or a recorded baseline raise? See
   §2.
5. **Positional audio** — confirm it is out of scope for the first station, or open a separate
   protected-path packet.
6. **`DATABASE_URL` on Cloud Run** — is production actually persisting? A durable economy
   depends on it.

---

## 11. Top risks

| Risk | Why it bites | Mitigation |
|---|---|---|
| **Shader program ceiling** | Five programs of headroom; each direction wants five | Uber-material with per-instance attributes, decided before geometry (§2) |
| **Model output violates the prose bar** | Repo treats filler language as a defect; models generate filler | Structured output surface + register lock + validation pass, not editorial hope |
| **Live model calls break determinism gates** | `verify` runs 1930 tests and three determinism gates | Fixture/transcript mode built first, per `voyageDeck` precedent |
| **Generated mush** | Valid topology, no landmark hierarchy, no authored sightlines | Authored macro templates + one-landmark-per-deck as a generator assertion + naive-viewer review before trusting the generator |
| **Flat lighting** | The actual difference between "award" and "nice demo" | Bake-on-load GI is load-bearing; protect it from schedule pressure |
| **LOW tier forks and rots** | Bar set on a good GPU, mobile hits the tile-GPU cliff | Quality tier is a data object the generator consumes; one scene graph, never two |
| **Direction C reads as empty** | "Awe through darkness" collapses into "grey level" if sparse | Clutter density and resettlement cadence are gates, not polish |
| **Economy solved on a wiki** | Static optima are publishable | Non-stationarity: shocks faster than relaxation, plus price impact from the player's own trades |
| **Unbounded NPC liquidity** | Becomes a money printer the day players trade | Finite depth on every quote from commit one |
| **Scope collision with in-flight work** | 77 uncommitted files, open fauna budget, freshly consolidated audio graph | Phase 0 |

---

## 12. One-paragraph summary

Build the generator, not the station; ship one hand-tuned instance as its first output. The
portal/cell graph the generator already has to produce is the keystone — it solves visibility,
streaming, light probes, and reverb in one artifact, which is what lets a procedural station
beat a hand-built one instead of merely approximating it. Make the economy a finite-depth
order book over reservoir pricing with lazy closed-form catch-up and an event shock queue, so
single-player and the eventual cross-player market are one code path and shocks — not
production chains — carry the drama. Split NPCs so that authored characters remember and
model-driven characters only have opinions about prices, and use the existing canon rule that
workers are blind to what Terra sees as the literal prompt boundary. The binding constraint is
not draw calls or triangles; it is five shader programs. The binding process constraint is a
dirty 77-file worktree. Both are fixable before anything creative starts, and both will be
much more expensive later.
