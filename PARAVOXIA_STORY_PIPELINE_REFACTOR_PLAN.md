# Paravoxia — story beat pipeline refactor

**Status: IN PROGRESS — Batches 0–2 gated; Batch 3 landed (every chapter registered), gating. Not a production lock.**
Date: 2026-09-04 · Author: engineering session following the ch1 / mobile-HUD / movie-mode repair pass.


Progress log (2026-09-04):

- **Batch 0** — `BeatContract` / `registerBeat` / `getBeatContract` under `main/src/story/beats/`,
  the exhaustiveness `todo` naming every uncovered beat, the rail-discipline source scan,
  the parity scaffold, `__storyObjective` / `__storyInputPolicy` debug globals, and
  `tools/story-ladder-trace.mjs` (`npm run story:ladder:trace`, `--baseline` / `--compare`).
  Same-build A/B via `?beatregistry=off`.
- **Batch 1** — chapter-1 contracts (10 beats) delegating to the shipped resolvers;
  `classifyStoryObjectiveGuidanceBeat`, `resolveStoryObjectiveGuidance`, the input-policy
  refresh, `storyHudTakeover`, `storyUsesEmbodiedGuidanceHud`, `storyUsesEarlyTouchDpad` and
  the external-camera mix now consult the registry first and fall back to the legacy tables.
  `ch1Contracts.test.ts` asserts field-by-field agreement with the legacy tables and that the
  public API answers identically with the registry on. **Gate passed 2026-09-05 00:2x:**
  ladder trace hash `807707ac2d5da57f`, 43 beats, 0 failures, registry-on run
  **identical** to the registry-off baseline on the same build.
- **Batch 2 (2026-09-05)** — `storyFreeMarkerTargetFor(beat, candidate)` extracted from
  `storyFreeMarkerTarget()`; `getChapter10MarkerTarget` already took the objective. The
  driver registers one `candidateTargetExists(beat, candidate)` probe covering ch1 handle
  beats, ch10 and every post-feed beat, so a mandatory rung is never published before its
  target exists in ANY chapter. The four-beat `TARGET_GATED_BEATS` restriction is gone.
  **Gate rule for this batch** (`tools/story-ladder-diff.mjs --allow-health`): a rung may
  now publish one frame later, so an entry state's `health` may go `missing-marker → ready`
  and a leading pre-target state may drop; nothing else may change, and no objective the
  baseline shows may be absent — an absent objective is a rung with no findable target,
  which is the defect the gate exists to expose. After review the ladder is re-baselined.
  **Result 2026-09-05: zero diffs** — the generalised gate changed nothing the player is told
  on entering any beat. (Note for readers of the trace: `health` there reflects the driver's
  marker *observation*, which lags publication by a frame, so a `missing-marker` entry state
  is not by itself evidence of a missing target.)
