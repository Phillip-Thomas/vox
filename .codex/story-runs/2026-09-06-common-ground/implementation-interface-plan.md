# Common Ground — implementation interface plan (ch13)

Preparation only, 2026-09-06. No runtime/main source edit, no build, test, probe or signature was performed. Symbols below were read from the live worktree (including untracked `beats/` and `autopilot/`), not from the older survey. Geometry numbers (selected instrument range, socket assignment, arena coordinates, exact sample/route layout) are **deferred input** from the signed scene contract; nothing here selects them. This plan assumes the accepted direction only and proposes no creative content.

## 0. Rules for the one integration engineer

Namespaced chapter-local modules; each shared file receives a **single small call**, no refactor of `storyState.ts`, `emergentStoryDirector.ts`, `storyDirector.ts`, `App.tsx`, `EfficientScene.tsx`, `EfficientPlayer.tsx`. All of those are dirty; re-check `ls -l` immediately before edit and never reset/stash. Score uses the existing `storyScore.ts` facade only — no engine graph, no new instrument, no bundle.

## 1. New chapter-local files (all new; no existing file moves)

| File | Owns |
| --- | --- |
| `story/commonGroundState.ts` | Versioned bounded trace state, reducers, serialize/hydrate/migrate/reset. Pure; no React or world imports. |
| `story/commonGroundRoute.ts` | Prop/solid-aware grounded route validation and walked-prefix predicate. Pure over injected terrain/solid queries. |
| `story/commonGroundDirector.ts` | Enter/tick dispatch, objective facts, commit events, marker target, interaction registration. |
| `story/commonGroundScore.ts` | ch13 mood/variant table + live-only coda, via `storyScore` APIs. |
| `story/commonGroundActor.ts` | The single ch13 writer of W-7744's pose + presence branch. |
| `story/world/CommonGroundWorld.tsx` | Trace render, fixed plate, world-handle registration, save restore/clear boundary. |
| `story/beats/ch13/{ch13-home,ch13-return,ch13-survey,ch13-common}.ts` | Four `defineBeat` contracts; filename === beat id. |
| `story/beats/ch13/{index.ts,definitions.ts}` | **`index.ts` must exist before the first generator run** (`emit` reads before write). |
| `story/autopilot/rail-ch13-*.ts` | Rails; move/look/act only. |
| colocated `*.test.ts` | See §9. |

## 2. Finite bounded trace state — `commonGroundState.ts`

Exported surface (proposed, exact):

```ts
export const COMMON_GROUND_SNAPSHOT_VERSION = 1;
export interface TraceSample { x: number; y: number; z: number; corner: boolean }
export interface TraceSlot {
  id: 'accepted' | 'working';
  samples: readonly TraceSample[];  // <= MAX_SAMPLES
  lengthUnits: number;              // <= MAX_TRACE_UNITS
  testedPrefixCount: number;        // samples proven by an actual test
  tailRevision: number;             // monotonic; bumps only on tail edit
  offeredEndIndex: number | null;
}
export interface CommonGroundSnapshot {
  version: typeof COMMON_GROUND_SNAPSHOT_VERSION;
  actorId: string; worldId: string;
  slots: Readonly<Record<'accepted' | 'working', TraceSlot | null>>;
  witness: { index: number; offered: boolean } | null;   // at most one
  reciprocal: { held: boolean } | null;
  hold: { reason: 'out-of-range' | 'unsupported' | 'occluded' | null };
  safePose: TraceSample | null;
}
createEmptySnapshot(actorId, worldId)
appendSample(s, sample)          // honest stop at capacity
reviseTail(s, fromIndex)         // preserves testedPrefixCount, bumps tailRevision
invalidateTestedPrefix(s, from)  // only on real voxel/support change
clearUncommitted(s)              // explicit proposal reset only
serializeCommonGround(s) / hydrateCommonGround(raw, actorId, worldId)
migrateCommonGround(raw)         // absent/legacy -> null, never throws
```

Invariants tests must pin: capacity stop never decimates a recorded corner; `reviseTail` never lowers `testedPrefixCount`; wrong `actorId`/`worldId` hydrates to `null`, not a partial graft; `clearUncommitted` never touches `accepted`; pause / failed input / Continue never call it.

