# Cohesion Judge Report — Common Ground (`council-v1`)

Run: `.codex/story-runs/2026-09-06-common-ground` · candidate `790b2894…87ae` · register `017bafda…90fd` · read-only, no patch/build/probe/publication.

## Verdict

**REVISE — weighted 4.63 against a 4.70 threshold. No open critical or high defect, no unaccepted blocking medium, no lock violation, all required signoffs present.**

This is a near-threshold, quality-driven revise, not a governance failure and not a rejection. The packet is complete, the boundaries are honest, the dissent is real, and the bounded documentation patch is factually correct where I independently checked it against source. It falls short of approval on artistic-causal margin, not on integrity: one verified stale present-tense row survives inside a just-patched governing document; the chapter's central promise (two materially different retained route classes) is explicitly *unestablished by measurement* at signature time; Terra's in-chapter opposition and belief movement are the thinnest joint in an otherwise strong spine; and the measured player's most severe diagnosed failures (complicity legibility, imperative-voice authorship) are carried forward as inherited debt into a chapter that adds a heavy new guidance surface.

I explicitly do **not** demand personal owner viewing of a documentation proposal. `owner-story-decision.json` records `authorityKind: standing-user-delegation`, `personallyReviewedByUser: false`, `runtimeMutationAuthorizedByThisDecision: false`, `publicationAuthorized: false`, `acceptedMissingEvidence: false`. That is the honest form and I accept it.

## Preconditions — satisfied

| Required artifact | Present | Note |
|---|---|---|
| Production lock + runtime inventory | `production-lock.md/.json`, `runtime-story-inventory.json`, `inventory-open-issues.json` | Lock names protected surfaces and the July 28 gate lift |
| Source-of-truth map, isolated blind + canon reports | `source-of-truth-map.json`, `naive-reader-report.md` (`canonExposure: false`, corpus `d0fe8449…e53e`), `canon-audit.md`, `contradiction-report.json` | Blind report is a genuine, adversarial cold read, not a simulation |
| Three independent treatments | `chapter-`, `score-`, `cinematography-story-treatment.md` | Materially different; alternatives preserved unmerged |
| Peer notes / reconciliations / dissent | 10 notes over all 6 routes in `director-notes.json`; three `*-reconciliation.json`; `dissent-register.md` | No author closed its own note |
| Register + candidate + signoffs + owner decision | `canon-decision-register.json` (CG-D01–D12), `story-authority-candidate.md`, `director-signoffs.json` (3), `owner-story-decision.json` | Identical candidate/register hashes across all four |
| Diff, validation, docs audit, alignment | `implementation-diff.patch` (iter 2), `check-results.json` (77/1094/smoke), `documentation-audit.md` (pass 2 APPROVE), `alignment-report.md` (APPROVE) + `alignment-scope-dispositions.json` | Iteration-1 lineage preserved under `iterations/docs-v1` |

No artifact was filled in, simulated, or inferred by me.

## Strongest throughline

**`MODEL REFUSED BY OBSERVATION` → `MODEL INCOMPLETE`, paid by a reversal of bodies.** The A4 fault is a shipped, player-visible line (`emergentStoryDirector.ts:970`, quoted verbatim by the blind reader) and the blind reader independently names its non-payment as SEVERITY 4 ("W-7744 vanishes with no consequence and no closure"). The candidate converts that measured loose thread into a chapter whose mechanism *is* the theme: Terra's successful passage is not evidence usable by him, so the only route to a shared result is for the auditor to physically hold one end of a measurement he does not accept. The payoff is a **local** record with an admitted limit, not a conversion. Setup, opposition, tactic, action, consequence and payoff are all nameable, and the candidate refuses every cheap version of the payoff (`no network clearance, friendship, forgiveness, passenger, alliance or forced awakening`, CG-D04).

Second-strongest: **hearth reliability as the enabling condition of departure**. The station errand's silent terminus is a confirmed source gap (`inventory-open-issues.json` OI-4; alignment A3; blind reader: "Install. Anticlimax"). CG-D01 gives it one bounded acknowledgment, and CG-D02 makes the *reliability of that home* the precondition for leaving it — `i can go back without losing here.` That is a real causal chain from a measured defect to a dramatic proposition.

## Weakest causal joint

**Terra's in-chapter opposition.** The candidate deliberately removes every external pressure — no summons, no threatened hearth, no clock, no knowledge of W-7744's location — and the hearth is guaranteed to stay reliable while she is away. That is correct thematically and correctly refuses to manufacture stakes. But it leaves Terra with a motive ("security and curiosity") and a belief movement ("a shared view seemed necessary; one reliable act can preserve different accounts") that are the least pressurised in the whole arc. W-7744's change is earned by his own body and his own final test; Terra's is earned mainly by walking and by *depending on his reference* for one crossing — a single, brief obligation. The reciprocal crossing is the right instrument; it currently carries almost all of Terra's opposition on its own. This is the joint most likely to read as an errand between two thesis positions if the crossing does not land physically.

