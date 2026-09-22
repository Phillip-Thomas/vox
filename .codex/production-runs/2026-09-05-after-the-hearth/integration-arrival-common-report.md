# Integration report — arrival + common steering (material repair 7)

Run `2026-09-05-after-the-hearth` · contract **scene-v3**
`5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54`
Direction `arrival-common-repair-direction.json` (13 paths) · defects **CG-IMPL-010**, **CG-IMPL-014**

**COMBINED report for the whole seventh repair**: the original invocation's
gameplay patch plus the exact metadata closure commissioned as its completion.
Same material repair 7 — no new loop, no new baseline, no eighth repair. The
first report, receipt, progress note and source snapshot are preserved untouched
under `iterations/arrival-common-before-metadata-closure/`.

`npm --prefix main run verify` now **passes all 14 steps in one run** on the final
repaired source (`exit 0`, 2026-09-06T17:35:27Z–17:36:29Z).

Not an acceptance. Not a chapter verification. Not an independent verification.
`independentGPUStatus: not-run`. Publication remains unauthorized.
Machine-readable form: `integration-arrival-common-report.json`.

Phases, kept distinct everywhere below:

| phase | when | commands/logs |
| --- | --- | --- |
| original gameplay patch | ended 2026-09-06T17:31:29Z | `logs/arrival-common-repair/` |
| metadata closure (this continuation) | 2026-09-06T17:33:40Z → 17:36:57Z | `logs/arrival-common-metadata-closure/` |

---

## 1. What changed

**Ten files** against the frozen 99-file baseline
(`iterations/arrival-common-findings/source`). Four gameplay/test files plus
`story-authority.json` from the original invocation; five identity-metadata files
from this continuation. No path was created, no dependency added, no generated
file hand-written, 89 baseline files unchanged.

| path | before | after | phase |
| --- | --- | --- | --- |
| `main/src/story/commonGroundDirector.ts` | `acc0d9cf…` | `3b2b95cc…` | original |
| `main/src/story/commonGroundDirector.test.ts` | `1b8e76af…` | `54f9f767…` | original |
| `main/src/story/beats/objectivePrimitives.ts` | `8770c1ff…` | `c4c555d4…` | original |
| `main/src/story/autopilot/primitives.test.ts` | `158f5ac9…` | `08069b5b…` | original |
| `main/story-authority.json` | `a3026565…` | `7c403255…` | original |
| `main/tools/generate-scene-av-runtime.mjs` | `a0681f65…` | `d1cfbec1…` | closure |
| `main/chapter-registry.json` | `6ae185a0…` | `0e67cb8e…` | closure |
| `docs/…/paravoxia-story-authority.schema.json` | `100580db…` | `eea51ae5…` | closure |
| `main/src/story/signedSceneAvRuntime.ts` | `681339e2…` | `5ac8377f…` | closure |
| `main/src/story/generatedSceneAvRuntime.json` | `0433dc0a…` | `4da94627…` | closure (generated) |

An eleventh baseline file, `main/tools/creative-triad-gate.mjs`, also differs. It
is **not mine** — see §8.

The four repaired gameplay files still carry the exact bytes the original
invocation produced and the original counterfactual measured; that was re-verified
by hash at the start of this continuation and again at report time.
`main/src/story/autopilot/primitives.ts` is still **byte-unchanged**
(`a6da0551…`), and `signedSceneAvRuntime.test.ts` needed no edit — it asserts
identity through the exported constants and the generated JSON, both of which now
carry scene-v3, so its coverage is unchanged and it passes.

No `git checkout`, `reset`, `stash`, `clean` or `revert` was used at any point in
either phase.

---

## 1b. The metadata closure, exactly

Every edit below is an identity binding to the already-signed, already-released
scene-v3 contract. No generator logic, no validator logic, no gate relaxation, no
schema generalisation, no narrative, cue, palette or geometry change.

* **`main/tools/generate-scene-av-runtime.mjs`** — `SIGNED_SOURCES[2].sha256` →
  `5ef85a32…` and `.contractVersion` → `'scene-v3'`. Two literals. `anchorCount`,
  the reduction, the validation and every other entry untouched.
* **`main/chapter-registry.json`** — the common-ground catalog entry's `id`
  (`common-ground@scene-v3`), `contractVersion` and `sha256`, plus all 16 matching
  `scene:common-ground@scene-v3#…` reference IDs and the `scenes` list entry. All
  19 `scene-v2` tokens in the file were common-ground tokens; no other chapter,
  beat, reveal, cue, palette text or `coversBeats` list was touched. Ownership was
  respected: `chapter-registry-generate` owns the **declared beat lists** only and
  catalog metadata is authored — the actual script was read, and there is no second
  generator. `chapter:registry:check` re-derives the 47 beat declarations and
  reports registry and journey match.
* **`docs/…/paravoxia-story-authority.schema.json`** — `activeProduction.const.contractVersion`
  `scene-v2` → `scene-v3`. **One token.** The `const` remains a strict exact-equality
  object; `runId`, `sceneId`, `productionLockPath`, `implementationStatus`,
  `releaseStatus` and every other validator condition are byte-unchanged.
