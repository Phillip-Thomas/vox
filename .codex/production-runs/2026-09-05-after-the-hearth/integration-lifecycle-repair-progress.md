# Integration lifecycle repair — progress

Role: single integration engineer. Contract scene-v2
`4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e` (preserved,
not re-signed). Direction: `lifecycle-repair-direction.json` (CG-IMPL-006/007/008)
plus the recorded manual-corner risk. No publication, no browser/GPU in this role.

## Phase 0 — boundary and preservation (done)

- Read `production-lock.json` (allowedPaths / protectedPaths / bounded-runtime),
  `scene-contract.json` signatures + `contract-gate-pass.json`,
  `lifecycle-repair-direction.json`, `repair-contract-disposition.json`,
  `verification-lifecycle-interim-report.{json,md}`, `verifier-findings.json`,
  `chapter-manual-corner-interpretation.md`,
  `score-home-anchor-eligibility-interpretation.md`,
  `producer-manual-corner-risk.json`, `integration-inbox.md` (tail).
- Rehashed the exact 96-file `implementation-source-manifest.json`:
  **96/96 identical, 0 drift, 0 missing.** Source is the frozen state the
  verifier measured; the initial dirty tree is preserved.
- Verifier invocation finished 10:23:03Z; no other writer is running.

## Phase 1 — causal diagnosis (done, source-read only)

### CG-IMPL-007 / VF-DEEPLINK-1 — boot causal owner FOUND
`main/src/story/storyState.ts#initStoryFromSave` seeds `?story=ch13-survey` and
`?story=ch13-common` with `bootstrapOriginLaunchDebug()`. That helper ends in
`restoreBoardedSurfaceFlight()` (`spaceFlight.ts:431`) → `{phase:'surface',
controlMode:'flight'}` — i.e. **seated in the landed Kestrel**, which is the
correct ch8-launch/ch10-transit staging and the wrong one for two on-foot beats.
It is the *seeding* owner, not `commonGroundRailPlan`: the rail's missing
`exit-ship` branch is a downstream inability to recover, not the cause.
Continue/continuous return already agree with on-foot (`restoreFlightAtLocation`
does not transfer cockpit ownership; ch13-return performs a real disembark).

### CG-IMPL-006 / VF-RAIL-2 — one coordinate frame, whole chapter
`commonGroundDirector.player()` returns `getPlayerWorldPosition()` raw. That is
the **Rapier capsule centre** (`CapsuleCollider [half 1.3, radius 0.5]`,
`EfficientPlayer.tsx:2078`); the chapter's authored poses are grounded body
origins at y 51.05. The offset is `HALF_HEIGHT + RADIUS = 1.8` along the live
local up. Consequences found beyond the rail gate the verifier measured:
- `CommonGroundWorld.createFooting` reads `cell(y - 1.05)`; a centre at 52.79
  samples the EMPTY cell above the ground column, so `isSupported` is false —
  `commitCommonGroundSurveyStart`, trace sampling, witness offers and the final
  reference offer are all unreachable, not only the rail's 0.35/0.70 gates.
- `walkToward` measures `surfaceGaitDistance` (tangential + unclimbed rise;
  `GAIT_STEP_DOWN 3.4` swallows the 1.8 drop), so the shared walker stops on
  HORIZONTAL distance while the director judged full 3D from 1.8 above. The two
  frames disagreed by exactly the capsule.
Fix direction: convert once, at the director's `player()` boundary, using the
real constants and `getPlayerUp()`; every downstream predicate (recording,
supported ground, sockets, occupancy, clearance, arrival, progress) then reads
the pose semantics it was authored for. No radius widening, no y-clamp, no
disabled vertical check.

### CG-IMPL-008 — two distinct wiring faults, plus a latent third
1. Ordering: `signedSceneAvRuntime.activateAnchor` treats every ch13 anchor as a
   mandatory ordered prerequisite. `anc.cg.cell-installed` (order 0) is signed as
   the LIVE install receipt and cannot exist on a hydrated/deep-linked entry, so
   home-steady/fault-reviewed/return-chosen are refused forever.
