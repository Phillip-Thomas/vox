# Story Audit — 2026-08-10 ch7/ch8 voice repair

Reviewer: story-canon-auditor (opus, fresh, independent). Committed verbatim by the orchestrator from the auditor's read-only deliverable.

# §4 RULING — **SIGNED-OFF**

`they asked for a designation. what i have is not one.` **preserves the A8 name payoff. It does not spend or weaken it.** Four independent grounds:

1. **The payoff is defined as a *render*, not a fact.** `Bible:1526-1530` reserves for A8 "the lowercase name Terra gave Worker 9 and retained," *rendered* on the returned terminal. The line prints nothing, quotes nothing, and attaches nothing to any person. Verified in code: no `{name}` consumer exists in this run, and `getWorkerName()` is untouched (`main/src/story/storyState.ts:745`; only consumer remains `main/src/story/prologue/VoyageLedger.tsx:184`).
2. **Retention is already shipped, player-visible, and thirty beats old.** `main/src/story/storyScript.ts:144-145` ships `UNREGISTERED DESIGNATION. NOT RETAINED.` answered by `(retained.)`. Stronger still, `storyScript.ts:125` *prints the typed name on screen* in the voyage (`({name} sleeps through the bell. the name fits better than the number ever did.)`). The name has therefore already been seen. A8's card is the name's **first return**, and a line that prints nothing cannot spend a return.
3. **`UNREGISTERED DESIGNATION.` is not reused.** Grep-verified: that exact string exists only at `storyScript.ts:144`. The stack's `NO DESIGNATION RETURNED.` is a near-homophone echo of `NOT RETAINED` — deliberate, and it strengthens rather than consumes the pair.
4. **No locked question is pre-empted.** The line makes no claim about Worker 9's survival, legibility, the shared body, the third consciousness, or W-7744. `worker9-reveal-timing` (`main/story-authority.json:258`) is untouched.

**Attached condition of sign-off (binding on downstream artifacts):** the line's *most available* player reading is "I have no valid registration," not "I still hold the name I typed." The contract's ledger entry claiming it "proves retention" over-credits it (see F6). Sign-off is granted on the line **as an unresolved holding**, and no evidence, scorecard, or summary in this run may describe retention as proven, demonstrated, or established by ch8. The run stop condition is cleared.

---

# Story Audit

Reviewer: `story-canon-auditor` (fresh, independent)
Status: complete
Contract revision: `draft-v4` (SHA `df544b13…a1f1e3`), status `frozen`, supersedes `draft-v3`

## Independence and authorities

- First report completed before reading peer conclusions: **YES** — `naive-audience-report.md`, `ux-audit.md`, `score-audit.md`, `cinematography-audit.md`, `cohesion-judge.md` were not opened.
- Canon/runtime references inspected: `/home/thomasphillip/Projects/vox/main/story-authority.json`; `/home/thomasphillip/Projects/vox/main/PARAVOXIA_STORY_BIBLE.md` (:89, :400-447, :1175-1257, :1483-1536); `/home/thomasphillip/Projects/vox/main/src/story/emergentStoryDirector.ts`; `.../storyScript.ts`; `.../storyDirector.ts`; `.../storyText.ts`; `.../storyObjectiveGuidance.ts`; `.../world/storyWorld.ts`; `.../state/spaceFlight.ts`; `.../components/ShipController.tsx`; lineage `/home/thomasphillip/Projects/vox/PARAVOXIA_CH4_PLAN.md`, `PARAVOXIA_PROGRESSION.md`, `PARAVOXIA_REVISION_PLAN.md`, `main/PARAVOXIA_EMERGENT_STORY_BATCH_PLAN.md`.
- Run artifacts inspected: `scene-contract.json` (frozen copy, events, reveal ledger, non-negotiable canon), `story-intent.md`, `implementation.diff`, `production-lock.md` (R1–R5), `dissent-register.md`, `.codex/design-runs/2026-07-28-story-enjoyability/ch7-ch8-repair.md`.
- Copy conformance: all 21 new strings and the 1 changed string in `main/src/story/emergentStoryDirector.ts` are **byte-identical** to the frozen contract enumeration. Zero unapproved strings; zero drift.

## Findings

