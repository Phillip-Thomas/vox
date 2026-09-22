# Integration report — arrival + common steering (material repair 7 of 7)

Run `2026-09-05-after-the-hearth` · contract **scene-v3**
`5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54`
Direction `arrival-common-repair-direction.json` · defects **CG-IMPL-010**, **CG-IMPL-014**

Not an acceptance. Not a chapter verification. Not an independent verification.
`independentGPUStatus: not-run`. Publication remains unauthorized.
Machine-readable form: `integration-arrival-common-report.json`.

---

## 1. What changed

Five files, all inside the direction's `allowedSourcePaths`. No other source file
was touched, no path was created, no dependency was added, no generated file was
hand-written.

| path | before | after |
| --- | --- | --- |
| `main/src/story/commonGroundDirector.ts` | `acc0d9cf…` | `3b2b95cc…` |
| `main/src/story/commonGroundDirector.test.ts` | `1b8e76af…` | `54f9f767…` |
| `main/src/story/beats/objectivePrimitives.ts` | `8770c1ff…` | `c4c555d4…` |
| `main/src/story/autopilot/primitives.test.ts` | `158f5ac9…` | `08069b5b…` |
| `main/story-authority.json` | `a3026565…` | `7c403255…` |

99-file frozen manifest rehashed before mutation: **no drift**. After mutation:
exactly these five differ, 94 unchanged. `git status` entries 325 before and 325
after — every unrelated dirty file preserved, and no `git checkout`, `reset`,
`stash`, `clean` or `revert` was used at any point in this task.

`main/src/story/autopilot/primitives.ts` is **byte-unchanged**. The direction
allowed the shared primitive only if actual tests proved a need beyond
chapter-local steering; they did not, and the reason matters (below).

---

## 2. CG-IMPL-010 — the COMMON rail could not reach three of its own goals

### The cause, measured

Two walls meet on the western end of the polyline, and on this world they very
nearly touch.

**Floor.** The shared walker releases every directional control inside
`NAVIGATION_STEER_DEAD_ZONE` (0.2) of the point it is steering at. An aim that is
not further past a vertex than 0.2 lets the body park short, and `vertexReached`
demands an *actual crossing* at a turn — so the cursor can never advance, no
further goal is ever published, and the stuck watchdog never arms because it only
counts stillness while a control is pushing. That is the captured freeze exactly.

**Ceiling.** The exact-goal handoff survives only while the capsule footprint at
the goal is certified by the same planner, and that footprint reaches
`VOXEL_SCALE/2 − PLAYER_CAPSULE_RADIUS` = 0.5 from the cell centre. On a cube
planet the local up is *tilted*: discarding the normal component of the 1.8-unit
gap between an authored foot goal (y 51.05) and a waypoint carrying the planner's
clearance (y 52.85) leaves a real tangential residue of `1.8 · |up.x| · up.y`.

At **COMMON vertex 6, (-48, ., 18)** — one cell from the planet-face edge — that
residue is **~0.256** by the time the feet are at the vertex plane.
`0.2 + 0.256 = 0.456` against a reach of `0.5`: **the entire slack at that corner
is about 0.044 of a unit.** The shipped 0.6 aim spent it several times over, the
handoff was refused, the snapped cell centre stayed the steering target, and the
body parked 0.4356 from a goal it had to be within 0.35 of.

### The repair

* `CG_RAIL_CORNER_OVERSHOOT` 0.6 → **0.24** (above the 0.2 floor, below the
  ceiling at every COMMON corner including 6 and the terminal 9).
* the walker's stop radius for route waypoints split out of the cursor's vertex
  tolerance and made **smaller**: new `CG_RAIL_ROUTE_STOP = 0.15`, where the two
  used to be one 0.35. Conflating them is the other half of the deadlock — a stop
  radius larger than the dead zone can only be satisfied by luck, and every unit
  of it is subtracted from the corner aim's budget.
