# earned-continue-3d — PREPARED, NOT RUN

**Role:** `earned-continue-3d-runtime` · **Status:** `PREPARED-NOT-RUN` · CPU-only.
No browser, no GPU, no build, no full-suite rerun, no game-source edit, no contract edit.
The GPU / heavy lock is owned by `common-exact-input-runtime` and was never opened here.

**No runtime claim. No accepted-action claim. Nothing here is a capture, a verification or an acceptance.**

---

## 1. What the producer review established (read first)

`producer-earned-prefix-and-pose-review.json` is authoritative and is carried forward unchanged:

- `savedPrefixExactlyEqual = true` — the initial serialized WorldSave's 18 points match the later
  19-point snapshot **exactly**. The additional sample is *observed*, not lost data. The prior
  report's 16/18/19 framing is not restated anywhere in this preparation.
- The player pose lives in a **separate** key, `pvx.v1.world.-1,-1.player`, and earned-1 kept only
  its name and its 171-byte length.
- `newActionProved = false`.

## 2. The 90 s navigation failure was a probe defect, not a game restore failure

From `verifier/captures/arrival-common-earned/earned-1/summary.json`:

| measured | value |
|---|---|
| live `up` after Continue | `(0.9999999999998366, 1.8057e-07, -5.4246e-07)` → **+X face** |
| body after Continue | `[52.78897476196289, 17.5, -20]` |
| survey end E | `[-42, 51.05, 12]` → **+Y face** |
| `calibratedKeyDirections` | `KeyW`/`KeyS` measured; **`KeyA = null`, `KeyD = null`** |
| walk | 144 bursts / 90 387 ms / `budget-exhausted` / `finalDistToE = 94.79` |

`walkTowards` calibrated on `[dx, dz]` and rejected any key whose **XZ** magnitude was ≤ 0.05.
On the +X face A/D move the body in world **Y**, so both were dropped as null and the walk had no
lateral control; distance and key choice were XZ-only, and E's `y = 51.05` was invisible to the
steering. **This is not proof that the game failed to restore anything, and nothing here says it is.**

## 3. What was prepared

Everything is under **`verifier/probes/earned-continue-3d/`** — a private copy. The originals are
byte-identical and untouched:

| original | sha256 |
|---|---|
| `verifier/probes/arrival-common-earned/earned-continue-probe.mjs` | `4bc46bbce48ad757246b4f1ee19f9d29e08b201480639c0883c608ea8d5126c8` (= earned-1's recorded `probeSource.entrySha256`) |
| `.../earned-1/summary.json` | `5fb3c4ded210ca4f8de8a7595c6badbffb7e0548b5afad646bb01df3ed712040` |
| `.../earned-1/worldsave-pvx.v1.world.-1_-1.json` | `4d1bdd7a89c2c79258e04cdf3c9d8629c161d357a2d7d659424316c32f304f62` (= producer `savedSha256`) |

### Prepared files

| file | sha256 | origin |
|---|---|---|
| `earned-continue-3d-probe.mjs` | `f0cf8172384b72b690fc1af32dce64ad2e36f1e28d4207bca68aef9ec720a1c9` | copy of `4bc46bb…` + the two documented changes |
| `tangentSteering3d.mjs` | `1c1523c4480b1b290849a62102873d29f1d578f07052335943d0c8702ee65b6c` | **new** |
| `tangentSteering3d.selftest.mjs` | `2e90fb4e4ceaa1abf1e275bbea2420b4684a2a9607df59ebd0044be5ec5ad01d` | **new** |
| `poseObservation.mjs` | `35d26b067c154c17af834721e424c700d28f6ea4c17fb88ec24025c7823bccc8` | **new** |
| `earnedContinueLogic.mjs` | `6ff3c7f62181a9ec2e453e231fd54ed1c940411eb742c7ab0c104cc9d59795c1` | unchanged copy |
| `entryObservation.mjs` | `4eb7ec5db079cd6da1c3a8f59dd2858f4926eecc11526d9d790c48e0dde894f4` | unchanged copy |
| `selftest.mjs` | `f48e843bcac75def449fb17b0c4fefcba70f346ba2fa51a504f54e067556d9c6` | unchanged copy |
| `cgContract.pinned.mjs` | `5f3dbc2e29a62a4400df79e9c06b620792b39014be524dbeaeb453029ae083a5` | unchanged copy |
| `ownedSession.pinned.mjs` | `9a5c2556f606dc57c56dc063873e2f7ddcbf2d23e4c4fdeccac58301ff879d4b` | unchanged copy |
| `sourceSnapshot.pinned.mjs` | `b3e7f6814f9ab788e809fa2422ea723e84fbca427c60a017e9afc663b3343a20` | unchanged copy |

### (A) Real 3D local-tangent steering replaces the planar steering

`tangentSteering3d.mjs`:

- builds the tangent plane from the **live published `up`** — no face is assumed or hard-coded;
- projects **both** the target delta and each **measured** key displacement onto that plane;
- keeps all three coordinates; arrival uses `dist3`. The XZ number survives only as
  `finalDistXZToE_diagnosticOnly`, so the earned-1 figure stays comparable;
- decides key usability on the **tangent** magnitude, so an A/D key that moves purely in world Y on
  the +X face is a real, non-zero measurement;
- recalibrates whenever the frame goes stale (`basisStale`: face-name change **or** tilt > 12°, so a
  rounded-edge slide recalibrates before the label flips);
- **one bounded route attempt.** `stallVerdict` over the last 6 bursts stops the walk with its own
  telemetry (`alongSum`, `lateralSum`, `normalAbsSum`, `dist3dGain`). Obstacle failure stops with
  measurements — never a forced action, never a bigger timeout;
- **never** fabricates a pose and never calls a rail/state setter, teleport or milestone grant;
- reports **audit-plane footing** (`supported`, legitimately false off the audit plane — *not* a
  broken-planet-physics claim) **separately** from actual physics grounding.

New findings the probe can raise: `EC3D-LATERAL-KEYS-DEAD` (A/D produced no 3D motion at all — the
walk then cannot be read as an obstacle result) and `EC3D-ROUTE-STALLED`.

### (B) The player pose is finally retained

`poseObservation.mjs` retains the **raw bytes + sha256** of every `.player` key at four points:
pre-navigation, post-`beforeunload`/menu boot, immediately before the Continue click, and after the
real Continue — written to `playerpose-*.json` in the capture.

Across the **real** navigation a **passive CDP `DOMStorage`** session records
`domStorageItemAdded/Updated/Removed/Cleared` with old and new values. It is browser-side, reads
only, **patches nothing and changes no game value**, and `classifyPoseWrites` places each pose write
in a window between probe-placed marks — which is how a *shipped save write* is told apart from an
*early menu-boot overwrite* (`EC3D-POSE-WRITE-BEFORE-CONTINUE`). If CDP DOMStorage does not attach,
that is recorded as a declared gap; **no page-side fallback is used.**

### Gates preserved, plus the new one

Actual WorldSave equality, actor/world identity, milestone preservation, no-replay, the shipped
marker, and grounded arrival at E with the real `[F]` prompt all remain. Added:
`report.requiredGates.actualAcceptedNewAction` — **a restore alone is not a pass.**
Clamped pulses and runtime bounds are unchanged (450/350 ms calibration, 400/220 ms bursts,
90 s walk / 120 s earn / 180 s return budgets); only ordinary semantic clicks and the live canvas
rect are used.

## 4. CPU-only source reading (narrow, read-only, no fix inferred)

| file (sha256) | fact |
|---|---|
| `persistence.ts` `f01847c2…` L445-466 | `PlayerPose {pos, forward, pitch}` → `scopedWorldKey(world, '.player')`. The WorldSave blob carries no pose. |
| `storyState.ts` `e8802af8…` L1132-1137 | `storyAnchoredSpawn` is true only for prologue and ch1 ≤ `ch1-lift` — **not** a blanket ch13 anchor, so the ch13 saved pose *is* loaded. |
| `EfficientScene.tsx` `ab95dfe4…` L320-385 | `saved = storyAnchoredSpawn ? null : loadPlayerPose(...)`; then `resumeIsSafe = isDryClearResumePosition(...)`, else `findValidSpawnSite(radius 12)`, else `arrivalPose.playerSurfacePosition`. |
| `App.tsx` `36abbf38…` L1419-1462 | `doSave` → `saveGlobal/saveWorld/savePlayerPose`, fired by `beforeunload`, `visibilitychange` hidden, a 20 s interval (pose+global), and effect cleanup `doSave(false)`. |

The cleanup and interval writes are *candidate* mechanisms for an early overwrite. They are what the
CDP stream exists to observe. **No cause is asserted and no source change is proposed.**

## 5. CPU verification actually performed

| command | result |
|---|---|
| `node verifier/probes/earned-continue-3d/tangentSteering3d.selftest.mjs` | exit 0 — 10 cases, **45 checks**, all passed |
| `node verifier/probes/earned-continue-3d/selftest.mjs` | exit 0 — **108/108** (inherited modules unchanged; reused, not a full-suite rerun) |
| `node verifier/probes/earned-continue-3d/earned-continue-3d-probe.mjs --self-test` | exit 0 |
| `node --check verifier/probes/earned-continue-3d/earned-continue-3d-probe.mjs` | exit 0 |

Logs: `logs/earned-continue-3d-prep/`.

Required case coverage, on the **same module bytes the probe imports** (no mirrored
re-implementation asserting against itself):

- **+X face:** A/D produce non-zero 3D displacement and are `usable` — the exact check the XZ
  calibration failed; the case also asserts their XZ magnitude really is ~0, which is *why* earned-1
  recorded null.
- **+X face:** projection selects the world-Y key when the target delta is dominantly +Y.
- **+Y face:** the same helper selects an XZ key — no +X special case.
- **Face change:** `+Y → +X` is stale (named face change, ~90° tilt); a 20° same-face tilt is stale too.
- Along-leg / lateral / normal separated; 3D distance used; stalls stop the attempt; degenerate
  inputs refuse instead of fabricating.

Identity/imports: the new folder sits at the **same directory depth** as `arrival-common-earned`, so
`../../../../../../main/tools/lib/evidence.mjs` and `cgContract`'s `RUN_DIR/REPO_ROOT/CAPTURES`
resolution are unchanged — proved by the successful `--self-test`, which executes the whole import
graph. Cleanup is unchanged: the `finally` block detaches the CDP observer, stops only the **owned**
session, never the root preview, re-hashes the source manifest before and after, and writes
`cleanup-receipt.json`.

Learned timings and fixture labels are preserved: the labelled `?story=ch13-return&journeyprobe=1&debug=1&movie=1`
prerequisite (which seeds the ch13-return entry only, never `story:ch13-origin-landed`), the 15 s
rail-stall handover to ordinary keys, earned-1's `returnMs = 73763` reference, the 6 s menu settle,
60 s post-Continue poll and 2 s fps windows, and the labels
`prerequisite-fixture` / `actual-shipped-save` / `actual-continue-ui` / `scripted-input` / `actual-interaction`.

## 6. Proposed command — NOT RUN

```
flock -x <ABS_HEAVY_LOCK_PATH> -c '\
  node .codex/production-runs/2026-09-05-after-the-hearth/verifier/probes/earned-continue-3d/earned-continue-3d-probe.mjs \
    --url <CURRENT_ROOT_PUBLISHED_URL> \
    --expect-source-manifest <CURRENT_SOURCE_MANIFEST_SHA256> \
    --heavy-lock <ABS_HEAVY_LOCK_PATH> --heavy-lock-fd <INHERITED_FD> \
    --role earned-continue-3d-runtime \
    --out <ABSOLUTE_FRESH_CAPTURE_DIR>'
```

Root must first publish `activeRole = earned-continue-3d-runtime` in `verifier-control.json` (the
role does not exist there yet), the current manifest/served hashes re-hashed at release, and hand
over the heavy lock. **One fresh serialized measurement, after approval of these concrete files.**

## 7. Unresolved observation gaps (retained honestly)

1. **`GAP-SPAWN-BRANCH`** — EfficientScene's saved-pose validation/fallback branch
   (`resumeIsSafe` vs `findValidSpawnSite` vs `arrivalPose`) publishes no marker and is not
   observable from outside. Only the resulting position can be classified. No source change proposed.
2. **`GAP-ARRIVAL-FALLBACK-POSE`** — `arrivalPose.playerSurfacePosition` is not exposed, so
   `spawnVsSavedPose.arrivalFallbackPose` will be `null` and *resumed-at-arrival-fallback* cannot be
   confirmed on this run.
3. **`GAP-PHYSICS-GROUNDED`** — no physics ground-contact flag is published by
   `CommonGroundProbeSnapshot` or `pageReadState`; `physicsGrounded` stays `null` with
   `physicsGroundedAvailable = false`.
4. **`GAP-CDP-DOMSTORAGE-UNPROVEN`** — CDP DOMStorage attachment has not been exercised against a
   live browser in this CPU-only preparation. Failure at runtime leaves the write ordering unobserved.
5. **`GAP-A-D-ON-PLUS-X-UNMEASURED`** — earned-1 measured no usable A/D displacement on +X, so the
   CPU case uses a synthetic 2.23-unit +Y displacement. Whether the shipped controls actually move
   the body laterally on that face is an **open runtime question**; `EC3D-LATERAL-KEYS-DEAD` exists
   to record a negative answer honestly rather than read it as an obstacle.
