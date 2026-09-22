# ch13-return reset & CG012 standby — read-only source audit

Recorded **2026-09-06T15:29Z** (probe/repro ran 15:25–15:29Z UTC). Fresh read-only
mechanical source auditor, opus. **Not** an acceptance, not a defect closure, not a
repair authorization. Companion: `handoff-standby-source-audit.json`.

Nothing was written outside `handoff-standby-source-audit.{json,md}`,
`verifier/probes/handoff-standby-audit/`, `logs/handoff-standby-audit/`. No game
source, contract, defect record, capture, shared probe or other role artifact was
touched. **No browser, no GPU, no build, no verify.** Existing GPU evidence
unchanged. Source manifest
`1a50c19f…8a61e8` treated as frozen; the flight-discriminator's own
before/after rehash (98/98 match, aggregate `a2f8a691…04ce7f6`) is the standing
proof of that freeze and is unaffected by this audit — I read files, never wrote
them.

Inspected file hashes (sha256, current on disk at 15:29Z):

| file | sha256 |
|---|---|
| `main/src/App.tsx` | `36abbf3822b828bc0e28f617ba0e5a1b436f39c2dab0b2e86e29683736b81980` |
| `main/src/story/tidegardenRoute.ts` | `e7237efcf339efb599222a171a22b0c4b118712025f3f777030c08482b7e103e` |
| `main/src/state/systemFlight.ts` | `9ca9c8580cbf83886814b820bbdcbba01320fbeb5fe0a37bfc275b59137ae77d` |
| `main/src/components/ShipController.tsx` | `57dc26174b70a5f171ee49512538b575c3ad6bb4c929eeeed606461fd7d2e6d3` |
| `main/src/components/EfficientScene.tsx` | `ab95dfe4d2dbb59bbaa22e4fdf60faf8f4fa4f9fd959040bfe17fdb4a776f995` |
| `main/src/components/SystemTravelDriver.tsx` | `7f330ffcdd71326e735b6b3e180ec4bc6f6f1b1afefe4daf8970cc1c7659b2f4` |
| `main/src/story/commonGroundDirector.ts` | `980590b0add81f8e0ce6bdc182cb834940af336454435ff4d304a64e47ad11b5` |
| `main/src/story/commonGroundState.ts` | `7a3c03fb73cb715116ddbf1952fc2c312f52d1dac68b765b8097f4becdb0452e` |
| `main/src/utils/agentSurfaceNavigation.ts` | `7e5046d37aeb21b2ef36988b98504ad37a117f9c9b536fa4619db0dda78f8279` |
| `main/src/game/starSystem.ts` | `8900fca3cf640bc0fe5c90666c1e355e7d08dd0e569622af27588585490ce145` |

---

# TASK A — the ch13-return reset is a story-world reclaim, and the mechanism is now proven

**The generic same-system handoff WORKS. It commits to Origin. The chapter world
binding then reclaims the departure world one render later, and the ship
controller re-seats the ship on the hearth pad.** This is not a parked ship, not
an unready shell, not an aim cone, not a speed budget.

## The one line that causes it

`main/src/story/tidegardenRoute.ts:128-131`

```ts
const CROSSING_DESTINATION_WORLD_ID: Readonly<Record<string, string>> = {
  'ch8-crossing': TIDEGARDEN_WORLD_ID,
  'ch10-ask': STORY_PRIMARY_WORLD_ID
};
```

`'ch13-return'` is **absent**. Its own docstring (`:118-127`) describes this exact
failure for chapter 10 — "the ship relaunched, crossed, was reclaimed, and
relaunched again, eighteen times over, and `activePlanetId` could never leave the
sibling" — and the boot resolver's comment (`:88-96`) even says ch13-return "is
owned by the world it launches from, **exactly as ch10-ask is**". `ch10-ask` is
listed in the runtime map. `ch13-return` was not. Chapter 13's *landed* beats
(`ch13-survey`, `ch13-common`) were correctly added to the boot resolver's
`originOwnedBeat` set at `:97-99`; only the in-flight beat's runtime entry was
missed.

