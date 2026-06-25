# Paravoxia - Multiplayer Implementation Checklist

Source plan: `MULTIPLAYER.md`.

Status: **TRACKER** (2026-06-24). This is the execution checklist for the co-op-first,
MMO-forward multiplayer work. Keep it checkbox-driven: mark an item complete only when the
code, tests, and manual evidence for that item exist.

## Ground Rules

- [ ] Do not add transport/netcode before the Phase 0 foundation gate passes.
- [x] Keep single-player offline mode working at every step.
- [x] Keep Firebase Hosting as the static SPA/CDN layer.
- [x] Use Firebase Auth for player identity.
- [x] Use Cloud Run for the authoritative realtime state server.
- [x] Use Neon Postgres for persistent co-op worlds/player state once persistence is enabled.
- [ ] Never accept client `localStorage` as multiplayer truth.
- [ ] Never use `seed` as durable world identity.
- [ ] Never reuse `editVersion` as a network sequence.
- [ ] Never mount remote players with `EfficientPlayer`.
- [ ] Every new gameplay system gets a state-ownership classification and network story before
      co-op launch.

## Preflight

- [x] Confirm current branch and clean/expected git state before implementation batches.
- [x] Run baseline `npm run verify` in `main/` and record failures before changing code.
- [ ] Create an implementation branch or confirm working directly on `master` is intended.
- [x] Confirm package/deploy boundaries: static game in `main/`, server package location TBD.
- [x] Decide where server source lives: `server/`, `main/server/`, or package workspace.
- [x] Decide whether Phase 1 persistence is Neon-backed from day one or in-memory with immediate
      save-on-disconnect.
- [ ] Decide whether a player can split from the party into another world in Phase 1.
- [x] Decide progression ownership: per-player, shared-world, or hybrid.
- [ ] Decide resource ownership: per-player inventory only vs shared storage.
- [ ] Decide structure permissions: personal, party-owned, or world-owned.
- [ ] Decide death/respawn model, including the current R-key reset behavior.
- [x] Decide world-clock model for offline single-player: keep global clock or migrate to
      per-world clocks.
- [x] Decide transport for Phase 1: WebSocket only first, with WebRTC deferred unless proven needed.

## Phase 0 - Single-Player Foundations

### 0.1 World Identity

- [x] Add a canonical `WorldIdentity` type: `{ worldId, coordinate, seed, generationSchemaVersion }`.
- [x] Define `worldId = coordinateKey(coordinate)` and treat `seed` as generation metadata only.
- [x] Replace seed-only save keys in new code paths.
- [x] Add best-effort migration for seed-only local saves when the coordinate is recoverable.
- [x] Quarantine or ignore orphan seed-only saves with no recoverable coordinate.
- [x] Detect and avoid silent merges on seed collision.
- [x] Include generation canary/fingerprint data on world voxel diffs.
- [x] Move `findHospitableStart()` world selection behind the RNG/world-identity seam.
- [x] Add tests for coordinate-key stability, seed collision behavior, and legacy save handling.

### 0.2 Domain Events

- [x] Add a typed domain-event bus.
- [x] Define common event envelope fields: `eventId`, `worldId`, `actorId`, `seq?`, `timeMs`,
      `type`, `payload`.
- [x] Add events for `voxel_mined`, `water_flooded`, `structure_placed`, `structure_removed`,
      `door_toggled`, `resource_taken`, `campfire_placed`, `vital_threshold`, `player_died`,
      `player_respawned`, `world_clock_changed`, and `warp_requested`.
- [x] Emit events from stores/commands without changing single-player behavior.
- [x] Add event tests for ordering, payload shape, and subscriber cleanup.

### 0.3 Command Framework

- [x] Add `dispatchCommand(cmd, ctx): CommandResult`.
- [x] Define `CommandContext` with actor, world identity, deterministic RNG, time source, and
      state accessors.
