# Integration — navigation / Continue repair report

Run `2026-09-05-after-the-hearth` · integration-engineer · written **2026-09-06T13:47:05+00:00**
Direction `navigation-repair-direction.json` · defects **CG-IMPL-010 / 011 / 008**
Contract scene-v2 `4dbf722b…dff88e` — **unchanged**. No creative decision was made here.

**Not acceptance. Not chapter verification. No publication.**

---

## 1. What was wrong

### CG-IMPL-010 — VF4-SURVEY-STALL-1 (navigation)

The stall is **arithmetic, deterministic and unsatisfiable** — not a collision, not ground, not luck.

1. Chapter 13 aims `CG_RAIL_CORNER_OVERSHOOT` **0.6 through** each route corner — a signed device that
   keeps arc credit at or under real displacement. At `CG_ROUTE_LONG[1]` `(-26, 51.05, 14)` the published
   goal is `(-26, 51.05, 14.6)` with `arriveRadius` **0.35**. Exactly the captured rail.
2. `worldToGrid` quantizes `Math.round(w / VOXEL_SCALE)` with `VOXEL_SCALE = 2`, so `14.6` and `14.0`
   are the **same cell**. Every A* waypoint, including the terminal one, is
   `voxelCoordToWorld(cell.support)` — a **snapped cell centre**, never the exact goal.
3. `nextNavigationStep`'s consumption loop stops at `waypoints.length - 1`, so that centre stays the
   steering target forever.
4. `steerFreeToward` releases **all four controls** within tangent radius **0.2** of it.
5. `walkToward` arrives only on the distance to the goal the caller actually asked for.

> Closest possible approach while steering is live: **0.6 − 0.2 = 0.4 > 0.35**.

The body parks, the rail keeps publishing `action: walk`, forever. It recurs at *every* later corner
(cursor 4 `x −30.6`, cursor 8 `z 22.6`, cursor 13 `x −42.6`, each ≈0.75 short) because each is the same
±0.6 overshoot past an even vertex — which is why one nudge could never repair the remaining route.

**`stillTime = 0` beside a bit-identical body is fully explained.** The stuck watchdog accumulates only
`if (pushing && horizontalDelta < 0.06)`, and `pushing` is the OR of the four controls. The navigator
issues *nothing*, so `pushing` is false and the timer resets every frame. It is not measuring the wrong
body — it is correctly disarmed. **No timeout teleport, nudge or rescue escalation was enabled.**

### CG-IMPL-011 / 008 — the Continue loss

Two coupled defects, isolated by ordering rather than inferred from the storage snapshot:

- **Restore shadowing.** `commonGroundSnapshot` returned a cached live snapshot *before* consulting the
  staged payload. `restoreCommonGroundForWorld` is a world-keyed React effect, so an empty placeholder
  minted by an earlier read permanently shadowed the earned bytes staged a moment later.
- **Destructive autosave.** `saveWorld` writes a whole new record; `commonGround` was
  `serializeCommonGroundForWorld(worldId) ?? undefined`. A placeholder overwrote the earned blob with
  emptiness (1186 → 606 bytes, 4 samples → 0); a `null` would have deleted it outright.

The write is **not** attributed to clicking Continue: boot, the placeholder-minting *read*, the world
switch and the world-change autosave are stepped separately, and the read is named as the culprit frame.

**`PC-CONTINUE-RESUME-POINT` is a fixture predecessor gap, not a wrong-world-selection bug.** The deep
link seeded `ch13-fault-reviewed` + `ch13-return-chosen` but never `story:ch13-origin-landed`, and
`storyEntryPoint` resolves precisely that set to `ch13-return`. Proved both ways: without the milestone
the entry is `ch13-return`; with it, `ch13-survey`, and the same saved bytes resume the drawing.

---

## 2. The repair

**Navigation** — `terminalExactGoalHandoff` + `applyTerminalExactGoal`. At the terminal waypoint *only*,
the exact goal takes over the last leg when **all** hold: the planner resolved the goal's own cell
(`dry-surface-path` / `already-at-resolved-goal`, not wet, not substituted); same face, no cross-face leg;
not a water/jetpack leg; the goal lies inside the terminal cell's tangential footprint; and every further
column the capsule actually overlaps is certified **by the same planner at the same surface height**. The
aim then moves *tangentially only*, at the height the planner cleared, and the body walks the rest under
ordinary directional input.