**Numeric constants (`MAX_SAMPLES`, `MAX_TRACE_UNITS`, spacing, corner threshold, witness radii/tolerances, selected instrument range, socket heights) are declared as named exports with no committed values in this plan.** They are contract-supplied.

## 3. Persistence seam — `main/src/game/systems/persistence.ts`

Copy the `WorldSave.habitat` precedent exactly (`persistence.ts:239` interface, `:253` snapshot, `:301` restore): add `commonGround?: unknown` to `WorldSave`, write it in `saveWorld` beside `habitat` guarded by `worldId`, add `restoreCommonGroundForWorld` / `clearCommonGroundForWorld` alongside `restoreHabitatForWorld`, and have `clearWorldStateForWorld` clear it for **that world only**. No `GlobalSave` change. Ledgers (`observationLedger`, `accomplishmentLedger`) stay optional evidence and must not gate progression. `restartStory()` (`storyState.ts:775`) needs an explicit ch13 clear call; it does not clear ledgers today.

## 4. Actor: single pose writer, prop-aware grounded route

`AuditWorker.tsx` renders `getAuditWorkerPose()` — keep it the only body; `commonGroundActor.ts` is the sole writer while a ch13 beat is active (`A4WorldChoreography` writes only during `a4-exhale`; no overlap). `auditWorkerPresence.ts::shouldMountAuditWorker` (`:11`, sole export) needs one explicit ch13 branch independent of `FIELD_PACK_DROPPED_MILESTONE`; A4's pack/absence proof stays green. Routing reuses unmodified: `agentSurfaceNavigationRuntime.ts::createLiveAgentSurfaceTerrain` (`:13`), `agentSurfaceNavigation.ts::planAgentSurfaceRoute` (`:305`, with `AgentSurfaceRouteOptions` / `AgentSurfaceRouteReason` / `AgentSurfaceRoute`), `groundedSurfaceMotion.ts::{groundedSurfaceRouteLength, sampleGroundedSurfaceRoute, turnGroundedHeadingToward}`.

**Known gap (pass 2):** the voxel planner does not know the real trunk collider and can plan through it. The correction is a solid-occluder guard in `commonGroundRoute.ts` layered over `planAgentSurfaceRoute` — not in the shared navigation module, not in worldgen. Unreachable / unsupported / out-of-range return distinct typed reasons and hold at the last safe sample; never a teleport or timer-derived success.

## 5. Dormant reactivation and live dispatch (four one-line seams)

1. `StoryDirectorDriver.tsx` — beside the `!story.active` branch that calls `tickChapter10FreePlayEntry` (`:181`) and publishes `stationReturnObjective` (`:146`), one bounded `tickCommonGroundEntry(...)`. It must use `reactivateStoryAtBeat('ch13-home')` (`storyState.ts:821`), never `advanceToBeat` (`:808`, leaves `active:false`).
2. `emergentStoryDirector.ts` — one ch13 dispatch line each in `enterEmergentStoryBeat` (`:645`) and `emergentStoryDirectorTick` (`:787`), preserving guidance-clear + signed-AV-enter semantics and the `syncEmergentObjectiveGuidance` publication gate.
3. `storyState.ts` — ch13 resume clauses in `storyEntryPoint()` (`:246`) **before** the `ch10Complete` clause, returning `alive` explicitly (else falls through to `bare`); four ids added to `STORY_BEAT_ORDER` (`:333`) before `done`; `StoryChapter`/`StoryBeat` unions and `STORY_MILESTONES` (`:120`) gain ch13 rows. `done` stays last.
4. `beats/index.ts` — add the `ch13` import (the generator does not).

