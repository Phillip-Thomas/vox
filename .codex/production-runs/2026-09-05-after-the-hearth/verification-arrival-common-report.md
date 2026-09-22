# Verification report — arrival + COMMON (material repair 7)

Role **arrival-common-verifier** (fresh independent story-verifier, opus).
Run `2026-09-05-after-the-hearth` · contract **scene-v3**
`5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54`
Source manifest `6ef957c3dd4a1af04852773b3e5f608d2247e212eb27d05a95ba6f40c1fee5d6`.

Written at actual UTC **2026-09-06T18:05Z** (clock read `18:04:09.500288536Z`
immediately before writing). No guessed or future timestamps.

**Not an acceptance. Not a chapter verification. No defect closure. No
publication.** Three targeted lanes only. Machine-readable form:
`verification-arrival-common-report.json`.

---

## VERDICT

| lane | result |
| --- | --- |
| 1. Independent full verify on the frozen source | **PASS** — exit 0, 351 files / 3172 tests |
| 2. Bounded actual return flight (ch13-return → Origin → survey) | **PASS** — landing, `anc.cg.origin-landed`, `story:ch13-origin-landed`, survey hand-off in 74.8 s of a 120 s bound; the prior departure-reset signature did **not** reproduce |
| 3. Movie survey/COMMON journey, LONG route, three cold runs | **PASS** — all three reached beat `done`; Terra 18, W 18, committed, all named terminal anchors, stall predicate never fired |

The producer's remaining gates are **not** claimed. See §8.

---

## 1. Source integrity and the independent verify

Rehashed before, after and at the end of the role
(`logs/arrival-common-verifier/rehash-{before,after,final}.json`).

| check | before | after | final |
| --- | --- | --- | --- |
| manifest.hashes (99 game-source files) | 99/99 | 99/99 | 99/99 |
| manifest.externalSourceChanges (`creative-triad-gate.mjs` `23b347b7…`) | match | match | match |
| manifest.auxiliaryToolingHashes (5) | 5/5 | 4/5 | 4/5 |

`implementation-source-manifest.json` hashes to `6ef957c3…`, equal to
`verifier-control.json.sourceManifestSha256` and
`verification-ready.json.sourceManifestSha256`. `scene-contract.json` hashes to
`5ef85a32…`, equal to the repair direction, the producer source review and the
live preview ownership record. **No game source was written by this role.**

**One further auxiliary drift, preserved and not repaired:**
`docs/…/run-profiles/paravoxia-creative-delta.run-profile.json`,
`a0b0ecdd…` → `605fb2ef…`. First observed by me in the post-verify rehash;
root's `producer-nonbinding-auxiliary-observation.json` reviewed the exact delta
and disposed of it as an observed-only, unused profile. I did not fix, revert or
attribute it, and it is still present at the final rehash.

### The command, run once

| field | value |
| --- | --- |
| command | `npm --prefix main run verify` |
| cwd | `/home/thomasphillip/Projects/vox` |
| started / ended (actual UTC) | `17:45:06.245184591Z` → `17:46:07.106885453Z` |
| exit code | **0** |
| log | `logs/arrival-common-verifier/verify.log` sha256 `e57a9dab67a87a31e54bfff8a3a3d6f334ca62b76098769acbddf4c15e68d6ba` |
| vitest | **351 files / 3172 tests passed** |

### BUILD READY and the two build identities

Built file map (11 files) in `logs/arrival-common-verifier/dist-filemap.txt`.

* **Shipped JSON file-map buildHash** — `previewSnapshot.snapshotPreviewBuild`,
  `sha256(JSON.stringify(files))`, the value ownership calls `buildHash`:
  **`aa52b0341b78d0931a5c91d431d9ba0ce81b5edde12b9b5b54449a5ee1c20d74`**
* **Auxiliary verifier algorithm** — sorted path + NUL + hash + newline records,
  the value ownership calls `verifierBuildHash`:
  **`318e2a54ea84286896d1afbeab2f0980f0074bb286170dee61a17a95abe40427`**

These are different algorithms over the same bytes and are never conflated.

## 2. Preview identity gate — no browser while mismatched

