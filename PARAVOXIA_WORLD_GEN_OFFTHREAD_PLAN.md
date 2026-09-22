# Paravoxia — world generation off the main thread

**Status: IN PROGRESS — Batches 0–2 measured; Batch 3 (validated arrival) landed, measuring. Not a production lock.**
Date: 2026-09-04 · Author: engineering session following the movie-mode performance measurement.


Progress log (2026-09-05 recovery; implementation is not a measured acceptance):

- Preserved a fresh, headed NVIDIA GB10 LOW 1280x720 baseline with exact source/dist/maps in `../recovery/2026-09-05-claude/evidence/worldgen-baseline`. Unprofiled direct Chapter 4 runs: cold total/largest **3353/2079ms** and **986/271ms**; arrival-to-audit seams **1601.1ms** and **283.6ms**. Both progressed naturally without errors or rescues. These are direct-entry measurements, not a continuous-run acceptance.
- Completed static story-anchor transport as **protocol v4**, carrying a hashed transferable **Float64** anchor buffer. The 14 existing public anchor functions transparently consume prepared values; supplied live terrain continues to own audit/nav/pack re-derivation. Pure resolver algorithms retain their original arithmetic. Pre-extraction fixtures at size 40/50/60 match all old serialized poses exactly; worker/hydrated anchor buffers match every Float64 byte, including signed zero. Protocol identity/corruption and empty-anchor worlds remain checked.
- Corrected the installed Three r160 warmup assumption: `compile` already traverses hidden material objects. The previous second proxy pass duplicated compilation and lost instanced mesh variants. The new queue preserves actual instanced color, morph and skin variants; awaits asynchronous linking; yields before each compile/reflection; and completes normal shader diagnostics/uniform/attribute initialization before visible first use. Actual auditor, hero tree and Keel mesh roots register for priority. Shader errors remain enabled and observable.
- Prepared-field Map hydration now exposes a cooperative chunk iterator; runtime respects the existing 2.5ms hydration budget and publishes only on completion. The synchronous API exhausts the same iterator without async scheduling. Map insertion order and arithmetic are unchanged. Full terrain-band parity now covers all 250,047 cells for each of three seeds.
- The first source-bound candidate (`52288257…`, immutable `index-DlP_H39g.js`) **failed**: two direct Chapter 4 cold total/largest results were **1144/298ms** and **862/243ms**, with arrival-to-audit seams **316.9ms** and **300.1ms**. Invalid measurements from a concurrently replaced shared dist are quarantined and excluded. The preview helper now serves an immutable snapshot with HTTP byte-hash verification.
- Candidate 2 addresses measured remaining work: `EmergentAuditSites` retains its inactive zero-intensity point-light slot so the audit cut does not change every lit material's program key; active ring/light values are unchanged. Cold worlds reuse immediate six-frame ecology staging and species staging, and fauna scans iterate the live voxel map without copying it. The probe retains the initial ecology completion/build spans at the original 8-second boundary as well as all later tasks, so deferred work remains visible.
- Initial terrain collision availability remains atomic. Fixed terrain now shares one immovable Rapier body with independent per-voxel collider refs. Caller audit found only per-voxel `setEnabled(false)` consumers; player queries exclude the player body, and no caller depends on an individual terrain-body handle. The installed renderer's actual Rapier passes exact before/after collider/contact-property and 441 ground-cast comparisons, exact player-capsule settling, self-excluded ground queries, and mined-cell removal with neighboring support retained. Hardware play verification remains required.
- Historical terrain fingerprints now match **all 27 atlas seeds** against archived original source `05e67b02…`: every generated solid voxel coordinate/material and exposed water coordinate/top flag at default radius 25. Evidence is in `../recovery/2026-09-05-claude/evidence/worldgen-atlas-parity/result.json`.
- Candidate 2 typecheck and focused source/physics tests passed. **All numerical performance criteria below remain open until fresh candidate hardware and continuous-run proof.** The integrated sync-fallback verify is still an integration gate.
- Source-bound Candidate 2 (`1eb27bf0…`, immutable `index-BNiS5k1D.js`) measured **903/195ms** and **608/188ms** cold total/largest: still **FAIL**. Its natural local arrival-to-audit seams were **16.8ms in both runs**. All five flora and six fauna initial builds completed by **4475.4/3803.8ms**, inside the unchanged 8-second window. This is local direct-entry seam proof, not the full warm-predecessor/continuous matrix.
- Candidate 3 addresses the next measured cold costs without changing terrain or visual values. The installed R3F async renderer factory creates the same context/attributes and polls an owned GPU fence with zero wait timeout before constructing unmodified Three; a 500ms deadline and cleanup/fallback outcomes are instrumented. A single native extension call previously blocked for **158.9ms**; only a fresh run can determine whether the asynchronous bootstrap helps. Real campfire hydration now precedes the first world draw, avoiding a stage-2 light-count change. The existing top-column index is constructed in cooperative hydration slices and reused for live anchor endpoints, preserving insertion order and all Float64 anchor bytes. CPU tests verify installed-R3F first-draw fire cardinality, persisted/prerequisite/empty worlds, later place/remove, renderer fallback/cleanup and exact anchor parity. **Candidate 3 has no hardware acceptance yet.**
- Source-bound Candidate 3 (`bd2429e5…`) measured **581/133ms** and **330/117ms** cold total/largest: still **FAIL**. Local arrival-to-audit remained **16.8ms** in both runs. Startup fences completed ready; Three initialization measured **16.9/30.7ms**, and all initial species builds ended by **4051.8/3849.4ms**. Separate instrumented shader reflection still spent about **183ms** in warmup program logs and **167ms** in warmup shader logs. The sampled profile is attribution only.
- Candidate 4 retains every warmup target/registration and normal Three diagnostics, adding an owned nonblocking GPU fence after compile readiness and before reflecting the ready-program snapshot. It never reflects later-created or already-released programs under that fence. Cancellation deletes the fence and leaves interrupted targets eligible on visibility resume. Startup defaults remain unchanged; shader-warmup fence outcomes and pass completion are observable within the original measurement window. Main typecheck and focused fence/shader tests pass; **fresh cold timing, all prewarm completion inside eight seconds, and the full handback/seam gates remain open**.

