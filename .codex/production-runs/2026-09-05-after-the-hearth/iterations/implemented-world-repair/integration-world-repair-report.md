# Integration world repair — Common Ground (ch13)

Contract **scene-v2** `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e`. Source manifest `51b25376aa6c87dc428249fcfd907811c592bc9dfdaf00d82c53112593ea02c3`.
Completed **2026-09-06T12:15:55.796174+00:00**. Defects **CG-IMPL-006**, **CG-IMPL-008**. Findings **VF3-FOOTING-1**, **VF3-AVHOME-1**, **VF3-CG008-1**.

**This is not acceptance.** No publication is authorized, source acceptance is false, and nothing here is a hardware, manual, movie, visual or audio proof. A passing unit suite is not a played chapter.

## Changed source

| path | beforeSha256 | afterSha256 |
| --- | --- | --- |
| `main/src/story/world/CommonGroundWorld.tsx` | `d564573757f160aa…` | `79b265c5e2c11fee…` |
| `main/src/story/commonGroundDirector.ts` | `81289ffd48e42609…` | `5688b86ebf06fd3a…` |
| `main/src/story/commonGroundDirector.test.ts` | `02986e15185168ad…` | `58bc30b4d7ef2080…` |
| `main/src/story/signedSceneAvRuntime.ts` | `9b513a850c81f0ae…` | `681339e20ca341c0…` |
| `main/src/story/world/CommonGroundWorld.test.tsx` | _(new file)_ | `a9c0eb4ac6000e96…` |

Five files, all already inside `production-lock.allowedPaths`. `CommonGroundWorld.test.tsx` was absent and root had already authorized creating it. **No new boundary was needed or requested.**

## VF3-FOOTING-1 — resolved-in-source

**Cause.** ESTABLISHED, not inferred. createFooting queried terrain.isSolidVoxel(cx, cy+1, cz) unclipped. createLiveAgentSurfaceTerrain's solid test falls through to generator.shouldVoxelExist, which keeps answering OUTSIDE the rendered/collided cube. A probe against the real generator at the real identity (getWorldGen(50, STORY_SEED, "-1,-1"), seed 3215739679) prints the actual column at S as cells 23:S 24:S 25:S 26:S 27:. with renderedRadiusCells(50) = floor(50/2) = 25 — so the generated bulge at cell 26 is one cell outside the cube and was read as an INVISIBLE CEILING above the ground she was standing on. At the landing area the same probe prints 25:S 26:. , which is exactly why supported was TRUE there and false for the whole approach: the verifier's "localised, not global" measurement, explained. The jump table is consistent: a lift into cell 26 returned TRUE because the phantom at 26 was "solid" and 27 was not — an artefact of the same unclipped read, not evidence that the ground top face is y=53.

**Reproduction.** main/src/story/world/CommonGroundWorld.test.tsx, 17 tests over the REAL generator, REAL voxelSystem, real seed/planet/world identity, plus the real director seam (registerCommonGroundWorld -> commonGroundPlayerPose -> getCommonGroundProbeSnapshot().supported -> commitCommonGroundSurveyStart). It asserts the cause from the generator, carries the exact published hardware pose (-26.303072, 50.98897476203079, 12.015123) and the authored 51.05, and replays the whole measured height response including the still-cell-25 hovering band the late clarification named.

**Resolution.** Three bounded clauses in createFooting, no shared terrain/physics change, no threshold widened. (1) The PROCEDURAL fallback is clipped to the rendered cube, exactly as agentSurfaceNavigation.ts:376-390 already does for agents; the support cell must itself be real, so cell 26 can no longer carry a body. (2) Real placed/exposed voxels are NOT clipped: solid = voxelSystem.hasVoxel(...) || (rendered && terrain.isSolidVoxel(...)), because addVoxel has no radius guard and a block a player actually built at cell 26 is meshed, collided and visible. Hazard follows the same shape. (3) CONTACT_TOLERANCE = VOXEL_SCALE/8 = 0.25: the feet must be ON the support column's nominal top face. cell(y - 1.05) alone accepts -0.95..+1.05 around that face, so clipping the ceiling on its own would have called a body hovering most of a voxel up "grounded". The band strictly contains both qualified heights — authored 51.05 (+0.05, the same authoring epsilon carried in PLAYER_CENTER_CLEARANCE) and the measured resting 50.98897 (-0.011, the 0.01 COLLIDER_HALF_EXTENT inset plus solver penetration) — and refuses everything a quarter voxel or more off it. Water is deliberately left unclipped, matching the same shipped clause. Every clause can only REJECT poses the old predicate accepted, except at cells the cube does not render.

