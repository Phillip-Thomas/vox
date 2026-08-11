# Shipped Reference Map — ch7-reconstruct / ch8-launch

Status: `shipped` baseline captured at `03e975a666767dd3d75fc339a3b3d61dfa755c4c`,
before any mutation in this run. Everything below is observed or read directly
from source at that revision. Draft/proposed material from the Chapter
Director's treatment is marked `draft` and never mixed into a shipped row.

Evidence: `evidence/baseline-trace.json`, `evidence-hires/hires-trace.json`,
`evidence-hires/av-state-trace.json`, `evidence-hires/fps-baseline.json`, and the
screenshot strips beside them. Hashes for every file are in
`shipped-visual-baseline.json`.

## 1. Where each ch7 repair stage event fires

| Hop | Source | What happens |
| --- | --- | --- |
| Player action | `main/src/story/wreckReconstruction.ts:140` `performWreckReconstructionAction()` | Revalidates the diagnosis receipt, then dispatches through `dispatchStoryAuthorityCommand` with `commandType: 'ship_repair_stage'` and payload `{ stage }` (or `wreck_salvage_claimed` for salvage). |
| Commit | `main/src/game/systems/shipRestoration.ts:84` `commitShipRepairStage()` | Monotonic, non-skippable. Rejects out-of-order targets. On `lift_online` also `commitStoryJetInstalled()`; on `flight_ready` also `commitTidegardenRouteOnline()`. |
| Event | `main/src/game/systems/shipRestoration.ts:108-117` | `emitEmergentStoryEvent({ id: eventId, type: 'ship_repair_stage', payload: { from, to } })`. Typed in `main/src/story/emergentStoryEvents.ts:49` as `ship_repair_stage: { from: string; to: string }`. |
| Read model | `main/src/game/systems/shipRestoration.ts:70` `getShipRepairStage()` | Stable primitive snapshot. This is what `tickReconstruction()` polls every frame. |
| Signed AV | `main/src/story/signedSceneAvRuntime.ts:585-597` `anchorIdsForEvent()` | `bench_online -> anc.reconstruct.bench-online`, `frame_restored -> anc.reconstruct.frame-restored`, `hull_sealed -> anc.reconstruct.hull-sealed`, `lift_online -> anc.reconstruct.lift-online`, `flight_ready -> anc.reconstruct.route-online`. |
| Embodiment mirror | `main/src/story/reconstructionEmbodiment.ts:355-364` | Re-activates the same four semantic keys (`ship_repair_stage:` followed by the stage name) when reconciling from persisted receipts. |
| Story director | `main/src/story/emergentStoryDirector.ts:559-595` `tickReconstruction()` | Polls `getShipRepairStage()` each frame; `once()` is in scope; the only latch today is `'calibration-complete'`. **No per-stage latch exists.** |

Repair stage order: `wrecked -> bench_online -> frame_restored -> hull_sealed -> lift_online -> flight_ready`.
Calibration is a separate 8-second embodied receipt
(`main/src/story/reconstructionCalibration.ts`, `RECONSTRUCTION_CALIBRATION_SECONDS = 8`)
which fires `ev.reconstruct.calibration-completed` -> `anc.reconstruct.calibration`.

`draft` — the treatment proposes latching ten new emissions on these edges.
Mechanically that is placeable: the stage read is already per-frame and
`runtime.latches` is beat-scoped and cleared at entry.

## 2. Where `showAuditLine(text, header)` and `showCaption` route

| Call | Store | Renderer | Shape |
| --- | --- | --- | --- |
| `showCaption(text, ttlMs = 5200)` | `main/src/story/storyText.ts:77` — writes the **single** `state.caption` slot | `main/src/story/StoryCaptions.tsx` — fixed bottom-centre, `aria-live="polite"`, `data-story-caption`, per-character typewriter reveal in the renderer's own rAF | one line, centred, `theme.color.text` |
| `showAuditLine(text, header?, ttlMs = 6500)` | `main/src/story/storyText.ts:88` — writes the **single** `state.audit` slot | `main/src/story/AuditBand.tsx` — fixed at `top: 13.5%` (below the 11vh letterbox), `aria-live="polite"`, optional small-caps header line above the body line | header + body, dark pill, survives cutscenes |
| `showSystemLine(text, ttlMs = 4000)` | `state.system` slot | shares `StoryCaptions.tsx` (dim variant) | neutral system voice |
| `setWorkOrder(lines)` | `state.workorder` (replaced wholesale) | guidance HUD card in the emergent era; regulation feed pre-A2 | standing directive block |

