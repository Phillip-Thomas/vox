# Run summary — 2026-08-11 ch10 station introduction

Contract: `scene-contract.json` **draft-v9**, sha256
`0336a4f28bfaa874fffc300f02999e329dbed86d3cdcd53cf7ce3261c48639b1`,
tri-signed approve-with-notes. Production lock revisions R1–R9.
Mode: chapter. Disposition at time of writing: **awaiting cohesion judgement**;
publishing already occurred out-of-band (see §6).

## 1. What was built

Chapter 10 — the space station enters the story. Three beats plus an unmarked
prelude:

- **ST-0** — inside `done` free play, a moving point of light crosses the night
  sky at the second hearth. No marker, no cue, no name, no score. A 90-second
  orbit at the station's true bearing; the player may never notice it, by design.
- **ch10-cold** — the habitat core's bonded cell is failing. The player notices
  it in person at night, then exhausts self-sufficiency at the fabricator: the
  cell is *issued*, and cannot be crafted. The need to leave emerges from play.
- **ch10-ask** — the player crosses back to the origin world and claims the
  wreck relay outbound. The answer returns before the asking finishes. This is
  the chapter's one hidden-pillar spend, and it is now audible: the answer
  figure enters at beat 3, 25% into the ask's own sounding two-bar question,
  gapless and unaccented.
- **ch10-transit** — the issued bearing is flown on ch8 grammar to a standoff
  outside the docking corridor. The station resolves from a seam of light into
  a place. Thrust cuts, the ship coasts, the work order clears, and the run
  ends on a frame with no annotation on it.

The player never docks. That is the authored cut line, not an unfinished edge.

## 2. Where it lives

Runtime: `main/src/story/` (state, director, guidance, score, signed AV rail,
autopilot, movie runtime, boundary telemetry, interactions, world props, route),
`main/src/components/` (ST-0 via SystemCompanionBodies, ShipController,
SpaceStationApproachDriver, station exterior), registry and authority JSON, and
four tool repairs. Commits: `9a20dde` (chapter), `ea35f0d` (review repairs),
`93a702b` and `e105660` (run record).

## 3. State at close

- 2,270 tests; `npm --prefix main run verify` 9/9; contract gate 1663 passed;
  implementation gate 1787 passed.
- Whole-game movie-lane traversal: 427s, 30/30 legs, zero timeout rescues.
- Marker invariant: 42,886 mutation-resolution records, zero mandatory
  objectives ever observable at `missing-marker`.
- All four variant profiles reach transit with identical objective health and
  a common applied FOV.

## 4. Defects