**Preserved and asserted:** real placed blocks (carry AND obstruct, inside and outside the cube); live dug holes; one-foot-over-the-hole rejection at a real cell boundary; interior rendered ceilings (dug pit + replaced block); real water columns; real placed lava, inside and outside the cube; live-edit revision invalidation; jumping and hovering rejection; all six signed poses and all three authored routes under a swept body.

**Counterfactual:** cf1-unclipped-phantom-ceiling (10/17 fail); cf2-clip-only-no-contact-band (4/17 fail); cf5-clip-would-discard-real-placed-voxel (1/17 fail).

**Not proved.** No hardware, browser, movie, visual or audio acceptance. Source and unit proof only.

## VF3-AVHOME-1 — resolved-in-source

**Cause.** ESTABLISHED from the actual boot ordering, and it is NOT the app-phase candidate. For a ?story=ch13-home deep link appState computes DEEP_LINK true, so phase is already "playing" from module load. The real path is two lines: storyDirector.ts ends with subscribeStory(syncBeat) plus an immediate syncBeat(), and initStoryFromSave activates the beat inside App's useState initializer — so enterCommonGroundBeat("ch13-home") and its anc.cg.home-steady publish run synchronously during render, BEFORE the first frame exists. App.tsx then mounts <StoryDirectorDriver paused={!worldGenReady || !initialRenderReleased || ...} />, so for the entire world-generation and shader-warmup boot every frame takes the !foreground branch and calls suspendCommonGroundPresentation("pause"), whose unconditional clearPendingAnchors destroyed the queued entry anchor before any tick could retry it. firedAnchors had already latched it, so it could never be re-noted, and signedSceneAvRuntime's earlierRequiredAnchorPending guard then refused fault-reviewed and return-chosen behind it for the whole beat. That is exactly the measured shape: firedAnchors both, activationSequence 0, history [], pendingAnchors already empty at 11 ms, first accepted anchor hatch-boarded in the next beat.

**Reproduction.** commonGroundDirector.test.ts "survives the boot: the entry anchor is retried after world-gen and warmup": the synchronous entry seam with the rail elsewhere, then thirty suspend("pause") frames standing in for world-gen and warmup, then the first real tick, then the two real F acts.

**Resolution.** A separate, BOUNDED beat-entry queue. It is populated only by enterCommonGroundBeat (in practice exactly one id, anc.cg.home-steady), drained once by the first tickCommonGround of that beat whatever the outcome, and dropped whole by clearAnchorQueues on every beat, run, world, actor, reset, exit and release transition. A pause or visibility loss leaves the chapter ON the beat, so it survives those two and only those two — which is what the boot actually reports itself as. StoryDirectorDriver.tsx was NOT edited: all existing UX and final-texture cancellation is unchanged.

**Rules preserved:**
- The live install acknowledgement anc.cg.cell-installed is published mid-beat and still goes through the ordinary pending queue, which a pause still empties on the spot — asserted by the rewritten "never defers a MID-BEAT acknowledgement across a pause, a mute or a Continue".
- No unbounded queue: at most one entry anchor, one retry, then empty.
- No manufactured receipt, no activation history written, no replay, no deferred audio unlock.
- The completion token's cancellation path (cancelCommonGroundFinalTexture) is untouched.

**Counterfactual:** cf3-boot-pause-clears-entry-anchor (1/91 fail).

**Not proved.** Whether a continuous station->home entry behaves identically is unmeasured here; only the deep-link/boot ordering is reproduced in source.

## VF3-CG008-1 — resolved-in-source

