# Common Ground — integration progress

Owner: integration engineer. Root owns `integration-inbox.md`.

## Gate receipt verified (before any edit)

- `contract-gate-pass.json`: `passed: true`, `phase: contract`,
  `contractSha256 ecce3e98…baac3a74`, 1712 checks, `publicationAuthorized: false`.
- Live `sha256sum scene-contract.json` = `ecce3e98270a9041b071e3c627090b228cfaab8a34e6c847296bd775baac3a74` — matches.
- `director-signoffs.json`: chapter approve-with-notes, score approve,
  cinematography approve-with-notes, all on `scene-v1` / same sha, `sameRevision: true`.
- `integration-before-manifest.json` re-hashed live: 74 files, 3 expected drifts
  (`main/tools/creative-triad-gate.mjs`, `main/tools/lib/guidanceTargets.mjs`,
  `docs/architecture/workflow-orchestration/schemas/paravoxia-scene-contract.schema.json`)
  — these are root's already-tested narrow tooling additions and are preserved,
  not reverted. All 40 `absent` paths still absent. 295 dirty/untracked paths in
  the worktree are preserved; no reset/stash/checkout was or will be run.

## Finished

**Phase 1 — pure bounded state / route / tests**
- `main/src/story/commonGroundState.ts` (snapshot v1, trace slots, tested prefix,
  tail revision, off-route witness POSE, earned route class, Terra progression,
  separate final offer vs live occupancy, strict hydrate, world-scoped store).
- `main/src/story/commonGroundRoute.ts` (apparatus solids, generic symmetric
  endpoint-contact rule for all solids with no exemption, socket-to-socket
  reference, four literal refusal reasons, dense walked-segment support,
  occupancy hysteresis, contiguous traversal progress).
- `commonGroundState.test.ts` + `commonGroundRoute.test.ts` — 37 passing.

**Phase 2 — registry, guidance, state entry, interaction**
- `beats/ch13/{ch13-home,ch13-return,ch13-survey,ch13-common,index}.ts`,
  `autopilot/rail-ch13-{home,return,survey,common}.ts`.
- 17 signed objective rungs in `beats/objectivePrimitives.ts` + 2 truthfulness
  variants under the SAME signed ids (see limitations).
- `storyState.ts`: `ch13` chapter, 4 beats, 6 milestones, resume ladder before
  the ch10 terminal, beat order before `done`, seeding, deep-link bootstraps,
  `completeChapter13()`.
- `commonGroundDirector.ts` (entry watch, per-beat machine, anchors, markers,
  interactions, rail plan), `commonGroundActor.ts`, `commonGroundScore.ts`.
- Seams: `emergentStoryDirector` (enter/tick/guidance + same-id republish),
  `StoryDirectorDriver` (dormant entry + pause/visibility cancellation),
  `auditWorkerPresence` (ch13 branch, independent of the A4 pack latch),
  `persistence` (WorldSave-only `commonGround`, per-world clear),
  `tidegardenRoute` (ch13-survey/common are Origin-owned).

Commands: `npm run chapter:registry:generate` (47 beat declarations, registry +
journey generated), `npx tsc --noEmit -p tsconfig.json` (clean),
`npx vitest run src/story/beats src/story/storyState.test.ts
src/story/commonGround* src/game/systems/persistence.test.ts` (all passing).

## Unforeseen path needed (reported, not silently widened)

`main/src/story/StoryDebugPanel.tsx` is in neither `allowedPaths` nor
`protectedPaths`. It holds `BEAT_LABELS: Record<StoryBeat, string>`, so adding
four beats to the `StoryBeat` union makes it a hard typecheck failure. I added
exactly four label strings and nothing else. If root wants that file untouched,
the alternative is loosening the `Record` there, which is the same file.

**Phase 3-6 — world, AV, registry/authority, movie bridge, persistence**
- `world/CommonGroundWorld.tsx`: apparatus (4 AABBs) as one instanced mesh AND
  real fixed `CuboidCollider`s, 512-glyph pooled trace mesh, live voxel-edit
  revision, world-id readiness gate, `restoreCommonGroundForWorld` staging.
