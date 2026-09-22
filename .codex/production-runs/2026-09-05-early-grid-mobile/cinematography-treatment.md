# Early grid/mobile cinematography treatment

Author: independent Cinematography Director. Revision: `early-cinema-v1`. Status: **independent first treatment frozen; PREPARATORY, unsigned**. The new Score treatment and Score notes were not read before this freeze. The Chapter treatment is a proposal accepted here subject to the two preparatory notes and the later native Stage 3 exchange. No runtime, build, browser, GPU, score, or world-generation work was performed by this director.

The image should make a modest causal promise and keep it: a worker stands on an actual row, takes one real object, extracts one yielding patch, and walks to the edge of the camera's usable view. A declared switch finds the worker in the next frame. Only then does the existing camera unbolt and follow. The first lesson is earned attention.

## Grounding and the current cut

The owner instruction, decided brief and planning lock authorize this existing-story repair. The baseline is archived runtime candidate `1eb27bf00229c442169280f126f0f3f15bcad63d3581af76f5c0b8e4d3d0d1a8`, not the earlier planning manifest's `846b658…` revision. `cinematography-treatment.json` includes SHA-256 bindings for the baselines, inspected images, source files and authority documents, plus native scene-contract contributions. Current source files read outside the baseline snapshot were compared with the archive manifest. `storyAnchorResolver.ts` has concurrent changes; its original `getDebrisPoses` was read from the archive, and its current hash is recorded separately. The worldgen owner must integrate the single agreed pose into its own prepared-anchor workflow.

The following actual images were inspected with `view_image`, including their full DOM treatment. References below resolve to the hashed capture map in the JSON:

| Evidence | Visible finding |
| --- | --- |
| `base.desktop.fixed` / `base.portrait.fixed` | Worker, walked row and nearby resource cells belong to the same severe monochrome world. Four BIOFIBER brackets divide attention. Desktop order is 415.8 × 140.75 px at (56,26); portrait order becomes 120 × 534 px at (56,26), crossing the worker and target band. |
| `base.portrait.offscreen` | At 14.985 s the body is wholly beyond the right frame, while the static instruction remains. The natural trace has 31 wholly offscreen samples through 18.990 s. |
| `base.desktop.raster` / `base.portrait.raster` | The traveling strip and distant wreck language remain coherent, but the same portrait text column overwhelms the playable height. Movie screenshots have no brackets by current policy and cannot prove manual target discovery. |
| `base.desktop.descent` | Preserve the watched ground, falling debris, monochrome treatment and impact relationship. It is the same place that becomes the task row. |
| `base.portrait.track.start` / `base.portrait.track.mid` | Letterbox and existing watcher caption are visible, but the persistent white covering layer defeats appraisal of the underlying unbolt. This is failed entry-state evidence, not an authored white track treatment. |
| `base.desktop.depth` / `base.portrait.depth` | Preserve the distance-18 side family, legal supply row, single SUPPLY POD directional marker and true receipt count. Portrait depth copy also has inherited narrow-column risk: verify adjacency and route any actual overlap, without expanding this pass into a later-story rewrite. |

Natural fixed support evidence at portrait 12.200 s: body center `[8,52.7889748,-6]`; capsule foot `[8,50.9889748,-6]`; Rapier support TOI `1.79897475`; support collider center `[8,50,-6]`, half-height `0.99`. Existing visual soles are `0.8396–0.9799` world units above the physical foot over the natural portrait run. The idle discrepancy is exactly the difference between capsule half-height plus radius (`1.3+0.5=1.8`) and mesh sole depth (`0.68+0.28=0.96`); the remaining up-to-0.14 error is the whole-body bob.

The actual fixed camera is perspective **75° vertical FOV**, aspect `1280/720` or `390/844`, eye `[8,54,10]`, look slope `1.6/16`, on the unchanged distance-16/lift-3/focus-lift-1.4 rig. The bible's generic 50° feed lens is not the executable external-side lens. Preserve 75° here. Do not substitute the uninitialized `[0,0,5]` camera rows in the coarse baseline index for settled camera evidence.

