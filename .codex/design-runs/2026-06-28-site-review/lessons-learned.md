# Lessons Learned

- In Paravoxia, input help must be mode-aware. A single static controls card is not enough because on-foot, build, fabricator, parked ship, descent, deep space, and touch controls differ.
- The current HUD visual system is worth preserving. Productionization should consolidate data and states before changing presentation.
- Controls/bindings should be a shared data model first, then UI. Otherwise Landing, Pause, Build, Cockpit, Touch, and README copy will drift.
- Pause is the correct always-available home for controls, bindings, co-op recovery, HUD preferences, and quality-of-life settings.
- Mobile HUD lanes validated in the previous run are a hard constraint for future work: bottom-left movement, bottom-right actions, top-left suit telemetry, no normal FPS Dive button.
- When another agent is actively changing rendering, UI/HUD planning should avoid screenshot-heavy tooling and source edits outside the intended UI files.
