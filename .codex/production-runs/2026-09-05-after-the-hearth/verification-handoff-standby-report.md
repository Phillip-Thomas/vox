# Independent verification — sixth repair (handoff / standby)

Role: `handoff-standby-verifier` (fresh independent story-verifier, opus).
Written at (actual clock): **2026-09-06T16:16:02Z**;
**amended 2026-09-06T16:21:08Z** to apply root's precision review of
2026-09-06T16:18:15.191139+00:00 (see *Correction receipt* below).
Machine-readable twin: `verification-handoff-standby-report.json`
(sha256 `304182a0ff96ffc8e35551288b65e418a4b49315f0b1a23afd842dd106ec2cd2`).

**Not chapter acceptance. Not defect closure. Not publication authorization.**
No game, contract, gate, source-manifest, defect or shared-probe file was edited.
No prior evidence was overwritten and no other role's report or signature is claimed.

---

## VERDICT

**MIXED.**

- **Return-flight lane — PASS.** The committed Origin crossing stayed active,
  never reclaimed the departure pad, actually landed, and handed off to the survey.
- **Movie survey (long route) lane — PASS to `ch13-common`, with a qualification.**
  Zero rescues, no stall; drawing, offer, W's physical test and `route-tested` all proven.
  **But Terra's actual occupied body never reached the shipped standby `(-40, 51.05, 8)`**,
  and her minimum *actual occupied* clearance from the authored offered span was
  **0.927 units**.
- **COMMON reciprocal lane — FAIL.** A reproducible physical navigation stall
  (2 of 2 runs) stops Terra 0.72–0.77 units short of the common rail's waypoint 3.
  The 18-unit E-to-C passage, the far-reference F/occupancy, W's reciprocal test,
  the final commit and the objective clear are all **not reached**.

---

## Authority, source integrity and build

| item | value |
|---|---|
| control | `2026-09-06T16:02:52.741302+00:00`, `action=continue`, `activeRole=handoff-standby-verifier` |
| source manifest under verification | `dc63fbaeacea44166f41b4d9307bc2e31307fc28845c69512f75c7d641adc36c` |
| contract | `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e` (scene-v2) |
| source rehash BEFORE | 2026-09-06T16:00:09.590710+00:00 — 99/99 match, 0 mismatch, 0 missing |
| source rehash AFTER | 2026-09-06T16:01:26.470748+00:00 — 99/99 match, 0 mismatch, 0 missing |
| drift during verify | **none** |

### Phase 1 — my own `npm --prefix main run verify` (run once)

| field | value |
|---|---|
| command | `npm --prefix main run verify` |
| cwd | `/home/thomasphillip/Projects/vox` |
| started (UTC) | `2026-09-06T16:00:15.207720141Z` |
| finished (UTC) | `2026-09-06T16:01:16.752129209Z` |
| **exit code** | **0** |
| log | `logs/handoff-standby-verifier/verify.log`, 39182 bytes |
| log sha256 | `d029ad5f1883d5887e5b14bcee35af9acc51adf9f80b9cfaebe7ae468031a619` |
| tests | **351 files / 3158 tests passed / 0 failed** |
| gates | creative-workflow-UX 185, chapter-registry 4285, story-authority 1039, plus catalog/scene-av/chapter-journey/typecheck/preview/audio-diagnostic/story-ladder/guidance-target/audio checks and `vite build` |

This is my own receipt. It does not re-use or overwrite the integration engineer's
`logs/handoff-standby-repair/verify.log` (`54a473d4…5d7fa0`).

### BUILD READY — built file map (11 files)

- **Shipped JSON-file-map buildHash**
  (`previewBuildManifest().sha256` = `sha256(JSON.stringify(sorted path→sha256 map))`,
  recomputed by me with the shipped `main/tools/lib/previewSnapshot.mjs`):
  **`9dc37db5ff5ff2612a010cc1da1781fdc0f7243869199012374b02385b65d542`**
- **Auxiliary verifier build hash** (a *different* algorithm: SHA256 over
  codepoint-sorted `path` NUL `sha256` newline records):
  `c7b6395a472a27407389493e995aeeb5f611015b87197f6d1791b6db9479da03`