Canonical register: `defects.json`, 16 entries. Eight repaired and proven, one
disproved as stated (the lens-identity finding — the strips were stale, not the
lens), one accepted residual (the landfall intermittency, closed on frequency
8/8 but never observed off this headless box), two accepted exceptions (mobile
work-order collapse; the authority gate's single-production identity), three
awaiting the final capture pass, and two that only the owner can settle.

## 5. The pattern worth carrying forward

Four separate contract terms in this run were **unsatisfiable by construction**,
and each read as bad craft for one or more rounds before anyone checked:

| Term | Why it could not be met |
|---|---|
| Cut-line occupancy band | first reachable at Z≈965, outside its own [1,000–1,300] window |
| Gaze-bias frame count | ST-0 above the horizon on 0/419 movie-walk frames against a 90s ellipse |
| Seam spine band | verdict flipped on an unstated linear-vs-tangent convention |
| Bright-disc exclusion | the moon sits 24.56° off-axis against a ±10° yaw allowance |

Every measurement term in draft-v9 now carries its derivation inline, and where
impossibility was conceivable, an explicit reachability sentence. All four
supersessions keep their cause in the contract text. `lessons-learned.md` holds
the full set of ten transferable lessons; this is the first and most expensive.

## 6. Publishing (out of band)

The owner directed a hosting deploy mid-run on 2026-08-12:
`firebase deploy --only hosting` → https://paravox-game.web.app. It went out
from an uncommitted tree while the contract had advanced past its last full
signature, because `firebase.json`'s predeploy hook runs `build` and never
`verify` — nothing in the repository's governance chain can currently block a
deploy. Recorded in full as lock revision R8. The tree was committed
afterwards as `9a20dde`; **the live site still serves that commit and predates
every review-wave repair.**

## 7. Resume point

1. The final capture pass stamps `verification-report.json` against draft-v9
   (three hero stills, ST-0 night-dwell visibility, gaze telemetry, occupancy
   evaluated as `K/Z` rather than a band).
2. The cohesion judge rules on the complete record and produces
   `final-scorecard.json` — the last ~20 final-gate failures are its to close.
3. `critic-report.md` was never commissioned; three defects cite it as a
   lossless source and it remains a template. Either run the moderation pass or
   record the omission.
4. Owner decisions: seven, in `human-decision.json` — docking architecture,
   corridor-silence legibility, the voice lane, reveal scale, the predeploy
   gate, the release surface, and whether to redeploy onto the repaired build.
5. Deferred with reasons: the second-run chapters (apron/counter/concourse) and
   the ten canon debts this chapter's shipped lines create for them, in
   `story-audit.md`; the score's continuous-pedal packet; multi-production
   registration in the authority gate; `main/STORY.md` still ends at
   ch4-arrival.

## 8. What changed

Runtime, in three commits. The chapter itself — beat union and order,
milestones, resume ladder, the ch10 chapter object in the registry, the story
director's entry and tick arms, ten guidance rungs, the signed AV rail with ten
anchors, nine score moods under a 0.44 ceiling, autopilot and movie coverage,
boundary telemetry for the station claim, and the ST-0 sky point. Then the
review-wave repairs: the reboard rung, the gaze solver, ST-0 occlusion, and
berth-ring suppression. Outside ch10, six pre-existing defects were fixed
because ch10 was the first thing to walk into them — the ch9 double
objective-enter, the boot-world resolver that stopped at ch9, three chapter
predicates that never anticipated a two-digit chapter, and four verification
tools that had rotted (a JSON validator comparing a type against an array, a
placeholder scan applied to TypeScript, a generator pinned to one signed
contract, and a probe guard that never fired).

## 9. Evidence

`evidence-registry.json` is the index; every media row is ffprobe-matched
against its declared probe. Frame strips at LOW only, three HIGH hero stills,
and **zero movie renders** — the owner's lean-rendering instruction was a lock
term, and movie-lane traversal is proven by state traces rather than video.
Score evidence is deterministic OfflineAudioContext renders plus combined-bus
excerpts. State traces cover all four variant profiles. The blind viewer
received `raw-audiovisual-evidence.json` and nothing else.

## 10. Quality

Final scoring belongs to the cohesion judge and is not yet recorded. What the
independent reviewers found on their own terms: canon clean and pillar-safe;
the score lane independently lockable after its blocking defects were repaired
and re-measured; guidance never lying, with one missing rung since authored and
wired; the blind viewer reading the spine as "a clean, moving spine" while
naming two real defects nobody else had seen. The run's own quality gates —
1663 contract checks and 1787 implementation checks — pass; the final gate's
residue is enumerated in §7 by owner.

## 11. Cohesion judgement (2026-08-12)

**Disposition: repair.** Weighted 4.404 against a 4.75 bar; category floor 4.00
against a 4.30 bar. Full reasoning in `cohesion-judge.md`, scores and evidence
in `final-scorecard.json`. Per category: narrative 4.60, audiovisual 4.10,
composition 4.00, score 4.70, palette 4.40, transition 4.70, ambition 4.70,
interaction 4.25, implementation 4.50, evidence 4.00.

The judge found the chapter to be "one authored event, not three departments
side by side" — and then found the thing no single lane could see.

**The joined finding.** Three reviewers independently reported the station
reveal as "too small". Every lane treated it as a musical question, and the
score lane defended its restraint on musical grounds. The judge measured the
image: the cut line renders the station at **19.65% of frame width at range
1,421**, against a contracted 22.0–28.7% across a window the ship can no longer
reach. The cause is this run's own correct repair — suppressing the autopilot's
held boost cut terminal speed from 320 to 117.5 u/s and shortened the coast
from about 533 units to 196. So the "too small" perception is *half image
regression*, and the musical half was being argued in isolation against it.
This is now owner decision `owner-decision-cut-line-reach`.

**Routed by the judge.** J-1 the cut line (Cinematography + Integration, fix
first); J-2 ST-0 measuring below the starfield peak against a contract sentence
claiming otherwise; J-6 a `thickness ≤2.4°` ceiling carried forward marked
"unchanged" while the convention around it changed; J-7 camera-rigid cockpit
clusters, one brighter than the station in its own aperture; J-8 variant parity
proven manual-lane at a single profile; J-5 an uncommissioned `critic-report.md`
cited as sole source for three defects, and an unfilled
`chapter-journey-evidence.json`; J-9 the run cannot pass its own final gate
under its own lock, because the gate demands a continuous video and a headed
pass while the lock forbids renders and the box is headless.

**Declined by the judge, correctly:** the reveal's restraint (owner's ear — no
measurement settles it, and the fix reopens two signed terms), the corridor
silence (only the human who played it has standing), the voice lane, and the
cut line's golden-section framing versus the blind viewer's endorsement of that
same frame.

**Orchestrator disposition on J-3.** The judge reported all four hero-still
hashes stale and the night-dwell strip unregistered. That was accurate when it
read the registry — it began while the final stamping pass was still running.
Re-verified afterwards: 314 rows hash-clean, ST-0 visibility evidence pinned on
both halves of its split acceptance, and the only two stale rows were files
written after the judge started, including its own scorecard. Both re-hashed.
The finding is closed, and is recorded here rather than silently dropped
because the judge was right to raise it.

**Orchestrator disposition on J-4.** The judge is correct that no independent
eye had seen the current stills — two changed materially after every review was
filed. A fresh blind read of the three final stills and the night-dwell strip
was commissioned on receipt of the judgement; its result is the last thing
added to this record.
