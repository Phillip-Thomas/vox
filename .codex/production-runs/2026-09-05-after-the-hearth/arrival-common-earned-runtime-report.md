# arrival-common-earned — earned Continue runtime report

**VERDICT: PARTIAL.** The earned Origin landing and the ordinary Continue lane were
measured and passed every gate. The final new-action step is a **measured
prerequisite failure**: after Continue the body could not reach E. Stopped there,
state retained, no rescue, no game patch.

Machine-readable: `arrival-common-earned-runtime-report.json`.
Capture: `verifier/captures/arrival-common-earned/earned-1/` (kept intact).
Progress/preflight narrative: `arrival-common-earned-runtime-progress.md`.

## Prepared versus actually run

| | |
|---|---|
| Prepared | the earned lane probe + pinned helpers (never executed before today) |
| Actually run | **ONE** primary earned partial-Continue lane -> `verifier/captures/arrival-common-earned/earned-1` |
| Not run | no retry lane, no manual COMMON, no full story, no variants, no cold-run set, **no full-verify rerun** |

Command receipt `logs/arrival-common-earned-runtime/earned-1-command.txt`:
start `2026-09-06T18:24:44Z`, lock acquired `18:24:44Z`, end `18:27:52Z`,
Node v25.6.1, **node exit 1**. That exit code is the probe's own honest refusal at
the new-action prerequisite; it is recorded **separately from role completion**,
which is complete (evidence written, browser stopped, source rehashed, report filed).

```
exec 9>/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock
flock -w60 -x 9
node verifier/probes/arrival-common-earned/earned-continue-probe.mjs \
  --url http://127.0.0.1:34413/ \
  --expect-source-manifest 6ef957c3dd4a1af04852773b3e5f608d2247e212eb27d05a95ba6f40c1fee5d6 \
  --heavy-lock /home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock \
  --heavy-lock-fd 9 \
  --role arrival-common-earned \
  --out <ABS>/verifier/captures/arrival-common-earned/earned-1
```

## Guards

| Guard | Measured |
|---|---|
| `activeRole` in `verifier-control.json` | `arrival-common-earned` — matches |
| Source manifest | `6ef957c3…1fee5d6`, **99/99 rehashed before AND after**, 0 mismatches, `stableAcrossCapture: true` |
| Auxiliary tooling hashes | 4/5 match; the 1 mismatch is **exactly** the permitted unused delta-profile drift (below) |
| Served identity, live | `http://127.0.0.1:34413/` 200, `<title>Paravoxia</title>`, index `6c8c378b…9bb207`, bundle `/assets/index-BiDWGouH.js` `efc87feb…77a068` — equal to `preview-ownership.json` and `verifier-control.json`. Verified live before the browser, not copied from an example. |
| Heavy lock | `flock -w60 -x 9` on inherited fd 9; `owned: true`, no problems, `/proc/locks` FLOCK/ADVISORY/WRITE pid 1871186 inode 8397196, `openedByProbe: false` |
| GPU | headed, `ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe, OpenGL 4.5.0)` — real hardware, no SwiftShader |
| Preview | root-owned; `rootPreviewUntouched: true`, never started/stopped/rebuilt by me |

**Auxiliary mismatch, reported separately as instructed:**
`docs/architecture/workflow-orchestration/run-profiles/paravoxia-creative-delta.run-profile.json`
recorded `a0b0ecdd…1444c2`, observed `605fb2ef…5f57ae828` — identical to the drift
`producer-nonbinding-auxiliary-observation.json` recorded and permitted. Unused
profile; the active profile is `paravoxia-creative-chapter@v1`. The probe's own
`rehashSourceManifest` reads only the 99-path `hashes` map, so it is outside the
capture gate. No full verify rerun.

## Instrumentation (not game repair)