- [x] Define `CommandResult` with success/reject, emitted events, state deltas, and rollback data
      for predicted clients.
- [x] Add idempotent command ids.
- [x] Add validation status codes for reject reasons.
- [x] Keep single-player dispatch in-process with no transport dependency.
- [x] Add tests for accepted commands, rejected commands, idempotent retry, and rollback payloads.

### 0.4 RNG Seam

- [x] Add deterministic RNG helper for simulation mutations.
- [x] Build on existing deterministic primitives where possible (`seededUnit` / `fnv1a32`).
- [x] Replace shared-state `Math.random` in harvesting yield.
- [x] Replace shared-state `Math.random` in harvesting bonus existence.
- [x] Replace shared-state `Math.random` in harvesting bonus amount.
- [x] Replace shared-state `Math.random` in tree harvest.
- [x] Replace shared-state `Math.random` in stone pickup.
- [x] Replace shared-state `Math.random` in forage pickup.
- [x] Replace durable world-identity `Math.random` in start-world selection.
- [x] Add regression tests proving identical command input produces identical results.

### 0.5 Actor-Keyed Per-Player Stores

- [x] Add actor-aware internal shapes behind existing getter names where possible.
- [x] Preserve hot HUD getter performance with a cached local-actor reference.
- [x] Actor-key `inventorySystem` or wrap it behind an actor-aware adapter.
- [x] Actor-key `loadoutSystem` or derive it from actor inventory.
- [x] Actor-key `survivalVitals`.
- [x] Capture hidden vitals state such as the `exhausted` sprint latch.
- [x] Promote jetpack fuel out of the `EfficientPlayer` ref into an actor-keyed store.
- [x] Actor-key oxygen/drown state.
- [x] Split `playerSubmersion`: local effects stay client-only; per-player submersion becomes
      pose/vitals data when needed for remote presentation.
- [x] Actor-key `mawSystem`.
- [x] Actor-key `consumeSystem` / waterskin.
- [x] Classify `progressionSystem` after the progression-scope decision.
- [x] Split `spaceFlight` into canonical player flight state, local warp visuals, and shard handoff.
- [x] Add tests that the local single-player actor still reads/writes through existing UI flows.

### 0.6 World-Shared Store Preparation

- [x] Add owner/placedBy metadata to structure pieces.
- [x] Add owner/placedBy metadata to campfires.
- [x] Preserve collision rebuild behavior for placed/removed/toggled structures.
- [x] Treat door state as physics-affecting, not render-only.
- [x] Classify dynamic water as derived shared state from ordered mining commands.
- [x] Ensure `deletedTerrain` remains the terrain diff and `editVersion` remains local-only.
- [x] Convert auto-fired forage/stone proximity pickups into command intents.
- [x] Add tests for owner metadata and refunds to the correct actor.
- [x] Add collider rebuild regression tests.

### 0.7 Snapshot / Apply Snapshot

- [x] Define `snapshot()` and `applySnapshot({ replace: true })` contracts.
- [x] Add snapshot support for world-shared stores.
- [x] Add snapshot support for per-player stores.
- [x] Include hidden module state, not just public typed state.
- [x] Preserve voxel restore order: populate baseline, apply diff, then flush/rebuild collision.
- [x] Preserve generation fingerprint/canary checks.
- [x] Add world-swap regression tests.
- [x] Add reload persistence regression tests.
- [x] Add snapshot round-trip tests for structures, resources, campfires, inventory,
      vitals, Maw, waterskin, and jetpack fuel.
- [x] Add snapshot round-trip tests for pose.
- [x] Add snapshot round-trip tests for voxels.

### 0.8 Command Wrappers For Gameplay Mutations

