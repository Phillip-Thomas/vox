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
