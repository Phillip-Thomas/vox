# Product Brief

## Request

- Target: Paravoxia in-game mobile HUD across embodied story chapters.
- User request: reclaim the game view, place the objective journal behind a toggleable modal, and organize other blocking HUD items using strong mobile-game patterns.
- Exploration depth: `3`.

## Product Truth

- The player is navigating a visually authored 3D world while managing survival and completing story objectives on touch.
- Primary job: see and control the world without losing the next required action.
- Primary action: play; the HUD supports rather than becoming the surface.
- Secondary actions: inspect objective, inspect suit/pack, build, craft, pause.
- Success proxy: the persistent non-control HUD occupies a small edge rail, the objective remains discoverable in one tap, and no progression cue becomes implicit.
- Generic failure: tiny translucent text, unexplained icons, desktop panels merely scaled down, or live-service-style button clutter.

## Language and Tone

- Keep authored objective copy unchanged.
- Use explicit compact labels: `JOURNAL`, `SUIT`, `SYSTEMS`, `BUILD`, `FABRICATOR`, `PAUSE`.
- Status is factual: `ROUTE LINKED`, `ROUTE RECALIBRATING`, `NOMINAL`, or the lowest critical percentage.
- Opening a trigger reveals the relevant sheet; closing returns immediately to play.

## Required States

- Closed gameplay: compact objective trigger, compact suit summary, collapsed pack, one systems trigger.
- Journal open: full objective/context/action/route health; input and story paused.
- Suit expanded: full discovered telemetry on demand.
- Systems expanded: gated Build/Fabricator/Pause actions.
- Missing marker: compact warning state and full recalibration message in journal.
- Stress: long objective text and 320px-wide landscape/short screens remain scrollable and inside safe areas.
- Desktop: current objective card and actions remain unchanged.

## Gate

- Clear product goal: `pass`
- Goal/action/success proxy defined: `pass`
- Real user job defined: `pass`
- Production language constraints defined: `pass`
- Required states defined: `pass`
