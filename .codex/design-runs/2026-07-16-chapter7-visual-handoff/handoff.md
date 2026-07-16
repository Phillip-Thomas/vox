# Design Handoff

## Accepted Direction

- Selected thesis: `Continuous Threshold`.
- Exploration depth / budget: `1 / standard`; moderate local repair.
- Rejected pattern: a cut or fade that hides the exterior-to-cockpit transaction.
- Taste assumption: the pressure cabin should remain dark and enclosed, but the hatch throat, horizon, cyan navigation focus, and amber propulsion cue must remain immediately readable.
- Product rationale: each state must communicate the next physical action and ownership change without HUD or geometry ambiguity.
- Goal rationale: preserve the exact reconstruction and boarding transaction while making the current task and the transfer into flight visually self-evident.
- Copy/tone rationale: retain terse operational language; name only controls that exist on the active input mode.
- Asset strategy: reuse the code-native Kestrel geometry/material system; add no external asset family.
- Hard guardrails: preserve story/score/control timing, signed anchor ownership, continuous hatch causality, merged cockpit draws, and WebGL 2/POTATO viability.
- Open-field decisions: author a safe exterior camera trajectory, hinge the dorsal leaf around its physical axis, fit shell and instruments independently in portrait, and solve HUD layers through one shared responsive policy.

## Evidence

- Canonical preview: `http://127.0.0.1:5173/` (existing Vite server reused).
- Current mechanical set: `main/captures/chapter-acceptance/ch7-visual-repair-smoke-final7-2026-07-16/cold-run-01/`.
- Current run report: `main/captures/chapter-acceptance/ch7-visual-repair-smoke-final7-2026-07-16/cold-run-01/run-report.json`.
- Supporting mobile visual set: `main/captures/chapter-acceptance/ch7-visual-repair-smoke-final4-2026-07-16/cold-run-01/`.
- Current mobile reconstruction: final7 `entry.png`.
- Current mobile boarding: `beat-02-ch7-board.png` — rejected for final visual approval because it predates the structural hatch-camera repair and shows an intersection.
- Current mobile cockpit: `beat-03-ch8-launch.png` and `boundary.png`.
- Authoritative replacement hatch: `screenshots/boarding-exterior-frozen-068.png`.
- Replacement capture state: the scheduler-visible frame is `hatch_entering`, elapsed `0.5`, hatch progress `0.776963305898491`; the normal-priority authoritative tick that triggered the freeze is elapsed `0.6`, progress `0.925925925925926`. This one-tick relationship is the intended hatch `-1` / transaction `0` contract. Exact live module exports and source hashes matched; 390x844 LOW/SwiftShader; console/page errors `[]`; PNG SHA-256 `93ec50776ff2c9a83539c792316e0396b09484769d00c00d50a8d210f0d87932`.
- Replacement critique: the high intersection/black-frame blocker is closed; the hatch, rim, throat, and threshold are recognizable. Medium rail/material hierarchy and utilitarian framing debt remains.

## Component Mapping

| Design element | Existing owner | New/modified owner | Landed intent / evidence status |
| --- | --- | --- | --- |
| Exterior hatch approach and throat | `main/src/story/world/HifiWreck.tsx` | `main/src/story/world/hifiWreckComposition.ts` + test | Pure camera-path, canopy-exclusion, throat sightline, hatch-leaf occlusion, and X-axis hinge contracts; authoritative post-repair screenshot clears the high blocker |
| Wreck/task composition | `main/src/story/world/HifiWreck.tsx` | Same component | Narrow/cant the bench-facing slab and render the relationship projection translucently so the hero wreck and current task remain legible |
| Reconstruction movie locomotion | `main/src/story/autopilot.ts` | `main/src/story/autopilotReconstruction.ts` + test | Explicit workbench/hover/grounded-return ownership, interaction annulus, and per-run hover latch prevent visual framing logic from stealing the physical proof |
| Portrait pressure shell | `main/src/components/ShipCockpit.tsx` | `main/src/components/shipCockpitLayout.ts` + test | Fit pressure shell and instruments independently (`0.78` / `0.70` X-scale floors) so portrait crops peripheral structure instead of collapsing the forward aperture |
| Cockpit probe seam | `main/src/components/ShipController.tsx` | Same component | Read the named `ship-cockpit-pressure-shell` child so runtime evidence tracks the layer that actually scales |
| Shared mobile HUD bands | `StoryCaptions`, `FreeMarker`, `StoryGuidanceHud` | `main/src/story/ux/storyHudLayout.ts` + test | One measured control -> objective -> caption -> marker stack; clamp only rendered markers while preserving raw telemetry coordinates |
| Touch-safe work order | `main/src/story/physicalBoarding.ts` | Same module + test | Use input-aware cancellation copy (`USE` on touch) without changing the physical boarding action or phase order |

## Token Mapping

