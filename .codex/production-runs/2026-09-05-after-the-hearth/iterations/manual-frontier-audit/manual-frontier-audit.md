# Manual frontier audit — why deviation-1 credit locked at 6

**Verdict: harness route defect. Not a candidate game defect. No eighth repair indicated.**

Source frozen, manifest `6ef957c3…e5d6`. Live `main/src/story/*` bytes equal the frozen
iteration (`commonGroundRoute.ts` `6025bc4c…`, `commonGroundDirector.ts` `3b2b95cc…`,
`commonGroundState.ts` `7a3c03fb…`). No game/contract edit, no browser, no GPU, no build.
`logs/manual-frontier-audit/source-{before,after}.sha256` are identical.

## What was actually observed (not inferred)

- vertex 2 crossed at 70877 ms with foot pose **z = 16.164333**, i.e. **0.164 past the
  vertex on that corner's incoming +z axis**; credit 4.008321.
- vertex 3 crossed at 71644 ms → credit steps to **exactly 6** (= arc `2 × 3`).
- vertices 4–9 all crossed, `supported: true` on every sample, ~12 further walked units,
  credit **constant 6**. Gate `all-original-incoming-planes-crossed-in-order` = ok:true;
  only `fullEighteenCredited` failed.
- Director credits via `routeProgressUnits(CG_ROUTE_COMMON, body, terraUnits, displacement)`
  (`commonGroundDirector.ts:1320`) gated on `walkedSegmentSupported && checkReference` —
  both were live-true here, so neither is a candidate cause.

## The precise missing condition

`routeProgressUnits` (`commonGroundRoute.ts:467`) recomputes its ceiling **from the credit,
not from the body's true arc**: `ceiling = previousUnits + displacementUnits`. So the body
must resume re-traversal at or behind the credited frontier **on every segment**, including
the *outgoing* leg's axis at each corner.

The 0.164 residual left past vertex 2 is merely *lateral* on leg 2→3 (uncredited, harmless),
but leg 3→4 runs back along +z, so at vertex 3 the projected arc jumps discontinuously
6 → 6.164 with no matching displacement. One frame buys only
`0.005014681 × 1000 / 60 ≈ 0.0836` units. `0.1643 > 0.0836` → the claim is refused, and from
then on the gap can only grow. That is the deliberate frontier lock the file documents at
lines 437–465, reached by a route the probe chose.

**Harness cause, exact:** `common-passage-probe.mjs:590-592` aims
`vertex + plane.normal * 0.15` — deliberately 0.15 *past* each vertex along that vertex's
incoming normal — and the 30 ms minimum pulse quantises to ~0.15 units (0.1204 commanded +
0.0274 coast). At a corner that incoming normal is exactly the axis the route re-uses later.
Every corner step therefore manufactures a 0.06–0.17 unit debt on a later leg's longitudinal
axis, ~2× the per-frame ceiling. The run "returned to the frontier" and then re-created the
debt at the very next corner, so the documented recovery was never actually performed.

## Discriminating CPU experiment (actual game function, actual captured poses)

`verifier/probes/manual-frontier-audit/frontier-replay.mjs`, exit 0, output
`logs/manual-frontier-audit/frontier-replay.json`. It imports the real
`routeProgressUnits` / `CG_ROUTE_COMMON` (node type-stripping; no clone, no mirror suite)
and replays the captured deviation-1 poses.

| replay | change | per-vertex credit | final |
|---|---|---|---|
| A | none — actual captured poses | 4.008, 6, 6, 6, 6, 6, 6, 6 | **6** (matches live) |
| B | *only* the vertex-2 residual placed on the incoming side | 4.008, 6, 8.027, 10.038, 12, 14.076, 16.061, 18 | **18** |

Limitations: pulse-END poses only, intra-pulse frames interpolated at the measured
calibration speed; support/reference/terrain gating not reproduced (independently live-true);
`bodyPose` (projected foot) used, `bodyCentre` differs only in y.

## Passing-run contrast (input shape, not dismissal)

`arrival-common/journey-common-1` at the same corner: `45265 ms units 5.819 pose
[-43.889, 50.99, 15.926]` → `45375 ms units 6.268 pose [-44.196, 50.99, 16.347]`. It reaches
vertex 3 with the **outgoing axis still behind** the vertex, so the arc is continuous and
credit tracks displacement. Its larger 0.24 overshoot bound is harmless because that overshoot
lies along the leg it is already being credited for. reference-3 was read only for the
supported-start contrast (at-E foot y 53.317, unsupported) and proves nothing about grounding
of the route.

## Instrumentation limitation (explicit)

`commonPassageLogic.mjs:186 orderedFrontierVerdict` checks ordered indices, non-decreasing
time, `crossed===true`, finite units, and **monotonic** units only. A constant 6 across
vertices 3–9 satisfies all of them. It never asserts `units >= 2 × index`. **Plane crossings
are not certification of the passage**, and this gate's ok:true on a frozen-credit run is the
proof of that.

## Smallest falsifiable next measurement

Re-run the same deviation script with one bounded harness change: aim to the vertex **minus
0.05** along the incoming normal, require the outgoing-leg axis residual `|offset| <= 0.05`
before turning, and assert live `terraUnits >= 2*index - 0.05` at every crossing.
Prediction: 6, 8, 10, 12, 14, 16, 18 with no game change. If credit still freezes at 6 with a
verified sub-0.05 residual while supported and reference-held stay true, the harness
explanation is dead and a live game-side cause must be sought.

Harness correction (diagnostic only, not applied, not authorized here): square the corner
before turning; shrink the corner pulse quantum below the per-frame ceiling; add a live
credited-frontier guard that fails fast at the first vertex where `units < 2*index`, naming
the residual axis. Support and reference were already live-true throughout — nothing here
invents safe footing.

## If root later orders a source change

Bounded path: `main/src/story/commonGroundRoute.ts`, `routeProgressUnits` only. Regression
scenario that must still hold in `commonGroundRoute.test.ts`: standing at C earns 0; endpoint
proximity earns 0; the 0.18-unit early turn still holds credit at 4 across 300 further walked
units; a far-end wiggle still buys nothing. Making corner recovery cheaper is the creative
question the file already records at lines 459–465, not an implementation defect, and it is
not decided here.