At BUILD READY the ownership record still read manifest `dc63fbae…`,
`state: stopped`, `http://127.0.0.1:38007/`. **Port 38007 is the PRIOR immutable
build; it was never measured by this role.** Root then published the new preview
and I re-read `verifier-control.json`, `verifier-inbox.md` and
`verifier-inbox.jsonl` before launching anything.

| check | value | result |
| --- | --- | --- |
| ownership `sourceManifestSha256` | `6ef957c3…` | equals control |
| `control.currentPreviewUrl` | `http://127.0.0.1:34413/` | equals ownership `url` |
| `GET /` | 200, sha256 `6c8c378b…`, `<title>Paravoxia</title>` | equals **my** built `index.html` |
| `GET /assets/index-BiDWGouH.js` | 200, sha256 `efc87feb…` | equals **my** built bundle |
| ownership `buildHash` | `aa52b034…` | equals my independent shipped-algorithm computation |
| ownership `files` map (11) | — | byte-equal to my `main/dist` map |
| ownership `contractSha256` | `5ef85a32…` | scene-v3 |

Every browser: **headed, hardware ANGLE / NVIDIA GB10 (OpenGL 4.5.0)**, asserted
by `assertHardwareGl` inside `openParavoxia`; software renderers refused. Every
job took the **exclusive** `flock -n -x` on
`/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock`. One browser
at a time. No other process or server was stopped.

## 3. Lane 2 — the actual return flight

`verifier/captures/arrival-common/flight-1/` ·
`logs/arrival-common-verifier/flight-1/telemetry.jsonl` ·
`17:49:14.083704865Z` → `17:50:31.522277478Z` · 272 samples at 250 ms ·
74 800 ms of a **120 000 ms** bound · **probe exit 0** · 22 frames.

Probe: a **copy** of `flight-discriminator-probe.mjs` in my own folder
(`arrival-flight-probe.mjs`, `0960d6da…`). The shared probe was not edited. Owned
changes: preview identity gate, nonempty-capture-dir refusal, richer sampling,
stop at the survey transition, and **the commissioned post-capture logger-order
fix** — the original called `say()` *after* `lg.end()`, so the cleanup receipt
was written to an already-ended stream and never reached `probe.log`; the receipt
is now logged first and the stream ends are awaited.

### Celestial telemetry — no departure reset

| t (ms) | activePlanetId | epoch | locationMode | flight phase | control | dist. to Origin centre |
| --- | --- | --- | --- | --- | --- | --- |
| 104 | `-1,-1:p1` | 2 | surface | surface | fps | — |
| 1 971 | `-1,-1:p1` | 2 | surface | surface | **flight** | 2 736.82 |
| 3 614 | `-1,-1:p1` | 2 | atmosphere | descent | flight | 2 736.01 |
| 7 557 | `-1,-1:p1` | 2 | local_space | deep_space | flight | 2 502.47 |
| 8 040 | `-1,-1:p1` | **3** | local_space | deep_space | flight | 2 455.49 — target set to system_body slot 0, worldId `-1,-1` |
| 40 470 | **`-1,-1` (Origin)** | **4** | atmosphere | descent | flight | **174.15** |
| 44 648 | `-1,-1` | 4 | **surface** | surface | **fps** | 58.09 |

Epoch sequence **2 → 3 → 4**, strictly monotone. The prior failure signature —
epoch `3→5` and `6→8` with the departure pad reclaimed twice after reaching the
185-unit envelope — **did not reproduce**. Once committed at 40.47 s inside the
envelope, `activePlanetId` stayed `-1,-1` for the rest of the capture.

Ship celestial pose at landing `[53.5, 16.0, -16.0]` (`systemFlight.pose.position`).
The seated capsule readout is reported separately and never used as celestial pose.

### The signed return objective, by actual state

`ch13:return:origin` · marker label **`Origin · audit site`** for every sample ·
health `ready` throughout · **no mandatory board regression**.

| phase | standing work order | signed match | samples | window |
| --- | --- | --- | --- | --- |
| off-Origin preparation / flight / descent | `["Fly to Origin.", "Follow the audit-site approach and land."]` | EXACT (`guidance.objectives[4].workOrder`) | 154 | 3 614 → 44 287 ms |
| **grounded Origin, still boarded** | `["Disembark.", "Follow the audit-site marker on foot."]` | EXACT (`variantIntent` literal) | **1** | 44 648 ms |
| grounded Origin, embodied FPS before W reach | `["Follow the audit-site marker on foot."]` | EXACT (`variantIntent` literal) | 107 | 45 466 → 73 220 ms |

