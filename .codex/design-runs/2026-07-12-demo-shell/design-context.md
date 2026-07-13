# Design Context Contract

Mode: `single-surface` product-shell execution  
Execution option: `refactor-existing`  
Surface: landing controls, in-game pause, and completed-story recovery

## Hard Guardrails

- Preserve the current story exactly through W-7744 arrival; add no canon, beat,
  dialogue, awakening, or later-story payoff.
- Do not modify the audio engine, score, audio assets, loading, or mix.
- Preserve all desktop bindings, movement feel, sprint, mining, build, and ship handling.
- Story pause must freeze narrative time and block world travel.
- Completed saves must offer an honest completed-site path and an explicit clean replay.
- Reuse the current Paravoxia glass/telemetry language; do not cover play with tutorials.
- Restore keyboard focus, browser zoom, modal ownership, and reduced-motion behavior.
- Preserve unrelated lava-bed-lock and procedural-world work already dirty in the tree.

## Creative Brief

- Tone: quiet operational confidence, not celebratory marketing.
- Controls should feel like a field reference, not onboarding cards.
- The completed-state treatment should acknowledge a bounded demo without pretending
  the remaining story exists.
- Motion stays restrained and causal.

## Open Field

- Controls grouping and current-mode emphasis.
- Pause layout order when Story travel is unavailable.
- Non-narrative completed-demo language and confirmation structure.
- Focus and responsive behavior inside the existing visual system.

## Quality Config

- Exploration depth: `1`
- Execution budget: `standard`
- Staged gate: `refined 4.55`
- Final target: `4.75`, category floor `4.3`
- Canonical preview URL: `http://127.0.0.1:5201/`
- Server ownership: reuse the existing strict-port Vite server
- Human taste checkpoint: final screenshots remain owner-reviewable
- Claude second opinion: not triggered; direction is constrained and unambiguous

## Stop Conditions

- Story pause and travel tests pass.
- Desktop/touch control references are truthful and bindings unchanged.
- Completed-site and replay choices are explicit and recoverable.
- Desktop/mobile screenshots and keyboard behavior pass the refined gate.

## Gate

- Guardrails/brief/open field separated: `pass`
- Quality config and preview recorded: `pass`
- Scope can be implemented without new story/audio work: `pass`
