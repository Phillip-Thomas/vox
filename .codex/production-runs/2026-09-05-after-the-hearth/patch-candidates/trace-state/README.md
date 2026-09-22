# Candidate: Common Ground bounded trace/snapshot state (PREFLIGHT, NOT INTEGRATED)

Status: **isolated proposed patch component.** Not imported, not registered, not
in `main/src`. No canon/authority/validator/peer file was touched. No build, no
browser, no GPU, no full-repo `verify`. Runtime is unchanged. This is not scene
approval, not source integration, and not a fourth creative lane.

Files (this folder only):

| File | sha256 | lines |
| --- | --- | --- |
| `commonGroundTraceState.ts` | `751f8fad9d6614b5724582a9ca2e3b281735453e480303c4ab9b423e78703b3b` | 314 |
| `commonGroundTraceState.test.ts` | `0e5206e7211922507592f85d7e3a2159822a0cb97af7a8a952f53ed30788762c` | 211 |

Results: `vitest run --root <this folder>` — **15/15 pass**, 1 file, no watchers,
no ENOSPC. `tsc --strict --noEmit` on both files — **0 errors**. No failure was
discarded; there were none after the files reached the state hashed above.

## Exact exported interface

```ts
COMMON_GROUND_SNAPSHOT_VERSION = 1
type SlotId = 'accepted' | 'working'
type HoldReason = 'out-of-range' | 'unsupported' | 'occluded' | 'reference-vacated'
type AdmitRefusal = HoldReason | 'non-finite' | 'discontinuous' | 'below-spacing'
                  | 'below-corner-threshold' | 'sample-capacity' | 'length-capacity'
interface TracePose { x; y; z }        interface TraceSample extends TracePose { corner }
type TraceSampleTuple = readonly [x, y, z, 0 | 1]
type GroundVerdict = { supported: true } | { supported: false; reason: HoldReason }
type GroundPredicate = (pose: TracePose) => GroundVerdict
type GeometryPredicate = (s: CommonGroundSnapshot) => GroundVerdict
interface TraceLimits { maxSamples; maxTraceUnits; sampleSpacing; minCornerSpacing; maxSampleStep }
interface TraceSlot { id; samples; lengthUnits; testedPrefixCount; tailRevision; offeredEndIndex }
interface CommonGroundSnapshot { version; actorId; worldId;
  survey: { accepted: TraceSlot | null; working: TraceSlot | null };
  witness: { sampleIndex; offered } | null;
  common: { reciprocalHeld; finalReferenceOffered; committed };
  hold: { reason: HoldReason | null }; safePose: TraceSample | null }

assertTraceLimits(l): Outcome<TraceLimits>
createEmptySlot(id) / createEmptySnapshot(actorId, worldId)
appendSample(slot, pose, corner, limits, ground): { status:'appended'|'refused'; slot; reason? }
reviseTail(slot, fromIndex): Outcome<TraceSlot>
markTestedPrefix(slot, { kind:'grounded-test', reachedIndex }): Outcome<TraceSlot>
invalidateTestedPrefix(slot, { kind:'voxel-change'|'support-loss', fromIndex }): Outcome<TraceSlot>
clearUncommitted(s, { explicit:true, actorStationary, atStartReference }): Outcome<CommonGroundSnapshot>
recordSafePose(s, pose, ground): Outcome<CommonGroundSnapshot>
authorizeResume(s, revalidate): Outcome<CommonGroundSnapshot>
commitFinalComparison(s, { kind:'grounded-arrival', reciprocalProof, clearance })
  : { snapshot; emitCompletion; refusal }
serializeCommonGround(s) / hydrateCommonGround(raw, actorId, worldId, limits) / migrateCommonGround(raw)
```

## Properties the tests pin

Honest capacity stop with the sample and length caps reported independently and
the slot returned unchanged; no recorded corner is ever decimated; corners admit
below sample spacing but not below the corner threshold; discontinuous, unsupported
and non-finite input refused through the caller predicate; tested prefix preserved
across repeated cost-free revisions and lowered only by explicit terrain evidence;
`tailRevision` bumps only on a real tail edit; `clearUncommitted` never touches the
accepted route and refuses non-explicit/moving/off-reference callers; commit emits
completion exactly once and a repeat never replays it; renderer pose and resume both
require a live ground/geometry check; wrong actor, wrong world, legacy, malformed and
oversized saves hydrate to `null` rather than a partial graft; defensive copies on
input, output and round-trip; hydration alone cannot fabricate completion or a hold.

## Deliberate non-decisions

- **No numeric bound is hardcoded.** `TraceLimits` is caller-supplied. The
  candidate's stated 128 samples / 120 units / 1-unit spacing / 0.25 corner
  threshold, the witness radii/tolerances and the 12-vs-24 instrument range are
  contract-supplied and unsigned; tests use small local values only.
- No range/geometry/arena/layout/default-story behaviour is chosen here.
- No story copy, marker label, objective id or navigation physics is invented.
- The survey route class and the common reciprocal span/final reference are
  separate fields and are never merged.
- No story-ledger or station-transaction logic is reimplemented.

## Remaining wiring (all unresolved, none performed)

1. Move to `main/src/story/commonGroundState.ts` and colocate the test — only
   after the scene contract signs the numeric constants.
2. `persistence.ts`: add `commonGround?: unknown` to `WorldSave`, write beside
   `habitat` guarded by `worldId`, add `restoreCommonGroundForWorld` /
   `clearCommonGroundForWorld`, clear in `clearWorldStateForWorld` for that world
   only. `storyState.ts::restartStory()` needs an explicit ch13 clear call.
3. Live hooks NOT supplied here: the real `GroundPredicate` (solid/support/slope
   from the live terrain runtime), the `GeometryPredicate` for resume
   revalidation, the range/occlusion witness test, and the actual footstep source.
   Route planning and the trunk-solid guard belong in `commonGroundRoute.ts`.
4. Director, marker/objective publication, score coda and beat contracts are out
   of scope for this component.

## Limitations

Combined 525 lines, over the requested 450 (implementation 314 / tests 211); no
coverage was removed to reach the target. Pure unit evidence only — nothing here
demonstrates production behaviour, playable state, or scene feasibility.