## Chosen visual direction

**A readable bolted frame.** Keep surveillance discontinuity, body scale, procedural world, bare monochrome and lens lineage. Make its actual viewport the contract for where the worker can remain legible. The current target is the one scarce designation; the worker's contact with the row explains how to reach it. The inherited camera becoming continuous supplies the release.

Rejected alternative: distance/FOV widening on portrait until the old 24-unit cell fits. It would shrink the already small worker and imply a different perceptual acquisition on a phone. Rejected alternative: follow the worker before the existing unbolt. It would spend the dramatic change before it is earned. Neither is required to fix the measured faults.

The scene remains a bounded repair, not a new flagship mechanism. No new grade, render pass, light, lens stack, parallel marker, popup, artificial resource yield, terrain relocation or camera-input mode is proposed.

## Ground the displayed worker in the actual row

`SideWorkerAvatar` must use the same current player position and up as the side camera's player frame (`getPlayerWorldPosition`, `getPlayerUp`), retaining pose action as animation input. Construct its orientation from normalized up and travel-facing tangent; do not treat world Y as gravity. The visible mesh remains the same size and material family.

Set local sole depth to `0.96`; physical half-height to the imported sum `PLAYER_CAPSULE_HALF_HEIGHT + PLAYER_CAPSULE_RADIUS`; rendered voxel skin to `VOXEL_SCALE/2 - COLLIDER_HALF_EXTENT = 0.01`. The root is:

`visualRoot = currentPlayerCenter + up * (0.96 - 1.8 + 0.01)`

The nominal root offset is **−0.83 world units**, giving a resting sole around `50.99897` against visible row top `51.0`. The 0.01 visual skin accounts for the existing collision inset; it does not alter collision geometry or support. Preserve real airborne movement: the avatar follows the physical center, never ray-snaps the player or the mesh independently to terrain.

Remove the positive bob from every child. Leave both leg bases at −0.68 in the idle and harvest stance. During ordinary walking, one leg may lift at most `0.04 * max(±sin(phase),0)` while the other remains planted; head, torso, visor and pack compress downward together by at most `0.025 * abs(sin(phase))`. Advance phase at the inherited 9 radians/second using active foreground simulation dt, never wall clock. Freeze on pause/focus loss and return to zero at idle; reduced motion uses the unanimated planted stance. This is the complete animation choice, not permission for a skeleton or extra mesh. If animation cannot preserve measured contact, ship the planted stance with no bob.

Acceptance: on settled support, lowest planted sole is within **−0.015 to +0.025 world units** of the rendered top of the supporting voxel; idle range ≤0.005, moving planted-sole range ≤0.02. No additional physics-ray, collider, gravity, jump, harvest, support-row or movement-band modification. Confirm contact with both world-space support measurements and actual full-frame/canvas frames; a screen-space shadow is not contact proof.

## One viewport and coverage authority

Extend `sideLens.ts` and its existing `LensRig` transform, rather than adding camera authority. Proposed pure types/functions are named in the JSON. The input is the actual active perspective camera's vertical FOV/projection and CSS viewport, actual lens basis, corrected body envelope, measured safe-area and occupied UI rectangles. A non-positive/unknown viewport is invalid; do not fall back to a made-up 24-unit progression grid.

For a centered square-on rig, the explanatory calculation is `xNdc = x / (D * tan(vFov/2) * aspect)`. Use the actual camera-space depth of the near silhouette corners, not `distance` alone. For each left/right edge, solve the greatest camera-relative along-axis center displacement for which all corrected mesh-envelope corners remain within the usable screen boundary. Use a conservative facing envelope of ±0.72 along/depth, all stance extrema, and **0.25 world units** of further along-axis movement reserve. The actual projection solver owns the result, including principal-point offsets and asymmetric safe insets.