Progress log (2026-09-04, same day as the plan):

- **Batch 0** — `tools/boot-stall-probe.mjs` (`npm run perf:boot`), `tools/boot-attribution.mjs`
  (`npm run perf:boot:attrib`), shared `tools/lib/previewServer.mjs` (free port, identity
  check, `assertHardwareGl`). Same-build A/B via `?worldprep=sync`.
- **Batch 1** — `ensureWorldGen()` in `worldGenCache.ts` (worker path, shared in-flight,
  synchronous fallback, canonical-only) and the mount gate in `App.tsx` (`worldGenReady`).
  CPU attribution on the real GPU, cold `descent`, first 3s of long tasks:
  **legacy sync ≈ 2.2s total / 769ms largest → worker ≈ 0.9s total / 248ms largest.**
- **Batch 2 (transport)** — `ProceduralWorldGenerator.exportPreparedFields()` /
  `hydratePreparedFields()`, protocol **v3** carrying existence, surface-height and
  land-offset fields; hydration installs them on the fresh generator. Finding that changed
  the design: **every one of 132,400 cached surface heights is inexact in Float32**, so the
  fields are Float64 by construction — there is no "approximate" mode.
- **Measured 2026-09-05, same build A/B, real GPU, LOW 1280×720, median of 3 cold runs,
  long-task totals over the first ~8s:**

  | beat | legacy sync (total / largest) | worker + fields (total / largest) |
  |---|---|---|
  | `descent` | 1839ms / 685ms | **741ms / 194ms** |
  | `ch3-dusk` | 1854ms / 672ms | **824ms / 194ms** |
  | `ch8-crossing` | 1904ms / 660ms | **1045ms / 262ms** |

  Attribution on the worker path: the noise functions (`dotGrid`, `shouldVoxelExist`,
  `getProceduralSurfaceHeight`, `fractalNoise`) no longer appear in main-thread self time at
  all — Batch 2's "< 50ms" exit criterion is met. What remains is rapier stepping, three.js
  first-use shader setup, `getWorldArrivalCandidate` (~164ms, Batch 3), the `FeedOverlay`
  dither canvas (~260ms over 32s), and `EfficientPlanet`'s collision resync loop (~170ms).
  Batch 1's "largest block < 100ms" is NOT yet met (194–262ms); Batch 3 is what gets there.