- **Causal event and player verb:** clean. Every one of the 21 strings is edge-triggered on a committed player fact (`hasWreckDiagnosisReceipt`, five `ShipRepairStage` edges, calibration receipt, seated flight, the physical surface→non-surface edge, `deep_space`). No thematic beat is produced by a timer *substituting* for an act; timers only space lines already earned. The one wrinkle is L2 — see F1 and the ladder ruling below.
- **Character desire, opposition, tactic, belief change:** the ch7 spine is genuinely dramatic and the strongest thing this run bought. Desire (leave without undoing the refusal), opposition (every restored system increases visibility), tactic (build anyway), belief change lands exactly on `i put it in anyway.` — a turn purchased with ten existing actions and zero new mechanics. ch8's spine is thinner: L2 carries the belief statement, L4 carries the reframe, and both callbacks (pond, tree) are the fragile ones. See F1.
- **Setup/payoff trace:** the indexing chain verifies. `FILE CLOSED` (M1) → `PASSIVE BEACON RESTORED` (M4) → `TRANSPONDER ARMED` (M5) → `INTEREST RAISED` (M7) → `AUTOMATED CONTACT … HULL LOGGED: DESTROYED` (L5.1) → `CONTACT LOGGED.` Every term is introduced before it is referenced; nothing in ch8 depends on a fact ch7 did not stamp. The registry-asks/world-answers motif also pays off an unnoticed shipped seed: `MUSINGS.asking` — `the world keeps answering. i have not heard it ask anything yet.` (`storyScript.ts:720`) — is answered by M7's `nothing has asked yet.` and then by `REGISTRY QUERY · STATE DESIGNATION.` This is the best long-range setup in the change and should be recorded in the seeds ledger, which does not currently carry it.
- **Canon and chronology:** `SITE 7C-θ` verified against `storyScript.ts:35,42`, `prologue/VoyageLedger.tsx:317,324`, `feed/RegulationFeedHud.tsx:335`, `Bible:89`; the θ glyph form matches the HUD-era convention. `the wreck that brought me here` is literally true — `DescentPod.tsx:32-34` converts the descent pod into `HifiWreck` at A3, same pose. The tree is the ch4-defy hero tree (`heroTreeHandle`). The pond callback verifies precisely against `FIRST_DAY_CAPTIONS.drank` (`answered. the need goes quiet.`) and `.waterskinFilled` (`carry the answer. the question will return.`), and survives ch5 `(the pond answers in structure, not instruction.)` and ch6's keel. `AUDIT NETWORK` is established before reuse (`emergentStoryDirector.ts:622`, a4-exhale). The relay identity is the one factual soft spot — F5/F11.
- **Reveal levels:** `voice-one-way-exit` is mis-levelled (F2). `name-retained` is over-credited (F6). `ship-reports-you` is correctly levelled at player-inference. `authority-answer` and `hidden-pillar` are correctly untouched. No line credits Worker 9 survival, the shared body, the third consciousness, or W-7744's motives — verified line by line.
- **Intended ambiguity and both readings:** all 22 strings survive both readings; I found no break. The highest-pressure line is `the last part is the part that thinks. i am being watched now. i put it in anyway.` — under the pillar reading it invites the player to notice the narrator is a component. It never confirms, so it passes, but it is now the ceiling: no future line may repeat the "I am a part / I think" figure without the plant accumulating into a tell. Log it as a metaphor-budget entry.
- **Agency, mandatory path, fallback, hand-back:** control is never taken; no new objectives, markers, milestones, or persistence; the R2 hold keys on the identical durable `deep_space` fact and the R1-accepted drift is ruled, not a finding. The ladder dramaturgy is **consistent** with the agency philosophy (detail below).
- **Automated fallbacks counted as acceptance:** none. `CONTACT LOGGED.` is impersonal, passive, hull-addressed, first-person-free, and never touches the refusal, the tree, or conduct. The Authority does not answer. Boundary holds across the entire four-row stack plus M7.
- **Tutorial/gameplay purpose:** copy annotates, never instructs. One caution: `hold it.` lands while the objective card reads `HOLD [SPACE] TO IGNITE AND LIFT.` Per `Bible:1188-1192` the HUD *is* the narrator's hand, so this is legal and in fact the line's best reading — the imperative channel that has issued orders since chapter 1 is finally acknowledged as self-issued. It is also the reading a naive player is least likely to reach.
- **Reality-stage fidelity:** unchanged; copy-only. No new perceptual or rendering capability claimed anywhere.
- **Continuity / reset:** prime directive proven by test; latch seeding prevents replay bursts. The seeding does, however, make ch8's setup chain non-durable across a mid-ch7 resume — F7.
- **Implementation versus signed contract:** exact. Copy, ordering (audit → caption), cadence constants, drop rule, and the R2/D9 holds all match `draft-v4`. `storyText.test.ts` proves the retired `you` string exists nowhere in the served client.