Full map in `logs/handoff-standby-verifier/built-file-map.txt` and in
`verifier-handoff-standby-progress.md`.

### Preview identity (root-owned; I started and stopped no server)

| check | value |
|---|---|
| URL | `http://127.0.0.1:38007/` (daemon pid 1538444) |
| ownership `sourceManifestSha256` | `dc63fbae…adc36c` — matches control |
| ownership `buildHash` | `9dc37db5…5d542` — matches my independently computed shipped hash |
| HTTP status / title | 200 / `<title>Paravoxia</title>` |
| index bytes / sha256 | 1568 / `1f699b4ab3edd8c792de8516920309f9a69c0e77152ec4d21041f4e561430260` |
| bundle | `/assets/index-BJql9v5k.js`, 5666976 bytes, `4f39f1ea60795e31e681c55c1b339af4a05590ec315e5cc0d712aab7a43b0ec4` |
| css / worker / sandbox chunk | all three match my built file map byte-for-byte |

Receipt: `logs/handoff-standby-verifier/preview-identity-38007.txt`.

Two factual notes, neither of which I acted on by editing a root-owned file:

1. **Port 38803 was never opened by this role.** It was bound to the prior manifest
   `1a50c19f…` and served `/assets/index-CbB2rmHN.js`; by the time I was released it
   was already stopped and absent from the listening ports. Both of my probes hard-refuse
   with `PREVIEW-MANIFEST-MISMATCH` unless ownership matches the control manifest.
2. **Ownership-record inconsistency.** At my ~16:03 read, `preview-ownership.json`
   still carried the prior record's `bundlePath`, `bundleSha256`, `verifierBuildHash`,
   `fullVerifyLog` and `identityRecheckedAt` alongside the new manifest/url/buildHash/index.
   Root states it replaced them before the capture release. I did not edit the file;
   all my measurements rest on my own HTTP byte checks above, which match the current build.

### Hardware / lock

Headed, `ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe, OpenGL 4.5.0)`, `rendererClass=hardware`,
software renderer refused, `assertHardwareGl` invoked by `openParavoxia` in every session.
All four browser sessions ran under an exclusive `flock` on
`/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock` (`-w 600`, uncontended,
never bypassed), one browser at a time. **No audibility or hearing claim is made anywhere.**

---

## Lane 1 — return flight `ch13-return` → landing → survey: **PASS**

Probe: `verifier/probes/handoff-standby-verifier/flight-return-probe.mjs`
(`f1747b8a…0f878`), a **copy** of `verifier/probes/flight-discriminator/flight-discriminator-probe.mjs`
(`15e65e89…24049`); the shared original is untouched.

Owned instrumentation fixes in the copy only:

1. **Post-capture logger-order error fixed.** The original called `say()` in `finally`
   *after* `lg.end()`, raising `ERR_STREAM_WRITE_AFTER_END` and exiting 1 after an
   otherwise-complete capture. `say()` is now write-guarded and the streams close last,
   after `run.json` and the cleanup receipt. **This run's probe exit code is 0.**
2. Preview URL read from root-owned ownership with the manifest-binding refusal.
3. Owned output dirs plus a non-empty-capture-dir refusal.

Entry `http://127.0.0.1:38007/?story=ch13-return&journeyprobe=1&debug=1&movie=1`.
Bounded window 120 s; **276 samples at 250 ms over 73.791 s**, stopped early by the
landing milestone, not by the bound.

*Fixtures, stated plainly:* `?story=ch13-return` is a prerequisite deep link and
`movie=1` is a scripted-input rail. This is not continuous earned history.

### Celestial trace (ship's celestial pose, not the seated capsule)

