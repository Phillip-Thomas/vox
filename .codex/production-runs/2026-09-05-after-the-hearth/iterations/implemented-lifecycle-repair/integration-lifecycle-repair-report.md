# Integration lifecycle repair — Common Ground (ch13)

Machine-readable twin: `integration-lifecycle-repair-report.json`. Diff:
`lifecycle-repair.diff`. Logs: `evidence/integration-lifecycle-repair/`.

- Role: the single integration engineer. **No browser, no GPU, no `npm run
  verify`, nothing rendered and nothing listened to.**
- Contract: scene-v2 `4dbf722b…fddff88e`, unchanged and re-signed by nobody.
- Direction: `lifecycle-repair-direction.json` — CG-IMPL-006/007/008 plus a
  reproduction of the recorded manual-corner risk.
- Starting source: the exact 96-file manifest, rehashed independently before any
  edit — **96/96 identical, 0 drift, 0 missing.**
- Result: `npm run test` **3068 passed** (baseline 3026, +42, −0), typecheck,
  build and eleven static gates all exit 0; `creative:gate --phase
  implementation` passes with 1708 checks.

**This proves no gameplay.** Every claim below is a source and test claim.

## CG-IMPL-007 — the chapter booted aboard the ship

**Cause, at the actual owner.** `storyState.initStoryFromSave` seeds
`?story=ch13-survey` and `?story=ch13-common` with
`bootstrapOriginLaunchDebug()`, whose last statement is
`restoreBoardedSurfaceFlight()` → `{phase:'surface', controlMode:'flight'}`.
That is exactly right for `ch8-launch` and `ch10-transit`, which *begin in the
cockpit*, and exactly wrong for two beats that begin after ch13-return has
already landed and disembarked. On-foot walk input does nothing in flight
control mode, which is the 243 seconds of measured zero displacement.
`commonGroundRailPlan`'s missing `exit-ship` branch was the inability to
recover — not the cause.

**Repair.** Seed those two beats on foot with the shipped
`restoreFlightAtLocation('surface')`, the same control-ownership restore the
landfall bootstrap already uses for its own disembarked state. It issues no exit
receipt, fires no ship-exit listener, grants no milestone, and leaves the landed
Kestrel parked to be boarded again by the ordinary interaction. Direct entry,
Continue (which already declines to transfer cockpit ownership) and the
continuous return now agree on the same physical mode.

Separately, and only as the screening's own recovery, the rail reports
`exit-ship` if it ever finds itself holding surface flight controls inside these
two beats, through the same `ctx.exitShip()` the ch13-return branch uses. It is
**not** a per-frame auto-disembark: it is reachable only by the screening rail,
only in those two beats, and only while the ship is parked on the surface. A
player's own boarding during free movement is untouched, and `ch13-return` is
asserted unchanged.

## CG-IMPL-006 — one coordinate frame, and it was wider than the rail

**Cause.** `commonGroundDirector.player()` returned `getPlayerWorldPosition()`
raw. That is the Rapier capsule **centre** (`CapsuleCollider [half 1.3, radius
0.5]`); every ch13 pose, route, socket, occupancy cylinder and footing column is
a **grounded body origin**. The offset is 1.8 units along the *local* up — this
is a cube-gravity world, so "down" is not `−Y` on five of six faces.

The verifier measured the rail's arrival gate. Reading the source, the seam was
larger than that:

- `CommonGroundWorld.createFooting` samples `cell(y − 1.05)`. A centre 1.8 above
  the ground column samples the **empty** cell above it, so `isSupported` was
  false — which silently refused the survey start, every trace sample, every
  witness offer and the far-reference offer, not only the rail's 0.35/0.70 gates.
- `walkToward` measures `surfaceGaitDistance` — tangential range, because the
  1.8-unit drop is well inside `GAIT_STEP_DOWN 3.4`. The shared walker was
  stopping on *horizontal* distance while the director judged full 3D from 1.8
  units up. The two frames disagreed by exactly the capsule.