At the captured pose, `Dnear ≈ 15.3116`, margin 18 CSS px and the above envelope give a symmetric safe center half-span **H ≈19.3297** on 1280×720 and **H ≈3.9579** on 390×844. Hence example cell widths **38.6594** and **7.9158** world units. These are computed reference values, not constants to paste into the director. The threshold is a body-safe viewport edge; frame centers advance by twice the lesser safe half-span. Cell 0 is centered on the existing lens origin. The avatar remains fully in view both just before and just after a transfer. Keep the existing ±29 travel band and actual row; the first desktop crossing remains physically reachable.

The single coverage sample contains geometry epoch, frame/cell ID, anchor center, interval endpoints, current/previous along position, player sample identity, projection signature, geometry-valid flag and monotonically increasing transfer sequence. Camera rendering and `storyDirectorTick` consume that same sample. A transfer carries from/to IDs, direction, player movement delta and reason. The sole rewardable/audible reason is **`player-traversal`** under an unchanged valid epoch. Do not independently calculate `fixedScreenCellIndex(along,24)` in the director, and do not publish two transfers when the frame is sampled twice.

After pickup and positive-yield harvest, arm traversal on the current shared frame and current transfer sequence. Historical visits, a prior exploratory crossing, target re-selection and camera initialization do not satisfy it. The next fresh movement-caused transfer advances fixed, and the camera-ID change/static cut occur from that same event. Render the destination fixed composition for at least one actual presented frame before releasing the track rig; do not add a new wall-clock hold or defer a receipt to music. Track's existing beat-grid wait and unbolt remain the only authored delay. The verifier must expose frame ordering so a director cannot award an invisible transfer.

On resize/orientation, effective FOV/projection change, safe-area/layout change, deep link, replay or restore: establish a new geometry epoch, rebase to the physically occupied new frame, and replace previous-position/cell state. This may geometrically reframe the scene, but emits **no traversal, static/glitch, camera-cut sound, receipt, objective entry or completion**. Preserve the current action and arm from the new valid frame. Resuming a held movement input needs an actual new player sample and a subsequent boundary crossing. Debounce geometry publication until two consecutive layout samples match; while invalid, do not advance coverage. Renderer still keeps the worker visible using the latest valid fitted frame. Do not wait for asynchronous UI layout to authorize inventory or input.

Portrait 390×844 and desktop 1280×720 retain centered projection, 75° FOV and the shipped rig values. Short touch landscape may require vertical image displacement because the real controls consume its lower area. Use the **same PerspectiveCamera view offset**, only when the measured worker/target union intersects the reserved rails: solve the smallest CSS-pixel vertical displacement that fits the union between top guidance and the measured control/caption top. Preserve eye, target, rig orientation, FOV and horizontal framing; do not lower the eye into terrain. With `setViewOffset(W,H,0,offsetY,W,H)`, positive `offsetY` moves the image upward by that many CSS pixels. Record the actual projection matrix and offset in the shared geometry epoch. Clear the view offset when unnecessary and on leaving the affected side framing, quit and sandbox. If the union cannot fit, report the measured conflict; no hidden zoom, body clipping, UI overlap or input suppression is an acceptable fallback.

## Target staging and single focal read

Accept Chapter's single required sequence and first-three required raster receipts. Preserve all loot, later supply pods, six total biofiber/four stone, existing six-second raster minimum and 2.5-second completion hold.

Move **only existing debris index 0** from its `getDebrisPoses` −9 voxel offset to **+2 voxel offsets / +4 world units along the existing travel axis**, through the existing dry surface pose resolver and current 0.8 lift. For the captured world this is nominally near `[12,51.8,-6]`; the resolver's supported actual pose is authoritative. Keep its index, original loot and save receipt. It is outside the unchanged 2.8-unit 3D pickup radius at spawn, inside the first portrait image (center approximately x330 px; existing 46 px bracket clears x372), and can be collected by an ordinary forward approach before any camera switch. Validate the actual box/label bounds, not just center projection.

The current action selects one existing survey bracket. `DEBRIS` is exact for the real currently collectable piece; `BIOFIBER` is exact for a tool-valid, positive-yield, reachable patch selected by the same ordinary extraction picker. Draw corners around the actual projected target. Keep the 46 px bracket, 9 px arms and monochrome role; use one static 12 px label at 18 px line-height, letter-spacing 0.08em. Flip the label to the clear side; if neither side fits, place it above the actual bracket. Clamp or wrap the label only, never the target or bracket center. Include the label's actual rectangle in overlap checks; the parent 46×46 box does not account for its outward text.

