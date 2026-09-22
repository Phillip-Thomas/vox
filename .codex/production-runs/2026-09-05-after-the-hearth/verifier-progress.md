# Independent story-verifier progress — 2026-09-05-after-the-hearth

Role: independent story-verifier. **No game-source edits.** All outputs live in
`verifier/` under this run. Actionable bugs are reported here and in
`verifier-findings.json`; root routes repairs to the single integrator.

## Phase P0 — preparation (survey + harness) — COMPLETE

Started while integration-v2 was still mutating source. **No measurement,
build, test, browser or capture was run in this phase**, and no source finding
is attributed yet.

Verified, read-only:

- Signed scene-v2 identity: live `scene-contract.json` sha256 =
  `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e`
  — matches the commissioned signed hash.
- Contract shape: 4 beats (`ch13-home`, `ch13-return`, `ch13-survey`,
  `ch13-common`), 28 sync anchors (8 of them signed *contingent*), 17 guidance
  objectives, 15 mechanical checks, 9 evidence captures, 5 agency windows,
  9 shots, 6 score cues, 4 quality tiers + desktop/mobile/reduced-motion.
- Read: `CLAUDE.md`, `production-lock.md/json`, `verification-commission.txt`,
  `integration-progress.md` (v2 Phase 0 receipt), `main/src/story/ux/README.md`
  surface, `main/package.json` scripts, `tools/lib/previewServer.mjs`,
  `tools/lib/evidence.mjs`, `tools/chapter-evidence.mjs`,
  `tools/chapter-journey-probe.mjs`, `src/story/JourneyRuntimeProbeBridge.tsx`,
  `src/story/ux/feedbackCues.ts`, `src/audio/sfxEngine.ts`.

Harness written (run-local, `verifier/probes/`):

| file | purpose |
| --- | --- |
| `lib/cgContract.mjs` | Reads expectations from the **signed contract bytes only** (refuses a non-signed sha). Extracts the exact state-conditional work orders quoted inside `variantIntent`. |
| `cg-preview-daemon.mjs` | The ONE owned preview. Builds once, serves that immutable dist via `tools/lib/previewServer.mjs` (free port, never 5174), verifies `<title>Paravoxia</title>` **and** pins the index sha256, writes `verifier/artifacts/preview-ownership.json`, owns child lifetime (SIGTERM / stop-file). |
| `cg-lifecycle-probe.mjs` | One long browser session per invocation against that one URL. Frame-stamped ledger of beat / objective id / marker label / work order / health / requiresMarker, signed-AV anchor activation, prompts, receipts, milestones, autopilot; before/at/after frames on every anchor change and every objective enter / silent text change; hashes every frame. Variant-aware (`--variant desktop|mobile|reduced-motion`, `--tier`). |
| `cg-reset-matrix-probe.mjs` | Applies the eight contracted reset triggers (`beat-exit`, `deep-link`, `replay`, `pause`, `quit`, `focus-loss`, `completion`, `sandbox`) and records objective/marker/health/AV/entry-cue state before and after each. `sandbox` is a plain load with no `?story=` at all. Unreached states are recorded `not-reached`, never as a pass. |
| `cg-preservation-diff.mjs` | Read-only drift classifier against `initial-source-hashes.json` (958), `integration-before-manifest.json` (74 + 40 absent) and `iterations/implemented-scene-v1-before-v2/source-manifest.json`, bucketed by the signed contract's 118 allowedPaths / 194 protectedPaths, recording each changed file's **mtime** so a concurrent unrelated refactor is not blamed on this run. |

Evidence-schema reconnaissance (so nothing is authored by template later):

- `paravoxia.objectiveLifecycleEvidence.v1` requires, per objective: exact
  contract kind/anchors/markerLabel/workOrder, `entryCount` ≥ 1,
  `markerObservations` ≥ entryCount all exactly equal to the signed label,
  `missingMarkerFrames === 0`, ordered `entered→ready→completed→cleared`,
  `feedbackEmissionsPerEntry` all `1`, presentation-only separation, four
  variant proofs bound to `variant-desktop` / `variant-mobile` /
  `variant-reduced-motion` / `quality-potato`, and all eight reset triggers
  exactly once.
- `ch13:return:launch` (`requiresMarker: false`, `targetMode: none`,
  `maxVisibleTargets: 0`) instead needs `tools/lib/guidanceTargets.mjs`
  evidence: per-entry raw observations carrying
  `controlId / controlAvailable / controlInputActive / boardedState /
  controlOwnership / presentedFrameId / sourceRevision / contractSha256`, zero
  directional markers, and a `control-input` completion with accepted fresh
  input and a real `controlStateBefore !== controlStateAfter` — an authored
  timed bundle cannot satisfy it. The harness records exactly these fields.

Harness self-checks done without touching the game: `node --check` on all three
modules, and `lib/cgContract.mjs` correctly recovers the two signed v2
state-conditional work orders verbatim —

- `ch13:survey:test` preparing state: *"W-7744 is preparing to test the offered
  route." / "Keep his approach clear. Follow his progress, or return to the last
  tested point to revise."*
- `ch13:common:reciprocal` preparation state: *"W-7744 is taking up the
  reference position." / "Give him room to reach it. When the guide appears,
  follow it from the survey end."*

Observability decisions (so no boolean is filled without a measurement):

- Objective/marker/work-order/health: production HUD data attributes plus
  `window.__paravoxiaJourneyProbe.getSnapshot()` (query-gated, passive).
- Anchors: `signedSceneAv` (`anchorId`, `anchorEvent`, `activationSequence`,
  `activationHistoryAnchorIds`).
- Entry acknowledgement counting: the runtime's own SFX queue trace
  (`window.__voxSfxTrace()` `triggerCounts.objectiveEnter`). This is a **queue
  observation, not a hearing claim**, and will be labelled as such everywhere.

## Gate status — WAITING (not yet measuring)

Both preconditions are required before any measurement:

| precondition | state |
| --- | --- |
| `integration-v2-invocation.json` → `finishedAt` | **absent** (integration still running; `run-integration-v2.py` pid 435684 alive, stream still growing at 08:55 UTC, started 08:30 UTC) |
| root's `verification-ready.json` | **absent** |

Polled at ≤45 s intervals. **No build, test, gate, browser or capture has been
run.** Harness is complete and idle.

Hardware: `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock`
existed and `fuser` showed **no holder** at survey time. That is an observation,
not an acquisition — ownership will be re-tested with a non-blocking `flock` at
the moment a real-GPU probe starts, and never waited on blocking for >60 s.

## Preview ownership

None started yet. No preview server is running for this run at this time.

---

# CONTINUATION (fresh independent verifier, 2026-09-06T09:5x UTC onward)

The previous verifier CLI was interrupted by root (`producer-verifier-pause.json`)
after a 300 s ch13-home movie stall. That interruption is **not** a verification
result. Everything below is new evidence against the post-repair source; the old
captures in `verifier/captures/{smoke-home,home-movie-1,control-ch10-cold}` and
`verifier/logs/verify.log` are preserved untouched as pre-repair history.

## Phase C0 — readiness + source-identity gate — PASS

| gate | measurement |
| --- | --- |
| `verification-ready.json` | `ready: true`, `readyAt 2026-09-06T09:53:08Z` |
| integration invocation finished | `integration-movie-repair-invocation.json` `finishedAt 2026-09-06T09:51:14Z`, `exitCode 0`, `isError false` |
| control agreement | `verifier-control.json.sourceManifestSha256` == `verification-ready.json.sourceManifestSha256` == `58f275f6130914f878942774fd4b4c6ce74327755c33ae257965a9dbeed40e70` |
| manifest bytes | `sha256(implementation-source-manifest.json)` = `58f275f6…d40e70` — matches |
| signed contract bytes | `sha256(scene-contract.json)` = `4dbf722b30…fddff88e` — matches the signed scene-v2 |
| live source vs manifest | **96/96 files hash-identical, 0 mismatch, 0 missing** (independently recomputed, not trusted from the manifest) |
| newest signed source mtime | `main/src/story/commonGroundDirector.ts` 2026-09-06T09:47:13Z — before the readiness stamp, so source was frozen before measurement began |