* **`main/story-authority.json`** — already `scene-v3` from the original
  invocation; **not** re-edited here.
* **`main/src/story/signedSceneAvRuntime.ts`** — `CH13_SCENE_AV_SHA256`,
  `CH13_SCENE_AV_REVISION` and the two doc comments naming the signed revision. No
  AV, runtime, cue, anchor or export-shape change.
* **`main/src/story/generatedSceneAvRuntime.json`** — produced by
  `npm --prefix main run scene:av:generate`, never hand-edited. A structural diff of
  the whole document against the pre-generation bytes shows **exactly two changed
  leaves**: `sources[2].sha256` and `sources[2].contractVersion`. No key added,
  removed or reordered; every other scene, anchor and cue is identical, and the
  result equals the out-of-tree v3 preview the original invocation produced
  (`4da94627…`).

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

**+14 added, 0 removed, 0 skipped, 0 weakened**, all in the original phase and all
in `commonGroundDirector.test.ts`. **This continuation added, removed and modified
zero tests.** Final counts come from the `test` step of the single passing
`verify`: 351 files / 3172 tests.

One pre-existing case in `autopilot/primitives.test.ts` was **modified in place**,
and the wording of the first report needs correcting here:

* the published **stop-radius ceiling is strictly tighter** — `<= NAVIGATION_STEER_DEAD_ZONE`
  (0.15) where it was a literal `0.35`;
* the permitted **target-standoff threshold was recalculated** for the smaller
  controller radius and the unchanged dead zone: `> 0.2` where it was `> 0.35`.
  That is **not** a numerically stronger bound and is not claimed as one. It is the
  same invariant re-expressed for the changed controller radius.

So "every replacement is strictly tighter" is too strong. The change is to
**controller expectations only**; the route, the ordered eighteen, the arrival
predicate and every physical-progress safety assertion are untouched.

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

### Re-run on the repository-installed runner (continuation)

The original counterfactual above used a **root `npx`, which resolved a transient
Vitest 4.1.11** — not the runner the repository's own `npm test` uses. It was
re-run **once** with the repository-installed runner so the behavioural evidence
and the final verify share a toolchain. No gameplay code and no test was modified
to produce a result.

```
npm --prefix main run test -- src/story/commonGroundDirector.test.ts src/story/autopilot/primitives.test.ts
cwd /home/thomasphillip/Projects/vox   17:35:16Z → 17:35:20Z   exit 1
runner: repository-installed Vitest 3.2.4 (main/node_modules)
10 failed | 149 passed (159)
log logs/arrival-common-metadata-closure/counterfactual-repo-runner.log
    d4a9238512acabc4910ed0e3d72cf68a28af6f49f162041a915df8ed04a6b785
```

Same 10 failures, same cases. Method: task-private byte restore of the two
pre-repair non-test gameplay files (`acc0d9cf…`, `8770c1ff…`) from
`.private/arrival-common-repair-backups`, repaired bytes stashed first under
`.private/arrival-common-metadata-closure/fixed/` and copied back in the same
shell. **Restore proof:** `commonGroundDirector.ts` → `3b2b95cc…` and
`objectivePrimitives.ts` → `c4c555d4…`, identical to the repaired `afterSha256`.
The restore completed 17:35:20Z; `story:ux:check` started 17:35:26Z and `verify`
17:35:27Z, so the final verify ran on fully restored, fully repaired source.

**Restore proof (original phase).** The digest list taken before the counterfactual
(`after-hashes.txt`) and the digest list taken after restoring
(`restore-proof.txt`) are byte-identical — both files hash to
`232ca05c6586139fae2156cdc47197ec99869b733a607b5ac9e823875970ffc4`. `story:ux:check`
and `verify` were run **after** that restore.

---

## 6. Checks

### Final source (continuation) — all passing

| check | UTC | exit | result |
| --- | --- | --- | --- |
| `npm --prefix main run scene:av:check` | 17:34:33–34 | 0 | 104 anchors from 3 signed contracts (`3367b94f9f0f`, `0336a4f28bfa`, `5ef85a324f57`), current |
| `npm --prefix main run chapter:registry:check` | 17:34:34–35 | 0 | 4285 checks; 47 beat declarations, registry and journey match |
| `npm --prefix main run story:authority` | 17:34:35–36 | 0 | 1039 checks |
| `npm --prefix main run catalog:check` | 17:34:36 | 0 | catalog current |
| `npm --prefix main run test -- <3 focused files>` | 17:34:42–47 | 0 | 3 files / 187 tests |
| `npm --prefix main run story:ux:check` | 17:35:26–27 | 0 | 9 files / 94 tests |
| **`npm --prefix main run verify`** | **17:35:27–17:36:29** | **0** | **all 14 steps, one run** |
| `npm --prefix main run creative:workflow:check` (post-drift re-run) | 17:36:56–57 | 0 | 185 checks |