1. **Pinned contract corrected before any browser.** `cgContract.pinned.mjs` still
   pinned scene-**v2** `4dbf722b…ff88e`. Bounded exact update to scene-v3
   `5ef85a32…7eec54` in my own private dependency:
   before `5f447ebd…2f45c551` -> after `5f3dbc2e…029ae083a5`
   (before copy `logs/arrival-common-earned-runtime/cgContract.pinned.mjs.before`).
   Only the constant plus the two matching `scene-v2` words changed. Shared original
   `verifier/probes/lib/cgContract.mjs` re-hashed after the edit: still
   `5f447ebd…2f45c551`, untouched. Owned `pinned/pin.json` records the divergence
   (`45be04a4…` -> `99869a4d…`). **Runtime effect on this lane: none** — the probe
   imports only the path constants and never calls `loadContract()`. Owned CPU
   suites rerun after the edit: `selftest.mjs` **108/108**, `--self-test` **OK**.
2. **Both named entry-harness defects were looked for and are ABSENT here — no
   change made.** This lane's only click is
   `page.click('button[aria-describedby="landing-story-subtitle"]')` (a semantic
   selector resolved at click time — no rectangle read, no coordinate click, no
   `page.mouse.*`, no `requestPointerLock`). `walkTowards` has **no** stall
   detector at all, so there is no full-residual `commandedUnits` comparison to
   correct. Nothing was patched by keyword.
3. Game patches: **0**. Shared probe/contract/gate/defect/build edits: **0**.
   Material game repairs consumed: **0**.

## Gate confirmation (read from `earnedContinueLogic.mjs`)

`earnedOriginGate` refuses unless **all** hold: real latched
`story:ch13-origin-landed`; `landedActivePlanetId === '-1,-1'` **exactly** (a merely
different planet is refused by name); `surface` + `fps`; `supported === true`;
finite grounded pose; measured live fps ≥ threshold; `anc.cg.origin-landed` in the
**named** `signedSceneAv.activationHistoryAnchorIds` (a non-empty **lift-only**
history is refused with raw history preserved); **and** `anc.cg.origin-landed` in
the **chapter** fired-anchor array, with a `null` chapter read refused as
UNMEASURED. `Object.keys(av).length` is kept only as `avRawKeyCountIsNotEvidence`.
The 8 discriminating CPU cases are green in the 108/108 rerun.

## What actually happened

### Phase 0 — earned Origin landing: **PASS**

Started from `?story=ch13-return&journeyprobe=1&debug=1&movie=1`. Boot read confirms
the fixture did **not** seed the landing: milestone absent, AV history empty,
`activePlanetId` = `-1,-1:p1` (the departure body).

| t | beat / objective | world | anchors |
|---|---|---|---|
| 4 ms | ch13-return / — | `-1,-1:p1` fps | none, milestone false |
| 2012 ms | ch13-return / `ch13:return:board` ("Kestrel hatch · board") | `-1,-1:p1` flight | `anc.cg.hatch-boarded` |
| 2772 ms | ch13-return / `ch13:return:launch` ("Kestrel controls · lift") | `-1,-1:p1` flight | AV: hatch-boarded |
| 3604 ms | ch13-return / `ch13:return:origin` ("Origin · audit site") | atmosphere, descent, speed 2.37 | AV: + `lift-committed` |
| **73763 ms** | **ch13-survey / `ch13:survey:start`** | **`-1,-1` surface fps** | chapter: hatch-boarded, lift-committed, **origin-landed**, demonstration-opened, repeated-measure |

Gate: `ok: true`, problems `[]`, landed planet `-1,-1` (exact signed Origin),
`supported: true`, pose `[-33.897, 50.990, 8.339]`, **fps 60.3**,
`avHasOriginLanded: true`, `chapterHasOriginLanded: true`, AV history 4, sequence 4.
`milestonesCh13 = [story:ch13-fault-reviewed, story:ch13-origin-landed]`.
The flight was scripted input on the shipped rail — **not** reported as a
zero-rescue movie success, and nothing preseeded the landing.

### Phase 1 — real partial drawing: **PASS**

Caught at `checkpointPurity {reached: true, pure: true, catchNow: true}`, before any
offer or route test (`routeTestedMilestonePresent: false`, `witnessOffered: false`).
Objective `ch13:survey:draw`, marker "Survey end · demonstrate a route", HUD
"Walk your route to the survey end. [F] Offer the recorded span." fps 57.7.