Source is frozen. No game-source file has been edited by this role.

## Phase C1 — independent static gate on the REPAIRED source — PASS

All commands run from `main/`. Full logs in `verifier/logs/post-repair/`.

| command | result | log |
| --- | --- | --- |
| `npm run verify` (full: catalog, scene:av, creative:workflow, chapter:registry, chapter:journey, typecheck, preview:check, audio:diagnostic-check, story:ladder, guidance:target-check, story:authority, vitest, audio:check, build) | **EXIT 0** — `Test Files 348 passed (348)`, `Tests 3026 passed (3026)`, `✓ built in 5.62s` | `post-repair/verify-postrepair.log` (sha256 `44622391eb0bbc7bb152ab68ed407f5f03ac468917ea1c0d2df8a65df36c5d19`) |
| `npm run story:ux:check` | EXIT 0 — 9 files / 94 tests | `post-repair/story-ux-check.log` |
| changed-source tests (`commonGroundDirector/State/Route/Score` + `src/story/autopilot`) | EXIT 0 — 13 files / 212 tests | `post-repair/changed-source-tests-postrepair.log` |
| `chapter:registry:smoke`, `chapter:journey:smoke`, `story:authority:smoke`, `creative:smoke`, `chapter:accept:smoke`, `chapter:journey:probe:smoke` | all EXIT 0 | `post-repair/*.log`, index in `targeted-suites-index.log` |
| `creative:gate --run <this run> --phase implementation` | EXIT 0 — **1708 checks passed** | `post-repair/creative-gate-implementation.log` |

The prior verifier's `verify.log` (3018 tests) is retained as pre-repair
evidence only; this run's claims rest on the new 3026-test log above.

**These are CPU/static results. They prove nothing about rendering, traversal,
audibility, hardware timing or the movie bridge.** The 3026 passing tests
include the repair's own regressions — which is exactly why the browser
measurements below are still required and are not inferable from them.

## Phase C2 — harness upgrade (no game source touched) — DONE

New run-local probe `verifier/probes/cg-journey-probe.mjs`
(sha256 `540930178ab69c33321a7d9da156c7f2d71307ec86d7256e5204ceae325f1ca4`),
a v2 of `cg-lifecycle-probe.mjs` (v1 left byte-identical so the pre-repair
captures keep their exact generator). Additions:

- **Root checkpoint control.** `verifier-control.json` is re-read every 10 s
  (inside the mandated 45 s bound) and every control record is written to the
  trace. On `finish-current-and-checkpoint` / `pause` / `stop` / `halt` the loop
  ends at the next sample, still writes all frames, the ndjson trace and a
  complete `summary.json` with `checkpointed: true` and the control record, then
  exits 0. If the control already says checkpoint before launch, no browser is
  opened at all.
- **Physical traversal measurement** — walked path length integrated from actual
  sampled bodies (`__autopilot.pos` for the player, `__auditWorker.pos` for
  W-7744), plus net displacement, farthest-from-start, largest single-sample
  jump (teleport candidate) and a pose ledger. This is independent of
  `terraUnits` / `routeProgressUnits`, which the runtime does not expose to any
  window bridge — so the 18-unit claim will be tested against real bodies rather
  than against the controller's own opinion.
- **Backtrack/retarget detection** (the CG-IMPL-005 failure mode: returning
  toward an already-visited start).
- **Stall detection**: longest window with no beat/objective/anchor/milestone
  change *and* player displacement under threshold. A stall is reported as a
  failure; the probe has no rescue path and grants nothing.
- **Stop predicates** (`--until-beat/-anchor/-objective/-objective-clear/-milestone`)
  so cold runs are bounded by real progress, not by a timer that could be read
  as success.
- **`--percept`**: an extra HUD-suppressed frame paired with each raw
  HUD-inclusive frame, tagged `perceptual-hud-suppressed` vs `raw-hud-inclusive`
  so UX evidence and perceptual evidence are never confused.

`node cg-journey-probe.mjs --self-test` passes with no preview/browser/source:
checkpoint-action classification, L-walk path = 18.000 units, net = 12.806,
zero false backtracks on a forward walk, and true detection of a return toward
the start.

## BUILD READY — waiting on the root-owned preview

Independent full verify **and** production build are complete and green on the
current frozen source. **No preview server has been started by this role**, and
the stopped port-38091 claim in `verifier/artifacts/preview-ownership.json`
(`state: "stopped"`) is correctly treated as dead — no probe will run against it.

**Root: please start the owned immutable preview (`cg-preview-daemon.mjs` via the
root exec session) and update `verifier/artifacts/preview-ownership.json` to
`state: "running"` with the new build/index identity.** The probes refuse to run
while ownership is not `running`, and will re-verify `<title>Paravoxia</title>`
plus the pinned index sha256 and the live build identity before any measurement.

Hardware: `/home/thomasphillip/Projects/Paraform/harness/output/.heavy.lock`
took a non-blocking `flock` successfully at this moment and `fuser` shows no
holder — an **observation**, not an acquisition. Real-GPU headed probes will
each acquire it with `flock -n` at the moment they start and will never bypass
or terminate another owner. If it is busy at that moment, work continues as
explicitly labelled software-only functional checks with no timing/fps/audio
claims.

## Preview status — SUPERSEDED (see below)

The "BUILD READY — waiting on the root-owned preview" section above is now
**historical**. Root launched the owned preview at 09:56:02Z and this role
independently rechecked its identity before measuring:

| check | value |
| --- | --- |
| canonical URL (the only URL any probe uses) | `http://127.0.0.1:43617/` |
| owner / lifetime | `root-production-preview`, root exec session 9968 — outlives this CLI |
| HTTP + title | 200, `<title>Paravoxia</title>` |
| index sha256 | `1f3272687745880e7800b5349795bc4b55eb1ea8ee12a08b340716bcf05b823a` — equals the ownership record |
| bundle | `/assets/index-CVcXc2R8.js`, sha256 `c34f18505c959cbe966d676984cf99ef6f1bff3dd3a1d4ef60cd349c36fca9d9` |
| **build carries the repair** | the served bundle contains `railTraversal` (the CG-IMPL-005 ordered cursor) and the exact signed labels `W-7744 · offered route`, `Far reference · check my route`, `Second hearth · unfinished audit` |
| source manifest | `58f275f6…d40e70` — same frozen manifest this role verified file-by-file |

The dead port-38091 claim was never probed. No second server was started.

## Phase C3 — targeted probes on hardware — PARTIAL, paused by root at 10:05:23Z

Both probes ran headed on the real GPU (`ANGLE (NVIDIA Corporation, NVIDIA
GB10/PCIe, OpenGL 4.5.0)`, `rendererClass: hardware`), each under a non-blocking
`flock` on the shared heavy lock, released on exit. No other owner was waited on,
bypassed or killed.

### C3.1 — ch13-home movie (`post/home-movie-2`) — the CG-IMPL-004 recheck: NOT REPRODUCIBLE

| measurement | value |
| --- | --- |
| `ch13:home:review` enter | 7 ms, health `ready`, marker label exactly the signed `Second hearth · unfinished audit`, work order exactly the signed two lines |
| the act itself | `interactionTrace` attemptId 1, `story-ch13-fault-review`, owner `ch13-common-ground`, **source `resolver-perform`** (the shared performer, not a rail shortcut), `performOutcome: returned`, `promptOutcome: cleared`, `clearingLatencyMs 0` |
| `ch13:home:choose-return` enter | 2165 ms, exact signed label and work order |
| beat advance to `ch13-return` | 2777 ms |
| rescues / errors | `teleportNudgesTotal 0`, `pageErrors []` |
| pre-repair comparison | `home-movie-1` sat on `ch13:home:review` for the entire 300 s |

