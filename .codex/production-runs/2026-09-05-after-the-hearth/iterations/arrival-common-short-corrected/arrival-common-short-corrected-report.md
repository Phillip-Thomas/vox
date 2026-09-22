# arrival-common-short — CORRECTED measurement report

- role: `arrival-common-short-runtime` · lane: SHORT (corrected measurement frame)
- written: 2026-09-06T19:48:23.888780+00:00
- **VERDICT: CORRECTED-SHORT-PROBE-CHECKS-PASS-ON-3-OF-3-COLD-HEADED-TRIALS**

> The two ROOT-AUTHORIZED measurement corrections were applied to this lane's OWN probe and three fresh cold headed hardware trials completed serially, each passing all 20 gates including the two previously-failing ones. This is a corrected PROBE-CHECK result for a LABELLED ch13-survey fixture. It is NOT an earned arrival, NOT COMMON, NOT a chapter or first-time-usability claim, and carries no UX, score, audibility, taste, continuity, variant, FPS or defect-closure claim.

## 1. What was corrected (both root-authorized)

### (1) Foot-frame occupancy comparison
- **What:** occupancyRequirementVerdict now compares the runtime-PUBLISHED projected foot pose (diagnostic bodyPose) against the ground-frame witness pose, and requires standPointFrame === "foot". bodyCentre, up and groundOffsetUnits are retained separately as their own measurements.
- **Source semantics read (only as needed):** main/src/story/commonGroundDirector.ts: body = player() = commonGroundPlayerPose() (= centre - up*CG_PLAYER_GROUND_OFFSET), and occupancy is nextOccupancy(body, pose); getCommonGroundProbeSnapshot publishes that same pose as bodyPose. main/src/story/commonGroundRoute.ts: withinOccupancyCylinder uses OCCUPANCY_RADIUS_UNITS / OCCUPANCY_VERTICAL_UNITS.
- **Thresholds changed:** False
- noConstantSubtracted: True
- noFootInferred: True
- unavailableFootBehaviour: standPointFrame becomes "unavailable" and the gate FAILS as UNMEASURED; it is never backfilled from the centre

### (2) Accepted-vs-recorded sample count
- **What:** shortCompletionVerdict now compares acceptedSamples to the runtime free-recorder count captured at the offer/freeze instant (diagnostic survey.samples immediately after anc.cg.route-offered), instead of to this probe's walked waypoint-leg count. Both counts are recorded separately.
- **Source semantics read (only as needed):** main/src/story/commonGroundDirector.ts getCommonGroundDiagnostic: samples = survey.working.samples.length; acceptedSamples = survey.accepted.samples.length
- **Thresholds changed:** False
- equalityStillExact: True
- missingCountBehaviour: a null / non-positive recorder count is UNMEASURED and FAILS; it is never assumed equal

Nothing was weakened: the 1.25 / 0.6 cylinder and exact-count equality are unchanged, and every new "unmeasured" path FAILS rather than passing.

## 2. Owned file changes (before/after bytes)

| file | before sha256 | before bytes | after sha256 | after bytes |
|---|---|---|---|---|
| `verifier/probes/arrival-common-short/short-survey-probe.mjs` | `82a49ba5787bcc11…` | 39351 | `5fb64456e5208417…` | 43237 |
| `verifier/probes/arrival-common-short/shortSurveyLogic.mjs` | `83981677b9ccf696…` | 27249 | `7e6fb3626d3b3dca…` | 33363 |

Game source edited: **False** · contract edited: **False** · build rerun: **False** · full suite rerun: **False** · shared probe lib edited: **False** · pinned copies edited: **False**

## 3. Targeted tests (no unchanged full-suite rerun)

- `shortSurveyLogic.mjs --self-test` exit **0**
- `selftest.mjs` (lane suite) exit **0**
- `node --check` both files exit **0**
- unchanged full suite: NOT rerun, per commission

New old-mismatch / new-equivalent cases, all green:

  - OLD-MISMATCH: a body-CENTRE stand point is refused as an unmeasured frame, not silently scored
  - NEW-EQUIVALENT: the runtime-published FOOT pose for the same retained instant is inside the 1.25/0.6 cylinder
  - the 0.6 VERTICAL allowance is unchanged: a foot pose 0.74u high still fails
  - the 1.25 RADIAL allowance is unchanged: a 1.3u foot-frame stand-off still fails
  - an unavailable foot frame is UNMEASURED and fails; it is never inferred from the centre
  - OLD-MISMATCH/NEW-EQUIVALENT: 16 accepted vs 16 recorded passes even though only 8 waypoint legs were walked
  - a REAL accepted-vs-recorded disagreement (16 vs 15) still fails
  - an uncaptured recorder count is UNMEASURED and fails; it is never assumed equal
  - a zero recorder count cannot satisfy the accepted-vs-recorded clause

