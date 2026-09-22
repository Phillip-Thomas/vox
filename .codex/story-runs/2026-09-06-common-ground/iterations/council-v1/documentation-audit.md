# Common Ground — bounded documentation authority re-audit (pass 2, final)

Run `.codex/story-runs/2026-09-06-common-ground` · read-only · no build, no patch, no probe, no runtime pass · scope limited to the exact `implementation-diff.patch` (iteration 2) and the five patched documents

## Verdict: **APPROVE** (documentation-only direction approval)

Every defect the first pass called *blocking* (D1, D2) is now factually repaired in the files themselves, not merely hedged in a banner. D3, D7 and D8 are repaired as filed. D4 is correctly re-dispositioned against the actual signed text, not against the prior reviewer's inference. D5 and D6 are stated as required future preconditions in the exact places a future geometry signer will read. Bounded authorization is unchanged: no candidate, register, signature or owner-delegation artifact moved.

Two residual staleness items remain inside the patched Execution Plan; both are already covered by the new §0 supersession clause and neither is a machine-file misquotation. They are recorded below as non-blocking, not as a reopened cleanup.

---

## 1. Authorization envelope — unchanged (verified)

| Check | Result |
|---|---|
| Candidate identity | `candidateSha256 790b2894…87ae` — identical in `authority-patch-receipt.json`, `check-results.json`, `owner-story-decision.json` and all three signatures |
| Register identity | `decisionsSha256 017bafda…90fd` identical across chapter / score / cinematography signoffs and the owner decision |
| Signature set | Three exact directors, one candidate, one register; `directorSignoffsSha256 a3289ff1…` unchanged |
| Owner decision honesty | `authorityKind: standing-user-delegation`, `personallyReviewedByUser: false`, `runtimeMutationAuthorizedByThisDecision: false`, `publicationAuthorized: false`, `acceptedMissingEvidence: false` — unchanged, still refuses to fabricate personal review |
| Diff scope | Exactly the five documentation paths; 958 source files compared; `unexpectedRuntimeDrift: []`; no `src/**` file, no shipped string touched |
| Gates | `story:authority` 1094 pass, smoke pass, `validate-candidate --owner` 77 pass; `noAudiovisualOrRuntimePassClaim: true` |
| Ceilings | `runtimeStoryCeiling ch10-transit`, `releaseStoryCeiling ch4-arrival` — both unchanged by this patch |
| Locked unknowns | `w7744-return-cause` family still present and explicitly re-asserted as open in Bible ¶ and Exec §0 tail; no A5 spend, no A6 claim, no Worker 9 / third-consciousness / Maker escalation |

The iteration-2 patch changed only documentation text; the candidate's authority surface is byte-identical to the signed one. **Bounded authorization confirmed unchanged.**

*Stated limitation:* my toolset is read-only file access. I did not recompute SHA-256. What I verified is that the recorded hashes are mutually consistent and identical to the iteration-1 values, and that the changed-path set equals `documentationAllowedPaths`.

---

## 2. D1–D8 individual dispositions

**D1 — obsolete arrival-terminal/code claim. REPAIRED. Confirmed.**
`STORY.md:353-357` now reads "Current `storyDirector.ts::tickArrival` records `ch4Arrived` and calls `advanceToBeat('ch4-audit')`; there is no current `completeStory()` or TEMPORARY terminal branch there." Source agrees exactly: `storyDirector.ts:2299-2300` is `markMilestone(STORY_MILESTONES.ch4Arrived); advanceToBeat('ch4-audit');`, and `TEMPORARY`/`completeStory` do not occur in that file. The old title-block "TEMPORARY TERMINAL" paragraph is gone; the "?story=<beat> for EVERY beat" over-claim was correctly narrowed to "the historical first-act entries listed here" (accurate — `storyState.ts:736` shows deep-link params beyond that list). *Accept.*

**D2 — misquoted machine ceiling. REPAIRED. Confirmed.**
Bible §10 (`:1486-1491`) now: "**Status refreshed 2026-09-06** … through `ch10-transit` … The former July 15 `ch9-hearth` ceiling is superseded … **runtime:** `ch10-transit`". Exec Plan §13 (`:1660-1665`) now: "the July 15 core-path checkpoint through `ch9-hearth` is retained below as delivery lineage. The current `story-authority.json` records formal runtime ceiling `ch10-transit`". Both match `story-authority.json:7`. No false quotation of the machine file remains in the five patched docs. *Accept.*