**Honest limits.** A deep link seeds this beat's prerequisites and is *not*
evidence of the station→home passage. Only 3 state samples landed inside the
2.777 s window because event screenshots were starving the 10 Hz sampler; the
probe now pairs HUD-suppressed twins only with strip/anchor frames, so the
inter-act dwell cadence still needs a re-measure at full rate.

**Independent correction to root's 10:02 note.** The empty `anchorLedger` there
is not an instrumentation gap. Anchor capture demonstrably works — the survey run
recorded `anc.cg.repeated-measure` with its exact signed event text. Two separate
things happened: (a) the loop exited on its `--until-beat` predicate at 2777 ms
and `anc.cg.hatch-boarded` activated after that, surviving only in the post-loop
`finalState`; and (b) no *ch13-home* anchor could activate at all, because
`anc.cg.cell-installed` is signed as "the actual live install receipt from the
prior station-continuation contract" — unobtainable through a deep link — and
`activateAnchor` refuses any anchor while an earlier pending ordered anchor of the
same beat is unactivated. The four home anchors are provable only in the
continuous station→home journey. That is where they will be proven.

### C3.2 — ch13-survey movie (`post/survey-movie-1`) — REAL DEFECT, VF-DEEPLINK-1

A `?story=ch13-survey&movie=1` deep link **boots the player still aboard the
landed Kestrel and never recovers**. 243.2 s of zero displacement:

| measurement | value |
| --- | --- |
| stall | 243 230 ms with no beat/objective/anchor/milestone change |
| player body | frozen at exactly `[8, 53.85, -6]`; **walkedPathUnits 0.000** over 250 s, 2203 pose samples |
| W-7744 | mounted and static at `[-34, 51.1, 10]` ≈ 44 m away — the distance the HUD marker itself prints |
| flight state | `{phase: 'surface', controlMode: 'flight'}` in **all 2237 samples** (module default is `fps`) |
| rail | alive and asking correctly: `routeAction 'walk'`, clock 3.1 → 238.3 s, `stillTime` 0.8–1.5 |
| acts attempted | none — `interactionTrace []` |
| rescues / errors | `teleportNudgesTotal 0`, `pageErrors []` |
| picture | `0039-root-checkpoint.png` is shot from **inside the cockpit** (yoke, throttle, canopy frame); debug HUD reads `Ship: landed`, `Flight: surface / flight` |

Source reading (read-only, offered as a candidate, not a patch):
`commonGroundRailPlan()` has an `exit-ship` branch only under `case 'ch13-return'`;
`ch13-survey` and `ch13-common` return walk/act plans without ever inspecting
`controlMode`, so an entry that begins in flight has no way back onto her feet.

**Classification: a deep-link / beat-entry boot-state defect, distinct from both
CG-IMPL-004 and CG-IMPL-005.** No route-progress algorithm was reached, because
the body never left the ship — so this run says nothing, either way, about the
waypoint repair. It blocks deep-link-entered ch13-survey / ch13-common cold runs
and the deep-link reset trigger for those beats; it does not yet implicate
ordinary continuous play, which must be measured to tell the difference.

No source was modified. No teleport, rescue or progress grant was applied, and
the capture was ended by root's control pause — not by a timeout reported as
success.

### C3.3 — checkpoint control proven

`verifier-control.json` action `pause` (10:05:23Z) was picked up within the 10 s
poll; the probe stopped at the next sample and still wrote all 40 frames, the
full 2237-sample ndjson trace and a complete `summary.json` carrying
`checkpointed: true` and the control record that stopped it.

## Status: PAUSED, awaiting root `continue`

This role remains alive and is polling `verifier-control.json` /
`verifier-inbox.md`. Nothing below has been measured yet and nothing below is
claimed: route traversal and the 18-unit span, both route classes, the
manual-corner recovery, three cold focused runs, the continuous
station→home→ch13 bridge, the full story movie, the 28 anchors, variants, the
reset matrix, performance, score, and the typed evidence artifacts.

