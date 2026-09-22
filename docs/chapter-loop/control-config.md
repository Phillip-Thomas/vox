# Ordinary-control capture contract

Validate a case with `validateCaseFile(settings, {chapter, kind})` exported by
`main/tools/chapter-loop/control-capture.mjs`. `capture-case.mjs` does this before
building or opening a preview. Fix every reported error before spending a look.

The file is `{chapter, manual, recovery, continue, av, continuity}`. The three
control cases contain `route`, `beats`, `acceptedMilestones`, `completionMilestones`,
`deltaPointers`, `durablePointers`, `steps`, and optionally `bootstrapSteps` and
`newActionSteps`. Case `chapter` is supplied by the wrapper. All JSON pointers
refer directly to `window.__paravoxiaJourneyProbe.snapshot()`: `/story/beat`,
`/state/localActor/milestones`, `/unfinishedMap/opened`, etc. There is NO `/journey`
wrapper. Use an actual on-foot body vector for movement, never the ship pose.
The integrator can expose existing read-only on-foot telemetry in its owned
journey bridge if it is absent. Read-only projection must not create progress.

Actions (unknown fields are errors):

- `{type:'key', code:'KeyW', holdMs:120}` — hold then release, `holdMs` <=5000.
- `{type:'press', code:'KeyF'}` — ordinary key press.
- `{type:'click', selector:'button[data-example]'}` — visible DOM control.
- `{type:'click', x:640, y:360}` or `{type:'move', x:640, y:360}`.
- `{type:'text', value:'text'}` — ordinary typing.
- `{type:'wait', pointer:'/unfinishedMap/opened', equals:true, timeoutMs:30000}`.
  Other comparators: `exists`, `changes`, `atLeast`, `includes` (exactly one).
- `{type:'waitSelector', selector:'button', state:'visible', timeoutMs:30000}`.
- `{type:'settle', ms:200}` — max30000.
- `{type:'walk', posePointer:'/actual/onFootPosition', target:[x,y,z],
  timeoutMs:30000, arriveWithin:1}`. Alternatively use `targetPointer` for a
  live target. It briefly measures ordinary WASD displacement, steers with
  bounded held keys, releases them, and fails on no movement or no progress.
  Optional `noProgressMs` (default4000, <=timeout), `tickMs` (50..1000),
  `minProgress` (default0.25), `forwardKey`, `backKey`, `leftKey`, `rightKey`.
  It does not teleport, move the camera, mutate state, or solve arbitrary terrain.

Each wait and walk is capped at30000ms. Multiple meaningful steps can describe
a longer route; increasing a wait cannot move the player. Split walking at
actual navigable waypoints. A pose vector must use the same frame as its target.

`bootstrapSteps` run before baseline readiness through the ordinary action
executor. Use them for a visible landing CTA and any real predecessor actions.
Bootstrap milestones are baseline facts and receive NO chapter action credit.
The browser context is fresh: `keep=1` cannot conjure an earlier save.

Recovery adds `pause:{pausedPointer:'/actual/paused', resumeSelector:'button:has-text("Resume")',
timeoutMs:10000}` and `newActionSteps`. The harness presses Escape itself;
do not also press Escape in the setup steps. It requires a visible Resume,
observed interruption, restoration and a newly accepted gameplay action.

Continue adds `continue:{ctaSelector:'button:has-text("Continue")',
checkpointPointer:'/unfinishedMap/indexed', timeoutMs:20000}` and `newActionSteps`.
The setup must earn that checkpoint during this capture. The harness reloads
the same context, waits for and clicks the real landing CTA before expecting
runtime readiness, compares all durable pointers, then requires a new action.
Choose a checkpoint with an actual remaining action and non-null durable data.

Manual coverage may use an existing diagnostic predecessor `story=` entry to
exercise and earn the new chapter locally. Label it diagnostic; it is not proof
of a fresh full-story journey. New chapter actions and completion must still be
earned through actual movement and input. Full continuity uses the separate
fresh-story capture, with no state injection or debug preparation. AV needs its
own audible capture. A fixture or source implementation never certifies those.

Capture saves actual per-beat frames under `raw/frame-*.png` and a final
`frame.png`. Inspect the images; their existence alone is not visual acceptance.
