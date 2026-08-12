# Score Audit — ch10 station introduction

Reviewer: score-continuity-auditor (opus), fresh, 2026-08-11
Authority audited against: scene-contract.json draft-v3 `ad3cab3a…`, score-treatment.md, rendered evidence
Report recorded verbatim by the orchestrator from the auditor's return.

## Verdict

**Conditional fail — do not lock.** Two blocking repairs (D1, D2); the musical
thesis is sound and the ladder/cue grid are exact.

## Dimension verdicts

| Dimension | Verdict |
|---|---|
| Harmonic authority / legal pitches | PASS (one `setScoreMood` chain; additive-only, 0 deletions) |
| K1 voice leading | PASS, upgraded — 0.25 Hz sweep: A 55.25 Hz → B 49.25 Hz = 0.8914 (−1.99 st); upper partials identical; only new lines (147.4/295.6) are harmonics of the moved root |
| Motif continuity | PASS with D5 |
| Relay call→response grammar | **FAIL (D2)** |
| Carrier lifecycle | **FAIL on reload (D1)** |
| ST-0 / free-play silence | PASS — no ST-0 anchor exists in the rail |
| Cue grid vs contract | PASS 10/10 (anchors, relations, `until`, `reset-score`) |
| Intensity ladder | PASS — all 10 anchors == contract via `scoreIntensityFor` |
| Mix / ceiling | **FAIL (D3)**; no clipping, peak ≤0.336, handback step 0.0217 |
| Era grammar (no braam/mediant/warp/lead) | PASS |
| Determinism / tests | WEAK (D6) |

## Defects

**D1 — Blocking. Reload loses the chapter's two signature gestures. Owner:
Integration (+Score sign-off).** `chapter10CarrierAlive` is set only on the
`anc.ch10.relay-answer` edge (`emergentScoreDirector.ts:253`);
`tickChapter10Transit` re-enters via `CH10_BEAT_ENTRY_VARIANT` = `transit-hold`,
and milestone guards stop the seam/answer anchors re-firing. A mid-transit
reload therefore restores the pulse the seam ebbed away (ost 0 → 0.05) and
drops degree 26 at the resolve — literally the run's own control render
(`carrier-illegal-control_no-carrier.wav`, −21.90 vs −20.68 dB). The contract
promises "a pure reload-safe resolver from durable milestones"; the code is an
edge machine. Repair: resolve variant + carrier from
`ch10RelayAnswered`/`ch10SeamPassed` in `enterEmergentScoreBeat`.

**D2 — Blocking. The pillar has no question to interrupt. Owner: Score.**
Contract barIntent puts "a two-bar quantized square-fifth question figure" at
`anc.ch10.relay-ask`; that anchor selects `crossing-back` (sawtooth,
`[-2,3,7,9,14]`, no `[0,7]` cell). The audible event is a timbre change 1.765s
after K7, not an early answer inside a sounding phrase. Evidence is absent too:
`relay-answer_onsets.json` contains no onsets; the ch5-maw reference was
rendered and never compared. Repair: author an ask figure (fourth `ch10-ask`
variant) or rewrite the pillar claim.

**D3 — Major. The destination out-measures the awakening. Owner: Score.**
`station-resolved` pad 0.19 is the highest in `MOODS` (a4-exhale 0.18); sub bus
0.12×0.748 = 0.0898 vs a4 0.10×0.874 = 0.0874. Steady-window (8–12s, past the
shared fade-in): resolve −18.74 dB vs a4-authored −18.84; peak 0.336 vs 0.322;
sub 20–120 Hz −26.32 vs −26.36. The reported 0.052 dB margin is a
whole-file-RMS artifact. Repair: pad ≤0.17, sub ≤0.10.

**D4 — Moderate, Score/doc.** No timing humanize exists in `scoreEngine.ts`
(salts drive velocity/drop/phrase only), so "machine punctuality vs seeded
humanize" distinguishes nothing. `CH10_SEAM_EBB_SLEW_SECONDS = 2.4` is exported
and never used; the real ebb is `SCORE_OST_GAIN_SLEW_S = 0.4`.

**D5 — Moderate, Score.** Carrier degree 14 is already a chord member of
ch9-hearth, ch8-crossing, `cold-settled` and `crossing-back`; "chord tone of
neither" is false as encoded, and the carrier is not new information at birth.