Same ID and same marker label across all three. Objective revision stepped
2→3, 3→5, 5→7, 7→9; no new objective was published between the phases.

* Grounded-Origin transition timing: `descent → surface` and `flight → fps` at
  **44 648 / 45 020 ms**; the boarded-surface copy held for **one 250 ms sample**
  (bounded above by 818 ms).
* **The autopilot segment gave the boarded-surface phase only one sample and the
  transition screenshot (`0164-workOrder.png`, taken ~200 ms later) already shows
  the next phase.** Frame coverage of the `Disembark.` copy is therefore
  **UNMEASURED**. It is not fabricated.
* Same-ID acknowledgement **count** is **UNMEASURED** — this probe samples
  objective state, not the feedback emission stream.

### Actual W-7744 reach, landing and hand-off

FPS control from 45 020 ms; ship celestial pose held at `[53.5, 16, -16]` for the
whole on-foot window while the body readout moved `[52.79, 30.19, -13.99]` →
`[-31.68, 52.79, 2.01]` (≈ 86 horizontal units) and the HUD marker distance fell
monotonically 214 → 91 → 72 → 55 → 39 → 22 → 7 m. The body readout is
`__autopilot.pos`, labelled as the movie rail's readout and **not** treated as
canonical body proof.

| commitment | at | value |
| --- | --- | --- |
| named AV `activationHistoryAnchorIds` | 73 873 ms | `["anc.cg.hatch-boarded", "anc.cg.lift-committed", "anc.cg.origin-landed", "anc.cg.repeated-measure"]` |
| milestone | 74 068 / 74 432 ms | `story:ch13-origin-landed` latched |
| objective clear | 73 473 ms | `ch13:return:origin` → `ch13:survey:start` (`Survey start · begin a route`) |
| beat | 74 249 ms | `ch13-return` → **`ch13-survey`** |

`anc.cg.origin-landed` is read from the **named** anchor-id history, not from a
generic AV key. The current-anchor field never displayed it because
`activationSequence` stepped 2 → 4 within one 250 ms sample.

Rescue counters across 267 samples: nudges **0**, teleportNudgesTotal **0**,
backstops **0**, stuck **0**.

## 4. Lane 3 — movie survey / COMMON, LONG route

Probe: a **copy** of `handoff-standby-verifier/journey-probe.mjs`
(`bab7c633…`). One owned change: the contract import points at a run-local
reader `cgContract-v3.mjs` (`2d698f7e…`), a copy of the shared
`verifier/probes/lib/cgContract.mjs` whose **only** difference is the pinned
signature — scene-v3 `5ef85a32…` instead of the historical scene-v2 `4dbf722b…`.
The shared library is untouched.

**Retained preflight failure.** The first journey attempt exited **1** *before any
browser*, on the shared library's scene-v2 pin
(`scene-contract.json is 5ef85a32…, not the signed scene-v2 4dbf722b…`). No
gameplay was measured and no cold run was consumed. Root retained it at
`logs/arrival-common-verifier/preflight-pin-failure-retained/{failure.log,transport-tool-result.json}`;
it is preserved, not overwritten.

Offline gate before every session: `--self-test` exit 0 (cg-journey 1/1,
cg-harness-selftest 25/25, cg-harness-prep-selftest 41/41).

**Route: LONG.** The shipped movie harness draws LONG. No SHORT run is claimed
from it; SHORT remains a dedicated ordinary-input lane and is **unmeasured** —
not impossible.

### Three cold runs, same frozen source

| run | window (actual UTC) | args | probe exit | stop reason | beat `done` at | frames |
| --- | --- | --- | --- | --- | --- | --- |
| `journey-common-1` | 17:52:29.679 → 17:58:01.895 | `--seconds 330 --until-anchor anc.cg.handback` | **0** | `seconds-budget-exhausted` | **62.095 s** | 184 |
| `journey-common-2` | 17:59:58.051 → 18:01:04.054 | `--seconds 200 --until-beat done` | **0** | `reached-beat:done` | **62.610 s** | 76 |
| `journey-common-3` | 18:01:09.280 → 18:02:15.484 | `--seconds 200 --until-beat done` | **0** | `reached-beat:done` | **62.506 s** | 79 |

