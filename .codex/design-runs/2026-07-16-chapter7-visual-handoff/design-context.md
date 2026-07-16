# Design Context Contract

Mode: `single-surface` defect repair  
Surface: Chapter 7 reconstruction -> boarding -> Chapter 8 cockpit handoff

## Hard Guardrails

- Preserve the shipped story, signed anchor order, physical boarding transaction, score, controls, and cyan-navigation/amber-engine Kestrel identity.
- Preserve a continuous physical hatch-to-cockpit handoff; no disguising the transition with a cut.
- Keep WebGL 2/POTATO viable, merged cockpit draws intact, touch and desktop input truthful, and the central forward view readable.
- Treat headless SwiftShader proof as mechanical/visual evidence only, never hardware performance or human taste approval.

## Creative Brief

- Tone: tactile, uncanny, intimate, mechanically causal.
- Make reconstruction read as a legible hero wreck, boarding as a threshold crossing, and the cockpit as a clear flight instrument—not black placeholder geometry.
- Prefer authored composition, shape/value separation, and restrained diegetic UI over added effects.

## Open Field

- Boarding camera standoff and occlusion geometry.
- Portrait cockpit fitting, values, and focal scale.
- Touch caption/objective safe areas and input-aware cancellation language.
- Wreck prop placement/visibility where it currently blocks the task.

## Quality Config

- Exploration depth: `1`
- Approval threshold: `4.75`; category floor: `4.3`
- Execution budget: `standard`; current gate: `refined 4.55`
- Human taste: owner review remains required for final visual approval
- Claude second opinion: not triggered; screenshot evidence and repair seams are decisive
- Canonical preview URL: `http://127.0.0.1:5173/`
- Server ownership: reuse existing Vite server; start no duplicate server

## Stop Conditions

- Stop this pass after one implemented screenshot/critique loop when no high visual defect remains in the scoped states, tests pass, and any hardware/headed gates are explicit.
- Return to the failing seam if the hatch continuity, portrait center aperture, input truth, or signed Chapter 7 evidence regresses.

## Gate

- Guardrails/brief/open field separated: `pass`
- Quality config, preview, and evidence boundary recorded: `pass`