On the ≥4-sample requirement: the checkpoint read shows 6 working samples and the
serialized save carries **18 working samples** with real per-sample coordinates and
`walkedAt` times (first: `x -26.551, y 50.990, z 12.343, corner, walkedAt 0`).
`survey.acceptedSamples` is **0** and `acceptedClass` null **by design** — that field
only becomes non-zero after the span is offered and route-tested, which this partial
capture must precede. **No credit is claimed from `acceptedSamples`.**

### Phase 2 — actual `beforeunload` WorldSave: **PASS**

Same-tab navigation to `?journeyprobe=1&debug=1` fired the shipped
`beforeunload -> doSave(true) -> saveWorld/savePlayerPose/saveGlobal`.
Proof the save really executed: the `pvx.v1.world.-1,-1` blob grew
**582 -> 2753 bytes** and gained a commonGround section at the navigation.

| raw storage | bytes | sha256 |
|---|---|---|
| `pvx.v1.world.-1,-1` presave | 582 | `35193d0e…202542` |
| `pvx.v1.world.-1,-1` postsave | 2753 | `4d1bdd7a…f304f62` (commonGround `05b6efb3…c9df8ef`, seed 3215739679) |
| `pvx.v1.world.-1,-1:p1` | 568 (unchanged) | `26786346…db3a3c9` |
| `pvx.v1.global` | 3500 | `ac87e22d…9a01258b`, 91 milestones, `lastPlanetWorldId: -1,-1` |

`originLandedMilestoneInSave: true`, `routeTestedMilestoneInSave: false`.
Saved commonGround: `actorId local`, `worldId -1,-1`, `survey.phase drawing`,
`accepted null`, `working.samples 18`, `walkedUnits 18.019`, `routeClass null`,
`testedPrefixCount 0`, `offeredEndIndex null`, `common.stage none`,
`committed false`. No storage key was dropped. No payload was hand-constructed.

### Phase 3 — ordinary Continue: **PASS**

Real landing menu (`▶ Continue`, subtitle "STORY COMPLETE · RETURN TO YOUR WORLD"),
**no story deep link, no `movie=1`, no reseed, no forced quit**, ordinary click on
`LandingMenu.startOrContinueStory -> beginStory() -> storyEntryPoint()`.

| Check | Result |
|---|---|
| Restored beat / objective | `ch13-survey` / `ch13:survey:draw`, marker "Survey end · demonstrate a route" |
| World actor | `pvx.v1.world.-1,-1`, `actorId local` — `worldIdentityVerdict.ok = true`, no lost milestones (91) |
| Original working prefix | **retained**: 18 saved samples -> 19 on disk, phase still `drawing`, `testedPrefix 0` |
| Overwrite | `overwriteVerdict.ok = true` — **no earned sample lost** |
| Replay | `noReplay = true` — no replayed anchor, cue or pending anchor **by name**; `installWatchChanged false` |
| fps after Continue | 59.3 |

Raw observations recorded verbatim, **not** claimed as failures: the summary's
`samplesSurvived/walkedUnitsSurvived` false flags compare the 6-sample *checkpoint
read* against 19 after Continue (the count went **up**); the `-1,-1:p1` blob shrank
568 -> 126 bytes across the boot (uninvestigated); AV `activationSequence` resets
4 -> 0 with an empty history, which the prepared helper already qualifies.

### Phase 4 — new action after Continue: **PREREQUISITE FAILURE (measured)**

`EC-NEW-ACTION-NOT-OFFERED` — "the body never actually arrived at the span end by
ordinary movement". 144 bursts, 90 387 ms, `stopReason budget-exhausted`,
final body `[52.790, 17.493, 12.583]`, target E `[-42, 51.05, 12]`,
**final distance 94.79 units**, `promptsAtEnd []`, no `[F]` offer.

Four measurements, no inference beyond them:

- **P4-A** Continue resumed the body at the stored **ship parked pose**:
  `globalSave.shipRestoration.parkedPose.position = [53.5, 20, -20]`, body appeared
  at `[52.789, 17.5, -20]`. The survey samples sit near `x≈-26, y≈51, z≈12–16`. The
  shipped marker itself reads **"survey end · demonstrate a route · 104m"** in frame
  `0003-after-continue.png`. Whether resuming at the parked ship is intended is a
  design question, not decided here.
- **P4-B** `supported === false` for **all 148** post-Continue journey entries
  (90.4 s of continuous ordinary movement). At the earned landing it was `true`.
  This is an objective anomaly; its cause is **unknown** and no game source was read
  or patched for it.
- **P4-C** Local up after Continue is `[1.0, ~0, ~0]` (+X); at the survey site it was
  `[~0, 1.0, ~0]` (+Y). `bodyCentre[0]` stayed pinned at 52.789 for all 144 bursts,
  `bodyPose[0]` at 50.989 (= 52.789 − 1.8 `groundOffsetUnits` along +X). The resume
  landed on a differently-oriented face of the voxel planet from the survey.
- **P4-D** **Demonstrated harness limitation.** `walkTowards` measures displacement
  and distance in the world **XZ** plane only. On a +X-up face the tangent plane is
  **Y-Z**. `KeyA` really moved the body **2.231 units in Y** (17.500 -> 15.269) and
  `KeyD` moved it back, but both were scored `moved 0.0004 / 0.0008` and recorded as
  `dir: null`, leaving `chooseKey` only KeyW/KeyS (±Z). Z converged within 16 bursts;
  the remaining ~95 units of X were unreachable by construction.

**Action taken: stopped at the first impossible prerequisite.** Exact state retained,
capture directory kept (nothing removed). Not done: no repeat, no longer budget, no
timeout/endpoint rescue, no after-Continue walk-W rescue, no pose injection, no
direct store/API/anchor write, no missing-plane credit, no invented pending state,
**no game patch**. I deliberately did **not** make `walkTowards` up-aware: that is new
movement/geometry capability rather than a correction of a demonstrated harness
error, and it would not resolve P4-B (never grounded).

## Objective visual defects

**None found.** Frames read: `0001-earned-partial-drawing.png` (renders, correct HUD
objective/marker copy, daylight), `0003-after-continue.png` (renders; planet `-1,-1`
seed 3215739679 matching the saved blob; marker "· 104m"; night sky — a different
planet face, described not flagged), `0004-at-survey-end.png` (renders; no blank or
black frame; marker text partly occluded by the `debug=1` World-Coordinates panel,
which is a probe fixture overlay, not a shipped HUD defect). The filename
`0004-at-survey-end` is the probe's prepared label — the body was **not** at the
survey end.

## Cleanup

`cleanup-receipt.json`, phase **post-finally**: `state stopped`,
`cleanupCompleted true`, `cleanupError null`, `reason finally`, 1 stop invocation,
`stopsOnlyProbeOwnedSession true`, `rootPreviewUntouched true`, no processes killed.
Verified after the run: no `earned-continue-probe` process remains; **no abandoned
browser**; **no foreign process stopped**; the root preview at 34413 is untouched.

## Unknowns

- Whether a real player (who can turn the view) could walk from the post-Continue
  ship pose to the survey end — **unmeasured**; this probe never turns and its mover
  is XZ-planar.
- The cause of `supported === false` for 90 s after Continue — **unknown**.
- Whether resuming ~104 m from the live objective marker is intended — a chapter
  design question, not decided here.
- The `-1,-1:p1` blob 568 -> 126 byte change — uninvestigated.
- Three `[shader-warmup]` timeout warnings — recorded, not diagnosed.
- The 18 -> 19 sample increase across the save/Continue boundary — recorded, not
  explained.

## Not claimed

No chapter acceptance, no publication, no manual COMMON, no full-story, variant,
listening or taste judgement, and no zero-rescue movie success. Nothing here rests on
the historical run-4/run-5 overwrite narrative — the root qualification governs, and
the overwrite question is answered **only** by this run's own bytes
(18 saved samples -> 19 on disk, none lost).