**D6 — Minor.** Zero ch10 tests in `emergentScoreDirector.test.ts`; nothing
imports `getChapter10ScoreMood`/`noteChapter10ScoreAnchor`/`releaseChapter10Score`.
Deliverable 6 not produced. Treatment says "eleven signed cues"; rail has ten.

**D7 — Minor/taste.** Riser 0.06→0.04→0.05 (gain 0.0106→0.0052→0.0097) inside
one beat — not warp-scale, but not "flat"; `station-resolved` also restores
ost 0.02 after the declared pulse-less seam.

## Open measurements

1. **Cold-entry sub ratio — CLOSED, PASS.** 0.8914 vs 0.8909 target; the 51 Hz
   reading was Goertzel leakage.
2. **Seam 11.64 dB spread — not a riser measure, but not benign.** The file is
   a 12s cold-start steady-state render (envelope −39.3 → −18.1 dB); the ebb
   transition was never rendered. Re-render `transit-hold → seam-ebb`; fix the
   "flat" wording.

## Protected strengths

Exact cue/anchor/intensity agreement; withheld station key, mediant, braam and
lead; declared ST-0 silence enforced structurally; additive-only mood table;
click-free handback.

**Highest-leverage repair per the auditor: D1.**

---

## Delta re-check (post-repair, draft-v6) — score-continuity-auditor, fresh instance, 2026-08-12

**Verdict: PASS — lockable from the score lane.** D1 closed (pure milestone resolver,
18-cell matrix + reload tests; minor: crossing-back lacks a CH10_VARIANT_INTENSITY entry
so a pre-ask reload snapshot reports null intensity — diagnostic only, authority is
scoreIntensityFor). D2 closed (relay-ask verified; answer +1.765s = 25% in; −25.99 vs
−27.06 dB across entry; 110/165/220Hz continuous; 0 clipped samples; ch5-maw reference
honestly bounded). D3 closed (steady 8–12s: resolve −19.36dB / peak 0.311 / sub −20.90
vs a4 −18.84 / 0.372 / −20.34 — strictly below on all three). D5 closed as encoded
(degree 17 = pc5 in all five post-answer variants, absent prior; render confirms
+16.83st over 110Hz, octave exactly 2.000×). D4b/D7 closed. D6 closed (ebb is a real
envelope event: spread 9.98→4.58dB, envStd 3.60→1.42, dip −26.15dB). MOODS byte-identical
to 929e3d0; 0.44 ceiling confirmed.

**Open, non-blocking:** D4a residue — two contract clauses still assert "zero humanize"/
"world keeps seeded humanize" though engine salts are phrase/gain/rest only (candidate
final micro-amendment). **Taste risks for the judge:** the answer enters ~6dB under the
ask's own mean (third independent flag of the same perception); resolve sits +0.10dB
over the equal-intensity a4 control. **Hygiene:** carrier-illegal-control_no-carrier.wav
and carrier-legality.json predate the re-pitch.


---

## Review structure (index added by the orchestrator; no reviewer text altered)

**Independence.** The score auditor ran as a fresh opus-tier instance that took
no part in composing the ch10 material, measuring the rendered evidence and the
shipped source directly rather than accepting the Score Director's account. Its
delta re-check was run by a second fresh instance and re-derived the numbers
rather than confirming them — including one case (D4a) where it verified the
fix against shipped source and found the original claim distinguished nothing.

**Findings.** D1–D7 above with per-dimension verdicts, then the delta re-check's
per-defect closures with the measurements that justify each. Two taste risks
are recorded unresolved and routed to the judge rather than absorbed: the answer
entering roughly 6 dB under the ask's own mean, and the resolve sitting 0.10 dB
over its equal-intensity control. They are carried in `defects.json` as NV-1.

**Contract version audited:** draft-v3 `ad3cab3a…` (original audit) and draft-v6 `4202e38b…` (delta re-check); repairs re-verified against the frozen contract version draft-v9 `0336a4f2…`

**First wave attestation.** This was a first-wave report: the score auditor delivered its findings before seeing any peer review, and the delta re-check was run by a second fresh instance which re-derived every number rather than confirming the first.

Contract revision: `draft-v9`

First report completed before reading peer conclusions: `yes`