**Repair.** One conversion at the chapter boundary: `commonGroundPlayerPose()`
subtracts `PLAYER_CAPSULE_HALF_HEIGHT + PLAYER_CAPSULE_RADIUS` along
`getPlayerUp()`, both read from the protected physics modules. Route recording,
supported ground, reference sockets, occupancy, body clearance, controller
arrival and progress then all read the pose semantics they were authored for.
**No radius was widened, no vertical term dropped, no `y` clamped, no ground
faked, no proof granted, and no protected file edited.**

**Why 3026 tests could not see it, and now can.** `standAt()` wrote the authored
`y` straight into the body — a body of zero height, vertical offset 0. It now
places a real capsule centre along the live up, and the rail harness's walker
uses the **real** `surfaceGaitDistance` and keeps the body resting on the ground
plane instead of lerping it onto the mark in three dimensions. With `player()`
mutated back to the raw centre, **24 previously passing tests fail** alongside
the new ones — the survey start, the reciprocal passage, the completion texture
and all four movie-rail traversals.

New physical regressions place the exact hardware body (centre 52.79 over an
authored plane of 51.05, feet within 0.06) against the **real voxel-column
footing rule**, and cover: the constants and the live up; another cube face; the
zero-height body refused; a jumping body refused and then succeeding on landing;
a far-reference offer refused to a hovering body; gait/rail agreement; and the
long survey walked to a real `F` on the mark.

## CG-IMPL-008 — three faults, all of them about what an anchor is

