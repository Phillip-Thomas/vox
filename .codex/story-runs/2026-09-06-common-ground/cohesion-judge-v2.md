# Cohesion judge report — Common Ground, council-v2, iteration 3 (second independent pass)

**Verdict: approved (weighted 4.7485, unrounded).** This approves the bounded story-council *direction and documentation* only. It is not a scene-contract signature, not runtime acceptance, and not publication.

## Bindings verified

- Candidate `story-authority-candidate.md` SHA-256 `133d1dbe54a9f51e68d9fd67997042d1494059e30707a5da6c308d403cebc2fb`
- `canon-decision-register.json` SHA-256 `267ec0e8ecc8986c71b41a725e15467979704e8a6b4881bf3ab513730f391a4b`
- `director-signoffs.json` SHA-256 `8bffb4bebe40376427344d1f4fe5b07de7d041f4ea40216d177dcb3d9fb32edb` (chapter approve-with-notes, score approve, cinematography approve-with-notes; all three carry the identical candidate/register/arena/geometry hashes)
- `owner-story-decision.json` SHA-256 `4407d346ff7046085d7763e1f65d2d73d86ff54bc69aa7c407f267ba54f68577`, `authorityKind: standing-user-delegation`, `personallyReviewedByUser: false`, `runtimeMutationAuthorizedByThisDecision: false`, `publicationAuthorized: false`, `acceptedMissingEvidence: false`
- `owner-standing-authority.json` `3750caae92aa5a8cd809da5d6f921a800754db04f55f913435e26a054b1be338`; `arena-director-notes.json` `4659a4369e2d13a656f8d4278f45da2fd8be33d04fb07cc9d574501f7f45eee1`; `council-geometry-basis.json` `b7999bb589cfcf2d420af1f25f59780026c0ea7909a65b52d1f26fb2088ee55a`; `implementation-diff.patch` `4c661abb2a9b2414e7e310035fe9f626970c845092ada1cae12af2dee896821c`
- Current deterministic review is `check-results-v2.json` + `documentation-audit-v2.md` + `alignment-report-v2.md/json`. Root `check-results.json` (77/1094) is iteration-2 lineage and is not treated as current evidence.

## Shipped-truth spot checks (independent, read-only)

I re-verified rather than inherited: `main/story-authority.json` still reads `runtimeStoryCeiling: ch10-transit`, `releaseStoryCeiling: ch4-arrival`, order ending `ch10-transit → done`, and `w7744-return-cause` retained at `lockedOpenQuestions`. The v1 defect CG-JUDGE-001 is genuinely repaired: `PARAVOXIA_STORY_EXECUTION_PLAN.md:310` now reads "typed state now continues from `ch4-audit` through `ch10-transit` and `done`". The candidate's own present-tense claims ("the formal runtime ends at `ch10-transit` then `done`"; ch11/ch12 as source-grounded worktree facts outside the formal registry) match `inventory-open-issues.json` OI-3 and the machine authority. Zero `main/src` lines in the patch; 958 runtime hashes, zero drift; five-path cumulative diff reproduced exactly from `authority-before/`.

## Strongest throughline

The A4 audit fault → ch13 `MODEL INCOMPLETE` payoff, now carried by a *reversal of bodies*. In A4 the worker's model refuses Terra's observation; in ch13 his own instrument cannot complete a measurement without her walked passage, and hers cannot complete without the end he holds. The shipped A0→`ch4-arrival` spine is extended, not replaced: constrained feed → embodied agency → material perception → refusal and independent fault; the proposed chapter is reached only from an already restored hearth, so security enables the encounter instead of jeopardy forcing it.

## Weakest causal joint

Still the transition from *documented physical necessity* to *felt necessity*. The v2 packet closes the arithmetic half convincingly — the 18-unit common passage carries a contiguous 8-unit stretch outside the fixed plate's coverage (`council-geometry-basis.json` routeClassProof; `staged-geometry-qualification.md`: 31/73 points valid from H, max 10.01 < 12) — so W-7744's held reference is genuinely load-bearing rather than rhetorical. What remains unmeasured is whether a player *reads* that dependence in play. Terra's turn rests on two sparse lines (`i walked it. i thought that finished the proof.` / `i needed the end he held.`) whose comprehension has never been cold-read; the unchanged blind corpus `d0fe844959ccdbbcd07b8df568f659633c760dede3515d1ddcf565b94e35e53e` was deliberately not re-run against new text.

## Character table