**There is no queue and no scheduler.** Two `showAuditLine` calls in one frame
leave only the second visible; the same is true for `showCaption`. Nothing in
`storyText.ts` or `emergentStoryDirector.ts` sequences lines over time — the only
timing facility is `runtime.elapsed` comparisons inside a tick function.
`clearAuditLine()` and `clearStoryText()` exist; captions are **not** cleared at a
beat boundary (observed: ch7's exit caption was overwritten mid-typewriter by
ch7-board's entry caption 0.2 s later).

Header tokens in shipped use: `W-7744` (ch4 audit/comply/defy) and `AUDIT NETWORK`
(one line only, `a4-exhale`, `main/src/story/emergentStoryDirector.ts:499`).
`draft` — `WRECK RELAY` is not a token anywhere in `src` at this revision.

The wreck relay prop itself is real: `main/src/story/world/WreckRelay.tsx`, planted
beside the pod impact point (`getWreckRelayPose`, `storyWorld.ts:593`) — the same
impact pose the Kestrel wreck sits on (`HifiWreck.tsx:150`). It is the ch4-comply
`organics` target (`emergentStoryDirector.ts:888`). Its beacon is lit only for
`ch3-signal`, `ch4-vigil`, `ch4-arrival`, `done` — **dark during ch7/ch8**.

## 3. Which ch8 anchors currently carry no copy

All three. `anc.launch.ignition`, `anc.launch.liftoff`, and
`anc.launch.atmosphere-exit` exist in the signed contract with score cues and
shots, and none of them is referenced by any `showCaption` / `showAuditLine` /
`showSystemLine` call. `ch8-launch` emits **zero** captions, audit lines and system
lines in the shipped build; the `auditText` field is `null` in every sample of
every trace.

| Anchor | Trigger (shipped) | Shot | Copy today |
| --- | --- | --- | --- |
| `anc.launch.ignition` | semantic `ship_launched`, from `activateLaunchIgnitionFromCreatedSequence()` (`vehicleSceneAvAnchors.ts:32`) when the launch sequence is created; the emergent `ship_launched` event at the end of `tickLaunch()` maps to the same anchor | `cin.launch.01-engine-finds-weight`, lens-rig, declared 70->72 | none |
| `anc.launch.liftoff` | semantic `ev.launch.legal-liftoff`, `ShipController.tsx:742` when `hasLaunchPhysicallyDeparted(launch.from, position, launch.to)` | `cin.launch.02-world-below`, lens-rig, declared 74->74 | none |
| `anc.launch.atmosphere-exit` | semantic `ev.launch.origin-atmosphere-exited`, `VehicleSceneAvDriver.tsx:19` via `subscribeAtmosphereExit` | `cin.launch.03-boundary-without-warp`, lens-rig, declared 70->70; also the start anchor of `cin.crossing.01-room-to-look-back` | none |

**Timing fact that constrains any copy hung on the third anchor:**
`spaceFlight.leaveAtmosphere()` sets `phase: 'deep_space'` on line 391 and only
*then* notifies the atmosphere-exit listeners on line 392. `tickLaunch()`
advances the beat to `ch8-crossing` on the first tick where
`phase === 'deep_space'`. So the anchor fires in the same synchronous moment
that makes the beat-exit predicate true, and a `ch8-launch`-scoped latch has at
most one director tick before `enterEmergentStoryBeat` clears the latch set.

Because all three launch shots use `cameraAuthority: "lens-rig"`, the signed
runtime's `numericLensAuthorized()` refuses to apply their declared FOV
(`signedSceneAvRuntime.ts:305-311`) — the flight feedback controller keeps FOV
ownership. Observed `appliedFovDeg` is `null` at every launch anchor.

## 4. How ch7/ch8 are reached in dev

| Route | URL | What it does |
| --- | --- | --- |
| Beat jump | `?story=ch7-reconstruct` | `initStoryFromSave()` -> `resetDebugStoryRun()` (pristine terrain + pose, both worlds) -> `seedForBeat()` marks ch6 receipts, oxygen, keel memory banked, adds `kestrel_keel_memory`, era `emergent` -> reality stage `alive` -> publish beat. The five repair transactions and the diagnosis are **not** seeded; they must be played. |
| Beat jump | `?story=ch7-board` | additionally `markMilestone(ch7Reconstructed)` and `applyShipRestorationSnapshot({ repairStage: 'flight_ready' })`. |
| Beat jump | `?story=ch8-launch` | additionally marks the two physical-boarding receipts and `ch7Boarded`, then runs `bootstrapOriginLaunchDebug()` to reconstruct cockpit occupancy before publishing the beat. |
| Movie | append `&movie=1` | drives the autopilot. Compresses ch7 diagnose -> `flight_ready` into about 4 s and the whole beat into about 16 s (8 s of that is the fixed calibration wait). |
| Quality | append `&profile=LOW` | `App.tsx:413` `resolveQualityProfileSelection(queryParams.get('profile'), persisted)`. Values: `ULTRA HIGH MEDIUM LOW POTATO`. |
| Full run | `?story=1&movie=1` | menu-equivalent full rehearsal. |
| Snapshot / restore | Story debug panel (`main/src/game/systems/storySnapshot.ts`, commit `01c89dd`) | copies every `pvx.` / `voxel.poses` key into a `pvxsnap.` slot; restore clears before writing and reloads with `?keep=1`, which makes `initStoryFromSave()` return early so the pristine reset cannot wipe the restored moment. Preferences (graphics profile, audio) are deliberately excluded. |

Dev server for this capture: `http://localhost:5176`
(`npm --prefix main run dev -- --port 5176 --strictPort`, started by the verifier).
Ports 5173 and 5174 on this machine are held by the sibling Paraform project —
the repo's probes that hardcode 5174 will silently capture the wrong application.

## Adjacent-scene continuity

- **Incoming (ch6-dive exit -> ch7-reconstruct entry).** Caption
  `(returned with breath. returned with a way to leave.)` at
  `dive:shore-handoff`, then a 2.6 s hold, then beat change; ch7 entry publishes
  `reconstruct:diagnose` and the caption `(repair is not return.)`. Camera:
  `player-camera`, FOV 75, agency fully player. Reality stage `alive` on both
  sides. Score: signed intensity 0.26 at ch7 entry, then `null` (ch7 is excluded
  from signed score intensity by name and runs its own eight gameplay-derived
  moods).
- **Outgoing (ch8-launch exit -> ch8-crossing entry).** No ch8-launch copy at
  all; `ch8-crossing` opens with `(there is another world here. it was always
  here.)` and `ch8:crossing:acquire-sibling`. Camera stays `lens-rig`,
  `appliedFovDeg` null, story input policy FOV 75. Signed score intensity moves
  0.4375 -> 0.42 -> 0.35. `lastResetReason` is `beat-exit`.
- **Reset/replay/deep-link observed.** Every beat boundary produced
  `lastResetReason: "beat-exit"`, `activatedAnchorIds` emptied, and
  `clearGuidedStoryObjective()` followed by a fresh objective within one sample.
  Deep links reconstruct the same next action (`?story=ch7-board` and
  `?story=ch8-crossing` both published their correct entry objective at t=0).
- **Known defects vs intentional limitations** (mechanical, not taste):
  1. *Defect.* `IGNITE. LIFT. LEAVE THE ATMOSPHERE.` (`emergentStoryDirector.ts:316`)
     is never rendered: `syncEmergentObjectiveGuidance()` runs at the end of the
     same `enterEmergentStoryBeat()` call and `setWorkOrder`s the objective's own
     lines over it before React paints. Same shape at `ch8-crossing` and
     `ch8-landfall`.
  2. *Defect.* Objective `reconstruct:repair:bench_online` covers two different
     player actions (claim salvage, then install the keel workbench). The ID does
     not change between them, so `activateGuidedStoryObjective`'s id-equality
     guard suppresses the republish and the HUD keeps showing
     `WRECK BENCH · RECOVER WRECK SALVAGE` / `[F] RECOVER WRECK SALVAGE.` while
     the required action is `[F] INSTALL KEEL WORKBENCH`. That marker label never
     appeared in any trace. Contradicts `ux/README.md` guardrails 1 and 3.
     (If the salvage did not cover the bench cost the guidance falls to
     `craft:bench_online` instead, a different ID, and the HUD does update — so
     the stale label appears exactly on the common path where the player can
     afford the install immediately.)
  3. *Defect.* Launch variant D (`ch8:launch:orbital-handoff`, `DEEP SPACE ·
     HANDOFF`) is unreachable: publishing it needs 1.75 s of dwell, but
     `tickLaunch()` ends the beat on the first tick at `deep_space`.
  4. *Limitation (intentional).* `anc.reconstruct.first-hover` and
     `cin.reconstruct.07-route-becomes-intention` did not activate — the hover
     rehearsal was deliberately made optional Tidegarden exploration.
  5. *Limitation.* Objectives sit in `missing-marker` health for the first ~3 s
     after a beat entry or a deep link while the marker driver resolves; it
     always cleared to `ready`.

## Unverified assumptions

- Manual (non-movie) ch7 build-step lifecycle — headless cannot drive the
  `[F]`/`[C]` transactions. Verification route: headed session, or the
  `?journeyprobe=1&journeylane=direct-entry` Ch7 escaped-defect diagnostic.
- Reduced-motion, mobile and POTATO-tier parity of the objective/marker/caption
  surface. Verification route: re-run `baseline-probe.mjs` with a mobile
  viewport, `profile=POTATO`, and an emulated `prefers-reduced-motion`.
- Whether `anc.launch.ignition`'s shot window is ever longer than one 200 ms
  sample in manual play (in movie mode ignition and liftoff were both already
  activated at the first post-ignition sample).
- `main/src/story/storyText.test.ts` is listed in `production-lock.json`
  `allowedPaths` but does not exist at `03e975a`.