**Cause.** DEMONSTRATED, and it was a real failure rather than a speculative one. RECEIPT_SATISFIED_ANCHORS keys every survey predecessor on story:ch13-route-tested, and there are only six durable ch13 milestones, so a Continue taken in the MIDDLE of the survey can hold no receipt that excuses them. Built through the real seam — open the demonstration, start the recording, draw three real samples of the short route, serializeCommonGround -> WorldSave -> localStorage -> loadWorld -> stageCommonGroundWorldPayload -> hydrateCommonGround validator -> chapter seam, cold runtime, fresh AV ledger — the reload then walks to E and offers the span, and anc.cg.route-offered is REFUSED with a completely empty activation history.

**Reproduction.** commonGroundDirector.test.ts, three new cases: "resumes a mid-DRAWING Continue and earns the next new anchor", "resumes a mid-TESTING Continue without replaying his walk or her offer", and the negative control "excuses NOTHING from a restore that has no recording at all". All use the actual WorldSave round-trip with a Map-backed localStorage, the real validator and the real signedSceneAvRuntime; none hand-builds a snapshot.

**Resolution.** surveyStateSatisfiedAnchors() in signedSceneAvRuntime.ts extends the SAME transaction-chain doctrine the milestone map already states to the one lane whose chain has no durable milestone yet. It reads only a VALIDATED, hydrated, actor- and world-scoped chapter snapshot; a recording that exists is proof of the acts that are the only legal way to produce one (commitCommonGroundSurveyStart runs only from awaiting-start, which only commitCommonGroundDemonstrationOffer produces from idle, and anc.cg.repeated-measure is published on every tick of those two phases). An offered span additionally excuses trace-drawn and route-offered. It is consulted ONLY to answer "is that predecessor still pending?": it activates nothing, writes no activation history, replays no cue or shot, marks no milestone and creates no new event id.

**Boundaries of the exemption:**
- Reads only state with hydrated === true, so a live in-session survey still activates its anchors in the ordinary order.
- No new milestone constant and no new creative event id was added. The six real durable ch13 milestones are unchanged.
- The FINAL proofs stay keyed to their durable milestones: route-tested, reciprocal-crossed and complete are not excused by any saved state.
- A restore with no working and no accepted slot excuses nothing (negative control asserts route-offered and route-tested are both still refused).
- A foreign actor or foreign world payload hydrates to null in the existing validator and therefore excuses nothing.

**Mid-common.** RETAINED AS ALREADY PASSING, not changed. The verifier reported that the mid-common case does not reproduce because commonGroundDirector marks the crossing receipt before noting its anchor. The existing real-seam regression "resumes a mid-common Continue: an earned crossing is not a pending one" covers it and still passes; no speculative change was made there.

**Counterfactual:** cf4-no-saved-survey-satisfaction (2/122 fail).

**Not proved.** Unit and real-seam proof only. No physical partial survey was earned and reloaded on hardware; the independent verifier owns that.

## Root review findings raised mid-pass

- **fixed** — The clip discarded ACTUAL placed/exposed voxels as well as the phantom generator fallback; addVoxel has no radius guard, so a real block at cell 26 above S must still obstruct and still carry.
  - solid = voxelSystem.hasVoxel(...) || (rendered && terrain.isSolidVoxel(...)); hazard uses the same shape. New regression "keeps a REAL placed block outside the procedural cube both solid and standable" asserts obstruct, carry, contact-only and remove/restore. Counterfactual cf5 proves it necessary.
- **fixed** — The "half over hole" test asserted only that two cell indices differ, not that a boundary body pose is rejected.
  - New test "refuses a body with only ONE FOOT over the hole": a pose at x=-24.8 whose centre is over an intact column and whose -x disc sample reaches the dug one, asserted supported before the dig and unsupported after it.
- **fixed** — "refuses water and lava" only tested a found water cell.
  - Split into "refuses a real water column at the support cell" (claim narrowed, and the found cell is now asserted to be water) and a new "refuses a REAL placed lava block as ground, inside the cube and outside it" using an actual placed blockId lava voxel and its removal.

## Counterfactuals — exact-byte restore, no Git

