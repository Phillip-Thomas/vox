# Paravoxia — Multiplayer Plan (co-op now, MMO-forward)

Status: **DESIGN** (2026-06-24). Target: small **co-op** first (a handful of friends sharing
a planet), architected so the same foundations scale toward a **persistent MMO** later, and
sequenced so we **knock out low-risk foundational work first** (much of it improves the
single-player game too). No netcode is built yet; this is the roadmap + the prep backlog.

Read alongside `CRAFTING.md` (systems) and `PARAVOXIA_SYNOPSIS.txt` (vision).

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

## 2. Tailwinds (Paravoxia is unusually well-suited)
- **Deterministic procedural world.** Terrain is a pure function of the seed (no `Math.random`
  in generation; `planetSize` constant; schema-versioned cache). → **We never stream terrain.**
  Every client regenerates it locally; the server syncs only the *diff*. This is the single
  biggest cost a voxel MMO normally pays, already avoided.
- **State is already modeled as diffs.** Persistence = "world minus the procedural baseline":
  `voxelEdits` (removed coords), `structures`, `forage`/`stone`/`tree` collected sets,
  campfires. **A replication protocol is those same diffs, streamed instead of saved.** The
  persistence work maps ~1:1 onto network replication.
- **Clean store seam.** Every system has `get()/subscribe()/emit()` + (mostly) snapshot/restore
  via persistence. That seam is exactly where "apply authoritative update from server" plugs in.
- **Per-planet sharding is free.** The `space-travel` system already treats each planet as an
  independent world keyed by coordinate/seed → a natural **shard boundary** (warp = shard handoff).

## 3. State ownership map (THE key design artifact)
Classify every store. This drives the whole refactor.

**WORLD-SHARED** (one canonical copy per planet/shard; replicated to everyone there; the
server applies + orders mutations; conflict-prone):
- `structureSystem` (placed pieces, doors open/closed) — concurrent edits need ordering.
- `voxelSystem` terrain diff (`deletedTerrain` / `editVersion`) — mining is shared.
- `treeHarvest`, `stonePickup`, `foragePickup` (collected/harvested sets) — one player taking
  it removes it for all.
- `campfires` (placed lights).
- World clock / `dayPhase` (SkyController) — server-driven, broadcast.

**PER-PLAYER** (each player has their own; server owns the canonical copy):
- `inventorySystem` + `loadoutSystem` (derived).
- `survivalVitals` (health/hunger/thirst/warmth/stamina/oxygen).
- `mawSystem` (charge), `consumeSystem` (waterskin).
- `progressionSystem` (era/milestones) — likely per-account.
- `playerFrame` (position/look) — the replicated transform.
- `spaceFlight` (controlMode/phase) — each player flies their own ship.

**CLIENT-ONLY** (never replicated; local UI/feel): `buildState`, `buildGhost`,
`interactionSystem`, `miningProgress`, `targeting`, HUD state, camera.

> The hard truth: every PER-PLAYER store is a **global singleton today** ("the one player").
> The migration makes the client copy a *projection of my own player + replicated views of
> others*. Mechanical but pervasive — it touches nearly everything built so far.

## 4. Target architecture (Phase-1 co-op)
- **Topology:** authoritative **state server** (Node) per active planet; clients connect over
  **WebSocket** (later WebRTC datachannels for lower-latency transforms). One small game-loop
  per shard.
- **Authority split (the pragmatic co-op choice):**
  - **Server-authoritative** for world diffs + per-player resource/vitals/progression state +
    action validation ("can you mine here / afford this / reach that?").
  - **Client-simulated movement** (keep Rapier + the custom cube-gravity controller client-side)
    with **server reconciliation of position** (trusted-ish clients). This *defers* the brutal
    server-side-physics problem — acceptable for friends, not for anti-cheat.
- **Client role:** predict locally, send intents (commands) to the server, apply authoritative
  updates to the stores, interpolate remote players.

## 5. Netcode model
- **World replication = diff streaming.** Reuse the persistence diff shapes. On join: send the
  seed + the current world diff (terrain edits, structures, collected sets) → client regenerates
  terrain locally + applies the diff. After join: stream incremental diffs (one mined voxel, one
  placed piece, a door toggle) as ordered events.
- **Player transforms:** ~10–20 Hz position/look snapshots per player (you already publish these
  to `playerFrame`); remote players **interpolated** between snapshots; **local** player
  **predicted + reconciled** so it stays responsive.
- **Commands (intents):** mine / place / deconstruct / eat / drink / craft / toggle-door / fit-door
  → validated server-side, then broadcast as authoritative diffs. Client predicts optimistically
  + rolls back on reject.
- **Ordering + conflicts:** server serializes mutations to shared world state; `editVersion`-style
  counters become per-shard sequence numbers; last-writer-wins for door state, first-wins for
  "mined this voxel."

## 6. Persistence (MMO-forward)
- `localStorage` → a real DB. **The save format ports almost directly:** the schema-versioned,
  per-world-keyed diff blobs become DB rows (`world_diff` per shard; `player_state` per account).