- **Batch 3 (2026-09-05)** — every remaining beat (prologue, ch2–ch10; `done` excluded as the
  runtime terminal) is registered through `defineLegacyBeat(id)`, which READS each contract's
  values from the legacy tables at registration (`classifyLegacy…`, `resolveLegacy…`,
  `policyForBeat`, the exported `EARLY_TOUCH_DPAD_BEATS` / `EXTERNAL_CAMERA_BEATS` sets, the
  autopilot's timeout/wait tables). Coverage is complete by construction: the exhaustiveness
  test is now a hard assertion, and `allContracts.test.ts` checks every registered beat
  against the legacy tables field by field. Hand-authored per-beat files (ch1's style) replace
  the derived ones chapter by chapter from here, each under the ladder trace.
  **Gate passed 2026-09-05 04:32:** ladder compare with every chapter on the registry
  classified **0 disallowed differences** (`--allow-health`), and the ladder was re-baselined
  at hash `807707ac2d5da57f` — the same 43-beat hash Batch 1 produced, so three batches of
  registry take-over have changed nothing a player is told or allowed on entering any beat.
  The baseline now carries `worldprep=sync` in its query so the story ladder is measured
  independently of the world-gen refactor's boot path.
- **Batch 4 (2026-09-05)** — chapter 10 is hand-authored (`beats/ch10/ch10-*.ts`, ch1's
  style) with `ch10-cold` declared `entry: 'reactivation-from-done'`, and the emergent
  director's free-play watch now asks the registry which beat is the door
  (`chapterReactivationBeat('ch10')`, legacy literal as the fallback) instead of naming it.
  The station chapter gets its door the same way. `getChapter10MarkerTarget` already takes
  the objective (Batch 2) and is reached through the driver's single probe. No signed
  contract field moved, so the cohesion judge is not re-run. **Gate passed 2026-09-05
  05:03:** ladder compare on the tree with ch10 hand-authored and the backstop census wired
  — hash `807707ac2d5da57f`, identical to baseline, 0 diffs.
- **Batch 5, step 0 (2026-09-05)** — before any backstop is deleted, every one of the
  sixteen sites in `autopilot.ts` where the screening grants an item, seeds a milestone or
  advances a beat on the player's behalf now calls `railBackstop(kind)`, which logs the beat,
  the second of the beat and the screening second, warns on the console, and exposes the
  list as `window.__railBackstops` (count in `__autopilot.backstops`). `npm run perf:seams`
  prints the list after its full movie run. The next full run is therefore the evidence for
  step 2: a backstop that never fires is deleted outright; one that fires names a rail that
  cannot finish its beat honestly, and THAT is the defect to repair — the rail, not the log.
  **Census from the first clean full run (2026-09-05 05:18–05:43, `done` reached):** two of
  sixteen fired — `ch2-color @45s: advance to ch2-approach` (the walk toward the hero tree's
  crown did not cross the flip radius inside the budget: a rail defect to repair) and
  `ch3-gather @21s: grant campfire materials, place fire` (the designed bypass of the
  UI-driven craft: a PARITY defect — the screening should craft through the player's own
  path). The other fourteen never fired and are candidates for outright deletion in step 2,
  each under a fresh full run.
- Trace lesson: the first compare diffed four NON-ch1 beats. Cause: the trace ran with the
  movie autopilot on, so it recorded *when the screening happened to act* inside the
  sample window. The ladder now traces with `movie=0` — what the player is told and allowed
  on entering a beat — and the screening's behaviour belongs to the parity/rail tests.
- Trap avoided by design: contracts call `resolveLegacyStoryObjectiveGuidance` /
  `policyForBeat` (legacy bodies), never the public functions, or a registered beat would
  resolve itself forever.

This plans the consolidation of everything that has to be declared per story beat into
one contract per beat, so that adding a chapter becomes one file and the failure classes
found on 2026-09-04 become structurally impossible rather than reviewed-for.

---

## 0. The shape of this, in one paragraph

Today a beat is declared in roughly ten hand-maintained places across eight files
(~11,400 lines), nothing checks that they agree, and when they disagree the game fails
*silently* — copy lands on a channel the player never sees, a marker rung publishes before
its target exists, a beat with no timeout entry hangs forever, and the movie lane runs code
the player never runs while its backstops keep every gate green. The refactor introduces a
single `BeatContract` per beat from which every existing per-beat table is **derived**, an
exhaustiveness test that makes a partial declaration a build failure, one work-order
channel instead of two, one marker resolver instead of three, per-beat autopilot rails
instead of a 2,900-line switch, and a parity test that proves the screening reaches the
world through the same entry points the player does. **No beat's authored behaviour
changes.** Every batch is gated on `verify`, `verify:visual`, and a byte-identical
objective/copy/marker trace of the shipped ladder.

---

## 1. Evidence — what this is fixing

All of the following were observed on 2026-09-04 in one session. They are one
architecture producing one failure four ways, not four bugs.

| Failure | Where | Root cause |
|---|---|---|
| Repaired ch1-raster copy never reached the player | `storyObjectiveGuidance.ts` vs `CH1_WORK_ORDERS` in `storyScript.ts`, restored by `syncFoundationalStoryObjective` | **Two work-order channels**; the feed renders one, the objective store holds the other. The auditor found it once; the same session then did it again knowingly. |
| Deadlock guard protected exactly one chapter | `chapter10GuidanceFindable` in `emergentStoryDirector.ts` | **Three marker resolvers** (`surveyMarkerTarget`, `storyFreeMarkerTarget`, `getChapter10MarkerTarget`); only one had the guard. The guard could only be generalised to 4 beats safely because the other resolvers read the *published* objective. |
| Continuous movie run stalled 589s+ in `ch8-landfall` | `autopilot.ts` switch + `BEAT_TIMEOUT` | Beat had no `deep_space` case and **no timeout entry**; nothing anywhere could end it. |
| ch1 player softlock invisible to 4/4 clean movie runs | `EfficientPlayer.pickSideTarget`, `autopilot.ts` backstops | **Screening ran a different extraction probe set than the player** and force-grant backstops (`addItem`, `seedDebrisCollected`) advanced beats a player could not. |

Counted today: `autopilot.ts` 29 beat cases · `storyDirector.ts` 75 beat cases · 52
objective resolvers · 10 `Set<StoryBeat>` / `Record<StoryBeat, …>` tables · plus
`chapter-journey-contract.json` and `chapter-registry.json`.

---

## 2. Target architecture

### 2.1 `BeatContract` — one declaration per beat

```ts
// main/src/story/beats/<chapter>/<beat>.ts
export const beat: BeatContract<'ch1-raster'> = {
  id: 'ch1-raster',
  chapter: 'ch1',
  disposition: 'objective',            // | 'cinematic'
  objective: facts => ...,             // today's OBJECTIVE_RESOLVERS entry
  copy: { voice: 'regulation', ... },  // ONE channel — see 2.2
  marker: (facts, candidate) => ...,   // ONE resolver, takes the CANDIDATE — see 2.3
  input: rasterPolicy,                 // today's storyInputPolicy case
  hud: { feedEffects: true, embodiedGuidance: false, earlyTouchDpad: true, externalCamera: true },
  rail: ch1RasterRail,                 // per-beat autopilot module — see 2.4
  wait: { reason: 'RECOVERING THE STRIP', policy: 'labelled-hold' },
  journey: { ... }                     // the chapter-journey-contract fragment
};
```

Every table that exists today becomes a **derived view** of the registry:
`DRIVEN_BEATS`, `BEAT_TIMEOUT`, `WAIT_REASONS`, `EXTERNAL_CAMERA_BEATS`,
`EARLY_TOUCH_DPAD_BEATS`, `TARGET_GATED_BEATS`, the legacy-restore list, the
`STORY_OBJECTIVE_GUIDANCE_CLASSIFICATION` map, `storyGuidancePresentation`'s ownership
booleans, and `chapter-registry.json`'s `beats` arrays.

`STORY_BEAT_ORDER` stays the single source of *sequence*; the registry is the single
source of *behaviour*. An exhaustiveness test asserts every beat in the order has a
contract and every contract names a beat in the order.

### 2.2 One work-order channel

`CH1_WORK_ORDERS` and the `legacyFeedCopy` restore block in
`syncFoundationalStoryObjective` are deleted. The objective store is the only copy
authority. The regulation feed renders it through an **era-voice presenter** (the same
shape as `inputGlyphs.ts`, which already presents keyboard tokens per era), so the
Authority register, the prologue echoes, and the staged directive swaps are preserved as
presentation over one source rather than as a second source.

Guardrail: `RegulationFeedHud` and `StoryGuidanceHud` both read `getActiveGuidedStoryObjective().workOrder`. A test renders each surface for every objective beat and asserts the rendered copy is the store's copy. Copy can no longer land on a dead channel because there is no second channel.

### 2.3 One marker resolver, taking the candidate

`resolveMarkerTarget(beat, facts, candidate: GuidedStoryObjective): StoryMarkerTarget | null`
replaces `surveyMarkerTarget` (driver), `storyFreeMarkerTarget` (director) and
`getChapter10MarkerTarget` (emergent director). Passing the **candidate** removes the
circularity that limited today's guard: the publication gate becomes
`candidate.requiresMarker === false || resolveMarkerTarget(...) !== null` for **every**
beat, and the `registerFoundationalMarkerProbe` inversion added on 2026-09-04 is retired.

World handles (`anomalyStoneHandle`, `signalMesaHandle`, pods, waypoints) are read
through a `WorldHandles` facade the driver populates, so the resolver lives with the
contracts and imports no React component.

### 2.4 Autopilot rails as contract modules

The 2,887-line `autopilot.ts` switch becomes one rail module per beat exporting
`tick(ctx): void`, with shared primitives (`walkToward`, `holdAt`, `pulseInteract`,
`performStoryInteraction`, the screening cadence, the wait-state tracker, the `done`
and station bridges) in `autopilot/primitives.ts`.

**Rule, enforced by test: no rail may grant an item or advance a beat.** `addItem`,
`seed*Collected`, `advanceToBeat`, `markMilestone` are not importable from a rail module
(lint rule + a source-scan test). A rail that cannot make progress emits a `rail-stuck`
signal with a reason; the wait overlay shows it and the movie probe reports it **red**. A
stuck rail is evidence, never a green run.

### 2.5 Player / screening parity

For every driven beat, a test asserts the rail reaches the world through the same entry
points the player uses: extraction via `pickSideTarget`/`pickHarvestTarget`, interaction
via `resolveStoryInteraction`, docking via `commitSpaceStationDock`, station transaction
via the panel's own buttons. Concretely: the rail may only touch the world through an
`AutopilotWorldAccess` interface whose implementation *is* the player's input path. A
rail that needs something the interface does not offer is a design signal, not a
reason to add a bypass.

---

## 3. Sequencing

Each batch lands green on `npm run verify` and `npm run verify:visual`, plus **the ladder
trace**: a headless run that records `(beat, objective.id, workOrder, markerLabel, health,
inputPolicy)` per frame for every beat via deep link, diffed byte-for-byte against a
baseline captured **before Batch 0**. The trace is the refactor's determinism fingerprint,
exactly as `proceduralWorldGeneratorDeterminism.test.ts` is for terrain.

### Batch 0 — Baseline and scaffolding (no behaviour change)
1. Capture the ladder trace baseline; commit it under `.codex/production-runs/2026-09-story-pipeline/`.
2. Add `BeatContract` type, empty registry, exhaustiveness test **failing** on purpose (every beat missing).
3. Add the rail import lint rule (warn-only) and the parity test (skipped) so their shape is reviewed before they bite.

Gate: baseline trace exists and is reproducible 3/3.

### Batch 1 — Contracts for chapter 1 (the most-touched chapter today)
1. Move `ch1-*` objective resolvers, classification, input policy, HUD ownership and wait reasons into contracts. Existing tables derive from the registry for ch1 and fall back to the old literals for everything else.
2. Delete `CH1_WORK_ORDERS`; the era-voice presenter renders the store's copy with the regulation register and the prologue echoes.

Gate: ladder trace identical for ch1; `story:ux:check`, `chapter:journey:check` green; ch1 HUD sweep clean.

### Batch 2 — One marker resolver
1. Introduce `resolveMarkerTarget(beat, facts, candidate)` and the `WorldHandles` facade.
2. Port the three resolvers into per-beat `marker` entries; publication gate becomes uniform.
3. Retire `registerFoundationalMarkerProbe` and `chapter10GuidanceFindable`.

Gate: ladder trace identical; a new test asserts **no beat** publishes into `missing-marker` on entry (the 2026-09-04 lifecycle trace showed `ch1-depth` and `ch1-anomaly` doing so).

### Batch 3 — Chapters 2–9 contracts
Mechanical port, one chapter per PR, trace-gated each time. `syncFoundationalStoryObjective`'s switch and the `legacyFeedCopy` restore block are deleted when the last chapter lands.

### Batch 4 — Chapter 10 and the emergent director
`emergentStoryDirector.ts`'s ch10 resolvers, `getChapter10MarkerTarget`, and the `done`
re-activation become contracts. The re-activation stays a first-class concept (`entry:
'reactivation-from-done'`) rather than a special case, so the station chapter can use it.

Gate: ch10 evidence set (`.codex/production-runs/2026-08-11-ch10-station-introduction/`) re-verified against the ported ladder; cohesion judge re-run if any signed contract field moved.

### Batch 5 — Rails
1. Extract primitives; split the switch into rail modules; flip the import lint to error.
2. Delete every `beatClock > timeout` force-grant. Replace with `rail-stuck` + labelled wait.
3. Enable the parity test.

Gate: full continuous movie run (`?story=1&movie=1`) reaches `done` → ch10 → station with **zero** `rail-stuck` signals, and the run's beat timings are within 10% of the pre-refactor run recorded on 2026-09-04 (the ch8 measurement in the perf report is the baseline).

### Batch 6 — Registry as authority
`chapter-registry.json` `beats` arrays and `chapter-journey-contract.json` mandatory
objectives are **generated** from the contracts (`npm run chapter:registry:generate`),
with `chapter:registry:check` diffing generated vs committed. Hand edits to either JSON
become a check failure.

---

## 4. What this must not do

- **Change any beat's authored behaviour.** The ladder trace is the contract. A trace diff is a defect, not a refactor.
- **Keep force-grant backstops "for safety."** They are the mechanism that hid the ch1 stall. Labelled holds are honest; silent skips are not.
- **Let a rail bypass the player's entry points.** If a rail needs a bypass, the beat's *player* verb is under-specified — fix that.
- **Touch the flight snapshot / `ShipController` interface.** See §5.

---

## 5. Coordination

- **Ship refactor (in flight):** the ch8/ch10 rails read `getSpaceFlightSnapshot()`, `enterShip`, `exitShip`, `spaceStationApproachGeometry`, `commitSpaceStationDock`. Batch 5 must not start until the ship refactor has frozen that interface, or the two will collide in `autopilot.ts` the way the fauna refactor and the HUD work collided on 2026-09-04. Agree the `AutopilotWorldAccess` flight surface with that agent first.
- **Sound refactor:** `feedbackCues.ts` (one-shot objective-enter cue) is a consumer of objective IDs. Batch 1–4 keep every objective ID byte-identical, so no cue changes; if the sound refactor renames the cue bus, the contracts consume it at Batch 6.
- **Harness refactor:** the ladder trace and the parity test are new probe surfaces. Land them through whatever probe framework that refactor settles on rather than adding a third harness style.
- **This machine runs concurrent sessions** (see `CLAUDE.md`). Every batch checks file timestamps before treating a gate failure as its own.

---

## 6. Exit criteria

- One file per beat; every derived table generated; exhaustiveness test green.
- Zero work-order channels other than the objective store.
- One marker resolver; no beat publishes into `missing-marker` on entry.
- Zero force-grant backstops; parity test green; import lint at error.
- Continuous movie run completes to the station with no `rail-stuck`.
- Ladder trace byte-identical to the Batch-0 baseline.
- A new chapter can be added by adding files under `main/src/story/beats/<chapter>/` and nothing else.