| label | mutation exit | restored exactly | cleanup exit |
| --- | --- | --- | --- |
| `cf1-unclipped-ceiling` _(superseded)_ | 1 | True | 0 |
| `cf1-unclipped-phantom-ceiling` | 1 | True | 0 |
| `cf2-clip-only-no-contact-band` | 1 | True | 0 |
| `cf2-clip-only-no-contact` _(superseded)_ | 1 | True | 0 |
| `cf3-boot-pause-clears-entry-anchor` | 1 | True | 0 |
| `cf4-no-saved-survey-satisfaction` | 1 | True | 0 |
| `cf5-clip-would-discard-real-placed-voxel` | 1 | True | 0 |

Each mutated one allowed file, ran its command, and restored the exact saved bytes in a Python `finally` block with a before/after sha256 assertion. Mutation exit codes are recorded **separately** from cleanup exit codes. Backups live under this run's `evidence/integration-world-repair/temp` with task-specific names.

**No `git checkout`, `reset`, `restore`, `stash` or `clean` was invoked at any point in this pass.** The previous pass's checkout incident is recorded in `lifecycle-mutation-cleanup-deviation.json`; it is not repeated here and is not restated as this pass's own.

## Checks

| name | command | exit | log |
| --- | --- | --- | --- |
| vitest-full | `npm test` | 0 | `vitest-full.log` |
| typecheck | `npm run typecheck` | 0 | `typecheck.log` |
| build | `npm run build` | 0 | `build.log` |
| vitest-story | `npx vitest run src/story` | 0 | `vitest-story.log` |
| story-ux | `npx vitest run src/story/ux` | 0 | `story-ux-check.log` |
| vitest-focused | `npx vitest run src/story/signedSceneAvRuntime.test.ts src/story/commonGroundDirector.test.ts src/story/world/CommonGroundWorld.test.tsx src/story/commonGroundState.test.ts src/game/systems/persistence.test.ts src/story/storyState.test.ts src/App.test.tsx` | 0 | `vitest-focused.log` |
| scene-av-check | `npm run scene:av:check` | 0 | `scene-av-check.log` |
| chapter-registry-check | `npm run chapter:registry:check` | 0 | `chapter-registry-check.log` |
| chapter-journey-check | `npm run chapter:journey:check` | 0 | `chapter-journey-check.log` |
| story-authority | `npm run story:authority` | 0 | `story-authority.log` |
| story-ladder-check | `npm run story:ladder:check` | 0 | `story-ladder-check.log` |
| guidance-target-check | `npm run guidance:target-check` | 0 | `guidance-target-check.log` |
| creative-workflow-check | `npm run creative:workflow:check` | 0 | `creative-workflow-check.log` |

All run in `/home/thomasphillip/Projects/vox/main`. Exact commands, cwd, exit codes and log sha256 are in the JSON twin.

## Test totals

- baseline (`preRepairV2Baseline`): **3068** tests / 348 files
- final: **3091** tests / 349 files
- added by this pass: **23** — {'main/src/story/world/CommonGroundWorld.test.tsx': 17, 'main/src/story/commonGroundDirector.test.ts': 6}
- removed: **0**
- arithmetic: **3068 + 23 - 0 = 3091**

No test was deleted. One existing case, "never defers an acknowledgement across a pause, a mute or a Continue", was RENAMED and rewritten as "never defers a MID-BEAT acknowledgement across a pause, a mute or a Continue": its old form asserted the defect (a boot pause destroying the beat-entry anchor). The rule it protected — no deferred live install acknowledgement — is asserted more directly in the rewrite. Counted as changed, not removed.

Intermediate figures below are FOCUSED FILE counts taken mid-pass; they are not suite totals and must not be read as such. The only suite total is the final `npm test` run.

- after VF3-FOOTING-1 fix only: 14 (focused file only, not a suite total)
- after root placed-block review finding: 17 (focused file only, not a suite total)
- after VF3-AVHOME-1 fix: 91 (focused file only)
- after VF3-CG008-1 fix: 94 (focused file only)

## Preservation

