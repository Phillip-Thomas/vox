# Observed completion — bounded Score direction

**Route a bounded implementation-fidelity correction of the normal-`done` suspension path. No creative contract amendment is indicated.** This conclusion uses the actual completion measurement together with the existing source audit; it is not inferred from a null diagnostic alone.

The unchanged scene-v3 is `5ef85a324f579ba1f627980002aab680f6c9b990fae84275daccc3dcb17eec54`. `/reset/states/3/acceptanceCriterion` explicitly permits a fresh completion and its immediate handback/normal transition to `done` to retain the bounded live token. `/score/cues/5` requires actual final completion, at most five live seconds, the existing 4.5-second release, immediate independent controls/progression, and early cancellation on the specified real lifecycle changes. It specifies **no audible minimum, fixed five-second performance or guaranteed attack**.

## What now warrants correction

`producer-finale-observed-completion-review.json` records 847 retained atomic samples. At window-4 index 179, actual Terra 18 / worker 18 / committed / both AV anchors coexist with `done`, `active=false` and token age about 0.0212 seconds. The next sample, 13.5 ms later, reports no token. Both samples are visible/focused and report `game: direct (running)`.

Reuse `finale-lifecycle-audit.json`: `StoryDirectorDriver.tsx:145` includes `story.active` in `foreground`. The observed false value necessarily makes that predicate false. When the earlier-priority callback runs, line 151 invokes suspension; `commonGroundDirector.ts:1751–1754` cancels the token before the later normal post-`done` deadline tick. Thus an otherwise eligible normal completion has an unconditional cancellation path that contradicts the retained exception. Correcting that source behavior does not require proving it was the sole clearing caller in this particular window.

The new timing fits the audited path, but the dynamic stack, cancellation reason, paused state, mute/volume and exact context transition remain unrecorded. Visibility/focus and a running-route description do not exclude every alternative. This direction does not claim that they do.

## Bounded routing

Route to the integration engineer through the producer, after the active verification/source freeze is released for the authorized pass. Correct only the existing foreground/suspension versus normal-completion wiring: story inactivity alone must not masquerade as real pause, visibility loss or quit for an eligible completion token. Keep completed story logic inactive and controls/guidance handed back immediately.

Preserve every genuine pause, quit, mute/unavailable-output, focus/visibility, reset, world/actor, new story/optional action, deep-link/replay/sandbox and other beat-exit cancellation. Preserve eligibility, no hydration/deferred/repeat replay, the existing monotonic deadline and release order. Do not force an attack, extend the allowance, change material or geometry, or create a new engine path.

Use focused lifecycle checks and a subsequent bounded atomic completion window to verify the distinction, actual clear reason and release ownership. No broad score review is implied. The same-session owned WAV is retained evidence, but its 1.891-second PCM/process-wall duration difference leaves exact event/sample alignment unproved. No audible success, failure or taste claim follows without appropriately aligned output evidence and actual audition.

The JSON companion binds the producer review, prior Score interpretation and reused audit by exact hashes and quotes the governing clauses. This role changed no source, probe, contract, signature, audio material or geometry and performed no GPU work.