Secondary weak joint: the chapter's own guidance load. The candidate enumerates a separate objective per verb (review, choose return, board/lift/fly/land, offer route, walk trace, offer span, test, revise/hold, take the reciprocal end, leave clearance). The blind reader's SEVERITY 1 finding is precisely that this game "keeps writing beautiful sentences about self-determination while the HUD tells me where to stand." The candidate's guidance replacements are better written and target real objects, but nothing in this packet measures that the new chapter avoids the diagnosed failure.

## Shipped A0→`ch4-arrival` spine and sandbox handoff — independently checked

- `storyState.ts:107,349–350` — `ch10-transit` is the last formal beat before `done`; the ceiling claim in the patched docs is literally correct, and `main/story-authority.json:7` agrees (`runtimeStoryCeiling: ch10-transit`, `releaseStoryCeiling: ch4-arrival`).
- The patched `STORY.md` correctly retires the "TEMPORARY TERMINAL / `completeStory()` at arrival" claim; `completeStory` exists at `storyState.ts:830` but not on the arrival path — the audit's account matches what I read.
- `ch11`/`ch12` exist only as milestone namespaces outside `STORY_BEAT_ORDER` (OI-3); `installTidegardenBondedCell` exists in `stationReturnStory.ts` / `TidegardenSettlementWorld.tsx` and emits no caption (OI-4). Both are represented accurately in the candidate and in the patch.
- Public release remains `ch4-arrival`; the patch changes no ceiling, no protected-question family (`w7744-return-cause` verified still present at `story-authority.json:303`), and no shipped string.

## Character table

| Character | Desire | Opposition | Tactic | Belief before → after | Earned by | Reveal level |
|---|---|---|---|---|---|---|
| Terra (W-7743) | Revisit an unresolved person/place from a home that now holds | Her own successful passage is not evidence he can use; his restricted model | Demonstrate by walking; inspect the specific hold; revise the unverified tail or supply a witness; then *depend on his reference* to cross | "a shared view seemed necessary" → "one reliable act can preserve different accounts" | The reciprocal crossing (required on both routes). Thinnest of the three — see weak joint | Player-visible action and intent |
| W-7744 | A repeatable local measurement that his restricted model can hold | A living site that exceeds his classifications; a witness he cannot dismiss | Test rather than accept assertion; hold at a specific limit; maintain the other reference; make the final test on his own responsibility | His record defines where a body may go → his record can admit incompleteness | His own authored action and physical arrival; explicitly *not* a timer, cue, gaze, ledger or movie receipt | Player-visible action + `LOCAL RECORD`; interiority stays inferred |
| Worker 9 / third consciousness | — | — | — | None asserted | Correctly withheld: "no new attributed voice, bodily intervention, motif, counting device or reveal in this chapter" | Author-only; protected |

The protection of Worker 9 here is a strength, not an omission: the rubric's requirement for three distinguishable drives is satisfied by the candidate's explicit refusal to spend the third at this reveal level.

## Reveal ledger

| Item | Level after this candidate | Verified basis |
|---|---|---|
| W-7744 alive, faulted, returned locally | Player-visible fact, shown by repetition in-scene | CG-D03; no rejected report / dispatch / punishment / offworld journey invented |
| W-7744 later offworld/A5 recurrence, cause, timing, turn | Protected, open | `w7744-return-cause` retained in manifest; Bible/Exec re-assert openness |
| W-7744's interiority / awakening | Inference only; explicitly uncertified | "`MODEL INCOMPLETE` must not certify his awakening, goodness or allegiance" (alignment §3) |
| Worker 9 survival, shared body, third consciousness | Author-only; untouched | No new voice, motif or evidence grammar in ch13 |
| Makers, literal Terra authorship, simulation, final frame | Owner-only; open | `protectedUnresolved` list intact; no A5/A6 spend |
| Bond/seal mechanism, station affiliation, open registry query | Intended confusion; KEEP | Alignment §3; reader's theories remain theories |
| Voice grammar (CG-D08) | Presentation rule, bounded to new ch13 copy | Bible §8 now labels the blanket ban "Historical blanket rule"; no older copy rewritten |

No leak found. The scoped answer to a protected *family* (local recurrence answered; global family retained) is the correct construction, not a deletion.

## Agency, fallback and rescue table

| Window | Honest classification in candidate | Verified guard |
|---|---|---|
| Depart for Origin | Genuine choice, revocable; invitation stays pending | "waiting or opening a save cannot choose departure for the player" |
| Walk the trace | Player action; grounded samples only | "Looking at a marker or standing on three pads does not record a route" |
| Offer the span | Explicit F commitment at a real end | Draw/offer targets are distinct objectives |
| W-7744's refusal | Real, reversible, contingent; specific reason | Footing failure vs. lost reference are *different* messages |
| Witness hold | Suspension, not failure; resumes without a second offer | "Walking away can suspend a witnessed span; looking away cannot" |
| Revision | Cost-free, repeatable, prefix-preserving | "Never silently decimate a tested corner" |
| W-7744's final test | **Authored rite**, honestly labelled — not a branch | "The character's decision is authored, not a dialogue branch"; prerequisites are player-earned |
| Completion | Physical arrival only | "No timer, caption, sound, camera shot, gaze dwell, observation-ledger entry, timeout rescue or movie-only receipt grants it" |
| Movie path | Must perform the real actions; timeout reports **stuck** | Three cold no-rescue journeys required |
| Score tail | Presentation allowance, never a predicate | ≤5 s live-only + existing 4.5 s release; controls/progression already free; cancels on 8 listed transitions; no hydration/replay |

