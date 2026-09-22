# continue-controller-wire — actual entrypoint adaptation APPLIED

Continuation of the original `continue-controller-closure` invocation (50554).
Original deadline `2026-09-06T20:59:21.964214Z` honoured; no new repair budget.
CPU only. **No browser, no GPU, no build, no headed session. `main/` read-only.**
Read `producer-continue-controller-helper-review.json` first, then only the
prior closure report's remaining requirements and the relevant entrypoint/helper
sections.

## What actually changed

The entrypoint is no longer the byte-identical copy. `earned-continue-3d-probe.mjs`
moved from `2a9c9a54…` to `2f9e297c…` and now **calls** the helpers.

| Mandatory correction | Status |
|---|---|
| Wire helpers into the executable path | **DONE** — 7 call sites in `walkTowards` / PHASE 3 / PHASE 4 |
| objectiveId vs INTERACTION actionId conflation | **DONE** — real mapping read from source |
| `offer.accepted` generic phase change OR anchor presence | **DONE** — exact new signed transition |
| Continue beat/world/seed/pose telemetry | **DONE (armed, not run)** |
| 301 dirty paths are not this engineer's | Acknowledged; no attribution from git counts |

## The ID mapping, from the actual source

Four namespaces, kept separate:

- **objectiveId** `ch13:survey:offer-span` — `ch13SurveyObjective(state='offer-span')`
  at `objectivePrimitives.ts:761-766`, surfaced as
  `[data-story-guidance-hud][data-objective-id]` at `StoryGuidanceHud.tsx:148`,
  read by `evidence.mjs pageReadState:112` and this probe's `uiProbe`.
- **actionId** `story-ch13-offer-span` — storyInteractions candidate,
  `commonGroundDirector.ts:1632`.
- **verb** `Offer the walked span` — `commonGroundDirector.ts:1633`.
- **directiveKey** `ch13:survey:offer-span` — `commonGroundMarkerTarget` switch,
  `commonGroundDirector.ts:1552`. Same literal as the objectiveId, different
  publisher; compared separately.

**The current drawing objective does differ.** `commonGroundDirector.ts:1478-1485`:
while `survey.phase === 'drawing'` the published objective is
`ch13:survey:draw` until `slot.samples.length >= 2` **and** the player is within
`CG_POINT_REACH` of `CG_POSES.E`. Only then does it become
`ch13:survey:offer-span`. Binding on `survey.phase` alone was insufficient, so
the contract now carries `notYetObjectiveId: 'ch13:survey:draw'` and the
authorization refuses it by name.

The correct ID exists in the shipped source and is published by the shipped HUD.
**No observation gap was manufactured** out of having used the wrong ID.

### Binding
`mayPressF({objectiveId, expectedObjectiveId: contract.objectiveId, prompts,
verbPattern}).ok === true` **and** `beat === 'ch13-survey'` **and**
`survey.phase === 'drawing'` **and** `objectiveId === 'ch13:survey:offer-span'`
**and** FOOT arrival at E established by `groundTargetArrival` on the live
`bodyPose`, against the literal prompt
`[F] Offer the walked span for W-7744 to test.`

`gateInputsFromAuthorization(spanAuth).promptOffersF` — a **boolean** — is passed
to **both** `newActionGate` and `groundedActionGate`. It throws `TypeError` on an
object, which is exactly the attempt-1 truthiness defect.

Refused and proved refused: `[F] Drink`; `[F] Offer this end`
(`story-ch13-hold-witness`); an object `{ok:false}`; the stale/not-ready
`ch13:survey:draw`; the actionId used in the objectiveId slot; wrong beat;
missing foot arrival; missing objective.

## Acceptance criterion

Before: `phase !== 'drawing'` **OR** `anchors.includes('anc.cg.route-offered')` —
a generic phase change or the mere *presence* of an anchor.

Now: `spanAuth.ok === true && fPressed === true && ` the `anc.cg.route-offered`
anchor is **new relative to the pre-[F] `anchorsBefore` baseline** `&& ` the
restored **19-anchor prefix is still intact and in order**. Unrelated new anchors
are listed and ignored. `commitCommonGroundSpanOffer` is the `perform()` of
candidate `story-ch13-offer-span` (`commonGroundDirector.ts:1634`); the anchor is
read from the bridge's existing `diagnostic.anchors`. No imagined API.

## Calibration, in the actual `walkTowards`

