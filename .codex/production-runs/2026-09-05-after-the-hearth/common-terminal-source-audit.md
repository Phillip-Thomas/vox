# COMMON terminal-waypoint source audit

Run `2026-09-05-after-the-hearth` · read-only mechanical source auditor (opus) · **2026-09-06T16:17:33Z**
Frozen source manifest `dc63fbae…4adc36c` (99 files) — **unmodified**.

**Not acceptance. Not chapter verification. No publication. No repair is authorized — Root must review before any seventh material repair.**

---

## 1. Answer in one line

The fifth repair's exact-goal handoff is **correctly refused** at COMMON vertex 3, because the signed
`CG_RAIL_CORNER_OVERSHOOT` 0.6 pushes the capsule footprint onto a **water** column at `(-46, ·, 16)`.
The navigator therefore keeps the snapped cell centre `(-44, 52.85, 16)` as the steering target, and the
closest approach to the published goal while steering is live is **0.4356 > arriveRadius 0.35** —
unsatisfiable. It is the CG-IMPL-010 deadlock again, but reached through a *legitimate safety refusal*
rather than through arithmetic the repair fixed.

## 2. The seam, step by step

| # | Fact | Class |
|---|---|---|
| 1 | `railGoal(CG_ROUTE_COMMON, 3, 0.6)` = `(-44.6, 51.05, 16)` — bit-exact to the captured `rail.target` | evidence |
| 2 | Shipped planner terminates on `(-44, 52.85, 16)`, `dry-surface-path`, not wet, no water crossing | evidence |
| 3 | Tangential offset 0.6 > `reach` = `VOXEL_SCALE/2 − PLAYER_CAPSULE_RADIUS` = 0.5 → one extra column `(-46, ·, 16)` | evidence |
| 4 | `certifyColumn(-46, ·, 16)` → `unreachable / start-column-not-traversable`; cell `(-23, 8)` is **water** at the surface layer (cy 25) over solid at cy 24 | evidence |
| 5 | `terminalExactGoalHandoff` → `{ handoff: false, refusal: 'footprint-not-certified' }` | evidence (planner) / inference (transcribed fn) |
| 6 | `applyTerminalExactGoal` returns the snapped waypoint; `steerFreeToward` releases all four controls inside `NAVIGATION_STEER_DEAD_ZONE` 0.2 of it; `walkToward` arrives only on distance to `(-44.6, 51.05, 16)` | evidence |
| 7 | Tangential goal↔target distance is **0.6356**, not 0.6: the live up is tilted −0.0198 in x, and discarding the normal component of the 1.8-unit foot(51.05)/clearance(52.85) convention gap injects +0.0357 of *tangential* error along the tilt. 0.6356 − 0.2 = **0.4356 > 0.35** | evidence |
| 8 | Measured pose corroborates exactly: 0.1777 from the vertex (< dead zone), 0.7598 from the goal, and `terraUnits` 5.845337 is **0.154663** short of the 6 walked units vertex 3 represents — the same shortfall as the body's own x offset | evidence |
| 9 | `vertexReached` at a turn requires `along ≥ 0`, i.e. crossing x = −44. Parked at −43.845 it never does, so the cursor never advances. `stillTime 0` and zero nudges are correct: the watchdog only counts stillness while a control is *pushing*, and the navigator issues none | evidence |

## 3. COMMON vs the survey that passed — not a sign/parity/quantization asymmetry

Every `CG_ROUTE_LONG` turn vertex tested (1,2,3,4,5,6,8,13,18), **including** the negative-x overshoots at
−28.6, −30.6, −32.6, −42.6, certifies its footprint column and **takes** the handoff: closest approach 0.0,
arrival satisfiable. Nothing about a negative axis, quantization or frame parity differs. The COMMON
polyline is simply authored one voxel from unsafe landform at its western end.

Three COMMON goals are unsatisfiable on this world:

| vertex | goal | required column | why refused | closest approach |
|---|---|---|---|---|
| 3 | `(-44.6, 51.05, 16)` | `(-46, ·, 16)` | surface **water**, cell (−23,8) | 0.4356 |
| 6 | `(-48.6, 51.05, 18)` | `(-50, ·, 18)` | **planet face edge** at cell (−25,9) (x = −50 is the planetSize-50 boundary; dry solid but not traversable) | 0.4356 |
| 9 (**terminal C**) | `(-48, 51.05, 11.4)` | `(-48, ·, 10)` | surface **water**, cell (−24,5) | 0.4011 |

Vertices 2 and 4 certify and pass. Terra stalls at 3 first; 6 and 9 would follow.

## 4. Rail implementation, or authored geometry?

**Both — a rail-only correction is provably insufficient.**

- At turning vertices 3 and 6 the overshoot is taken along the **incoming** leg. Taken along the
  **outgoing** leg instead it would still satisfy `vertexReached` (`along = 0.6·(in·out) = 0 ≥ 0` at a right
  angle; `distance 0.6 ≤ arrive + 0.6 + 1`) and land the footprint on the route's own next cell, which
  certifies. Stated as an **observation**, not a proposed repair.