| t (ms) | activePlanetId | lastActive | epoch | locationMode | Origin-centre dist | note |
|---|---|---|---|---|---|---|
| 135 | `-1,-1:p1` | `-1,-1:p1` | 2 | surface | 2727.22 | departure pad, pos `[2180,-110,-1635]` |
| 7919 | `-1,-1:p1` | `-1,-1:p1` | 2 | local_space | 2510.89 | |
| 8399 | `-1,-1:p1` | `-1,-1:p1` | 3 | local_space | 2470.10 | target → `{system_body, slot 0, worldId "-1,-1"}` |
| **40535** | `-1,-1:p1` | | 3 | local_space | **180.08** | **Origin 185-unit activation envelope entered** |
| **41081** | **`-1,-1`** | **`-1,-1`** | **4** | atmosphere | 166.79 | **handoff to Origin; phase deep_space → descent** |
| **44980** | `-1,-1` | `-1,-1` | 4 | **surface** | **58.09** | **landed:** pos `[53.5,16,-16]`, velocity `[0,0,0]`, renderOrigin `[0,0,0]`, target `null`, phase `surface`, controlMode `fps` |
| 73791 | — | — | — | — | — | beat `ch13-return` → `ch13-survey`, objective `ch13:return:board` → `ch13:survey:start` |

| requirement | result | evidence |
|---|---|---|
| committed Origin stays active, **no departure reset** | **PASS** | post-envelope maximum Origin-centre distance is **180.08** (prior failure reclaimed **2736.67**); `activePlanetId="-1,-1"` held from 41081 ms to the end |
| prior epoch jumps `3→5` and `6→8` | **not reproduced** | epochs observed were only **2 → 3 → 4** |
| actual landing | **PASS** | celestial pose frozen at `[53.5,16,-16]`, velocity zero, `locationMode=surface`, HUD `Ship: landed`, `Coordinate: -1,-1` |
| `story:ch13-origin-landed` | **PASS** | latched at 73791 ms; ch13 milestones `["story:ch13-fault-reviewed","story:ch13-origin-landed"]` |
| `anc.cg.origin-landed` | **NOT MEASURED** | this probe reads only the *count* of `signedSceneAv` keys (7), not `avFull.anchorId`. An instrumentation gap, not a negative finding. |
| subsequent survey transition | **PASS** | `ch13-survey` / `ch13:survey:start` / marker `Survey start · begin a route` / health `ready` |
| rescues | **zero** | `nudges=0`, `teleportNudgesTotal=0`, `backstops=0`, `stuck=0` |

Frame read: `verifier/captures/handoff-standby/flight-1/999-final.png` — grounded
first-person view on Origin, `Ship: landed`, world marker `survey start · begin a route · 8m`
matching the HUD objective. No blank/black frame, no pop, no wrong-era glimpse, no
missing HUD element.

---

## Lane 2 — movie survey, LONG route, `ch13-survey` → `ch13-common`: **PASS**

Probe: `verifier/probes/handoff-standby-verifier/journey-probe.mjs` (`c3fbc90b…511fba`),
a **copy** of the run-local harness `verifier/probes/cg-journey-probe.mjs`
(`af35801e…572c41`); the shared original is untouched. Owned edits are relative
library paths for the new folder plus the added manifest-binding refusal — no logic change.
Self-tests before measuring: cg-journey OK, `cg-harness-selftest` 25/25, `cg-harness-prep-selftest` 41/41.

Outcome `REACHED-STOP-PREDICATE`, `reached-beat:ch13-common` at **42.890 s**, probe exit 0,
`pageErrors=[]`, **stall predicate armed (20 s) and never fired**,
**zero rescues** (`teleportNudgesTotal=0`, no forced clicks, no progression grants).
Route is LONG — the shipped rail drives `CG_ROUTE_LONG` via `commonGroundDirector`'s
`survey-long` waypoint key.

Anchor chain, in order: `anc.cg.repeated-measure` (4323 ms) → `anc.cg.demonstration-opened`
(14616) → `anc.cg.survey-started` (17450) → `anc.cg.trace-drawn` (25040) →
`anc.cg.route-offered` (25713) → `anc.cg.route-tested` → `anc.cg.reciprocal-reference`.

