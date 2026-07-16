# Product Brief

## Request

- Repo: `/home/thomasphillip/Projects/vox`
- Surface: `ch7-reconstruct`, `ch7-board`, first `ch8-launch` cockpit frame
- Goal: make the repaired chapter mechanically trustworthy and visually legible/cohesive rather than leaving capture defects as future polish.

## Product Truth

- Player job: understand and physically restore the wreck, cross its hatch, then recognize that control has passed to a flight-ready Kestrel.
- Primary actions: perform the current reconstruction task; board/cancel through the available input; orient to the cockpit flight view.
- Success proxy: the eye can locate wreck/task/hatch/cockpit focus without geometry occlusion or HUD conflict while the exact signed transaction still completes.
- Generic failure: a dark/empty cockpit, arbitrary floating slabs, tutorial-card clutter, or a hidden camera cut.

## Language And Tone

- Preserve terse operational Story language.
- Keyboard cancellation may name `ESC`; touch cancellation must name `USE` or the action, never an unavailable key.
- Captions remain subordinate to the required objective and controls.

## Required States

- Reconstruction entry/active objective; hatch entering; camera transfer/pressure seal; cockpit handback/launch.
- Loading/empty/error/auth are outside this real-time state repair; pause/focus and reduced motion remain covered by existing behavioral tests.
- Mobile portrait is the stress state; representative landscape/hardware remains the final visual approval state.

## Gate

- Goal/action/success proxy: `pass`
- User job and language constraints: `pass`
- Required states: `pass`
