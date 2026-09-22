# Common Ground — integration report (final, combined)

One engineer, one chapter. This is the combined truth for the run: the
scene-v1 pass, archived intact in `iterations/implemented-scene-v1-before-v2/`,
plus the bounded scene-v2 continuation. Prior citations are retained.

Implemented against **`scene-v2`, SHA256 `4dbf722b…fddff88e`**, whose gate
receipt (`passed: true`, phase `contract`, 1668 checks, zero warnings or
failures) and three director signatures — chapter `approve-with-notes`, score
`approve`, cinematography `approve`, all on the same revision — were verified,
and whose live bytes were re-hashed, before the first edit. The archived v1
implementation was re-hashed against its own manifest first: **96 files, 0
drift.** Nothing was rebuilt.

## The blocking condition from the archived pass is resolved

The v1 report ended blocked: the frozen contract had been replaced in place with
an unsigned `scene-v2` while implementation was under way, and the runtime pins
were deliberately left on the revision three directors had actually signed. Five
contract-identity gates failed, correctly, as a result.

Root has since posted the signatures and the gate. The pins moved to the signed
bytes through the normal generators, and all five pass:
`chapter:registry:check` (4285), `chapter:registry:smoke`, `scene:av:check`
(104 anchors, `4dbf722b308b`), `story:authority` (1039),
`story:authority:smoke`.

## The four bounded items

**1 — the common-only guide, and the real glyph grammar.** The chapter's
mandatory eighteen-unit E→C comparison is now discoverable without previewing
anything she walked. `commonGroundCommonDisplay` returns `none`,
`planned-guide` or `tested-common`, and readiness is not a stage label: it is
`stage === 'holding-h'` **and** a real pose within a quarter unit of H, so a
snapshot claiming he is holding while his body stands two units away shows
nothing. The guide starts at his actual arrival, stays planned through Terra's
whole passage and through his own test — her scalar `terraUnits` never becomes
footsteps — and only `committed`, meaning his real final arrival after all
eighteen units with her reciprocal proof already held, promotes it to paired
tested geometry.

The trace grammar is now shape, because colour is not available evidence on the
lowest tier or in an unlit frame: one short bar along the actual recorded local
segment for a proposed sample, two parallel bars with a visible gap for a tested
one, and at a real hold the endpoint's **pair is replaced** by two transverse
half-bars around an open centre — never a third glyph. Corners bisect the
recorded incoming and outgoing segments and are clamped to genuine local
spacing. Two instances per sample is structural, so 2 × 128 × 2 is exactly the
existing 512 pool; the accepted survey and a working proposal draw together, and
the common display uses the **released working allocation** rather than asking
for a third one, which is what lets an optional repeat take it back without
losing an earned fact.

The whole matrix buffer is written and uploaded at mount with instances parked
at zero scale, so no verb frame first-uses an instance, and the layout is
recomputed only when a sample, a tested prefix, a real hold, the display state
or the live terrain revision has actually changed. The guide is grounded against
the same footing and solids the director's route queries use: it truncates at
the first genuinely unsupported segment and ends in the open transverse stop
rather than floating over an edited hole. No resource, route, save slot,
objective, anchor or cue was added.

**2 — the objective lifecycle and its exact copy.** `ch13:survey:test` carries
the neutral `W-7744 · offered route` label in both states under the one signed
id; the old `test in progress` asserted progress the preparing state does not
have. A body-clearance suspension **during the approach** now keeps the
preparing copy, exactly as the signed variant names it — "is walking" would be
false there, "is preparing to test" is still true — and it recovers when she
moves, with no new [F] and no proof. `ch13:common:reciprocal` enters at
`anc.cg.route-tested` in preparation and switches in place at his actual H
arrival to the holding/guide-line copy. The switch is silent: the same id is
republished through the existing seam, and the objective director's
`enteredIds` is what stops a second entry cue. C is the only marker throughout,
and neither transition produces a score event. The false capability line "a span
she already traced" is gone.