Objective facts: extend `objectivePrimitives.ts::StoryObjectiveGuidanceFacts` (`:84`) with a compact ch13 block plus defaults in `DEFAULT_STORY_OBJECTIVE_GUIDANCE_FACTS` (`:116`); ch13 prose/resolvers live in `beats/ch13/`. Marker: extend `worldHandles.ts::WorldMarkerHandle` (`:9`), resolve via `markerTargets.ts::resolveMarkerTarget` (`:20`), call `registerStoryMarkerWorld` (`:10`) from `CommonGroundWorld.tsx` — one marker authority, no new overlay. Interaction: add ids to `interactionSystem.ts::InteractionId` (`:9`, must match `story-${string}`), extend the exhaustive policy in `storyInteractions.ts`, register one world-scoped resolver via `registerStoryInteraction` (`:287`) with explicit priority/class/owner and cleanup. No player-loop or key change; build mode keeps F.

## 6. Registered ch13 beats and the strict EXTERNAL boundary

Four contracts via `beats/beatContract.ts::defineBeat` (`:73`); `entry: 'reactivation-from-done'` for `ch13-home`, `'sequence'` for the rest; every `rail` declares `stuckAfterSeconds` and `waitReason` and may not grant/mark/advance.

`chapter-registry.json` (`main/chapter-registry.json`, keys `schema | runtimeAuthorityRef | terminalBeat | sceneContracts | chapters`) gets a `ch13` record with `order: 11` (array position, not chapter number), `beats`, `before: ['ch10']`, `entry`, `exit`, `checkpoints`, `objectiveRefs`, `revealRefs`, and a new `sceneContracts` entry.

`tools/chapter-registry-gate.mjs::validateAdjacency` requires exact predecessor-exit / next-entry `stateRefs` equality. Ch10's real exit is `state:control/flight` + `state:space-station/targeted` + `state:station/docking-authorized`; ch13's real entry is restored hearth, on-foot Origin, station departed. **Do not add false guarantees to ch10 and do not drop true ch13 entry requirements.** Add a named `externalTransitions` record to the registry, its schema and the gate:

```
{ id: 'ch10->ch13-via-station',
  from: {chapter:'ch10', exitBeat:'ch10-transit'},
  to:   {chapter:'ch13', entryBeat:'ch13-home'},
  hostSegments: ['station(ch11)','return(ch12)'],
  producedReceipts: [ the four ch11/ch12 receipt strings ],
  entryGuarantees: [...], evidenceRefs: [...] }
```

Ordinary adjacency stays strict and unchanged; the transition proves both boundaries independently. Receipt strings stay byte-identical, owned by `spaceStationStory.ts::STATION_STORY_MILESTONES` (`:29`; `bootstrapStationStorySession :108`, `deriveStationStoryStep :134`, `issueBondedCell :179`, `commitStationDeparted :201`) and `stationReturnStory.ts::STATION_RETURN_MILESTONES` (`:16`; `installTidegardenBondedCell :109`, `stationReturnPending :39`, `stationReturnObjective :56`, `stationReturnMarkerTarget :85`, `STATION_RETURN_INSTALL_REACH :137`). Do not reimplement either transaction.

New `state:` refs need a producer in `storyBoundaryTelemetry.ts` (`deriveStoryBoundaryState :120`, `readStoryBoundaryRuntime :208`, `publishStoryBoundaryTelemetry :264`) **before** the allowlist `SUPPORTED_STATE_REF_PATTERNS` (`chapter-registry-gate.mjs:27`) gains a pattern. `story-authority.json` (`runtimeBeatOrder`, `runtimeEvidenceChain`, `activeProduction`, `openReleaseGates`) and `chapter-journey-contract.json` change only after signature; the `ch4-arrival` demo ceiling is untouched.

Generator order: create `beats/ch13/index.ts` → `npm run chapter:registry:generate` → hand-add the `ch13` registry record and the `beats/index.ts` import → `chapter:registry:check`, `chapter:journey:check`.

## 7. Rail seams: station movie → depart → flight → Tidegarden → install → next chapter

Pinned: `App.enterSpaceStation` strips `story`, `movie` and debug flags before the hard navigation — **a rehearsal `story=<beat>` must never be reintroduced or the completed save is reseeded**. `SpaceStationSandbox.onSequenceComplete` persists departure and returns with `undock`/`fly`, consumed by `spaceStationUndock.ts::{parseUndockFlag :22, requestedUndockAddress :39, searchAfterUndockConsumed :49, undockedShipPose :66}`. `StationScreeningDriver.tsx` currently ends after cell acquisition + dwell.