| requirement | result | evidence |
|---|---|---|
| real drawing | **PASS** | 7.590 s of live drawing between `survey-started` and `trace-drawn` |
| real offer | **PASS** | `anc.cg.route-offered`; interaction `story-ch13-offer-route` ("Offer to demonstrate a route"), `performOutcome=returned`, `promptOutcome=cleared`, clearing latency 0 ms |
| W physically testing the span | **PASS** | `survey.phase="tested"`, `acceptedSamples=42`, `acceptedClass="fixed-reference"`; audit-worker walked **104.909 units** |
| route-tested | **PASS** | `anc.cg.route-tested` present |
| subsequent COMMON proof | **NOT PROVEN** | entering `ch13-common` is a transition observation only; the reciprocal proof itself fails in Lane 3 |

### Repaired standby — measured (amended per root's 16:18:15 precision review)

**The shipped Terra survey standby is the desired target `(-40, 51.05, 8)`**,
`arriveRadius 0.6`, rail action `walk`, reason **"standing clear of the span he is
testing"** (issued at `anc.cg.route-offered`), re-issued at the `ch13-common` entry as
**"standing clear while he takes the reference"**.

> **Correction.** My 16:16Z draft named `(-42, 51.05, 12)` as the standby. That point
> is **W-7744's E position and the `ch13-common` route goal** (cursor 0 of the common
> span, and the last waypoint of the demonstrated route) — **not** Terra's standby. The
> draft clearance figure of **1.754 units is withdrawn**: it was measured for the wrong
> point, against a 250 ms-sampled draw that ended at `anc.cg.trace-drawn` and therefore
> excluded the last drawn/offer approach, and it was in any case a *desired-point*
> figure, not the commissioned occupied-body clearance.

| field | measured value |
|---|---|
| requested goal (the standby) | `walk` → **`[-40, 51.05, 8]`**, `arriveRadius 0.6` |
| reason at `route-offered` | "standing clear of the span he is testing" |
| reason at `ch13-common` entry | "standing clear while he takes the reference" |
| navigation action sequence | `walk` (26009 ms) → **`hold`** "following his test" (26765 ms) → `walk` again (43196 ms) |
| supported ground body | `supported=true`, `worldBound=true`, `groundOffsetUnits=1.8`, bodyCentre `[-41.361, 52.789, 12.202]`, bodyPose `[-41.349, 50.989, 12.202]` |
| controls | `controlMode=fps`, `phase=surface`, `autopilot.routeAction=walk` (raw key state is not published on `window`) |
| W pose / hold | `[-42, 51.05, 12]` during his test, `[-40, 51.05, 12]` at `reciprocal-reference`; leg `position-to-h` → `holding-h`; **route-tested proven** |

**Actual route — the authored offered polyline.** Reconstructed from the rail targets
actually issued while `reason="walking the demonstrated route"` (cursors 1–18) in my own
live trace: 19 waypoints, `(-26, 51.05, 12.35)` → `(-42, 51.05, 12)`, **41.056 units**.

**Clearances, kept strictly apart:**

| measure | value | status |
|---|---|---|
| **desired-target** clearance of `(-40, 51.05, 8)` from the authored offered polyline | **4.472 units** | desired-point only — **not** the commissioned figure |
| **ACTUAL OCCUPIED body** clearance from the authored offered polyline, over the whole standby window `route-offered (26009 ms) → reciprocal-reference (44242 ms)`, 61 samples | **min 0.927 / max 3.219 units** | **this is the commissioned occupied-body clearance** |

The 0.927-unit minimum occurs at t=26009, body `[-41.073, 52.789, 11.987]`, **while the
rail reason was literally "standing clear of the span he is testing."**
*Caveat:* this is centre-to-polyline horizontal distance from the live `bodyCentre`; the
body radius/footprint is not published, so it is not a body-surface clearance.

**Standby occupancy — never achieved.**

| field | value |
|---|---|
| ever occupied (within `arriveRadius 0.6`) | **No** |
| closest approach to `(-40, 51.05, 8)` | **1.482 units**, at t=44242, body `[-39.995, 52.79, 9.482]` — and only after the next rail leg had already retargeted her to the common span |
| distance during the actual test window (26009 → 43196 ms) | **4.107–4.129 units**, body parked at ≈`(-41.07, 11.97)` |
| what intervened | at t=26765 the rail superseded the walk with `action="hold"`, reason "following his test", before arrival |

