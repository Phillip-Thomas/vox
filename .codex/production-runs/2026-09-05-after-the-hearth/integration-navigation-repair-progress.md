# Integration — navigation / Continue repair progress

Run: `2026-09-05-after-the-hearth` · owner: integration-engineer (sole game-source writer)
Direction: `navigation-repair-direction.json` · defects CG-IMPL-010 / 011 / 008
Contract: scene-v2 `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e` (unchanged, unsigned by me)

## Phase 0 — inbox + evidence (complete, 2026-09-06T13:13:38Z)

Read: `integration-inbox.md` (through the 13:10:09Z FINAL NAVIGATION/CONTINUE REPAIR RELEASE entry),
`integration-navigation-repair-commission.txt`, `navigation-repair-direction.json`,
`repair-contract-disposition.json`, `producer-navigation-budget-decision.json`,
`verification-world-final-report.json`, `verifier-findings.json`,
`producer-partial-continue-review.json`, `verifier/captures/partial-continue/run-4/`
(summary.json + the four actual WorldSave byte files), `production-lock.json` allowedPaths.

Starting source rehashed BEFORE any mutation:
`implementation-source-manifest.json` file sha256 = `d9e36ae314ba547a292e55376d54eecbf0ff47dc3d6710c4f9b5ae3fee96caf2`,
97 files, **drift 0**. 323 pre-existing dirty worktree files inventoried; none will be reverted.
No git checkout/reset/restore/stash/clean will be used at any point.

## Phase 1 — cause established by source reading (complete)

### CG-IMPL-010 — VF4-SURVEY-STALL-1, exact-goal vs terminal-cell deadlock

Arithmetic, deterministic, not stochastic:

1. `commonGroundDirector.railGoal` aims 0.6 **through** a route corner
   (`CG_RAIL_CORNER_OVERSHOOT`, a deliberate signed device that keeps arc credit ≤ displacement).
   At `CG_ROUTE_LONG` vertex 1 `(-26, 51.05, 14)` the published goal is `(-26, 51.05, 14.6)`,
   `arriveRadius = CG_RAIL_ROUTE_ARRIVE = 0.35`. Matches the captured rail exactly.
2. `agentSurfaceNavigation.worldToGrid` quantizes with `Math.round(w / VOXEL_SCALE)`, `VOXEL_SCALE = 2`.
   `round(14.6/2) = 7` → the goal's own cell centre is world `z = 14`. Every A* waypoint, including
   the last, is `voxelCoordToWorld(cell.support)` — a **snapped cell centre**, never the exact goal.
3. `primitives.nextNavigationStep`'s consumption loop stops at `waypoints.length - 1`, so the
   terminal snapped centre stays authoritative.
4. `primitives.steerFreeToward` clears all four controls inside tangent radius 0.2 (`lengthSq < 0.04`).
5. `walkToward` arrives only when `gaitDistance(exact goal) <= stop`.

Closest approach to the goal while steering is still active = `0.6 − 0.2 = 0.4 > 0.35`.
**The arrival predicate is analytically unsatisfiable.** The body parks inside the deadzone of the
cell centre, the rail keeps publishing `action=walk`, forever.

Verifier measurement fits: frozen tangent distance to `(-26,14)` = 0.1485 (run-1: 0.1706), to the
signed goal 0.7307, `arriveRadius` 0.35, `holdReason` null, `supported` true, displacement exactly 0.

`stillTime = 0` during a bit-identical frozen body is fully explained by
`primitives.ts:2138/2147`: `pushing = forward||backward||left||right`, and `stillTime` only
accumulates `if (pushing && delta < 0.06)`. The navigator is not pushing **at all**, so the watchdog
is correctly disarmed. It is not measuring the wrong body. No timeout teleport/nudge will be enabled.

This is NOT collision, water, hole, rise/drop, cross-face or unreachable goal: the planner resolved
the goal's OWN cell (`reason: dry-surface-path`), and the discriminator moved the real body freely.
It recurs at every subsequent corner (cursor 4 `x −30.6`, cursor 8 `z 22.6`, cursor 13 `x −42.6` —
each ≈0.75 short) because every one of those goals is the same ±0.6 overshoot past an even vertex.