- [x] Wrap `mineVoxel`.
- [x] Include server-resolvable deposit identity in `mineVoxel`.
- [x] Include server-rolled mining drop quantity in `mineVoxel`.
- [x] Include water flood result in `mineVoxel`.
- [x] Include Maw charge spend in `mineVoxel`.
- [x] Include biofuel auto-consume in `mineVoxel`.
- [x] Wrap `harvestTree`.
- [x] Wrap `collectStone`.
- [x] Wrap `collectForage`.
- [x] Wrap `placeStructure`.
- [x] Wrap `placeDoorway`.
- [x] Wrap `placeVolume`.
- [x] Wrap `fitDoor`.
- [x] Wrap `removeStructure`.
- [x] Wrap `toggleDoor`.
- [x] Wrap `craftRecipe`.
- [x] Wrap `placeCampfire` as an atomic craft/place/consume command.
- [x] Wrap `consumeItem` with explicit selected item.
- [x] Wrap `drinkWater` with explicit branch/target.
- [x] Wrap `fillWaterskin`.
- [x] Wrap `drinkFromWaterskin`.
- [x] Wrap `refuelMaw`.
- [x] Wrap `repairMaw`.
- [x] Wrap `respawn` / R-key reset.
- [x] Add tests for every command wrapper in accepted and rejected paths.

### 0.9 World Clock Seam

- [x] Add a server-ownable `worldTimeMs` or server-epoch time source.
- [x] Make `SkyController` read from the world-clock seam.
- [x] Keep single-player as "one local client owns the clock" until server exists.
- [x] Decide and implement offline global-vs-per-world clock behavior.
- [x] Add tests for stable day phase across reload/world swap.

### 0.10 Pose And Avatar Foundation

- [x] Define pose schema with `playerId`, `worldId`, `seq`, timestamp, position, velocity, look,
      up, teleport/warp markers.
- [x] Define locomotion/action mode enum: walk, swim, jetpack, climb, sprint, mine, build, drink,
      warp, idle, and any current animation-relevant states.
- [x] Include continuous presentation params: submergence, mining progress, jetpack active,
      torch/held-light state, and ship/flight phase as needed.
- [x] Build a render-only `PlayerAvatar`.
- [x] Prove `PlayerAvatar` does not write local singletons.
- [x] Add a local debug view or harness for avatar pose playback.

### 0.11 Tick Discipline

- [x] Document physics tick, render tick, vitals tick, oxygen tick, stamina tick, and clock tick.
- [x] Confirm Rapier fixed-step assumptions.
- [x] Confirm vitals clamp behavior (`Math.min(delta, 0.05)`) remains intentional.
- [x] Document edge transition/cube-face state as non-correctable during reconciliation.
- [x] Add tests or probes for tick-dependent vitals/oxygen behavior.

### 0.12 Phase 0 Gate

- [x] `npm run typecheck` passes.
- [x] `npm run test` passes.
- [x] `npm run build` passes.
- [x] `npm run verify` passes.
- [ ] Manual smoke: new game, load existing save, warp, mine, build, harvest, swim, drown/oxygen,
      jetpack, craft, campfire, Maw refuel/repair.
- [x] No transport code is required to pass the gate.
- [x] `MULTIPLAYER.md` ownership map matches implemented seams.

## Phase 1 - Co-op Alpha

### 1.1 Infrastructure

- [x] Create dedicated Node/TypeScript Cloud Run state-server package.
- [x] Add local dev server script for the state server.
- [x] Add health endpoint.
- [x] Add lobby HTTP API endpoint(s).
- [x] Add WebSocket endpoint for realtime play.
- [x] Add Firebase Auth to the client.
- [x] Add anonymous sign-in.
- [x] Add Firebase Admin token verification on the server.
- [ ] Add Firebase Hosting rewrite for lobby HTTP API only if useful.
- [x] Keep realtime WebSocket direct to Cloud Run.
- [x] Add Neon connection configuration.
- [x] Add local environment documentation for Firebase, Cloud Run, and Neon secrets.
- [x] Add deployment documentation for server + static Hosting.

### 1.2 Neon Schema And Persistence

