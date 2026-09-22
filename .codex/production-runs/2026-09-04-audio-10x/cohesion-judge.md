# Scene Cohesion Judge — Stage 1 (bed timbre + mastering)

Judge: `scene-cohesion-judge (Claude Fable 5.1)`, 2026-09-05T05:28-04:00
Status: judged
Contract revision: `draft-v2` sha256 `384120dc…9a6d`
Run profile: `paravoxia-creative-chapter@v1` (4.75 weighted / 4.30 floor)

## 1. Disposition

**route-repair** — weighted **4.60**, floor 4.30 (`performance_and_implementation_fidelity`).
Not blocked: every filed report is fresh, independent and bound to the same contract sha
and source revision. Not release: only the headed owner audition can approve timbre,
loudness, width or feel.

## 2. Verdict

Stage 1 is the shipped soundtrack played on a better instrument — same harmony, same
sections, bare and colour eras provably untouched, six shipped clicks removed — but it does
not yet deliver the contracted BLOOM window, its night bed sits over band, and the
contracted audio-thread cost is asserted rather than measured.

## 3. Evidence completeness

- Contract draft-v2, three signatures, same revision: PASS.
- Dissent register and note graph: PASS (one preserved joint dissent).
- Mechanical proof: PASS — verifier re-rendered full, lean and no-glue; independent
  ebur128 agrees 12/12 (`verification-report.json`).
- Blind report: PASS with declared limit (signal analysis, not listening; set order withheld).
- Score audit: PASS-WITH-DEFECTS, read-only, live source checked.
- Cinematography and player-experience audits skipped: **acceptable.** `implementation.diff`
  touches only `main/src/audio/**`, soak/probe tools and tests; no camera, HUD, objective,
  marker, copy or feedback term moves; skip recorded in ledger iteration 3. Both become
  mandatory at Stage 3 (eleven call sites) and Stage 4 (`feedbackCues.ts`). The story-audit
  skip is *unrecorded* (D14); its era-gate concern is covered by the score audit.

## 4. Combined experience

- **One event.** The only authored event is the fidelity ladder: bare → colour identical to
  the sample (fingerprint parity; spectrograms identical for the first 60 s of
  `era-transition`); at material/alive the bed gains body (+4 dB at 120–300 Hz), air, width,
  and its sub goes mono. Sound is rendering; the awakening earns its weight.
- **Same music, better built.** Harmony brain, arrangement, moods and transport untouched;
  voices 4–5 realise partials the brain already published; retune-not-swap glide kept;
  SYMPHONY LAW clean (every new rail a named `rampParamAt` slew). Blind: "same piece." No wrong notes introduced; smoothness 0/0/0 before and after; the shipped
  clicks at 5.75, 52.57, 86.30, 108.54, 126.06 and 166.55 s are gone.
- **Not yet one event.** The peak gesture is absent: BLOOM short-term −16.9…−18.9 against
  −14 ±1 (D1). Night bed +0.5 LU over band (D4). Colour inaudibility is proven to era 0.35
  and holds by construction to 0.38, not 0.5; say so (D9).

## 5. Rulings

**D1 — BLOOM −14 unmet.** *A Stage 2 dependency requiring a contract amendment (draft-v3);
not a Stage 1 patch, not a retarget.* The builder's mechanism is correct (safety compressor
−20 dB / 8:1 / 30 dB knee acts on everything above −35 dBFS; LRA 6.88 → 3.26 corroborates).
The score auditor is also correct that Stage 2 as written cannot deliver it: the treatment
leaves the compressor in the music path and adds a limiter that can only subtract.
Retarget refused: −14 short-term is an explicit owner decision
(`owner-2026-09-04-loudness-minus18-lufs-minus1-dbtp`). Stage 1 patch refused: the
compressor *is* the mastering tail Stage 2 owns; fixing it twice means two audition deltas,
and any retune moves the bare era (bare peaks at −25 dBTP sit inside the knee), so the
bare-era hash must be re-baselined in the same edit. Draft-v3 terms: move BLOOM to Stage 2
acceptance; authorise Stage 2 to retune or replace the safety compressor with the limiter
change; restate the bare-era regression as "identical except the mastering tail" with a
newly pinned before hash. Taste is delegated, so the triad may sign; record it in
`human-decision.json`. Until signed, D1 stays open-high.