**3 — the Score Director's corrections.** `anc.cg.return-chosen` now releases
through `setScoreBeat(null)` **before** clearing the override; the other order
retunes the instrument to the beat's mood for a frame, which is an audible
reassertion of the texture being released. The hatch, the lift and the Origin
landing are no-ops — they keep their signed binding, but a cue reference has
never been an instruction to publish. Revision readiness, tail reopening, the
witness stepping out and back, and a body-clearance suspension all **retain
whatever variant is current**; same-mood de-duplication was not enough, because
a real refusal followed by revision-readiness would have published a convenient
`demonstrating`. Chapter 13 no longer feeds the generic anchor-index intensity
ladder, so its deliberately silent moments cannot become a rise. Completion
keeps one door at the real edge with output available; a mid-chapter Continue
can still earn its first completion, a restored one cannot, and the handback
cannot smuggle the mood in behind a refused token. The five seconds are now
**monotonic elapsed time**, independent of gameplay deltas, still ticking on the
inactive `done` frames after the handback — and availability is re-checked every
frame, so muting two seconds in cancels the token rather than leaving it running
silently. `main/src/audio/` is untouched.

**4 — bindings and the release gate.** ch13 is pinned to the signed v2 bytes in
the AV generator, its runtime mirror, the registry, the authority manifest and
the authority schema const, regenerated through the normal generators.
`production.release-gates` is back to **strict equality** between the active
lock's `openGateRefs` and the protected machine ladder, exactly as it read at
HEAD; the relaxed nonempty-list acceptance is gone. `EXPECTED_OPEN_RELEASE_GATES`
is byte-identical. Root corrected the lock to the nine exact names, so equality
holds without touching the ladder, and no other gate was weakened.

## Prior inbox fixes, rechecked

All hold, and each has a live regression: the walked segment uses the genuine
previous pose; Continue resumes a fractional survey leg, E→H and the final E→C
at the units actually walked; a transient hold never rewinds him; nothing
commits at 17.65 of 18; a missing world fails closed; a qualified witness pose
that is not the marked example is accepted. Two had **no coverage before** and
now do: the persistent local tester with its optional repeat after the real
handback, and the accepted route surviving that repeat untouched.

## Commands (exact, with exit codes and logs)

All from `main/`. Logs are under
`.codex/production-runs/2026-09-05-after-the-hearth/evidence/integration-v2/`.

| command | exit | result | log |
|---|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` | 0 | clean | `typecheck.log` |
| `npm run test` | 0 | 348 files / **3018** tests | `test.log` |
| `npm run build` | 0 | built in 5.83s | `build.log` |
| `npm run chapter:registry:generate` | 0 | 47 declarations; registry + journey generated | — |
| `node tools/generate-scene-av-runtime.mjs` | 0 | wrote `generatedSceneAvRuntime.json` | — |
| `npm run chapter:registry:check` | 0 | match; 4285 checks | `chapter-registry-check.log` |
| `npm run chapter:registry:smoke` | 0 | 4285 live; 25 invalid rejected | `chapter-registry-smoke.log` |
| `npm run chapter:journey:check` | 0 | 0 issues | `chapter-journey-check.log` |
| `npm run scene:av:check` | 0 | 104 anchors, `4dbf722b308b`, current | `scene-av-check.log` |
| `npm run story:authority` | 0 | 1039 checks | `story-authority.log` |
| `npm run story:authority:smoke` | 0 | 1039 + release-gate drift rejection | `story-authority-smoke.log` |
| `npm run creative:smoke` | 0 | 1727 checks | `creative-smoke.log` |
| `npm run creative:workflow:check` | 0 | 185 checks | `creative-workflow-check.log` |
| `npm run guidance:target-check` | 0 | pass | `guidance-target-check.log` |
| `npm run story:ladder:check` | 0 | pass | `story-ladder-check.log` |
| `npm run preview:check` | 0 | pass | `preview-check.log` |
| `npm run catalog:check` | 0 | pass | `catalog-check.log` |
| focused: `npx vitest run src/story/commonGround src/story/emergentStoryDirector.test.ts src/story/beats src/story/storyState.test.ts src/game/systems/persistence.test.ts src/story/world` | 0 | 19 files / 344 tests | `focused-tests.log` |

**The pre-v2 suite (2972 tests), typecheck and build passed before this
continuation and are not offered as proof of the v2 work.** The delta is 46
tests, of which 27 are the new scene-v2 regressions. Each new behavioural
assertion was mutation-checked: breaking the same-id republish, the retention
set, the release ordering, the handback guard, the continuous availability
check, or the accepted-slot preservation each makes exactly the intended test
fail. Every mutated file was restored and re-verified byte-identical.

## Boundary

Twenty files changed, all inside `production-lock.json#/allowedPaths`, none
protected. **No new missing path was needed, and nothing was edited before being
reported.** No `git reset`, `stash`, `checkout`, commit or push was run; all 322
dirty and untracked worktree entries are preserved; no root gate, checkpoint,
lock or inbox artifact was touched. `publishAllowed` remains false and the
release ceiling remains `ch4-arrival`.