- **Batch 3 (first half, 2026-09-05)** — the validated arrival pad is computed IN the
  worker with the identical `findValidSpawnSite` call `findTopFaceSurfaceVoxel` makes, shipped
  as `validatedArrivalCandidate` (INT16 sentinel when none), and installed on the cache entry
  by hydration, so the main-thread call returns without searching. `DEFAULT_ARRIVAL_SITE` is
  now one constant shared by both sides — a worker boot and a sync boot must spawn the ship
  on the same pad, and a parity test asserts they do. The story-anchor family
  (`getStorySidePlane`, pond, mesa, …) is the second half — and its first, cheapest cut has
  landed: every anchor resolves through `getWorldArrivalCandidate` with its own preferred
  column, and that function rebuilt the top-face column map from ALL voxels on every call, so
  a dozen anchors meant a dozen full scans at boot. The map is now memoised once per cache
  entry (`topFaceColumns`), with a parity test against the old per-call scan.
  **Measured 2026-09-05 (same harness, 3-run medians): `descent` 882ms / 225ms,
  `ch3-dusk` 706ms / 198ms, `ch8-crossing` 1034ms / 239ms.** `getWorldArrivalCandidate`
  has left the profile entirely, but the totals are inside run-to-run noise of the previous
  candidate (741 / 824 / 1045) — this cut removed a contributor without moving the headline
  number. The ~200–240ms largest block is now rapier body creation for the initial collision
  set, three.js first-use shader setup, and `EfficientPlanet`'s collision-resync scan
  (~170ms self). Those are Batch 5's targets; the "largest block < 100ms" criterion is not met.
- **Batch 5 (first cut, 2026-09-05)** — `EfficientPlanet.isWithinCollisionRange` allocated a
  fresh `Vector3` per voxel per resync (plus a cloned gravity vector in the near branch), and
  `syncCollisionBodies` re-parsed every voxel's coordinates out of its string key. Both now
  use scratch vectors and the voxel's own `position`; arithmetic unchanged. The predicate is
  lifted into `components/collisionRange.ts` (pure, `withinCollisionRange`) with a test that
  checks it against the original allocating formula over a 3,000+ point lattice — there was
  no `EfficientPlanet` test to lean on. The resync scan (`EfficientPlanet.tsx:382`) still
  shows ~169ms self in the latest attribution: what is left is the iteration itself over every
  exposed voxel on each 1-unit player move, not allocation. The next cut is scope, not
  arithmetic — but the voxel system is a flat `Map` keyed by coordinate string with no
  spatial index, so scoping the scan means adding one, and the profile says the scan is
  ~5ms per resync (≈30 resyncs in a 32s run). The boot block it sits in is dominated by
  rapier body creation for the initial collision set (`react-three-rapier` ~325ms +
  `rapier __wrap` ~128ms in the same profile), which cannot be time-sliced without changing
  what the player can stand on during spawn settle. Neither is a Batch 5 change to make
  blind; both are recorded here as the next measured targets, with the spatial index the
  safer of the two. **Measured 2026-09-05 05:08, clean GPU, same harness, 3-run medians:
  `descent` 845ms / 167ms, `ch3-dusk` 774ms / 195ms, `ch8-crossing` 1017ms / 242ms.** The
  resync scan has left the top-twelve self-time list entirely (it was 169ms), and the
  `descent` largest block fell from 225ms to 167ms (a second clean run ten minutes later read
  183 / 200 / 252, which is the noise band to hold future claims against). What is left on the main thread is
  three.js first-use (`getExtension`, matrix updates, `projectObject`), rapier body creation
  (~330ms across the run) and the `FeedOverlay` dither canvas (~270ms across 32s).