* `CG_RAIL_ROUTE_ARRIVE` stays **0.35**, untouched. It is the cursor's tolerance,
  not the walker's, and narrowing it was never needed.

The aim moved. The proof did not.

### Why not the audit's other options

The audit observed that an **outgoing-leg** overshoot would certify at vertices 3
and 6. It does not work: the residue at vertex 6 lies on the *incoming* axis and
is already there at zero overshoot, and an outgoing-only aim puts the goal exactly
*on* the incoming plane, so a body settling anywhere inside the release radius is
still short — which is precisely the Chapter Director's `outgoingAimCaveat`. The
audit also argued the **terminal vertex forced a geometry decision**. It did not:
with a 0.24 terminal aim, C's own cell certifies and the failing column
`(-48, ., 10)` is never requested. **No route, C or path relocation was made or
needed.**

### Why the shared primitive was left alone

The tangential residue is not an artefact to be optimised away. It tracks the real
tilted capsule: with the handoff taken, the waypoint sits ~0.26 further out so that
the *feet* land on the authored goal, and the tilted body genuinely does lean
toward the face-edge column at vertex 6. Removing the residue from
`exactGoalFootprintColumns` would make the very guard the audit says is *working*
less conservative, one cell from the planet-face edge. Refused.

### Explicitly not done

