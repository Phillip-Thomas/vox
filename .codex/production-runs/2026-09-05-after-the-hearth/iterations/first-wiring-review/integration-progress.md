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

## Current

- Phase 3-6: actor render/world, semantic AV + registry/authority, movie bridge.

## Next

- `world/CommonGroundWorld.tsx`, signed AV registration + generator, registry
  `externalTransitions` + gate, story-authority identity, station movie bridge.