| Presence | Desire | Opposition | Tactic → consequence | Belief before → after | Reveal level |
| --- | --- | --- | --- | --- | --- |
| Terra | A route whose limits she can rely on | Her own crossing supplies only one side; she cannot occupy the reference while moving | Demonstrate, revise, accept his held end, cross → earns a comparison she could not complete alone | "crossing finished the proof" → "i needed the end he held" | player-visible fact |
| W-7744 | A repeatable local measurement that preserves his restricted model | The living site exceeds his classifications; assertion is not evidence | Test, hold at a limit, maintain her reference, then test the final span himself | model sufficient → `LOCAL RECORD: PASSAGE OBSERVED. MODEL INCOMPLETE.` | visible action; interiority inferred only |
| Worker 9 / third consciousness | — | — | No voice, motif, counting device or bodily intervention | none asserted | author-only, withheld |

## Reveal ledger

KEEP OPEN: Makers, Terra authorship literalness, simulation status, third-consciousness form/mapping/persistence/grammar, Worker 9 reveal timing, greater-threat ontology, final-frame ontology, W-7744's later offworld/A5 recurrence and turn. CG-D03 answers only *this chapter's local recurrence* and explicitly keeps the `w7744-return-cause` family in the machine authority; I verified the family is still present. CG-D08's parenthesis grammar is a bounded new-chapter exception, not a speaker reassignment. No survival, shared-body or third-consciousness credit is taken anywhere in the packet. `ownerOnlyChoicesInferred: 0` is consistent with what I read.

## Agency / fallback table

| Window | Honest class |
| --- | --- |
| Revisit Origin | Player choice from a stable home; old record, not a summons |
| Walk/offer/revise the trace | Player action; revision cost-free, repeatable, prefix-preserving |
| W-7744's hold at a limit | Authored refusal with four distinct literal causes (range, solid, footing, vacancy) |
| Terra's crossing | Mandatory-for-completion, freely refusable; she may retreat or leave |
| Reciprocal far reference | Explicit F offer plus occupancy with stated hysteresis (1.25/0.6 in, 1.75/0.9 out) |
| Final commit | Physical arrival plus reciprocal proof only — "No timer, caption, sound, camera shot, gaze dwell, observation-ledger entry, timeout rescue or movie-only receipt grants it" |
| Movie mode | Must perform the real actions; timeout reports stuck; three cold no-rescue journeys still required |
| Score tail | ≤5 s live-only texture then the existing 4.5 s release; never a progression predicate; declared unimplemented |

The v2 "quiet continuous drawing" change (one standing objective, no per-sample prompt, chime or turn reward) is a real, targeted answer to the blind reader's SEVERITY 1 "HUD tells me where to stand" finding, scoped to ch13 only. The per-verb objective stack remains dense and the two new final objectives add to it; that risk is named, not measured.

## Audiovisual arc

Motif: the unresolved audit square is reprised only at actual Origin inspection, is denied any restart on temporary witness loss, and changes *spacing only* after real final arrival — no victory chord, alliance duet or coda. Silence carries the refused hold. Camera/lens/palette are deliberately non-inflationary: one player-owned 75° view, no new light, no forced look, no privileged renderer; A5 Light, A6 authorship and A7 conflicting lenses remain unspent. The v2 backed instrument improves visual causality specifically — one shared box governs render, collision and occlusion, with no invisible sector rule, and the held reference visibly lacks the backing. Honest limits: current software frames show world context with the worker body and restored core absent; the three offline score files decoded but were not listenable. Nothing heard or rendered is claimed.

## Governance and readiness

Precedence is machine-checked (validator 102/102, `story:authority` 1096, smoke pass) and the diff boundary equals `documentationAllowedPaths` exactly. Dissent is preserved and the six new arena routes each carry an exact recipient response with `accept`; no author closed its own note. Two governance blemishes are new-in-this-pass and low: `production-lock.json` still binds `documentationCandidateSha256 790b2894…` (the council-v1 candidate) because it was frozen at 04:15 before v2; and `dissent-register.md` remains a council-v1 document that does not carry the open scene objection `cg.scene.chapter-cinema.reciprocal`, which currently survives only inside a signature limitation field.

## Boundary finding

The production lock holds: `mutationBoundary: documentation-only`, zero `main/src` changes, zero runtime drift across 958 files, protected story/audio/rendering/camera/save/post-arrival runtime untouched, `publishAllowed: false`, release ceiling unchanged at `ch4-arrival`. `activeProduction` intentionally remains `2026-07-13-distance-between-fires`, which is correct: no new runtime claim is made. The head-cap and staged-pose qualifications are bounded CPU measurements of *proposed* apparatus and are treated here as scene-obligation context only — they are not scene approval, and the 2-unit E→H/H→E positioning legs are credited with nothing. Live world, edited terrain, day/night, hardware, tier, save, journey, AV and listening acceptance all remain open and unclaimed.
