# Screenshot Report

## Run

- Repo: `/home/thomasphillip/Projects/vox`
- Surface: Chapter 7 reconstruction -> physical boarding -> Chapter 8 cockpit handoff
- Branch / source: `agent/paravoxia-story-audio-world-update` at `3d68948c18c7`, dirty candidate tree recorded by the acceptance report
- Canonical preview URL: `http://127.0.0.1:5173/`
- Server ownership: existing Vite server reused; no duplicate server started for this run
- Evidence date: `2026-07-16`
- Evidence boundary: headless SwiftShader LOW/POTATO diagnostic captures only; not formal certification, hardware performance, live-audio, comfort, or human-taste approval

## Screenshot Matrix

| View/state | Viewport | Path | Result | Notes |
| --- | --- | --- | --- | --- |
| Mobile reconstruction | 390x844, POTATO | `main/captures/chapter-acceptance/ch7-visual-repair-smoke-final4-2026-07-16/cold-run-01/entry.png` | Conditional pass | Wreck task and controls are readable; the full HUD is dense and needs a later taste pass |
| Superseded mobile hatch | 390x844, POTATO | `main/captures/chapter-acceptance/ch7-visual-repair-smoke-final4-2026-07-16/cold-run-01/beat-02-ch7-board.png` | Rejected historical evidence | Severe camera/hatch/canopy intersection; retained only to show the repaired defect |
| Mobile cockpit handback | 390x844, POTATO | `main/captures/chapter-acceptance/ch7-visual-repair-smoke-final4-2026-07-16/cold-run-01/beat-03-ch8-launch.png` | Conditional pass | Central aperture and cyan nav cue are materially clearer; upper shell remains very black and amber is peripheral/cropped |
| Mobile Chapter 8 boundary | 390x844, POTATO | `main/captures/chapter-acceptance/ch7-visual-repair-smoke-final4-2026-07-16/cold-run-01/boundary.png` | Conditional pass | Confirms stable flight handoff composition; same cockpit polish debt remains |
| Authoritative post-repair hatch | 390x844, LOW/SwiftShader | `.codex/design-runs/2026-07-16-chapter7-visual-handoff/screenshots/boarding-exterior-frozen-068.png` | Pass with medium debt | Hatch, rim, throat, and threshold are recognizable; no apparent camera intersection or empty-black frame; rail/material hierarchy and utilitarian framing remain |
| Tablet | 768x1024 target | `not captured` | Missing | Needed before final responsive approval |
| Representative landscape/desktop | 1280x720 or larger target | `not captured` | Missing | Needed for enclosure, horizon, lighting, and flight-focus review |
| Real-GPU headed | representative hardware | `not captured` | Missing | Required for lighting/performance and final visual approval |

Page-style loading, empty, error, permission, and authentication screenshots are outside this real-time story-state repair. The required product states are reconstruction, hatch entry, pressure seal, and cockpit handback; pressure-seal motion/audio still needs headed review.

## Interaction Evidence

- Flow: clean debug launch into `ch7-reconstruct`, automated physical reconstruction, `ch7-board`, then `ch8-launch`.
- Result: final7 `run-report.json` records `ch7-reconstruct -> ch7-board -> ch8-launch`, all 12 required Chapter 7 signed anchors, both required objective beats, and a complete exit boundary state (`control/flight`, `phase/surface`, `ship-restoration/flight_ready`).
- Rescue integrity: zero timeout rescues, teleport nudges, dry cross-face water frames, reloads, context losses, stalls, and timeouts.
- Touch language: the hatch objective renders `HOLD POSITION · USE TO STEP BACK.`, matching the available touch action.
- Frozen hatch validity: exact live module exports and source hashes matched. The scheduler-visible frame is `hatch_entering`, elapsed `0.5`, progress `0.776963305898491`; the normal-priority authoritative tick that triggered freezing is elapsed `0.6`, progress `0.925925925925926`, as intended by hatch `-1` / transaction `0`. Console/page errors were `[]`; PNG SHA-256 is `93ec50776ff2c9a83539c792316e0396b09484769d00c00d50a8d210f0d87932`.
- Camera state: full authored pose is active by `0.62`; the capture uses the high/wide +Z crane, physical X-axis hinge, a visual hatch sampler at frame priority `-1`, and authoritative transaction/camera authoring at normal priority `0`.
- Formal boundary: the aggregate remains `blocked` because this is a skipped-preflight, single-variant, external-server debug run with software rendering and incomplete registered-milestone/predecessor evidence. The screenshots and signed-anchor history support mechanical diagnosis, not certification.

## Screenshot Quality Questions

| View/state | Appealing? | Purpose clear? | Meaningful? | Space used well? | Brand-consistent? | Goal-effective? | Copy ready? | Action needed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Reconstruction entry | Partial | Yes | Yes | Partial | Yes | Partial | Yes | Reduce perceived HUD competition in a later polish pass without hiding the current objective |
| Superseded hatch, final4 | No | Partial | Partial | No | Partial | No | Yes | Rejected historical evidence; do not use for current approval |
| Cockpit handback | Partial | Yes | Yes | Partial | Yes | Partial | Yes | Review upper-shell value and amber cue on headed landscape hardware |
| Chapter 8 boundary | Partial | Yes | Yes | Partial | Yes | Partial | Yes | Same cockpit refinement; verify sustained flight readability |
| Authoritative post-repair hatch | Partial | Yes | Yes | Partial | Yes | Yes | Yes | Improve rail/material hierarchy and cinematic framing in a later medium-priority pass |

## Gate

- Mobile required-flow states captured: `partial — reconstruction, hatch, and handback captured; pressure seal is flow-traced but lacks a dedicated frame`
- Desktop/tablet captured: `fail`
- Post-repair hatch captured with exact scheduler/module verification: `pass`
- Scoped portrait stress layout captured: `pass`
- No high screenshot blocker remains: `pass`
- Every major screenshot clears the final quality bar: `fail — medium hierarchy/framing and evidence gaps remain`
- Hardware/audio/human approval: `not attempted`
- Screenshot approval decision: `repeat`