Two asymmetries, both matching the planner's own contract: only the **tangent** axes are compared
(`worldToGrid` projects onto `tangentU`/`tangentV`; the normal index is not cell identity, and foot goal
51.05 / grounded 50.989 / waypoint 52.85 are three legitimate conventions for one place), and the
footprint is **certified against real terrain** rather than capped by an arbitrary offset limit, so a
signed 0.6 overshoot stays reachable wherever the ground is genuinely safe.

Not done: arrival radius unchanged · dead zone value unchanged (only *named*, so the arithmetic is
testable) · no authored pose/route/proof touched · no corner credit increased · no distance paid by
endpoint motion · no clamp, teleport or grant · no rescue · navigator not bypassed.

**Shared-walker compatibility, proved rather than asserted:** before, arrival needed
`stop ≥ 0.2 + |goal − centre|`; after, only `stop ≥ 0.2`. The second is implied by the first for every
offset, so **no goal that used to be reached can stop being reached**. The smallest stop radius in any
shipped rail is 0.3. Terrain, hazard, water and cross-face protection are untouched because the handoff
never leaves a certified cell and is refused outright on those cases.

**Continue** — `serializeCommonGroundForWorld` returns null when it cannot speak for a world; `saveWorld`
**carries the persisted blob forward** instead of dropping or replacing it; a staged payload may take over
an empty placeholder but **never real progress**; a world is *settled* only when its restore found
**nothing** (absent/legacy) or when a payload actually **validated** — a completed read of a present
payload settles nothing; and `clearCommonGroundForWorld` now removes the stored chapter field so
carry-forward cannot resurrect it.

---

## 3. Root's review items — all closed in source

| item | resolution |
| --- | --- |
| **NAV-HEIGHT** | `certifyColumn` returns the planner's *resolved surface*; the helper compares it against the terminal along `up` and refuses beyond half a cell (`footprint-height-mismatch`). Dry is not safe — a wall top and a pit floor are both dry. Proved with in-cube stepped terrain, raised and lowered both refused, flat control still allowed. |
| **NAV-RUNTIME-SEAM** | A test drives the real `autopilotTick → ch13 rail → walkToward → nextNavigationStep → steerFreeToward` in movie mode at the captured frozen pose, observing only shipped `getAutopilotControls()`. Same spec on pre-repair bytes: **`expected 0 to be greater than 0`** — no control on any of 30 frames. |
| **NAV-EXACT-CACHE** | Cached per *(plan, exact goal)*; the route cache tolerates ~1 unit of drift, so a stale certification can no longer authorise a moved target. Probes re-run only on real target change; no full A* forced. Focused same-plan test: two sub-unit-apart targets, two different lawful answers. |
| **SAVE-ENTRY-BEFORE-RESTORE** | The first `entered` candidate was **withdrawn** — beat entry as ownership would have made the placeholder authoritative and reinstated the bug. Ownership is now driven only by persistence. Covered: entry before staging, restore that finds nothing, and a new action after a bare entry. |
| **SAVE-SCOPED-CLEAR** | Clears live/pending maps **and** the stored chapter field only; structures, campfires, habitat and other worlds untouched. clear → save → reload does not resurrect it. |
| **SAVE-ENTRY staging window** (13:41) | A completed read of a *present* payload no longer settles. An autosave landing between staging and hydration keeps the earned bytes, which then hydrate on the next tick. |
| **SAVE-ENTRY foreign payload** (13:41) | Now rewrites the **actual stored record** and goes through the real restore route. A rejected payload deliberately does not settle, so local empty state can never overwrite it. |

---

## 4. Changed paths (exact SHA)

| path | before | after |
| --- | --- | --- |
| `main/src/story/autopilot/primitives.ts` | `4cce7261…13ca` | `a6da0551…a4ae` |
| `main/src/story/autopilot/primitives.test.ts` | **null** (demonstrably absent) | `158f5ac9…2f2d` |
| `main/src/story/commonGroundState.ts` | `2094b261…db2bf` | `681846b7…87a6` |
| `main/src/story/commonGroundDirector.ts` | `5688b86e…4d6b3` | `23bd8ea5…921f` |
| `main/src/story/commonGroundDirector.test.ts` | `58bc30b4…3008` | `8584dc5c…87ac` |
| `main/src/game/systems/persistence.ts` | `c8d51b1d…5404` | `f68be69f…631d` |
| `main/src/game/systems/persistence.test.ts` | `c0c2b159…d734` | `9c1dd65d…517a` |

All seven are inside `production-lock.allowedPaths`. **6 of the 97 manifest files changed; unexpected
drift on the other 91: none.** 323 pre-existing dirty files preserved. No protected, shared or global
workflow file touched. **`git checkout/reset/restore/stash/clean` was never invoked.**