- Keep `GENERATION_SCHEMA_VERSION` as the migration gate (server-side now).
- Single-player keeps `localStorage` as an **offline/local mode** (same serialization → the
  store is the only thing that changes).

## 7. Identity & sharding (MMO-forward, light now)
- **Identity:** a stable player id + display name (co-op: lightweight; MMO: real accounts/auth).
  The save becomes **player-keyed, not browser-keyed** — a real improvement even single-player.
- **Sharding:** one server process per planet; `worldId = coordinate/seed`. **Warp = handoff**
  (despawn on shard A, spawn on shard B). Area-of-interest culling (only sync nearby state) is an
  MMO-phase optimization but the per-planet boundary makes it tractable.

## 8. LOW-HANGING FRUIT — do these now (safe in single-player, de-risk MP)
Front-loaded because each is **additive, behavior-preserving, and useful even if MP never
ships.** Rough order:

1. **Command/intent layer** (`game/commands/…`): thin named functions for every world mutation
   — `mineVoxel`, `placePiece`, `fitDoor`, `eat`, `drink`, `craft`, `collectForage` — that take
   an *actor* + params and return success. Today EfficientPlayer calls store mutators directly;
   wrap them. **This is the server-validation seam.** Single-player: pure passthrough. ★ highest value.
2. **Domain-event stream** (`game/events.ts`): a typed bus (`voxel_mined`, `structure_placed`,
   `door_toggled`, `forage_taken`, `vital_threshold`, `player_died`). Stores emit domain events,
   not just `version++`. **Doubles as the plot-event hooks already planned** (primitive-era) AND
   becomes the replication feed. ★ pure win, two birds.
3. **Snapshot / applySnapshot per store:** formalize `snapshot()` + `applySnapshot()` on each
   store (most already have get/set via persistence). Unifies the save payload AND the join/
   replication payload. Improves saves today.
4. **Actor-keyed per-player stores (design now, key by id later):** give per-player stores an
   internal shape that can hold N actors (a `Map<playerId, state>`), with a single `'local'`
   actor for now. Defer the full split, but stop assuming "the only player" in new code.
5. **RNG seam for sim rolls:** route drop-quantity rolls (`collectStone`, `collectForage`) and
   any sim randomness through a small helper so the server can later be authoritative (and runs
   stay reproducible). Avoid `Math.random` in any code that mutates shared state.
6. **`worldId` / shard-key formalization:** already `currentWorld.coordinate` + `terrainSeed`;
   make it the explicit shard key everywhere (it already keys persistence — good).
7. **`PlayerAvatar` render component:** a reusable body rendered from a pose (position+look).
   Needed for remote players; enables an optional 3rd-person/debug view now.
8. **Tick discipline doc + audit:** physics is fixed-step (Rapier `timeStep`); vitals use clamped
   real dt. Document the canonical tick model so server + client agree later.

## 9. What to AVOID now (don't paint into a corner)
- Don't build a no-op transport/replication layer yet — speculative dead code. Build the
  *seams* (commands, events, snapshots), not the wires.
- Don't deepen client-authoritative shortcuts (e.g., the client directly committing irreversible
  shared-world changes without going through a command).
- Don't add new per-player state as bare globals — funnel through the actor-aware shape (#4).
- Don't introduce non-deterministic world generation or `Math.random` in shared-state mutations.

## 10. Phased roadmap
- **Phase 0 — Foundations (now, single-player):** the §8 low-hanging fruit (commands, events,
  snapshots, RNG seam, avatar, identity-in-save). Ships value with zero networking.
- **Phase 1 — Co-op (trusted clients):** state server per planet; client movement + reconciliation;
  diff replication reusing the snapshot/command/event seams; 2–8 players/planet; DB-backed.
- **Phase 2 — Persistent shards:** accounts/auth, worlds that live without the host, warp = shard
  handoff, server-owned world clock + sim ticks (vitals/decay server-side).
- **Phase 3 — MMO hardening:** server-authoritative physics (port the gravity controller headless,
  anti-cheat), area-of-interest culling, horizontal scaling, ops.

## 11. Open decisions (resolve before Phase 1)
- Movement authority: **trusted-client + reconcile** (recommended for co-op) vs server-authoritative.
- Transport: WebSocket only vs +WebRTC for transforms.
- Hosting model for co-op: player-hosted (one client is host) vs a thin dedicated server.
- Progression scope in co-op: per-player era vs shared world progress.
- Conflict policy on shared edits (first-wins mine, last-wins door — confirm).

## 12. MMO-forward invariants (keep these and co-op scales)
1. Every shared-world mutation goes through a **command** that *could* be server-validated.
2. State is **classified** (world / player / client) and serialized via **snapshot/applySnapshot**.
3. The world is **deterministic from seed**; only diffs are persisted/replicated.
4. **No `Math.random` in shared-state mutations** — use the RNG seam.
5. Saves are **player-keyed + world-keyed**, schema-versioned (already true) — the DB shape.
