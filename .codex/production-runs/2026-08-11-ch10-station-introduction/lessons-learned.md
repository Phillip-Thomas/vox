# Lessons learned — 2026-08-11 ch10 station introduction

Written for a future production team with no access to this conversation.
Ordered by how much time each one cost, most expensive first.

## Reusable lessons

The ten numbered lessons below are the reusable ones; each ends with a **Rule**
stated so a team that never saw this run can apply it. They sort into three
kinds, and the sort is only an index — no lesson is repeated or reworded here.

- **Workflow learning** — how the run was governed, routed and recorded:
  lessons 2, 7, 9 and 10.
- **Craft learning** — how the chapter itself was authored, staged and
  measured: lessons 1, 3 and 4.
- **Tooling learning** — how the probes and evidence behaved: lessons 5, 6
  and 8.

*Section headings in this file were added by the closeout archivist to index
existing text against the gate's required structure. No lesson was added,
removed or reworded.*

## 1. A contract term can be unsatisfiable, and the run will read that as bad craft

The cut-line occupancy term failed measurement three times across three
revisions (38–47%, then 28–34%, then a measured 25.77%). Each time it was
"corrected" by observation — someone looked at a frame, measured it, and wrote
that number into the contract. Only when the Cinematography Director derived
the relation analytically did the real problem appear: occupancy is `K/Z` with
`K = L·sinψ / (2·tan(FOVh/2))`, and because the transit leg flies the station
centre in a straight line, ψ is constant, so occupancy depends on range alone.
The 28–34% band was **first reachable at Z≈965 — outside the contracted
[1,000–1,300] window**. It was never satisfiable. Three rounds of "the frame
must be wrong" were actually "the number was impossible."