Whether that supersession is authored is a **source question this role did not and
cannot settle**; root reports a source audit underway. What is measured is that the
standby goal was requested, was never occupied, and Terra stood 0.927–3.219 units from
the span W was testing throughout.

**Producer's rejection corroborated, now against the authored polyline** (not a sampled
reconstruction):

| candidate | min horizontal clearance from the authored offered polyline |
|---|---|
| `(-42, 51.05, 20)` — rejected | **0.0** (lies exactly on an authored offered waypoint) |
| `(-42, 51.05, 22)` — rejected | **0.0** (lies exactly on the authored offered span) |

Either would have blocked the very span W tests.

### Objective lifecycle (survey lane)

| objective | marker label | health | standing work order (actionable verb/input) | cleared with |
|---|---|---|---|---|
| `ch13:survey:offer` | `W-7744 · offer a route` | ready | "Approach W-7744." / "**[F]** Offer to demonstrate a route." | `anc.cg.demonstration-opened` |
| `ch13:survey:start` | `Survey start · begin a route` | ready | "Walk to the survey start." / "**[F]** Begin recording your route." | `anc.cg.survey-started` |
| `ch13:survey:draw` | `Survey end · demonstrate a route` | ready | "Walk your route to the survey end." / "**[F]** Offer the recorded span." | `anc.cg.trace-drawn` |
| `ch13:survey:offer-span` | `Trace end · offer this span` | ready | "**[F]** Offer the walked span for W-7744 to test." | `anc.cg.route-offered` |
| `ch13:survey:test` | `W-7744 · offered route` | ready | "Keep his approach clear. Follow his progress, or return to the last tested point to revise." (text changed in place to "W-7744 is testing the offered route." — no re-entry) | at beat `ch13-common` |
| `ch13:common:reciprocal` | `Far reference · check my route` | ready | "Give him room to reach it. When the guide appears, follow it from the survey end." | — |

Every state carried a concrete verb or input; no `missing-marker` state and no stale
objective was observed. Entry feedback: 5 `objectiveEnter` and 5 `markerAcquired` triggers
for 5 distinct objectives entered — one shot per objective ID. *(Trigger counts from
shipped telemetry; not an audibility claim.)*

---

## Lane 3 — COMMON reciprocal passage: **FAIL (reproducible physical stall)**

Both runs start at `ch13-survey` and walk **into** `ch13-common` in the same session —
the COMMON leg was **not** deep-linked. (The `ch13-survey` entry itself is still a
prerequisite deep link, so this is not continuous earned full-story history.)
Stop predicate requested: `--until-anchor anc.cg.handback`.

| run | exit | outcome | stop at | stall window | player moved in window | frozen for |
|---|---|---|---|---|---|---|
| `journey-common-1` | 3 | FAIL-STALL | 66.531 s | 20005 ms (req. 20000) | **0 units** | 19.737 s |
| `journey-common-2` | 3 | FAIL-STALL | 66.964 s | 20206 ms (req. 20000) | **0.001 units** | ~20 s |

Exit code 3 is a **measured game failure**, not a probe error.

### The stall, exactly

The common rail issues waypoints and Terra's body stops hard before waypoint 3:

| t (ms) | cursor | requested target | arriveRadius | actual body |
|---|---|---|---|---|
| 43196 | 18 | `[-40, 51.05, 8]` | 0.60 | `[-40.831, 52.789, 11.765]` |
| 44242 | 0 | `[-42, 51.05, 12]` | 0.35 | `[-39.995, 52.790, 9.482]` |
| 44969 | 1 | `[-42, 51.05, 14]` | 0.35 | `[-41.758, 52.789, 11.909]` |
| 45503 | 2 | `[-42, 51.05, 16.6]` | 0.35 | `[-41.666, 52.790, 14.404]` |
| **45989** | **3** | **`[-44.6, 51.05, 16]`** | **0.35** | `[-42.619, 52.789, 16.219]` — **last waypoint ever issued** |

Approach to that waypoint, run 1 (horizontal distance to goal):