## What this is not

**Implemented means source, tests and bindings. It does not mean accepted.**

- **Not independently verified.** `npm run verify`, the visual gate and every
  headed probe belong to the story-verifier. None was run; no GPU or browser was
  started.
- **Not rendered.** The guide, the three glyph shapes and the paired completed
  comparison have never been drawn. Shape-carries-state is asserted by geometry
  tests — counts, orientations, separations — not by a camera. Night, mobile,
  reduced-motion and lowest-tier readability are unverified.
- **Not measured.** No draw call, shader program, GPU storage or frame time was
  recorded. The 512 ceiling is an arithmetic bound over the real layout
  functions, not a cost measurement.
- **Not listened to.** Nothing was heard. The monotonic deadline, the retention
  set, the release ordering and the single completion door are unit results over
  the existing facade.
- **Not played.** No manual first-time traversal exists, so whether a player
  actually discovers and follows the guide without private route knowledge —
  the acceptance Chapter explicitly reserved — is unverified. No cold journey,
  movie run, screenshot or player-experience report was produced.
- **Not hardware-accepted.** The cold high/lowest-tier handback and FPS
  non-regression Cinema requires are outstanding.
- The directors signed the **contract**, not this implementation. Both repair
  directions say so explicitly. CG-IMPL-001, CG-IMPL-002 and CG-IMPL-003 remain
  open.

**Correction carried forward** (per `integration-report-v1-erratum.json` and
`producer-boundary-completion.json`): the archived v1 report's claim that
`StoryDebugPanel.tsx` and `tidegardenRoute.ts` were reported as outside the
boundary *before* being edited is **incorrect**. Those edits, and the generator's
rewrite of `beats/definitions.ts`, happened before the boundary report; root
recorded the late report and then widened the boundary under standing
delegation. No approval is claimed retroactively for them.

The one gate relaxation the v1 report documented, `production.release-gates`, is
**restored** this pass. The structural (rather than literal) active-production
identity introduced in that pass remains, unchanged and still disclosed.

---

## Addendum — movie repair pass (CG-IMPL-004 / CG-IMPL-005), 2026-09-06

This canonical report now covers the combined implementation, including the
bounded movie-repair pass. Full detail: `integration-movie-repair-report.md`,
`integration-movie-repair-report.json`, `integration-movie-repair-progress.md`,
`movie-repair.diff`, `evidence/integration-movie-repair/`. The pre-repair
canonical report is archived intact at
`iterations/implemented-scene-v2/integration-report.json` /`.md`.

**Two source files changed**, both in `production-lock.json#/allowedPaths`;
the other 94 files in `implementation-source-manifest.json` are byte-identical,
verified before the first edit and again after the last.

- `main/src/story/commonGroundDirector.ts` `4f8abeb7cc3a…` → `deea059b75dd…`
- `main/src/story/commonGroundDirector.test.ts` `289fde04e77d…` → `8e11edd1137e…`

**CG-IMPL-004.** The ch13 rail spent the screening dwell before calling the
shared performer, whose first test is `screeningActionReady` — so every act was
refused against the dwell the rail had just paid for, which is the 300-second
home movie under a ready `[F]`. The rail no longer carries the cadence at all:
`CommonGroundRailContext` does not declare it, so consuming it is a type error.
The performer owns resolution, proximity, transaction predicates and the dwell.

