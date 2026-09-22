# Integration world repair — progress

Contract scene-v2 `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e`.
Defects routed: CG-IMPL-006 residual (VF3-FOOTING-1), CG-IMPL-008 residual
(VF3-AVHOME-1), CG-IMPL-008 intermediate Continue (VF3-CG008-1).

## Phase 0 — preservation (done)

- Re-hashed the exact 96-file source manifest against the working tree BEFORE
  any mutation: **96 files, 0 mismatch, 0 missing**
  (`evidence/integration-world-repair/pre-mutation-manifest-rehash.json`).
- Private exact-byte backups taken for every candidate file
  (`evidence/integration-world-repair/backup/index.json`). `CommonGroundWorld.test.tsx`
  and `StoryDirectorDriver.test.tsx` recorded as ABSENT (beforeSha256 null).
- Counterfactual harness is `evidence/integration-world-repair/counterfactual.py`:
  Python `try/finally` exact-byte restore, before/after sha256 assertion,
  task-named backups under this run's `evidence/integration-world-repair/temp`.
  **No git checkout/reset/restore/stash/clean has been or will be used.**
  Mutation exit code is recorded separately from cleanup exit code.
- No new boundary needed so far: `CommonGroundWorld.tsx` and the (absent, allowed)
  `CommonGroundWorld.test.tsx` are both already in `production-lock.allowedPaths`.

## Phase 1 — VF3-FOOTING-1 cause ESTABLISHED and repaired (source done)

**Cause, read from the real generator, not inferred.** A probe against
`getWorldGen(50, STORY_SEED, STORY_PRIMARY_WORLD_ID)` — the actual identity from
the HUD, seed 3215739679, world `-1,-1` — prints the real voxel column at every
signed pose:

| site | cell | column (cells 23..28) | nav support | top face |
| --- | --- | --- | --- | --- |
| authored S / measured stand | (-13, 25, 6) | 23:S 24:S **25:S 26:S** 27:. | 25 | y=51 |
| landing area | (3, 25, -3) | 23:S 24:S **25:S 26:.** 27:. | 25 | y=51 |
| pose R, route short[3..6], long[6..13] | … | 25:S **26:S 27:S** | 25 | y=51 |

`renderedRadiusCells(50) = floor(50/2) = 25`. So at the audit site the generator
logically continues through cells 26 (and at some columns 27) which are **outside
the rendered/collided cube**, while `createFooting.supportedColumn` queried
`terrain.isSolidVoxel(cx, cy + 1, cz)` unclipped and read that logical bulge as a
**ceiling one cell above the ground she is standing on**. At the landing area
cell 26 is empty, which is exactly why `supported` was TRUE there and false for
the whole approach — the verifier's "localised, not global" measurement,
explained. `agentSurfaceNavigation.ts:376-390` already clips precisely this case
for agents; the chapter's footing did not.

The verifier's jump table is fully consistent: a lift into cell 26 returned TRUE
because the bulge at 26 was "solid" and 27 was not — an artefact of the same
unclipped read, not evidence that the ground is at y=53.

**Repair (`main/src/story/world/CommonGroundWorld.tsx`, two clauses):**

1. Solid and hazard reads are clipped to the rendered cube, exactly matching the
   shipped navigator's clause. Water is deliberately NOT clipped, also matching
   it. The support cell must itself be rendered, so cell 26 can never carry a body.
2. `CONTACT_TOLERANCE = VOXEL_SCALE / 8 = 0.25`: the feet must actually be on the
   support column's nominal top face. `cell(y - 1.05)` alone accepts −0.95..+1.05
   around that face, so clipping the ceiling on its own would have called a body
   hovering most of a voxel up "grounded" (the late VF3 clarification's
   feet 51.5..51.9 case, which still rounds into cell 25). The band strictly
   contains both qualified heights — authored 51.05 (+0.05) and the measured
   resting 50.98897 (−0.011) — and refuses everything above a quarter voxel.

No radius, arrival, occupancy, LOS or proof threshold was touched; no plane was
clamped; no ground was invented. Both clauses can only REJECT poses the old
predicate accepted, except at the cells the cube does not render.

**New regression: `main/src/story/world/CommonGroundWorld.test.tsx`** (allowed,
previously absent) — 14 tests over the REAL generator, REAL `voxelSystem`, real
seed/world, plus the real director seam (`registerCommonGroundWorld` →
`commonGroundPlayerPose` → `getCommonGroundProbeSnapshot().supported` →
`commitCommonGroundSurveyStart`). It covers the cause, the exact hardware pose,
the whole measured jump table, all six signed poses and all three authored routes
under a swept body, a live dug hole, a real placed-block ceiling, live-edit
revision invalidation, real water, and explicit not-always-true controls.
`npx vitest run src/story/world/CommonGroundWorld.test.tsx` → **14/14, exit 0**.

**Counterfactuals (exact-byte restore verified, no git):**

| label | mutation | mutation exit | result | cleanup |
| --- | --- | --- | --- | --- |
| `cf1-unclipped-ceiling` | restore the pre-repair unclipped solid reads | 1 | **7/14 fail**, incl. the hardware-body survey start | restored exactly, exit 0 |
| `cf2-clip-only-no-contact` | keep the clip, disable the contact band | 1 | **3/14 fail**, incl. the still-cell-25 hover | restored exactly, exit 0 |