`45989 → 1.9934` · `46259 → 0.7736` · `48102 → 0.7704` · `52051 → 0.7704` ·
`60242 → 0.7704` · `66264 → 0.7704`

Last body movement at **46794 ms**; then frozen for **19.737 s** at
`[-43.8296, 52.7887, 15.9904]`, **0.7704 units** horizontally short of a goal whose
arrive radius is 0.35. Run 2 froze at `[-43.881, 52.789, 15.937]`, **0.7217 units** short.

State at the stall (identical in both runs):

- objective `ch13:common:reciprocal`, health `ready`, marker `Far reference · check my route`,
  standing work order **"W-7744 is holding the reference." / "Walk the guide line to check your route from this end."**
- anchor `anc.cg.reciprocal-reference`; `holdReason=null`, `prompts=[]`, `markerCount=0`
- `supported=true`, `worldBound=true`, `groundOffsetUnits=1.8`
- `common.stage="holding-h"`, `committed=false`, `comparisonProved=false`,
  `finalReferenceOffered=false`, `finalReferenceOccupied=false`, `workerUnits=0`
- W held at H `(-40, 51.05, 12)`, leg `holding-h`, `travelled=0`
- `common.terraUnits` froze at **5.795** (run 1) / **5.845** (run 2) **of the required 18**
- `autopilot.routeAction="walk"`, `stillTime=0`, `teleportNudgesTotal=0`

### Failure boundary (why this counts as a stall)

- **Not the excluded actionable reference hold.** `holdReason=null`, no prompt, no marker,
  and the standing copy is an active instruction ("Walk the guide line…"), not a wait.
- **Not moving ship travel.** `phase=surface`, `controlMode=fps`.
- **Not a masked rescue.** Zero nudges and zero teleports in both runs; the probe
  attempted no rescue and none occurred.
- **Measured behaviour (mechanism NOT proved):** the COMMON rail's waypoint 3, requested
  goal `(-44.6, 51.05, 16)` with `arriveRadius 0.35`, is never arrived at — the body stops
  hard at `x ≈ -43.83/-43.88` and never closes the remaining ~0.72–0.77 horizontal units,
  so the cursor never advances past 3. **This role did not establish the collision/footing
  mechanism behind that stop.**
- **Visual inference only:** `verifier/captures/handoff-standby/journey-common-1/0026-stall-fail.png`
  shows the orange common guide line and a raised green terrain step immediately in front
  of the frozen viewpoint. Per root's 16:18:15 correction this is a **visual inference, not
  a proved causal collision mechanism**.

### Commissioned assertions

| assertion | result | measured |
|---|---|---|
| Terra's ordered 18-unit E-to-C passage | **FAIL** | `terraUnits` 5.795 / 5.845 of 18; `anc.cg.reciprocal-crossed` never fired |
| actual T `F` / occupancy at the far reference `T (-44,51.05,12)` | **NOT REACHED** | `finalReferenceOffered=false`, `finalReferenceOccupied=false`, `anc.cg.final-reference-offered` never fired. **No later F was pressed after the failed prerequisite.** |
| W's full 18-unit reciprocal passage | **NOT REACHED** | worker leg `holding-h`, `workerUnits=0`, `anc.cg.independent-test` never fired |
| final commit / anchors | **NOT REACHED** | `committed=false`, `comparisonProved=false`; `anc.cg.complete` and `anc.cg.handback` never fired |
| objective clear when reached | **NOT REACHED** | `ch13:common:reciprocal` stayed `ready` and never cleared |

Endpoint proximity, elapsed time, saved proof and nudges were not counted toward any of these.

### Authored short-reference route

**NOT EXERCISED — neither passed, nor failed, nor shown to be unreachable.**
The fixed shipped movie harness selected the **LONG** route in all three journey runs
(`witnessOffered=false`, `witnessOccupied=false`), so the authored short-reference route
was simply never exercised in this scope.

> **Correction.** My 16:16Z draft said this lane had "no valid prerequisite" because
> COMMON is blocked. Per root's 16:18:15 review that is wrong: the COMMON stall is
> **downstream** of the short survey and does not invalidate the short survey's
> prerequisites.

---

## Objective visual defects

