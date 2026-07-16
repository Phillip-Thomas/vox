# Implementation Plan

## Handoff Understanding

- Accomplish: repair evidence-backed reconstruction, hatch, cockpit, and mobile-HUD composition defects while preserving a continuous physical threshold.
- Preserve: story, score, bindings, phase timings, signed anchor ownership, Kestrel cyan/amber identity, physical boarding, and merged cockpit draw architecture.
- Avoid: a camera cut, hidden hull/canopy geometry, whole-cockpit portrait compression, one-off HUD offsets, or an automated path that grants/steals a physical receipt.
- Open-field decisions: use pure geometry/layout/motion-owner helpers with focused tests, then accept or reject the result only from rendered evidence.

## Code Mapping

- `main/src/story/world/hifiWreckComposition.ts` + test: camera trajectory, inflated/visible canopy exclusion, throat sightline, hatch-leaf segment occlusion, and physical X-axis hinge.
- `main/src/story/world/HifiWreck.tsx`: consume the authored camera/hatch helpers; reduce the obstructing wreck slab and soften the relationship projection.
- `main/src/story/autopilotReconstruction.ts` + test and `main/src/story/autopilot.ts`: interaction annulus, explicit workbench/hover/grounded-return locomotion owner, grounded hover latch, and story-run reset.
- `main/src/components/shipCockpitLayout.ts` + test and `main/src/components/ShipCockpit.tsx`: independent pressure-shell/instrument portrait fitting.
- `main/src/components/ShipController.tsx`: bind the cockpit probe to the named pressure-shell child.
- `main/src/story/ux/storyHudLayout.ts` + test: shared measured objective/caption/marker bands and rendered-marker clamping.
- `main/src/story/StoryCaptions.tsx`, `main/src/story/FreeMarker.tsx`, and `main/src/story/ux/StoryGuidanceHud.tsx`: consume the shared HUD policy.
- `main/src/story/physicalBoarding.ts` + test: touch-truthful `USE` cancellation copy with unchanged phase semantics.
- Durable story/save schema: unchanged by this visual pass.

## Change Ambition

- Moderate, depth `1`, standard budget, refined gate.
- Complete means the reconstruction, hatch, pressure seal, and cockpit handback are legible; interaction truth is restored; and mechanical authority remains intact.
- Broad ship redesign, new asset families, new story/score beats, and post-FX expansion remain out of scope.
- Consistency guardrails: one shared responsive policy, pure testable composition helpers, and no visual workaround that changes progression authority.

## Asset Plan

- Reuse the existing procedural Kestrel hull, canopy, hatch, cockpit, telemetry, and HUD chrome.
- Add/swap/retire no external image, font, model, or shader asset.
- Preserve the current draw-efficient geometry and material families.
- Asset performance risk is limited to accidental geometry/draw growth; the implementation does not introduce a new asset pipeline.

## Risks

- Visual fidelity: the corrected hatch trajectory/hinge/sightline has an authoritative diagnostic capture; medium material and framing polish remains.
- Responsiveness: final4 proves only the 390x844 POTATO stress layout; tablet/landscape remain unproven.
- Accessibility: touch copy is truthful and layout is safer, but keyboard/focus/reduced-motion/headed comfort approval is not part of the current screenshot set.
- Performance: SwiftShader measurements are diagnostic only; no hardware-frame claim is permitted.
- Regression: a visual interaction annulus can preempt the physical hover/grounded-return sequence unless motion ownership remains explicit.
- Evidence: an external-server debug run cannot satisfy formal predecessor, registered-milestone, multi-variant, or candidate-bound certification gates.

## Validation

- Canonical preview: `http://127.0.0.1:5173/`; reuse existing server.
- Focused tests: composition/path/hinge/line-of-sight, cockpit fit, reconstruction motion ownership/latch, HUD layout, guidance copy, physical boarding, and signed AV ordering.
- Static checks: typecheck, `git diff --check`, and isolated full `main` verify after the final source patch; all are complete and green.
- Mechanical flow: re-run Chapter 7 debug acceptance after runtime changes; treat it as mechanical evidence only.
- Screenshot matrix: authoritative 390x844 replacement hatch captured and reviewed; representative landscape/tablet remain.
- Headed gates: real-GPU lighting/performance, live score/audio timing, camera comfort, and owner taste remain mandatory for final approval.

## Current Evidence Boundary

- final7 reached `ch8-launch`, observed all 12 required Chapter 7 anchors, and recorded zero timeout rescues, teleport nudges, dry cross-face water frames, reloads, context losses, stalls, or timeouts.
- final7 is still `blocked`/noncertifying because it is a one-variant debug run on an external server with SwiftShader and skipped predecessor/preflight coverage.
- The authoritative replacement capture records the scheduler-visible `hatch_entering` frame at elapsed `0.5`, progress `0.776963305898491`, while the normal-priority tick that triggered freezing is elapsed `0.6`, progress `0.925925925925926`; exact live modules/source hashes match, and the frame clears the prior high intersection/empty-frame defect.
- Latest integrated focused validation is `105/105`; the scheduler/boarding/score/signed-AV subset is `69/69`, and the composition suite is `36/36`.
- Exact-source `npm --prefix main run verify` is green: `232/232` files, `1629/1629` tests, typecheck, all story/workflow gates, and a `1005`-module production build. The `5.13 MB` main bundle warning remains performance debt.

## Gate

- Intent restated, patch inspectable, risk-matched validation: `pass`
- Asset plan and consistency guardrails explicit: `pass`
- Scoped hatch rendered/focused gate: `pass`
- Code and full-verification gate: `pass`
- Final visual approval gate: `pending — responsive/headed GPU, audio, comfort, and human-taste gates remain`
