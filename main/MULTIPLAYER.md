# Paravoxia — Multiplayer Plan (co-op now, MMO-forward)

Status: **DESIGN** (2026-06-24). Target: small **co-op** first (a handful of friends sharing
a planet), architected so the same foundations scale toward a **persistent MMO** later, and
sequenced so we **knock out low-risk foundational work first** (much of it improves the
single-player game too). No netcode is built yet; this is the roadmap + the prep backlog.

Read alongside `CRAFTING.md` (crafting/survival systems), `UNDERWATER.md` (water + submersion +
oxygen — shipped, and a first-class co-op concern), and `../PARAVOXIA_SYNOPSIS.txt` (vision).

Execution tracker: `MULTIPLAYER_IMPLEMENTATION_CHECKLIST.md`.

Research update (2026-06-24): six focused research passes reviewed this plan. Consensus:
co-op-first is viable, but Phase 0 should build the command/event/snapshot/actor/RNG seams
before transport; Phase 1 should use a dedicated authoritative state server; and movement can
remain trusted/reconciled while durable world + player state becomes server-owned.

Grounding audit (2026-06-24): a code-grounded second-opinion pass checked the main architecture
claims against the live single-player codebase. The architecture held up (terrain determinism,
diff-as-state, seed-keyed persistence, the command-wrapper premise, fixed-step physics all
confirmed). The audit also found gaps that this revision folds in — chiefly: underwater/dynamic
water ownership, RNG-routed start-world selection, warp handoff/state lifetime, and pose/action
coverage. Items added by the audit are tagged **[AUDIT]**.

---

## 1. The core idea: invert the authority model
Single-player today is **client-authoritative + local**: each system is a module-singleton
store the client mutates directly (`inventorySystem`, `survivalVitals`, `structureSystem`,
`voxelSystem`, `foragePickup`, …), Rapier runs physics on the client, and `localStorage` is
the database. Multiplayer is **not** "add netcode" — it's making a **server the source of
truth**, clients predictive views, and a real DB the store. That inversion is the bulk of
the work; the wire protocol is the visible tip.

The discipline that makes co-op scale to MMO: **decide, per piece of state, who owns it, and
route every mutation through a seam that a server can later validate.** If we keep that
invariant from day one, "co-op" and "MMO" differ mostly in *deployment + anti-cheat depth*,
not architecture.

**[AUDIT] The concrete blocker is that the client holds exactly one world at a time.** World
swap calls `voxelSystem.reset()` (`EfficientPlanet.tsx`) and repopulates the singleton stores
from the new world's saved diff. There is no `Map<worldId, state>` — the active stores *are*
the only copy. "Each planet is an independent world" is realized by **time-multiplexing one
world**, not by coexistence. Co-op needs *N* worlds resident server-side, decoupled from any
client mounting/unmounting a planet view. Treat this — not the wire protocol — as the headline
refactor (see §7).

## 2. Tailwinds (Paravoxia is unusually well-suited)
- **Deterministic procedural world.** Base terrain is regenerated locally from world identity +
  generation metadata (no `Math.random` in generation; `planetSize` constant; schema-versioned
  cache). -> **We never stream base terrain.** The server syncs only the *diff*. This is the
  single biggest cost a voxel MMO normally pays, already avoided.
  - **[AUDIT] Caveat — water is NOT purely baseline.** Mining a sub-waterline cell runs a live
    BFS flood (`extendFloodForDugCell`) that mutates `dynamicWaterCells` + bumps a
    `waterEditVersion` in the generator. This is dig-history-dependent **shared-world** state,
    re-derived from the persisted voxel diff on reload — deterministic given the *ordered* dig
    history, but not part of the static baseline. See §3 (WORLD-SHARED water) and §5 (mineVoxel).
  - **[AUDIT] Caveat — world IDENTITY selection must stay behind an RNG/server seam.** Phase 0
    routes `findHospitableStart()` through deterministic simulation RNG for offline mode. For
    co-op the start coordinate must still be server-assigned (see §7), not chosen independently
    by each client.
