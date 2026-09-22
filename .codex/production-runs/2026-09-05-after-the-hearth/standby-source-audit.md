# ch13 survey standby stall — read-only source audit

Recorded 2026-09-06T14:41Z. Read-only mechanical auditor. **Not** an acceptance, not a
repair authorization, not live browser proof. Companion: `standby-source-audit.json`.

All 98 manifest files rehashed before (14:34:29Z) and after (14:40:25Z) this audit: all
98 match `implementation-source-manifest.json` both times, before == after. Nothing in
`main/`, `docs/`, the contract, the capture tree or any defect record was written.

## The question

The movie completes every drawn corner (42 samples, 35.31 route units, tested prefix 41)
and then freezes on the rail plan `walk -> (-42, 51.05, 9)`, reason *"standing clear of the
span he is testing"*, while W-7744 holds on `body-clearance`.

## The four captured values that constrain any answer

| value | captured |
|---|---|
| `finalState.autopilot.routeAction` | `direct` |
| `finalState.autopilot.stillTime` | `0` |
| `finalState.autopilot.teleportNudgesTotal` | `0` |
| player pose | exactly unchanged for the whole stall window |

`direct` is not `unreachable` and not `idle`; `stillTime 0` with `nudges 0` means the stuck
watchdog never armed, which in `primitives.ts:2400` can only happen if **no movement control
was pressed**. Any explanation in which the body is pushing against a wall is excluded by
these two numbers alone.

## Candidate cause (independently derived from frozen source)

The standby target is arithmetic, not authored geometry:

```ts
// commonGroundDirector.ts:1950
const CG_STANDBY_CLEAR_OF_E = { x: E.x, y: E.y, z: E.z - 3 };   // (-42, 51.05, 9)
```

It is not in `CG_POSES` and not on any of the three routes. `CommonGroundWorld.tsx`
plants **no** ground — `createFooting` reads live terrain — so every authored pose sits at
y = 51.05 because that site was *qualified* against real terrain. This target never was.

With `VOXEL_SCALE = 2`, `worldToGrid` puts z = 9 in the cell centred at **z = 10**; the body
stands in the cell centred at **z = 12** — one cell away. Then, in
`agentSurfaceNavigation.ts`:

1. `:420` — a requested goal cell that is **not dry** is silently replaced by the nearest
   dry cell in ordered-offset order, radius 8 cells = 16 world units. **The body's own cell
   is inside that set.**
2. `:651` — candidates are tried **nearest-first, not cheapest-first**, and the start cell
   is trivially reachable.
3. `:742` — `if (chosen.path.length === 1 && mode === 'walk') { mode = 'direct'; reason = 'already-at-resolved-goal' }`.

Downstream, in `primitives.ts`:

4. `:1546` — `route.mode === 'direct'` ⇒ **`routeAction = 'direct'`** ✅ matches capture.
5. `:1222` — the sub-cell exact-goal rescue **refuses** (`goal-outside-terminal-cell`):
   z = 9 vs terminal centre z = 12 is 3 units, far outside the half-cell bound.
6. `:1607` — the single waypoint is the body's **own cell centre**, so `steerFreeToward`'s
   0.2 dead zone clears forward/backward/left/right. **No input is ever issued.**
7. `:2400` — `pushing === false` ⇒ **`stillTime = 0`**, and the unstick escalation, which
   requires `pushing`, never runs ⇒ **`nudges = 0`**. ✅ both match capture.
8. `walkToward` still measures 3.16 units > the 0.6 stop radius, so **arrival is never
   declared** and the rail republishes the identical plan every frame.

The other half of the deadlock is authored and correct: `commonGroundActor.ts:249` blocks
his *next* step when the horizontal gap to her would fall under 1 unit (measured separation
now 1.0026), and he is deliberately never allowed to displace her. Neither body can move.

## Ruled out

- **`world-navigation-unavailable`** and **`different-face-direct-fallback`** also report
  `direct`, but both set the waypoint to the *goal*, so input would be pressed — excluded by
  `stillTime 0` / `nudges 0` (and faces match here anyway).
- **`unreachable` route** — would report `routeAction: 'unreachable'`.
- **Physical obstruction while pushing** — that is precisely what the watchdog counts; both
  counters are zero.
- **`screeningSettling()`** — sets `idle`.
- **Arrive radius 0.6 being too tight** — the gap is 3.16, not marginal. No threshold
  weakening is implied, proposed or acceptable.
- **"Press F Reopen"** — explicitly not inferred. Reopening the tail removes neither the
  non-traversable standby column nor the 1-unit clearance geometry; the same plan would be
  republished the moment she is again on his span.

## What is still unmeasured

*Why* the cell at (-42, ·, 10) is not dry — water, a ceiling inside `clearanceCells`, no
support column, hazard, or the `edgeMarginCells` test — is **not established**. Root's
water/cliff pixels in raw0054 are *consistent* with it but prove no footing and no cause,
and this audit does not lean on them. The planner's actual `reason` string is inferred from
`mode === 'direct'` plus exclusion of the other two direct-producing branches; the capture
records the action, not the reason. **No live terrain sample, route replay or browser
measurement was taken.** A CPU-only reproduction was scoped and deliberately **not run**:
the only run-local seed (3215739679, world `-1,-1`) belongs to the partial-continue fixture,
is not proven to be survey-movie-1's world, and `planetSize` is not recorded in the capture —
the number would have looked like proof of the wrong world.

## Smallest live discriminator

One read-only frame at the existing stall pose: call
`planAgentSurfaceRoute(terrain, planetSize, playerPos, (-42,51.05,9))` and log
`{ mode, reason, waypoints.length, resolvedGoal, requestedGoalWasWet, visitedCells }`, plus
the classification (support height, dry, wet, waterDepthCells, bodyBlocked) of the cells
centred (-42,10), (-44,10), (-40,10), (-42,8), (-42,12). `reason:'already-at-resolved-goal'`
with `waypoints.length === 1` confirms the cause outright; `requestedGoalWasWet` then
separates water from blocked/unsupported. No mutation, no progress setter, no threshold
change. A CPU-only variant first needs the capture to record that world's seed and planetSize.

## Repair scope — recommendation only, nothing authorized

- **A — author the standby pose** (`commonGroundDirector.ts:1950`): stop deriving it from
  `E.z - 3`; qualify it like every other pose, on plateau the chapter already stands on
  (e.g. the z = 14..22 side of the long route, comfortably >1 unit off his span). Smallest
  blast radius, no shared-code change.
- **B — surface the degenerate route** (`agentSurfaceNavigation.ts:742` + `walkToward`): a
  resolved goal that *is* the start cell, while the requested goal is still beyond the
  caller's stop radius, is a refusal, not a route. Reporting it as one turns this whole class
  of silent freeze into a named failure. Shared navigation code — belongs to that module's
  owner and needs its own regression evidence. It does not by itself make the point reachable.
- **C — qualify rail targets at publish time**: run any rail walk target through the footing
  predicate the chapter already trusts before publishing it. Closes the general gap that poses
  and routes are terrain-qualified while *derived* targets are not.

None of these may be implemented as a weakened threshold, relaxed footing, endpoint credit or
teleport rescue.