### The ch8 ladder dramaturgy — ruled consistent

Order-then-act holds on the paced route. On the accelerated route the phase edge is `LAUNCH_DURATION = 1.4 s` after the player's `[SPACE]` (`ShipController.tsx:116, 742-754`), so L2 lands 1.4 s after the hold began, while the climb is still live — `hold it.` reads as "hold the climb," not as an order issued after its own execution. The acceleration is player-caused, does not cascade (L3 still owes L2 its full slot, test-asserted), and the drop rule keeps the frozen exit window inviolate. A timer-fired self-order followed by the player's obedience is the correct ordering for an *order*, so L2's timer path is not a thematic-event-by-timer defect. Consistent — with the L1 casualty in F1 as the cost.

## Defects

| ID | Severity | Anchor | Observation | Evidence | Owner | Required verification |
| --- | --- | --- | --- | --- | --- | --- |
| `F1` | high | `anchor.ch8.at-the-controls`, `anchor.ch8.site-recedes` | ch8's only two callbacks are both fragile on ordinary routes. L1 is 94 chars = 3.20 s reveal; an eager player's phase edge lands at ~2.4 s after seating, cutting the thirst payoff clause `— that is what the answers were for.` mid-typewriter. L3 is dropped outright on fast/POTATO/movie routes (test: `asserts the drop, not the render…`). The pond and the tree — the beat's entire callback content — are the two least reliable lines in it, while L4/designation/open-query are guaranteed. Compounded by `dissent-02`: L3's image support is already OPEN. | `emergentStoryDirector.ts:820-846`; `emergentStoryDirector.test.ts` ladder cases; `ShipController.tsx:116,754`; `dissent-register.md` `dissent-02` | chapter | Contract reopen. Minimal fix: `l2DueAt = max(phaseEdge, t_L1 + revealSeconds(L1))` preserves the accelerator for slow players while protecting the payoff clause; and give the tree clause a guaranteed slot inside the L4→L6 window when the ladder drops it, since that window is ch8's only guaranteed screen-time region. |
| `F2` | high | `voice-one-way-exit` (reveal ledger) | "The brackets come off at ch7 M1" is not player-legible. The embodied voice already ran **bare** for the entire first day and ch4-vigil — `CH3_CAPTIONS`, `FIRST_DAY_CAPTIONS`, `MUSINGS`, `VIGIL_LINES` are all unbracketed (`storyScript.ts:600-622, 688-722, 803-809`). Parentheses are a **regression** that begins at `ch4-audit` and runs to ch9. So the player's experience is bare → parenthetical → bare, and M1 reads as normal, not as a turn. `(repair is not return.)` is not "the last private thought"; it is one of sixteen regressed lines. The copy is correct; the *thesis and the ledger level* are over-claimed (`levelBefore: author-only → levelAfter: player-visible`). | `storyScript.ts:600-622,688-722,803-809`; `emergentStoryDirector.ts:418-450`; contract `revealLedger[voice-one-way-exit]` | chapter + orchestrator | Downgrade the ledger entry to "repairs a shipped regression inside two beats; not player-legible as a turn until ch5/ch6/ch9 land." Raise the escalated follow-on's priority: the run fixes one third of the regression, and R1's accepted drift is worse than recorded because the flicker exists on *both* sides of ch7. |
| `F3` | medium | `anchor.ch8.open-query` → `ch8-crossing` entry | Content collision beyond R1's grammar scope. `nothing answers. the query does not close.` fires at +14.0 s; the advance is at +17.0 s; `ch8-crossing` then posts `(there is another world here. it was always here.)`. An answer-shaped observation lands 3 s after the line whose entire content is that nothing answers. R1/`dissent-03` cover the *bracket* flicker; neither covers the semantic collision, and `dissent-05`'s bilateral silence law is undercut by it. | `emergentStoryDirector.ts:441-443, 832`; `dissent-03`, `dissent-05` | chapter | Record as a new item on the R1 follow-on (not a new dissent): the seam carries a content defect, not only a grammar one. |
| `F4` | medium | `evt.ch7.m5-lift-online` / `evt.ch7.first-hover` | `the ground's hold is a habit, not a law.` was authored as the **first hover** line (`PARAVOXIA_CH4_PLAN.md:679`, "the game's whole thesis in nine words"; `PARAVOXIA_EMERGENT_STORY_BATCH_PLAN.md` L4). Shipped, it fires on the lift-cell *install*, and the run deliberately leaves the first-hover anchor silent ("authored withholding"). The thesis line now precedes the physical experience it names, and the moment the player actually defeats the ground has no voice. The run traded embodiment for reliability (the movie path never hovers) — a defensible trade, but it should be a recorded trade, not a silent relocation. | `emergentStoryDirector.ts:230-235`; contract `evt.ch7.first-hover`; `PARAVOXIA_CH4_PLAN.md:679`; batch plan L4 | chapter | Record the trade in the contract's reveal ledger. Follow-on option: move this caption to `hasFirstLegalHoverReceipt` and give `lift_online` its own line. |
| `F5` | medium-low | M4 `WRECK RELAY` header | `WRECK RELAY` is a **named diegetic prop standing metres from the player during ch7** — the console the player reported at in ch3-signal and resolved samples at in ch4-comply (`storyObjectiveGuidance.ts:360-361,428-429`; `storyDirector.ts:2439`; planted beside the pod impact, `storyWorld.ts:589-605`). Under that header, `PASSIVE BEACON RESTORED` predicts a light the prop does not show during ch7/ch8 (D12). D12 legislates the contradiction away by fiat rather than removing it. The header is genuinely double-referential (ship's relay / the network's local voice), and both readings serve the device — only the beacon expectation is exposed. | `emergentStoryDirector.ts:227,755`; `storyWorld.ts:589-605`; intent D12 | chapter (follow-on) | No change this run. Follow-on option: retitle the header to the ship (`KESTREL RELAY`) to remove the prop confusion while keeping the third register — contract reopen and owner copy decision required. |
| `F6` | medium-low | `revealLedger[name-retained]` | Over-credit. The entry states the caption "proves retention without printing." It does not prove it; it makes it available as an inference, and the more available reading is "I have no valid registration." Per my §4 condition, no downstream artifact may claim retention as proven. | contract `revealLedger`; `storyScript.ts:139-148` | chapter | Reword the ledger's `playerEvidence` to "supports, without confirming, that something name-like was kept." No copy change. |
| `F7` | low-medium | `evt.ch7.m1-diagnosis` … `evt.ch8.contact-logged` | The advertised reconstructable causal chain is not durable. Latches seed consumed on re-entry and nothing is persisted, so a player who quits mid-ch7 and resumes can reach ch8's stack having seen **zero** `WRECK RELAY` lines — `CONTACT LOGGED.` then arrives without its setup. Correct anti-replay behaviour; unrecorded narrative consequence. | `emergentStoryDirector.ts:741-750` (seeding block); test "seeds the ch7 voice latches on re-entry" | chapter | Record in the contract's agency ledger as a known resume consequence. No fix in scope. |
| `F8` | low | `evt.ch8.stack-two`, `evt.ch8.designation` | Timelessness watch (not a violation). `REGISTRY QUERY · STATE DESIGNATION.` + `what i have is not one.` is protected from an identity-politics misreading **only by the hull framing** — the query is addressed to a craft whose file says destroyed, and `designation` is established shipped serial-number vocabulary (`storyScript.ts:88-89,144`). If any future line addresses the query to the *person*, the reading flips. `Bible:1252-1257` compliance holds today. | `emergentStoryDirector.ts:818,827`; `Bible:1252-1257` | chapter | Add to the contract's non-negotiable canon: the registry query addresses a hull, never a person. |
| `F9` | low | `story-intent.md` §3 header, D4 | Arithmetic drift. §3 says "ch8-launch — six latched moments, **eight** new strings" and D4 says "ch8 = eight new strings (four captions + four regulation lines)". ch8 actually ships **six** captions (L1–L4, designation, open query) + four regulation lines = **ten**. D4's totals give 19; the implementation and this task's brief both say 21. The frozen §3 *enumeration* is correct, so nothing shipped is wrong. | `story-intent.md:292,610-614`; `emergentStoryDirector.ts:807-833,883-912` | chapter | Correct D4 and the §3 header. |
| `F10` | low | `evt.ch8.l1-controls` | L1 introduces the first em dash in the awakening-caption register; the shipped caption corpus uses period-delimited short clauses throughout (`storyScript.ts:600-622,688-722`). Em dashes appear only in regulation prose bodies and card titles. Minor register drift; also the mechanism by which the truncation in F1 costs the whole payoff clause. | `storyScript.ts` caption corpus vs `emergentStoryDirector.ts:884-886` | chapter | Note only, or fold into F1's rewrite if L1 is reopened. |
| `F11` | low | `ch7-ch8-repair.md:21-22` | Lineage doc drift left uncorrected. The treatment's premise — "The wreck **hosts** the relay used in `ch4-comply`" — is false against world code: the relay is a separate console planted *beside* the pod impact (`storyWorld.ts:589-605`), not hosted by the hull. The intent silently re-based to hull attribution (D12) but the design-run file still asserts the false premise and is a machine authority path in `production-lock.md:133`. | `ch7-ch8-repair.md:21-22`; `production-lock.md:133`; `storyWorld.ts:589-605` | orchestrator | Annotate the design-run treatment with the corrected world fact so a future run does not re-derive the device from a false premise. |