**Requested next step (root's own plan, restated):** bounded survey/common
diagnostics in which an ordinary disembark is performed as an *explicitly
labelled prerequisite fixture*. Such a fixture is not a no-rescue cold journey
and will never be reported as one.

## Phase C4 — bounded on-foot diagnostics (root's 10:06 continue) — TWO BLOCKERS

Both runs used an **explicitly labelled prerequisite fixture**: one press of the
shipped ordinary disembark key (`KeyF`, the `surface`+`flight` handler in
`App.tsx`), applied only because the entry actually booted aboard the ship, and
recorded in `summary.prerequisiteFixtures` with before/after state. It grants no
milestone, position, progress or route credit. **Neither run is a cold journey
and neither is reported as one.**

### C4.1 — `post/survey-diag-1`: the disembark unblocks the approach, then a NEW blocker

With the fixture applied (`controlMode` flight → fps, confirmed in the record),
the chapter genuinely came alive:

| measurement | value |
| --- | --- |
| `anc.cg.repeated-measure` | 3258 ms, exact signed event text |
| `ch13:survey:offer` → offer performed | objective cleared, `anc.cg.demonstration-opened` at 13 780 ms |
| `ch13:survey:start` entered | 13 780 ms, exact signed label `Survey start · begin a route` and work order |
| player walked | **58.632 real units** (2643 pose samples), largest single-sample step 3.11 — no teleport |
| W-7744 | mounted and static at `[-34, 51.1, 10]` |

And then it stopped for the remaining ~286 s.

**VF-RAIL-2 (candidate CG-IMPL-006) — the ch13 movie rail can never begin the
survey recording.** The rail's arrival gates compare a **full 3D distance**
between the player's live world position and poses authored on the ground plane:

| quantity | value |
| --- | --- |
| player body y | 52.79–52.80 in **every one of 2643 samples** |
| `CG_POSES.S` | `(-26, 51.05, 12)` |
| minimum achievable 3D distance to S | **1.745** (horizontal 0.13 — she is standing on it) |
| rail gate | `CG_RAIL_START_AIM + CG_RAIL_ROUTE_ARRIVE = 0.35 + 0.35 = 0.70` |
| time within 0.5 horizontal units of S | 261 of 354 pose-ledger entries (~4.5 min) |
| rail state throughout | `routeAction: 'walk'`, `stillTime 0`, `teleportNudgesTotal 0` |
| live prompt throughout | `F | Begin recording your route` |

`0038-strip-ch13-survey.png` shows it plainly: the marker reads **`survey start ·
begin a route · 0m`**, the F prompt is on screen, the debug HUD reads `Flight:
surface / fps`. She is standing on the mark she cannot reach.

Why the prompt appears but the rail cannot act: the shipped resolver reach is
`CG_POINT_REACH = 2.0`, which 1.745 satisfies — with only **0.255 units of
margin**. Why 3026 passing tests cannot see it:
`commonGroundDirector.test.ts`'s `standAt()` calls
`setPlayerWorldPosition(point.x, point.y, point.z)` at the authored pose y, i.e.
**a body of zero height**, so every rail regression runs at a vertical offset of
0. This is exactly the integration seam the commission warned the unit tests
would miss. Gates below the live 1.745 offset: `CG_RAIL_ROUTE_ARRIVE 0.35`,
`CG_RAIL_POSE_ARRIVE 0.6` (offer-span at E), `CG_RAIL_START_AIM+ARRIVE 0.70`,
`CG_RAIL_CORNER_OVERSHOOT 0.6`.

**Consequence for the commission: the CG-IMPL-005 ordered-cursor repair is still
UNTESTED in a browser.** No route traversal was ever entered, so nothing is yet
known — good or bad — about retargeting the visited start, corner shortcuts, the
ordered 18 units, the long-vs-short route classes, first-try-legal long success,
the three cold journeys, the station→home→ch13 bridge, or the ch13 segment of the
full story movie. All of it sits downstream of an act the rail cannot perform.

### C4.2 — `post/common-diag-1`: two genuine positives from a synthetic state

Deep link + the same labelled fixture. Its survey prerequisites are **not
earned**, so this is a synthetic state that proves no journey.

- **Signed preparation copy is exact.** `ch13:common:reciprocal` entered showing
  the scene-v2 *preparation* conditional work order verbatim — "W-7744 is taking
  up the reference position." / "Give him room to reach it. When the guide
  appears, follow it from the survey end." — matching the array quoted inside
  the signed `variantIntent` byte for byte, under the exact signed marker label
  `Far reference · check my route`.
- **Body blockage holds, it does not displace.** With Terra's body 0.38
  horizontal units from W-7744, he moved 0.2 units and **held**; he did not push
  her, and `teleportNudgesTotal` stayed 0 — consistent with the signed rule that
  a player blocking his leg causes a hold.
- **To re-test after repair:** the rail walked Terra 60 units onto the reference
  itself rather than to the signed standby clear of E, and no anchor activated in
  145 s. From an unearned deep-link state neither is attributable yet.

## Status: TWO BLOCKERS REPORTED TOGETHER, awaiting root routing

`verifier-findings.json` → `blockersForOneBoundedRepair`:

1. **VF-DEEPLINK-1** — ch13-survey / ch13-common deep-link entry boots aboard the
   landed Kestrel (`controlMode: 'flight'`); `commonGroundRailPlan()` has an
   `exit-ship` branch only under `ch13-return`, so the entry can never recover.
2. **VF-RAIL-2** — rail arrival gates are unsatisfiable against ground-authored
   poses, because the live body sits 1.745 units above them.

No game source was modified, no threshold or predicate was touched, no teleport,
progress grant or timeout rescue was used anywhere, and no unrun check is marked
passed. The owned preview at `http://127.0.0.1:43617/` is root's and remains
running and usable for owner review; this role started no server and will orphan
none.

## Phase C5 — interim checkpoint and clean finish (root control `pause`, 10:18:18Z)

Root asked for no further probes, a corrected findings file, one interim report,
and a clean end so a single integrator can repair. Done:

- `verification-lifecycle-interim-report.json` / `.md` — verdict, both blockers
  with exact source citations, the confirmed-working list, the open anchor
  anomaly, the explicit not-measured list, per-file sha256 raw-media inventories
  (JSON only, kept out of the prose), and the probe identity + self-test.
- `verifier-findings.json` — **VF-ANCHOR-OBS-1 revised**: I withdraw the
  "all four home anchors are continuous-only" inference in favour of Score's
  binding reading, and restate the missing home-steady / fault-reviewed /
  return-chosen as an OPEN ANOMALY with two unconfirmed source candidates and no
  audibility claim. **VF-RAIL-2 reconciled** against the real Rapier capsule
  frame at root's request: feet = centre − (1.3 + 0.5) = 50.99, within 0.06 of
  the authored plane, so it is a centre-vs-feet coordinate-frame mismatch and
  NOT a too-tight radius. No fix is prescribed.
- Chapter's manual-corner interpretation is read and respected: manual-corner
  recovery was **never reached**, so it stays a source/test risk and is recorded
  separately from the two measured blockers.

Preview: `http://127.0.0.1:43617/` is root's, still running, untouched by this
role's exit. No probe server was ever started here and none is orphaned.

**This role now ends. It is an interim failure checkpoint, not final chapter
verification. Independent re-verification of the changed final source is still
required, and no publication is authorized.**

---

# CONTINUATION 3 — independent verification of the LIFECYCLE-REPAIRED final source

Fresh independent story-verifier, started 2026-09-06 (run continues; no
preproduction restart, no capture overwritten, no game source edited).

## Phase D0 — preconditions checked before any measurement

| precondition | result |
| --- | --- |
| lifecycle-repair invocation finished | `integration-lifecycle-repair-invocation.json` exitCode 0, isError false, finishedAt `2026-09-06T11:17:11.957546+00:00` |
| readiness | `verification-ready.json` `ready: true`, readyAt 11:19:00Z, contract `4dbf722b…ff88e` |
| control | `verifier-control.json` action `continue`, sourceManifestSha256 `51b25376…02c3` |
| manifest identity | `implementation-source-manifest.json` file sha256 = `51b25376aa6c87dc428249fcfd907811c592bc9dfdaf00d82c53112593ea02c3` — matches control and readiness EXACTLY |
| independent source rehash | 96/96 manifest hashes recomputed from the working tree: **0 mismatch, 0 missing**; manifest `unexpectedDrift: []`, preservationChecked 958 |
| implementation gate | `implementation-gate-pass.json` passed, 1708 checks, same contract + manifest hash |

Preconditions satisfied. Measurement authorized to begin.

## Phase D1 — independent full verify on the FINAL source — **BUILD READY**

```
npm --prefix main run verify        # cwd /home/thomasphillip/Projects/vox
```

| field | value |
| --- | --- |
| exit code | **0** |
| started / ended | 2026-09-06T07:19:38-04:00 → 07:20:39-04:00 (61 s wall) |
| test files | 348 passed (348) |
| tests | **3068 passed (3068)** |
| build | `✓ built in 5.88s` |
| log | `verifier/logs/final-source/verify-final.log` |
| log sha256 | `53678121a72fd66534f699d0ddfffd94cf532162d9483012cb1563c6be1e16c9` |
| source after verify | 96/96 manifest hashes re-checked again — still 0 mismatch (verify mutated no source) |

3068 matches the integrator's reported total (baseline 3026 + 42). This is my
own independent execution, not a re-reading of theirs.

**BUILD READY.** The final source at manifest `51b25376…02c3` typechecks, passes
3068 tests and builds. Root may now stop the prior immutable preview (currently
`http://127.0.0.1:43617/`, bound to the OLDER manifest `58f275f6…0e70`) and start
a fresh root-owned preview bound to THIS source.

I will not start a preview, will not probe the 43617 snapshot for any claim about
the new source, and will wait for `verifier/artifacts/preview-ownership.json` to
record a running preview with the new build identity before any browser work.

**Static gate is permission to measure. It is not acceptance**: it proves nothing
about rendering, traversal, hearing, hardware budgets, Continue correctness or the
open CG008 concern below.

## Phase D2 (while waiting for the root preview) — run-local static reproduction of the carried CG008 mid-beat Continue concern

In progress. No game source is edited; the reproduction runs the REAL
`signedSceneAvRuntime` from a run-local test file outside `main/src`.

## Phase D2 result — CG008 intermediate Continue, corrected and honestly labelled

Root's correction is accepted: the first version of the reproduction seeded
milestone strings that do not exist. It was rewritten to use only the six
milestones the source actually declares, and it is labelled for what it is.

- **Label: isolated AV-order boundary probe, NOT a saved-chapter or physical
  Continue reproduction.** It calls `activateSignedSceneAnchorById` directly and
  reconstructs no WorldSave through its validator/restore.
- **Survey side reproduces**: with no ch13 receipt held, `anc.cg.route-offered`
  and `anc.cg.route-tested` are both refused; with `story:ch13-route-tested`
  held, the same call succeeds. Only six durable ch13 milestones exist, and
  `RECEIPT_SATISFIED_ANCHORS` keys every survey predecessor on the FINAL
  `story:ch13-route-tested`, so a mid-drawing save can carry nothing that
  excuses them.
- **Common side does NOT reproduce.** Marking the crossing receipt in the real
  order (`commonGroundDirector.ts:1256` marks before `:1257` notes) activates
  `anc.cg.reciprocal-crossed` true, because its predecessor is excused by that
  receipt. Root's point that the common tick re-observes maintained H stands.
- Log `verifier/logs/final-source/cg008-midbeat-repro.log`
  (sha256 `6114a162…33f5`), test `verifier/tests/cg008-midbeat-continue.repro.test.ts`
  (sha256 `5ba15363…0041`), run through a run-local vitest config whose root is
  `main/` and whose include glob points OUTSIDE `main/src`. **No game source, and
  no game test file, was added or changed.**

## Phase D3 — root-owned preview 45091 identity, independently rechecked

| check | result |
| --- | --- |
| `<title>` | `Paravoxia` |
| index sha256 | `7e1ed124be8fe197ae2f80de6b988c260ed7533aea83a803190abc84bbc89cae` — equals `main/dist/index.html` |
| served bundle | `/assets/index-Bquz6XRz.js`, sha256 `213aa350ea2d340a8a34e802a70d703984fb29ed4ff1b9d2003e457fcaead453` — **byte-identical to my own build's dist** |
| carries the new source | `__paravoxiaCommonGround`, `bodyCentre`, `railCursor`, the exact signed marker strings all present in the served bytes |
| ownership | root exec session 89502, `sourceManifestSha256 51b25376…02c3` |

The old 43617 preview is stopped and no claim in this section comes from it. I
started no server; the archived waiting state in the earlier sections of this
file is historical.

## Phase D4 — hardware harness smoke, ch13-home (45 s, HEADED, real GPU)

ANGLE (NVIDIA GB10/PCIe, OpenGL 4.5.0), headed, heavy lock acquired with
`flock -n` and released; no other owner was waited on, bypassed or terminated.

**Real progress on this source.** `ch13:home:review` entered at 11 ms with the
exact signed label and work order, was performed through the shared resolver,
`ch13:home:choose-return` followed, the beat advanced to `ch13-return` at
2704 ms, and boarding and lift both completed with their anchors. 0 nudges,
0 page errors.

**But — VF3-AVHOME-1 (new blocker).** For the whole of `ch13-home` the signed AV
runtime reported `beat: ch13-home`, `activationSequence: 0`,
`activationHistoryAnchorIds: []` and an EMPTY pending queue, while the chapter's
own diagnostic listed `firedAnchors ['anc.cg.home-steady','anc.cg.fault-reviewed']`.
Local fired facts are not accepted AV history. The AV ledger only starts at
`anc.cg.hatch-boarded`. Detail, source citations and the honest limit (the entry
interleaving happened before the first sample; only the *cascade* half is
demonstrated) are in `verifier-findings.json#VF3-AVHOME-1`.

## Phase D5 — hardware survey journey, ch13-survey (189.8 s, checkpointed by root)

**Two previous blockers are gone.** The entry boots ON FOOT (VF-DEEPLINK-1 not
reproducible), and the centre-vs-feet frame is reconciled: the diagnostic
publishes `bodyCentre` 52.7890 and grounded `bodyPose` 50.9890, exactly 1.8
apart along the live up, and the body arrives 0.303 horizontal units from the
authored S inside the 0.35 arrive radius (VF-RAIL-2 not reproducible).
`anc.cg.repeated-measure` and `anc.cg.demonstration-opened` were ACCEPTED by the
AV rail (sequence 1, 2) — the first accepted ch13 chapter anchors of this run.

**New blocker VF3-FOOTING-1.** At S the shipped F resolver was performed **200
times** (`story-ch13-survey-start`, `source: resolver-perform`,
`performOutcome: returned` every time) and `survey.phase` never left
`awaiting-start`; 0 samples were ever recorded and the prompt stayed live with
no player-facing explanation. The chapter's diagnostic reports
**`supported: false` in 1501 of 1555 world-bound samples**, true only near the
landed ship at `bodyPose [6.836, 51.186, -6.0]`, and false from
`[-29.083, 50.99, -1.133]` onward — i.e. across the entire Origin audit site.
The only other gate on `commitCommonGroundSurveyStart` is `CG_POINT_REACH 2.0`,
satisfied at 0.310. **Root cause is NOT established** and no rounding claim is
made: `Math.round` maps both the observed 50.989 and the authored 51.05 to the
same voxel cell 25 (`VOXEL_SCALE = 2`). Candidates, including the difference
from the shipped agent navigation's downward support search, are cited in
`verifier-findings.json#VF3-FOOTING-1`. **No predicate, radius or threshold was
touched and no ground was invented.**

## Phase D6 — two harness defects found and fixed in MY probes only

1. **The stall predicate never armed.** Its phase came from
   `__autopilot.routeAction`, which reports `idle` throughout this chapter's
   screening rail — 200 consecutive `phase-out-of-scope:idle` resets across the
   whole 189.8 s survey run. It now leads with the chapter's own executed rail
   action (`walk` / `interact` / `fly`) from the published diagnostic.
2. **`cgHoldReason` read a flat `.holdReason`**; the published schema nests it
   under `.diagnostic`, so a genuine hold never extended the stall window.
3. **Pose selection now leads with the published hook** (full-precision
   `bodyCentre`, grounded `bodyPose`, live `up`, actor pose and leg), keeping the
   weaker sources for reconciliation, and a change of pose source is recorded as
   a measurement discontinuity rather than counted as a body teleport — the
   earlier run's 54.77-unit "largest jump" was the boot placeholder switching to
   the real hook, not a teleport.

Offline proof: `cg-harness-selftest` **25/25** (23 before; B5/B6 added for the
published hook and for malformed/absent diagnostics), `--self-test` OK,
`node --check` OK. These are harness checks, not game proof.

## Status: PAUSED at root control, two new blockers reported together

`verifier-control.json` is `pause` (11:32:20Z) and no probe has run since. The
verifier context stays alive and awaits root routing. Nothing downstream of the
survey start has been measured: both route classes, the ordered 18 units, the
manual corner, the common beat, completion, the three cold journeys, the
station bridge, the full story movie, the 28 anchors as a set, the reset matrix,
the variants and every performance and audio figure all remain **unmeasured, and
none of them is marked passed**. Nothing has been listened to.

## Phase D7 — bounded footing diagnostic (root's question, answered by measurement)

`verifier/probes/cg-footing-diag.mjs` (new, run-local, offline self-test first)
sampled the chapter's own `supported` **as a function of the body's own height**
at the audit site, moving only with the shipped Space jump.

| voxel cell `cy` | feet y range | samples | supported = true |
| --- | --- | --- | --- |
| 25 — the cell the body stands on | 50.989 – 51.908 | 13 | **0** |
| 26 — one cell up | 52.123 – 54.047 | 59 | **59** |
| 27 | 54.083 – 54.212 | 14 | **0** |

A lift into cell 26 returning true requires `solid(26)` **and** `air(27)`. So the
terrain model the footing query reads puts the ground's top face at **y = 53**
at the audit site, while the body physically stands with its feet at **50.99** —
exactly one voxel cell (2 world units) lower. The authored ch13 poses (51.05)
match the **physical** surface. At the landing area the two agree (feet
51.16–51.30, cell 25, supported true), so this is **localised, not global**.
World identity for the engineer's reproduction, read off the captured HUD:
**seed 3215739679, coordinate −1,−1, 125,000 voxels**.

Still inferred, and said as inferred: which clause fails, and whether the gap is
`hasVoxel` vs `shouldVoxelExist`, a WorldSave/`isDeleted` gap, or an audit-site
clearing present in the collider but not the generator. No cause asserted, no
rounding claim, no predicate touched. The probe crashed on its final write
(it awaited the synchronous `frameStats`); the bug is fixed and its summary was
reconstructed offline from its own trace and is labelled as such.

**Frames read.** `0034-strip-ch13-survey.png` (raw, HUD) shows the exact signed
marker "Survey start · begin a route", the correct standing work order, the live
`F | Begin recording your route` prompt **and a marker distance of 0 m**, while
200 performed F attempts change nothing. The HUD-suppressed twin renders a full
scene (terrain, fauna, foliage, day and later night) with **no blank frame, no
pop and no wrong-era glimpse**; W-7744 and the apparatus are not in view in the
captured frames, which is recorded as *not visible in these frames*, not as
absent.

## Phase D8 — finalized at root's instruction; invocation ends here

Root control `pause` at 11:42:15Z: finalize, record, end cleanly; two measured
blockers are enough to authorize one bounded engineer pass, and no further
browser work is wanted. Written:

- `verification-world-interim-report.json` / `.md` — verdict, identity, the
  confirmed repairs, both blockers with source citations and honest inference
  limits, the still-open valid-Continue proof gap, every harness change, the
  explicit not-measured list, and a per-file sha256 inventory of all 53 frames,
  traces, logs, probes and tests.
- `verifier-findings.json` — updated with the measured height response, root's
  precision corrections (the AV finding claims **no** cue/audibility conclusion;
  `noteAnchor` drives mood separately and `score.mood = restored-home` was
  observed by root), and the prior-source findings retained verbatim under
  `priorSourceFindingsRetained` plus an archived copy in
  `verifier/artifacts/verifier-findings.prior-source-58f275f6.json`.

The root-owned preview at `http://127.0.0.1:45091/` is root's, remains running
and usable for owner review, and is untouched by this role's exit. No server was
started here and none is orphaned. Source stayed frozen throughout measurement.

**This is an interim failure checkpoint, not chapter verification.** No
mechanical acceptance requirement of the signed contract is marked satisfied,
no unrun check is marked passed, nothing was listened to, and no publication is
authorized.

---

# PHASE W4-A — INDEPENDENT FULL VERIFY ON FINAL WORLD-REPAIR SOURCE — **BUILD READY**

Written 2026-09-06T12:26Z by the fresh independent story-verifier commissioned
after the Common Ground live-world / boot / Continue repair.

**Everything above this line describes EARLIER source snapshots.** In
particular every section that names preview `38091`, `43617` or `45091`, or
manifest `58f275f6…40e70` / `51b25376…02c3`, is history. Those measurements
stand as retained failure evidence on source that no longer exists on disk;
none of them is evidence about the source measured from here on. The two
blockers recorded in `verification-world-interim-report.json` (VF3-FOOTING-1
unsupported footing at S, VF3-AVHOME-1 empty home AV history) were measured on
`51b25376…02c3` and remain UNRETESTED at this point.

## Pre-measurement gate (all required conditions checked independently)

| Condition | Required | Observed | Result |
|---|---|---|---|
| Engineer finished | finishedAt set, exit 0, not error | `integration-world-repair-invocation.json` finishedAt 12:19:37.406297Z, exitCode 0, isError false, session cdc9088e-30af-499e-9833-c56d5c5fe491 | PASS |
| Readiness | ready:true | `verification-ready.json` ready true, readyAt 12:21:08.521076Z | PASS |
| Control | current, actionable | `verifier-control.json` action `continue`, updatedAt 12:21:08.521076Z | PASS |
| Signed contract | scene-v2 `4dbf722b…ff88e` | sha256(scene-contract.json) = `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e` | PASS |
| Three creative signatures | all over that exact sha | chapter (approve-with-notes), score (approve), cinematography (approve) — all `4dbf722b…ff88e` | PASS |
| Signed source manifest | control == ready == gate-pass | all three name `d9e36ae3…96caf2` | PASS |
| Manifest identity | file bytes | sha256(implementation-source-manifest.json) = `d9e36ae314ba547a292e55376d54eecbf0ff47dc3d6710c4f9b5ae3fee96caf2` | PASS |
| Working-tree drift | zero | 97/97 manifest files rehashed byte-identical, 0 drift | PASS |
| Diff identity | manifest-declared | sha256(implementation.diff) = `5bfe6f94…9b4ed3d`, matches `implementationDiffSha256` | PASS |
| Preservation | 958 originals | manifest `preservationChecked` 958, `unexpectedDrift` [] | PASS (compiler-asserted; my own check is the 97-file rehash) |

**Two distinct identities, kept separate as root required.**
- `implementation-source-manifest.json` **file-bytes SHA256** =
  `d9e36ae314ba547a292e55376d54eecbf0ff47dc3d6710c4f9b5ae3fee96caf2`. This is
  the value control/ready/gate-pass all carry. Confirmed by `sha256sum` of the
  file.
- **Canonical ordered source-set hash** over the same 97 `path\0sha\n` rows =
  `8a1ef53d06dc50a9ab1b55badd3f19787eb422d5db9a7037c7b82b598c5fea31`. This is a
  DIFFERENT number and is not interchangeable with the one above. The harness's
  own `sourceSnapshot.manifestSha256` is a third, unrelated canonical hash
  scoped to probe bytes only.

## Independent full verify — actual command, exit and log

- Command: `npm --prefix main run verify` (14 chained gates: catalog:check,
  scene:av:check, creative:workflow:check, chapter:registry:check,
  chapter:journey:check, typecheck, preview:check, audio:diagnostic-check,
  story:ladder:check, guidance:target-check, story:authority, test,
  audio:check, build).
- Log (preserved verbatim, 633 lines):
  `verifier/logs/world-final/verify-world-final.log`
- START 2026-09-06T12:22:06Z → END 2026-09-06T12:23:06Z
- `Test Files  349 passed (349)` / `Tests  3091 passed (3091)`
- `✓ built in 5.78s`
- **`EXIT=0`**

349 files / 3091 tests independently reproduces the count in
`producer-world-source-review.json` (3068 baseline + 23 added, 0 removed). I
did not re-derive the +23 attribution; I measured the total.

## Build identity produced by MY verify

| Artifact | SHA256 |
|---|---|
| `main/dist/index.html` | `dd60733ce199319861c6e6a1a6a17836d082956ec930c06b32ccd0cca9fb6a8e` |
| `main/dist/assets/index-D6fwfFv7.js` | `c35941dd34b59baabb5e6f1a5357d59c52d226843e64d43221d4dce023c1fbd9` |
| `main/dist/assets/SpaceStationSandbox-BaNbw8AM.js` | `63ca0291963646968e13318835e19de4b1fd499f4eeddf6521debc6f736475d5` |
| `main/dist/assets/worldPrep.worker-D9jfWRDd.js` | `5c34b2579d4869bbb97ca0d692cf14c2ed050c8983dce442c1ffcca1676bd0de` |
| canonical buildHash (11 dist files, sorted `path\0sha\n`) | `b308b2f0a23ce7b9d3c8cb154e0ced3bb6a512a585629b277e90029297c95284` |

Entry bundle is **`index-D6fwfFv7.js`**. The retired preview at `45091` served
`index-Bquz6XRz.js`. That filename difference is the fastest discriminator
between the old snapshot and this one, and I will check it (not just HTTP 200,
and not just `<title>Paravoxia</title>`) before trusting any measurement.

**Source re-hashed AFTER the build: 97/97 identical, 0 drift.** The build did
not mutate source.

## BUILD READY

Root may now replace the old immutable `45091` preview and publish ownership
for this build. I start no server and will not measure until
`verifier/artifacts/preview-ownership.json` reports `state: running` with THIS
build's identity.

**Required ownership fields before I measure anything:**
- served entry bundle `assets/index-D6fwfFv7.js`
  sha256 `c35941dd34b59baabb5e6f1a5357d59c52d226843e64d43221d4dce023c1fbd9`
- served `index.html` sha256 `dd60733c…9fb6a8e`
- `<title>Paravoxia</title>`
- sourceManifest `d9e36ae3…96caf2`

Ports: not 5174 (Paraform), no Vite dev (ENOSPC). Root-owned preview only.

## What is measured and what is NOT

Measured: static gates, type safety, 3091 unit tests, a clean production build,
and exact source/build identity.

NOT measured — unchanged and still entirely open: gameplay, rendering, actual
footing/support at S, home AV install, real WorldSave Continue, manual corner
recovery, hearing, hardware budgets, all 28 anchors, all 19 objective
lifecycles, and every chapter-acceptance claim. **Passing verify is not
evidence that either retained blocker is fixed.** The engineer's added
regressions run on controlled test inputs, not physically earned browser play,
and I have not yet opened a browser on this source.

## Next (in order)

1. Bounded run-local harness corrections required by
   `producer-harness-final-review.json`, offline-tested: (a) refuse ANY
   existing nonempty output folder before snapshot/trace writes, including
   legacy folders with no manifest; (b) actual post-`finally` cleanup receipt,
   separate from the pre-cleanup `summary.cleanup`. Pre-edit bytes already
   archived at `verifier/artifacts/world-final-harness-archive/pre-edit-2026-09-06T1230Z.sha256`.
2. Wait for root-owned preview ownership with the exact identity above.
3. One short hardware smoke (headed Chromium, ANGLE, assertHardwareGl, under
   the shared `flock`) exercising the corrected harness interface — no browser
   proof of the new harness exists yet.
4. Then the EARLY ACTUAL TESTS 1–5 before any long repeat.

---

# PHASE W4-B — HARNESS CORRECTION + HARDWARE SMOKE ON THE NEW PREVIEW

Written 2026-09-06T12:47Z. **Supersedes the "waiting for preview" state of
phase W4-A above: the preview is live and I have already captured on it.**

## Live preview identity — independently re-verified by me, not taken on trust

Canonical URL **http://127.0.0.1:40131/** (root exec 30867, daemon pid 1015147).
Root replaced the old `45091`. I fetched and compared bytes myself:

| Check | Result |
|---|---|
| HTTP | 200 |
| `<title>Paravoxia</title>` | present |
| served `index.html` sha256 | `dd60733ce199319861c6e6a1a6a17836d082956ec930c06b32ccd0cca9fb6a8e` — matches my build |
| served bundle | `assets/index-D6fwfFv7.js` sha256 `c35941dd34b59baabb5e6f1a5357d59c52d226843e64d43221d4dce023c1fbd9` — matches my build |
| `cmp` against my `main/dist` | index.html and bundle both **BYTE-IDENTICAL** |
| ownership `sourceManifestSha256` | `d9e36ae3…96caf2` — the signed manifest |
| ownership `verifierBuildHash` | `b308b2f0…c95284` — equals the canonical build hash I computed independently |

This is exact ownership, not merely HTTP 200. I started no server.

## Root-commissioned run-local harness corrections (offline-tested, then proven on hardware)

Pre-edit bytes archived first:
`verifier/artifacts/world-final-harness-archive/pre-edit-2026-09-06T1230Z.sha256`.

1. **Capture-folder freshness guard.** `writeSourceSnapshot` refused only an
   existing snapshot MANIFEST. Every capture folder written before that feature
   — all retained failure evidence, including `final/survey-movie` — has no
   manifest, so a re-used `--out` could still have truncated its `trace.ndjson`
   and overwritten its summary and PNGs. New `assertFreshOutputDir` refuses ANY
   existing nonempty folder, before `mkdir` and before any write, and never
   deletes or edits what it refuses.
2. **Post-`finally` cleanup receipt.** `summary.cleanup` is read inside the
   `try`, so its `sessionStopped:false` was a PRE-cleanup value. The pre-cleanup
   record is now explicitly labelled (`phase:'pre-finally'`,
   `isFinalCleanupOutcome:false`) and the ACTUAL outcome is written after the
   `finally` to `<outDir>/cleanup-receipt.json`, including the failure paths.

Offline gate: **41/41** in `cg-harness-prep-selftest` (was 26/26; +15 new C/D
checks), plus `cg-harness-selftest` **25/25** re-confirmed and both probe
`--self-test` gates green. Non-vacuity proven by two reverted mutations:
permissive guard → C3/C5/C6/C7/C8 fail (36/41); receipt always "stopped" → D3
fails (40/41). Both libraries restored byte-identical, gate back to 41/41.

## DEFECT FOUND AND CORRECTED IN MY OWN HARNESS — sampler mismatch, not a missing game hook

The first smoke reported `cgDiag=UNAVAILABLE` and
`"no candidate CommonGround diagnostic hook is exposed on window"`. **That was
false, and it was my harness's fault.**

- Shipped surface (`StoryDirectorDriver.tsx:137`, gated on
  `?journeyprobe=1|chapterjourney=1|debug=1`) is
  `window.__paravoxiaCommonGround = { snapshot }`.
- `CG_DIAGNOSTIC_HOOKS` was written while the name was undecided and probed
  only `.diagnostic()` and `.scoreDiagnostic()` — **neither exists in the
  build**. `.snapshot()` was never called.
- Direct read-only interface recheck on the live preview
  (`verifier/probes/scratch/hook-recheck.mjs`) proved it:
  `nsPresent:true`, `snapshot()` returns
  `bodyCentre/bodyPose/up/groundOffsetUnits/supported/worldBound/rail/railCursor/score/diagnostic/pendingAnchors`,
  while `diagnosticMember:false` and `scoreDiagnosticMember:false`.

This is exactly the failure class root flagged (markerCount 0 while frames
showed the label). Preparation had no browser proof, so it shipped untested.
Corrections: `.snapshot()` added as the FIRST allow-list candidate;
`progressSignature` now reads both the bare-diagnostic and the
snapshot-nested (`diagnostic.…`) levels and records which it used; score is
derived from `snapshot().score` when no standalone score hook answers; and
`resolvedPoseSource` / `poseSourceAvailability` are recorded separately from
the boot sample.

**Consequence for earlier evidence:** every capture before this correction —
including all prior-source survey/common runs — observed CG phase, rail, hold,
`supported` and grounded pose as UNAVAILABLE *by harness defect* unless it
passed an explicit `--cg-diag-hook`. Those runs' physical-state gaps must be
read as unmeasured-by-harness, not as absent runtime state. No prior capture
has been altered.

## Hardware smoke — real GPU, corrected harness

| Capture | Renderer | Result |
|---|---|---|
| `captures/world-final/smoke-home` | ANGLE (NVIDIA GB10/PCIe, OpenGL 4.5.0), headed, `hardware-high` | 45.1 s, 26 frames, 0 page errors, cleanup receipt `stopped` |
| `captures/world-final/smoke-home-v2` | same | hook resolves: `available:true`, `hookUsed: window.__paravoxiaCommonGround.snapshot()`, score `…snapshot().score` |
| `captures/world-final/smoke-home-v3` | same | `pose-source RESOLVED at 490 ms` |

**Renderer is real hardware.** No software fallback was used or claimed.

Full-precision physical pose is now actually observed: 315/316 samples carried
the hook; unavailable only at the 16 ms boot sample. Sample at 947 ms gave
`bodyCentre [10.5, 51.85, -7.999999999999999]`, `bodyPose [10.5, 50.05, -8.0]`
— full precision, correct frame, from the chapter's own predicate source.

## NEW OBSERVATION bearing on the retained VF3-AVHOME-1 blocker (home AV history empty)

On the previous source the AV `anchorLedger` was empty and home anchors were
null. On THIS source, in movie lane, the ledger populates in order:

`anc.cg.home-steady` (seq 1, 1656 ms) → `anc.cg.fault-reviewed` (seq 2, 2240 ms)
→ `anc.cg.hatch-boarded` (seq 4) → `anc.cg.lift-committed` (seq 5)

and the live CG diagnostic `anchors` array reads
`[home-steady, fault-reviewed, return-chosen, hatch-boarded, lift-committed]`.

**Strict limits on that observation.** This is a `?story=ch13-home` deep-link
fixture in MOVIE lane that ran the whole beat in ~4.5 s. It shows the signed-AV
activation path is no longer silent at home. It does **NOT** establish: the
real station→built/restored-home continuous journey, live install ACK
(`installWatch:"unknown"`, `pendingAnchors:[]`), actual restored-core
visibility, manual-lane behaviour, or anything heard. `score.mood` read `null`
at ch13-return. VF3-AVHOME-1 is **not** closed by this; it is a partial,
favourable, fixture-scoped signal.

VF3-FOOTING-1 remains **entirely unretested** at this point.

## Correction to a stall-classification trap (root's note, independently retained)

The first smoke's ~39.5 s window of an unchanging player body is NOT a stall:
the last trace sample has `spaceFlight` phase `descent`, `controlMode flight`,
location `atmosphere`, pos `[2056,-56,-1569]`, speed `88.11`. The body is a
seated capsule inside a moving ship, and legacy `autopilot.routeAction` still
read `walk`. Travel stalls must be judged on system/flight motion and the
executed rail action, never on the frozen capsule.

## Artifacts

- Full verify log: `verifier/logs/world-final/verify-world-final.log` (EXIT=0)
- Offline gate: `verifier/logs/world-final/harness-prep-selftest.json` (41/41)
- Harness versions: `verifier/artifacts/world-final-harness-archive/`
  (`pre-edit`, `v2`, `v3`, each with a sha256 manifest — v3 is what runs now)
- Captures: `verifier/captures/world-final/{smoke-home,smoke-home-v2,smoke-home-v3}`

## Next

Survey start/route and the partial-Continue tests (EARLY ACTUAL TESTS 2–4) on
the corrected harness, then the manual corner. No long repeats until the normal
route actually works.

---

# PHASE W4-C — EARLY ACTUAL TESTS: SURVEY FOOTING RETESTED, NEW BLOCKER FOUND

Written 2026-09-06T13:10Z. Preview **http://127.0.0.1:40131/** (live, identity
re-verified by me). Renderer: **ANGLE / NVIDIA GB10 / OpenGL 4.5.0, headed,
hardware — no software fallback.** Source frozen throughout; I patched nothing.