Do not introduce perpetual target blinking. The single stable bracket is enough distinction. Current required debris may retain a constant, modest emissive contribution of 0.25 in its existing material; other finite debris uses the existing quiet 0.08 value. Preserve material identities/colors. If per-piece distinction is used, prepare both materials at scene setup and change assignment/values without shader or material creation at receipt. Optional pieces 3–5 remain actually collectable and unmarked; all physical pieces 0–5 within the outcome retain ordinary walk-over behavior during both fixed and raster. Wreck decoration receives no label or matching collection emphasis.

Receipt invalidates the old target immediately, clearing its geometry, label and obsolete work order within two presented frames. Retain the selected target until its receipt, depletion, actual unreachability or an actual camera change makes it unusable; ordinary subpixel projection changes cannot churn target identity. The next valid target gets the single designation. During traversal there is **no collection bracket or offscreen arrow**; the canonical `NEXT CAMERA` logical label is explained by the visible walk instruction and the frame edge. During track there is no target. At depth, retire survey brackets before the existing SUPPLY POD marker appears.

## Minimal guidance and measured reservations

Use `objective.workOrder` through `presentRegulationObjective` and the shared `inputGlyphs` pass. Exact imperatives and objective IDs are inherited from the Chapter table, reproduced in the JSON. The complete standing stack is one current imperative, one compact essential ledger row when useful, and the existing camera identity. Omit the repeated Authority header, simultaneous quota list, extractor percentage and transit echo from these fixed/raster work-order surfaces. Existing journal and caption channels retain their appropriate story text; no new HUD surface is introduced.

Keep the track's five existing Regulation lines in the existing journal/voicing record, preserving their canonical text and the already authored watcher caption. Display only `HOLD POSITION.` as standing action. This proposal must be reconciled with Chapter and Score because `RegulationFeedHud` currently feeds visible work-order lines to `voiceVisibleText`; visual simplification must not silently delete, duplicate or rearrange that authored audio. Cinema does not author a replacement voice sequence. The existing watcher caption retains its current time and its own caption lane.

Use 14 px imperative text, 20 px line-height, letter-spacing ≤0.06em; maximum two lines at 390 px. At ≥320 px of clear horizontal width beside camera status, keep work order top-left in that clear width, capped at 680 px. Otherwise put it across the safe width below the measured status/journal union plus 14 px, rather than narrowing it to 120 px. At the baseline portrait geometry the reserved instruction rectangle is approximately **(18,124,354,40)**, versus the previous (56,26,120,534). This is a target layout to measure after implementation, not a claimed browser result. Safe insets add to the 18 px mobile side margin; retain 56 px desktop left anchoring.

Reduce the existing camera-status block to its useful current camera identity / HOLDING state plus REC in one row; the increasing frame counter and repeated site identifier do not compete with the action. Respect the actual journal button rectangle. Do not move or shrink touch controls. Their baseline bounds are D-pad `(16,668,156,156)` and actions `(300,666,72,152)` at 390×844. Reserve **14 px above the highest actual control edge**, including safe areas: baseline usable lower edge is y652. Place the one 20 px ledger row above that edge, approximately y632–652. Desktop ledger remains above bottom 30 px. If a caption occupies this lane, move the ledger above its actual bounds with a 14 px gap; on track the ledger is absent.

Receipt text in the existing ledger is `DEBRIS RECOVERED.` or `BIOFIBER LOGGED.` for 900 ms of active foreground time, then the current action count; it never hides the next imperative. Raster count is only the active demand (`DEBRIS n/3` or `BIOFIBER n/6`), not a three-goal dashboard. A restore shows the current count without replaying receipt text. At track entry clear the ledger so it cannot compete with the unbolt/caption. Preserve existing accessibility announcement ownership; do not add a second live region.