2. Latch: `noteAnchor` adds to `runtime.firedAnchors` BEFORE calling
   `activateSignedSceneAnchorById` and discards its boolean, so a refusal is
   spent locally and never retried.
3. Live-path order: `tickCommonGroundEntry` calls `reactivateStoryAtBeat` (which
   re-enters the beat and immediately requests home-steady, order 1) BEFORE
   requesting cell-installed (order 0) — so the one live acknowledgement is
   rejected by the monotonic guard on the live path too.
Latent (same root, downstream of the measured one): the eight signed
`Contingent:` anchors — and `anc.cg.revision-ready`, which the contract makes
voluntary in prose — are also treated as prerequisites, which would refuse
`anc.cg.route-tested` and `anc.cg.complete` whenever a contingency did not occur.

**Correction to item 3, recorded rather than rewritten.** Phase 1 read the live
path as publishing home-steady before the install receipt. Instrumenting it in
phase 2 showed the mechanism is different and simpler: `reactivateStoryAtBeat`
notifies `storyDirector.subscribeStory` SYNCHRONOUSLY, so the entire shared beat
seam — including `enterCommonGroundBeat` and then `enterSignedSceneAvBeat` —
runs inside that call, before `tickCommonGroundEntry` reaches its acknowledgement
line. The receipt therefore activates immediately and in order; the anchor that
was lost is `anc.cg.home-steady`, published by the chapter seam one call before
the AV rail arrives at the beat. That makes the causal order correct as shipped
and the LATCH (item 2) the thing to repair, which is what the final code does.

### Manual corner (recorded risk) — reproduction pending in phase 2

## Phase 2 — implementation (done)

### CG-IMPL-007 — repaired
`storyState.initStoryFromSave` now seeds ch13-survey/ch13-common on foot via the
shipped `restoreFlightAtLocation('surface')` (no exit receipt, no listener, no
milestone, ship still parked). The screening rail additionally reports
`exit-ship` if it ever holds surface flight controls in those two beats — rail
only, those beats only, ship-parked only. ch8-launch / ch10-transit / ch13-home /
ch13-return asserted unchanged.

### CG-IMPL-006 — repaired
`commonGroundPlayerPose()` converts the capsule centre to the grounded body
origin using `PLAYER_CAPSULE_HALF_HEIGHT + PLAYER_CAPSULE_RADIUS` along
`getPlayerUp()`. Test realism corrected: `standAt()` places a real capsule
centre; the rail harness walker uses the real `surfaceGaitDistance` and keeps
the body on the ground plane. Counterfactual: reverting `player()` fails 24
previously passing tests.

### CG-IMPL-008 — repaired
Conditional signed anchors (the live install receipt + the eight `Contingent:`
anchors + the voluntary revision readiness) are no longer prerequisites; order
guard, one-shot latch and required chain intact. A refused activation is retried
exactly once on the next frame of the same beat, cleared on every transition,
pause and reset — never a deferred acknowledgement. The install receipt is
published before the steady entry it causes.

### Manual corner — reproduced, NO source change
17.83 walked / 4.000 credited reproduced at walking pace. Honest recovery exists
(return to the frontier, re-traverse → exactly 18.0000); far-end wiggle and
unrelated loops credit nothing. The frontier-creep correction was built,
measured and removed because it pays for omitted ground with in-corridor
distance. `commonGroundRoute.ts` differs in comments only. The usability cost is
routed to root/Chapter.

### Observability hook published
`window.__paravoxiaCommonGround.snapshot()` — installed by
`StoryDirectorDriver.tsx` under `?journeyprobe=1` / `?chapterjourney=1` /
`?debug=1`; fields `beat, bodyCentre, bodyPose, up, groundOffsetUnits,
supported, worldBound, rail{action,target,interactionId,reason,arriveRadius},
diagnostic, pendingAnchors`. Read-only copies; no setter or handle; no boundary
request needed. The harness-prep role may consume this name and schema.

### Preservation incident
`git checkout -- src/story/storyState.ts` during one mutation check reverted the
file to HEAD in a dirty tree. Recovered byte-exactly from the root-preserved
snapshot (`7d66ff3e…`), all 96 files rehashed, repair re-applied. Later
counterfactuals use `evidence/integration-lifecycle-repair/temp/counterfactual.py`
(private byte backup, `finally` restore, rehash assertion). No Git
checkout/reset/restore again.