**D3 — inherited grammar divergence. REPAIRED. Confirmed.**
Bible `:100-102`: "The historical rule already diverges from existing post-A4 emergent captions, which remain unchanged; no global voice correction is commissioned." Paired with the §8 amendment at `:1288-1291`, which now labels the blanket ban "Historical blanket rule" and scopes the `CG-D08` exception to new ch13 copy only. The divergence is acknowledged, no shipped copy is rewritten, and no additional speaker is created. *Accept.*

**D4 — sample/length caps. NOT A CONTRACT CONTRADICTION. I independently agree, on the signed text.**
I read the actual signed candidate ¶59 rather than the prior conclusion. It reads: "Storage is one typed, versioned, actor/world-scoped survey snapshot: **at most** two route slots …, 128 grounded samples **and** 120 world units per trace … **At capacity, stop honestly and offer the actual span or revision.**" The governing quantifier is *at most*, the conjunction is two independent maxima, and the contract already specifies the behaviour when one binds before the other — an honest stop with a revision offer, plus the standing "never silently decimate a tested corner." There is no predicate anywhere in the signed text promising that an arbitrary 120-unit trace fits inside 128 samples. The first pass read a conjunction of limits as a joint guarantee; that was an inference, and it is not what was signed.
Cinema confirms this independently and without prompting (`cinema-current-baseline.md:37`): "Both the 128-point and 120-unit caps must be obeyed independently. The measured winding examples reach the point cap sooner; that is a practical route-budget constraint, not permission to raise either cap, promise every 120-unit trace fits, or silently decimate player evidence." The Execution Plan now states the same thing in the pre-geometry paragraph (`:92-94`) with the explicit no-silent-relaxation clause. Caps unchanged, no errata needed, no signature disturbed. *Accept as filed; the earlier "internally infeasible" finding is withdrawn.*

**D5 — outer route class. CLARIFIED as required. Confirmed.**
Bible `:63-66`: "These are required future route classes: the continuous-reference outer route is **not yet established by measurement**. Failure to establish it reopens the bounded arena decision before scene geometry can be signed." Exec Plan `:89-90` and `:96-97` carry the matching statement and reopening condition. This preserves the honest negative from the geometry pass ("unestablished, not proof") while keeping both routes as the contracted design target — the correct distinction between a canon requirement and a measured fact. *Accept.*

**D6 — undefined witness predicate. CLARIFIED as an explicit precondition. Confirmed.**
Exec Plan `:90-91`: "Define the fixed reference and moving instrument socket endpoints/heights before evaluating their actual occlusion." This is stated *ahead of* the geometry signature and is exactly the right ordering: the tolerances in candidate ¶61 remain "candidate" values whose "exact feasibility remains for the scene contract," and the socket/height definition is now a named blocker on that contract rather than a silent gap. Correctly paired with `:94-96`, "Do not require the new unimplemented mechanic's interaction proof at that earlier boundary; verify it after signed implementation" — which honours the pre-geometry meaning you specified (existing physical paths and reference relations, not the unbuilt trace/refusal). *Accept.*

**D7 — receipt-only install. REPAIRED. Confirmed.**
Bible `:22-29` now separates the two things cleanly: "…already perform the station transaction and cell installation, **recording second-hearth restoration by receipt** … The current install consumes the cell and commits receipts; **it has no dedicated habitat-state change, caption or score acknowledgment.**" The future payoff is kept strictly in the direction section and in production order item 1 ("Give the real second-hearth install its bounded acknowledgment"). STORY.md's "installs it at Tidegarden's second hearth" is accurate as an interaction description and is no longer the only account. Present receipt and future payoff are now unambiguously distinct. *Accept.*

