# Product Brief

## Request

- Target repo: `/home/thomasphillip/Projects/vox`
- Target route/page/component: In-game HUD, especially on-foot mobile controls and survival vitals.
- User request: Move health/decay bars out of the joystick zone to the top-left, stylize them with the rest of the HUD, remove mobile Dive, organize the remaining three mobile buttons as a bottom-right right angle, and systemize scattered HUD code.
- Design context source: Run-local contract.
- Exploration depth: `3`

## Product Truth

- Who is the user? A player actively navigating a touch or desktop first-person survival world.
- What are they trying to do? Move, look, mine/use/jump, monitor survival decay, and optionally build/craft/pause without the HUD blocking play.
- What should the screen make them do or feel? Trust the controls and read survival status at a glance without losing thumb ergonomics.
- Primary action: Continue moving/acting in the world.
- Secondary actions: Mine/use/jump, build, craft, pause/star map, inspect inventory.
- Success proxy: No overlap between vitals and joystick; normal mobile action cluster has exactly three buttons with Jump anchored in the bottom-right corner.
- What would make this feel generic? Plain black bars/circles, uncoordinated borders, no clear telemetry hierarchy, or more one-off inline HUD styling.

## Language and Tone

- Existing tone: Compact sci-fi telemetry, monospace HUD labels.
- Required terminology: VITALS, HEALTH, FOOD, WATER, TEMP, STAMINA, MINE, USE, JUMP.
- Language/claim constraints: No explanatory/tutorial copy inside the gameplay HUD.
- Primary CTA text: Not applicable; this is an in-game control surface.

## Required States

- Loading: Scoped out; HUD renders only while playing.
- Empty: Inventory may be empty; vitals still occupy top-left without leaving a hole.
- Error: Scoped out; HUD has no local error state.
- Success: Stable playing state.
- Permission/auth: Scoped out for HUD.
- Stress data: Low/varied vitals, mobile 390px wide viewport, inventory below vitals.

## Gate

- Clear product goal: `pass`
- Goal/action/success proxy defined: `pass`
- Real user job defined: `pass`
- Production language constraints defined: `pass`
- Required states defined: `pass`