**CG-IMPL-005.** The stateless polyline rescan is replaced by an ordered
controller cursor with honest reconstruction across beat, Continue, revision and
route identity. It is read by no predicate; walked units still come only from
`routeProgressUnits` over actual displacement.

**Movement precision.** A multi-tick regression that *walks* a body against the
production predicates found three real failures a teleporting stub would have
hidden: corner cutting permanently froze the comparison at 4 of 18 units; the
survey recording began up to two units short of S, inside the housing's shadow,
costing the fixed-reference class; and one blanket 1.2-unit stop served route
waypoints, a 1.25-unit occupancy cylinder and body approaches alike. All three
were repaired by making ordinary movement precise enough for the existing
proofs. **No predicate, threshold, distance, occupancy or completion condition
was relaxed, and no milestone is granted by any rail.**

**New findings.** CG-IMPL-006 (`ch13-return` approached W at the pose radius,
onto W-7744's own mounted inspection pose — fixed in pass, no browser evidence
for that beat exists). CG-IMPL-007 (`ch13-return` flight grammar matches the
shipped ch10/ch12 idioms — no defect, no change).

**Checks.** typecheck 0 · `npm run test` 0 (348 files / 3026 tests, against
the pre-repair scene-v2 baseline of 3018; 8 added, none removed or weakened) · build 0 · scene AV, chapter registry, chapter
journey, story ladder, guidance targets, story authority, catalog and creative
workflow gates all 0 · triad implementation gate 0, 1708 checks. Both defects
were temporarily reinstated to prove the new regressions bite (6 and 4 failures
respectively); source restored and re-hashed after each.

**Still not proven, and not claimed.** Nothing was rendered, run in a browser,
run on a GPU, played or listened to in this pass. The real headed ch13 home,
survey and common movie belongs to the independent verifier. The limitations
listed above otherwise stand unchanged; CG-IMPL-001, CG-IMPL-002 and CG-IMPL-003
remain open.

**Root action.** `tools/creative-triad-gate.mjs` rewrites the run-local
`creative-run-quality-report.json`. It was restored from
`iterations/implemented-scene-v2/` (`68f5b276…`, the hash
`implementation-gate-pass.json` cites); the post-repair run is kept at
`evidence/integration-movie-repair/creative-run-quality-report.after-repair.json`.
File hashes recorded mid-pass in the JSON report were refreshed to the live bytes
(20 entries, listed under `hashRefresh`) so this canonical report matches the
final combined implementation.

---

## Fourth pass — the lifecycle repair (CG-IMPL-006/007/008)

Full detail: `integration-lifecycle-repair-report.{json,md}`, diff
`lifecycle-repair.diff`, logs `evidence/integration-lifecycle-repair/`. The
independent verifier's interim failure checkpoint on the frozen source is the
evidence this pass answers; root routed it in `lifecycle-repair-direction.json`.
The 96-file manifest was rehashed before the first edit: **96/96 identical.**

**The chapter booted aboard the ship (CG-IMPL-007).** The causal owner is
`storyState.initStoryFromSave`, which seeds `?story=ch13-survey` and
`?story=ch13-common` with `bootstrapOriginLaunchDebug()` — whose last statement
restores *boarded* surface flight. That is right for the beats that begin in the
cockpit and wrong for two beats that begin after ch13-return has landed and
disembarked, and on-foot walk input does nothing in flight control mode. Both
now seed on foot through the shipped `restoreFlightAtLocation('surface')`: no
exit receipt, no listener, no milestone, and the landed Kestrel stays parked.
The screening rail can also leave a landed ship inside those two beats rather
than stalling — never a per-frame auto-disembark, and `ch13-return` is asserted
unchanged.

**The chapter was measuring a body of zero height (CG-IMPL-006).** `player()`
returned the raw Rapier capsule *centre*; every authored pose is a *grounded*
body origin, 1.8 units below it along the live local up. The damage was wider
than the arrival gate the verifier measured: the mounted world's footing samples
the cell under `y − 1.05`, so a centre 1.8 up sampled the **empty** cell and
reported unsupported — silently refusing the survey start, every trace sample,
both reference offers — while the shared walker stopped on *tangential* gait
distance. One conversion at the chapter boundary, from the real capsule
constants and `getPlayerUp()`, now feeds recording, supported ground, sockets,
occupancy, clearance, arrival and progress alike. **No radius widened, no
vertical term dropped, no `y` clamped, no ground faked, no protected file
edited.** `standAt()` now places a real capsule centre and the rail harness uses
the real `surfaceGaitDistance`; with the fix reverted, **24 previously passing
tests fail**, which is precisely why 3026 tests could not see it.