- At vertex 9 (**C**, the terminal) there is no outgoing leg. `RailRouteOptions.terminalOvershoot` points
  south into water at `(-48, ·, 10)`. No choice of overshoot *direction* exists. Either the
  terminal-overshoot device or the authored western end of `CG_ROUTE_COMMON` must change — and the signed
  physical 18 units, the 8 units outside the fixed reference and the six-unit E↔C separation are
  load-bearing, so that is a **Chapter Director** decision, not this audit's.

## 5. Regression tests that fail on current code

- **RT-1** For every publishable index of `CG_ROUTE_COMMON`, the published `railGoal` must be reachable:
  handoff taken, **or** `tangentialOffset − 0.2 ≤ arriveRadius`. **Fails at i = 3, 6, 9** (0.4356, 0.4356,
  0.4011 vs 0.35). Passes for every `CG_ROUTE_LONG` vertex — a real discriminator, not a blanket tightening.
- **RT-2** A refused handoff must not leave an unsatisfiable walk. Today `primitives.test.ts` asserts the
  refusals themselves (lines 656/704/707/729/774) but never that the **refusal path** is walkable. This is
  the missing invariant: the fifth repair made the handoff correct and left the original deadlock on the
  refusal branch.
- **RT-3** Tangential offset must be computed on the **live tilted up**: 0.6356, not the flat-up 0.6. The
  fifth repair's `0.6 − 0.2 = 0.4` margin is a lower bound and should be stated as one.

## 6. Controls that must preserve the unsafe rejection

`certifyColumn` keeps `maxVisitedCells: 1` and `differentFaceFallback: 'unreachable'`; the three columns
above stay **refusals** in any fixture; the existing refusal tests
(`goal-substituted-for-safety`, `water-leg`, `goal-outside-terminal-cell`, `footprint-height-mismatch`)
stay unchanged; `NAVIGATION_STEER_DEAD_ZONE` 0.2, `CG_RAIL_ROUTE_ARRIVE` 0.35, a signed
`CG_RAIL_CORNER_OVERSHOOT` 0.6 and `CG_COMMON_ROUTE_UNITS` 18 all stay; displacement-bounded
`routeProgressUnits`, the full ordered path and strict-corner (`along ≥ 0`) recovery all stay.

**Explicitly NOT proposed:** larger arrival radius, endpoint credit, nudges, teleport, unsafe-goal bypass,
relaxation of the full ordered path, any previous CG-009 endpoint allowance.

## 7. Reproduction, hashes, limitation

- `verifier/probes/common-terminal-audit/common-terminal-repro.mjs` `d46bc0c1…5e506983` →
  `logs/common-terminal-audit/repro.json` `b344b714…d56874ef`
- `verifier/probes/common-terminal-audit/column-cause.mjs` `1208609351cdfab9…e5506983` →
  `logs/common-terminal-audit/column-cause.json` `93a7c859…4e539cf8`
- Re-used byte-for-byte (not rebuilt): `verifier/probes/handoff-standby-repair/bundle/repro.mjs`
  `a093c75f…0ed8ab00` — the CG-IMPL-012 pattern, re-exporting shipped symbols only.
- Source read: `autopilot/primitives.ts` `a6da0551…d3c7da4ae`, `commonGroundDirector.ts` `acc0d9cf…7166c46`,
  `commonGroundState.ts` `7a3c03fb…becdb0452e`.
- World: seed **3215739679**, world `-1,-1`, **planetSize 50**, **VOXEL_SCALE 2**, face from the measured live up.

**Limitation (explicit):** CPU reconstruction of *generated* terrain plus the shipped planner. `voxelSystem`
is empty in this process, so **live persisted / player-edited voxels are not represented**. No GPU, browser,
build or verify was run. `terminalExactGoalHandoff`, `exactGoalFootprintColumns` and `railGoal` were
**transcribed** from frozen source (the bundle does not export them): their equivalence is *inference*; the
planner and terrain calls they make are *evidence*.

## 8. Minimal future live discriminator

One hardware `cg-journey-probe` run at `ch13-common` that publishes, from the live runtime, the exact-goal
**refusal string** and the `certifyColumn` result for the terminal footprint column, beside the rail target
and cursor it already publishes. Expected: `footprint-not-certified` at `(-46, ·, 16)`. If the live refusal
is `footprint-height-mismatch`, or the handoff is *taken*, this cause is wrong and the stall is elsewhere.
No new repair and no new geometry are required to run it.

## 9. Standing

Both captures genuinely earn route-tested, COMMON, W-7744 at H and `anc.cg.reciprocal-reference`; the
survey standby repair holds. This is a **new, distinct COMMON-rail stall**, not the old standby defect and
not a manual-input failure. Nothing here is an acceptance, a taste claim, or an authorization.

Re the 16:18:15Z inbox note: the "raised terrain obstruction" there is a *visual* inference and is not this
finding. The cause named here is a planner/terrain refusal measured with the shipped
`planAgentSurfaceRoute` over the shipped terrain adapter — a different, non-visual line of evidence — and
it does not depend on, or speak to, whether the short survey has a valid prerequisite.
