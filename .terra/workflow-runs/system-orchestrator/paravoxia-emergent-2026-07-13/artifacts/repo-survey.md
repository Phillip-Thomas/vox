# Repository survey

- Client: `main/`, React + Three.js/R3F, Vitest, Vite.
- Server authority: `server/`, shared multiplayer/world/economy state.
- Current story ceiling: `ch4-arrival`; later runtime beats are not yet shipped.
- Program contract: `main/PARAVOXIA_EMERGENT_STORY_BATCH_PLAN.md`.
- Machine story authority: `main/story-authority.json` plus `main/tools/story-authority-gate.mjs`.
- Creative authority: `paravoxia-creative-triad@v1`, flagship profile, cohesion rubric, staged creative gate.
- Current release gate: `npm --prefix main run verify`; server has its own verify gate.
- Dirty-worktree rule: existing changes are preserved and packet files are reviewed by ownership lane.

Existing primitives to reuse include world/profile generation, local-system bodies and handoff, swimming/oxygen, ship flight, Maw state, crafting/building, persistence, multiplayer command authority, postprocessing, procedural score, camera rigs, story cues, spawn validation, fauna/flora, and browser probes.