Identities (`main/src/game/starSystem.ts:90-94`, slot 0 has no `:pN` suffix):
`STORY_PRIMARY_WORLD_ID = '-1,-1'` = **Origin** (destination);
`TIDEGARDEN_WORLD_ID = '-1,-1:p1'` = **hearth/departure**.

## Executed reproduction (CPU-only, shipped module, no game change)

`verifier/probes/handoff-standby-audit/resolver-repro.mjs` bundles the *shipped*
`main/src/story/tidegardenRoute.ts` out-of-tree with the repo's own esbuild and
calls the real exports in node. Output —
`logs/handoff-standby-audit/resolver-repro.log`:

| case | beat | currentWorld | activePlanetId | `resolveStoryRuntimeWorldId` | verdict |
|---|---|---|---|---|---|
| pre-handoff | ch13-return | `-1,-1:p1` | `-1,-1:p1` | `-1,-1:p1` | stable |
| **post-handoff (committed)** | **ch13-return** | **`-1,-1`** | **`-1,-1`** | **`-1,-1:p1`** | **SWAPS BACK** |
| post-landing | ch13-survey | `-1,-1` | `-1,-1` | `-1,-1` | stable |
| post-landing | ch13-common | `-1,-1` | `-1,-1` | `-1,-1` | stable |
| **control** | **ch10-ask** | **`-1,-1`** | **`-1,-1`** | **`-1,-1`** | **stable** |
| control | ch8-crossing | `-1,-1:p1` | `-1,-1:p1` | `-1,-1:p1` | stable |

This is an **executed** result on shipped code, not a traced branch. The ch10-ask
control is identical committed state and is protected; ch13-return is not.

## The runtime chain (traced from source, corroborated by measured telemetry)

1. `App.tsx:1264-1298` `beginPreparedSystemTargetHandoff` → `onMidpoint` calls
   `commitSystemPlanetHandoff({worldId:'-1,-1', renderOrigin:[0,0,0]})`
   (`state/systemFlight.ts:203-232`), `enterAtmosphere()`, and
   `setCurrentWorld(Origin)`. Its story gate at `:1268-1271` passes because the
   Tidegarden route is online. **The generic path is not the problem.**
2. `App.tsx:537-545` recomputes `storyRuntimeWorldId` on the next render. With
   `ch13-return` missing from the table it answers `-1,-1:p1`, so
   `storyWorldSwapPending` is true.
3. `App.tsx:622-634` (the story-world swap effect) fires:
   `setPreviousWorld` → `resetSceneReady()` → `setCurrentWorld(hearth)` →
   `setArrivalMode('surface')`.
4. `EfficientScene.tsx:744` passes `activePlanetWorldId={commandContext.world.worldId}`
   — now the hearth again — into `ShipController`.
5. `ShipController.tsx:459-477`: same `systemId`, so the interstellar branch is
   skipped and the `else if` at **:472-473** runs
   `setActiveSystemPlanet('-1,-1:p1')`, then re-acquires the pose lease and
   republishes `planetLocalPoseToSystemPose(boarding pad, hearth position)` at
   **:476-478** — the ship is back on the pad.

## Why the second mutator is *proved*, not guessed

The commission forbade asserting an unproven mutator. Telemetry
`logs/flight-discriminator/telemetry.jsonl` at the first boundary (perfMs
41 110 → 41 400, one 290 ms gap):

```
41110  ep3  local_space  active -1,-1:p1  target -1,-1  renderOrigin [2180,-110,-1635]
41400  ep5  atmosphere   active -1,-1:p1  target null   renderOrigin [0,0,0]
       pose [2187.9,-58.5,-1643]  (hearth boarding pad)
```