## EARLY TEST 2 — survey boots on foot, walks to S, records real samples: **PASSES**

`VF3-FOOTING-1 is repaired`, measured at the exact site that previously failed.

| | prior source `51b25376` | this source `d9e36ae3` |
|---|---|---|
| `supported` at the survey site | **false** | **true** |
| `worldBound` | true | true |
| survey phase after 150 s | `idle` / `awaiting-start` | `drawing` |
| recorded samples | **0** (after 200 real F attempts) | **4**, then 32 once moving |
| anchors | none | `repeated-measure` → `demonstration-opened` → `survey-started` |
| `score.mood` | — | `unreconciled` |

Grounded pose `[-26.0375, 50.98897, 13.8336]`, `groundOffsetUnits 1.8`,
`up` ≈ +Y. Physical standing pose 50.989 against authored 51.05 is the expected
legitimate offset. Evidence: `verifier/captures/world-final/survey-1`, `survey-2`.

**Scope limit:** proven for the approach and the vertices actually walked. The
remaining signed route columns, boundary holes, placed blocks, water, lava and
interior ceilings were NOT exercised. This is not full-route physical proof.

## NEW BLOCKER — `VF4-SURVEY-STALL-1`: the demonstration walk freezes at rail vertex 1

Reproduced **2 of 2 runs**, deterministically, at the same vertex.