- [x] Add migrations for `players`.
- [x] Add migrations for `worlds`.
- [x] Add migrations for `world_events`.
- [x] Add migrations for `world_voxel_edits`.
- [x] Add migrations for `world_structures`.
- [x] Add migrations for `world_collectibles`.
- [x] Add migrations for `world_campfires`.
- [x] Add migrations for `player_state`.
- [x] Add migrations for `player_inventory`.
- [x] Add migrations for `player_world_pose` with composite `(player_id, world_id)` key.
- [x] Store generation schema version and generation canary/fingerprint.
- [x] Scope durable world mutation tables by `(room_id, world_id)` for Phase 1 co-op rooms.
- [x] Add `world_shards` sequence cursor table keyed by `(room_id, world_id)`.
- [x] Add `world_commands` command-idempotency ledger.
- [x] Implement transactional command persistence.
- [x] Skip periodic flush for Phase 1 because every reliable command is written transactionally.
- [x] Skip save-on-disconnect for reliable mutations because no accepted command waits for close.
- [x] Implement event-log shard resume/warmup from Neon.
- [ ] Implement migrate-or-drop policy for generation schema changes.

### 1.3 Server Runtime

- [x] Implement rooms/lobbies.
- [x] Implement invite/join flow.
- [x] Implement player session tracking.
- [x] Implement authoritative shard container keyed by `worldId`.
- [x] Keep shard lifecycle independent of any player's mounted client view.
- [x] Implement per-shard sequence numbers.
- [x] Implement command idempotency cache.
- [x] Implement event log append.
- [x] Implement current snapshot assembly.
- [x] Implement since-seq delta replay for missed in-memory world events.
- [x] Persist accepted reliable-lane mutation events before broadcasting.
- [x] Replay reliable-lane world events from Neon when configured.
- [x] Keep pose/movement on the ephemeral latest-wins lane.
- [ ] Implement late-join snapshot chunking/compaction strategy.
- [x] Implement reconnect/resume semantics.
- [x] Implement disconnect cleanup without world teardown.
- [x] Implement rate limits by player/session/command type.
- [x] Implement audit logging for rejected commands.

### 1.4 Protocols

- [x] Define protocol versioning.
- [x] Define auth/hello message.
- [x] Define join-room request/response.
- [x] Define world snapshot message.
- [x] Define snapshot chunk messages.
- [x] Define world event message.
- [x] Define subscribe/resume world request with client `lastAppliedSeq`.
- [x] Define world event acknowledgement/cursor message.
- [x] Define command request message.
- [x] Define command accepted message.
- [x] Define command rejected message.
- [x] Define prediction rollback message.
- [x] Define pose update message.
- [x] Define teleport/warp marker message.
- [x] Define ping/latency message.
- [x] Define server error and disconnect reason messages.
- [x] Add schema validation on client and server.
- [x] Add protocol compatibility tests.

### 1.5 Client Co-op Integration

- [x] Add multiplayer/offline mode state.
- [x] Add sign-in boot path.
- [x] Add create-room UI.
- [x] Add join-room UI.
- [x] Add invite/share room code UI.
- [ ] Add player list UI.
- [x] Add connection status UI.
- [x] Add reconnect UI state.
- [ ] Add command dispatch adapter: offline in-process vs online WebSocket.
- [x] Send accepted mining command events over WebSocket in co-op mode.
- [x] Send accepted wrapped gameplay domain events over WebSocket in co-op mode.
- [x] Apply authoritative world event snapshot on join.
- [x] Apply authoritative player pose snapshot on join.
- [x] Replay snapshot `voxel_mined` terrain events after terrain population for late joiners.
- [x] Replay snapshot shared action events for resources, structures, doors, campfires, and water floods.
- [x] Apply incremental world events.
- [x] Apply incremental `voxel_mined` terrain events.
- [x] Apply incremental shared action events for resource pickups, structures, doors, campfires, and water floods.
- [ ] Send command intents instead of direct shared-world mutation in co-op mode.
- [ ] Add client prediction for high-value actions.
- [x] Add rollback on reject.
- [x] Send pose updates at target rate.
- [x] Interpolate remote poses.
- [x] Render remote players through `PlayerAvatar`.
- [x] Ensure remote player state never writes local singleton stores.