- `renderOrigin` is **`[0,0,0]` = Origin's system position**, with
  `locationMode:'atmosphere'` and `target:null`. Only
  `commitSystemPlanetHandoff` (`systemFlight.ts:214-224`) produces that exact
  triple. **The Origin handoff demonstrably executed** (epoch 3→4), which also
  answers the discriminator's open question: a transient
  `activePlanetId === '-1,-1'` existed inside the unsampled gap.
- Epoch 4→5 returns `activePlanetId` **and** `lastActivePlanetId` to `-1,-1:p1`
  while `renderOrigin` **stays `[0,0,0]`**. Of the only three mutators that can
  change `activePlanetId`, `commitSystemPlanetHandoff` would have rewritten
  `renderOrigin` to the hearth's position and `resetSystemFlightForInterstellarArrival`
  would have rewritten `renderOrigin` and `systemId`. Neither did. Only
  `setActiveSystemPlanet` (`systemFlight.ts:189-200`) leaves `renderOrigin`
  untouched while setting both ids. **The second increment is
  `setActiveSystemPlanet('-1,-1:p1')`.**
- Of its two call sites, `EfficientScene.tsx:648` is unreachable here: its effect
  returns early while `controlMode === 'flight'` (`:622`) and unconditionally
  calls `setSystemLocationMode('surface')` at `:650` — the observed mode stayed
  `atmosphere`. **The executing call site is `ShipController.tsx:472-473`**, which
  also explains the stale-frame signature of the resulting state: a hearth-local
  pad pose published while `renderOrigin` still names Origin.

Epoch 3→5 and 6→8 are therefore fully accounted: `+1` handoff, `+1` reclaim. The
37.2 s period is one full launch-and-cross, and `onOrigin()`
(`commonGroundDirector.ts:804-806`) is true only inside the unsampled sub-290 ms
window, in which the ship is nowhere near `CG_POSES.W`, so `tickReturn`'s landing
block (`:862-869`) can never fire and `story:ch13-origin-landed` stays false.

## Smallest correction seam

**One entry in one shipped table**, in the module that already documents this
class of bug:

```ts
// main/src/story/tidegardenRoute.ts:128-131
'ch13-return': STORY_PRIMARY_WORLD_ID
```

Nothing else. Specifically it does **not** touch `resolveStoryBootWorldId`, so a
reload/Continue mid-crossing still restarts from the world the ship launched
from (the documented physical rule) — adding `ch13-return` to `originOwnedBeat`
instead would boot the player onto Origin without flying, which is a teleport in
all but name and is rejected here.

Why this is the minimum and is safe by construction: `resolveStoryRuntimeWorldId`
(`:138-154`) only honours the table when `routeOnline && currentWorldId ===
destination && activePlanetId === destination` — i.e. **only after the shipped
generic handoff has already committed**. It grants no milestone, no teleport, no
`targetReady` bypass, no distance tolerance, no speed change. It preserves the
station chapter, ch10 and ch12 (their beats are unchanged), keeps the crossing a
natural same-system flight, and leaves saved active-planet/world routing to the
untouched boot resolver. Post-landing beats already resolve to Origin
(reproduction rows 3–4), so the landing sticks without any further change.

**Geometry / agency / copy / AV change required: none.**

## Meaningful regression / control that would falsify the fix

1. **Positive:** one live ch13-return capture must show `activationEpoch`
   advancing by exactly **+1** at the envelope, `activePlanetId` becoming and
   **staying** `-1,-1`, `renderOrigin` `[0,0,0]`, and no pose jump back to
   `[~2188,-58,-1643]`. A second 37.2 s cycle appearing falsifies it.
2. **Control (must not change):** ch8-crossing and ch10-ask captures must still
   commit and hold their destinations, and a reload during ch13-return must
   still open on the hearth (`resolveStoryBootWorldId` unchanged) — if a reload
   now opens on Origin, the wrong seam was edited.
