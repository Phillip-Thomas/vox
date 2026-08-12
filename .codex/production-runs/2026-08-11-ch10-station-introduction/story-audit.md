# Story Audit — ch10 station introduction

Reviewer: story-canon-auditor (opus), fresh, delta mode, 2026-08-11
Authority audited against: scene-contract.json draft-v3 `ad3cab3a…`, full canon corpus
Report recorded verbatim by the orchestrator from the auditor's return.

## Verdict

Chapter 10 is canon-clean and pillar-safe. One major finding: the run's single
hidden-pillar nudge is delivered as an assertion because the implementation
deliberately removed the perceptual anomaly the caption claims.

## 1. Both-readings law (K1–K11, labels, work orders)

Pass, both readings, no leak: K1, K2, K3, K4, K5, K6, K7, K8, K10, K11, and all
ten marker labels/work orders. K8 is the strongest line in the run — "SOURCE ON
RECORD · ISSUING STATION · THIS SYSTEM · BEARING ATTACHED (ADVISORY)" recovers
the manifest's phrase without naming the answering party, and routing it under
`WRECK RELAY` (channel) rather than `AUDIT NETWORK` (party) is correct pillar
discipline. K11 extends the ch9 close's verb ("keep alive" → "keeps alive")
rather than remixing it; endorse.

