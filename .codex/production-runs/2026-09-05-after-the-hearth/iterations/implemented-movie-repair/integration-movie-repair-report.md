# Integration movie repair — CG-IMPL-004 / CG-IMPL-005

Run `2026-09-05-after-the-hearth` · contract scene-v2
`4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e` · all three
signatures unchanged and binding · no contract, creative or player-rule change ·
no publication · no browser or GPU run · **no rendered or movie success is
claimed by this pass**.

Machine-readable companion: `integration-movie-repair-report.json`.

## Source boundary

Starting source verified byte-exact against `implementation-source-manifest.json`
(96 of 96) *before the first edit*. Two files changed, both listed in
`production-lock.json#/allowedPaths`; the other 94 signed files are still
byte-identical.

| path | before | after |
| --- | --- | --- |
| `main/src/story/commonGroundDirector.ts` | `4f8abeb7cc3a0d31…` | `deea059b75dde9bc…` |
| `main/src/story/commonGroundDirector.test.ts` | `289fde04e77d2cba…` | `8e11edd1137ecffc…` |

Unified diff: `movie-repair.diff` (`814f5b54093ce1f6…`), per-file copies under
`evidence/integration-movie-repair/`.

## CG-IMPL-004 — the cadence the rail did not own

`applyCommonGroundRail` called `ctx.noteScreeningAction()` and *then*
`ctx.performStoryInteraction`. The shared performer's first test is
`screeningActionReady()`, so it refused every act against the dwell the rail had
just spent. That is the 300-second home movie sitting under a ready `[F]`.

The chapter rail no longer has the cadence to spend.
`CommonGroundRailContext` does not declare `screeningActionReady` or
`noteScreeningAction`; consuming it from here is now a compile error rather than
a convention someone has to remember. The rail walks and asks:

```ts
ctx.walkToward(goal, plan.arriveRadius);
ctx.performStoryInteraction(plan.interactionId as never);
```

The performer re-resolves what the player is actually being offered at this body
position, refuses anything that is not this plan's id, runs every transaction
predicate, and spends the dwell only when an act happened. The old
`<= CG_CORE_REACH` gate is gone with it — it applied the habitat core's 4.2-unit
reach to survey and common rungs the resolver measures at 2.0 and 3.4, and the
resolver already carries the true reach for each.

No milestone is granted, no resolver bypassed, no timeout rescue added.

## CG-IMPL-005 — ordered traversal

`nextWaypoint` rescanned the whole polyline every frame for the first point more
than 1.2 units from the body, so the walked start was retargeted the moment the
body left it. It is replaced by an ordered cursor in `runtime.railTraversal`,
keyed on run, actor, world, beat, route identity and survey tail revision.

- advances only onto vertices the body has genuinely reached;
- never reconsiders a vertex behind it during ordinary forward walking;
- rebuilds from the body's **own projection** — never from anywhere ahead of it —
  on a beat change, Continue, revision, route change, or any frame where the body
  is not on the leg the cursor believed it was walking;
- is read by no predicate, guidance fact, marker or receipt.

Walked units still come only from `routeProgressUnits` reading actual
displacement; trace samples are still only where the body actually stood;
occupancy, footing, reference, clearance and completion predicates are untouched.

## What the walking test found that a teleporting stub would not

The regressions drive a body that walks — bounded step per frame, stops inside
the requested radius, asserted never to exceed one frame's travel — against the
production predicates. Three real failures surfaced.

**1. Corner cutting froze the comparison at 4 of 18 units.** Turning 0.18 units
early swings the body's projection *around* the corner farther than it walked
that frame. `routeProgressUnits` caps a frame's gain at that frame's
displacement, so it refuses the frame — and the refusal is permanent, because
every later projection is further beyond the allowance than the last. The
reference and footing checks were true the whole time; nothing else was failing.
Raw frame log retained at `evidence/integration-movie-repair/corner-seam-raw-failure.txt`.

Fixed by making the body actually walk the corner: a turning vertex is consumed
only once the body has passed it, and goals aim a short step through corners and
through the polyline's far end so arc gain never exceeds displacement. Straight
vertices keep ordinary stop-radius arrival. After the fix the same diagnostic run
advances continuously and the production predicate closes on its own at frame 91
— about four seconds of walking for eighteen units. **The predicate was not
touched. The body was made to walk.**

**2. The survey recording began up to two units short of S.** The first sample is
written at the body's actual pose, and the approach line in from his inspection
pose lands in the survey housing's shadow — S sits roughly 0.2–0.35 units from
both that shadow and the 12-unit range edge. The recorded opening samples were
occluded, his first-try test stopped on an occlusion the authored route does not
contain, and the movie fell back to the contingent witness — losing the
fixed-reference class the long route was chosen to demonstrate.

