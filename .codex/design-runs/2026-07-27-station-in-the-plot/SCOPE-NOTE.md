# Scope note — concurrent tooling work

The Chapter Director correctly flagged, mid-run, that runtime story files were
changing while a new-direction council was in progress. Those edits are the
orchestrator's, they are not part of this run, and they are recorded here rather
than left to be inferred.

## What changed, and why it is not story mutation

| Path | Change | Lane |
| --- | --- | --- |
| `main/src/game/systems/storySnapshot.ts` | new | debug tooling |
| `main/src/game/systems/storySnapshot.test.ts` | new | debug tooling |
| `main/src/story/StoryDebugPanel.tsx` | snapshot slots added | debug tooling, dev-gated |
| `main/src/story/storyState.ts` | `?keep=1` early return in `initStoryFromSave()` | dev entry path |

Commissioned separately by the owner in the same message that opened this run:
*"improve the ease of debugging by being able to repeatedly play the chapter."*

No beat, milestone, ordering, objective, marker, work-order line, canon fact,
audio path, camera, or save **format** was touched. Nothing in the shipped story
surface changes. `StoryDebugPanel` renders only under `?story=` or `?debug=1`.

The one file that deserves scrutiny is `storyState.ts`. The change adds a single
early return to `initStoryFromSave()` guarded by `?keep=1`. That function already
returns early when no `?story=` param is present, so the flag can only alter a dev
beat-jump boot — it cannot affect a normal or shipped run. Its effect is to make a
jump behave like Continue instead of wiping to pristine, which is precisely what a
restored snapshot needs. The flag is set by the snapshot restore path and by
nothing else.

## Standing

Debug tooling is not post-arrival story content and is not gated by the demo
foundation plan's story lock. The council's own output remains a direction
candidate with no authority to mutate anything.

## Carried forward from the Chapter Director — registry gate blockers

Real structural gaps that any `ch10` registry entry will hit, recorded so they are
not rediscovered later:

1. `main/src/story/storyBoundaryTelemetry.ts` (`deriveStoryBoundaryState`) emits no
   anchorage vocabulary at all. `chapter:registry:check` rejects any `stateRef`
   without a runtime producer, so station-residence claims need producers written
   before a registry entry can validate.
2. `state:system-flight/active-planet=` derives from `runtime.world.activePlanetId`.
   The anchorage is deliberately **not** a planet — it is its own target kind — so
   that ref goes absent during station residence. This is a structural gap, not a
   naming choice, and it needs a decision: either a station-residence state producer,
   or a broader "where is the player" claim that both bodies satisfy.