**D2 — lean hears three chord tones.** Low. The contract's `performancePlan` specifies three
lean voices; three is the *shipped* voice count, so mobile hears the pre-Stage-1 chord
realisation; the verifier rendered lean (−19.85 LUFS, in band). Residual is audition taste.

**D3 — ms/frame missing.** Medium, Integration. Stage 1's own term is `score:fps ≥ 60` (met,
60.39); the 1.5/3 ms and 4× throttle terms are run-wide — but Stage 1 introduced a
measured 1.7× DSP cost and must be independently shippable, so measure in this loop.

**D4 — night bed −18.99.** Medium, Score Director. The term is unconditional; "met on
daylight" narrows it. Era-gated night trim, or a signed amendment naming daylight. Close
before Stage 2's before-baseline is pinned, or Stage 2's combined −18 ±1.5 inherits it.

**Streamed loops / drone bank (D13).** Not a Stage 1 contract defect: the contract's Stage 1
text omits the retirement; only the treatment carries it, tied to the audition. Low;
decided at the audition, folded into draft-v3.

**1-LSB wording (D12).** The verifier is right: "max Δ 1 LSB" is a per-run observation, not a
bound (2 LSB at −84 dBFS over 3634 samples, fingerprint still identical). Nothing audible is
at stake; the gate is. Reword to "fingerprint identical; sample delta at the float floor
(≤ 2 LSB)" and assert fingerprint plus an LSB ceiling. Related: replay Δ 8.91e-5 vs 1e-4
gate (builder 3.05e-5) — 89 % of gate with 3× run variance. Do not loosen; record it.

## 6. Dissent preserved

- **D1 route.** Builder: "Stage 2 limiter or owner retune." Auditor: "a limiter cannot open a
  6.5 LU window; owner decision." Both kept; ruled above.
- **Sub gating.** Treatment: `gates.sub` (colour). Shipped: `padChoir` (material). Auditor:
  stricter, but "designed sub at colour silently did not ship." I keep the stricter shipped
  gate — it makes the colour proof hold and the calm law caps sub before A2 — and require
  the treatment to say so (D9).
- **Weight vs lurch.** `era-transition` LRA 11.17 → 15.18; blind: at 71 s B is "smoother —
  and less sectional." Auditor: "earning its weight, or a lurch — ears only." Audition item.
- **P-1 (Score).** "Stage 5 is better designed after hearing Stage 1." Honoured in §10.

## 7. Defects

`defects.json`: high 1 (D1, pending amendment), medium 4 (D3, D4, D5, D6), low 10.

## 8. Scorecard cross-check

`final-scorecard.json`: weighted 4.60, floor 4.30. Every category cites evidence;
unchanged-image categories score from diff scope, not absent audits. Below threshold.

## 9. Protected strengths

Exact-bypass blend topology; `padChoir` gating of every new rail; `richness`-gated story
convolver; unity-slope tanh; glue at unity static gain; `endOfflineScoreRender` reset;
removal of the shipped clicks; the self-incriminating deviation log.

## 10. Minimal next loop and Stage 2 condition

1. Triad signs draft-v3 (D1 to Stage 2 with compressor authority and re-baselined bare
   term; D13 decision recorded).
2. Score Director: D4 trim or amendment; D6 era-gate-zero and topology tests; D9 wording.
3. Integration: D3 ms/frame full and lean at 4×; D5 floor renders; D7/D12 gate assertions;
   D8 README; D14 record.
4. Verifier re-measures; re-judge; then the owner audition.

**Stage 2 may begin only when (a) draft-v3 is signed and (b) D4 is closed**, so Stage 1's
final `after/` is pinned as Stage 2's `before/` and the shared `audioCore` tail has one
owner at a time. D3, D5, D6, D7, D12 may run in parallel but must close before the Stage 2
gate. No Stage 2 edit to `audioCore.ts` before (a) and (b).

`route_repair`. Not a publish approval; not a taste approval.