All three: `--lane movie --beat ch13-survey --stall-fail-ms 20000 --strip-s 5
--percept`. Entry is the `?story=ch13-survey` deep link, a **prerequisite
fixture** for these lanes — it is **not** converted into continuous earned
history, and the earned return proved in lane 2 is not stitched onto it.

Run 1 carries the harness label `BUDGET-EXHAUSTED-INCONCLUSIVE`. That label
describes the **stop predicate**, not the gameplay: `--until-anchor` compares only
the currently *active* anchor, and `anc.cg.complete` and `anc.cg.handback`
committed inside one 100 ms sample with the active anchor already back to null.
The same trace shows a completed run at 62.095 s, followed by **268 s of
post-completion observation** of the handback state.

### Physical result, per run

| measurement | run 1 | run 2 | run 3 |
| --- | --- | --- | --- |
| `terraUnits` | **18** | **18** | **18** |
| `workerUnits` | **18** | **18** | **18** |
| `committed` | true | true | true |
| `comparisonProved` | true | true | true |
| `finalReferenceOffered` | true | true | true |
| COMMON `stage` | `arrived` | `arrived` | `arrived` |
| survey `phase` / `acceptedClass` | `tested` / `fixed-reference` | `tested` / `fixed-reference` | `tested` / `fixed-reference` |
| engine-accepted samples | 38 | 40 | 38 |
| stall predicate fired | **never** | **never** | **never** |
| page errors | 0 | 0 | 0 |

Named anchors committed in every run: `anc.cg.repeated-measure`,
`anc.cg.demonstration-opened`, `anc.cg.survey-started`, `anc.cg.trace-drawn`,
`anc.cg.route-offered`, **`anc.cg.route-tested`**, `anc.cg.reciprocal-reference`,
`anc.cg.reciprocal-crossed`, `anc.cg.final-reference-offered`,
`anc.cg.independent-test`, **`anc.cg.complete`**, **`anc.cg.handback`**. Run 3
additionally committed the *contingent* `anc.cg.revision-ready` — legal variation.

### The prior COMMON stall

The prior movie stalled around 5.8/18 at corner 3 on requested target
`[-44.6, 51.05, 16]`. The repaired steering now issues
**`[-44.24, 51.05, 16]`** at that cursor, and **every original corner was
passed** in all three runs. The CPU-predicted unsafe overshoot at corner 6 and
terminal 9 did **not** occur. Caveat: this is a live observation on the real
world; exact world terrain edits may differ from the generated CPU fixtures the
prediction was made on.

Ordered COMMON progress, `railCursor` during the comparison:

| run | observed cursor sequence |
| --- | --- |
| 1 | 18, 0, 1, 2, 3, 4, **–**, 6, 7, 8, 9 |
| 2 | 18, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 |
| 3 | 18, 0, **–**, 2, **–**, 4, 5, 6, 7, 8, 9 |

Strictly increasing in all three; the dashes are **100 ms sampling gaps in the
observation**, not skipped corners — the cursor never decreased and `terraUnits`
advanced monotonically to exactly **18**. Those individual cursor indices are
*unobserved*, not individually proven.

Issued COMMON target polyline (run 2): `[-40,51.05,8] → [-42,51.05,12] →
[-42,51.05,14] → [-42,51.05,16.24] → [-44.24,51.05,16] → [-44,51.05,18.24] →
[-46,51.05,18] → [-48.24,51.05,18] → [-48,51.05,16] → [-48,51.05,14] →
[-48,51.05,11.76] → [-44,51.05,12]`.

### W's hold and Terra's ordered 18-unit E-to-C passage

W-7744 reached and **held H = `(-40, 51.05, 12)`** — exactly the H the contract
declares for `anc.cg.reciprocal-reference` — from 43.19 s and maintained it
through Terra's whole passage until `anc.cg.reciprocal-crossed` at 48.03 s, where
`terraUnits` reached exactly **18** and `comparisonProved` turned true.

### Terra's actual F and occupancy at the far reference