- Objective `ch13:survey:draw`, marker "Survey end · demonstrate a route",
  anchor `anc.cg.survey-started`.
- Rail keeps publishing `action:"walk"`, target `[-26, 51.05, 14.6]`,
  `arriveRadius 0.35`, `railCursor 1`, reason "walking the demonstrated route".
- `supported:true`, `worldBound:true`, `holdReason:null`.
- Body coordinates **bit-identical for 131.8 s**:
  `[-26.0374755859375, 52.78897476196289, 13.833585739135742]`. Displacement 0.
- Beat tick is alive: autopilot clock advances 16.3 s → 145.2 s.
- Opt-in bounded stall predicate (true CG rail phase `walk`, 30 s) fired at
  30041 ms, `playerMovedUnitsInWindow: 0`, probe exit 3. **No rescue attempted.**

This is NOT the retired unsupported-footing defect (supported is true) and NOT
the seated-capsule travel artefact (`spaceFlight` is `surface`/`fps`, on foot).

### Discriminator: collision, or no controls? — **no controls**

Bounded probe `verifier/probes/scratch/stall-discriminator.mjs`, ordinary
shipped movement keys only (no teleport, grant, predicate change or progress
setter; not counted as journey progress):

| trial | displacement | rail cursor | samples | walked |
|---|---|---|---|---|
| no input, 8 s | **0.0009** | 1 | 4 | 2.336 |
| `W` held 1.2 s | **4.339** | 1 → 4 | 4 → 11 | → 8.413 |
| `S` held 1.2 s | 0.005 | 4 | 11 | → 8.622 |
| `A` held 1.2 s | **6.197** | 4 → 8 | 11 → 20 | → 16.497 |
| `D` held 1.2 s | **6.151** | 8 → 12 | 20 → 28 | → 23.306 |
| idle 10 s after input | — | 12 → **13** | 28 → 32 | → 27.243 |

