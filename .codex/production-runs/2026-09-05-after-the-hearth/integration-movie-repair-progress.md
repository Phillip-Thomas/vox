# Integration — movie repair progress (CG-IMPL-004 / CG-IMPL-005)

Run: `2026-09-05-after-the-hearth` · contract scene-v2 `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e`
Owner of this pass: integration engineer, source only. Root owns inbox, lock, gates, readiness, final evidence.

## Status: patch phase COMPLETE, all in-pass checks green

Two source files changed, both inside `production-lock.json#/allowedPaths`:

| path | before | after |
| --- | --- | --- |
| `main/src/story/commonGroundDirector.ts` | `4f8abeb7cc3a…` | `deea059b75dd…` |
| `main/src/story/commonGroundDirector.test.ts` | `289fde04e77d…` | `8e11edd1137e…` |

The other 94 files in `implementation-source-manifest.json` are byte-identical to the
signed snapshot; that was verified before the first edit and again after the last.
No contract, geometry, route, cue-set, copy, guidance-meaning or player-rule change.
No predicate, threshold, distance, occupancy or completion condition was relaxed.

## What was actually wrong, and what it now does

### CG-IMPL-004 — cadence deadlock (was: real hardware stall)

`applyCommonGroundRail` spent the screening dwell with `ctx.noteScreeningAction()`
and only then called `ctx.performStoryInteraction`, whose own first test is
`screeningActionReady()`. Every ch13 act was refused by the dwell the rail had
just paid for; the ready `[F]` prompt stood at the core for the whole 300-second
home movie.

The chapter rail no longer carries the cadence at all. `CommonGroundRailContext`
does not declare `screeningActionReady` or `noteScreeningAction`, so consuming it
from here is now a type error rather than a convention. The rail walks and calls
the shared performer, which re-resolves the live interaction at the body's real
position, refuses anything that is not the plan's id, and spends the dwell only
when an act actually happened. The stale `<= CG_CORE_REACH` gate went with it —
the resolver already carries the true reach for each rung.

### CG-IMPL-005 — stateless waypoint scan

`nextWaypoint` re-scanned the whole polyline every frame for the first point more
than 1.2 units from the body, so the walked start became the next target again the
moment the body left it. Replaced by an ordered controller cursor
(`runtime.railTraversal`) keyed on run, actor, world, beat, route and survey tail
revision. It advances only onto vertices the body has genuinely reached, never
reconsiders one behind it, and rebuilds from the body's own projection — never
from anywhere ahead of it — on a beat change, Continue, revision, route change or
any frame where the body is not on the leg the cursor believed it was walking.

It is controller state and nothing else: no predicate, guidance fact, marker or
receipt reads it. Every walked unit still comes from `routeProgressUnits` reading
actual frame-by-frame displacement, and every trace sample is still only where the
body actually stood.

## The three precision failures the multi-tick test exposed

The regressions drive a body that *walks* — bounded step per frame, stops inside
the requested radius — against the production predicates. Three real failures
appeared that a teleporting stub would have hidden:

1. **Corner cutting froze the comparison at 4 of 18 units.** Turning 0.18 units
   early swings the body's own projection *around* the corner farther than it
   walked that frame; `routeProgressUnits` refuses that frame, and the refusal is
   permanent because every later projection is further beyond the allowance. Raw
   frame-by-frame evidence retained in the report. Fixed by requiring the body to
   actually pass a turning vertex, and by aiming a short step through corners and
   through the far end so arc gain never exceeds displacement. Straight vertices
   keep the ordinary stop-radius arrival.
2. **The survey recording began up to two units short of S.** The first sample is
   written at the body's actual pose, and the approach line in from his inspection
   pose lands in the survey housing's shadow — S sits about 0.2–0.35 units from
   both that shadow and the 12-unit range edge. The offered span then failed his
   first-try test on an occlusion the authored route does not contain, and the
   movie fell back to the contingent witness. The rail now aims a step *through*
   the head along the route's own first leg and records only on arrival. Measured
   first sample is now 0.32 from S and the accepted class is `fixed-reference`,
   as signed.
3. **Blanket 1.2-unit stops undershot measured poses.** Every walk requested the
   same radius, against a 1.25-unit occupancy cylinder and a resolver reach wider
   than the intended arrival. Plans now carry their own `arriveRadius` (route
   0.35, pose 0.6, body 2.4, core 1.2 unchanged), and the far-reference and
   span offers wait for arrival instead of spending cadence on attempts the
   transaction will refuse.

Also corrected while here: `CommonGroundRailContext.walkToward`'s third parameter
was declared as a slow radius; the shared walker has no such parameter and was
receiving `0.8` as a gaze lift.

## New finding raised and fixed in-pass

`ch13-return` walked to `CG_POSES.W` at the pose radius. W is *his* mounted
inspection pose, not an empty mark, and the beat only needs 3.4 units. Stopping on
top of him would manufacture exactly the body-clearance stand-off this chapter
never resolves by displacing anybody. Now stops at body distance. No browser
evidence exists for this beat; it is a source-level boundary correction of the
same class, reported rather than assumed harmless.

`ch13-return`'s board / launch / fly / land grammar was checked line by line
against the shipped ch10/ch12 idioms in `autopilot/primitives.ts` and matches
them; `requestLanding` is guarded and edge-safe. No change made there.

## Checks run in this pass (all green)

`npm run typecheck` 0 · `npm run test` 0, 348 files / 3026 tests (pre-repair
scene-v2 baseline 3018; 8 added, none removed or weakened) ·
`npm run build` 0 · `scene:av:check` `chapter:registry:check`
`chapter:journey:check` `story:ladder:check` `guidance:target-check`
`story:authority` `catalog:check` `creative:workflow:check` all 0 ·
`tools/creative-triad-gate.mjs --phase implementation` 0, 1708 checks.

Both defects were re-introduced temporarily to prove the new regressions bite:
the premature `noteScreeningAction` fails 6 of them, the stateless scan fails 4.

Logs, diffs and the post-repair gate report: `evidence/integration-movie-repair/`.

**Root action needed:** the triad gate rewrites the run-local
`creative-run-quality-report.json`. I restored it from
`iterations/implemented-scene-v2/` (`68f5b276…`, the hash
`implementation-gate-pass.json` references) and kept my post-repair run at
`evidence/integration-movie-repair/creative-run-quality-report.after-repair.json`
(`c4ad3643…`). Re-issue the live report if you want it to reflect this source.

**Not done here, by boundary:** no browser, GPU, preview or movie run. No claim of
a rendered or hardware movie success is made anywhere in this pass. The real
headed home/survey/common movie remains for the independent verifier.