- **State is already modeled as diffs.** Persistence = "world minus the procedural baseline":
  `voxelEdits` (removed coords), `structures`, `forage`/`stone`/`tree` collected sets,
  campfires. **A replication protocol is those same diffs, streamed instead of saved.** The
  persistence work maps closely onto network replication. Phase 0 adds formal replace snapshots
  for the core per-player/world stores; `world_events` (the event-log replication feed) is still
  genuinely new — current saves are last-write-wins *state* blobs, not an append-only log (see §6).
- **Useful store seam.** Many systems expose `get()/subscribe()/emit()` and persistence helpers.
  That is the right seam for "apply authoritative update from server," but Phase 0 must formalize
  `snapshot()` + `applySnapshot({ replace: true })` instead of relying on ad hoc restore paths.
- **Per-planet sharding is natural.** Each planet is treated as an independent world by the
  flight/arrival system (`spaceFlight` + `worldArrival` + the App-level `arrivalHandler` that
  performs the world swap at the warp midpoint — there is no module literally named
  "space-travel"). The canonical shard key should be the coordinate-derived `worldId`; `seed` is
  generation metadata. Existing seed-only persistence must migrate before multiplayer.

## 3. State ownership map (THE key design artifact)
Classify every store. This drives the whole refactor.

**WORLD-SHARED** (one canonical copy per planet/shard; replicated to everyone there; the
server applies + orders mutations; conflict-prone):
- `structureSystem` (placed pieces, doors open/closed) — concurrent edits need ordering.
  **[AUDIT] Door/structure state is a PHYSICS input, not a render flag.** A closed door emits a
  `CuboidCollider`; placing/removing/toggling adds or removes a collision wall in the shared
  Rapier world that *every* client's controller collides against. So structure edits must
  re-run the collider rebuild AND trigger position reconciliation, and "last-writer-wins door"
  is not free (see §5 ordering). Phase 0 pieces carry `ownerId`/`placedBy`, so §11's permission
  policy is expressible and remove-refunds can route to a specific actor's inventory.
- `voxelSystem` terrain diff (`deletedTerrain`) — mining is shared. Current `editVersion` is a
  local dirty/rebuild counter, **not** a network sequence.
- **[AUDIT] Dynamic water (dig-to-fill flood)** — `dynamicWaterCells` + `waterEditVersion` in the
  generator. A **DERIVED** shared effect of `mineVoxel`: the server re-runs `extendFloodForDugCell`
  on the canonical solidity set and broadcasts added cells (or every client re-derives from the
  same ordered voxel diff). Never client-trusted — it changes swim/submersion/oxygen and the
  water mesh for everyone.
- `treeHarvest`, `stonePickup`, `foragePickup` (collected/harvested sets) — one player taking
  it removes it for all. Phase 0 routes proximity pickups through command intents with
  command-owned RNG; the server still needs to arbitrate first-wins collection in co-op.
- `campfires` (placed lights). Phase 0 carries owner/placedBy-style ownership metadata for the
  same reason as structures.
- World clock / `dayPhase` (SkyController) — server-driven per world/shard in multiplayer.
  Phase 0 adds a server-ownable world-clock seam while keeping offline single-player on one
  local-client global clock. Co-op must attach server `worldTimeMs` per shard.