**The body moves freely and the ground supports it.** After the nudge the rail
*resumed autonomously* and kept advancing with no further keys. So the stall is
the navigator issuing no directional controls in a specific terminal-cell
condition — not collision, not missing ground.

Both measured freeze poses sit inside a 0.2 radius of the snapped voxel centre
`(-26, 14)` — 0.1706 in survey-1, 0.1485 in the discriminator — while the signed
rail target `(-26, 14.6)` stays beyond `arriveRadius 0.35`. That is consistent
with root's `primitives.ts nextNavigationStep` / `steerFreeToward` deadzone
candidate (tangent sq. distance < .04). **I did not read the navigator's
resolved waypoint at runtime, so the snapped endpoint remains an inference, not
an observed navWaypoint claim, and I changed nothing.**

**Impact:** in movie lane the survey cannot self-complete, so `ch13-common` is
unreachable without a rescue. The commissioned full-story movie with zero
timeout rescues is blocked at this beat.

## EARLY TEST 1 — home: partial, favourable, NOT closed

Home AV anchors now populate in order (`home-steady` 1656 ms →
`fault-reviewed` 2240 ms → `hatch-boarded` → `lift-committed`); the CG
diagnostic also lists `return-chosen`. On the prior source the ledger held only
hatch/lift. **But** this is a `?story=ch13-home` movie-lane deep-link fixture
that ran the beat in ~4.5 s. It does not establish the continuous
station→built/restored-home journey, live install ACK (`installWatch:"unknown"`,
`pendingAnchors:[]`), actual restored-core visibility, manual lane, or anything
heard. `VF3-AVHOME-1` stays open. **Nothing was heard in this phase at all.**