cwd for all of the above: `/home/thomasphillip/Projects/vox`. Runner: the
repository-installed toolchain (`main/node_modules`, Vitest 3.2.4) — no root `npx`.
Logs and their SHA-256 digests are in the JSON report under `checks[]`, files in
`logs/arrival-common-metadata-closure/`.

The 14 steps `verify` actually executed and passed, in order: `catalog:check`,
`scene:av:check`, `creative:workflow:check`, `chapter:registry:check`,
`chapter:journey:check`, `typecheck`, `preview:check`, `audio:diagnostic-check`,
`story:ladder:check`, `guidance:target-check`, `story:authority`, `test`
(351 files / 3172 tests), `audio:check` (27.7s of a 40s budget), `build`
(vite 6.3.5, 1239 modules). This is a full composite pass — not a test count
standing in for one.

A focused-test filter argument `src/story/beats/objectivePrimitives.test.ts`
matched nothing: **that file does not exist** in this repository, which is also why
the direction lists it as untouched. No coverage was lost.

### Original phase (historical)

`story:ux:check` passed at 17:23:48Z. The composite `verify` at 17:23:53Z **exited
1, aborting at step 2 of 14** on `scene:av:check`; the remaining gates were then run
individually, 11 passing and 3 failing. Those commands, timestamps and log digests
are preserved verbatim in the JSON report under `originalPhaseChecks` and in
`logs/arrival-common-repair/`.

---

## 7. The three failing gates — now closed

| gate | owner | original failure | now |
| --- | --- | --- | --- |
| `scene:av:check` | `main/tools/generate-scene-av-runtime.mjs` | frozen contract SHA drifted: expected `4dbf722b…` (scene-v2), got `5ef85a32…` (scene-v3) | **pass** |
| `chapter:registry:check` | `main/chapter-registry.json` | `scene.contract-hash`, `scene.contract-identity` for `common-ground@scene-v2` | **pass** |
| `story:authority` | `docs/…/paravoxia-story-authority.schema.json` | `manifest.schema-const` | **pass** |

Those failures are retained as **historical evidence only** and are excluded from
the positive checks array.

**Precision on the word "pre-existing."** The first report labelled these three
`preExisting`. They were not unrelated pre-existing defects. They existed at the
original engineer's start **only because** the producer promoted the signed
scene-v3 contract bytes into the run directory at **16:50:03.409989Z**, with the
contract release passing at **16:52**; they are exactly the **unfinished v3
identity bindings of this authorized task**. The pre-mutation ordering proof
(`logs/arrival-common-repair/pre-chapter-registry-check.log`, `601d118e…`) remains
accurate about ordering; the "pre-existing defect" framing does not.

The blocker the first report raised — three files carrying the duplicated ch13
binding sitting outside its ten-path commission — was closed by root granting those
exact paths under standing delegation
(`producer-arrival-common-metadata-scope-decision.json`,
`integration-arrival-common-scope-addendum.txt`, and the canonical 13-path
`arrival-common-repair-direction.json`). All were already inside production-lock
and already inside the frozen 99-file manifest. **No blocker beyond this metadata
scope was found.**

---

## 8. Concurrent-session changes (not mine, not reverted, not adopted silently)

Reviewed and preserved by root in
`producer-concurrent-validation-tooling-review.json`. I did not edit, revert or
include any of them in my `changedPaths`.

| path | baseline | root-reviewed | at my final commands |
| --- | --- | --- | --- |
| `main/tools/creative-triad-gate.mjs` | `1a57c5ce…` | `d26ce9af…` | **`2ee54e48…` — NEW drift** |
| `main/package.json` | — | `5b06a5d5…` | `5b06a5d5…` (stable) |
| `docs/…/paravoxia-creative-delta.run-profile.json` | — | `a0b0ecdd…` | `a0b0ecdd…` (stable) |

**Additional drift is reported, not adopted.** The bytes root reviewed
(`d26ce9af…`) were present when this continuation started at 17:33 and through
every metadata edit and targeted gate. A concurrent session modified that file
**again at 17:36:27Z**, two seconds before the final `verify` returned, to
`2ee54e48…`.

Impact on these results: **none.** `creative-triad-gate.mjs` is invoked only by the
`creative:gate` / `creative:smoke` scripts and is **not** in the 14-step verify
chain — the chain's `creative:workflow:check` step runs
`tools/creative-workflow-config-gate.mjs`. That gate was additionally re-run at
17:36:56Z against the post-drift tree and passed (185 checks). And the signed
scene-v3 contract and brief had already passed 1714 checks under the **earlier,
stricter** gate, so nothing here depends on relaxed gate logic. Root's baseline
still holds the earlier gate bytes; compilers must account for this external delta
explicitly.

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

* This continuation ran **no** gameplay, controller, objective, body, route or
  test-logic patch — identity metadata only, plus one file regenerated by the
  repository's own generator. No GPU, browser, preview, capture or publication.
* No source was written after the final `verify`, and none after this report.