| frame | beat | finding |
|---|---|---|
| `verifier/captures/handoff-standby/journey-common-1/0026-stall-fail.png` | `ch13-common` | Viewpoint frozen against a raised terrain step while the standing objective instructs "Walk the guide line to check your route from this end."; the guide line continues past ground the body cannot pass. This is the visual face of the measured stall. |
| all other captured frames (four sessions) | `ch13-return` / `ch13-survey` / `ch13-common` | **None.** No blank or black frame, no `bootBlackFrameCandidate`, no `blankByStats`, no wrong-era glimpse, no HUD element missing that copy references. `pageErrors` empty in all three journey runs. |

**This is a generic, screenshot-level statement about the frames I captured. It does NOT
contradict or close root's new CG-014 arrival-guidance finding, which stands.**

---

## Exit codes (role vs probe, reported separately)

| probe | run | exit | meaning |
|---|---|---|---|
| `flight-return-probe.mjs` | `flight-1` | **0** | clean capture and clean cleanup; the inherited `ERR_STREAM_WRITE_AFTER_END` exit-1 defect is fixed in this copy |
| `journey-probe.mjs` | `journey-survey-1` | **0** | reached the requested stop predicate |
| `journey-probe.mjs` | `journey-common-1` | **3** | FAIL-STALL — measured game failure |
| `journey-probe.mjs` | `journey-common-2` | **3** | FAIL-STALL — measured game failure |
| `npm --prefix main run verify` | — | **0** | 3158/3158 tests, build ok |

---

## Cleanup receipt

- Browsers opened by this role: **4**; stopped: **4**; abandoned: **0**; abandoned probes: **0**.
- Receipts: `flight-1/run.json` (`stopped=true, requests=1, error=null`) and
  `cleanup-receipt.json` in each of the three journey capture dirs
  (`sessionStopped=true, cleanupRequests=1, cleanupError=null, stopsRootPreview=false, killsProcesses=false`).
- Post-`finally` check: `pgrep` for `ms-playwright` chrome after all runs found only shared
  crashpad handlers belonging to other sessions; no probe-owned browser survived.
- Servers started by this role: **0**. Servers stopped by this role: **0**. No other
  process or server was stopped. The root preview at `http://127.0.0.1:38007/` is still
  running and untouched.
- Heavy lock released after every acquisition.
- Game source edits **0**, contract edits **0**, gate edits **0**, manifest edits **0**,
  defect edits **0**, shared-probe edits **0**, prior evidence overwritten **0**.

---

## Artifacts

| artifact | path | sha256 |
|---|---|---|
| verify log | `logs/handoff-standby-verifier/verify.log` | `d029ad5f1883d5887e5b14bcee35af9acc51adf9f80b9cfaebe7ae468031a619` |
| source rehash before/after | `logs/handoff-standby-verifier/source-rehash-{before,after}.json` | — |
| built file map | `logs/handoff-standby-verifier/built-file-map.txt` | — |
| preview identity | `logs/handoff-standby-verifier/preview-identity-38007.txt` | — |
| flight probe | `verifier/probes/handoff-standby-verifier/flight-return-probe.mjs` | `f1747b8a4773798f43d9763f41cbea42727ecc5ebe492b21ce2236230ef70878` |
| journey probe | `verifier/probes/handoff-standby-verifier/journey-probe.mjs` | `c3fbc90bf2a4722be54655705498d6ec82f9c7915017fa8a482e942c15511fba` |
| rehash tool | `verifier/probes/handoff-standby-verifier/rehash-source.py` | `fed0c17a9337d36d56e6ab9e3240519a1e02bf4787c5be55833e8e0f16340f4b` |
| flight run.json | `verifier/captures/handoff-standby/flight-1/run.json` | `74465b140d256735746f112f8fbd9ef7e355dd92c89e9f6d35ca31c3ee5cd947` |
| flight telemetry | `logs/handoff-standby-verifier/flight-1/telemetry.jsonl` | `c48ca4e83c63b09f2b146456e21fc58fe43cc3e4eeaaa967e43e5d4971a5330b` |
| survey summary / trace | `verifier/captures/handoff-standby/journey-survey-1/{summary.json,trace.ndjson}` | `70e862df…1f32c7` / `4dfd2689…da1e823` |
| common-1 summary / trace | `verifier/captures/handoff-standby/journey-common-1/{summary.json,trace.ndjson}` | `6cb1916b…8ab36` / `3a3d536d…8e5a11` |
| common-2 summary / trace | `verifier/captures/handoff-standby/journey-common-2/{summary.json,trace.ndjson}` | `a61e57b4…8975f6` / `7c326076…071e76` |
| consoles | `logs/handoff-standby-verifier/{flight-1,journey-survey-1,journey-common-1,journey-common-2}-console.log` | — |