`rail.action` became **`interact`** at 52.72 s (run 1); `anc.cg.final-reference-offered`
committed at 53.62 / 53.98 / 54.09 s, and `finalReferenceOccupied` was **true**
for **47 / 50 / 50** consecutive samples covering W's entire test — an authored F
**plus** live occupancy, not waiting alone. Occupancy returns false only after W
arrives and the handback fires.

### The repaired standby — actual occupied body, not a desired target

| field | value |
| --- | --- |
| requested navigation goal before the hold | `[-44, 51.05, 12]` |
| navigation action during W's test | `hold`, target `null`, reason *"holding the far reference while he tests"* |
| **actual occupied grounded body pose** | run 1 `[-44.089, 50.989, 12.013]` · run 2 `[-44.083, 50.989, 12.014]` · run 3 `[-44.092, 50.989, 12.014]` |
| pose frame | `bodyPose = capsule centre − up·(HALF_HEIGHT 1.3 + RADIUS 0.5)` — the frame the routes/sockets are authored in |
| supported ground body | `supported: true`, `up ≈ (-0.0221, 0.9998, 0.0)`, `groundOffsetUnits 1.8` |
| **minimum clearance from the ENTIRE offered polyline** | **2.089 / 2.083 / 2.092 units** |

Method: minimum 2-D distance from the **actual occupied** grounded body pose to
**every segment** of the whole polyline of targets issued while the span was
drawn/offered (18–19 vertices per run). Not a chosen point, not a desired target,
and not a point that merely clears COMMON.

**Limitation, stated plainly:** the engine-accepted route is exposed only as
`acceptedSamples` (38/40/38) and `acceptedClass` (`fixed-reference`); the accepted
sample **coordinates** are not published on any probe surface. The clearance above
is therefore against the **issued/drawn** target polyline. Clearance against the
accepted-sample coordinates is **UNMEASURED**.

### Rescues

The stall predicate never fired in any run. Largest single-sample displacement
after boot is **6.705 units at 6 502 ms across a 1 380 ms probe-side sampling gap**
(screenshot/percept capture) — 4.86 units/s, ordinary walking, not a teleport. The
`54.771`-unit "largest jump" in the summary is the pose ledger's `[0,0,0]`
placeholder before the pose source resolved.

Autopilot counters, **corrected** after root's raw-trace precision note of
`2026-09-06T18:08:12.507390+00:00` (an earlier draft of this report read
`hookProbe.autopilot` and wrongly concluded the harness does not sample them):

| field | run 1 | run 2 | run 3 |
| --- | --- | --- | --- |
| samples carrying `sample.autopilot` | 2 460 | 356 | 354 |
| `teleportNudgesTotal` | **0** | **0** | **0** |
| max `stillTime` (s) | 1.4 | 1.3 | 1.2 |

The journey sample's autopilot object exposes only
`beat, clock, pos, routeAction, stillTime, teleportNudgesTotal`. **`nudges`,
`backstops` and `stuck` are NOT present in it and are therefore UNMEASURED for
these three runs — they are not reported as zero.** (The separate flight-1 probe
does read those three fields, and they were 0 there.) Alongside this: no stall,
zero page errors, monotone physical progress.

### Completion

Beat `done`, `objectiveId` null, marker null, work order null, **no stale
guidance** — see `journey-common-2/0074-stop-reached-beat_done.png`, where the
objective card is absent. The **final message is UNMEASURED**: no caption and no
feed text distinct from the HUD objective appeared in the sampled fields in the
completion window. Runtime score state showed `finalTextureSeconds 0.0235` at
61.793 s then `null` at 62.095 s; **no audible-texture and no visible
final-message claim is made from that state.**

## 5. Objective visual defects

**None found in the frames inspected.** Inspected:
`journey-common-2/0054-anchor-anc.cg.reciprocal-crossed.png`,
`journey-common-2/0074-stop-reached-beat_done.png`,
`flight-1/0164-workOrder.png`. Rendered world, HUD present, objective copy equal
to the signed strings, marker labels present (`far reference · offer this end · 3m`,
`origin · audit site · 96m`), no blank/black frame, no wrong-era glimpse. Debug
overlays appear because `debug=1` is a probe switch. This is a **sampled defect
scan**, not a visual acceptance and not a full strip read.

