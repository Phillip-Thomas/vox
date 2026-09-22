# Integration — manual-credit finale, frontier (eighth material repair)

Not accepted here. Root reviews the final diff; a separate verifier runs the stable
candidate checks. No runtime observed, no GPU, no publication, no build.

## The defect, as the producer stated it

`nextRouteCoverage` maximised an unbounded leg projection into credit after any
positive displacement, and treated a geometric corner crossing as a receipt for
the incoming leg that led to it.

## The correction (bounded, mechanical, one function)

`main/src/story/commonGroundRoute.ts`, `nextRouteCoverage` only:

1. A corner is certified only when the crossing is real (incoming plane crossed by
   the two real feet, inside the unchanged 0.35 reach) **and** the incoming leg is
   actually covered to that vertex under the same strict frontier/displacement
   accounting. A lagging prior frontier now breaks the while loop instead of
   certifying the corner.
2. Ordinary leg movement is strict again: the projection is credited only when it
   is within `units + displacement`. No max, no creep, no min-clamp toward a
   distant projection, no bank.
3. The one exception is the corner certified in that same update, where the
   outgoing projection settles only the local residual that corner-cutting
   geometry creates. It is bounded by the next unreached vertex, and the very next
   ordinary update is strict again.

Unchanged: 0.35 vertex reach, corridor radius, every tolerance and precision,
`routeProgressUnits`, `provenVertex`, `syncedRouteCoverage`, real prior/current
feet, no synthesised prior foot, gap handling, earned prefix, monotonicity.

## The three counterexamples (executed, not asserted from reading)

| case | rejected draft | candidate |
| --- | --- | --- |
| seeded foot at z 13, then 13.01 by 0.01 | 1.01 | **0** — and still 0 after 200 frames; a real walk back to z 12 and re-traversal pays 1.01 |
| carried 0.5 across a gap, 13.5 then 13.51 by 0.01 | 1.51 | **0.5** retained |
| same gap, 13.99 -> 14.01 by 0.02, a genuine vertex-1 crossing | 2 / 2.01 | **0.5**, `reachedVertex` still 0; walking the incoming leg for real then certifies it and pays 2.01 |

Retained: call 298 (6.130885899955892 -> 6.294483000367848 -> 6.376281547075248),
the z 15.82 refusal and its walk-back repair, near corner, far C, exactly 18 in
both corner directions with the recorded 0.27 overshoots, stationary worth 0, no
invented previous foot, conservative re-derivation of a span written elsewhere.

Call 298 still pays because under the strict per-update rule its projection sits
exactly on the honest ceiling from the real previous credit — it is ordinary
movement, not a grant.

## CG-IMPL-016

The driver registers **two** `useFrame` callbacks and the existing WIP harness kept
only the last, so three of its own cancellation assertions were running against
the wrong callback and failing. The harness now captures and runs every callback
in registration order. Added: the token is spared over 400 real done frames with
no suspension call and no renewal, and every genuine interruption still lands on
an already-done story. `StoryDirectorDriver.tsx` itself is unchanged — no broad
inactive-foreground grant, no UX or controls change, the 5s deadline and 4.5s
release untouched, no forced attack.

## Actual commands

    cd main
    npx vitest run src/story/StoryDirectorDriver.test.tsx src/story/commonGroundRoute.test.ts \
      src/story/commonGroundDirector.test.ts src/story/commonGroundScore.test.ts \
      src/story/storyDirector.test.ts --reporter=verbose

5 files passed, 254 tests passed, exit 0
(`logs/integration-manual-credit-finale-frontier/focused-tests.log`, 2026-09-06T21:12Z)

Not run and not claimed: full verify, build, broad suite, typecheck. The earlier
background `tmp/tsc.log` is unbound WIP and is not a final typecheck.

## Archives

- Rejected draft, byte-exact and hash-verified against the producer's pins:
  `iterations/manual-credit-finale-rejected-projection-draft/source/`
  (`commonGroundRoute.ts` 13b3974e…, `commonGroundRoute.test.ts` e2bd0e83…).
  `StoryDirectorDriver.test.tsx` was edited before its rejected bytes were copied;
  only the producer's pinned hash 0f10a92b… attests it. Not reconstructed, not claimed.
- Candidate: `iterations/manual-credit-finale-frontier-candidate/source/`
