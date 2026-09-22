## Common Ground — bounded documentation authority audit
Run `.codex/story-runs/2026-09-06-common-ground` · read-only · no build, no patch, no runtime pass

**Verdict: REVISE (narrow).** The direction, the authority chain and the lock discipline are sound and honest. The patch does *not* over-claim runtime, does not resolve a locked unknown, and does not rewrite history. It does, however, leave three factually false present-tense statements *inside the very files it patched*, which is exactly the drift (CG-C03) it was commissioned to close. Two of them are one-line repairs.

---

### 1. Authority / diff / lock check — PASS

| Check | Result |
|---|---|
| Three exact signatures | Chapter, Score (`approve`), Cinematography (`approve-with-notes`) — all on identical `candidateSha256 790b2894…` / `decisionsSha256 017bafda…` |
| Owner decision honesty | `personallyReviewedByUser: false`, `authorityKind: standing-user-delegation`, `runtimeMutationAuthorizedByThisDecision: false`, `publicationAuthorized: false`, `acceptedMissingEvidence: false` — correctly refuses to fabricate personal review |
| Diff scope | 5 changed paths == `documentationAllowedPaths` exactly; 958-file compare, `unexpectedRuntimeDrift: []`; no `src/**` or copy file touched (independently confirmed: no shipped string changed) |
| Gates | `story:authority` 1094 checks pass; smoke pass; `validate-candidate --owner` 77 checks |
| Manifest ↔ schema | In sync: both `snapshotDate 2026-09-06`, both carry the same 17-entry `runtimeEvidence`; all five added paths exist on disk |
| Locked unknowns | `w7744-return-cause` **retained** in `lockedOpenQuestions` (`story-authority.json:305`); all 11 locked keys intact; register `protectedUnresolved` retains later offworld/A5 recurrence, turn, Worker 9 reveal timing, third-consciousness family, Makers, simulation, final frame. **No accidental resolution.** |
| Reveal level | Bible's `Worker 9 remains conscious` is pre-existing author-only canon (§ lines 122, 306), not a new player-visible claim; no shipped caption asserts survival, shared body, third consciousness or W-7744's future motive |
| Ceilings | `runtimeStoryCeiling ch10-transit` (unchanged — it was already `ch10-transit` pre-patch), `releaseStoryCeiling ch4-arrival` unchanged in both manifest and schema const |
| Dissent | Preserved and non-self-closed; marker-mechanic thesis retired by its own author; no open blocking note |

*Limitation:* my tool set is read-only file access — I could not recompute SHA-256. Hash equality is accepted from `candidate-validation.json`, not re-derived here.

**Structural distinctions requested — all correct:**
- **ch10 formal vs ch11/ch12 sidecar:** verified in source. `StoryBeat` union ends `'ch10-transit' | 'done'` (`storyState.ts:107`); ch11/ch12 exist only as milestone namespaces (`stationReturnStory.ts:16-21`, `spaceStationStory.ts:30-38`). Docs say exactly this.
- **Live vs restored:** `installTidegardenBondedCell` consumes one `bonded_cell`, marks both receipts, and is idempotent (`ok:true, changed:false` on re-entry) — CG-D01's "no repeated transaction or completion transient" is true to source.
- **Story lane vs public release:** explicit in all three prose docs; STORY.md's rewritten demo-lock sentence is backed by real text (`PARAVOXIA_DEMO_FOUNDATION_PLAN.md:5-11`, 2026-07-28 gate lift).
- **Voice exception bounded to ch13:** scoped in the addendum and in the §8 amendment; no earlier copy altered.
- **Geometry:** candidate keeps arena/signatures/hardware as a future gate and does not require unimplemented interaction evidence — consistent with the one-route report. No approval of an exact arena is claimed anywhere in the patch.

---

### 2. Defects, ranked, with the smallest repair

**D1 — MAJOR. STORY.md still describes a runtime mechanism that no longer exists.**
Line 176: *"story completes (TEMPORARY — `ch4-audit` is the first contracted continuation, not the active build)"*; lines 353-357: *"Chapter 4 is TEMPORARILY terminal at the arrival — `tickArrival` ends in `completeStory()` behind a marked `// TEMPORARY` comment"*.
Shipped truth: `storyDirector.ts:2296-2300` — *"Arrival is now a real checkpoint, not the old demo terminal"* → `markMilestone(ch4Arrived); advanceToBeat('ch4-audit')`, unconditional. `completeStory` and `TEMPORARY` do not occur in `storyDirector.ts` at all. The new header's "the first-act guide below retains its historical release scope" hedge covers *scope*, not a false claim about a code path.
*Smallest repair:* replace both clauses with a dated line — "Historical: arrival was once terminal. Current source advances `ch4-arrival → ch4-audit` at `storyDirector.ts:2300`."

**D2 — MAJOR. Two patched documents misquote the machine authority they now point at.**
`PARAVOXIA_STORY_EXECUTION_PLAN.md:1655-1657`: *"`story-authority.json` records runtime ceiling `ch9-hearth`"* — it records `ch10-transit`, and did so **before** the patch too. `PARAVOXIA_STORY_BIBLE.md:1478-1482` (§10, titled "Current worktree and release truth"): *"every beat from the crawl through `ch9-hearth`… **runtime:** `ch9-hearth`"*. The new addenda claim to supersede "present-tense implementation ceilings", but a direct false quotation of a machine file is what a drift detector exists to prevent, and CG-C03's route text explicitly says "update exact affected source authority and continuation status after signature". CG-C03 is therefore only partly discharged.
*Smallest repair:* one dated superseded-pointer line under each of the two headings, correcting the quoted ceiling to `ch10-transit`.