## Strongest five lines (of the 22)

1. `the last part is the part that thinks. i am being watched now. i put it in anyway.` — the belief change, the cost, and the choice in one breath; the whole ch7 spine paid in nineteen words.
2. `it remembers a straight line and goes back to it without being told. i watch that closely.` — a system reverting to its training, watched closely by something afraid of exactly that; answers `MUSINGS.waiting` without touching it.
3. `hold it. this is the only order left, and i am the one giving it.` — retroactively explains every work order the player has obeyed since chapter 1 as self-issued.
4. `CONTACT LOGGED.` — the world's total reply to a revolution is a row in a table; do not decorate it, ever.
5. `the scar remains. now it can carry me.` — the changed string earns its owner decision: the second person leaves and the damage becomes load-bearing.

## Weakest five lines

1. `the site gets small. the tree does not. i keep finding it.` — the shipped frame cannot witness it and the ladder can drop it entirely; a payoff that is both unseen and optional.
2. `the pond answered every time i asked. i am leaving anyway — that is what the answers were for.` — the best callback in ch8, and the clause carrying the callback is the clause the ordinary route truncates.
3. `the keel takes the weight first. everything after this is allowed to be heavy.` — "allowed to be heavy" is the most abstract move in the ch7 ladder and the least sensory.
4. `i closed it, and something inside started listening again. i did that too.` — "i did that too" splits between "I also began listening" and "I also caused that" in a way that costs more clarity than the ambiguity buys.
5. `the wreck that brought me here will leave here. i will build the leaving.` — `will leave here` momentarily parses as "will remain here," a stumble on the line that opens the bracket-fall.