## 6. Exit codes, kept separate

| thing | code |
| --- | --- |
| `npm --prefix main run verify` | 0 |
| `arrival-flight-probe.mjs` (flight-1) | 0 |
| `journey-probe.mjs --self-test` | 0 |
| `journey-probe.mjs` first attempt (retained preflight pin failure, no browser) | **1** |
| `journey-probe.mjs` journey-common-1 / -2 / -3 | 0 / 0 / 0 |

Role-level shell wrappers captured `rc` directly from the probe, not from a
compound `if`, so these are the probes' own exit codes.

## 7. Cleanup

Four browsers owned, **zero left running**. Flight probe cleanup receipt
`{stopped: true, invoked: true, reason: "probe-end", requests: 1, error: null}`.
Journey post-finally receipts, all `state: stopped`,
`sessionStopInvocations: 1`, `cleanupError: null`, at `17:58:01.863Z`,
`18:01:03.982Z`, `18:02:15.452Z`. (`summary.json .cleanup` is captured
*pre*-finally and shows `sessionStopped: false`; the post-finally receipt in
`trace.ndjson` / `cleanup-receipt.json` is authoritative.) The root-owned preview
was never touched, no process was killed, no probe is still running, and the
heavy lock is released.

## 8. Explicitly NOT claimed — remaining gates

* Manual COMMON corner recovery / signed 18-unit early-corner return-to-frontier
  (CG-IMPL-009) — **unmeasured**
* SHORT survey ordinary-input lane — **unmeasured** (the movie harness draws LONG
  only; not impossible, simply not exercised)
* Primary earned Continue — **unmeasured**
* Full-story and station continuity — **unmeasured**
* Variant coverage (desktop/mobile, reduced motion, quality tiers) — **unmeasured**
* FPS / performance budgets — **unmeasured**
* Audio-visual acceptance, audibility, reset matrix — **unmeasured**; no audio
  hearing claim is made anywhere
* Independent creative reviews (chapter / score / cinematography, player-experience
  auditor) — not this role
* Same-ID objective-entry acknowledgement emission count — **unmeasured**
* Frame coverage of the grounded-boarded `Disembark.` copy — **unmeasured**
* Clearance against the engine-accepted survey sample coordinates — **unmeasured**

No defect is closed, no chapter is accepted, no prior role's report is overwritten
and no other role's signature is claimed. The producer's qualifications of earlier
reports stand; nothing here re-litigates them.

## 9. Artifacts

* Probes — `/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier/probes/arrival-common-verifier/`
* Captures — `…/verifier/captures/arrival-common/{flight-1,journey-common-1,journey-common-2,journey-common-3}/`
* Logs — `…/logs/arrival-common-verifier/`

| artifact | sha256 |
| --- | --- |
| `logs/arrival-common-verifier/verify.log` | `e57a9dab67a87a31e54bfff8a3a3d6f334ca62b76098769acbddf4c15e68d6ba` |
| `captures/arrival-common/flight-1/run.json` | `33f336ccc4a64fe7d940bfa293a8d0b552282c2691952706576ac2459dc30450` |
| `logs/arrival-common-verifier/flight-1/telemetry.jsonl` | `9d54ffbcb61e3134e6fd7c7983638250eed7e92f8602958ab94ebbd6c26eee41` |
| `journey-common-1/summary.json` · `trace.ndjson` | `8d9c3b85…143134` · `3ad4bda0…bcc72b` |
| `journey-common-2/summary.json` · `trace.ndjson` | `f9bf64c8…02479d` · `5e9a7c77…cdc1db` |
| `journey-common-3/summary.json` · `trace.ndjson` | `daff62a6…058d20` · `f5faafe6…2090ea` |
| `arrival-flight-probe.mjs` | `0960d6dab14889c97d2417d105ee54e34dc543b8a1c5e371c67e460c7604a6cb` |
| `journey-probe.mjs` | `bab7c6339ed6c02fdfee2b5273fd64b684e6a3462d463a1bab33b8e09ef93a36` |
| `cgContract-v3.mjs` | `2d698f7ed8cf6476cbd87aabde8c3dec6ed8889a67af575ce318962dbad250c4` |