### CG-IMPL-011 / 008 — Continue: pristine snapshot overwrite + restore shadowing

From the actual run-4 bytes, the after-Continue `pvx.v1.world.-1,-1` save carries
`commonGround.worldId "-1,-1"`, `survey.phase "idle"`, `working null` — a **pristine live snapshot
was created for `-1,-1` and then serialized over the earned 1186-byte save (→606)**.

Two coupled source defects:

- **A — restore shadowing.** `commonGroundDirector.commonGroundSnapshot` (line 265-282) returns a
  cached live snapshot for the actor *before* consulting `takeCommonGroundWorldPayload`. Restore
  (`CommonGroundWorld.tsx:318-321`) is a React effect keyed on the ACTIVE world and therefore runs
  after the first director ticks. A pristine snapshot minted during boot permanently shadows the
  earned payload staged a moment later.
- **B — destructive autosave.** `persistence.saveWorld` writes a whole new `WorldSave`; the
  `commonGround` field is `serializeCommonGroundForWorld(worldId) ?? undefined`. A pristine live
  snapshot serializes to empty and replaces the earned blob; `null` would *delete* it instead.
  Either way the earned drawing is destroyed by a save the player never asked for.

`PC-CONTINUE-RESUME-POINT` (resume at `ch13-return`/`-1,-1:p1`) is separately classified: the
deep-link fixture seeded `ch13-fault-reviewed` + `ch13-return-chosen` but never
`story:ch13-origin-landed`, and `storyState.storyEntryPoint():280-281` resolves exactly that
milestone set to `ch13-return`. That resume point is **lawful for those milestones** — a fixture
predecessor gap, not a restoration defect. It will be demonstrated as such, and separately a lawful
continuous-equivalent save WITH its earned predecessor will be walked through the real seam.

## Phase 2 — reproduction before fix (next)

Planned boundary (all already inside production-lock allowedPaths; nothing new requested):

| path | status |
| --- | --- |
| `main/src/story/autopilot/primitives.ts` | edit |
| `main/src/story/autopilot/primitives.test.ts` | create (pre-allowed, currently absent) |
| `main/src/story/commonGroundDirector.ts` | edit |
| `main/src/story/commonGroundDirector.test.ts` | edit |
| `main/src/game/systems/persistence.ts` | edit |
| `main/src/game/systems/persistence.test.ts` | edit |

## Phase 2-4 — repair, review rework, checks (complete, 2026-09-06T13:47:05+00:00)

Both defects fixed inside the pre-allowed boundary; six of the 97 manifest files changed,
`primitives.test.ts` created (was demonstrably absent). **Unexpected drift on the other 91: none.**

Root posted eight review notes while I worked. All were read before each phase and all are
resolved in source, not in prose — see the report's `reviewItems` block. The five-item checklist
(`navigation-repair-open-review-items.json`) is closed: NAV-HEIGHT, NAV-RUNTIME-SEAM,
NAV-EXACT-CACHE, SAVE-ENTRY-BEFORE-RESTORE, SAVE-SCOPED-CLEAR, plus the two later
SAVE-ENTRY windows (staging/hydration race, on-disk foreign payload).

Counterfactuals (task-private, Python try/finally, hash-asserted both ends, no Git):

| probe | pre-repair | repaired |
| --- | --- | --- |
| `tmp/continue-counterfactual.py` | `phase=idle samples=0 bytes=563` | `phase=drawing samples=4 bytes=909` |
| `tmp/runtime-seam-counterfactual.py` | `expected 0 to be greater than 0` (no control, 30 frames) | 1 passed |
| `tmp/navigation-counterfactual.py` | exit 1 (API absent — weak, reported as such) | n/a |

Final gate: `npm --prefix main run verify` exit 0, 350 files / 3137 tests; `story:ux:check` exit 0.

## Phase 5 — report (complete)

`integration-navigation-repair-report.json` / `.md` written. Source frozen for root review.
No publication, no manifest/gate/ledger/readiness edit, no permission question.