## Verdict

`repair` — **findings-routed, not blocking.**

The frozen copy ships byte-exact, every string survives both readings, no reserved payoff is spent, `CONTACT LOGGED.` holds its automated-handshake boundary across the whole stack, the register discipline is clean (no rank-issued "I", no new institution), and the goal plot is **structurally safe**. Nothing here requires the owner. Findings F1–F11 route to the chapter lane and the R1 follow-on.

**§4 sign-off statement, for the record:** *The canon auditor SIGNS OFF the §4 designation line `they asked for a designation. what i have is not one.` It preserves the A8 name payoff — nothing is printed, quoted, or attached; `UNREGISTERED DESIGNATION.` is not reused; retention is already shipped player-visible copy and the A8 card is the name's first* return*, which remains unspent; and no locked question, including `worker9-reveal-timing`, is pre-empted. Sign-off carries one binding condition: no artifact in this run may describe retention as* proven *by this line. The contract's stop condition is cleared.*

**Single highest-leverage fix:** protect ch8's callbacks. Change L2's due time to `max(phaseEdge, t_L1 + revealSeconds(L1))` and give the tree clause a guaranteed slot inside the L4→L6 exit window when the ladder drops it. Today, the two lines that carry ch8's entire emotional payload — the thirst arc and the refusal — are the only two the runtime is allowed to truncate or discard, while the lines that survive on every route are the ones the world speaks.


## Addendum — 2026-08-11 — conformance and revalidation against frozen `draft-v5`

Reviewer: story-canon-auditor (opus, read-only, independent first-wave)
Contract revision audited: `draft-v4` (SHA `df544b13…a1f1e3`); revalidated against frozen `draft-v5`
First report completed before reading peer conclusions: yes
Peer review files not opened at any point: `naive-audience-report.md`, `ux-audit.md`, `score-audit.md`, `cinematography-audit.md`, `cohesion-judge.md`

### Revalidation statement

