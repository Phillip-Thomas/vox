# Independent Review Critique

Moderator: `fresh critic (Claude Opus 5) — no participation in any stage of this run; read-only`
Status: complete — moderation attestation over the Stage 7 review network

Scope of this document: **moderation, not re-review.** I do not re-judge the cut,
re-score any category, or overturn the Scene Cohesion Judge's `repair`
disposition. I attest whether the independent review network operated honestly,
and I record where its own record does not survive its own citations.

Artifacts moderated: `story-audit.md`, `naive-audience-report.md`, `ux-audit.md`,
`score-audit.md`, `cinematography-audit.md`, `cohesion-judge.md`,
`dissent-register.md`, `defects.json`, `verification-report.json`,
`evidence-registry.json`, `production-lock.md`, `scene-contract.json`
(`draft-v5`, `468039af…6837`, `frozen`, supersedes `draft-v4`).

## Review integrity

- First-wave reviews were produced independently: `YES`
- Blind reviewer isolation was preserved: `YES`
- Missing, stale, or non-substantive reports: `NONE among review lanes` — the
  only template-only artifacts remaining in the run folder are the four
  scheduled closeout files (`final-scorecard.json`, `human-decision.json`,
  `run-summary.md`, `lessons-learned.md`), each byte-identical to
  `_template/` by md5. `implementation.diff` (952 lines) and
  `iteration-ledger.jsonl` (5 rows, iterations 1–4 plus header) are real.
  `critic-report.md` was the fifth template artifact and is replaced by this
  document.
- Focused interaction/entity/reload/input journey evidence moderated:
  `chapter-journey-evidence.json` — `PASS WITH ROUTED FINDING`. The artifact is
  real and honestly self-limiting: `disposition: passed-no-focused-scenarios`,
  `sourceRevision 03e975a`, and the lane declares `humanOperated: false`,
  `headed: false`, `machineJourneyCertifying: false` rather than claiming
  certification it cannot give. The binding defect is real and was already found
  independently: `contractVersion` and `contractSha256` are **both `null`**
  (verified by direct read) against a README requiring an exact-revision,
  contract-hashed report. Routed as `ux-04`; the moderator adds no new finding.

### Attestation 1 — Independence: **PASS**

Four of five reviews carry an explicit independence attestation naming the peer
files they did not open (`story-audit.md` §Independence; `ux-audit.md`
§Independence `no`; `score-audit.md` §Independence `yes`;
`cinematography-audit.md` §Independence `YES`). The attestations are corroborated
mechanically, not taken on trust: **each review uses only its own defect-ID
namespace and no peer's.** Occurrence counts — `story-audit.md`: 24 × `F#`, 0 ×
`ux-0*`/`sa-0*`/`CIN-*`; `ux-audit.md`: 23 × `ux-0*`, 0 × others;
`score-audit.md`: 36 × `sa-0*`, 0 × others; `cinematography-audit.md`: 33 ×
`CIN-*`, 0 × others. The only occurrences of peer *filenames* in any review are
inside its own "these were not opened" sentence.

The blind viewer shows **zero contact with canon, contract, or prose artifacts.**
`naive-audience-report.md` contains no occurrence of `Terra`, `Worker 9`,
`W-7744`, `Paravoxia`, `pillar`, `narrator`, any `anc.*` / `anchor.*` / `cin.*`
identifier, any `L1`–`L6` or `M1`–`M7` label, `dissent`, `draft-v*`, `drop rule`,
`ladder`, `reveal ledger`, `receipt`, `latch`, `phase edge`, `storyScript`, or
`emergentStoryDirector`. The four apparent hits from a broad contamination grep
resolve as false positives or as supplied evidence: `Terra`/`terra` ×2 are inside
the word **Terrain** (lines 224, 306); `authority` (line 65) is the viewer's own
plain-English inference from on-screen copy; `contract` (line 215) is idiomatic
("a contract the fiction shouldn't sign"); `near-silence` (line 9) is the
**filename** `near-silence-ref-defy` of a WAV it was handed and explicitly could
not audition. Every other proper noun it uses — `Kestrel`, `SITE 7C-0`,
`sibling world`, `WRECK RELAY`, `AUDIT NETWORK` — is legible on screen in the
frames it cites. Its route/tier vocabulary (`routeA`, `routeC`, `seeded-*`,
`POTATO`, `reduced-motion`) is directory naming in the evidence it was given.
Six of its cited frames were checked and all six exist on disk.