**The home anchors could never activate (CG-IMPL-008).** The signed live-install
receipt was treated as a mandatory prerequisite for the whole beat, the eight
signed *Contingent* anchors likewise for `route-tested` and `complete`; the
director latched an anchor before asking and discarded the answer; and the
shared director enters this chapter's seam one call *before* the AV rail, so the
entry anchor was always refused. Conditional anchors are now exempt from being
prerequisites (with contract citations and a drift guard — the order guard,
one-shot latch and required chain all stand), a refusal is retried exactly once
on the next frame of the same beat and dropped otherwise, and the install
receipt is published before the steady entry it causes. Every anchor regression
drives the real `signedSceneAvRuntime`, never a spy.

Root's late mid-beat-Continue concern was reproduced and repaired in the same
pass: a Continue that already holds the fault-review receipt and then makes a
*new* return choice had its anchor refused, because the cleared per-entry ledger
made an already-earned predecessor look pending. Predecessors satisfied by a
durable receipt — or implied by a later one in the same legal transaction chain
— are no longer waited on; nothing is activated, replayed or written to the
history to achieve it, and an unearned chain is still refused.

**The manual-corner risk: reproduced, and deliberately not "fixed".** At walking
pace, turning 0.18 units early credits 4.000 of 18 for 17.83 walked. But it is a
lock only for a body that never goes back: returning to the frontier it reached
and re-traversing credits **exactly 18.0000**, with earned progress retained, no
reset, no second `F` and no new marker — while a far-end wiggle and a 30-unit
unrelated loop credit nothing. A frontier-creep reconciliation was built,
measured and **removed**, because it pays for omitted ground with in-corridor
distance — a judgement Chapter then formalised as **CG-IMPL-009**, with a static
counterexample showing lateral movement beside C could settle the small remaining
lag without ever returning to the omitted corner. Accepted in full; Chapter names
withdrawal as a valid route under the unchanged contract, and
`commonGroundRoute.ts` therefore differs in comments only. The remaining question — whether ~48 walked
units for an 18-unit span after a 0.18-unit slip is acceptable — is creative, and
is routed to root and Chapter rather than decided here.

**Observability.** `window.__paravoxiaCommonGround.snapshot()`, installed by
`StoryDirectorDriver.tsx` only under `?journeyprobe=1`/`?chapterjourney=1`/
`?debug=1`, returns copies of the beat, the capsule centre, the grounded pose,
the live up, the footing answer, the rail's published plan, the chapter
diagnostic, the controller cursor and any pending anchor. It reports the last
plan the rail **actually executed** rather than calling the planner — root caught
that the first version would have stepped the very controller it was watching —
and a regression proves a hundred reads change nothing. Read-only, no setter, no
handle, removed on unmount; `JourneyRuntimeProbeBridge.tsx` was not touched, so no boundary request
was needed.

**Preservation incident, reported.** One mutation check used `git checkout` in a
deliberately dirty tree and reverted `storyState.ts` to HEAD. It was recovered
byte-exactly from the root-preserved snapshot (`7d66ff3e…`, matching the frozen
manifest), all 96 files rehashed, and the repair re-applied. Every later
counterfactual used a private byte backup with a `finally` restore and a rehash
assertion.

**Checks.** `npm run test` 0 — 348 files / **3068 tests** (baseline 3026, +42,
0 removed, 0 weakened) · typecheck 0 · build 0 · scene AV, story authority,
chapter registry, chapter journey, creative workflow, story ladder, guidance
targets, story UX, preview and catalog gates all 0 · triad implementation gate
0, 1708 checks. Each repair was reverted under a byte-exact counterfactual to
prove its regressions bite.