Per-key `stampedCalibration(upAtSample)` replaces the single pre-round `basisUp`
latch. `recalibrationDecision()` gates re-calibration on the 6u
meaningful-directed-motion guard and the 6-round hard cap, with
`faceChangeRetention()` / `dirsFromEntries()` keeping directions that still
project usably into the current plane. `accumulateDirected()` accumulates **real
foot displacement** only. `runCalibration(why, onlyKeys)` re-measures only the
stale keys.

Foot is `cur.bodyPose` (full XYZ) throughout arrival, steering and accumulation.
`bodyCentre` is retained beside it as `diagnosticOnly` and is **never**
substituted; a missing `bodyPose` stops the walk with `no-foot-pose`.

> The 6u minimum and the 6-round cap are **private safeguards on the probe's own
> retry behaviour**. They are not evidence of route progress and are not reported
> as such.

## Continue telemetry (armed, never run)

Armed immediately **before** the real
`page.click('button[aria-describedby="landing-story-subtitle"]')`, harvested
after the restore wait. Passive per-rAF read-only copies of hooks that already
exist:

- `window.__storyBeat` — the same hook `evidence.mjs pageReadState:111` already
  reads. Not a guessed `__storyBeat` API.
- `window.__paravoxiaCommonGround.snapshot()` — `bodyPose` / `bodyCentre` / `up` /
  `worldBound`, the hook `cgSnap` already uses.
- `window.__voxelDebug.spawn.{terrainSeed, playerRequested}` —
  `EfficientScene.tsx:302-313`.

No setter, no forced world switch, no physics stop, no `waitReady` while the menu
is up. Every field is null-retained when unpublished, with per-field
`neverPublished` flags; nothing is back-filled. The sampler stops and
`delete window.__voxContinueSampler` on harvest.

Per `producer-continue-pose-scope-review`: `:p1` is a **sibling planet**, not an
actor copy, and the prior report's world excursion stays **unproved**. This
sampler is the instrument that could settle the exact mount/seed/beat transition;
it asserts nothing yet, and **no source cause is patched or inferred**.

## Commands run

```
$ node liveCalibration.selftest.mjs        -> 36 passed, 0 failed
$ node tangentSteering3d.selftest.mjs      -> OK — all CPU cases passed
$ node groundFrame.selftest.mjs            -> 25 checks, 0 failed
$ node entryAdaptation.selftest.mjs        -> 31 passed, 0 failed   (NEW)
$ node --check earned-continue-3d-probe.mjs -> syntax OK
$ node -e "import('./earned-continue-3d-probe.mjs')" -> module graph resolved
```

Full log: `logs/continue-controller-wire/tests.log`. The unaffected 108 were not
rerun.

`liveCalibration.selftest.mjs` reported **31 passed, 3 failed** immediately after
the namespace fix. The three failures were the fixture itself passing `actionId`
in the `objectiveId` slot. The fixture was corrected and two new namespace
refusal checks added.

`entryAdaptation.selftest.mjs` asserts the actual entrypoint calls each helper,
that the old latch and the old acceptance expression are gone, that both gates
receive the boolean, and that the sampler is armed before the click and cleaned
up. **An unwired helper cannot pass it.**

## Status

`READY-PREPARED` — the actual executable entrypoint is wired and the affected
tests execute that wired path. Candidate source/bundle repin and the runtime run
remain later work and are **not** claimed.

Where the gate refuses, that is the **controller refusing to authorize [F] under
the signed contract**. It is not evidence that the game or the action is
inaccessible.

## Incomplete

1. **No headed run.** The wired entrypoint has never executed against a live
   build; every claim is CPU-static or unit-level.
2. The Continue sampler has produced **zero frames**; the mount/seed/beat
   transition remains unresolved.
3. `window.__paravoxiaSystem.snapshot()` is used opportunistically for
   `activePlanetId` and was **not** verified to exist in the shipped bundle. It
   is null-retained and flagged, not assumed.
4. `renderOrigin` falls back to `snapshot().worldBound`; a dedicated
   `renderOrigin` field was not confirmed on the bridge.
5. Candidate source/bundle repin and runtime remain later work.

## Preservation

Original probe dir `verifier/probes/earned-continue-3d/` and the failed capture
`verifier/captures/earned-continue-3d/attempt-1/` untouched. Prior reports,
invocations and producer metadata not opened for write. `main/` read-only —
`git status main/` = 301 pre-existing paths owned by the independent
source-integration lane (main writer 55635), unchanged by this role. No
attribution is drawn from git status counts.
