# Design Context Contract

## Run Configuration

- Run mode: `site-wide-review-plan`
- Scope: Paravoxia UI, HUD, menus, input affordances, and production quality-of-life planning.
- Execution mode recommendation: `refactor-existing`
- Exploration depth: `3`
- Execution budget for this review: `standard`
- Final approval threshold for later implementation: `4.75 / 5`
- Category floor: `4.3 / 5`
- Canonical preview URL: `http://127.0.0.1:5173/?agent=1&world=0,0` for deterministic HUD screenshots, plus `http://127.0.0.1:5173/` for landing-menu evidence.
- Current worktree note: another Codex agent is actively changing rendering/procedural files. This review must not edit rendering, world-generation, shader, fauna, flora, terrain, water, or capture tooling source.

## Hard Guardrails

- Preserve the existing Paravoxia visual direction: live cinematic world, glass sci-fi menus, restrained HUD chrome, top-left suit telemetry, bottom-left mobile movement lane, bottom-right mobile action lane.
- Do not regress the recently validated mobile HUD layout: vitals top-left, inventory collapsed below vitals, no normal FPS Dive button, Oxygen/Jetpack/Maw folded into suit telemetry.
- Keep Codex work out of rendering/procedural source while the parallel rendering agent is active.
- Preserve current routes and debug entry points: `/`, `?agent=1`, `?world=x,y`, `?fly=1`, `?descent=x,y`, `?overview=1`, `?debug=1`.
- Preserve current app architecture: React, React Three Fiber, Drei `KeyboardControls`, singleton game stores, inline style tokens in `src/ui/theme.ts`, and mode-driven HUD components.
- Pointer lock behavior is a product constraint. Controls/bindings UI must not accidentally open pause, drop pointer lock, or trap the player in cursor/no-cursor states.
- Touch controls must keep their explicit thumb lanes and must not add modal surfaces that block camera-look drag unless the game is intentionally paused.
- Production visible language must stay specific to Paravoxia and to the current mode. Avoid generic tutorial copy in the live HUD.
- Any future key-remapping must be conflict-safe, restorable to defaults, persisted locally, and reflected in every help surface.

## Creative Brief

The app already looks strong. The opportunity is production readiness: make the player feel oriented, in control, and able to recover from uncertainty without diluting the cinematic world. The control-bindings work should feel like a real game settings surface, not a static help card.

Desired feel:

- Quiet, diegetic, cockpit/suit-like control information.
- Fast access from gameplay without leaving the player wondering how to return.
- Mode-aware: on foot, build mode, fabricator, ship parked, ship in descent, deep space, touch.
- Practical and maintainable: one source of truth for actions, labels, default keys, touch equivalents, and conflict rules.

## Open Field

- Exact layout of the controls/bindings surface.
- Whether bindings ship in two phases: read-only controls menu first, remapping second.
- Whether the HUD quick-action cluster gains a dedicated help/controls button or folds controls into the existing pause action.
- How much first-run guidance appears as HUD hints versus pause-menu panels.
- How gamepad support is represented in the data model before actual controller input is implemented.

## Reference Policy

No external references were needed for this review. The local product evidence is stronger than category reference chasing because the game already has an established visual system and recent validated HUD work.

## Stop Conditions

This review stops when:

- UI/HUD surfaces are inventoried.
- Control-bindings gaps are clearly isolated from rendering work.
- Foundation work is separated from page/surface-local work.
- A page/surface priority order is ready for implementation without re-auditing from scratch.