Required seam chain, each phase bounded and reporting `stuck` rather than rescuing: `stationmovie=1` → real airlock/depart action → screening-intent carried on the return URL **without** `story=` → `undock`/`fly` reconstruction → flight/landing rail → real `installTidegardenBondedCell` F action in `world/TidegardenSettlementWorld.tsx` → invitation at the certified-home core → ch13 entry watch. `autopilot/primitives.ts::isMovieStationBridgeActive` (`:1732`) stays eligible whenever ch10 is complete today; it must yield once departure/return supersedes it. Rails derive from `autopilot/rails.ts::BEAT_RAILS` (`:5`); `railDiscipline.test.ts` pins a 29-file census — update it honestly.

## 8. Score and signed AV

`commonGroundScore.ts` calls only the existing facade: `storyScore.ts::{setScoreBeat :1017, getStoryScoreMood :972, setStoryScoreMoodOverride :993, unlockStoryScore :967, resetStoryScoreRuntime :1032, setScoreIntensity/scoreHit :965}` plus `MOOD_TONIC_CHAINS :594` / `TONIC_CHAIN_POLICY :606` rows; `emergentScoreDirector.ts` is the reselect-on-reload pattern. The ≤5 s live-only coda is the one new behavior — deactivation clears score immediately today — so ch13 needs a chapter-local presentation hold handing to the existing 4.5 s release fade, cancelling on every signed trigger, never deferring/hydrating/replaying. No new `STORY_HIT_ANCHORS` (`:538`) entry, no engine graph.

Signed AV: register the scene in `generate-scene-av-runtime.mjs::SIGNED_SOURCES` and its mirror `signedSceneAvRuntime.ts::SIGNED_SCENE_AV_SOURCES` (`:49`, per-scene sha/revision constants + anchor census), then `scene:av:generate`/`check` regenerate `generatedSceneAvRuntime.json`. Commits publish via `activateSignedSceneSemanticEvent` (`:850`) / `activateSignedSceneAnchorById` (`:844`); `enterSignedSceneAvBeat` (`:785`), `tickSignedSceneAvRuntime` (`:855`), `resetSignedSceneAvRuntime` (`:903`) keep beat/pause/reset ownership.

## 9. Behavioral test holes (new) and existing anchors to extend

New: `commonGroundState.test.ts` (capacity, corner preservation, tested-prefix/tail-revision, wrong actor/world, absent/legacy/malformed hydration, clear scope); `commonGroundRoute.test.ts` (trunk-solid guard, three distinct refusal reasons, hold-at-last-safe, replan on terrain revision); `commonGroundDirector.test.ts` (one acknowledgement per objective entry, marker/work-order parity, idempotent commit, reciprocal precondition); `commonGroundScore.test.ts` (coda cancellation matrix, no replay on hydrate).
Extend: `allContracts`, `beatRegistry`, `railDiscipline`, `screeningParity`, `auditWorkerPresence`, `storyInteractions`, `storyState`, `persistence`, `stationReturnStory`, `spaceStationStory`, `spaceStationUndock`, `storyBoundaryTelemetry`, `agentSurfaceNavigation*`, `groundedSurfaceMotion`.

## 10. Remaining dependencies before an engineer can start

1. Selected instrument range (12 vs 24) and socket assignment — unsigned, three-lane.
2. Arena coordinates plus proof the two route classes meet the ≥12-unit / ≥25% / ≥6-unit-unsupported floor. Pass 2 says the current arena does **not**; do not freeze it.
3. Trace caps, spacing, corner threshold, witness radii/tolerances as contract constants.
4. Exact objective ids, marker labels, work-order copy, feedback ids (Chapter's four `guidanceReplacements` supersede earlier wording).
5. The `externalTransitions` shape signed into the registry schema + gate.
6. Signed contract sha/revision for the AV inventories and `sceneContracts`.
7. Owner-delegated decision after the three signatures; lock moved off `planning-only`.