### 1.6 Multiplayer System Coverage

- [ ] Mining is server-validated and replicated.
- [x] Mining terrain removal is replicated from accepted room events.
- [x] Mining drop identity/quantity is server-resolved.
- [x] Mining water flood is deterministic and replicated/derived from accepted room events.
- [x] Voxel collision rebuild happens after authoritative terrain updates.
- [x] Replicated voxel removals replay through terrain diffs so visible terrain/collision rebuild.
- [x] Structure placement is server-validated and replicated.
- [x] Structure placement is replicated from accepted room events.
- [ ] Structure removal/refund routes to the correct actor.
- [x] Structure removal is replicated from accepted room events without local viewer refunds.
- [x] Door toggle rebuilds collision and triggers reconciliation when needed.
- [x] Door toggle open/closed state is replicated from accepted room events.
- [ ] `placeVolume` orientation replicates correctly.
- [x] `placeVolume` orientation is carried in replicated structure placement events.
- [x] Forage/stone/tree collection is first-wins and server-arbitrated.
- [x] Forage/stone/tree collection visibility is replicated from accepted room events.
- [x] Campfire placement is atomic and replicated.
- [x] Campfire placement visibility is replicated from accepted room events.
- [ ] Inventory changes are server-owned.
- [x] Crafting is transactional.
- [x] Consume/drink/waterskin commands are explicit and server-owned.
- [x] Maw refuel/repair/charge-spend is server-owned.
- [ ] Progression behavior matches the chosen progression ownership model.
- [ ] Vitals are server-owned or server-verifiable according to Phase 1 policy.
- [ ] Oxygen/drown state supports each player independently.
- [ ] Swim/submersion state replicates enough for remote presentation.
- [ ] Jetpack fuel replicates enough for authority and remote presentation.
- [x] World clock is server-owned in co-op.
- [x] Respawn/reset is command-routed and replicated.
- [ ] Warp request is command-routed.
- [ ] Shard handoff payload includes ship/player pose and spawn slot.
- [ ] Players can split worlds only if Phase 1 shard survival is implemented.

### 1.7 Security And Abuse Minimums

- [x] Verify Firebase ID token for every WebSocket session.
- [x] Bind player id to authenticated user.
- [x] Reject commands for the wrong actor.
- [x] Reject commands for the wrong world/shard.
- [x] Reject replayed command ids with a different envelope while allowing idempotent retries.
- [x] Enforce command rate limits.
- [x] Validate inventory affordability server-side.
- [ ] Validate structure placement ownership/permissions server-side.
- [x] Validate mine/collect target plausibility server-side.
- [ ] Validate pose plausibility bounds, with cube-edge transition exceptions.
- [x] Never trust client-generated resource yields.
- [x] Never trust client-generated world identity.
- [x] Log suspicious rejects for later tuning.

### 1.8 Co-op UX

- [x] Main menu exposes offline and co-op paths.
- [x] Co-op path supports create room.
- [x] Co-op path supports join room.
- [x] Room flow explains invite code/link.
- [ ] Player list shows connected/disconnected players.
- [ ] Remote avatars show name/display identity.
- [ ] Remote avatars clearly show swim/jetpack/mine/build/torch-relevant state.
- [ ] Add minimal ping/marker system or explicitly defer it.
- [ ] Add host/owner controls if kick/ban is in scope.
- [ ] Add clear errors for auth failure, room not found, server unavailable, and version mismatch.

### 1.9 Phase 1 Verification Matrix