**F1 — MAJOR. K9 states what the game prevents the player from feeling.**
`main/src/story/emergentStoryDirector.ts:1432`:
`K7_REVEAL_GUARD_SECONDS = regulationRevealSeconds(K7) + 0.15 // 1.36s`
with `chapter10RelayAnswerDelaySeconds() = 1.76s` (`emergentScoreDirector.ts:93`,
2 beats @68bpm). K7 finishes painting at 1.21s; K8 replaces it 0.55s later. The
signed contract says the reply "paints inside the request's own caption breath"
and "is instantaneous by design." Shipped, the player sees ask-complete → pause
→ answer, then K9 asserts "(the answer came back before the asking finished.)"
Naive reading: an unearned flourish. Deduced reading: the spend lands on
assertion, not observation — the closest this chapter comes to telling.
Proposed fix: `CH10_RELAY_ANSWER_BEATS` 2→1 (0.88s) and drop the guard so K8
visibly cuts K7 mid-reveal; K9 then confirms rather than claims. Route: Chapter
Director (owns K9's claim) + Score (beat placement) + Integration.
ORCHESTRATOR NOTE: this proposal collides with the tri-reconciled simultaneity
term (sound must not scoop text; SC10-N1); it is a triad ruling, possibly a
contract amendment, not a direct patch.

## 2. Hidden-pillar discipline

Pass. Exactly one nudge (K9) plus K8's seed echo; no station voice, no Makers,
no Worker 9 trace, no W-7744, no "she"/"network"/"route intelligence" anywhere.
The ch8 setup — `AUDIT NETWORK` "NO DESIGNATION RETURNED." then "nothing
answers. the query does not close." — now pays off as *formal requests are
answered, personal ones are not*. Unledgered and excellent; add to the seeds
ledger.

## 3. Register integrity

RELAY continuity with ch7/ch8 holds (telegraphic caps, `·`, no first person,
header `WRECK RELAY`). No station REGULATION line exists; corridor silence
intact.

- **F3 — MODERATE.** Attribution is asymmetric: K7/K8 carry a header, K5
  (`PATTERN NOT HELD · …`) paints headerless in the same band that previously
  carried W-7744's orders. K2 self-identifies ("HAB CORE"); K5 does not. Give
  K5 a `KESTREL FABRICATOR` header or strip K7/K8's. Chapter Director.
- **F4 — MODERATE, cross-run.** Every ch10 low line is parenthetical and
  second-person ("a wall you sealed yourself", "the going is still yours",
  "both fires behind you"). The committed ch7/ch8 repair in this same tree
  moved the movement voice to bare first person ("the scar remains. now it can
  carry me."). At the stated agency peak, K10's "yours" places the voice
  outside the doer. Consistent with ch9; inconsistent with the lane the owner
  just moved. Owner taste + Chapter Director.

## 4. Continuity

Pass on the hearth, the bonded-cell claim (introduced by K2 before referenced
by A4), the fabricator (ch9 lineage), relay behavior (`LIVE_BEATS` includes
`done`), no warp, no pursuit, no NPC voice, station never the actor (bearing
issued, claimed by the player). Seam-before-resolve is geometrically sound
(`SCAN_RANGE` 5,200 > standoff 1,500 > `CORRIDOR_RANGE` 1,400); boundary
telemetry keeps the planet claim undisturbed and pins
`state:station/docking-authorized` absent.

- **F2 — MODERATE, timelessness.** `'FIRST WORLD · COURSE'` / `'FIND THE FIRST
  WORLD.'` (`storyObjectiveGuidance.ts:632`). In caps on a HUD, "FIRST WORLD"
  pattern-matches development-tier discourse, and it coins a third name for a
  place ch8 called `SIBLING WORLD`. Suggest `ORIGIN WORLD · COURSE` / `FIND THE
  WORLD YOU CAME FROM.`
- **F5 — LOW.** `'RETURN TO THE SECOND HEARTH CORE.'` fires while the player is
  standing inside `CH10_HEARTH_NOTICE_RADIUS` (12m). Suggest `STAND AT THE
  SECOND HEARTH CORE.`
- **F6 — LOW.** Comment at `emergentStoryDirector.ts:1534` says "[C] at the
  Kestrel Fabricator"; the shipped verb and work order are both [F]. Comment only.
- **F7 — LOW.** `HAB CORE` (K2) vs `HABITAT CORE` everywhere else. Defensible
  as readout abbreviation; note it.

## 5. Doc drift

**F8 — MODERATE.** `main/story-authority.json` raises `runtimeStoryCeiling` to
`ch10-transit` and carries the ch10 evidence chain, but `activeProduction` and
`dynamicSources…activePath` still name the 2026-07-13 run — the tri-signed ch10
contract is not the registered authority. `main/STORY.md` still describes the
shipped arc as terminating at ch4-arrival.

## Canon-debt register (run two: apron / counter / concourse)

1. **"ISSUING STATION"** — the place must actually issue components; a
   bazaar/market framing now conflicts with a registry-listed official source.
2. **"(ADVISORY)"** — the station may never compel; no forced dock, tractor, or
   authority over her.
3. **"a light someone else keeps alive" (K11)** — owes a keeper. Must be paid
   without a crowd (a species, absent), or explicitly re-read as not "someone
   else."
4. **"FABRICATION IS NOT AUTHORIZED" / "SOURCE NOT HELD LOCALLY"** — owes an
   issued-economy transaction grammar: what she trades, and what authorizes
   her. She has no currency in canon.
5. **"CONDITION: DEGRADING"** — the second hearth is left dying with no clock
   and no cure; run two owes the cell or an explicit non-worsening, or the ch9
   close devalues retroactively.
6. **"the going is still yours" (K10)** — no cutscene entry; arrival must
   remain player-performed.
7. **First docking authorization** — `state:station/docking-authorized` is
   defined-but-absent; run two spends it, and must keep the b9335b9 pin
   (station never becomes the resident world).
8. **ST-0's 90s ground track** — the station's system position is now a sky
   fact on Tidegarden; run two must keep bearing agreement and must not render
   the surrogate while the player is at the station.
9. **The relay is on the first world only** — any station→home message needs a
   new channel or a return flight.
10. **No name, no voice** — the first thing that speaks at the counter sets the
    pillar's exposure level; that register decision is now unavoidable.

**Highest-leverage fix per the auditor:** F1 — make the reply interrupt the
request, so the chapter's one shiver is seen rather than said.

---

## Delta re-check (post-repair, draft-v6) — story-canon-auditor, fresh instance, 2026-08-12

**F1 — CLOSED (one listen-check residual).** The ask has a body: `anc.ch10.relay-ask`
selects the real `relay-ask` mood (square fifth, 68 bpm, progression [[0,7],[0,7,12]]).
Onsets: ask figure 8 beats = 7.059s; answer enters +1.7647s = beat 3 = 25.0% into it;
no gap (longestSilenceBeforeMs 0), no accent (−25.99 → −27.06 dB), click-free (0.0187);
the question's own fifth sounds through the boundary. K9 now confirms an audible fact.
Residual: the answer's continuation is ~5dB quieter and sparser than the ask's peak, so
the arrival is partly heard as thinning; the visual channel is unchanged (asking binds
to music only). Evidence is an offline mirror per its own HONEST LIMIT.

**Amended copy — all pass, byte-identical to draft-v6:** ORIGIN WORLD (no third-name
collision; "first world" survives only in non-player-visible text); STAND AT (contradiction
gone); KESTREL FABRICATOR header (strengthens the hidden reading — her own instrument
refuses her; header slot already carries speakers); [F] FABRICATE (was in the audited base).

**F8 — coherent.** Runtime pins reference the ch10 contract; activeProduction still
2026-07-13 and no artifact claims otherwise. Debt recorded: (a) the authority gate pins
active-production identity in five coupled literals — needs a second-registered-production
schema + gate design + lock revision; (b) main/STORY.md beat table ends at ch4-arrival,
out-of-lock. **Unexpected:** check-results.json:70 stale prose says registry @draft-v4
(registry is v6); the ch8→ch10 "formal asks answered, personal ones not" seed remains
unledgered. Delta scope confirmed: exactly four copy-bearing changes v3→v6, no shipped
string removed or altered.