**D3 — MEDIUM. The voice addendum understates the divergence it inherits.**
Bible addendum: *"The older blanket post-embodiment parenthesis ban remains dated lineage outside this explicit scope… does not rewrite earlier copy."* Read plainly, that implies pre-ch13 copy conforms. It does not: post-A4 shipped captions are overwhelmingly parenthetical — `emergentStoryDirector.ts:377-387`, `724-753`, `950-1023`, `1414-1487` (e.g. `'(one fire behind you. one fire here. home is the distance you can keep alive.)'`). CG-C02/VO-01 and the register's own `currentState` are honest about this; the shipped Bible sentence is the weak link.
*Smallest repair:* append one sentence — "The historical rule is already non-conformant with shipped post-A4 emergent captions, which are retained unchanged; no global voice pass is commissioned."

**D4 — MEDIUM. A signed numeric contract is internally infeasible.**
Candidate ¶59 / CG-D05: "128 grounded samples and 120 world units per trace" at "one world unit" default spacing. The independent probe measures 120 units → **139 samples**, over the 128 cap; effective maximum ≈105-110 units (`geometry-feasibility.md`, "Budget conflict"). Three directors signed the pair without errata, and the Execution Plan packet now cites the candidate as authority.
*Smallest repair:* an errata line in the §0 packet (and register note) recording the conflict as a known open scene-contract defect — raise points to ~150, lower the length budget, or widen spacing; silent decimation stays forbidden.

**D5 — MEDIUM. Canon states two route classes as settled; measurement establishes one.**
Bible addendum: *"choose a longer route he can repeat independently, or use a shorter bend… **Both routes are complete choices**."* The only independent geometry pass establishes Route A only; every budget-legal outer candidate broke the witness line (0/60 evaluated achieved zero breaks) and the report calls the negative "unestablished, not proof". The candidate's arena gate is correct; the *canon prose* drops the qualifier.
*Smallest repair:* add "the continuous-witness outer class is not yet established by measurement; failure to establish it reopens the bounded arena decision" to the Bible clause and the Exec Plan packet.

**D6 — MEDIUM. Exact tolerances specified for an undefined predicate.**
Candidate ¶61 fixes witness cylinder radii 1.25/1.75 and vertical tolerance 0.6/0.9, but never defines the witness line's **two endpoints or eye height** (geometry report, answer 4) — and every measured number changes if the reference is the worker's moving trace-end rather than a fixed tree-side reference.
*Smallest repair:* record endpoint + eye-height definition as a named scene-contract precondition ahead of any geometry signature.

**D7 — LOW. "Second-hearth restoration" is receipt-only.**
`installTidegardenBondedCell` marks `ch12-bonded-cell-installed` + `ch12-hearth-restored` and consumes the cell; there is **no** world, caption, audio or habitat-state change (matches `inventory-open-issues` GAP-01 / CG-C01). STORY.md "installs it at Tidegarden's second hearth" is fine as an interaction; the Bible's "already perform the station transaction and **second-hearth restoration**" reads as world consequence.
*Smallest repair:* "records second-hearth restoration by receipt; no world-state, caption or audio acknowledgment ships today."

**D8 — LOW. Source-pointer sync is half-done.**
`metadata.generated.ts` was added, but `beats/definitions.ts` (where authored beat data actually lives, per SA-02) and `beats/registry.ts` were not, while `runtimeBeatAuthority` still reads `src/story/storyState.ts` — which now only imports `BEAT_METADATA` from `beats/`. Separately, `activeProduction` and `ownerApprovedSceneContract.activePath` still point at the July `distance-between-fires` run (SA-01); the candidate *deliberately* froze production identity, but no patched document says so, so it reads as oversight.
*Smallest repair:* add `beats/definitions.ts` and `beats/registry.ts` to `runtimeEvidence` in **both** manifest and schema const, plus one line: "production identity intentionally retained until ch13 implementation."

---

### 3. Present source status vs approved future direction — accurate as filed

| Claim in patch | Verified against source |
|---|---|
| Formal registry → `ch10-transit`, then `done` | ✔ `storyState.ts:107`, `:349-350`, evidence chain complete |
| Station/return sidecar implemented, ch11/ch12 receipts | ✔ two source owners exist and ship the receipts |
| Movie stops inside the station | ✔ `StationScreeningDriver.tsx` phases end `look-around → done` after cell acquisition |
| Ch12 install has no authored payoff | ✔ no `showCaption` / score cue on install |
| Common Ground is direction only | ✔ zero runtime files changed; no ch13 identifier exists in `src/**` |
| Public ceiling `ch4-arrival` unchanged | ✔ manifest + schema |

No old history, no shipped copy, and no player-world consequence is rewritten by this patch. The A5-Light reservation, the A6 collaboration boundary, and the ch10 non-interior reveal record are all explicitly protected in the new text.

---

### 4. Summary

The goal plot is **structurally safe**: nothing in this patch escalates a reveal, spends A5, converts W-7744 into an ally, resolves `w7744-return-cause` beyond the bounded local reinspection, or lets a timer stand in for a thematic event. The candidate's causal spine (secure home → voluntary revisit → demonstrated route → *required* reciprocal reference → his own independent test → `MODEL INCOMPLETE.`) survives both readings, and the ledgered decisions match the register.

**Single highest-leverage fix: finish CG-C03 inside the three prose files you already patched — correct STORY.md's dead `completeStory()`/TEMPORARY passage (D1) and the two `ch9-hearth` misquotations of `story-authority.json` (D2).** Until those land, the patch's own current-truth banners are contradicted a few hundred lines below them, which is precisely the failure mode the snapshot exists to prevent. D4-D6 should be recorded as open scene-contract preconditions before any geometry signature, but they do not block this documentation pass.