The approach now aims a step through the head along the route's own first leg,
and the rail records only on arrival; the act reach is the aim plus the stop
radius, so the body can never settle outside the reach it is waiting on. Measured
after: first sample 0.32 from S, every sample clean from the fixed reference,
accepted class `fixed-reference`, no witness. The player-facing resolver reach is
unchanged — only what the rail does with it.

**3. One blanket 1.2-unit stop for every move.** Plans now carry their own
`arriveRadius` — route 0.35, pose 0.6, body 2.4, habitat core 1.2 unchanged — and
the far-reference and span offers wait for arrival instead of spending cadence on
attempts the transaction will refuse.

Also corrected: `CommonGroundRailContext.walkToward` declared a third parameter
the shared walker does not have (a slow radius); the rail was passing `0.8` into
the gaze lift.

## Standing clear of his body

After offering the span the body stands on its own last recorded sample, which is
on the span he then has to walk. The rail now steps off the trace with ordinary
movement, under the same clearance rule that holds his leg — and explicitly not
by offering a witness, which repairs an end he cannot reach and has never
repaired a body standing in the way. The genuine witness branch for real
reference holds is preserved, as is the common beat's existing stand-clear during
his positioning leg. Proven end to end: he walks her span himself and the beat
reaches `tested` with no witness and no hold outstanding.

## New findings

**CG-IMPL-006 (medium, fixed in pass, `ch13-return`).** The on-foot approach
walked to `CG_POSES.W` at the pose radius. W is his *mounted inspection pose*,
not an empty mark, and the beat advances at 3.4 units — stopping on his body
manufactures the body-clearance stand-off this chapter never resolves by
displacing anybody, and the tightened pose radius would have made it worse. Now
stops at body distance. There is no browser measurement of `ch13-return`; this is
a source-level correction of the same class, reported rather than assumed
harmless.

**CG-IMPL-007 (info, no defect).** `ch13-return`'s board / launch / fly / land
grammar was checked line by line against the shipped ch10 and ch12 idioms in
`autopilot/primitives.ts`. They match, and `requestLanding` is guarded and
edge-safe. No change made.

Nothing outside the ch13 rails was touched — no earlier rails, flight or
worldgen.

## Checks — command, exit code, log

| check | command | exit | log |
| --- | --- | --- | --- |
| typecheck | `npm run typecheck` | 0 | `typecheck.log` |
| unit tests (full) | `npm run test` | 0 | `vitest-full.log` |
| unit tests (story focus) | `npx vitest run src/story src/game/spaceStation src/components/spaceStation` | 0 | `vitest-story.log` |
| build | `npm run build` | 0 | `build.log` |
| scene AV | `npm run scene:av:check` | 0 | `gate-scene-av-check.log` |
| chapter registry | `npm run chapter:registry:check` | 0 | `gate-chapter-registry-check.log` |
| chapter journey | `npm run chapter:journey:check` | 0 | `gate-chapter-journey-check.log` |
| story ladder | `npm run story:ladder:check` | 0 | `gate-story-ladder-check.log` |
| guidance targets | `npm run guidance:target-check` | 0 | `gate-guidance-target-check.log` |
| story authority | `npm run story:authority` | 0 | `gate-story-authority.log` |
| catalog | `npm run catalog:check` | 0 | `gate-catalog-check.log` |
| creative workflow | `npm run creative:workflow:check` | 0 | `gate-creative-workflow-check.log` |
| triad gate (implementation) | `node tools/creative-triad-gate.mjs --run … --phase implementation` | 0 | `gate-creative-triad-implementation.log` |

348 test files, 3026 tests, all passing. The pre-repair scene-v2 baseline was
3018; this pass adds 8 regressions and removes or weakens none. An intermediate
3025 was measured partway through the pass, before the `ch13-return`
approach-clearance regression, and is not a baseline. All logs under `evidence/integration-movie-repair/`.

### Counterproof — the regressions bite

| defect reinstated | exit | failing tests | log |
| --- | --- | --- | --- |
| premature `noteScreeningAction` in the rail | 1 | 6 | `counterproof-CG-IMPL-004-reinstated.log` |
| stateless 1.2-unit waypoint scan | 1 | 4 | `counterproof-CG-IMPL-005-reinstated.log` |

Source restored to `deea059b75dde9bc…` after each; verified by hash.

## Root action

`tools/creative-triad-gate.mjs` rewrites the run-local
`creative-run-quality-report.json` as a side effect of running. I restored it from
`iterations/implemented-scene-v2/creative-run-quality-report.json`
(`68f5b27615425122…`, the hash `implementation-gate-pass.json` references) and kept
my post-repair run at
`evidence/integration-movie-repair/creative-run-quality-report.after-repair.json`
(`c4ad36435d5bd7da…`). Re-issue the live report if you want it to reflect this
source. No other root artifact was written by this pass.

## Handoff

The independent verifier owns full `npm verify`, browser and hardware. The real
headed home, survey and common movie has not been run here and is not claimed.