- [x] One player can create a room and play alone online.
- [x] Second player can join the same world.
- [x] Late join receives current terrain/structure/resource/campfire/water state from the in-memory event log.
- [x] Late join receives current mined-voxel terrain diff.
- [x] Late join can receive current mutation state from Neon-backed event history.
- [x] Dropped reliable-lane event is recovered by cursor replay.
- [x] Reconnect resumes from since-seq delta.
- [x] Disconnect does not destroy the shard.
- [x] Concurrent mining of same voxel is first-wins.
- [x] Concurrent pickup of same forage/stone is first-wins.
- [x] Door toggle updates collision for both players.
- [x] Player affected by remote collider change reconciles cleanly.
- [x] Mining into water updates water/swim/oxygen behavior for both players.
- [x] Remote player swimming is visible as swimming.
- [x] Remote player jetpack is visible as jetpack.
- [x] Remote player mining/building is visually legible.
- [x] Craft/campfire command is atomic under reject/rollback.
- [x] R-key reset/respawn is visible to the other player.
- [ ] Warp behavior matches the chosen party-travel rule.
- [x] Cloud Run restart does not lose persisted Neon-backed worlds.
- [x] Two private rooms on the same `worldId` do not share mutation events.
- [x] Static Firebase Hosting deploy still serves the game.
- [x] `npm run verify` passes.

Evidence: 2026-06-25 live restart smoke moved Cloud Run from
`paravoxia-state-server-00005-cdh` to `paravoxia-state-server-00006-p7k`, replayed a
pre-restart Neon event on resume with zero full snapshots, appended a post-restart command,
and late-joined the room with both events in the snapshot.

Evidence: 2026-06-25 live server smoke on `paravoxia-state-server-00007-pr8` created a room,
joined a second player, replicated six reliable command types, and late-joined a third player
with all six events in the snapshot. A deployed guardrail smoke rejected an inactive shard target
with `invalid_world` and a mismatched command-id replay with `replay`.

Evidence: 2026-06-25 campfire/clock fix deployed Cloud Run revision
`paravoxia-state-server-00008-7sb` and Hosting asset `/assets/index-DbYof_8T.js`. Live smoke
persisted a fractional `campfire_placed` payload through late-join snapshot replay and confirmed
authoritative snapshot `worldTimeMs` advanced from `296` to `1089`.

Follow-up evidence: 2026-06-25 clock alignment fix deployed Hosting asset
`/assets/index-BCmz9mDg.js`; server-owned clocks now ignore saved local `dayPhase` offsets and
drive day/night on every graphics tier.

Evidence: 2026-06-25 first-wins authority batch deployed Cloud Run revision
`paravoxia-state-server-00009-rtn`. Live smoke accepted the first `voxel_mined`,
`resource_taken`, and `structure_placed` command for a target and rejected duplicate target
commands with `conflict`.

Evidence: 2026-06-25 client reconciliation batch deployed Hosting asset
`/assets/index-B3Jr1C7y.js`. Full `npm run verify` passed, authoritative shared mutations now
gate dependent client events, and rejected predictions rollback local-only rewards/state while
conflict rejects keep the winning shared-world mutation intact.

Evidence: 2026-06-25 authoritative crafting batch deployed Cloud Run revision
`paravoxia-state-server-00011-fht`. Server `npm run verify` passed. Live smoke rejected a
material-short `craft_campfire` as `validation_failed`, accepted server-seeded crafting inventory,
emitted atomic `recipe_crafted` + `campfire_placed` events at seq `5`/`6`, replicated both events
to a second player, and included the campfire in a late-join Neon-backed snapshot.

Evidence: 2026-06-25 consumable/player-state authority batch deployed Cloud Run revision
`paravoxia-state-server-00012-shc` and Hosting asset `/assets/index-BPLuEbBz.js`. Server
`npm run verify` and full `main` `npm run verify` passed. Live smoke rejected missing
`item_consumed` inventory as `validation_failed`, accepted canonical server payloads for
`item_consumed`, `waterskin_filled`, waterskin `water_drank`, `maw_refueled`,
`maw_charge_spent`, and `maw_repaired` through seq `9`, and late-join Neon snapshot included all
six action event types.