1. **Eligibility.** `activateAnchor` treated every ch13 anchor as a mandatory
   ordered prerequisite. `anc.cg.cell-installed` is signed as the *live install
   receipt* and its acceptance says a hydrated entry is steady and silent — so a
   restored save or a valid deep link cannot produce it, and home-steady,
   fault-reviewed and return-chosen were refused forever behind it. The same
   error would have refused `anc.cg.route-tested` and `anc.cg.complete` whenever
   one of the eight signed *"Contingent:"* anchors did not occur, which the
   contract explicitly permits ("any supported route … may complete without this
   anchor"; "first-try success is legal").
2. **The latch.** `noteAnchor` added to `runtime.firedAnchors` *before* calling
   `activateSignedSceneAnchorById` and discarded its boolean.
3. **The seam order.** The shared director calls `enterCommonGroundBeat(beat)`
   **before** `enterSignedSceneAvBeat(beat)`, so the entry anchor is always
   offered to a rail still on the previous beat and always refused. With (2),
   that is why `anc.cg.home-steady` could never activate on *any* path.

**Repair.** A documented `CONDITIONAL_ANCHORS` set, each id carrying its contract
citation, is exempt from being a **prerequisite** for later anchors — and nothing
else is removed: the monotonic order guard, the one-shot latch, beat membership
and the required chain all stand, and a required anchor whose ordered
predecessor has not happened is still refused (asserted). A refused activation is
no longer spent: it is retried **once**, on the next frame of the same beat,
through the same call with the same rules. The install receipt is published at
the install boundary, which is causally before the beat seam publishes the steady
entry, so signed order 0-then-1 is the order the rail sees.

**Mid-beat Continue (root's late concern, reproduced).** A beat entry clears
`activatedAnchorIds`, which is right — but "not in this ledger" is not "has not
happened". A Continue that already holds `story:ch13-fault-reviewed` and then
performs a **new** return-choice `F` had `anc.cg.return-chosen` refused, because
the review looked pending in this runtime while correctly never being replayed.
A `RECEIPT_SATISFIED_ANCHORS` map now answers only *"has this already
happened?"* for **predecessors**: an anchor whose own committed milestone is
held, or which is implied by a later milestone in its legal transaction chain
(the Origin landing implies the boarding and the lift; an accepted tested route
implies the inspection, the offer, the grounded start, the trace and the span;
her eighteen-unit crossing implies he reached and held H; completion implies her
far-reference offer and his own test), is not something later anchors wait for.
It **activates nothing, writes no activation history, replays no cue or shot and
manufactures no receipt**, and an anchor is never a prerequisite for itself.
With no receipts at all the required chain is unchanged and out-of-order
activation is still refused — both asserted, at the AV level and through the
chapter.

**The retry cannot become a deferral.** One retry only; a second refusal is a
refusal and is dropped. It is cleared on beat change, run change, reset, chapter
release and every `suspendCommonGroundPresentation` reason (pause,
visibility-loss, exit, reset, world-change, actor-change), and it is scoped to
the current run/actor/world. The audio eligibility authorities are untouched:
the mood, the completion texture and their cancellations are decided by
`noteAnchor` at the instant of the fact, never by whether the rail accepted the
anchor. A test asserts that an acknowledgement refused before a pause is *not*
published after it.

Every anchor regression drives the **real** `signedSceneAvRuntime` in the shared
director's real seam order and reads its own activation history. No spy, no
always-success mock.

## The manual-corner risk — reproduced, and **no source change made**

Reproduced from real per-frame displacement at walking pace: turning at z 15.82,
0.18 units before the vertex at z 16, then walking every remaining leg gives
**17.83 units walked, 4.000 credited**. Wiggling at the far end and a 30-unit
unrelated loop both credit nothing further. The recorded risk is real.

**It is a lock only for a body that never goes back.** Walking back along the
route to the frontier it actually reached and re-traversing forward credits
**exactly 18.0000** — ordinary movement, no reset, no second `F`, no new marker
and no precision ritual, with the four units earned before the deviation
retained throughout and walking back earning nothing beyond the frontier it
returns to. The source already supports an honest recovery, so per the Chapter
interpretation I have retained it and documented the evidence rather than
inventing a defect.

**A bounded correction was built, measured and removed.** Letting the frontier
creep toward the body's own closest-point projection at walking pace (bounded by
a 0.6-unit deviation allowance) restored the cut passage to 17.69 and completed
it at 18 after 0.8 further units. It was removed because it pays for the omitted
wedge with displacement spent *anywhere* in the corridor — including a wiggle at
the far end — which the Chapter interpretation forbids and which root ruled out
explicitly. `commonGroundRoute.ts` therefore differs from the frozen source **in
comments only**, verified by a comment-stripped diff.

**The exact conflict, for root and Chapter.** Making the recovery cheaper than a
full re-walk requires letting real in-corridor distance stand in for ground that
was not crossed. The current behaviour satisfies every signed proof rule; its
cost is that a 0.18-unit steering error means walking roughly 48 units for an
18-unit span. Whether that cost is acceptable is a creative question needing
manual browser observation, and it is reported rather than decided here.

Adversarial cases exercised: stationary at the far end, the corner cut, the
far-end wiggle, backtrack-and-re-approach, an unrelated 30-unit loop, a parallel
leg two units away, Continue with a restored scalar and the body elsewhere, and
the exactly walked clean route.

### CG-IMPL-009 — Chapter's disposition on the withdrawn candidate

Chapter registered **CG-IMPL-009** against the inspected candidate
(`commonGroundRoute.ts` `d7e5bbc3…`, the 0.6-unit allowance) and objected on a
static source counterexample: at C with 17.6915 credited, lateral movement of
0.075 keeps the nearest arc at 18 and the lag under the allowance, and pays off
the remaining 0.3085 **without ever returning to the omitted corner**. Chapter
also observed that my recovery test only revisited the final leg. **Both points
are correct and I accept them** — my endpoint-pumping case started from a 6-unit
shortcut and so never covered the small outstanding lag.

Chapter's disposition states the correction *may withdraw the allowance if the
original return-to-frontier behaviour already satisfies intent*. It does, and the
withdrawal had already been made: `commonGroundRoute.ts` is at `6025bc4c…`,
byte-identical to the frozen `afab445a…` after comment stripping. No contract
amendment, no proof relaxation, no debt payment for omitted ground. Manual
browser usability remains unmeasured and may still need Chapter judgement.

## Observability — read-only, query-gated, no boundary request needed

`window.__paravoxiaCommonGround.snapshot()`, installed by
`StoryDirectorDriver.tsx` (an already-allowed owner) **only** under
`?journeyprobe=1`, `?chapterjourney=1` or `?debug=1`, and removed on unmount.
It returns copies of state this chapter already computes:

| field | meaning |
| --- | --- |
| `beat` | the chapter beat, or null |
| `bodyCentre` | raw Rapier capsule centre |
| `bodyPose` | the grounded body origin every ch13 predicate uses |
| `up` | the live local up used for that conversion |
| `groundOffsetUnits` | 1.8 |
| `supported` | the mounted world's footing at `bodyPose` |
| `worldBound` | whether the chapter world is mounted |
| `rail` | a **copy of the last plan the rail actually executed**, or null |
| `railCursor` | the screening controller's ordered cursor index, or null |
| `score` | `{beat, mood, finalTextureSeconds}` from the pure score diagnostic |
| `diagnostic` | `getCommonGroundDiagnostic()` |
| `pendingAnchors` | refused activations awaiting their single retry |

**Observer effect, found by root and repaired before any capture.** The first
version called `commonGroundRailPlan()`, which advances `runtime.railTraversal`
— so a read would have *stepped the controller it was meant to watch*, and in
manual play would have run a controller nobody started. The snapshot no longer
calls the planner at all: `applyCommonGroundRail` records a copy of the plan it
actually executed, and the probe reports that, or `null` when no rail has
published one. A regression asserts a hundred reads leave the cursor, the
diagnostic, the body, the reported plan and every milestone identical, and that
a read before any rail has run reports `null` rather than inventing a plan;
reinstating the planner call under a counterfactual fails it. No runtime failure
is claimed — root caught this statically.

No setter, no handle, no mutable reference, no preparation and no grant; nested
plan targets are copied, and a test asserts mutating the returned object changes
nothing. **`JourneyRuntimeProbeBridge.tsx` was not touched, so no boundary
request was required.** Exposing state is not evidence of rendering, traversal or
hearing.

## Preservation incident — reported, not hidden

During a mutation check I ran `git checkout -- src/story/storyState.ts` to undo
a counterfactual. The worktree is deliberately dirty, so that did not restore my
baseline — it restored the file to Git HEAD and discarded the run's prior
implementation of it. I restored it byte-for-byte from the root-preserved
immutable snapshot (`iterations/lifecycle-verification-findings/source/…`,
sha256 `7d66ff3e…d70d535`, matching the frozen manifest exactly), rehashed all 96
files to confirm only my three intended files differed, then re-applied and
re-tested the repair. Blast radius: one file, fully recovered; no unrelated dirty
work was lost.

The chronology of the cleanup, precisely, because the earlier draft of this
report overstated it: the **two counterfactuals immediately after** the incident
still used ad-hoc `cp` backups under `/tmp` with shell-semicolon restore — byte
backups rather than Git, but interruptible and in a shared temp directory on a
machine running concurrent sessions. **After root's harness-hygiene note**, the
later counterfactuals used a task-specific helper inside this run,
`evidence/integration-lifecycle-repair/temp/counterfactual.py`, which saves the
current bytes, mutates, runs and restores in a `finally` block with a rehash
assertion and reports the mutation's exit status separately from the restore. No
Git checkout/reset/restore has been used for a counterfactual since the
incident; I record what was used and when rather than offering an unbounded
guarantee.

## What is NOT claimed

- No browser, GPU, preview, `npm run verify`, render, hearing or movie result.
- The live install → reactivate → enter → home-steady ordering is a source and
  test claim only; it has not been observed on hardware.
- The manual-corner usability cost is unmeasured in a browser and undecided.
- Three cold journeys, the continuous station→home→ch13 bridge, the full story
  movie, the 28 anchors as a set, the reset matrix, mobile / reduced-motion /
  lowest tier and every performance figure remain unmeasured.
- **No chapter completion is claimed and no publication is authorized.**
