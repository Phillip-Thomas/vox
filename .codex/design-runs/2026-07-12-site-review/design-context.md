# Design Context Contract

## Hard Guardrails

- Preserve the core thesis: rendering fidelity is story progression, not a settings gimmick.
- Freeze story content at the existing W-7744 arrival. Demo work may repair existing-beat defects but may not add canon, dialogue, beats, awakenings, or later-story payoffs.
- Treat the current audio/score engine and audio assets as protected. This lane performs audio regression testing only.
- Preserve current desktop control feel and bindings. Improve discoverability, recovery, focus, and touch parity without a broad input rewrite or remapping system.
- Preserve the cube-planet identity, procedural ecology, free surface-to-space travel, offline sandbox, and invited co-op behavior.
- Do not replace the game HUD with a generic web component library or cover play with tutorial cards.
- Browser first: desktop and touch must remain viable; WebGL 2 remains the production fallback.
- Accessibility is a release requirement: keyboard recovery, visible focus, zoom, reduced motion, readable copy, and modal focus ownership.
- The only production change authorized in this planning follow-up is the exact landing tagline `Make no mistakes`.

## Creative Brief

- Desired tone: uncanny, cinematic, tactile, lonely, systemic, and authored rather than merely procedural.
- Audience: players who value discovery, unusual narrative form, survival/exploration, and ambitious browser technology.
- Quality target: a seemingly complete Story Demo through the current arrival, plus an honestly bounded Systems Sandbox proving the foundation for later work.
- Motion: physical and causal; avoid ambient noise that does not communicate state.
- Preferred patterns: diegetic UI, material-specific feedback, authored hero moments, readable restraint.
- Reject: generic voxel-survival imitation, more breadth without payoff, decorative shaders used as a substitute for interaction, and unsupported "ULTRA" claims.

## Open Field

- Public demo labeling and the Story Demo / Systems Sandbox boundary.
- Presentation, pacing, checkpoints, and recovery inside the already-built story only.
- Art-direction hierarchy between procedural background systems and authored hero assets.
- Runtime loading, quality adaptation, culling, input, accessibility, and test architecture.
- The exact primitive systems loop and the ship/hide/experimental feature matrix.

## Quality Config

- Run mode: `site-wide-review-plan`
- Exploration depth: `3`
- Execution budget: `flagship` review
- Approval threshold: `4.75 / 5`
- Category floor: `4.3 / 5`
- Human taste checkpoint: required before final visual approval
- External references: allowed when relevant
- Claude second opinion: not used; prioritization was decisive after independent product, render, and visual audits
- Canonical preview URL: `http://127.0.0.1:5201/`
- Server ownership: reused existing strict-port Vite server; no server started or stopped

## Reference Policy

| Reference | Relevance | Principle borrowed | Explicitly not copying |
| --- | --- | --- | --- |
| Three.js WebGPURenderer/TSL manual | Long-term renderer direction | Isolated WebGPU/TSL spike with WebGL 2 fallback | A risky production rewrite before the award slice is stable |
| Vercel Web Interface Guidelines | Menu/HUD/settings accessibility | Focus-visible, zoom, semantic controls, reduced motion | Turning the game into a conventional website |
| web.dev rendering guidance | 4.67 MB initial JS | Lazy-load noncritical story/co-op/debug/post systems | SSR for the real-time game canvas |

## Stop Conditions

- All player-facing surfaces and major systems are inventoried.
- Desktop, mobile, story-stage, and sandbox evidence is reviewed.
- Site-level, surface-level, foundation, and content issues are separated.
- The first execution slice and leverage-ranked roadmap are specific enough to start without re-auditing.

## Gate

- Hard guardrails separated from creative brief: `pass`
- Open field supports meaningful improvement: `pass`
- Quality config recorded: `pass`
- Reference policy recorded: `pass`
- Stop conditions recorded: `pass`
