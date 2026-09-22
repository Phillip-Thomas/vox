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