- **Batch 4 (2026-09-05)** — `ShaderWarmup` (in-Canvas) compiles visible content via
  `compileAsync` and hidden content via proxy meshes sharing the real material/geometry,
  against the real scene's lights, on an idle callback after scene-ready and on each beat
  entry. Unit-tested; its effect on the `ch4-arrival -> ch4-audit` seam is measured by
  `npm run perf:seams`. **First full run 2026-09-05 04:37–04:53 (reached `done` in ~15
  min):** `(load) -> crawl` fell from 1767ms to **217ms** — the cold-boot stall is gone from
  the seam table — but `ch4-arrival -> ch4-audit` read 233ms (baseline 183ms) and two new
  ch7 boundaries read 267ms. That run overlapped the boot re-measure and its attribution
  profile on the same GPU for its first ten minutes, so those three numbers are not yet
  evidence either way. **Clean run 2026-09-05 05:18–05:43 (nothing else on the GPU):** four
  boundaries over 100ms — `ch4-arrival -> ch4-audit` **233ms**, `descent -> ch1-fixed` 150ms,
  `ch7-reconstruct -> ch7-board` 150ms, `ch7-board -> ch8-launch` 150ms; `(load) -> crawl`,
  `crash -> descent` and `ch8-crossing -> ch8-landfall` have dropped below the threshold.
  The honest reading of the ch4 number: the shader warm-up did **not** move that seam
  (183ms before, 233ms after, both single runs on a 16ms frame grid), so either the hitch
  is not a program link, or the material the cut introduces is created ON the cut rather
  than mounted hidden before it. The attribution profile for that boundary is the next
  step, and Batch 4's exit criterion stays open.
- **Two measurement traps found and now guarded against**: headless Chromium without
  `--use-gl=angle` used SwiftShader and produced a 20-second `(program)` block that looked
  like an application bug; and a build started 27s after a source edit contained the edit,
  contaminating a baseline. `assertHardwareGl` and the same-build switches exist because of
  these.
- **Landed from the profile**: `EfficientVoxelSystem.voxelValues()` — a non-copying
  iterator — replaced `getAllVoxels()` (a full `new Map(...)` copy) at the eleven field
  builders that only loop over exposed voxels once (tree, stone, grass, forage, surface
  effects, critters, flora), plus `voxelEntries()` for `EfficientPlanet`'s two collision
  passes. Those copies were ~190ms + ~160ms of main-thread time per cold boot.
  `faunaField.ts` deliberately untouched — it is another agent's in-flight refactor.
- Remaining in the worker-mode profile (Batch 3/5 targets): `getWorldArrivalCandidate`
  (~200ms, main thread; the non-default-preference scan in `worldArrival.ts`), the
  `FeedOverlay` dither canvas rAF (~310ms self), rapier stepping, and three.js
  `onFirstUse` shader setup (~180ms, Batch 4).

This plans the removal of the ~3-second main-thread stall on every cold world entry, and
the shader-link hitch at the `ch4-arrival → ch4-audit` cut, without changing a single
voxel of any seed's terrain.

---

## 0. The shape of this, in one paragraph

A worker that prepares worlds already exists, with a packed transferable payload and a
cooperative hydration path — and **cold boot never uses it**. `getWorldGen()` constructs
the generator synchronously and runs the full O(R³) cube scan on the main thread, and
even when the worker *is* used (system travel), the main-thread generator arrives with
cold memo caches, so every later consumer recomputes Perlin noise on the main thread.
The plan routes cold boot through the worker, ships the generator's derived fields
(existence, surface height, land offset, flood) in the payload so main-thread queries
become table lookups, moves the arrival/anchor searches into the worker, and precompiles
shaders at scene-ready. Terrain stays bit-identical — `proceduralWorldGeneratorDeterminism.test.ts`
is the gate — and the synchronous path stays as the fallback for tests and workerless contexts.

---

## 1. Evidence — what this is fixing

Measured 2026-09-04, headless Chromium on the real GB10 GPU, `profile=LOW`, 1280×720,
40/40 runs deterministic:

| Symptom | Number | Cause (CDP sampling profile @100µs) |
|---|---|---|
| Cold entry to **any** beat | 2.9–3.6s of long tasks: one ~1.75s block + 3–4 blocks of 300–650ms, at fixed offsets from page load | `getGradient` 961ms self (15.3% of trace), `shouldVoxelExist` 206ms, `fractalNoise` 85ms, `isWaterVoxel` 81ms, `getProceduralSurfaceHeight` 61ms, GC 145ms — **synchronous procedural generation on the main thread** |
| `ch4-arrival → ch4-audit` | 1567ms cold / 183ms warm, 6/6 | `getProgramInfoLog` 1802ms self (22%) — **synchronous three.js shader link on the cut frame** when the hidden auditor first renders |
| `ch8-crossing → ch8-landfall` | 267–300ms, 3/3 | not attributed; world swap adjacent |
| Cutscene steady-state fps | locked 60, zero frames >100ms, all seven cinematic beats | **not a problem** |

Already landed (2026-09-04): the `getGradient` string-keyed `Map` + array allocation was
replaced with direct computation and the three memo caches moved to packed numeric keys —
**352ms → 195ms (−45%)** on a 180k-voxel benchmark, terrain fingerprint unchanged
(`1921:2413094700` for seed 12345). That is a constant-factor win. This plan is the
architectural one.

### Where the code stands

- `main/src/workers/worldPrep.worker.ts` → `buildPackedWorldPrepPayload(request)`: voxel positions, block/material/colour ids, deposits, exposed voxels, water voxels/cells/faces, arrival candidate — typed arrays with a transfer list. Protocol v2, `MAX_WORLD_PREP_PLANET_SIZE = 4096`.
- `main/src/utils/worldGenCache.ts`: `getWorldGen()` (**sync, cache-miss builds on main**), `hydrateWorldGenCacheFromPackedPayload()` (cooperative, `budgetMs`, `isCancelled`, `yieldControl`), `prewarmWorldGen()` / `scheduleWorldPrewarm()`.
- The worker is invoked from exactly one place: `App.tsx` `prepareSystemTarget` (system travel), budget 2.5ms/yield.
- `ProceduralWorldGenerator.hydratePreparedWaterCells()` is the existing precedent for installing a worker result into a fresh main-thread generator.
- Main-thread consumers of `generator.shouldVoxelExist` / `isWaterVoxel` / `generateBlockForPosition` at boot: `EfficientScene` (spawn terrain + `findValidSpawnSite`), `storyWorld.ts` (every story anchor; `proceduralAgentTerrain`), `WaterBlocks` (dig-to-fill replay), `ShipController`, `SpaceshipPlaceholder`, `agentSurfaceNavigationRuntime`, `gameplayCommands`, `TidegardenSettlementWorld`.

---

## 2. Target architecture

### 2.1 Cold boot goes through the worker

`getWorldGen()` keeps its signature but gains an async sibling, `ensureWorldGen(size,
seed, worldId): Promise<CachedWorldGen>`, which: (a) returns the cache entry if present;
(b) otherwise requests the worker payload and hydrates it with the existing cooperative
path; (c) falls back to the synchronous build only when `Worker` is unavailable or the
worker fails, logging a warp metric either way. `EfficientScene`'s `spawnTerrain` memo and
the story-world bootstrap await `ensureWorldGen` behind the existing BRACE white-out
(`descent` already holds on `isSpawnSettled()`; the 12s grace added 2026-09-04 stays as
the bound).

### 2.2 Ship the derived fields, not just the voxels

> **Superseded in implementation (see progress log):** the fields ship as the generator's
> memo caches — packed numeric keys plus values — not as dense per-face grids, and heights
> and offsets are **Float64**, because Float32 was measured inexact for every cached value.
> The table below is the original sketch, kept for the reasoning about what each field replaces.

Extend protocol to **v3** with three dense fields over the cube-sphere shell
`[-R, R]³` clipped to the terrain band (planetRadius ± valleyDepth/heightVariation):