## 4. Three fresh cold headed hardware trials (serial, one browser at a time)

| trial | node exit | verdict | elapsed | gates | failed gates | stalls |
|---|---|---|---|---|---|---|
| trial-1 | 0 | SHORT-HELD-REFERENCE-PROVEN | 52926 ms | 20/20 pass | none | 0 |
| trial-2 | 0 | SHORT-HELD-REFERENCE-PROVEN | 51303 ms | 20/20 pass | none | 0 |
| trial-3 | 0 | SHORT-HELD-REFERENCE-PROVEN | 52961 ms | 20/20 pass | none | 0 |

Elapsed variance across trials: **1658 ms**. Timeout rescues **0** · GPU rescues **0** · source rescues **0**.

Renderer (all three): `ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe, OpenGL 4.5.0)`, headed = True, swiftshader = False.

## 5. CORRECTION (1) — foot-frame occupancy, measured

Witness pose is the GROUND-frame `[-34, 51.05, 10]`. The runtime evaluates occupancy on `commonGroundPlayerPose()`, which it publishes as `bodyPose`. That published foot pose is what is compared. The runtime published `groundOffsetUnits = 1.8` separately; it was **not** subtracted by this probe.

| trial | foot pose (published) | foot radial (≤1.25) | foot vertical (≤0.6) | inside | body-CENTRE vertical (old frame, reported only) |
|---|---|---|---|---|---|
| trial-1 | [-34.51574, 50.98992, 9.85207] | 0.53654 | 0.06008 | **True** | 1.73992 (outside 0.6) |
| trial-2 | [-34.44825, 50.98946, 9.87177] | 0.46623 | 0.06054 | **True** | 1.73946 (outside 0.6) |
| trial-3 | [-33.88102, 50.98809, 10.52615] | 0.53944 | 0.06191 | **True** | 1.73809 (outside 0.6) |

`occupiedThroughout` = true and `anyVacant` = false in all three, so the runtime's own live occupancy judgement and this probe's independent geometry now agree in the same frame — which is exactly what the previous lane could not establish.

## 6. CORRECTION (2) — accepted vs the runtime free-recorder count, measured

| trial | recorded at offer/freeze | accepted at completion | equal | recorded at completion | walked waypoint legs (reported, not compared) |
|---|---|---|---|---|---|
| trial-1 | 16 | 16 | **True** | 0 | 8 |
| trial-2 | 15 | 15 | **True** | 0 | 8 |
| trial-3 | 16 | 16 | **True** | 0 | 8 |

- The recorder count **varies run to run** ([16, 15, 16]) while the commanded waypoint-leg count is fixed at 8 (`CG_ROUTE_SHORT` has 9 vertices). Direct evidence that the two are different quantities and that the old comparison could not have held.
- `recordedAtCompletion` is 0 in all three: the runtime CLEARS its working recorder when the span is accepted, so the offer/freeze instant is the only point at which the comparable count exists. Reported as observed runtime behaviour, not as a defect.

## 7. Actual route geometry, length and path class

| trial | issued | actual class | agrees | nominal signed length | actual runtime length at offer/freeze | actual walked units | probe polyline through measured arrivals | short dev | long dev |
|---|---|---|---|---|---|---|---|---|---|
| trial-1 | SHORT | SHORT | True | 16.0000 | 15.2790 | 15.6512 | 13.7329 | 0.5491 | 6.4041 |
| trial-2 | SHORT | SHORT | True | 16.0000 | 14.2981 | 15.6486 | 13.7336 | 0.5240 | 6.3880 |
| trial-3 | SHORT | SHORT | True | 16.0000 | 15.3672 | 15.7320 | 13.8960 | 0.5414 | 6.3874 |

**The nominal 16 units is NOT the measured length.** The signed geometry is 16 nominal units (axis: z=12 constant, x −26 → −42, 9 vertices / 8 legs); the actual runtime-recorded length at offer/freeze was 15.2790, 14.2981, 15.3672 units. No tolerance was relaxed to reconcile them.

## 8. Exact anchors and the live witness/occupancy path

- **trial-1** — hold at first test `reference-occluded-survey-housing`, accepted class `held-reference`, final phase `tested`, testedPrefix `0`, tailRevision `0`
  - anchors: `anc.cg.repeated-measure`, `anc.cg.demonstration-opened`, `anc.cg.survey-started`, `anc.cg.trace-drawn`, `anc.cg.route-offered`, `anc.cg.specific-hold`, `anc.cg.witness-held`, `anc.cg.revision-ready`, `anc.cg.route-tested`, `anc.cg.reciprocal-reference`