- Signed AV: contract registered in `generate-scene-av-runtime.mjs` and its
  `signedSceneAvRuntime.ts` mirror (sha `ecce3e98…`, `scene-v1`, 28 anchors;
  104 total from 3 contracts). Every ch13 anchor is dispatched from its real
  physical owner; no symbolic beat-boundary entry was added.
- Registry: `ch13` chapter (`order: 11`), scene-contract link, and a NAMED
  `externalTransitions` record `ch10->ch13-via-station` with its schema and gate
  support. Ordinary adjacency is unchanged and still exact; the transition
  proves both boundaries independently and its entry guarantees must have
  runtime producers. New telemetry producers: `state:station/departed`,
  `state:hearth/restored`, `state:story/ch13-reciprocal-proof`.
- `story-authority.json`: runtimeBeatOrder + evidence chain + ceiling
  `ch13-common` + active production identity; schema consts synced.
- Movie bridge: `StationScreeningDriver` continues past the counter through the
  interior's own airlock objective; `SpaceStationSandbox` carries `movie=1` back
  out (never `story=`); `movieStationBridgeActive` yields once departed; new
  `movieReturnBridgeActive`/`tickMovieReturnBridge` fly home and press the
  shipped `story-ch12-install-bonded-cell`; the flight directive now steers for
  the post-terminal bridges and for `ch13-return`.
- Persistence: `WorldSave.commonGround` only (no GlobalSave), per-world clear.

## Root inbox corrections (items 1-16) — all addressed

1 two slots (`accepted`/`working`, class per slot, clear never touches accepted);
2 strict hydrate rejects impossible tuples wholesale (12 adversarial cases);
3 real walked distance with per-sample `walkedAt`, pending debt, revise refund;
4 `routeProgressUnits` is displacement-bounded, ordered, non-compounding;
5 socket-to-socket references retained and qualified against all three routes;
6 `walkedSegmentSupported` is a body sweep (radius/height) — regressions for
  crossing under the backing and for a clear path beside it;
7 final-texture eligibility is the completion EDGE + audio availability;
8 revision resumes from his actual pose (no W teleport, no S replay);
9 every world query fails CLOSED; Terra's comparison uses segment + displacement;
10 his final test is witnessed from T only (`useFixed: false`); never rewinds;
11 exact arrival, `permittedIndex` (not a live-pose distance), no 17.65/18 commit;
12 hold edges are physical and fire once per transition; body-clearance is a
  truthful suspension with actionable guidance and no new mood;
13 the held end is any qualified pose that actually extends coverage;
14 persistent local tester after handback + `story-ch13-repeat-survey`;
15 home facts stay Tidegarden-scoped, survey/common Origin-scoped;
16 real colliders, live revision, readiness gate, budget comment de-claimed.

Commands: `npx tsc --noEmit -p tsconfig.json` clean;
`npx vitest run src/story src/game src/components` → 213 files / 1866 tests pass;
`npm run chapter:registry:check` 4269 checks pass; `npm run chapter:journey:check`
0 issues; `npm run story:authority` 1039 checks pass; `npm run scene:av:check`
current.

## BLOCKED (external, reported not worked around)

`scene-contract.json` was replaced in place with an unsigned `scene-v2`
(`4dbf722b…fddff88e`) at 04:18 while implementation was under way.
`contract-gate-pass.json` and `director-signoffs.json` are both still
`scene-v1` / `ecce3e98…`, and `scene-v2-assembly-record.json` says
"three fresh signatures and contract gate pending".

I did NOT move the runtime pins to the unsigned revision. Five gate invocations
therefore fail, all from this one cause, and all of them passed clean before the
re-freeze: `chapter:registry:check` (2/4285), `chapter:registry:smoke`,
`scene:av:check`, `story:authority` (1/1039), `story:authority:smoke`.

The common-only guide exception is NOT implemented, per the inbox instruction.
Re-pin is mechanical once root posts the v2 gate: sha/revision in
`generate-scene-av-runtime.mjs`, `signedSceneAvRuntime.ts`,
`chapter-registry.json`, `story-authority.json`, regenerate, then adopt
`guidance/objectives/9` markerLabel and `/13` workOrder + enterAnchorRef.

## Residual inbox items (item 7/8/9/17 follow-ups) — addressed

