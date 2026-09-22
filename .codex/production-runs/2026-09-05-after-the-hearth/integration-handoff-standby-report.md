# Sixth bounded repair — CG-IMPL-013 (return handoff) and CG-IMPL-012 (standby stall)

Written **2026-09-06T15:53:10Z**. Integration engineer, single source owner.
Companion: `integration-handoff-standby-report.json`,
`integration-handoff-standby-progress.md`.

**Not an acceptance, not a defect closure, not a verification.** No publication.
No plot, copy, geometry, proof, score or camera change. No GPU or browser work.
No destructive git of any kind: `checkout`, `restore`, `reset`, `stash` and
`clean` were never invoked.

## What changed

| path | before | after |
|---|---|---|
| `main/src/story/tidegardenRoute.ts` | `e7237efc…8482b7e103e` | `f35f6b16…44e504bf` |
| `main/src/story/commonGroundDirector.ts` | `980590b0…4e47ad11b5` | `acc0d9cf…97166c46` |
| `main/src/story/commonGroundDirector.test.ts` | `8379b552…0ed1fb8492` | `1b8e76af…cb11a97b` |
| `main/src/App.test.tsx` | *absent* (null) | `f19a1e4a…cbe7bd271` |

Post-repair rehash of the 98 manifest files: **95 matched, 3 changed, 0 missing,
0 unexpected drift**, aggregate `2d1ab0d2…199d8cb`. Nothing else in the tree was
modified. All other pre-existing dirty bytes are untouched, and the dirty tree —
not HEAD — was the restoration baseline throughout.

Tests: **3139 → 3158** (+19: 10 in `App.test.tsx`, 9 in
`commonGroundDirector.test.ts`), files **350 → 351**. Nothing removed, nothing
changed, nothing weakened.

## A — the ch13 return crossing

The measured reset was not the flight. The generic same-system handoff committed
every time; `main/src/story/tidegardenRoute.ts` simply did not list
`'ch13-return'` in the runtime crossing table, so one render later the resolver
still answered the departure world, App's swap effect reclaimed it and the ship
controller re-seated the ship on the hearth pad — the +2 activation epochs the
telemetry recorded (3→5, 6→8) after reaching 181.23 and 169.09 inside the 185
envelope.

One entry restored:

```ts
'ch13-return': STORY_PRIMARY_WORLD_ID
```

`resolveStoryBootWorldId` is deliberately untouched, so a reload mid-crossing
still restarts from the hearth: **arrival stays earned by flying**. No boot-world
change, no driver/controller/state-reset change, no teleport, no `targetReady`
bypass, no radius or speed change, no granted milestone.

`main/src/App.test.tsx` (new) drives the **real** flight store through the real
`commitSystemBodyTarget` → `commitSystemPlanetHandoff` the app performs, then
evaluates App's own seam expression with the real resolver: post-handoff stable;
pre-handoff not early-origin; offline route uncommitted; mismatched
current/active uncommitted in both directions; the measured second mutator still
un-commits; ch8, ch10, non-crossing beats and reload/Continue unchanged.
**Counterfactual:** restoring the pre-repair table fails exactly the post-handoff
assertion (`Expected "-1,-1" / Received "-1,-1:p1"`), 9 others pass; bytes
restored and hash-verified.

## B — the standby

**Reproduced before touching source.** On the actual identity (seed
**3215739679**, world `-1,-1`, planetSize **50**, `VOXEL_SCALE` 2), the shipped
standby `(-42, 51.05, 9)` is **over water** — its cell has no solid column and
`isWaterVoxel` is true — and so is the lattice-aligned `(-42, ·, 10)`. From the
exact stall pose the shipped planner returns `requestedGoalWasWet: true`,
`already-at-resolved-goal`, **one** waypoint, resolved `z = 12`: the cell she was
already standing in. That is the recorded `direct` / `stillTime 0` / `nudges 0`
freeze, exactly. The off-lattice theory is **not** the cause.

**The audit's proposal is rejected on measurement, as root required.**
`(-42,20)` and `(-42,22)` are good ground and clear of COMMON — and they are
`0.00` from the LONG survey and `0.30` / `0.46` from her **actual recorded
offer**. They are on the span he is about to walk. Authored `W` was checked, not
presumed, and also fails: it is his occupied inspection pose and only `2.00` off
the short survey. `T` is his far reference and `2.00` from everything.

The repair is chapter-local and lives only where the old constant did. The
standby is now **selected** at runtime: the nearest candidate that the **live**
footing supports and that clears — from polyline **segments** — his current leg
through the untested remainder of the **recorded** samples, his `E→H`
positioning leg, `CG_ROUTE_COMMON` (also his independent test, and her own later
traversal) and his live body, by `2 × 1 + 0.6 = 2.6` units. Candidates are cell
centres on the dry shelf, each measured supported and reachable by the shipped
planner as a real `dry-surface-path` walk whose resolved goal *is* the request —
not a substitution labelled "arrived". **If nothing qualifies, the rail holds**
with a null target; the refusal is published, not hidden.

Untouched: `CG_POSES`, all three routes, the positioning legs, the 1-unit body
clearance, the 0.6 standby arrival, the 0.35 route arrival, cross-face/dry/
obstacle safety, `agentSurfaceNavigation`, `autopilot/primitives`, the exact-goal
handoff and every shared util. Nothing granted, nothing forced, no rescue, no
endpoint pumping, no new player action, no change to the witness/reference
occupancy, and no touch to CG-IMPL-009 or the ordered 18-unit proof.

Nine regressions run the **real** `createFooting` over the real generator —
every earlier chapter test used a flat fixture plot that answers "supported" over
water and would have passed on the broken target — plus the real planner, the
real actor walk and hold, and an arbitrary recorded excursion that forces the
selection to move. **Counterfactual:** restoring the pre-repair director fails 4
of the 9; the reproduction and the body-clearance control pass in both states by
design; bytes restored and hash-verified.

## Checks

`npm --prefix main run verify`, cwd `/home/thomasphillip/Projects/vox`, **exit
0** — 351 files / 3158 tests passed, build succeeded. Log
`logs/handoff-standby-repair/verify.log`, sha256
`54a473d489deff9e73bc8c1379955e31684907f1fb773eb3de0e6ecd765d7fa0`. The story,
registry, journey, authority, guidance/UX and scene-AV checks are the named
package scripts inside that one composite command; they were not re-invoked
separately and nothing was re-run without a change or a failure.

## Limits and what is still owed

Everything above is CPU: the real generator, the real footing, the real planner
and the real flight store under vitest. **No GPU acceptance is claimed.**
Still independently required, and none of it by me:

- a fresh headed capture of ch13-return: epoch **+1**, `activePlanetId`
  *staying* the origin, `renderOrigin [0,0,0]`, no jump back to the pad, no
  second 37.2 s cycle, and an actual landing — with ch8/ch10 and reload controls;
- a physical survey capture in which the standby is genuinely walked inside the
  unchanged 0.6 radius;
- the COMMON 18-unit ordered passage in a browser (CG-IMPL-009 remains
  unmeasured);
- lawful earned Continue, full story/station, AV variants, and the independent
  chapter reviews.

One boundary item for root's record: `main/src/App.test.tsx` was listed as an
allowed path but did not exist; it was created, not substituted, and no unlisted
path was edited.

Source is frozen at the hashes above. No gate compilation, defect closure or
review was performed here.