This is the strongest section of the candidate. Agency is named with unusual precision, and the one authored rite is declared as such rather than dressed as choice.

## Whole-arc audiovisual reading

The candidate states the arc as a continuous perceptual ladder: regulatory feed and constrained cameras → earned embodied agency → material/life perception → A4 refusal and the audit fault → physical Maw/dive/ship capability → same-system stewardship → station dependence and restoration → **ch13's gain: reading another body's evidence inside the same alive world**. A5 Light keeps first interstellar warp; A6 authorship and A7 conflicting lenses remain unspent. That is a disciplined, non-inflationary progression.

- **Motif:** the unresolved audit square returns only at actual Origin inspection; temporary witness loss does not restage refusal; only the *completed* test permits changed phrase spacing — no victory chord, no alliance duet, no separate-accounts coda. Setup→transform→payoff is intact and gated on a real fact.
- **Silence:** demonstration and the reciprocal crossing leave space for world sound; a true refused span permits a quiet indefinite hold. This directly answers the blind reader's observation that the piece is strongest when the instruction voice goes quiet.
- **Camera/lens/palette:** deliberately unchanged — player-owned 75°, existing rigs and palettes, one living view, no forced look, no new light, no post unlock, no renderer tier. Meaning is carried by feet, instrument direction, the trace break and the reciprocal positions. Cinematography withdrew its own placed-marker/relocation thesis in its own outgoing note (`CG-CIN-CH-01`) because the walked trace answered the blind reader better — a real, costly concession.
- **Rendering:** the trace records only walked ground; no optimal preview, X-ray, or fidelity unlock. Proposed/tested spans are distinguished by shape and value, not colour — mobile, reduced-motion and lowest-tier equivalence preserved.
- **Honest gap:** the ≤5 s allowance **does not exist** — current story deactivation clears score immediately; Score names this as a required future chapter-local integration through existing `storyScore` authority. No current audio has been heard (OI-5, OI-6: stale, score-only, template audio reports). The direction is sound; its audibility is unmeasured and correctly disclaimed.

## Governance and readiness

- **Precedence honoured.** Runtime > Demo Foundation Plan > Bible > owner decisions > Execution Plan > lineage. `PARAVOXIA_EMERGENT_STORY_BATCH_PLAN.md` and `PARAVOXIA_CH4_PLAN.md` are retained as lineage without regaining authority (the audit flags the batch plan's stale ceiling assertion and correctly declines to commission a pass on it).
- **Machine checks:** 77 candidate validations (all `passed: true`), `story:authority` 1094 pass, smoke pass. I treat these as necessary and not sufficient; none of them measures artistic quality, and the packet never claims otherwise (`noAudiovisualOrRuntimePassClaim: true`).
- **Dissent:** the one material competing thesis (placed markers vs. walked trace) was resolved by the *proposer* withdrawing it; the aftermath disagreement (departing vs. persistent tester) was resolved by cinematography accepting persistence; the score-handback tension produced an amended, strictly bounded allowance that all three then signed. No consensus-by-omission. All three original treatments survive unmodified as alternatives.
- **Readiness:** stable proposed beat IDs (`ch13-home/-return/-survey/-common`), a real acceptance document, an explicit typed external ch11/ch12 transition requirement, and named preconditions ahead of geometry signature (define reference/instrument socket endpoints and heights; establish both route classes; day/night legibility). The candidate *refuses to sign an arena it has not measured* and states the reopening condition. That is the correct posture, and it is also why readiness scores 4.5 rather than higher: the chapter's core promise rests on a premise the packet openly labels unestablished.

### Boundary finding (explicit)

**No lock violation.** `check-results.json` compares 958 source files with `unexpectedRuntimeDrift: []`; the diff touches exactly the five authorised paths (Bible, Execution Plan, STORY.md, `story-authority.json`, the authority schema) and I independently confirmed it contains no `src/**` hunk and no shipped-copy string. Runtime story, audio, rendering, camera, save and post-arrival behaviour are untouched. Ceilings, protected question families and production identity are unchanged. `runtimeMutationAuthorizedByThisCandidate: false`, `publicationAuthorized: false`. Nothing in this candidate claims a playable chapter, an accepted arena, an audiovisual pass, hardware/style/performance approval, or a release change.

**Explicitly not credited by me:** Worker 9's survival; the shared body; the third consciousness; W-7744's future motive, allegiance or awakening; any Maker, simulation, authorship or final-frame ontology; any claim that the geometry pass 2 stream establishes the outer route class (it is in flight and unreviewed — see defect CG-JUDGE-006); any claim that inherited runtime perception debt (A1/A2/A4) has been closed by this patch.