- **trial-2** — hold at first test `reference-occluded-survey-housing`, accepted class `held-reference`, final phase `tested`, testedPrefix `0`, tailRevision `0`
  - anchors: `anc.cg.repeated-measure`, `anc.cg.demonstration-opened`, `anc.cg.survey-started`, `anc.cg.trace-drawn`, `anc.cg.route-offered`, `anc.cg.specific-hold`, `anc.cg.witness-held`, `anc.cg.revision-ready`, `anc.cg.route-tested`
- **trial-3** — hold at first test `reference-occluded-survey-housing`, accepted class `held-reference`, final phase `tested`, testedPrefix `0`, tailRevision `0`
  - anchors: `anc.cg.repeated-measure`, `anc.cg.demonstration-opened`, `anc.cg.survey-started`, `anc.cg.trace-drawn`, `anc.cg.route-offered`, `anc.cg.specific-hold`, `anc.cg.witness-held`, `anc.cg.revision-ready`, `anc.cg.route-tested`, `anc.cg.reciprocal-reference`

Four ordinary authored [F] presses per trial on shipped prompts, all `pressed: true`, identical objective sequence in all three: `ch13:survey:offer` → `ch13:survey:start` → `ch13:survey:offer-span` → `ch13:survey:witness`. No movie rail, no autopilot, no forced click, no state write, no source hook call.

### Observed differences worth naming (measurements, not judgements)

- `anc.cg.reciprocal-reference` fired in trial-1 and trial-3 but **not** trial-2. The anchor set is not constant across cold runs.
- `anc.cg.revision-ready` fired in all three corrected trials; it did **not** appear in the retained short-2 anchor set.
- `testedPrefix` stayed **0** at completion in all three while the whole recorded span was accepted at once — identical to the retained short-2 observation; the supported prefix never advanced during the hold.
- The witness pose used was `CG_POSES.W` quoted from frozen source in all three, because the live rail target was not an array at the read instant. Same as retained short-2. An instrumentation limitation on the marker read, not a measured gameplay failure.

## 9. Prior lane status — retained, not rewritten

- **short-1**: RETAINED. STOPPED-PREREQUISITE, exit 2, published-diagnostic wait fix; not rewritten.
- **short-2**: RETAINED AS RECORDED. Measured game acceptance with an INCOMPLETE independent occupancy measurement and a SHORT-NOT-PROVEN probe verdict. It is NOT rewritten as a PASS by this report.

## 10. Session receipts

| trial | node exit | started (UTC) | finished (UTC) | summary.json sha256 | log sha256 | session stopped | cleanup error |
|---|---|---|---|---|---|---|---|
| trial-1 | 0 | 2026-09-06T19:43:15.992Z | 2026-09-06T19:44:08.918Z | `188d32805d895d2f…` | `027a0123ee7b31ae…` | True | None |
| trial-2 | 0 | 2026-09-06T19:44:09.276Z | 2026-09-06T19:45:00.579Z | `8417ef0c617ae7b0…` | `aae6b283405745c5…` | True | None |
| trial-3 | 0 | 2026-09-06T19:45:00.930Z | 2026-09-06T19:45:53.891Z | `3708c363154f2f9c…` | `d74035082004e195…` | True | None |

All three post-`finally` receipts: `state: stopped`, `cleanupCompleted: true`, `stopsRootPreview: false`, `killsProcesses: false`, closing receipt `ok: true`. Root preview daemon PID 1802787 still serving HTTP 200 after the run. No browser from this lane survives; the surviving managed-webgpu chromium PIDs all pre-date this role (earliest 2026-09-05 22:49, latest 2026-09-06 12:05) and were not touched.

## 11. Integrity

- source files independently rehashed **before 99 / after 99**, drift: **none**
- served index `6c8c378b282e3ede…`, bundle `efc87feb0068671e…`, manifest `6ef957c3dd4a1af0…`, contract `5ef85a324f579ba1…` (scene-v3) — re-checked before **each** capture
- heavy lock `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock` fd **9**, EXCLUSIVE flock acquired by the invoking shell and INHERITED by node on fd 9, contention probed = True (no holder observed), held across all three trials, released after
- browsers concurrent: **1**

## 12. Claims explicitly NOT made

earned arrival, first-time usability / naive UX, COMMON, whole chapter, LONG anything, score/audibility, taste, continuity/variant/reset matrix, FPS, defect closure, publication.

**Blockade:** none — root resolved both measurement choices; no external approval blocker remains for this lane.

## Artifacts

- captures: `/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier/captures/arrival-common-short-corrected/trial-{1,2,3}/`
- logs: `/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier/logs/arrival-common-short-corrected/trial-{1,2,3}.log`
- probe: `/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier/probes/arrival-common-short/short-survey-probe.mjs`
- pure logic: `/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier/probes/arrival-common-short/shortSurveyLogic.mjs`
- machine report: `/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/arrival-common-short-corrected-report.json`