**Still not proven.** No browser, GPU, preview, `verify`, render or audio in this
role. No chapter completion is claimed and no publication is authorized.

---

# World repair pass — CG-IMPL-006 / CG-IMPL-008 (fifth integration pass)

Full detail: `integration-world-repair-report.json` / `.md`. Direction:
`world-repair-direction.json`. Contract unchanged, scene-v2
`4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e`.

**VF3-FOOTING-1 — cause established, not inferred.** A probe against the *real*
generator at the *real* identity (`getWorldGen(50, STORY_SEED, "-1,-1")`, seed
3215739679) prints the actual column at S as `25:S 26:S 27:.` while
`renderedRadiusCells(50) = 25`. `createFooting` queried the cell above the body
unclipped, so the generator's phantom voxel *outside* the meshed, collided cube
was read as an **invisible ceiling above the ground she was standing on** — and
at the landing area, where the generator stops at 25, the same query said
supported. That is exactly the "localised, not global" shape the verifier
measured, and it explains the jump table without any claim that the ground is at
y=53. Repaired by clipping **only** the procedural fallback (a block a player
actually placed still carries and still obstructs anywhere, because `addVoxel`
has no radius guard), and by adding a real contact band `VOXEL_SCALE/8 = 0.25`
so a body still rounding into cell 25 but hovering half a voxel up is not
"grounded". Both qualified heights — authored 51.05 and the measured resting
50.98897 — sit inside that band. No radius, arrival, occupancy, LOS or proof
threshold moved; no plane was clamped; no ground was invented.

**VF3-AVHOME-1 — cause established from the actual boot.** Not the app-phase
candidate: a `?story=ch13-home` deep link is already `playing`. The real path is
that `storyDirector` runs `subscribeStory(syncBeat)` plus an immediate
`syncBeat()`, and `initStoryFromSave` activates the beat inside App's `useState`
initializer — so `anc.cg.home-steady` is published *before the first frame
exists* — while `<StoryDirectorDriver paused={!worldGenReady ||
!initialRenderReleased || …} />` reports the whole world-gen and shader-warmup
boot to the chapter as **`pause`**, whose unconditional clear destroyed it.
Repaired with a bounded one-anchor beat-entry queue: drained by the beat's first
tick whatever the outcome, dropped whole on every transition, surviving pause and
visibility loss only. The live install acknowledgement, every mid-beat anchor and
the completion token keep the ordinary queue a pause still empties on the spot.
`StoryDirectorDriver.tsx` was not edited.

**VF3-CG008-1 — demonstrated, then repaired.** Built through the actual
`serializeCommonGround` → WorldSave → `hydrateCommonGround` validator → chapter
seam: open, start, draw three real samples, save, cold reload, walk to E, offer
the span — and `anc.cg.route-offered` was **refused with an empty activation
history**. Repaired by extending the existing transaction-chain doctrine to
validated, hydrated, actor- and world-scoped saved survey state. It answers only
"is that predecessor still pending?" — no activation, no history, no receipt, no
replay, no new milestone or event id — and the final proofs stay keyed to their
durable milestones. Mid-common was already correct and is retained, not changed.

**Root's mid-pass review finding was accepted and fixed**: the first clip also
discarded real placed voxels; two test claims were narrower than their names.
All three are addressed, with a counterfactual (`cf5`) proving the placed-block
clause necessary.

**Checks.** `npm test` 0 — 349 files / **3091 tests** (baseline 3068, **+23**, 0
removed) · typecheck 0 · build 0 · scene AV, chapter registry, chapter journey,
story authority, story ladder, guidance targets, creative workflow, story UX and
focused suites all 0. Five counterfactuals, each restoring exact bytes in a
`finally` block with a hash assertion; mutation exit codes recorded separately
from cleanup. **No `git checkout`/`reset`/`restore`/`stash`/`clean` was used in
this pass.** Manifest rehashed 96/96 clean before mutation and 4 changed / 0
unexpected after.

**Still not proven.** No browser, GPU, preview, render or audio in this role;
nothing was listened to and nothing was played. The station→home bridge and
everything downstream of the survey start remain unverified on hardware. No
chapter completion is claimed and no publication is authorized.
