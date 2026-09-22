# Common Ground — integration report

One engineer, one chapter. Implemented against the signed `scene-v1` contract
(`ecce3e98…baac3a74`), whose gate receipt and three director signatures were
verified — and whose live bytes were re-hashed — before the first edit.

## Blocking condition found at the end, not caused here

**The frozen contract was replaced in place with an unsigned `scene-v2` while
implementation was under way.** `scene-contract.json` now hashes
`4dbf722b…fddff88e` and declares `contractVersion: scene-v2`, while
`contract-gate-pass.json` and `director-signoffs.json` are both still `scene-v1`.
The producer's own record says so: *"promoted exact scene-v2; three fresh
signatures and contract gate pending."*

I did not move the runtime pins. The AV generator, the registry catalog and the
story-authority identity still name `scene-v1`, so five gate invocations now
fail — and that is them working. They are reporting, correctly, that the bytes
the runtime is bound to are no longer the bytes on disk:

- `chapter:registry:check` — 2 of 4285 (`scene.contract-hash`, `scene.contract-identity`)
- `chapter:registry:smoke`, `scene:av:check` — the same cause
- `story:authority`, `story:authority:smoke` — 1 of 1039 (`production.contract-identity`)

All five passed clean before the re-freeze. Re-pinning them to an unsigned
revision would have been the one thing the whole gate chain exists to prevent,
so the chapter stays bound to the revision three directors actually signed.

Per the inbox, the common-only planned/unverified **guide exception is not
implemented**. When root posts the three-signature gate for `scene-v2`, the
re-pin is mechanical: the sha and revision in `generate-scene-av-runtime.mjs`,
`signedSceneAvRuntime.ts`, `chapter-registry.json` and `story-authority.json`,
a regenerate, and the two changed strings (`guidance/objectives/9` marker label,
`guidance/objectives/13` work order and enter anchor).

## What is actually implemented

Four registered beats, seventeen signed objective rungs, twenty-eight signed
anchors each dispatched from its real physical owner, six moods through the
existing score facade, a walking actor, a persisted world-scoped snapshot, and
a movie bridge that now runs from inside the station all the way into ch13.

**The chapter's own state and geometry** — `commonGroundState.ts`,
`commonGroundRoute.ts`. Pure, no React, no THREE, no clock. Two trace slots
(`accepted` with the class it earned, `working` for the current proposal), real
walked distance carried per sample so wandering between samples is charged
against the 120-unit cap, a tail revision that returns only the discarded tail's
distance and never bumps on a no-op, and strict hydration that rejects the whole
snapshot on any impossible tuple rather than grafting a partial one. References
are socket to socket; the fixed socket is written as the qualified literal
because `51.05 + 1.3` lands six femtometres inside the cap and makes the
instrument occlude itself from everywhere. Walk queries sweep the actual body,
not a foot point, because the backing's underside is above the ground plane.
Progress along a route is bounded by observed displacement and ordered
continuity, so standing at C is worth nothing and the six-unit endpoint
shortcut cannot buy the eighteen-unit passage.

**The runtime** — `commonGroundDirector.ts`, `commonGroundActor.ts`,
`commonGroundScore.ts`, `world/CommonGroundWorld.tsx`, `beats/ch13/`,
`autopilot/rail-ch13-*.ts`. The chapter re-activates from `done` free play at the
actual restored Tidegarden core via `reactivateStoryAtBeat`, and it can tell a
live install from a restored save by watching the receipt appear rather than by
trusting a flag. Every commit is downstream of a physical act, is idempotent,
and is refused from the wrong beat. Every world query fails closed. His refusals
name a literal cause and are published where his body actually stops. A revision
resumes from his real pose — no walk back to W, no replay of the approach — and
a reload resumes his pose, his leg and his walked units rather than giving them
back. The apparatus is a real fixed collider as well as a drawn one.

**The boundary** — the registry gains a named `externalTransitions` record for
`ch10 -> ch13-via-station`, because chapter 10 ends in flight at a station
standoff and chapter 13 begins on foot at a repaired hearth, and two host
segments run between them. Ordinary adjacency is untouched and still exact;
nothing was added to ch10's exit and nothing was dropped from ch13's entry. The
transition's hosts, receipts and evidence are bound to real producers, with ten
negative self-tests covering invented, renumbered and dropped receipts, unknown
hosts, unresolvable evidence, duplicate and non-adjacent pairs, and a transition
declaring a gap that does not exist.

**The movie** — the station screening no longer ends at a shop counter. It holds
on the concourse, then walks out through the interior's own airlock objective and
presses the same [F]. The return URL carries `movie=1` and never `story=`. The
old station bridge yields once departure exists instead of flying back into the
door it came out of, a new return bridge crosses home and presses the shipped
`story-ch12-install-bonded-cell`, and the flight directive now steers for the
post-terminal bridges and for `ch13-return` — which it previously did not do for
any bridge, so their thrust was being asserted into a directive nobody read.

## Commands

`npm run typecheck` pass · `npm run test` 348 files / 2972 tests pass ·
`npm run build` pass · `chapter:journey:check` 0 issues ·
`chapter:journey:smoke`, `guidance:target-check`, `story:ladder:check`,
`preview:check`, `catalog:check`, `creative:workflow:check`, `creative:smoke`
pass · the five contract-pin gates fail for the single external reason above.

`npm run verify`, the visual gate and every headed/GPU probe were deliberately
not run: they belong to the independent story-verifier.

## Honest limitations

No frame, draw, material, program or memory budget is measured — the two-mesh
shape is a design intent, not evidence. No audio was heard. No cold journey,
movie run or screenshot exists. The two preparation work orders under
`ch13:survey:test` and `ch13:common:reciprocal` are engineer-authored
truthfulness copy required by the signed acceptance criteria, published under
the same signed ids and marker labels with one entry acknowledgement each;
scene-v2 appears to formalize exactly this, and adopting its exact strings waits
on its gate. `StoryDebugPanel.tsx` and `tidegardenRoute.ts` were reported as
outside the original boundary before being edited and were then added to it by
root. The story-authority gate's active-production identity is now structural
rather than a frozen literal; the single genuine relaxation is documented in
`integration-report.json#/honestLimitations`.

Nothing was published, deployed, reset, stashed or checked out. The release
ceiling remains `ch4-arrival`.
