# Lessons Learned

## Run Summary

- Repo: `/home/thomasphillip/Projects/vox`.
- Surface: Paravoxia embodied-story mobile HUD.
- Selected direction: Quiet Field Rail.
- Loops to approval: three material implementation/critique loops.
- Final score: `4.791 / 5`.

## Taste Learnings

- Human liked: the existing Paravoxia HUD language and game view; the request was for disciplined hierarchy rather than a visual rebrand.
- Human disliked: persistent journal copy and multiple independent utility panels competing with the world.
- Rejected patterns: one giant tabbed command drawer, auto-hiding progression guidance, dense combat/live-service button constellations, and tiny ambiguous icons.
- Successful patterns: a compact labelled field rail, one-level bottom sheet, explicit route marker, single disclosure owner, and clear default before customization.

## System Learnings

- Repeated defects: independently positioned fixed HUD elements collide at short landscape heights and 320px widths.
- Missing handoff fields: the original plan treated joystick geometry as fixed; responsive hit-region separation needed explicit authority.
- Misunderstood intent: none; the user asked for less persistent chrome, not removal of gameplay-critical guidance.
- Screenshot failures: scene readiness can precede the first composed software-WebGL frame.
- Breakpoint failures: a visually plausible 320px layout still had overlapping pointer regions; geometry assertions are required.
- Forgotten states: projected normal-motion markers originally did not use the HUD occlusion data reserved for reduced-motion markers.

## Updates to Apply

- Prompt updates: mobile HUD critiques should ask whether persistent elements are essential during play and whether each temporary panel owns input/focus.
- Template updates: add pointer-region separation and overlay rectangle nonintersection to mobile screenshot reports.
- Workflow gate updates: require portrait, short landscape, 320px, long-copy, multiple-disclosure, and desktop-preservation states for in-game HUD changes.
- Memory updates: none requested; this document remains repo-local.