Both halves are independently necessary. This is source proof only: it is not a
hardware, manual, movie, visual or audio acceptance.

> **Superseded by Phase 1b.** The two counterfactuals above ran against the source
> BEFORE root's placed-block review finding, when the file had 14 tests. They were
> re-run against the final source as `cf1-unclipped-phantom-ceiling` (10/17 fail) and
> `cf2-clip-only-no-contact-band` (4/17 fail), joined by
> `cf5-clip-would-discard-real-placed-voxel` (1/17 fail). Both records are retained
> verbatim rather than rewritten; the final report marks the earlier pair superseded.

## Phase 1b — root's placed-block review finding (done)

Root's mid-pass review was right: `solid = rendered(...) && terrain.isSolidVoxel(...)`
clipped *actual* placed/exposed voxels as well as the phantom generator fallback, and
`efficientVoxelSystem.addVoxel` has no radius guard at all. Corrected to
`voxelSystem.hasVoxel(...) || (rendered(...) && terrain.isSolidVoxel(...))`, with the
hazard read following the same shape. New regression asserts a real block placed at
cell 26 above S **obstructs** the body, **carries** it on its own face, is only
supported in contact with it, and that removing it restores both answers exactly.
Counterfactual `cf5-clip-would-discard-real-placed-voxel` fails that test alone.

Root's two test-precision notes are also fixed: "half over hole" is now an actual
boundary body pose (centre over an intact column, `-x` disc sample over the dug one,
supported before the dig and refused after it); and the water/lava claim is split into
a narrowed real-water test and a new real placed-`lava` test, inside the cube and
outside it. Focused file: **17/17, exit 0**.

## Phase 2 — VF3-AVHOME-1 cause ESTABLISHED and repaired (source done)

The app-phase candidate is **not** the cause: `appState.computeDeepLink()` makes a
`?story=ch13-home` link `playing` from module load. The actual boot ordering is two
lines. `storyDirector.ts` ends with `subscribeStory(syncBeat)` and an immediate
`syncBeat()`, and `initStoryFromSave` activates the beat inside App's `useState`
initializer — so `enterCommonGroundBeat('ch13-home')` and its `anc.cg.home-steady`
publish run synchronously during render, **before the first frame exists**. `App.tsx`
then mounts `<StoryDirectorDriver paused={!worldGenReady || !initialRenderReleased ||
…} />`, so the whole world-generation and shader-warmup boot reaches the chapter as
`suspendCommonGroundPresentation('pause')`, whose unconditional `clearPendingAnchors`
destroyed the queued entry anchor before any tick could retry it. `firedAnchors` had
already latched it, and the AV ordering guard then refused fault-reviewed and
return-chosen behind it — exactly the measured shape.

Repair: a bounded **beat-entry queue** in `commonGroundDirector.ts`, populated only by
`enterCommonGroundBeat` (one id in practice), drained once by that beat's first tick
whatever the outcome, dropped whole on every beat/run/world/actor/reset/exit/release
transition, and surviving `pause`/`visibility-loss` only. `StoryDirectorDriver.tsx`
was **not** edited. The live install ACK, every mid-beat anchor and the completion
token keep the ordinary queue that a pause still empties on the spot.
Counterfactual `cf3-boot-pause-clears-entry-anchor`: mutation exit 1, 1/91 fail,
restored exactly, cleanup exit 0.

## Phase 3 — VF3-CG008-1 DEMONSTRATED and repaired (source done)

Built through the real seam, not a hand-made object: open the demonstration, start the
recording, draw three real samples, `serializeCommonGround` → WorldSave →
localStorage → `loadWorld` → `stageCommonGroundWorldPayload` → `hydrateCommonGround`
validator → chapter seam, cold runtime and fresh AV ledger. The reload then walks to E
and offers the span, and `anc.cg.route-offered` is **refused with an empty activation
history**. That is a real failure of a legal Continue, not a speculative one.

Repair: `surveyStateSatisfiedAnchors()` in `signedSceneAvRuntime.ts` extends the same
transaction-chain doctrine the milestone map already states, to the one lane with no
durable milestone yet. It reads only *validated, hydrated, actor- and world-scoped*
chapter state, answers only "is that predecessor still pending?", and activates,
writes, replays and manufactures nothing. No new milestone constant and no new event
id. The final proofs stay keyed to their durable milestones. Negative control: a
restore with no recording at all excuses nothing. Mid-common was already correct and
is retained with its existing real-seam regression, unchanged.
Counterfactual `cf4-no-saved-survey-satisfaction`: mutation exit 1, 2/122 fail.

## Final checks — all exit 0

`npm test` **349 files / 3091 tests** (baseline 3068, +23, 0 removed) · `npm run
typecheck` · `npm run build` · `npx vitest run src/story` (1022) · `npx vitest run
src/story/ux` (94) · focused suites (226) · scene AV, chapter registry, chapter
journey, story authority, story ladder, guidance targets, creative workflow.
Commands, cwd, exit codes and log hashes are in `integration-world-repair-report.json`.

Preservation: manifest 96/96 clean before mutation, 4 changed / 0 unexpected after;
dirty tree 322 → 323 (the one new allowed test file). **No destructive Git at any
point in this pass.**

Reports written: `integration-world-repair-report.json` / `.md`, and the canonical
`integration-report.json` / `.md` updated without touching the frozen archives.
Source is final for this pass. No hardware, browser, movie, visual or audio
acceptance is claimed.