**D8 — source pointers and production identity. REPAIRED. Confirmed.**
`src/story/beats/definitions.ts` and `src/story/beats/registry.ts` are added to `runtimeEvidence` in **both** `story-authority.json:31-32` and the schema `const` block; all seven added paths exist on disk (`beats/definitions.ts`, `beats/metadata.generated.ts`, `beats/registry.ts`, `spaceStationStory.ts`, `stationReturnStory.ts`, `StationScreeningDriver.tsx`, `autopilot/primitives.ts`). `runtimeBeatAuthority: "src/story/storyState.ts"` is *correct as-is* — `storyState.ts:79-107` still authors the `StoryBeat` union and `:349` the ordered list; only metadata moved out. Retained production identity is now explicit rather than an apparent oversight: Bible `:1493-1496` "The machine map's older production-contract identity is intentionally retained until the new chapter is implemented and registered through its separate signed scene contract," echoed at Exec Plan `:1665-1666`. *Accept.*

---

## 3. New defects found in this exact diff

**No blocking defect.** Two non-blocking residues, both inside the Execution Plan and both already covered by the new §0 supersession clause. I record them for honesty; I do not recommend gating on them, and neither should trigger a broader old-canon pass.

- **R1 (minor, one line).** `PARAVOXIA_STORY_EXECUTION_PLAN.md:300` (gap register F01) still reads "typed state **now** continues from `ch4-audit` through `ch9-hearth` and `done`". The `ch9-hearth → done` adjacency is stale — `done` now follows `ch10-transit` (`storyState.ts:349-350`). Unlike D2 this is not a quotation of the machine file's ceiling, and §0's table supersedes it explicitly. Smallest fix, whenever F01 is next touched: "…through `ch10-transit` and `done`."
- **R2 (cosmetic).** `PARAVOXIA_STORY_EXECUTION_PLAN.md:224` lists implemented content "from `ch4-audit` through `ch9-hearth`" — accurate as a content enumeration, incomplete as a range. No repair required.
- **Out of scope, noted only:** `PARAVOXIA_EMERGENT_STORY_BATCH_PLAN.md:1746` still asserts the authority map records a `ch9-hearth` runtime ceiling. That file is lineage, is not among the five governing/patched docs, and is not authority over `story-authority.json`. Flagged, not commissioned.

Also verified clean in this diff: no shipped copy string changed; no `ch13` identifier exists anywhere in `main/src` (0 matches), so the "approved direction, not yet implemented" framing is literally true; STORY.md's demo-lock rewrite remains backed by the 2026-07-28 gate lift in `PARAVOXIA_DEMO_FOUNDATION_PLAN.md`; the `completeStory` reference surviving at `STORY.md:236` is still accurate (`emergentStoryDirector.ts:1490`, `storyState.ts:830`).

---

## 4. Preserved distinctions — all intact

- **Docs-only direction approval** vs **scene geometry / hardware / actual-code gates**: held throughout. Bible: "Runtime requires its own signed scene contract." Exec §0: "no runtime implementation or current audiovisual acceptance claimed by this documentation patch," and "Software frames are geometry diagnostics only; final headed hardware and supported-tier evidence remain required."
- **Pre-geometry means existing physical paths and reference relations**, not proof of the unbuilt mechanic — stated correctly and explicitly.
- **Reveal discipline**: nothing in the patch grants Worker 9 survival, the shared body, the third consciousness, W-7744's future motives, alliance or A5. W-7744's outcome remains `PASSAGE OBSERVED. MODEL INCOMPLETE.` — a bounded local tester, explicitly "not a network clearance, friendship, alliance, passenger invitation or awakening installed by Terra."
- **Both-readings integrity** of the approved direction: the reciprocal crossing reads as labour-coercion satire (an auditor forced to hold the other end of his own measurement) and as the AI's biography (a model conceding incompleteness after grounded evidence) without either reading collapsing, and the twist is never stated plainly.

---

## Summary

The goal plot is **structurally safe**. This iteration closes the two present-tense falsehoods that made the first pass a revise, acknowledges the inherited grammar divergence without touching a line of shipped copy, and converts D5/D6 from silent gaps into named preconditions that a future geometry signer must clear. D4 was a reviewer inference and the signed text — "at most … and … per trace," plus "at capacity, stop honestly" — does not carry the promise that was read into it; the caps stand unchanged and un-relaxed, with cinema's independent confirmation on record.

**Single highest-leverage remaining action (non-blocking): carry the same dated-supersession discipline into `PARAVOXIA_STORY_EXECUTION_PLAN.md:300` when F01 is next edited**, so the gap register's own "current truth" column stops disagreeing with §0 four hundred lines above it. Nothing else in this diff should hold the documentation pass.