- Audio eligibility now reads real output availability (`peekAudioContext`
  state + `isMusicMuted`), not settings alone; `anc.cg.handback` can no longer
  publish or restart the settled mood when the token was refused.
- `permitted` is now a leg-relative INDEX, so the allowed maximum cannot shrink
  under a walking actor; a full-route regression reaches every endpoint exactly,
  initially and after a suffix revision.
- `driveInspection` can no longer re-seat an approached actor, including during
  a missing-world suspension.
- `tickCommon` captures the previous body BEFORE the displacement update, so the
  walked-segment check is a real segment; the uncredited H→E leg now revalidates
  her far reference's range and sight, not just occupancy.
- Continue continuity: `workerPose` is persisted for both lanes, live stages are
  no longer collapsed (a stage claiming a live leg without a pose is rejected),
  and legs resume seeded at the pose/units actually walked. Regressions cover a
  fractional survey leg, E→H and the final E→C.
- External-transition gate binds host segments and receipts to real producers,
  resolves evidence refs, and rejects unknown/renumbered/dropped receipts,
  unknown hosts, duplicate and non-adjacent pairs, malformed endpoints, drifted
  entry guarantees and an unnecessary transition — ten negative self-tests.

## Current

- Complete. `integration-report.json` and `integration-report.md` written.

## Next

- Root: post the scene-v2 three-signature gate, or restore the signed v1 bytes.
  Independent story-verifier owns `npm run verify`, headed GPU and audio.

---

# Scene-v2 continuation (2026-09-06)

## Phase 0 — v2 gate receipt verified before any edit

- Live `sha256sum scene-contract.json` = `4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e`
  — matches the commissioned hash and `contract-gate-pass.json`
  (`passed: true`, phase `contract`, 1668 checks, `publicationAuthorized: false`).
- `director-signoffs.json`: chapter `approve-with-notes`, score `approve`,
  cinematography `approve`, all `scene-v2` / same sha, `sameRevision: true`.
  `scene-v2-signoff-compilation.json` and `repair-contract-disposition.json`
  (`route: revised-and-resigned`, `triadResignComplete: true`) agree.
- `iterations/implemented-scene-v1-before-v2/source-manifest.json` re-hashed
  against live: 96 files, **0 drift**. The v1 implementation is intact and is
  the starting point; nothing is being rebuilt.
- Read: v2 `guidance/objectives/9` and `/13`, `scene-cinema-lane.json#/trace`
  and `#/commonGuide`, `chapter-common-trace-clarification.md` (incl. the
  preparation/clearance addendum), `cinema-common-trace-clarification.md`,
  `score-v2-delta-disposition.md`, both repair directions,
  `producer-release-gates-correction.json`, `producer-boundary-completion.json`,
  `integration-report-v1-erratum.json`, and the whole `integration-inbox.md`.
- No reset/stash/checkout. All dirty worktree paths preserved.

## Phase 1 — item 4 (bindings) DONE

- `tools/story-authority-gate.mjs`: restored the strict
  `production.release-gates` equality (`JSON.stringify(lock.currentRestrictions
  .openGateRefs) === JSON.stringify(manifest.openReleaseGates)`), exactly as it
  read at HEAD. The relaxed "nonempty list + publishAllowed false + human gate
  present" acceptance is gone. `EXPECTED_OPEN_RELEASE_GATES` untouched. No other
  assertion in that file was changed or weakened.
- Repinned ch13 to the signed v2 (`4dbf722b…fddff88e`, `scene-v2`) in
  `tools/generate-scene-av-runtime.mjs`, `src/story/signedSceneAvRuntime.ts`,
  `chapter-registry.json` (19 `common-ground@scene-v1` refs + contract identity),
  `story-authority.json`, and the authority schema's `activeProduction` const.
  Regenerated with the normal generators (`chapter:registry:generate`,
  `generate-scene-av-runtime.mjs`).
- All five previously-blocked gates now pass (see report for exact counts).

## Phase 2 — item 2 (objective lifecycle/copy) DONE

- `objectivePrimitives.ts`: exact v2 copy for `test-preparing`, `test`,
  `reciprocal-preparing`, `reciprocal`; both survey states now carry the neutral
  `W-7744 · offered route` label under the one signed id.