| Field | Type | Replaces on main |
|---|---|---|
| `existence` | bit-packed `Uint8Array` | `existenceCache` + the `shouldVoxelExist` noise path |
| `surfaceHeight` | `Float32Array` per (face, u, v) | `surfaceHeightCache` + `getProceduralSurfaceHeight` |
| `landOffset` | `Float32Array` per (face, u, v) | `landOffsetCache` + `getLandOffset` |
| `flooded` | bit-packed `Uint8Array` over the water scan radius | `floodedWater` (extends `hydratePreparedWaterCells`) |

`ProceduralWorldGenerator.hydratePreparedFields(fields)` installs them; `shouldVoxelExist`
et al. consult the field first and fall through to computation only outside the band
(space, deep core) or when no field is installed. **The computation path is unchanged**,
so a hydrated generator and a cold one answer identically — enforced by a test that
compares field lookups against direct computation for every cell in the band on the
default seed and two others.

Budget: at `planetRadius = 25`, the band is ~52³ ≈ 140k cells → ~18KB existence, ~60KB
per float field per face-set. At `MAX_WORLD_PREP_PLANET_SIZE = 4096` the fields are not
viable; the protocol declares a `fieldsRadiusLimit` and larger worlds hydrate voxels only.

### 2.3 Arrival and story anchors in the worker

`findValidSpawnSite`, `createWorldArrivalPose`, and the `storyWorld.ts` anchor family
(`getStorySidePlane`, pond, mesa, anomaly stone, debris, pods, wreck relay, audit path)
are pure functions of `(planetSize, terrainSeed, worldId)` plus the generator. They move
behind `WorldAnchorsRequest` in the worker; the payload gains `anchors` (a small JSON
block) and the existing `arrivalCandidate` becomes one member of it. Main-thread
`storyAnchors` is filled from the payload rather than computed.

The live-terrain variants (post-edit re-derivation in `TidegardenSettlementWorld`,
`getAuditWorkerPath` with the runtime terrain query) stay on main: they are bounded by the
edit count and read live state the worker cannot see.

### 2.4 Shader precompile at scene-ready

`three` links a program on an object's first *render*. The auditor mounts for all of
chapter 4 but is hidden until the audit, so its link lands on the cut frame. Two
measures, both general:

1. A `ShaderWarmup` R3F component that, once `sceneReady` flips, calls
   `gl.compileAsync(scene, camera)` and then, for every `Object3D` currently `visible:
   false` that carries a material, compiles that material against a throwaway scene. Runs
   again on each story-beat entry for objects mounted since the last pass.
2. Content that is *known* to appear at a cut (the auditor, the hero tree crown, the
   Keel) declares `data-precompile` via a `precompile()` registration so the warmup
   compiles it even before it is added to the scene.

Gate: the `ch4-arrival → ch4-audit` cold seam drops below 200ms (today 1567ms) and the
warm seam below 60ms (today 183ms).

### 2.5 Keep the synchronous path honest

The sync build stays for `vitest` (node environment, no `Worker`), for tools, and as the
runtime fallback. It is exercised by the determinism test and by a new
`worldGen.parity.test.ts` that hydrates a generator from a payload built in-process and
asserts every public query matches the cold generator over the band.

---

## 3. Sequencing

Each batch is gated on `verify`, on the terrain fingerprint, and on the boot-stall probe
(the `frameprobe` / long-task harness from the 2026-09-04 measurement, checked into
`main/tools/` as `boot-stall-probe.mjs`), run against a self-booted preview the way
`verify:visual` does.

### Batch 0 — Instrument (no behaviour change)
1. Check in `boot-stall-probe.mjs`: cold-entry long-task list for `descent`, `ch3-dusk`, `ch8-crossing`, 3 runs each; reports total stall ms and the largest block. Baseline recorded.
2. Add the `worldGen.parity.test.ts` scaffold (passing trivially: cold vs cold).

Gate: baseline ≈ 2.9–3.6s total, ~1.75s largest block, reproducible.

### Batch 1 — Cold boot through the existing worker (voxels only)
1. `ensureWorldGen()`; `EfficientScene` and the story bootstrap await it.
2. `prewarmWorldGen` / `scheduleWorldPrewarm` route through the same function.