| Use | Existing token/style | Treatment |
| --- | --- | --- |
| Operational UI | `theme.font.mono`, current glass HUD chrome | Preserve typography, borders, and terse hierarchy |
| Navigation focus | Kestrel cyan | Keep central and dominant at cockpit handback |
| Propulsion cue | Kestrel amber | Keep distinct from navigation, visible without competing with the horizon |
| Touch layout | Existing safe-area/control conventions | Route all story overlays through the shared measured layout solver |
| Wreck/cockpit materials | Existing procedural hull, glass, and telemetry materials | Recompose existing forms; do not add a decorative material family |

## Asset Mapping

- No bitmap, model, font, or third-party visual asset is added.
- Existing code-native Kestrel geometry is reused and recomposed.
- Alt text/captions do not apply to the Three.js first-person scene; visible Story guidance remains the accessible text channel.

## State Matrix

| State | User sees | Interaction behavior | Required evidence |
| --- | --- | --- | --- |
| Reconstruction | Hero wreck, scar/workbench/socket relationship, and unoccluded current task | Existing diagnose/repair/hover/calibration receipts remain physical | Mobile portrait plus representative landscape |
| Hatch entering | A readable dorsal threshold and continuous forward camera motion | Cancel remains available and names the active input | Post-repair mobile hatch capture; landscape follow-up |
| Pressure seal | Physical occlusion and pressure closure, not an empty-black geometry accident | Input remains locked for the authored transaction | Flow capture plus audio review |
| Cockpit handback | Open horizon, cyan navigation focus, and amber propulsion hierarchy | Flight controls transfer only at the existing handback edge | Mobile portrait plus headed landscape |
| Touch portrait stress | Controls, objective, caption, and marker occupy separate measured bands | `USE` copy; no unavailable `ESC` instruction | 390x844 flow set |
| Reduced motion | Same causal states without added decorative motion | Existing equivalent paths remain | Existing behavioral tests; representative headed check |

Loading, empty, error, permission, and authentication states are outside this real-time story-state repair. Failure/recovery is represented by existing pause/focus/cancel and objective-health behavior rather than page-style placeholders.

## Language Audit

| Surface | Visible language | Purpose | Status |
| --- | --- | --- | --- |
| Reconstruction objective | Existing current-task and interaction instructions | Make the physical next action explicit | Preserved; dense mobile hierarchy still needs taste review |
| Hatch entry | `HATCH TRANSFER IN PROGRESS. HOLD POSITION · USE TO STEP BACK.` on touch | State progress and truthful cancellation | Pass in final4 evidence |
| Pressure seal | Existing pressure-boundary language | Explain temporary control lock and causality | Preserved |
| Cockpit handback | Existing Chapter 8 launch/flight UI | Signal ownership transfer without exposition | Preserved |

## Responsive Notes

- Mobile: portrait is a stress layout, not a compressed ultrawide rig; shell and instruments receive independent fit floors, and Story overlays use measured vertical bands.
- Tablet: keep shell peripheral, retain a broad forward aperture, and maintain the same overlay ordering.
- Laptop/desktop/wide: preserve the authored enclosure proportions; the helpers clamp only when the viewport becomes narrow.
- Marker labels wrap/clamp within the viewport while their raw projected telemetry remains untouched.
- Reduced motion: add no decorative motion; preserve current equivalent paths.

## Acceptance Criteria

- A post-repair screenshot proves no camera/canopy/hatch-leaf intersection and no unexplained empty-black boarding frame.
- Portrait cockpit has no dominant central shell pillars and retains cyan/amber focal cues.
- Caption/objective/interaction/control layers do not collide on 390x844.
- Touch work order names an available action.
- All 12 Chapter 7 anchors, completion boundary, `105/105` integrated focused tests, typecheck, and the exact-source full verify remain green.
- Headed hardware, live audio, comfort, and owner taste are reviewed before final approval.

## Known Risks

- The structural hatch repair is now represented by an authoritative frozen capture with no apparent camera intersection or empty-black frame. Remaining boarding debt is medium: rail/material hierarchy and a functional rather than cinematic framing read.
- final7 is a debug, external-server, SwiftShader/POTATO run. It proves a rescue-free mechanical path and supplies diagnostic screenshots, not formal certification or hardware performance.
- Cancelling with Step Back, Escape, or blur between render frames can leave one low-FPS frame with the previous camera pose after the leaf closes. This abort-only edge does not affect the forward transaction or signed anchors and remains polish debt.
- Mobile cockpit evidence has an open center aperture but still carries a heavy black upper shell and clipped/peripheral amber cue.
- Desktop, tablet, real-GPU lighting, live audio timing, comfort, and human taste remain open.

## Gate

- Component mapping complete: `pass`
- Token and asset mapping complete: `pass`
- Goal/language/state/responsive mapping complete: `pass`
- Hard guardrails and acceptance criteria recorded: `pass`
- Scoped hatch high-defect gate: `pass`
- Final rendered approval: `pending — broader responsive/headed/audio/human review remains`