All text must clear the projected worker union and target/label by **14 px**, stay within measured safe insets, and avoid every mounted registered surface. Imperatives/target labels require measured contrast ≥4.5:1; corners require ≥3:1 against their immediate background. Use the existing dark monochrome label backing strengthened only as necessary within the same surface; do not brighten the world or hide the feed treatment. Preserve a central playable corridor containing the entire worker and current target. On the reference portrait it should span at least y206–598 and the usable x18–372. Actual bounds decide acceptance, including glyph-expanded touch copy, browser zoom, caption wrapping and nonzero safe insets.

## Shot, anchor and continuity contract

The JSON supplies full native `shots`, `syncAnchors`, `story.agencyWindows`, `palette`, `variants`, `reset` and `evidence.captures` fields. Stable shots are:

| Shot | Range | First / second read and hand-back |
| --- | --- | --- |
| `shot.early.descent-arrival` | `anc.descent.impact` → `early.fixed.ready` | Existing impact/persistent wreck → correct supported worker. Preserve authored impact and decay; clear unowned restored flash. |
| `shot.early.fixed-pickup` | ready → pickup receipt | Single debris designation → worker's path/contact. Bolted rig; normal movement and actual proximity collection. |
| `shot.early.fixed-harvest` | pickup → harvest receipt | One yielding ground patch → worker's extraction stance. No camera lure or grade change. |
| `shot.early.fixed-cross` | harvest → fresh coverage transfer | Worker approaching body-safe edge → new camera's empty continuation. Declared discontinuity, one shared event. |
| `shot.early.track-unbolt` | coverage transfer → raster ready | Same worker held at the destination frame's edge → continuous recentering. Existing `anc.track.unbolt` starts the 6.5 s smoothstep frame blend; 7 s envelope, rise 0–0.8 s, hold through 5.6 s, fall through 7 s. Existing movement hold; actual hand-back at raster. |
| `shot.early.raster-salvage` | raster ready → required salvage satisfied | Single required remaining piece → lateral worker. Same continuous profile; pieces 1/2 are normally remaining. |
| `shot.early.raster-fiber` | required salvage satisfied → depth handoff | One yielding patch → finite work strip. Optional debris stays quiet; no false remaining order. Zero-length shot is legal when real inventory already satisfies fiber. |
| `shot.early.depth-handback` | depth handoff → depth rig settled | Existing SUPPLY POD marker → navigable legal row. Distance 16→18 over existing 2.5 s; no new reward or color. |

The palette remains regulation mono, governed by existing reality `bare` and the planet/reality render authorities. Existing BODY/VISOR/SUIT_DIM and hull/scorch colors are material inputs to the same treatment, not new color reveals. No exposure, lighting, fog, contrast-grade, DPR or effect-stack change. One camera axis remains travel-right; depth and the wreck retain their current relation. Track changes attention through motion, not fidelity. The fixed cut keeps the existing small static event only for physical traversal; reduced motion retains the hard camera change and ID change with no optional flashing overlay.

The precise inherited descent/track hold is `moveSpeedScale:0` over `rasterPolicy()`. It does not itself disable the existing jump or mining policy. Preserve those actual permissions; the native agency proposal therefore records movement as blended and interaction as player-owned during these authored observations. No new all-input freeze is implied by “hold position” or by the absence of a collection task.

The entry-flash repair belongs to the demonstrated owner/reset race. Integration reports candidate3 clears descent ephemerals at entry and tick and preserves the natural-impact test; cold rendered parity remains pending at this treatment freeze. Require natural, cold direct-entry and earned Continue evidence with actual DOM computed opacity and runtime flash state. Add no concealment overlay and never accept a globally disabled impact as the repair.

## Capture and acceptance direction

Capture only after a same-hash triad contract and concrete implementation lock. The designated verifier owns the serialized real NVIDIA GPU. Register raw evidence with candidate/source/contract hashes, real renderer identity, viewport, input mode, quality, player/target IDs, camera/projection/coverage epoch, support, actual bounds, receipts and exact cue events. Direct-entry images are diagnostics; natural predecessor continuity and earned Continue require their own journeys.