Gate: largest cold-entry block drops from ~1.75s to the hydration budget (target < 100ms);
total stall still includes the noise recomputation (expected ~1.0–1.5s). Terrain fingerprint unchanged.

### Batch 2 — Derived fields (protocol v3)
1. Worker computes the four fields; payload carries them; `hydratePreparedFields`.
2. Parity test compares field lookups to computation for three seeds over the full band.

Gate: `getGradient` / `fractalNoise` / `getProceduralSurfaceHeight` self time on the main
thread during boot < 50ms total (from ~1.1s). Total cold stall < 500ms.

### Batch 3 — Anchors in the worker
1. `WorldAnchorsRequest`; `storyAnchors` hydrated from payload; `findValidSpawnSite` runs in the worker for the canonical arrival.
2. Live-terrain variants unchanged.

Gate: `storyWorld.test.ts`'s slow cases ("keeps a pond within the first day's walk", 2.8s; "places the unique repair kit…", 2.1s) pass unchanged; `scene:arrival_pose` warp metric < 20ms on main. Total cold stall < 250ms.

### Batch 4 — Shader warmup
1. `ShaderWarmup` component; `precompile()` registrations for the auditor, hero tree, Keel.
2. Seam probe (from the perf report's `seams.mjs`) checked in as `beat-seam-probe.mjs`.

Gate: every deep-link seam in the 2026-09-04 table < 200ms cold; every continuous-run seam < 100ms except `(load) → crawl`.

### Batch 5 — Remaining seams
Attribute and fix `ch8-crossing → ch8-landfall` (world swap; likely the same hydration budget), `descent → ch1-fixed` (~150ms, unattributed at 100µs — profile at 20µs), `crash → descent` (~180ms).

Gate: continuous-run seam list has zero entries over 100ms other than initial load.

---

## 4. What this must not do

- **Change terrain.** The fingerprint test is the contract. If a seed's world changes, every save on that seed changes with it. Any optimisation that alters float order is rejected, however small.
- **Make the worker required.** Tests run in node; some deploy targets may block workers. The sync path stays and stays tested.
- **Hide the wait.** While the worker prepares, the BRACE white-out holds — but bounded (12s grace) and, in the screening, labelled by the wait overlay. A silent hang is what this plan exists to remove; a silent longer hang is worse.
- **Precompile everything.** `compileAsync` over a large scene at the wrong moment is its own hitch. Warmup runs at `sceneReady` and at beat entry, yields between materials, and never on a cut frame.

---

## 5. Coordination

- **Harness refactor (in flight):** the two probes this plan checks in (`boot-stall-probe`, `beat-seam-probe`) should land in that refactor's probe framework, not beside it. Confirm the harness's server/identity pattern (`verify:visual` picks a free port and checks `<title>Paravoxia</title>` — a probe measured the wrong project on 2026-09-04 after a port takeover).
- **Ship refactor:** `ShipController` and `SpaceshipPlaceholder` consume `generator.shouldVoxelExist` for landing checks. Batch 2's hydrated fields must be installed before the ship mounts; agree the ordering with that agent.
- **Sound refactor:** no shared surface. Boot-time audio init may compete for the main thread in the same window; measure once Batch 1 lands so the two stalls are not confused.
- **Story pipeline refactor** (`PARAVOXIA_STORY_PIPELINE_REFACTOR_PLAN.md`): Batch 3 here moves `storyAnchors` computation; that plan's `WorldHandles` facade should read from the hydrated anchors. Sequence this plan's Batch 3 before that plan's Batch 2.

---

## 6. Exit criteria

- Cold entry to any beat: total long-task time < 250ms, largest block < 100ms.
- Main-thread noise computation during boot: < 50ms.
- Every beat seam < 100ms in a continuous run; `ch4-arrival → ch4-audit` < 60ms warm.
- Terrain fingerprint byte-identical for every seed in `proceduralAtlasSeeds.json`.
- Parity test green: hydrated generator ≡ cold generator over the band.
- Sync fallback still passes the full `verify` suite with `Worker` undefined.