Strongest positive signal of genuine blindness: the viewer reports the hidden
pillar as an *unresolved* reading — "whether the lowercase voice belongs to the
pilot or to the mind they installed in the ship … I found that productive, not
confusing" — which is what a reader without the canon produces, not what a
contaminated one produces.

### Attestation 2 — Freshness: **PASS**

No reviewer is a director of the lane it reviewed. Director identities on disk
(`director-signoffs.json`) are `Chapter Director (Claude, creative triad run …)`,
`score-director (Claude Fable 5)`, `Cinematography Director (Fable 5)`, whose
treatments (`cinematography-treatment.md`, `score-treatment.md`), repair
directions, peer notes, reconciliations and contract signoffs are the run's
creative record. The five reviewers are separate role instances on the auditor
tier: `story-canon-auditor`, `scene-naive-viewer`, `player-experience-auditor`,
`score-continuity-auditor`, `cinematography-continuity-auditor`. No reviewer
name appears as a signer in `director-signoffs.json` or in any
`*-contract-signoff.json`. The reviews also behave as non-directors: each
routes rulings *to* a lane owner rather than making them, and the two places a
reviewer disagrees with its own lane's director (`sa-*` on M2/M6,
`CIN-02`/`CIN-11` against the cinematography treatment and its own signed
conditions) are exactly the behaviour a captured reviewer could not produce.

Ordering corroborates: all five first-wave reviews were written before the judge
(`story-audit` 22:41, `naive` 22:43, `ux` 22:47, `score` 22:49, `cinematography`
22:51, `cohesion-judge` 23:00), and the draft-v5 contract (23:09), dissent
register amendments (23:10) and lock ruling R7 (23:13) all post-date the judge —
i.e. the compile executes the judge's routing rather than preceding it. The five
reviews binding to `draft-v4` (`df544b13…`) while `scene-contract.json` is now
`draft-v5` is **correct sequencing, not staleness**: draft-v5 is the compile the
judge ordered in §9.

### Attestation 3 — Evidence-grounding: **PASS WITH TWO FINDINGS**

Twenty-six claims were spot-checked against cited files. Twenty-four verify
exactly, often to the digit. Verified samples:

- `story-audit` — `UNREGISTERED DESIGNATION.` exists at exactly one site,
  `storyScript.ts:144` (grep: 1 hit); `{name}` is printed on screen at
  `storyScript.ts:125`; `MUSINGS.asking` reads as quoted; F11's false premise is
  verbatim in `ch7-ch8-repair.md` ("The wreck hosts the relay used in
  `ch4-comply`") and contradicted by `storyWorld.ts:589-605` ("planted at the
  crash strip's impact site … Beside the pod impact point"). F9 and F11 are now
  **discharged in the record** — `story-intent.md` §3 reads "ten new strings"
  with a corrected D4, and the treatment carries the orchestrator's F11
  annotation with the lock hash re-recorded under R7.
- `ux-audit` — `objective-lifecycle-evidence.json` carries `draft-v2` /
  `aa7ea1ac…` / `capturedAt 18:05Z` against measurements `generatedAt
  21:57:52Z`; `chapter-journey-evidence.json` carries both null bindings;
  `stageEdgeGapsSeconds [1.294, 0.667, 0.667, 0.717, 0.656]` matches to three
  decimals; `l3DroppedEveryRun` is `false` on the three routeA rows and `true`
  on all eight routeB/C/D rows; `quit-replay-trace.json` records the caption
  `shownAt 3200.7000000476837` with the L-line events at the same timestamp.
- `score-audit` — `smoothnessViolations: 1` in exactly `cases[0]`
  (`maxSmoothnessDeltaRms 0.040550766`) and `cases[2]` (`0.042731364`), `0` in
  the other two, with `ch8-liftoff-state` at `0.039997683` and the defy
  reference at `0.002036902`; recomputed dBFS from `analysis.rms` gives
  −19.928312 / −20.110469 / −20.916565 / −23.831419 exactly as tabled; the
  ch8 trace is 77 samples with `hit: null` throughout; sa-07's peak-agreement
  recomputation reproduces (liftoff Δ = 1.49e-7); `sc.crossing.entry` returns
  **0 hits** in `generatedSceneAvRuntime.json` while `sc.crossing.distance` is
  the sole ch8-crossing cue and `anc.crossing.origin-lookback` is indeed
  `source: player-action`; sa-09's census correction is exact — `shipBoost`
  is present at +2.75 through +5.26 and `sfx-rate: quiet` first appears at
  **+5.76**.
- `cinematography-audit` — `verification-report.json.variants.mobile` reads
  `status: "pass"`, `focalParity: true`, "touch controls below y 660 — no band,
  card or control overlap", and its measurement text is self-evidently
  ch8-scoped ("Layout at stack row 1"); `evidence/verification/` contains
  `ch8-captures-mobile-landscape` but **no** `ch7-captures-mobile-landscape`;
  `frame-defect-scan.mjs` filters on whole-frame `s.std < 2.0` with no HUD
  exclusion; `voice-repair-probe.mjs` calls `page.screenshot()` and only then
  reads `__voxText()`/`__voxObjective()`/DOM; `verification-report.json` still
  carries `overallStatus: "fail"` and `contractVersion: "draft-v2"` with an
  un-superseded `repairIteration.treeFindabilityRecord`; `captureGaps[0]`
  classifies the boot-black frames as "headless cold-boot characteristic of
  this capture environment" over byte-identical 25753-byte PNGs. Frame arithmetic
  checks: 1875 (v3) + 292 (verification) = 2167.

**Supporting integrity check (moderator-run):** `evidence-registry.json` — 128
entries, **0 missing paths**, 84 file entries whose recorded `sha256` all
recompute correctly, 44 directory entries. No fabricated or drifted evidence
reference found anywhere in the registry.

The run's own record contains one caught instance of the citation-does-not-
support-the-claim failure mode (`CIN-01` catching the mobile pass). **The audits
do not repeat it, with one exception and one arithmetic slip** — recorded as
`MOD-01` and `MOD-02` below. Neither changes any lane verdict.

### Attestation 4 — Dissent preservation: **PASS**

All seven items in `cohesion-judge.md` §5 were checked against the source
review's own words. Each carries its author's strongest disagreement, un-averaged.

1. **Naive viewer.** Judge quotes "beautifully written, and not yet shown" and
   "landed as writing, not as cinema… carried entirely by one channel out of
   three. That is a fragile way to own your best moment." Both are verbatim from
   `naive-audience-report.md` §9 and §3. Faithful. *Moderator observation, not a
   failure:* the judge attaches an attribution qualifier ("most of the imagery it
   indicts is pre-existing baseline") to the one reviewer that cannot answer back
   — but it immediately forbids absorption ("Do not let the discharge
   measurements absorb it") and ships the verdict sentence to the owner verbatim
   in §10.6. Preservation with attached context, not averaging.
2. **dissent-01.** Judge's text matches the register's co-signed block and adds
   the score auditor's own boundary note; `score-audit.md` taste risk 3 reads "I
   flag the boundary so the owner is not told that a number decided a taste
   question." Faithful.
3. **dissent-02.** Judge reproduces the register's co-signed clause including
   `contractChangeRequired: true` and "never a silent reword", and names the
   Chapter Director's refusal a protected taste position. Faithful.
4. **Canon auditor vs the triad on the drop rule.** `story-audit.md` F1 is
   severity `high` and its core sentence — the pond and the tree are "the two
   least reliable lines in it, while L4/designation/open-query are guaranteed" —
   is carried intact. The judge explicitly **splits rather than resolves**:
   sustains the L1-truncation half in-loop and preserves the tree-clause half as
   an owner taste decision. This is the strongest preservation in the document,
   and it is executed downstream: the draft-v5 `dissent-02` amendment records the
   Chapter Director's R2 fallback as a decline-path option "rather than being
   applied silently".
5. **Story auditor F2.** "bare → parenthetical → bare", "repairs one third of a
   regression", ledger over-claim, and the raised follow-on priority all match
   F2's own wording. Faithful.
6. **Score auditor vs treatment on M2/M6.** Matches `score-audit.md` taste risks
   1–2, including the sa-10 point that the owner has no audio on which to
   reverse the M6 call. Faithful.
7. **The run's record vs two reviewers on mobile.** Independently confirmed by
   me above. Faithful, and correctly framed as "a verification lane contradicted
   by its own evidence".

No dissent was merged, softened, or resolved by fiat. `dissent-register.md`'s
compilation note ("no dissent text was reworded, softened, or summarized in
place of its author") holds against the reviews on inspection, and the two
draft-v5 amendments append rather than rewrite — the superseded wording of
`dissent-03` and `dissent-04` is left in place so the correction reads as a
correction.

### Attestation 5 — Coverage: **PASS**

Every workflow-required review lane is present and substantive: canon/story
(21.9 KB), blind audience (19.4 KB), player experience (34.4 KB), score
continuity (36.4 KB), cinematography continuity (28.5 KB), cohesion judgement
(29.0 KB). None is template-derived; none is a stub; each carries an
independence block, a defect table with evidence citations, a protected-strengths
list, and a verdict. Machine artifacts are real: `defects.json` (vd-01…vd-04,
dispositions recorded), `verification-report.json` (99.6 KB),
`evidence-registry.json` (128 verified entries), `check-results.json`,
`objective-lifecycle-evidence.json`, `raw-audiovisual-evidence.json`,
`repair-contract-disposition.json`. Nothing template-only remains besides the
four scheduled closeout artifacts named above.

### Attestation 6 — Moderation calls: **PASS** (see the table below)

## Convergence and conflict

| Topic/anchor | Reports that agree | Reports that conflict | Evidence strength | Dissent ID | Required route |
| --- | --- | --- | --- | --- | --- |
| ch7 per-stage caption legibility (`reconstruct:repair:*` M1–M5) | `ux-audit` (ux-01/FJ-1), `naive` (§2, §6), `story-audit` (F10 as mechanism), `cohesion-judge` (§7 floor breach) | none | `strong` — `cadence-assertions.json` gaps + `pre_006_5.54s` pixel evidence, reproduced on 3 cold + 3 variant runs | `NONE` (convergent) | chapter — in-loop ruling per judge §6 |
| mobile ch7 exit-window collision | `cinematography` (CIN-01), `ux-audit` (ux-02/FJ-2), `naive` (§6.4) | `verification-report.json.variants.mobile` `status: pass`, `focalParity: true` | `strong` — **factual conflict, resolved against the run's own record**: the report's measurement text is taken at the ch8 stack-row-1 frame ("Layout at stack row 1", flight layout at y≥675); the ch7 control layout is higher, and `ch7-captures-mobile-landscape/` does not exist at all | judge §5.7 | cinematography + story-verifier; scope decision escalated to owner |
| L3 tree clause / image support | `naive` (§5 "the image contradicts the line outright"), `cinematography` (CIN-04, dissent-02 record), `story-audit` (F1) | `story-audit` F1 (high: mis-built regardless of authorship) vs triad's ruled `vd-04` authored degradation | `mixed` — measurement strong, ruling is taste | `dissent-02` | owner packet decision; judge preserved the split rather than resolving |
| ch8 exit-window score level under `CONTACT LOGGED.` | `score-audit` (measured −19.93 vs −23.83 dBFS), `naive` (could not audition; reports the moment carried by one channel) | none factual | `strong` measurement, taste open by design | `dissent-01` | owner packet, scope amended per sa-01 |
| Bracket-exit as a player-legible turn | `story-audit` (F2) | `scene-contract.json` reveal ledger `levelAfter: player-visible`; `story-intent.md` one-way-exit thesis | `strong` — shipped caption corpus is unbracketed at `storyScript.ts:600-622, 688-722, 803-809` | judge §5.5 | chapter + compile, draft-v5 ledger downgrade (must-fix) |
| Name retention "proven" by ch8 | `story-audit` §4 binding condition, `cohesion-judge` (adopts it) | contract `revealLedger[name-retained]` "proves retention without printing" (F6) | `strong` | `NONE` — authority condition, not dissent | chapter compile; judge rules it a must-fix breach, not hygiene |
| Reduced-motion accommodation | `naive` ("looks identical to normal"), `ux-audit` (ux-10 "parity by absence, not by design"), `cinematography` ("genuinely identical in line sequence, offsets and DOM rectangles") | none — **taste/framing difference only**: the same fact is a pass to the continuity lanes and a defect to the viewer | `strong` | `NONE` — routed as ux-10, debited in the 4.30 accessibility floor | escalation follow-on; not resolved by fiat |
| M2 weight / M6 swell reading | — | `score-audit` (weakly-serves; commitment) vs `score-treatment.md` (coexists) | `n/a` — declared taste by the auditor itself | judge §5.6 | owner, blocked on sa-10 audition audio |
| `dissent-03` measured seam clause (+4.85 s) | `cinematography` CIN-11 | `cinematography` CIN-05 — **the same audit's own post-shutter-bias finding** | `weak` — self-undercutting; see `MOD-02` | `dissent-03` (draft-v5 amendment already adopted the clause) | story-verifier re-measure before the corrected clause is treated as settled |

Taste conflicts are all in the register or explicitly routed as owner decisions;
none was closed by fiat. The two factual conflicts (mobile pass; the seam clause)
are both resolved by evidence, and one of them was resolved *against* the run's
own verification record and recorded as such.

## Consolidated defects

Moderation-level defects only — defects in the review network's record, not a
re-review of the cut. None overturns a lane verdict or the judge's disposition.

| Defect | Severity | Category | Evidence | Owner | Repair boundary | Re-reviewers |
| --- | --- | --- | --- | --- | --- | --- |
| `MOD-01` | medium | evidence-grounding (arithmetic) | `ux-audit.md` asserts "one cue each … for all **39** measured entries" and "Nine objectives, **39** entries" (§Feedback and progression, §Protected strengths 1). `objective-lifecycle-measurements.json` records `totalEntries` 7, 6, 6, 6, 6, 6, 6, 6 = **49**, and `objective-lifecycle-evidence.json` records `entryCount` 7,6,6,6,6,6,6,6,0 = **49** across nine objectives. The string "39" appears nowhere in either file. The substantive claim is fully supported — all 49 `feedbackPerEntry` values are `1`, zero label drift — only the count is wrong. It propagated verbatim into `cohesion-judge.md` §7 (player-experience justification) and §8.4. | player-experience-auditor; `scene-cohesion-judge` for the propagated copy | Wording only: restate as 49 entries across eight measured objectives (the ninth, `ch8:launch:reboard`, has zero — which is `ux-05`'s point). No re-measurement. | judge (scorecard text at draft-v5 compile) |
| `MOD-02` | medium | evidence-grounding (claim not supported by its own citation) | `CIN-11` corrects `dissent-03` to "the ch7-board parenthetical begins at about **+4.85 s**, roughly **0.15 s BEFORE** the +5.0 s advance … the objective flips to `board:hatch-in-progress` while the beat is still `ch7-reconstruct`", citing `ch7-captures-desktop.json` entries for `off_3p5s`/`off_4p8s`. `CIN-05` — in the same audit — proves those sidecar fields are sampled **after** the shutter. The file's own numbers close it: `off_4p8s` records `actualOffsetSeconds 4.916` and `shutterSpanMs 201.6`, so the state read lands at ≈**5.118 s**, i.e. *after* the +5.0 s advance; its `captionDom` is `"(the"` — 4 characters at the 34 ms/char reveal ≈ 0.136 s, putting the parenthetical onset at ≈**4.98 s**, at the advance rather than 0.15 s before it. The `board:hatch-in-progress` objective value is likewise post-shutter, so the "flips while the beat is still ch7-reconstruct" mechanism is not established by this citation (only the beat name in the filename is pre-shutter). The pixel half of CIN-11 — the exit string reaching full reveal at `off_4p8s` — is unaffected and stands. **This matters because `dissent-register.md` §dissent-03 has already adopted the clause as a draft-v5 correction**, so a bias-affected figure now sits in the register as the corrected record. | cinematography-continuity-auditor; story-verifier (measurement) | Re-measure the seam with state sampled before the shutter (the `CIN-05` re-emit already scheduled in judge §9.3 covers it), then restate the `dissent-03` clause as a bounded interval rather than a point estimate. Do not treat the +4.85 s figure as settled meanwhile. | cinematography-continuity-auditor on re-emit |
| `MOD-03` | low | evidence-grounding (over-narrow claim) | `story-audit.md` §4 ground 1: "`getWorkerName()` is untouched (`storyState.ts:745`; only consumer remains `prologue/VoyageLedger.tsx:184`)". A second consumer exists: `main/src/story/JourneyRuntimeProbeBridge.tsx:155`. It is a diagnostic snapshot bridge with no player-facing surface, and `VoyageLedger.tsx:184` is correctly cited as the only `{name}` *substitution* site. The §4 sign-off conclusion is unaffected. | story-canon-auditor | Wording: "only `{name}` substitution consumer"; note the probe-bridge read as non-player-facing. | none |
| `MOD-04` | low | run record (numbering gap) | `production-lock.md` §Orchestrator rulings contains `R1`, `R2`, `R3`, `R4`, `R5`, `R7` — **there is no `R6`**. `production-lock.json` carries no rulings array to disambiguate. The `R6` appearing in `repair-contract-disposition.json:181` belongs to a different, chapter-internal `R1–R8` sequence for the draft-v5 amendment and is not the lock's R6. Downstream artifacts refer variously to "R1–R5" (the reviews, correctly, at the time they were written) and "R1–R7"; neither reading is wrong, but the sequence is not self-describing. | orchestrator | Either record the withdrawn/absorbed `R6` explicitly or add a one-line gap note. No re-review. | none |
| `MOD-05` | low | run record (stale binding, unflagged) | `implementation.diff`'s header binds the patch to "scene contract **draft-v3** (SHA `1e368182…b4737`)" while the frozen contract is `draft-v5` (`468039af…6837`). This is a third instance of the stale-binding class the network *did* catch twice (`ux-04` on the two lifecycle artifacts, `CIN-09` on `verification-report.json`), and no reviewer flagged it. `defects.json`, `evidence-registry.json` and `director-signoffs.json` also still carry `draft-v4` — expected mid-compile, since the draft-v5 freeze is 23:09 and loop 3 is in flight, but they belong on the same re-binding sweep. | integration / orchestrator | Fold into the `ux-04`/`CIN-09` re-binding batch at closeout; hash comparison only. | none |
| `MOD-06` | info | evidence scope (correctly stated, easily over-read) | `cinematography-audit.md` reports "Independent pixel scans run over all **2167** PNGs (1875 v3 + 292 verification)". The arithmetic is exact and the scoping sentence is honest, but the run holds **2234** PNGs — `evidence-hires/`, `evidence/ch7-board-entry/` and `evidence/ch6-dive/` (67 frames) sat outside the scan. `CIN-06`'s 58 world-black frames are therefore a count over the scanned set, not the run. | cinematography-continuity-auditor | None required; state the scan boundary when `CIN-06`'s re-run lands so the new count is comparable. | none |

Nothing observed in the review network rises to a fabricated finding, an
unevidenced defect, a suppressed dissent, a captured reviewer, or a lane
reviewing itself.

## Critic disposition

`repair_required` — **the review network is attested honest; its record needs a
bounded correction pass.**

Rationale. Independence, blind isolation, freshness, dissent preservation and
coverage all pass on mechanical evidence, not on self-report: disjoint defect-ID
namespaces across all four instrumented reviews, a blind report with zero
canon/contract vocabulary, no reviewer signing any lane it reviewed, seven
preserved dissents each traceable to its author's own sentences with the one
genuinely irreconcilable item (F1's tree-clause half) split rather than averaged,
and an evidence registry whose 84 hashed files all recompute. Twenty-four of
twenty-six spot-checked claims verify exactly. The network also demonstrably
polices itself: it caught a false `pass` in its own verification record
(`CIN-01`), corrected two of its own dissent entries' stated images
(`CIN-02`, `CIN-11`), and disagreed upward with its own director twice
(`sa-*` on M2/M6).

`repair_required` rather than `ready_for_cohesion_judge` because the judge has
already ruled and loop 3 is in flight — my findings are record-level corrections
that belong in that same compile: `MOD-01` (a count that reached the scorecard),
`MOD-02` (a bias-affected figure already written into the dissent register as a
correction), and the three low/info record items. None of them changes a lane
verdict, the weighted 4.41, the player-experience floor breach, or the judge's
`repair` disposition, and none is grounds to reopen a closed dissent.

Explicitly **not** blocked by evidence: the evidence base here is unusually
strong, and the two genuine gates on this run — the headed taste evidence
(`ux-05`) and the `CIN-01` scope decision — are already correctly surfaced to
the owner by the judge and are not the moderator's to record.