1. Manual desktop 1280×720 and portrait 390×844: natural descent through pickup → positive harvest → fresh visible crossing → complete unbolt → each required raster receipt → depth. Repeat positive/negative travel directions, stand/harvest/walk/jump contact, first piece visibility and target/label truth. Movie evidence cannot substitute for manual target visibility.
2. Capture every presented frame from 250 ms before to 500 ms after each pickup, harvest, coverage transfer and restore; include receipt inventory/milestone deltas and old/new bracket identity. At unbolt capture −100 ms, 0, +16.7, +100, +450, +800, +3250, +5600, +6500 and +7000 ms relative to its **actual fired bundle anchor**, plus continuous video/audio. Include the last fixed frame and first raster/depth frames. At natural impact capture every presented frame −100 to +300 ms and +500/+1000 ms.
3. Three cold rescue-free movie runs across the complete same sequence; manual outcomes with 3, 4 and 6 physical debris, proof optional excess still collects normally, no-yield/wrong-tool/depleted candidate rejection, genuine saved inventory and minimum-salvage Ch3 continuation. Retain actual fiber6/stone4 and all three later pod receipts.
4. Stationary and moving resize/orientation (390×844 ↔844×390, 1280×720 ↔390×844), 320×568 and 200% text/zoom, safe insets top44/bottom34, caption-active states, pause/focus, quit/replay, cold diagnostics, earned Continue, reduced motion, HIGH and lowest supported tier. Geometry-only changes must produce zero cut/glitch/audio/traversal/receipt events; valid movement under the new epoch must still work.
5. Contact tolerance above; **zero fully or partly edge-clipped worker frames** during fixed/cross/unbolt/raster, zero subject/control/text intersections, exactly one phase-correct visible target whenever the required target is in the usable frame, no false clamped target when offscreen, no duplicate action prompt, obsolete target cleared within two presented frames. Every required selection must have an actual reachable route and yield/receipt proof; `ready` alone is insufficient.
6. Preserve prewarmed scene resources. Target 60 fps desktop / ≥30 fps lowest mobile tier; no frame >40 ms within ±2 s of pickup, harvest, transfer, unbolt or depth hand-back on the designated cold hardware evidence. No new shader programs, geometry/material/texture/render targets or light-cardinality changes in these windows; no context loss/graphics diagnostics. Compare draw/program counts to same-tier matched baseline; the existing bracket-slot/material reuse should keep incremental draw calls at zero. Memory-allocation and high-tier metrics remain unmeasured in the baseline and cannot be fabricated as a pass.

Run the relevant existing side-lens, avatar/receipt/beat/UX tests, `story:ux:check`, the actual `story:hud:sweep`, ladder-diff with explicitly allowed changes, journey checks and the normal verifier-owned verify gate. Tests cannot replace rendered contact/crop, actual target receipts, short-effect/cut frames, semantic cue counts or the fresh Player Experience/Cinema/Score/Canon/Cohesion reviews. Any failed headed/perceptual gate remains open.

## Handoff and signoff boundary

The two records in `cinematography-preparatory-notes.jsonl` are **PREPARATORY**, addressed to Chapter and Score respectively. They are not native Stage 3 first-wave evidence, a reply to the unseen Score treatment, or a signature. After all three treatments exist, route the two grouped native outgoing notes, recipient-authored reconciliation and three signatures over the actual compiled contract SHA-256. No owner-only question is needed for these authorized repair choices. No runtime acceptance or publication is claimed.


## Native section index — mechanical packaging

Exact authored original: assembly/originals/cinematography-treatment.md; SHA-256 04b04cd93632cefa0bf036306836e8e143dfb76ca286b111a0a593c35a603ef8. This index maps native section names to unchanged authored passages; it adds no creative position or approval. The original treatment date/status belongs to its historical stage.

### Current-cut

See the authored Grounding and the current cut sections above.

### Color script

See the authored Chosen visual direction sections above.

### Shot ledger

See the authored Shot, anchor and continuity contract sections above.

### Performance

See the authored Capture and acceptance direction sections above.