---

## 5. Checks

| command | cwd | exit | result | log sha256 |
| --- | --- | --- | --- | --- |
| `npm run verify` | `/home/thomasphillip/Projects/vox/main` | **0** | 350 files / **3137** tests | `e6f6afdb…daa5` |
| `npm run story:ux:check` | same | **0** | 9 files / 94 tests | `77c95c2b…7a45` |

`verify` covers catalog, scene-AV, creative-workflow, chapter registry, chapter journey, typecheck,
preview, audio diagnostic, story ladder, guidance targets, story authority, tests, audio, build.

**Test totals:** baseline `preRepairV2Baseline = 3091` (349 files) → **3137** (350 files).
**+46 added, 0 removed, 2 changed.** Added: primitives 29, director 11, persistence 6.

The two changed cases were made *lifecycle-faithful*, not weakened: the empty-restore control now runs
the world's restore in its first session too (the runtime always does; the test omitted it), and the
foreign-actor case now goes through the real on-disk route instead of a hand-staged copy. Every original
assertion in both is retained.

## 6. Counterfactuals

| probe | pre-repair | repaired | restore |
| --- | --- | --- | --- |
| `tmp/continue-counterfactual.py` | `phase=idle samples=0 bytes=563` | `phase=drawing samples=4 bytes=909` | verified |
| `tmp/runtime-seam-counterfactual.py` | `expected 0 to be greater than 0` | 1 passed | verified |
| `tmp/navigation-counterfactual.py` | exit 1 | — | verified |

All Python `try/finally` with sha256 assertions on both ends; the immutable before-source was re-hashed
after every run and never mutated. The third probe is **weak and reported as such**: on old bytes the
suite fails at import because the new exports do not exist, so it shows API absence, not behaviour.

**Temporary-path honesty.** `main/src/story/__continue-counterfactual.test.ts` was created **outside
allowedPaths** for the duration of one script. It did not pre-exist (the script refuses to run if the path
is occupied), removal is proven in the `finally` block and was independently re-checked, and it was
harness code, never game production code. Root observed it and asked that later temporary work reuse an
allowed file — the runtime-seam counterfactual does exactly that, writing into the already-allowed
`primitives.test.ts` with byte-exact backup and hash-verified restore.

**Reproduction timing, stated plainly:** the in-suite pre-fix reproduction and both behavioural
counterfactuals were written and run **after** the repair edits began. They are not claimed to predate any
edit; the pre-edit work was source reading, which is what established the arithmetic cause. An early draft
of the navigation tests also placed the body in the **grounded** frame instead of the capsule **centre**
frame the navigator actually reads, and two cases failed for the wrong reason until that was corrected.

---

## 7. Unresolved

- **HABITAT-CARRY-SYMMETRY** *(observation, not fixed)* — `saveWorld`'s `habitat` field still has the
  shape the old `commonGround` one had, so an autosave for a world whose habitat is not live would drop
  it. **Not demonstrated by any capture** and outside this defect scope, so deliberately left alone rather
  than silently widened. Flagged for routing.
- **FOREIGN-PAYLOAD-WORLD-STAYS-UNSETTLED** *(documented consequence)* — a world holding another actor's
  payload never settles, so this actor cannot write empty chapter state there. Intended conservative
  branch; explicit clear reclaims the record.
- **VF4-HARNESS-MARKER-1** — pre-existing verifier harness gap, untouched.

## 8. Boundary between source proof and physical verification

**Proved here:** the cause and fix through the *real* Origin generator, the *real* A* planner, the *real*
steering intent and dead zone, the *real* arrival measure, the *real* `autopilotTick` control output, and
— for Continue — the *real* `saveWorld`/`loadWorld`/restore/world-selection/autosave sequence with the
exact captured bytes.

**Not proved here:** anything about hardware, rendering, hearing, frame budgets, feel or gameplay
acceptance. **No such claim is made from unit tests.**

**Required next, independently:** headed-hardware re-run of the ch13-survey demonstration walk through all
rail vertices with no rescue; the opt-in 30 s stall check returning exit 0; an actual partial-Continue
capture (earn → save → Continue → samples retained → a new act accepted and its AV activated); and the
remaining `notMeasured` items in `verification-world-final-report.json`.

⚠️ Preview **40131 is immutable PRE-REPAIR source** and must not be used to validate this source.

Source is frozen for root review. Root alone owns manifests, gates, ledgers and readiness — none edited.