Frames: 11 (flight-1) + 22 (survey-1) + 27 (common-1) + 25 (common-2), each stamped with
its live beat/anchor/objective.

---

## Limitations (this report claims nothing beyond these lanes)

- Not chapter acceptance, not defect closure, not publication authorization.
- Every lane entered through a `?story=` deep link plus a `movie=1` scripted-input rail.
  **No lane is continuous earned history**; no zero-rescue full-story claim is made.
- `anc.cg.origin-landed` was not read by the flight probe; only the
  `story:ch13-origin-landed` milestone and the beat transition are proven for the landing.
- Occupied-body clearance is **centre-to-polyline horizontal distance**; the body
  radius/footprint is not published on the diagnostic, so it is not a body-surface clearance.
- Why the standby walk was superseded by a `hold` before arrival is a **source question
  this role did not settle**.
- The collision/footing mechanism behind the COMMON waypoint-3 stop is **not proved** by
  this role; the raised terrain step is a visual inference.
- No audibility or hearing claim; sfx figures are trigger counts.
- No FPS measurement in this scope.
- Desktop variant only; no mobile, reduced-motion or low-tier capture.
- One flight run and two COMMON runs — this is **not** the three-cold-run requirement.
- The short-reference route is **unexercised** — not failed and not shown unreachable.
- My frame-level "no visual defect" observation does not contradict or close root's
  **CG-014** arrival-guidance finding, which stands.
- I make no generalization about the earlier manual attempts; the producer reviews qualify
  those older reports, and I have not overwritten them or claimed their signatures.

---

## Correction receipt

Root precision review read at `verifier-inbox.md` **2026-09-06T16:18:15.191139+00:00**,
applied before this report was final. Changes made to **my own** files only; no other
role's report was altered.

1. **Standby misnaming corrected.** `(-42, 51.05, 12)` is W-7744's E position and the
   `ch13-common` route goal, not Terra's survey standby. The shipped standby is
   `(-40, 51.05, 8)`, `arriveRadius 0.6`.
2. **Clearance figure 1.754 withdrawn.** It was measured for the wrong point, against a
   sampled draw ending at `anc.cg.trace-drawn` that excluded the last drawn/offer
   approach, and was a desired-point figure. Replaced by the **actual occupied-body
   clearance: min 0.927 / max 3.219 units**, plus a separately labelled desired-target
   figure of 4.472.
3. **Short-reference route reworded** to "the fixed movie harness selected LONG, so it was
   not exercised" — the COMMON stall is downstream and does not remove its prerequisites.
4. **Raised terrain downgraded** from an unambiguous cause to a visual inference; no
   collision mechanism is proved here.
5. **CG-014 preserved:** my generic "no HUD/frame defect" observation does not contradict
   or close root's new arrival-guidance finding.

The superseded draft values existed only in this role's own 16:16Z JSON/MD; no prior
evidence, capture byte or other role's artifact was overwritten.

## Remaining gates (still required, explicitly NOT claimed here)

1. Manual COMMON corner recovery / the signed ordered 18-unit E-to-C passage (CG-IMPL-009).
2. Primary earned Continue.
3. Full-story and space-station continuity.
4. Three cold runs per beat.
5. Variant (mobile / reduced motion / lowest in-scope tier) and performance evidence.
6. Raw audiovisual evidence and the independent creative reviews.
7. `anc.cg.origin-landed` AV-anchor confirmation for the landing.
8. The authored short-reference survey route.