This happened **three times in one run**. The gaze-bias acceptance ("ST-0 in
frustum on ≥4/8 crossing-strip frames") was equally impossible: the movie
lane's walk lasts seconds against a 90-second orbital ellipse, so ST-0 was
above the horizon on 0 of 419 walk frames. No implementation could have
satisfied it. And the seam still's angular band straddles the boundary
depending on whether you measure the spine linearly (7.911°) or
tangent-correctly (8.249°) — a term whose verdict depends on an unstated
convention is the same disease in milder form.

**Rule:** any contract term expressed as a measured quantity must ship with its
derivation in the contract text, not just its result. Before signing a
numeric acceptance, ask the cheap question nobody asked here: *is there any
state of the shipped system in which this is true?* State the measurement
convention explicitly when two reasonable conventions disagree at the
boundary. If a term fails twice,
stop adjusting it and derive it. Prefer a formula the verifier evaluates at
capture time (with a stated relative tolerance) over a fixed band, because a
fixed band silently outlives the geometry it came from. Watch for the
tell: a number that reappears in several places with slightly different values
(here, a mobile "about 26%" derived from a superseded desktop 31%) is a number
that has outlived its derivation.

## 2. The automation lane will hide the manual lane's defects

The movie lane traversed ch10 perfectly while the manual player was broken: she
claimed the bearing on foot at the relay and was then told "HOLD [SPACE] TO
IGNITE" with no locator to a ship parked wherever she landed, rendering as the
jetpack glyph on touch. It passed only because the autopilot had been given an
explicit walk-and-board step — a bespoke accommodation that *substituted* for
the missing guidance rung instead of exercising it.

**Rule:** when the autopilot needs a step the player is not given, that is a
defect report, not an implementation detail. Any accommodation added to the
movie lane must be justified as "the player does this differently" and written
down, or it will mask the gap it papers over. The independent player-experience
audit is what caught this; no mechanical probe ever would have.

## 3. Fixing the mechanism is not the same as making it run

The ST-0 gaze bias was implemented to spec, and its solver was then proven
correct in isolation (worst error 25.000° → 0.000°). ST-0 still appeared in one
of eight crossing frames. The state machine was right, the solver was right,
and the thing still never happened in the live path.

**Rule:** acceptance must be measured on the shipped path, in the shipped lane,
at the sampled instants — never on the component. Instrument each conjunct of
an engage predicate separately and per-frame; a predicate that is "obviously
true" is exactly where the run loses hours. This run hit that class at least
four times (flight directive gated on beat literals, a phase name that meant
only "in atmosphere", module-global controls surviving six legs in one beat,
and this).

## 4. Enumerations of shipped chapters silently exclude new ones

Three separate defects had the same shape: `/^ch[5-9]$/` predicates that never
anticipated a two-digit chapter, and a boot-world resolver whose ownership list
stopped at ch9. The last one produced the two defects the owner actually saw in
headed play — a full-size companion planet drawn centred on the camera, and the
ground itself becoming a lockable body that painted a phantom FLIGHT CORRIDOR
lock. One wrong predicate, two unrelated-looking symptoms.

**Rule:** replace chapter/beat enumerations with order comparisons derived from
the canonical beat order (`storyChapterAtLeast` exists for this). When you fix
one, grep for its siblings in the same commit — they travel in packs.

## 5. Probes must resolve modules through the app's own specifiers

A bare `import('/src/story/...')` in an in-page probe returns a **second,
pristine module instance**. The probe then measures a runtime nobody is
playing: the signed AV rail reads inactive while the app is mid-beat, free-play
timers read zero while the app is running. This voided several hours of
evidence twice. After any source edit, resolve through the app's own
HMR-timestamped specifier (`/src/...?t=` plus the HMR timestamp Vite stamped on
the module); the newer probes in this run show the idiom and say why.

Worse than measuring the wrong instance is measuring the wrong *lane*: the
crossing-strip probe opened the page **without** `movie=1` while recording its
URL as `movie=1` in the evidence. Every downstream reader — two auditors, the
verifier, and this orchestrator — reasoned about a movie-lane measurement that
had been taken in the manual lane, where the behaviour under test is forbidden
by ruling. An evidence file that reports its own inputs incorrectly is worse
than a missing one, because it is trusted.

**Rule:** probes must record the URL they actually opened, read back from the
page (`location.href`), never the string they intended to open. Assert the
lane inside the page before measuring anything that depends on it.

Related: **one browser page at a time.** Five to seven concurrent pages caused
renderer deaths that looked exactly like a scene defect and sent the run
chasing a nonexistent capacity problem for a full pass.

## 6. Stale evidence outlives the code that produced it

A critical audit finding ("the LOW strips and HIGH stills render through
different lenses, so every composition verdict is unfounded") was correct about
the pixels and wrong about the cause: the strips had been captured hours
earlier, before the autopilot fixes, when the leg flew without a committed
bearing and lingered in a state that no longer occurs. Instrumentation showed
all four profiles bit-identical.

**Rule:** stamp every capture with the source revision *and* the run state it
was taken from, and re-capture after any change to the path that produced it.
A reviewer measuring stale bytes will produce a rigorous, correct, useless
finding. Note the good discipline that followed: the Cinematography Director
accepted the reclassification but refused to treat it as re-measurement, and
held every composition verdict formally suspended until fresh strips existed.
Reclassifying a finding is not the same as re-testing it.

## 7. Deferring a lie beats publishing one

The guidance contract requires that a mandatory objective never be observable
without a resolvable marker. The first fix resolved markers in the same frame
as activation, which worked only where the handle already existed; on deep
links a rung published 3.4s before its target mounted. The final design
**defers publication** until the marker resolves — an unfindable rung reads
`idle` (true) rather than `missing-marker` (a lie). Measured across 42,886
mutation-resolution records: zero missing-marker observations.

**Rule:** when a lifecycle can't be honest yet, say nothing rather than
something false — but then check that the silence itself is legible (this run
carries an open low-severity item for the deferral gap having no visible
state).

## 8. Verification tooling is production code and rots like it

Three separate gate/tool bugs cost real time: the creative-triad gate compared
`typeof value` against an *array* of types, so every scalar journey-contract
assertion failed (reproduced on the previously "passing" run); the diff
`PLACEHOLDER_PATTERN` scan applied an angle-bracket rule to TypeScript,
flagging every generic; the scene-AV generator was pinned to a single signed
contract, so
adding a second one made the checked-in runtime "stale". Also: a probe guard
that never fired measured 613 emissive lights instead of the hull.

**Rule:** when a gate fails on something that looks obviously fine, suspect the
gate — and prove it by running it against a known-good artifact from a previous
run before touching your own. Budget for tool repair inside creative runs; it
is not a distraction from the work, it *is* part of the work.

## 9. Ask the human for the one thing the harness cannot generate

Two of this run's most valuable findings came from thirty seconds of the
owner's headed play (the ghost planet and the phantom corridor lock) and from a
blind viewer given only frames and audio with no context ("nothing crosses; it
reads as a frozen game"; "too small for the biggest image"). Neither was
reachable from instrumented probes, and both pointed at real defects.

**Rule:** commission the blind read every time, and route one concrete headed
question to the human early rather than saving up a screening for the end.

## 10. Record what actually happened to the artifacts

The run deployed to production mid-amendment, from an uncommitted tree, with
governance checks red — because `firebase.json`'s predeploy hook runs `build`
and never `verify`. The correct response was not to argue about it but to
record it: lock revision R8 states plainly that publishing occurred, by whose
direction, from what state, and that the machine field says otherwise only
because its schema constrains it. An artifact that contradicts reality is worse
than no artifact.

**Rule:** when a governed step is bypassed, write it down in the governing
document the same hour, with the honest details. Also: a deploy hook that skips
the repo's own verification is a structural hole — fix the hook, not the
incident.

## Next-run guidance

The ten Rules above, restated as the order a next team will need them. Each is
a pointer back to its lesson; nothing new is claimed here.

1. Before signing any numeric acceptance term, derive it and ask whether any
   state of the shipped system satisfies it (lesson 1).
2. Commission the independent player-experience audit before the movie lane is
   trusted as proof that a beat is playable (lesson 2).
3. Treat "the mechanism is implemented" and "the mechanism runs in the shipped
   lane" as two separate proofs (lesson 3).
4. Grep for chapter enumerations whenever a chapter is added; an ordering test
   is not an enumeration (lesson 4).
5. Resolve probe modules through the app's own specifier, and record the lane
   the probe actually opened (lesson 5).
6. Purge and regenerate evidence after the code that produced it changes, and
   date every capture (lesson 6).
7. Defer rather than publish an unprovable claim; a routed question costs less
   than a retracted verdict (lesson 7).
8. Maintain verification tooling as production code, with its own tests
   (lesson 8).
9. Route one concrete headed question to the human early, and commission the
   blind read every time (lesson 9).
10. When a governed step is bypassed, write it into the governing document the
    same hour, with the honest details (lesson 10).