## Phase 3 — checks (all green)
`npm run test` 3062 (baseline 3026, +36, −0) · typecheck 0 · build 0 · scene AV,
story authority, chapter registry, chapter journey, creative workflow, story
ladder, guidance targets, story UX, preview, catalog all 0 · triad
implementation gate 0 / 1708 checks. Reports written:
`integration-lifecycle-repair-report.{json,md}`, `lifecycle-repair.diff`,
canonical `integration-report.{json,md}` updated. Nine changed files, all inside
`production-lock.allowedPaths`; 87 signed files untouched; no protected file
edited; no new source file created.

## Phase 4 — late inbox items (done)

- **CG-IMPL-009 (Chapter's corner disposition).** Chapter objected to the
  inspected `d7e5bbc3…` candidate with a static counterexample: lateral movement
  of 0.075 beside C keeps the nearest arc at 18 and the lag under the 0.6
  allowance, settling the remaining 0.3085 without returning to the omitted
  corner — and my recovery test only revisited the final leg. **Accepted in
  full.** Chapter names withdrawal as a valid route under the unchanged
  contract; the withdrawal was already in place, and `commonGroundRoute.ts`
  (`6025bc4c…`) is byte-identical to the frozen `afab445a…` after comment
  stripping. Named in both reports.
- **Probe observer effect (root's urgent note).** The first
  `getCommonGroundProbeSnapshot()` called `commonGroundRailPlan()`, which
  advances `runtime.railTraversal` — a read would have stepped the controller it
  was meant to watch. Repaired: `applyCommonGroundRail` records a copy of the
  plan it actually executed and the probe reports that, or `null`; nested target
  values are copied; `railCursor` is exposed read-only so a stalled walk can be
  told from a walked one. New regression asserts a hundred reads leave cursor,
  diagnostic, body, plan and milestones identical, and that a read before any
  rail has run reports `null`. Counterfactual (planner call reinstated) fails it.
- **Incident chronology corrected.** The report no longer claims all later
  counterfactuals used the `finally` helper: the two immediately after the
  incident used ad-hoc `/tmp` `cp` backups; the task-specific helper came after
  root's hygiene note. No unbounded "ever again" guarantee is offered.

**Final state.** 9 changed files, all inside `allowedPaths`; 87 signed files
untouched; no protected file edited; no new source file created; no stray
artefacts. `npm run test` 3063 (baseline 3026, +37, −0), typecheck 0, build 0,
ten static gates 0, triad implementation gate 0 / 1708 checks. Source is stable
and ready for root's fresh gate and manifest recompilation.

## Phase 5 — final late items (done)

- **Mid-beat Continue (producer-midbeat-anchor-restore-concern.json).**
  Reproduced with the real AV runtime and a valid chapter state: a Continue
  already holding `story:ch13-fault-reviewed`, then a new return-choice `F`, had
  `anc.cg.return-chosen` refused. Repaired with `RECEIPT_SATISFIED_ANCHORS` — a
  predecessor whose durable receipt is held (or is implied by a later receipt in
  its legal transaction chain) is not waited on. It activates nothing, writes no
  history, replays nothing, and an anchor is never its own prerequisite. Same
  shape asserted mid-common; the unearned chain is still refused, at both the AV
  and chapter level.
- **`score` field added to the probe snapshot** (`{beat, mood,
  finalTextureSeconds}` from the existing pure `getCommonGroundScoreDiagnostic`),
  as the harness preparer asked, behind the same query gate and with no observer
  effect. Root's `harness-prep-interface-resolution.json` confirms no
  `JourneyRuntimeProbeBridge` boundary is needed.

**Final.** `npm run test` **3068** (baseline 3026, +42, −0) · typecheck 0 ·
build 0 · ten static gates 0 · triad implementation gate 0 / 1708 checks.
Nine changed files, all allowed, none protected; 87 signed files untouched; no
new source file; no stray artefacts. Reports, diff and canonical report final.