Evidence: 2026-06-25 resource-yield authority batch deployed Cloud Run revision
`paravoxia-state-server-00013-fgb` and Hosting asset `/assets/index-cDNoKsHa.js`. Server
`npm run verify` and full `main` `npm run verify` passed. Live smoke rewrote forged
`resource_taken` tree payload `{ id: "void_glass", qty: 999 }` to canonical wood, rewrote forged
`voxel_mined` drops from `void_glass` to canonical stone, rejected invalid forage `biofuel` as
`validation_failed`, replicated the accepted canonical events to a second player, and included
both canonical events in a late-join Neon-backed snapshot.

Evidence: 2026-06-25 target-plausibility authority batch deployed Cloud Run revision
`paravoxia-state-server-00014-4jl` with no Hosting change. Server `npm run verify` passed.
Room creation now canonicalizes valid coordinate-key world IDs and rejects invalid ones; command
world IDs must be canonical active shards. Server tests reject noncanonical command worlds,
out-of-bounds mine/collect targets, and block-incompatible forged deposits. Live smoke accepted
canonical server-owned resource/mining yields, rejected invalid forage, rejected out-of-bounds
resource pickup, rejected forged `void_glass` deposit on `stone`, replicated accepted canonical
events to a second player, and included them in a late-join Neon-backed snapshot.

Evidence: 2026-06-25 structure-placement authority batch deployed Cloud Run revision
`paravoxia-state-server-00016-44p` with no Hosting change. Server `npm run verify` passed with
24 tests. `structure_placed` now resolves through the server economy authority: known
piece/material validation, canonical payloads, wood affordability checks, authoritative inventory
debits, structure slot claims for normal pieces/volumes/two-cell doorways, and door-leaf claims
that require an existing doorway. Live smoke accepted a foundation only after server-earned wood,
stripped forged structure state, rejected an unaffordable foundation as `validation_failed`,
replicated the accepted structure to a second player, and included it in a late-join Neon-backed
snapshot.

Evidence: 2026-06-25 collider reconciliation batch deployed Hosting asset
`/assets/index-C7cSUfXO.js`. Full `main` `npm run verify` passed with 456 tests. Replicated
terrain diffs now emit collision-change notifications only after authoritative terrain apply,
structure placement/removal and door toggles emit affected collision cells, and the local player
controller wakes/reconciles nearby collider changes while avoiding cube-edge transition locks.
`https://paravox-game.web.app/` and `https://paravoxia.com/` both served the deployed asset.

Evidence: 2026-06-25 remote water/avatar presentation batch deployed Hosting asset
`/assets/index-BYR6lfRd.js`. Full `main` `npm run verify` passed with 458 tests. Replicated
`water_flooded` events are now covered against the real world generator queried by swim/oxygen
state, proving received flood cells become `isWaterVoxel` on the joining/remote client.
Remote avatars now present swim posture, jetpack flame, mining tool/progress, and build preview
states from pose data. `https://paravox-game.web.app/` and `https://paravoxia.com/` both served
the deployed asset.

Evidence: 2026-06-25 respawn replication batch deployed Hosting asset
`/assets/index-DUHvBBZc.js` with no server runtime change. Server `npm run verify` passed with
25 tests and full `main` `npm run verify` passed with 459 tests. `player_respawned` reliable
world events now apply as remote teleport poses, stale pre-respawn pose packets are ignored, and
state-server regression coverage verifies respawn broadcast plus late-join snapshot replay.
`https://paravox-game.web.app/` and `https://paravoxia.com/` both served the deployed asset.