3. **Unit-level falsifier:** the reproduction table above re-run after the change
   must flip only the ch13-return post-handoff row, leaving all five other rows
   byte-identical.

## Uncertainty, stated plainly

- Steps 2–5 of the runtime chain are **traced branch implication plus measured
  state**, not a live instrumented read of the React effect order; the executed
  reproduction covers the resolver only. What is *proved* by evidence: the
  handoff committed to Origin, and `setActiveSystemPlanet('-1,-1:p1')` from
  `ShipController.tsx:472-473` reverted it.
- I did not read `targetReady`, the aim cone, or `getSystemTravelAssistTarget()`;
  they are not needed — the handoff committing proves the approach path
  succeeded.
- No live observation was made by me at all. Every runtime number here comes from
  the flight-discriminator's existing telemetry.

---

# TASK B — CG012 standby: the target is off-lattice, and a qualified one already exists in the authored footprint

## New, decisive fact from the authored data (no terrain sample needed)

`main/src/story/commonGroundState.ts:68-118`. **Every authored pose and every
route vertex in this chapter sits on even `x` and even `z`** — R, S, E, C, H, W,
T and all 9 + 19 + 10 route vertices. With `VOXEL_SCALE = 2` and
`worldToGrid` = `Math.round(coord / VOXEL_SCALE)`
(`utils/agentSurfaceNavigation.ts:218-226`), **even world coordinates are exactly
voxel-cell centres**. The chapter is authored on the lattice.

`CG_STANDBY_CLEAR_OF_E` (`commonGroundDirector.ts:1950`) is the **only** target in
the chapter that is not: `E.z - 3 = 9` is odd. `round(9/2) = 5` → the cell centred
at `z = 10`, and `z = 9` is that cell's lower boundary — the maximum possible
distance (3.0 units) from the terminal cell centre the body occupies (`z = 12`,
from ground pose `[-41.965, 50.989, 12.156]`). That is why the sub-cell exact-goal
rescue refuses with `goal-outside-terminal-cell` and why the freeze is structural
rather than incidental: **this target could not be handed off even if its cell
were dry.** The prior standby-source-audit's chain (`:420` dry-cell resolution →
`:651` nearest-first → `:742` `already-at-resolved-goal` → `direct`, one waypoint
on the body's own cell, dead zone → no input → `stillTime 0`, `nudges 0`) is
consistent with every captured field and I found nothing that contradicts it.

Two distinct faults, only one of which the earlier audit named:

- **B1 (now established from authored data):** the target is off-lattice by
  construction. Independent of terrain.
- **B2 (still unmeasured):** the cell centred `(-42, ·, 10)` was additionally
  rejected as a goal cell — otherwise the resolved goal would have been that cell
  and she would at least have walked. *Why* it is unsuitable (wet / unsupported /
  clearance / edge margin) remains unmeasured; I took no terrain sample. Note the
  authored, qualified pose `W = (-34, 51.05, 10)` proves the `z = 10` row is not
  globally unusable, so B2 is local to `x = -42`.

## Can a local standby be derived from existing physical footprint/route? — Yes

The chapter already owns terrain-qualified, walked geometry on the same column as
E. `CG_ROUTE_LONG` (`commonGroundState.ts:95-103`) contains
`(-42, 51.05, 14/16/18/20/22)`; survey-movie-1 walked 35.31 of its 36 units over
41 tested samples, so these are *measured* footing, not derived arithmetic.
Distances from the two things she must stand clear of —
his positioning leg `E(-42,12) → H(-40,12)` and the common route
`CG_ROUTE_COMMON` `(-42,12)→(-42,14)→(-42,16)→(-44,16)→…`:

| candidate | on common route? | min distance to common polyline | to E→H leg | lattice |
|---|---|---|---|---|
| `(-42, 51.05, 14)` | **yes** | 0 | 2.0 | ✅ |
| `(-42, 51.05, 16)` | **yes** | 0 | 4.0 | ✅ |
| `(-42, 51.05, 18)` | no | 2.0 | 6.0 | ✅ |
| **`(-42, 51.05, 20)`** | **no** | **4.0** | **8.0** | ✅ |
| `(-42, 51.05, 22)` | no | 6.0 | 10.0 | ✅ |
| `E.z-3 = (-42, 51.05, 9)` | no | 3.0 | 3.0 | ❌ **off-lattice** |

`(-42, 51.05, 20)` (or `22`) is a **long-route vertex the movie already walked**,
is a cell centre, is off the common span and off his positioning leg by far more
than the 1-unit body clearance `commonGroundActor.ts:249` enforces, and is
reachable from her stall cell by walking straight up the `x = -42` column that
the same route already traverses. **No new signed geometry is introduced — an
existing signed route vertex is reused.**

## Smallest in-scope correction seam (recommendation only; nothing authorized)

`main/src/story/commonGroundDirector.ts:1950` — stop deriving the standby from
`E.z - 3`. Either bind it to an existing qualified vertex, or (preferred, because
it stays derived from the physical footprint rather than a new constant) select
it *from* `CG_ROUTE_LONG`: the first vertex whose distance from every
`CG_ROUTE_COMMON` vertex and from the `E→H` segment exceeds the chapter's
clearance requirement. One chapter-owned symbol; both call sites (`:2371`,
`:2402`) inherit it. The signed S/E/H/C route, `CG_ROUTE_COMMON`,
`CG_ROUTE_LONG`, `CG_POSES`, the 1-unit worker/player clearance and all shared
navigation code (`agentSurfaceNavigation.ts`, `primitives.ts`) are untouched.
The published rail reason — "standing clear of the span he is testing" — stays
literally true, so **no copy, agency, geometry or AV change is required**; she
still walks there herself under ordinary movement.

The earlier audit's options B (surface the degenerate route as a refusal) and C
(qualify rail targets at publish time) remain correct and valuable, but they are
shared-code and belong to those owners; neither is needed to unblock CG012, and
neither should be bundled with it.

## Regression / control that would falsify this fix

1. **Positive:** the same navigation/survey lane must show `routeAction` leaving
   `direct` and `routeProgressUnits`/player pose actually changing after the
   standby is published, then a normal arrival inside the existing 0.6 stop
   radius — with **no** threshold, footing, arrive-radius or nudge change in the
   diff. Any weakened bound invalidates the result.
2. **Control:** W-7744's `body-clearance` hold must still engage if she *does*
   stand on his span (the 1-unit rule at `commonGroundActor.ts:249` must not be
   relaxed), and the short/long/common route tests in
   `commonGroundDirector.test.ts` must be unchanged.
3. **Falsifier for B2:** the read-only planner discriminator already scoped by the
   prior audit — now runnable, since the world identity is pinned (seed
   **3215739679**, coordinate **-1,-1**, `planetSize` **50**, `VOXEL_SCALE` 2,
   `totalvox` 125 000 = 50³, from raw `0054`). If it reports the candidate
   standby cell as dry with `waypoints.length > 1`, the fix is sound; if that
   cell also resolves to the start cell, the column is unusable and the candidate
   must move, not the thresholds.

## Limits of Task B

I ran **no** CPU terrain replay. Reconstructing the exact stall state needs the
live terrain generator plus the actor/occupancy state, and the capture does not
record `planetSize` itself — it is inferred from `totalvox 125 000 = 50³` on
screenshot `0054`, which is strong but is an inference, not a recorded field.
Everything asserted above about the lattice, the routes and the clearance
distances is **pure arithmetic on frozen authored constants** and does not depend
on that inference. B2's physical cause remains unmeasured, and the
manual-focused witness-1 `reference-occluded-survey-housing` hold is treated, as
instructed, as the authored required witness action — not a defect, and not
evidence of broken input.

---

No acceptance. No defect closure. No mutation. Stopping here.