**PER-PLAYER** (each player has their own; server owns the canonical copy):
- `inventorySystem` + `loadoutSystem` (derived).
- `survivalVitals` (health/hunger/thirst/warmth/stamina/oxygen). **[AUDIT]** Passive decay is a
  silent client tick on clamped real dt with **no event emission** — the `vital_threshold`/
  `player_died` events (#2) and Phase-2 server-side decay both require adding a threshold-crossing
  emit to the tick path; it is not free. Also carries hidden module state outside `VitalsState`
  (the `exhausted` sprint latch) that snapshots must capture (§8.6).
- **[AUDIT] Submersion + swim + oxygen/drown**. Phase 0 keeps local effect reads client-only but
  mirrors per-player submersion into actor-keyed state/pose for vitals and remote presentation.
  Swim remains client-simulated movement + reconciliation (§4); oxygen/drown is server-owned
  per-player vital state.
- **[AUDIT] Jetpack fuel** — Phase 0 promotes fuel into an actor-keyed per-player store so it can
  snapshot/replicate and remote avatars can show thrust.
- `mawSystem` (charge), `consumeSystem` (waterskin).
- `progressionSystem` (era/milestones) — **PER-PLAYER**. Era unlocks follow the player
  inventory/loadout/Maw, not a planet shard. `repairMaw(actorId)` advances that same actor's
  progression, so one player's tool repair does not promote another player or the whole world.
- `playerFrame`-like pose state (position/look/up/mode/phase) — Phase 0 adds actor-keyed
  `PlayerPose` and a render-only `PlayerAvatar`; `playerFrame` itself remains the local camera
  singleton and must not drive remote players.
- `spaceFlight` — splits **three** ways: (a) PER-PLAYER canonical phase/control/ship-pose,
  (b) CLIENT-ONLY warp visuals/metrics, and (c) the world-swap/arrival trigger, which is a
  **SHARD-HANDOFF command** (cross-ref §7), not a per-player concern. Phase 0 mirrors local
  phase/control/target/handoff status into `playerFlightSystem`; the visual warp runtime remains
  client-only. The App-level `arrivalHandler` is still the offline host hook and must be replaced
  by a server-validated handoff command in co-op. Ship pose/velocity/landed position still need
  fuller capture once the ship controller exports them. Each player flies their own ship; shard
  handoff rules are product-critical.

**CLIENT-ONLY** (never replicated; local UI/feel): `buildState`, `buildGhost`,
`interactionSystem`, `miningProgress`, `targeting`, HUD state, camera. **[AUDIT]** Also:
`appState` (menu/playing/sceneReady shell), `shipProximity` (boardable bool), `playerSubmersion`
*as a local-effect read* (audio muffle, fog, PostFX — driven by MY player only), and the
audio/music director (`musicEngine`/`AudioDirector`, driven by local flight phase + submergence).
**Nuance:** these are computed for the LOCAL player only; a remote `PlayerAvatar` needs its OWN
submersion/board/torch state if any shared presentation depends on it. Never key a client effect
off replicated *remote*-player state.

> The hard truth: every PER-PLAYER store is a **global singleton today** ("the one player").
> The migration makes the client copy a *projection of my own player + replicated views of
> others*. Mechanical but pervasive — it touches nearly everything built so far.

## 4. Target architecture (Phase-1 co-op)
- **Topology:** Firebase Hosting remains the static SPA/CDN. A dedicated **authoritative state
  server** (Node/TypeScript on Cloud Run) hosts active shards; clients connect over WebSocket.
  Firebase Auth (anonymous first) provides player identity. Neon Postgres is used when persistent
  co-op state is enabled; in-memory rooms can come first only if the schema remains DB-ready
  **and** the disconnect-durability question (§11) is answered — an in-memory restart loses
  everything, so save-on-disconnect is a prerequisite, not a later nicety.
- **Boundary:** do not put the live simulation in Firebase Hosting. Hosting can rewrite `/api/**`
  to Cloud Run for lobby/auth-adjacent HTTP, but realtime play talks directly to the state server.
- **Authority split (the pragmatic co-op choice):**
  - **Server-authoritative** for world diffs + per-player resource/vitals/progression state +
    action validation ("can you afford this?" — server-owned inventory — and a *plausibility*
    bound on "can you reach/mine there?").
  - **Client-simulated movement** (keep Rapier + the custom cube-gravity controller client-side)
    with **server reconciliation of position** (trusted-ish clients). This *defers* the brutal
    server-side-physics problem — acceptable for friends, not for anti-cheat.
- **[AUDIT] Reconciliation is harder here than usual.** Gravity varies continuously by world
  position (`smoothUpForPosition`) or via a stateful 6-face machine with edge-wrap teleports;
  Rapier runs `gravityScale=0` with hand-integrated gravity; collisions are against streamed
  voxel + structure colliders that are themselves mutable shared state. Naive "snap to server
  position" rubber-bands at every cube edge — the defining mechanic. So: **reconcile in the local
  surface frame** (position + up + face/transition state + velocity), and treat edge-transition
  frames (rotation animating / transition cooldown active) as **non-correctable**. Porting the
  gravity controller headless (Phase 3) is effectively a prerequisite for any *authoritative*
  position check — "reach" validation under trusted movement is only a plausibility bound, not
  anti-cheat. Don't bucket "reach" with "afford" (the latter is truly server-authoritative).
- **Client role:** predict locally, send intents (commands) to the server, apply authoritative
  updates to the stores, interpolate remote players.
- **Reliability lanes:** split realtime traffic into two explicit lanes:
  - **Durable reliable lane:** accepted commands and all world/player mutations. The server assigns
    room-scoped per-world sequence numbers, persists the event log, and clients apply events only
    in order from their `lastAppliedSeq` cursor.
  - **Ephemeral realtime lane:** pose, look, animation, mining progress, and other latest-wins
    presentation data. These packets may be dropped because the next update replaces them.

## 5. Netcode model
- **World replication = diff streaming.** Reuse the persistence diff shapes. On join: send
  `worldId`, coordinate, seed, generation schema version, and the current world snapshot/diff
  (terrain edits, structures, collected sets, dynamic-water version). Client regenerates terrain
  locally + applies the authoritative diff. After join: stream incremental ordered events.
  **[AUDIT]** The late-join diff is unbounded (`deletedTerrain` grows without limit on a
  heavily-dug planet) — even before MMO-phase AoI culling it needs chunking/compaction, and
  reconnection should resume with a *since-seq delta*, not a fresh full snapshot.
- **Mutation delivery invariant:** clients are not expected to receive every WebSocket frame. They
  are expected to remember the highest contiguous applied mutation sequence per `(roomId, worldId)`.
  On join, reconnect, or detected gap they subscribe/request replay from that cursor. The server
  either replays the durable event range or sends a compact snapshot plus tail events. A client may
  be delayed or forced to resync, but it must never permanently miss an accepted mutation.
- **Player transforms:** define a new pose protocol (`playerId`, `worldId`, **mode/action**, seq,
  timestamp, position, velocity, look/up, teleport/warp markers). **[AUDIT] `mode` must be a real
  enumerated locomotion/action state** — `{walk|swim|jetpack|climb|sprint|mine|build|drink|…}` —
  plus the continuous params remote rendering needs (`submergence` 0..1, `miningProgress` 0..1,
  `jetpackActive`, `hasTorch`). Single-player drives all of these locally but publishes none of
  them; without the enum, remote avatars render as a static walking body while actually swimming/
  flying/mining, and a torch-carrying friend is invisibly dark at night. Remote players are
  render-only `PlayerAvatar` instances (a **net-new** component — the local capsule is
  deliberately `visible={false}` and can't be reused); never mount remote `EfficientPlayer`
  (it writes ~10 local singletons that would collide). Local player stays predicted + reconciled.
- **Commands (intents):** validate and broadcast authoritative results for `mineVoxel`,
  `harvestTree`, `collectStone`, `collectForage`, `placeStructure`, `placeDoorway`, `fitDoor`,
  **`placeVolume`** (stairs/sloped roofs — a real shared mutator that was missing), `removeStructure`,
  `toggleDoor`, `craftRecipe`, `placeCampfire`, `consumeItem`, `drinkWater`, `fillWaterskin`,
  `drinkFromWaterskin`, `refuelMaw`, `repairMaw`, **`respawn`/`reset`** (the R-key self-teleport —
  route through the pose protocol's teleport marker, don't apply silently), and Maw-charge
  spending folded into mining. Clients may predict; rejects roll back. **[AUDIT] command-shape
  notes:**
  - **`mineVoxel` is a compound effect.** Its authoritative result must carry: the resolved drop
    list (block + **deposit identity** resolved server-side from the gen-schema-pinned generator +
    server-rolled quantity via the RNG seam), the **water flood** (added cells from
    `extendFloodForDugCell`), and any **biofuel auto-consume + Maw charge** spent (mining silently
    burns a biofuel when a charge tool empties — this is an inventory mutation, not the discrete
    `refuelMaw` action). Predict + roll back all of these together with the mine.
  - **Placement commands carry resolved `{face, upIdx, orient}`.** Build-mode selection/rotation
    stay client-only, but the *resolved* up-axis and volume orientation are shared-world — omit
    them and remote clients render wrong facing.
  - **Auto-fired pickups are special.** `collectForage`/`collectStone` trigger on local-player
    proximity; Phase 0 emits command intents with deterministic command RNG. Co-op must let the
    server arbitrate who wins the node when both players walk over it.
  - **`consumeItem`/`drinkWater` are branching/compound.** "Consume" eats the richest food OR sips
    the waterskin; "drink" both drinks and tops the waterskin if owned. The command must carry
    *which* item so the server reproduces the choice; otherwise inventory desyncs.
  - **Compound mutations need transactional rollback.** `craftRecipe` (remove N inputs + add M
    outputs) and `removeStructure` (delete piece(s) + refund) span multiple stores; a rejected
    prediction must atomically undo every recorded delta. Campfire creation is *three* mutations
    (craft → place light → consume item) — make it one atomic command, not two.
- **Ordering + conflicts:** server serializes shared-world mutations with dedicated per-shard
  sequence numbers scoped to `(roomId, worldId)`. Do not reuse `editVersion`. Last-writer-wins is
  acceptable for door *render* state, **[AUDIT] but because a door/structure edit changes the
  collision world, its authoritative result must rebuild colliders and reconcile any player it
  affects** (don't let a remote toggle silently teleport someone); first-wins for
  "mined/collected this resource"; command ids make retries idempotent. **[AUDIT]** Per-player
  stores also need a stated conflict policy once shared storage exists (§11) — inventory/vitals
  are single-owner (no conflict), but a shared chest drawn down by two players needs
  server-serialized withdraw or optimistic-with-rollback.

## 6. Persistence (MMO-forward)
- `localStorage` -> a real DB. **The STATE blobs port closely** (structures, voxel edits,
  collectibles, campfires, pose, inventory → rows), but: identity must change from seed-only to
  `WorldIdentity = { worldId: coordinateKey(coordinate), coordinate, seed,
  generationSchemaVersion }`, **and `world_events` is genuinely new** (an append-only replication/
  audit log from §8 #1-2, not a ported save).
- Seed is generation metadata, not durable world identity. **[AUDIT] The seed→worldId migration is
  best-effort and lossy:** `coordinateToSeed` is a truncated 32-bit FNV hash with a `hash===0?1`
  collapse — irreversible and collision-prone. You can only remap worlds whose coordinate is still
  known (e.g. `GlobalSave.lastWorld`); orphan seed-only blobs with no recoverable coordinate must
  be dropped or quarantined, and the seed-collision edge must never silently merge two worlds.
- Multiplayer ignores client `localStorage` for authority. Local storage remains an offline
  single-player projection/cache only.
- Suggested persistent shape: `worlds` for generation metadata plus room-scoped dynamic state:
  `rooms`, `room_members`, `world_shards`, `world_commands`, `world_events`, `world_voxel_edits`,
  `world_structures`, `world_collectibles`, `world_campfires`, `players`, `player_state`,
  `player_inventory`, and `player_world_pose`. `world_events` is keyed by `(roomId, worldId, seq)`
  in Phase 1 so two private rooms that both start at `0,0` do not share mutations. **[AUDIT]:**
  - `world_voxel_edits` stays a separate high-churn table (matches today's separate key, which
    decouples a big dig from re-serializing structures) and **must carry a generation canary**
    (store `VoxelSave.fingerprint`, or better `generationSchemaVersion` + size) so server-side
    replay can refuse stale diffs the same way `restoreVoxelEditsForWorld` does today.
  - `player_world_pose` PK must be **composite `(player_id, world_id)`** — Phase 0 pose state is
    actor-keyed and carries `worldId`; the DB key must preserve both dimensions.
- `dayPhase` moves to world/shard state, not `GlobalSave`, for co-op. Phase 0 keeps offline
  single-player on one global local-client clock through a server-ownable seam; the server source
  must become authoritative per shard once realtime co-op starts.
- **[AUDIT]** `GENERATION_SCHEMA_VERSION` is today a **DROP gate, not a migration gate**: bumping
  it changes the `localStorage` key prefix and silently orphans all prior saves — no migrate-forward
  code exists. Keep it as the compatibility/invalidation gate (part of `WorldIdentity`), but on the
  server it must become a real per-world `generationSchemaVersion` column with an explicit
  migrate-or-drop policy — otherwise a bump wipes every co-op world for every player at once.
- Single-player keeps `localStorage` as an **offline/local mode** (same serialization → the
  store is the only thing that changes), subject to the `dayPhase` caveat above.

## 7. Identity & sharding (MMO-forward, light now)
- **Identity:** Firebase Auth anonymous users first, upgradeable to real accounts later. The game
  uses a stable player id + display name; the save becomes **player-keyed, not browser-keyed** —
  a real improvement even single-player.
- **[AUDIT] Start-world selection must be server-assigned.** Phase 0 routes offline
  `findHospitableStart()` through deterministic RNG. In co-op, the server/shard owner picks and
  broadcasts the start coordinate (or seeds it from the room/account), so two clients cannot
  independently crash-land on different planets.
- **Sharding:** one active shard per planet/world; `worldId = coordinateKey(coordinate)`.
  **Warp = handoff** (despawn on shard A, spawn on shard B). **[AUDIT] Today this is a single-client
  React remount, not a handoff:** the swap resets the world and recomputes a deterministic arrival
  pose; ship pose/velocity/landed position are thrown away, and the *only* state that survives is
  browser-global inventory/maw/era. Two hard requirements fall out:
  1. **A player's despawn must be decoupled from world teardown.** Today the remount IS the despawn
     AND the world destruction, fused — so one player warping away would delete the world the
     others stand on (see §1). The shard must be a server-resident, player-independent state container.
  2. **Define the handoff payload.** Ship transform must become per-player canonical state
     (`player_world_pose` / a ship-pose record) with a per-player spawn slot (seeded base pose +
     per-player offset) so simultaneous arrivals don't overlap.
  Area-of-interest culling is an MMO-phase optimization, but the per-planet boundary makes it
  tractable.

## 8. LOW-HANGING FRUIT — do these now (safe in single-player, de-risk MP)
Front-loaded because most are **additive, behavior-preserving, and useful even if MP never
ships.** **[AUDIT] but two of them (#4, #6) are NOT purely additive — they touch built systems and
need test gates; they are re-ranked accordingly.** Rough order:

1. **Domain-event + command scaffolding** (`game/events.ts`, `game/commands/...`): introduce a
   typed event bus and `dispatchCommand(cmd, ctx): CommandResult` with actor/world metadata,
   idempotent command ids, and room for server validation. Single-player can run this as an
   in-process passthrough. Highest value.
2. **Domain-event inventory:** emit typed events (`voxel_mined`, `structure_placed`,
   `door_toggled`, `forage_taken`, `vital_threshold`, `player_died`). Stores emit domain events,
   not just `version++`. This doubles as plot-event hooks already planned for primitive-era work
   and becomes the replication feed. **[AUDIT]** `vital_threshold`/`player_died` have no emission
   point today (vitals decay silently) — adding them means touching the silent tick path.
3. **RNG seam for sim rolls:** route shared-state randomness through a helper owned by command
   context. Cover `harvestingSystem` (all three sites: yield, bonus-existence, bonus-amount),
   `treeHarvest`, `stonePickup`, `foragePickup`, **[AUDIT] `findHospitableStart` (start-world
   selection)**, and all future shared mutations. A deterministic primitive already exists
   (`seededUnit`/`fnv1a32`) to build on. Avoid `Math.random` in any code that mutates shared
   state or picks durable world identity.
4. **Actor-keyed per-player stores (design now, key by id later):** give per-player stores an
   internal shape that can hold N actors (a `Map<playerId, state>`), with a single `'local'`
   actor for now. **[AUDIT] Right-size it — this is invasive, not free:** HUD meters poll getters
   per-rAF and the serializer reads the same getters, so reshape *behind the existing getter
   names* (`getVitals()` → `actors.get('local')`) and cache a local-actor ref for HUD-hot reads
   (no per-frame Map lookup). Don't churn every call-site or the save format. Stop assuming "the
   only player" in new code. Phase 0 includes jetpack fuel and submersion in the split.
5. **Command wrappers for mutations:** thin named functions for `mineVoxel`, `harvestTree`,
   `collectStone`, `collectForage`, structure placement (incl. `placeVolume`)/removal/doors,
   crafting, campfires, consuming/drinking/waterskin, Maw refuel/repair/charge spending, and any
   future shared-world mutation. Today `EfficientPlayer` calls store mutators directly; wrap those
   calls. **[AUDIT]** Fold `mineVoxel`'s compound effects (flood, biofuel, deposit resolution) and
   the auto-fired pickup intents into these wrappers (see §5). Phase 0 client call sites now route
   the covered gameplay mutations through these command helpers.
6. **Snapshot / applySnapshot per store:** formalize `snapshot()` + `applySnapshot({ replace:
   true })` on each world-shared and per-player store. Unifies save payloads, join payloads, and
   server authoritative updates. **[AUDIT] Regression-prone — wrap, don't replace, the ordered
   restore path.** The voxel diff must apply AFTER `populateInitialTerrain` and BEFORE the
   collision flush, with the gen-fingerprint guard intact; a naive `{replace:true}` breaks dig
   persistence or collision on world load. Snapshots must also capture hidden module state
   (the `exhausted` sprint latch, jetpack fuel), not just the public typed shape. Do not treat it
   as one of the additive quick wins; gate it with a world-swap + reload test.
7. **`worldId` / shard-key formalization:** define coordinate-based `WorldIdentity` everywhere
   and migrate legacy seed-only local persistence (best-effort — see §6).
8. **`PlayerAvatar` render component:** a reusable body rendered from a pose. **[AUDIT] Net-new —
   there is no existing body to reuse** (the local capsule is `visible={false}`), and it must
   consume the expanded pose+mode contract from §5 (walk/swim/jetpack/climb/mine/build +
   submergence + torch), not just position+look. An optional 3rd-person/debug view is a side
   effect, not the spec.
9. **Tick discipline doc + audit:** physics is fixed-step (Rapier `timeStep`); vitals use clamped
   real dt (`Math.min(delta, 0.05)`); stamina/oxygen tick on the physics step. Document the
   canonical tick model so server + client agree later.
10. **[AUDIT] World clock seam:** replace `elapsedTime` accumulation with a server-ownable
    `worldTimeMs` (or NTP-style offset + server epoch the client interpolates) so `SkyController`
    reads `serverNow()`. A `dayPhaseOffset` alone cannot keep clients in sync. Phase 0 keeps
    single-player as one local client owning the clock until a server source is attached.

## 9. What to AVOID now (don't paint into a corner)
- Don't build a no-op transport/replication layer yet — speculative dead code. Build the
  *seams* (commands, events, snapshots), not the wires.
- Don't start networking before the seams above exist; it will lock in today's singleton state.
- Don't deepen client-authoritative shortcuts (e.g., the client directly committing irreversible
  shared-world changes without going through a command). **[AUDIT]** This includes the existing
  client-side `ensureStarterLoadout` self-grant and the auto-fired forage/stone pickups — new code
  must not add more of these.
- Don't add new per-player state as bare globals — funnel through the actor-aware shape (#4).
- Don't introduce non-deterministic world generation or `Math.random` in shared-state mutations,
  **[AUDIT] or in durable world-identity selection.**
- Don't use seed as durable world identity.
- Don't reuse `editVersion` as a network sequence.
- Don't accept client `localStorage` as multiplayer truth.
- **[AUDIT]** Don't treat door/structure state as a pure render flag — it's a physics collider.
- **[AUDIT]** Don't fuse a player's despawn with world teardown (today's warp does — see §7).

## 10. Phased roadmap
- **Phase 0 — Foundations (now, single-player):** command/event scaffolding, authoritative RNG
  seam (incl. start-world selection), actor-keyed stores, command wrappers, snapshots, coordinate-
  based world identity, world-clock seam, avatar, and tick discipline. Ships value with zero
  networking.
- **Phase 1 — Co-op (trusted clients):** dedicated Cloud Run state server, Firebase Auth, optional
  Neon persistence, 2–8 invited players on one shard, client-simulated movement + reconciliation
  (in the local surface frame), server-owned durable world/player state, diff replication through
  the new seams, **[AUDIT]** server-assigned start coordinate, save-on-disconnect + reconnection-
  resume, late-join diff compaction, and (if players can split worlds, §11) shards that outlive
  their sole player — pulled forward from Phase 2 because §1's teardown blocks it.
- **Phase 2 — Persistent shards:** harden shard lifecycle after the Phase-1 survival guarantee:
  scheduled persistence, shard resume/warmup, warp = shard handoff, server-owned world clock + sim
  ticks (vitals/decay server-side), account upgrades, and DB-backed audit/event history.
- **Phase 3 — MMO hardening:** server-authoritative physics (port the gravity controller headless,
  anti-cheat — also the prerequisite for true reach/position validation), area-of-interest culling,
  horizontal scaling, ops.

## 11. Open decisions (resolve before Phase 1)
- Movement authority: **trusted-client + reconcile** (recommended for co-op) vs server-authoritative.
- Transport: WebSocket only vs +WebRTC for transforms.
- Hosting model for co-op: player-hosted vs dedicated state server. Research recommendation:
  dedicated Cloud Run server.
- Persistence timing: ephemeral in-memory rooms first vs Neon-backed persistent rooms on day one.
  **[AUDIT] Gate this on the disconnect-durability answer below** (in-memory restart loses all state).
- Progression scope in co-op: **resolved for Phase 0 as per-player**. Era/milestone unlocks are
  account/player state; shared world milestones can be added later as a separate world-shared
  system if the design needs colony-scale progression.
- Resource ownership: per-player inventory only vs shared storage + permissions.
- **[AUDIT] Per-player store conflict policy** (distinct from world-edit conflicts): default for shared
  storage withdraw (server-serialized vs optimistic-with-rollback).
- Structure ownership/permissions: personal structures, party-owned structures, or world-owned.
  Phase 0 data can express ownership; the remaining decision is permission policy.
- Party travel: can one player warp the shard, must all players board, or can players split worlds?
  **[AUDIT] If players can split worlds, shard persistence (worlds outliving their sole player) must
  land in Phase 1, not Phase 2.** Warp-range (a loadout gate) also intersects this — can a low-range
  player reach the shard the party warped to?
- Death/respawn: downed state, corpse recovery, base respawn, or ship respawn. **[AUDIT]** Folds in
  the R-key reset (today an unvalidated client teleport).
- **[AUDIT] World-clock authority/sync:** co-op server-owned `worldTimeMs`; offline single-player
  is currently one global local-client clock.
- **[AUDIT] Disconnect durability:** save-on-disconnect / periodic server flush + reconnection-resume
  semantics (what happens to placed-but-unsaved edits and in-flight commands on a drop).
- Social UX: pings only first, text chat later, invite/kick/ban rules.
- Conflict policy on shared edits (first-wins mine, last-wins door **render** + collider rebuild —
  confirm).

## 12. MMO-forward invariants (keep these and co-op scales)
1. Every shared-world mutation goes through a **command** that *could* be server-validated.
2. State is **classified** (world / player / client) and serialized via **snapshot/applySnapshot**
   — capturing *all* module state, including hidden latches, not just the public typed shape.
3. The world id is coordinate-based; seed is generation metadata; only diffs are persisted/
   replicated. **Dynamic water and resource yields are DERIVED from the ordered voxel/command
   stream + the RNG seam — re-run server-side, not separately invented per client.**
4. **No `Math.random` in shared-state mutations or durable world-identity selection** — use the
   RNG seam.
5. Client `localStorage` is offline-only and never accepted as multiplayer truth.
6. Dedicated server owns durable world/player state; clients send intents and render projections.
   **A player's despawn never destroys the shard.**
7. Saves are **player-keyed + world-keyed**, schema-versioned — the DB shape.
8. **[AUDIT]** Every player must be able to do everything single-player does, independently and
   concurrently: dig/build/swim/drown/jetpack/craft/warp without being coupled to "the one player."
   Each new shipped single-player system gets a row in §3 and a story in §5 before co-op ships.