- `commonGroundDirector.ts`: a body-clearance suspension DURING the approach
  keeps the preparing copy (`survey.approached` decides), per the v2 variant.
- `ch13-common.ts`: the false "a span she already traced" capability prefix is
  now the guide-following one Chapter asked for.
- The silent same-id republish seam already existed in `emergentStoryDirector`
  and is retained; `enteredIds` in `objectiveDirector` is what keeps the readiness
  swap from emitting a second entry cue.

## Phase 3 — items 1 + 3 (guide/glyphs, score) DONE, tests in progress

- `commonGroundState.ts`: `commonGroundReferenceHeld` (stage + real pose) and
  `commonGroundCommonDisplay` → `none` | `planned-guide` | `tested-common`.
- `commonGroundRoute.ts`: pure `traceGlyphs` / `commonGuideGlyphs` /
  `commonTestedGlyphs` / `sampleRouteEvenly` implementing the signed shape
  grammar, ≤2 instances per sample.
- `world/CommonGroundWorld.tsx`: whole 512 pool preallocated at mount; layout
  recomputed only on a real change; accepted + working drawn together; the common
  display uses the released working allocation; the guide is truncated at the
  first genuinely unsupported segment with an open transverse stop.
- `commonGroundScore.ts`: `releaseCommonGroundMood` (setScoreBeat(null) BEFORE
  clear) and a monotonic token deadline.
- `commonGroundDirector.ts`: `CG_RETAINING_ANCHORS`, `CG_WORLD_CONDUCTOR_ANCHORS`,
  `anc.cg.return-chosen` releases; `tickCommonGroundScore` cancels the token
  mid-flight on mute/unavailable output.
- `signedSceneAvRuntime.ts`: ch13 returns no generic anchor-index intensity.

## Phase 4 — tests, gates, report DONE

New regressions (27), each mutation-checked so it fails when the behaviour is
broken and passes when it is restored:

- `commonGroundRoute.test.ts` (+15): the shape grammar (one bar / parallel pair /
  open transverse stop that REPLACES the pair), corner bisection, spacing clamp,
  no decimation, three-way shape distinction with no colour read, the planned
  guide's continuity and honest truncation, the 62-piece completed comparison,
  and the 512-pool arithmetic across every allocation combination.
- `commonGroundState.test.ts` (+8): the guide never appears from a stage label
  whose body is elsewhere, from elapsed time, from route choice or from her
  scalar progress; it stays PLANNED through both passages; only a validated
  commit promotes it; selecting a display writes nothing; a reload reconstructs
  only the planned guide.
- `emergentStoryDirector.test.ts` (+3): preparation entry with one marker and one
  cue, the silent in-place text replacement at his real H arrival with NO second
  cue, and no re-cue under 30 frames of republication.
- `commonGroundDirector.test.ts` (+13): preparing copy through a real
  body-clearance suspension of the approach and its input-free recovery; the
  neutral label in both states; score retention through readiness/reopen/witness
  transitions; the return-choice release and the silent travel after it; the
  completion door (unavailable output, mute, mid-token cancellation, no
  re-arming, restored save) including the handback bypass; and the persistent
  local tester with an optional repeat that never spends the accepted proof.
- `commonGroundScore.test.ts` (+5): monotonic deadline under flooded and zero
  deltas, ticking on inactive `done` frames, and the signed release ORDER
  (setScoreBeat before clearOverride) recorded through a delegating mock.

Full run: typecheck clean, `npm run test` 348 files / 3018 tests, build pass, and
every registry / journey / scene-av / authority / creative gate green. Exact
commands, exit codes and log paths are in `integration-report.json#/commands`
and the report table; logs are in `evidence/integration-v2/`.

20 files changed, all inside `allowedPaths`, none protected, no new missing path
needed. No reset/stash/checkout/commit/push; 322 dirty entries preserved.

## Current

Complete. `integration-report.json` / `.md` rewritten as the combined final
truth, retaining the archived scene-v1 citations and carrying the v1 erratum
correction forward.

## Next

Independent story-verifier owns `npm run verify`, the headed GPU run, rendered
and listened acceptance, and the cold hardware handback. Nothing here is
independent, browser, rendered, listened or hardware acceptance.