**The audit remains valid against `draft-v5`. No finding is withdrawn, no severity changes, and the §4 sign-off stands unmodified.**

The audited surface — the 21 new strings and the 1 owner-approved changed string in `main/src/story/emergentStoryDirector.ts` — is byte-identical between `draft-v4` and `draft-v5`. Copy, band routing, intra-moment ordering (audit → caption), the frozen cadence constants, and the ch8 drop rule are unchanged. Re-verified in the frozen contract at revalidation time:

- `revealLedger[name-retained]` now carries my §4 binding condition verbatim ("SUPPORTS, WITHOUT CONFIRMING… no contract, evidence or review text may treat retention as proven") — this is finding F6 discharged.
- `revealLedger[voice-one-way-exit]` is downgraded `levelBefore/levelAfter: author-only` with the regression framing — finding F2 discharged.
- `nonNegotiableCanon` gains the hull-guard ("the registry query addresses a hull, never a person… a line that does collapses the timelessness protection and must return to the owner before it ships") — finding F8 discharged, and in stronger form than I proposed.
- `evt.ch7.first-hover` records the F4 trade verbatim, including the owner-gated restoration option.
- The `agency.ch7.build-loop` window records the F7 resume consequence verbatim.

`draft-v5` therefore **strengthened compliance with this audit's findings rather than changing the audited surface**. Revalidation is a re-read of the frozen contract against the shipped strings, not a new audit of new material.

One mechanical delta outside my lane was inspected for narrative consequence and cleared: ruling R4 (defect ux-03) makes the ch8 exit-window clock accumulate only on `deep_space` frames, freezing on a sub-boundary dive and resuming from the held value, with the advance requiring both a held clock ≥ 17.0 s and a current `deep_space` phase. Once-only latching is preserved, so the consequence stack cannot be split, re-burst, or reordered, and `CONTACT LOGGED.` cannot lose its slot. No string, ordering, or reveal level is affected.

### MOD-03 correction (accepted)

The main report states that the only remaining `getWorkerName()` consumer is `main/src/story/prologue/VoyageLedger.tsx:184`. **That is incomplete and is corrected here:** a second call site exists at `main/src/story/JourneyRuntimeProbeBridge.tsx:155`.

Verified before attesting: the bridge is query-gated behind `probeEnabled()`, renders no player-facing element, and passes the name into a `paravoxia.journeyRuntimeSnapshot.v1` diagnostic object consumed by evidence probes. It writes to no caption band, no audit band, no HUD, and no work order. It is **not a story surface**.

The §4 conclusion is unaffected, and its supporting claim is restated precisely: the typed name has exactly **one rendering consumer in shipped player-facing copy** (`VoyageLedger.tsx:184`, the voyage strangeness line at `storyScript.ts:125`), and **this run adds zero** — no printed name, no `{name}` substitution, no `UNREGISTERED DESIGNATION.` reuse. The A8 first-return remains unspent.

### §4 sign-off, restated for the closeout record

The canon auditor SIGNS OFF the §4 designation line `they asked for a designation. what i have is not one.` against frozen contract revision `draft-v5`. It preserves the A8 name payoff: nothing is printed, quoted, or attached; `UNREGISTERED DESIGNATION.` is not reused; retention is already shipped player-visible copy and A8's card is the name's first *return*, which remains unspent; and no locked question, including `worker9-reveal-timing`, is pre-empted. The binding condition is unchanged and is now carried in the contract itself: no artifact in this run may describe retention as *proven* by this line. The run's stop condition is cleared.

### Carried forward, non-blocking, not a condition of this attestation

`nonNegotiableCanon` item 3 still reads "The typed name is the A8 payoff: it is proven retained and never printed, quoted or attached here." The phrase "proven retained" is a wording residue that reads against the rewritten `name-retained` ledger entry in the same document. Read as a statement of author-level canon truth plus a prohibition on printing, it is correct; read as a claim about player evidence, it contradicts the binding condition. Suggested one-word repair at the next contract touch: "it is **held** retained and never printed, quoted or attached here." Non-blocking; the ledger entry governs.

### Disposition unchanged

`repair` — findings-routed, not blocking. The goal plot is structurally safe. The single highest-leverage fix is unchanged: protect ch8's two callbacks, which are today the only lines the runtime is permitted to truncate (L1) or discard (L3).

*Gate-format restatement of the addendum's revalidation attestation above
(orchestrator clerk note, 2026-08-11): Contract revision: `draft-v5`*