## Second harness sampler gap found — markers

`markerCount` sampled **0** for the whole survey run while `markerLabel` was
correct and frame `survey-1/0009-after-anchor-anc.cg.survey-started.png`
plainly renders the world marker reading "survey end · demonstrate a route –
15m". This is a **sampler mismatch, not a missing marker**. Marker parity for
the 28 anchors is therefore **UNMEASURED, not failed**. I did not correct this
one, because it does not block the current blocker's diagnosis.

Frame check on that image: scene renders correctly (terrain, foliage, fauna,
water), HUD objective block and work order are present and legible, no blank or
black frame, no era pop. The heavy debug panels are induced by my own
`?debug=1` and are not a game defect.

## EARLY TESTS 3, 4, 5 — NOT REACHED

Full fixed route through all vertices, the valid partial Continue through a real
WorldSave/actor/world/lifecycle, and the manual corner early-turn/recovery are
all **blocked** by `VF4-SURVEY-STALL-1`. Nothing about them is claimed. Source
unit proof is not manual usability acceptance.

## Deliverables written

- `verifier-findings.json` (rewritten for this source; prior preserved as
  `verifier-findings.prior-source-51b25376.json`)
- `verification-world-final-report.json`
- Captures: `verifier/captures/world-final/{smoke-home,smoke-home-v2,smoke-home-v3,survey-1,survey-2,stall-discriminator}`

**Status: BLOCKED.** Chapter verification is NOT complete and I make no
scorecard, signature or acceptance judgment. One bounded integration pass should
address `VF4-SURVEY-STALL-1`; it must reproduce the freeze before any fix and
must not relax arrival radius or route-credit predicates.