No wider arrival radius (the walker's radius was made **smaller**). No endpoint
credit. No relaxed prefix recovery. No disabled collider, water or cell check. No
nudge, teleport or grant. No longer blind timeout. No new player action.

---

## 3. CG-IMPL-014 — the arrival is part of the trip

`commonGroundGuidanceFacts` read the control mode first, so the instant the player
stepped out of the ship they had just landed at the audit site it published
`ch13:return:board` — *"Follow the hatch marker. [F] Board the Kestrel."* — and
kept publishing it for the whole walk to W-7744 (109 telemetry samples, 28.5
seconds, marker distance 208 → 37, while the autopilot's own route action was
`walk`).

It now asks the **world** first:

| actual state | rung | standing work order |
| --- | --- | --- |
| off Origin, on foot | `board` | unchanged |
| off Origin, boarded, grounded | `launch` | unchanged |
| airborne / transit / descent | `origin` | *Fly to Origin. / Follow the audit-site approach and land.* |
| grounded at Origin, still boarded | `origin-disembark` | *Disembark. / Follow the audit-site marker on foot.* |
| grounded at Origin, embodied | `origin-on-foot` | *Follow the audit-site marker on foot.* |

All three arrival phases publish the **same** id `ch13:return:origin`, the **same**
label `Origin · audit site`, the same `travel` kind and the same marker
requirement, so the existing same-id republish path replaces the standing copy
**silently** — one entry acknowledgement for the whole arrival, no score event, no
completion receipt. Both work orders are the exact signed scene-v3 strings; no
wording was authored here.

The existing disembark control remains the owner: no F task, no auto-arrival, no
second marker, no new key. The marker still resolves through the existing
authority to the real `CG_POSES.W`, never the hatch and never a zero coordinate.
And completion is untouched — `tickReturn` still requires the actual Origin world,
a grounded ship, an embodied control mode **and** the physical reach of W-7744
before `ch13-origin-landed`, `anc.cg.origin-landed` and the survey.

---

## 4. Tests

| | before | after |
| --- | --- | --- |
| test files | 351 | 351 |
| tests | **3158** | **3172** |

**+14 added, 0 removed, 0 skipped, 0 weakened.** All 14 are in
`commonGroundDirector.test.ts`. One pre-existing case in
`autopilot/primitives.test.ts` was **tightened in place**: two literal assertions
(`arriveRadius == 0.35`, `standoff > 0.35`) became strictly stronger invariants
(the published stop radius must not exceed the dead zone; the standoff must exceed
both the stop radius and the dead zone). Its subject is unchanged.

The new seam block walks the goal `commonGroundRailPlan` **really publishes** —
not a transcription of `railGoal`, which was the causal audit's own stated limit —
through the shipped Origin generator, the shipped A* with `nextNavigationStep`'s
option set, the shipped column certification, the shipped
`terminalExactGoalHandoff` / `applyTerminalExactGoal`, the shipped steering intent
and dead zone, the shipped `surfaceGaitDistance`, and the shipped **tilted** cube
up (`smoothUpForPosition`, which is what `EfficientPlayer` publishes — the
capture's up `(-0.019849, 0.999803, ~0)` *is* this function). The body is advanced
by an integrator that can only move along a direction the shipped steering asked
for, only while a control is held. It covers every COMMON vertex 1–9 — including
the unobserved 6 and the terminal 9 — plus positive-z and negative-x SURVEY
corners as the negative control the audit identified, plus a positive control that
an unsafe aim is *still* refused and still keeps the safe cell.

---

## 5. Counterfactual against the exact pre-repair bytes

Task-private byte restore from `.private/arrival-common-repair-backups`, new tests
left in place. **10 failed | 149 passed**, every failure by *value*:

```
walks the feet through every COMMON vertex plane, 6 and 9 included
  expected [ { vertex: 3 }, { vertex: 6 }, { vertex: 9 } ] to deeply equal []
aims through every corner …        cursor 2 aim: expected 0.6000000000000014 <= 0.5
publishes a stop radius …          cursor 1 stop radius: expected 0.35 <= 0.2
holds a directional control …      expected 0.35 <= 0.2
REGRESSION: stepping out on Origin …   expected 'board' not to be 'board'
asks for the disembark …           expected 'origin' to be 'origin-disembark'
only the actual on-foot reach …    expected 'origin' to be 'origin-disembark'
+ 3 more CG-IMPL-014 cases
```

The first line is the audit's prediction confirmed with the **real** functions and
the **real** published goals: vertices 3, 6 and 9, no more and no fewer.

**Restore proof.** The digest list taken before the counterfactual
(`after-hashes.txt`) and the digest list taken after restoring
(`restore-proof.txt`) are byte-identical — both files hash to
`232ca05c6586139fae2156cdc47197ec99869b733a607b5ac9e823875970ffc4`. `story:ux:check`
and `verify` were run **after** that restore.

---

## 6. Checks

`npm --prefix main run story:ux:check` → **exit 0**, 9 files / 94 tests.

`npm --prefix main run verify` → **exit 1**, and it is important to be precise
about what that command did: it **aborted at step 2 of 14**, on `scene:av:check`.
It therefore did **not** run `typecheck`, `test`, `audio:check` or `build` in that
invocation, and none of those may be credited to it. Each of the 14 gates was then
run as its **own** command with its own log, timestamps and digest:

**11 pass** — `catalog:check`, `creative:workflow:check`, `chapter:journey:check`,
`typecheck`, `preview:check`, `audio:diagnostic-check`, `story:ladder:check`,
`guidance:target-check`, `test` (351 files / 3172 tests), `audio:check`, `build`.

**3 fail**, all three on the same thing, none of it this repair's code:

| gate | owner | failure |
| --- | --- | --- |
| `scene:av:check` | `main/tools/generate-scene-av-runtime.mjs` | frozen contract SHA drifted: expected `4dbf722b…` (scene-v2), got `5ef85a32…` (scene-v3) |
| `chapter:registry:check` | `main/chapter-registry.json` | `scene.contract-hash`, `scene.contract-identity` for `common-ground@scene-v2` |
| `story:authority` | `docs/…/paravoxia-story-authority.schema.json` | `manifest.schema-const` |

These are **pre-existing**: `chapter:registry:check` already failed with these same
two failures *before any mutation by this task*, captured in
`logs/arrival-common-repair/pre-chapter-registry-check.log`. They exist because the
producer promoted the scene-v3 contract bytes into the run directory at 16:52Z.

---

## 7. Blocker: part C could not be completed inside the granted boundary

The ch13 binding is duplicated in **three files the direction does not grant**, and
the two files it *does* grant cannot move without them:

1. `main/tools/generate-scene-av-runtime.mjs` — `SIGNED_SOURCES[2].sha256` and
   `.contractVersion`. Without this the generator **throws before writing**, so
   `scene:av:generate` cannot be run at all.
2. `main/chapter-registry.json` — the `common-ground` link's `id`,
   `contractVersion` and `sha256`.
3. `docs/architecture/workflow-orchestration/schemas/paravoxia-story-authority.schema.json`
   — the `activeProduction` const.

`main/src/story/signedSceneAvRuntime.ts` throws at import if its constants disagree
with `generatedSceneAvRuntime.json`, so moving only the granted file would have
broken the runtime; hand-writing the generated JSON is the forbidden shortcut. I
preserved the boundary and did **not** touch the three ungranted files.

What I did do inside the boundary: `main/story-authority.json`
`activeProduction.contractVersion` → `scene-v3` (a granted path, explicitly named
in the direction). That cleared the `story:authority` gate's
`production.contract-identity` failure; what remains there is only the docs schema
mirror.

**The metadata gap changes nothing at runtime.** A task-private copy of the
generator was run against the promoted v3 contract, writing to a task-local path
only. The **only** difference from the shipped `generatedSceneAvRuntime.json` is
the two provenance fields of the common-ground source — all 104 anchors, every
shot, every score cue and both other scenes are byte-identical. Only the stamp is
stale.

Requested of the producer/root: grant those three paths (two literal values each)
so a follow-up can close the last three gates. No behaviour change is implied.

---

## 8. Concurrent-session drift (not mine, not reverted)

After this task had finished writing and finished every check, another session in
this worktree modified `main/tools/creative-triad-gate.mjs` (13:28), `main/package.json`
and a run profile (13:29). My last source write was 13:22 and my last check
finished 17:25:09Z. I did **not** revert, fix or investigate them — `CLAUDE.md` is
explicit that a module another session is actively editing must not be touched.

Consequence to read carefully: a drift check run *now* against the frozen 99-file
manifest reports **six** changed files, not five. The sixth is
`creative-triad-gate.mjs` and it is not mine. `creative:workflow:check` passed at
17:24:06Z against that file's *previous* bytes, so its result is reported as
measured and not as a claim about the current bytes. `verify` was run once, as
directed, and was not re-run to chase this. Evidence:
`logs/arrival-common-repair/external-drift.txt`.

---

## 9. Limits

* **CPU only.** Every terrain, planner, handoff, steering and gait call in the new
  tests is the shipped function over the shipped generator — and none of it is a
  hardware pass, a rendering claim or a gameplay acceptance.
* The seam reconstructs **generated** terrain with `voxelSystem` reset, so live
  persisted or player-edited voxels are not represented at `(-46, ., 16)`,
  `(-50, ., 18)` or `(-48, ., 10)`. The audit named the same gap.
* The seam body is a fixed-step integrator with no momentum — conservative, but
  not the Rapier capsule.
* **COMMON vertex 6 has no engineering headroom.** The slack between the release
  radius and the certified footprint is ~0.044 of a unit. The repair sits inside it
  with roughly 0.04 on the floor side and 0.06 on the ceiling side. Any future
  change to the standing offset, the clearance plane, the dead zone, the capsule
  radius or the terrain under `(-48, ., 18)` can reopen CG-IMPL-010; the two new
  bound tests are written to fail loudly if it does.
* **Manual COMMON traversal remains unmeasured**, exactly as
  `producer-arrival-common-findings-review.json` records. A movie rail that now
  walks the corners is not proof that a player can. No input, entry or Continue
  probe was run here, and no game input patch was made.
* The CG-IMPL-014 copy assertions compare the resolver's output to the signed
  scene-v3 strings written into the test. They are anchored to real world and
  flight state and to structural relations between the phases, but they do not
  parse the contract JSON at test time.
* Earned Continue, full-story, variants/performance/AV and independent UX review
  all remain outstanding and mandatory. This report is none of them.
