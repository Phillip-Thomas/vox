# earned-continue-3d-runtime — bounded runtime report

**Status: RAN — bounded restore proved; NEW ACCEPTED ACTION NOT PROVED. Not an acceptance. Chapter 13 remains unverified.**

Actual clock (host `date -u`, never inferred from tokens):
started `20:14:21Z`, GPU granted `20:22:35Z`, probe `20:23:18Z → 20:26:30Z` (exit 1), report `20:28Z`.
CPU wait before GPU: 8m20s of mandated corrections and ≤30s control polls. No browser, lock or audio was touched in that window.

Environment: headed Chromium, `ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe, OpenGL 4.5.0)` — real NVIDIA, **not** headless, root immutable preview `http://127.0.0.1:34413/` (not launched by this role), source manifest `6ef957c3…`, heavy lock held exclusively via inherited **fd 9** (`exec 9<>LOCK; flock -w60 -x9`).

## 1. Pre-GPU corrections (producer review) — all applied and all effective

| Correction | Outcome |
|---|---|
| Ground frame: use published **foot** (`bodyPose`), not `bodyCentre`, for every ground-target arrival/steering/progress | **Effective.** Both reported separately at every burst; at walk end footDistToE **90.053** vs centreDistToE **90.825**. Radius left at **1.2**, no Y dropped. |
| Focused helper test (`centre[-42,52.85,12]`, `foot[-42,51.05,12]`, `up[0,1,0]` must arrive at E; wrong-foot / unsupported / stale-beat must not authorize F) | **25 checks, 0 failed.** Includes the proof that the prepared centre-based gate was arithmetically impossible (1.8u offset > 1.2u radius). |
| Caller actually uses the tested helper | **Verified.** Arrival → `groundTargetArrival`; pre-[F] → `groundedActionGate`. All residual centre uses are suffixed `_diagnosticOnly`. |
| Lateral keys alive in 3D | **Defect fixed, confirmed in runtime.** earned-1 had `KeyA=null, KeyD=null` on +X. Every round here: A and D `usable=true` (e.g. A 3d=1.725 tangent=1.724; D 3d=0.899 tangent=0.406). |
| exec-9 FD lock shape, not the prep's path-form `flock` | **Verified** against a scratch lock pre-GPU (`owned=true`, FLOCK/WRITE), then used for the real run. |
| Pre-[F] grounding gate | **Effective — it correctly REFUSED.** No [F] was pressed. |

## 2. What was proved (bounded)

- Origin landing **physically earned** from the labelled `ch13-return` prerequisite (77s, fps 60, `originLanded=true`).
- Unfinished ordinary drawing captured, then a **real `beforeunload`** save.
- **Real landing Continue UI**: title `Paravoxia`, CTA `▶ Continue`, waited for CTA *before* story runtime. No deep link.
- Restore: `worldSaveEquality`, `worldActorIdentity`, `milestonesPreserved` (none lost), `noAnchorReplay` — **all true**.
- Saved **19** samples → **20** on disk after Continue. **Sample-count growth is not data loss**; the saved prefix survived. Equality is never asserted from count alone.

## 3. What was NOT proved

`actualAcceptedNewAction = false`. The walk did not reach E; **no [F] was pressed**; no named anchor was earned. Not claimed.

## 4. Route-blocking cause — POSE OVERWRITTEN (data finding, not a steering defect)

The separate `pvx.v1.world.-1,-1.player` key did **not** survive the lifecycle. Retained bytes:

| Lifecycle point | bytes | pos |
|---|---|---|
| before-navigation (earned) | 168 | `[-26.540, 52.790, 12.596]` |
| after beforeunload + menu boot | 171 | `[-31.991, 52.789, 21.416]` |
| menu immediately before Continue | 171 | `[-31.991, 52.789, 21.416]` |
| after real Continue | 122 | `[53.754, 13.5, -14]` |

DOMStorage events across navigation (passive CDP, wrote nothing):
- `20:24:44.338Z` probe reads earned pose `[-26.540, …]`.
- `20:24:44.353Z` — **15 ms later** — `updated` on the player key, oldValue `[-26.540, …]` → `[-31.991, …]`. An autosave landed *during* the navigation/menu-boot window.
- `20:24:52.264Z` — after the Continue click — `updated`, oldValue `[-31.991, …]` → `[53.754, 13.5, -14]`, roughly **93 units** from the menu-time saved pose.

**Consequence:** the body resumed ~90 u from ground target E `[-42, 51.05, 12]`, so the ordinary route began 90 u away and could not close inside its 90 s budget (36 bursts, `budget-exhausted`, ~22 s of which went to 7 forced recalibration rounds as the live `up` changed face repeatedly).

**Source callsite hypothesis — NOT a patch, no game source edited:**
- *Overwrite window*: `main/src/App.tsx:1419-1462` — `doSave(withVoxels) → savePlayerPose` fires on `beforeunload`, on `visibilitychange` hidden, on a 20 s interval, and from the autosave effect cleanup as `doSave(false)`. A write landing 15 ms after the earned read is consistent with the cleanup/`beforeunload` pair both writing during the same navigation.
- *Spawn fallback*: `main/src/components/EfficientScene.tsx:336-380` — loads the saved pose, computes `resumeIsSafe = isDryClearResumePosition(...)`; on false uses `findValidSpawnSite(radius 12)`, **otherwise** `arrivalPose.playerSurfacePosition`. The observed ~93 u displacement is far outside radius 12, so the reading consistent with the data is that the saved pose was rejected and the `arrivalPose` branch taken.
- Confidence: **hypothesis** from observed storage events plus shipped code paths. The branch actually taken was not instrumented and is **not asserted**.

## 5. Private probe fault found (recorded, not silently patched)

`EC3D-PROBE-OFFERSF-OBJECT` — `promptOffersF(...)` returns an **object**, not a boolean; the pre-[F] log printed `[object Object]` and `groundedActionGate` received a truthy object. **No impact on this verdict** (the gate refused on foot-distance and audit-support, which are independent), but an object would read as "offering [F]" had the other conditions held. Must be corrected before any lane that can actually reach E. Not corrected here: discovered after the single bounded attempt, with insufficient actual clock left for a corrected rerun.

## 6. Integrity

One attempt, **no identical retry**. No pose setter, no rail grant, no milestone write, no forced interaction, no endpoint-near-only success, no fake physics, no movie zero-rescue claim. Browser closed, owned session only, root preview untouched, source intact after capture, raw failure retained. No game/source/contract/build/producer-control/invocation file was modified.

**Not claimed:** full chapter verification, full UX or taste, accepted new action, or correct pose restore beyond the storage events shown.