Evidence: 2026-06-25 movement latency batch deployed Hosting asset `/assets/index-DB3baw41.js`.
The deployed source has 30Hz local pose sampling and WebSocket pose publishing; this batch added
render-side remote avatar smoothing with a small clamped velocity lead, while respawn/warp still
snap instantly. Server `npm run verify` passed with 26 tests and full `main` `npm run verify`
passed with 462 tests. `https://paravox-game.web.app/` and `https://paravoxia.com/` both served
the deployed asset.

Evidence: 2026-06-25 predicted door interaction batch deployed Cloud Run revision
`paravoxia-state-server-00017-6bx` and Hosting asset `/assets/index-jokzAUl7.js`. Door toggles
now send a narrow `predicted_world_event` before the durable command; peers apply it immediately
without advancing ordered world-event cursors, then authoritative `world_event` confirms the same
state. Server-side rollback storage broadcasts `prediction_rollback` if the matching command is
rejected. Server `npm run verify` passed with 27 tests and full `main` `npm run verify` passed
with 462 tests. Live room smoke and live predicted-door rollback smoke both passed.

## Phase 2 - Persistent Shards

- [ ] Harden scheduled persistence and crash recovery.
- [ ] Add shard resume/warmup metrics.
- [ ] Add persistent event history inspection tools.
- [ ] Add account upgrade path beyond anonymous auth.
- [ ] Add server-owned vitals decay if deferred from Phase 1.
- [ ] Add server-owned world sim ticks for decay/ambient systems.
- [ ] Add world compaction for large voxel/resource diffs.
- [ ] Add stronger migration tooling for generation schema bumps.
- [ ] Add shared storage if chosen in product decisions.
- [ ] Add richer permissions for structures/storage.
- [ ] Add moderation/admin controls for rooms/worlds.
- [ ] Add backup/restore workflow for Neon worlds.

## Phase 3 - MMO Hardening

- [ ] Port or reimplement the gravity controller headless for authoritative physics checks.
- [ ] Add true server-authoritative movement mode.
- [ ] Add anti-cheat validation beyond plausibility bounds.
- [ ] Add area-of-interest culling.
- [ ] Add horizontal shard scaling strategy.
- [ ] Add region/latency strategy.
- [ ] Add load testing for rooms, shards, and event throughput.
- [ ] Add server observability dashboards.
- [ ] Add alerting for Cloud Run, Neon, and WebSocket health.
- [ ] Add operational runbooks for deploy, rollback, migration, and incident response.

## Release Gates

### Phase 0 Complete

- [ ] All Phase 0 implementation sections complete.
- [ ] Existing offline gameplay is not regressed.
- [ ] `npm run verify` passes.
- [ ] Manual smoke matrix passes.
- [ ] `MULTIPLAYER.md` and this checklist agree.

### Phase 1 Alpha

- [x] Two-player invited co-op works on one shard.
- [x] Firebase Auth, Cloud Run, and Neon are wired in the standard stack.
- [ ] Server owns durable world/player state.
- [ ] Client localStorage is offline-only.
- [ ] Remote avatars are render-only and legible.
- [x] Disconnect/reconnect is handled.
- [x] Late join is handled.
- [ ] The documented security minimums are implemented.

### Phase 1 Launch Candidate

- [ ] 2-8 invited players can share a world.
- [ ] All Phase 1 verification checks pass.
- [x] Hosting deploy succeeds.
- [x] Cloud Run deploy succeeds.
- [x] Neon migrations are applied and reversible or documented.
- [x] Production secrets are set outside the repo.
- [ ] Basic monitoring/logging exists.
- [ ] Known limitations are documented in the plan/checklist.

## Ongoing Checklist Hygiene

- [ ] Add new checkboxes when new gameplay systems are added.
- [ ] Split large checked items into smaller items if implementation exposes hidden work.
- [ ] Do not mark product decisions complete without recording the chosen policy.
- [ ] Keep `MULTIPLAYER.md` high-level and this file execution-focused.