- Pre-mutation manifest rehash: **96/96 files, 0 mismatch, 0 missing**.
- Post-mutation rehash: **4 changed**, unexpected drift `[]`. Exactly the four allowed files this pass edited; every other manifest file is byte-identical.
- Dirty tree: **322 → 323** entries. The single delta is the new allowed untracked test file. No tracked dirty file was lost.
- Backed up but ultimately untouched, and verified byte-identical at the end: `main/src/story/StoryDirectorDriver.tsx`, `main/src/story/commonGroundState.ts`, `main/src/story/commonGroundState.test.ts`, `main/src/story/signedSceneAvRuntime.test.ts`, `main/src/game/systems/persistence.ts`, `main/src/game/systems/persistence.test.ts`.

## Passive diagnostic interface

`window.__paravoxiaCommonGround.snapshot()` behind `journeyprobe=1 | chapterjourney=1 | debug=1`. Observer effect: **none; reads the last EXECUTED rail plan, never runs the planner**.
Fields: `beat`, `bodyCentre`, `bodyPose`, `up`, `groundOffsetUnits`, `supported`, `worldBound`, `rail{action,target,interactionId,reason,arriveRadius}`, `railCursor`, `score{beat,mood,finalTextureSeconds}`, `diagnostic`, `pendingAnchors`.
Changed this pass: pendingAnchors now reports a detached copy of BOTH anchor queues, beat-entry first, in the order the retry will use.
The `score` field root asked about was already present and is unchanged.

## Non-regression

- Centre -> ground conversion still uses the real capsule half-height 1.3 + radius 0.5 along the live local up (CG_PLAYER_GROUND_OFFSET unchanged).
- Direct survey/common entry still uses the existing on-foot restoration; no disembark fixture, teleport or grant was added.
- The shared F performer still owns cadence; no chapter-side cadence gate was added.
- Ordered movie control still traverses the actual corners; no route or waypoint code was touched this pass.
- CG-IMPL-009: the manual corner-credit allowance remains WITHDRAWN by Chapter and the original route algorithm remains authoritative (chapter-corner-candidate-disposition.json). No route code was edited, so no endpoint, late-leg or wiggle credit exists to pay for omitted ground.
- No arrival, occupancy, LOS or proof radius was changed. No body was clamped onto an authored plane. No ground was invented. No overhead check was removed wholesale. No shared terrain or physics module was edited.
- No new camera, music cue, route, marker, objective, copy, canon or visual direction. No authored scenery moved and no prior home construction was rewritten.
- window.__paravoxiaCommonGround.snapshot stays query-gated, passive, detached and never runs a planner; the score field was already present and is unchanged.

## Unresolved / not claimed

- No gameplay, hardware, GPU, browser, movie, visual or audio acceptance is claimed by this pass. Every claim here is source or unit-level. The independent verifier owns real play after source freeze.
- The continuous station -> home -> ch13 bridge is still unmeasured on this source; only the deep-link/boot ordering is reproduced.
- Downstream of the survey start — both route classes, the ordered 18 units, corner behaviour, manual-corner recovery, the common beat, completion and handback — remains unverified on hardware, because the previous run could not get past VF3-FOOTING-1.
- CONTACT_TOLERANCE is chosen as a quarter of the existing rounding window. It strictly contains the two qualified standing heights and rejects the measured hovering band, but the real gait envelope over uneven live terrain has not been measured on hardware; if a real walking body is ever refused at a legal pose, that is the number to re-examine, and it should be re-examined rather than widened silently.
- The five-offset disc is genuinely degenerate at most sites at VOXEL_SCALE 2 (all five offsets round to one cell when the whole disc fits inside it). Per direction this is NOT reported as a defect; the new boundary test shows the offsets do separate at a real cell boundary and that the protection works there.

## Limits

- **source**: Five files under production-lock allowedPaths: CommonGroundWorld.tsx, CommonGroundWorld.test.tsx (new, pre-authorized), commonGroundDirector.ts, commonGroundDirector.test.ts, signedSceneAvRuntime.ts. No protected path, no root-owned artifact, no shared engine module.
- **browser**: None. This role ran no GPU, browser, preview or capture. The old preview 45091 serves an immutable older snapshot and was not consulted or used for any claim.
- **newBoundaryRequested**: None. Every edited path was already allowed, and root had already pre-authorized creating the absent CommonGroundWorld.test.tsx.

No hidden incident, no unrun check marked passed, and no claim of comprehensive chapter correctness. Independent physical verification of this source remains required.
