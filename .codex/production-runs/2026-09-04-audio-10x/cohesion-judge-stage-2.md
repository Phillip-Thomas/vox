# Scene Cohesion Judge — Stage 2 (game mix)

Judge: `scene-cohesion-judge (Claude Fable 5.1)`, 2026-09-05T07:40-04:00
Contract: `draft-v3` sha256 `776d676b…6ba1`; source b631a52 working tree
Profile: `paravoxia-creative-chapter@v1` (4.75 weighted / 4.30 floor)

## 1. Disposition

**route-repair** — weighted **4.58**, floor 4.40 (`interaction_accessibility_and_variants`,
`performance_and_implementation_fidelity`). Not blocked: reports fresh, independent, same sha; every number reproduces. Not release,
not taste.

## 2. Verdict

Stage 2 is the shipped soundtrack finally heard as a mix: effects rise from 20 dB to 9.5 dB
under the bed, the music steps aside 6 dB in 35 ms and returns in 0.8 s without pumping,
nothing clips (worst −4.92 dBTP), bare, colour, floors and the quietest second are unchanged to
0.01 dB — but three acceptance terms are unmet by architecture, not craft, and the contract
binding them is false in four places.

## 3. Skipped reviews

Cinematography-continuity and player-experience skips **accepted, with a recorded condition.**
No image, camera, HUD, objective, marker or copy term moves. But `playSfx` now passes every
shipped acknowledgement cue through the frame queue's held-level law and a 10.34 ms
post-join delay (`sfxEngine.ts:290`, blind "alignment fact"). Under a frame, not a lifecycle change; the Stage 3 player-experience audit must cover
acknowledgement latency and the held-level law on mining/pickup. Both audits mandatory from Stage 3.

## 4. Combined experience

- **One soundtrack with Stages 0–1.** Same `createMixTail` live and offline; tail static
  gain −0.007 dB; pre-tail taps identical; the −3 dB story-lead cap keeps the score's authority
  under a beat; ui/voice dry because REGULATION is not underwater. Blind: "narrow and clean."
- **Not yet orchestrated.** Blind reservation, preserved: the 6.4 dB duck is broadband —
  "mixed rather than orchestrated" — and 16 dB of clearance may be too much room. Audition
  item, not a defect.
- **The peak is still missing.** BLOOM −17.90 vs −14: the tail can open 0.21 LU. The contract
  sentence "opened by the mastering tail and never by an arrangement" is physically wrong.

## 5. Rulings

**D1 — TAIL_REFERENCE_GAIN_DB vs no-makeup (HD-08).** Accept as the loudness architecture.
Level-preserving, named, tested, re-measured (−0.0074 dB); the letter would drop the game
2 dB and void four signed measurements. But "unity-in-effect" is a fiction: it is +1.99 dB
against a makeup-free chain and `score.mixIntent` must name it. Taste exception under
delegation; record in `acceptedExceptions`. Open-high until draft-v4 is signed.

**D2 — BLOOM to Stage 5, not waived.** Concur; deferral is not the retarget I refused at Stage 1.
Stage 5's rail must honour Chapter's `bloomBudget 0` after refusal; publish `composedSpread`
now (2.5 vs 6.5 LU).

**D5 — −18 sum after Stage 4.** Concur, with a condition: the re-asserted term must state
SFX density per stress script, or Stage 4 can "meet" it by making effects loud.

**D3 / C6 amendment.** Upheld and adopted. Census confirmed against the contract: five
`playSfx` bundle members, not three. Forward-scheduling inside bundles; no global SFX delay.
Shared anchor semantics change: three signatures.

**D4 — per-rate latency (dissent D-2).** Cinematography is right on the physics: Chromium's
compressor pre-delay is 6 ms in time, so 18 ms of the 25.2 ms is rate-invariant and the
auditor's sample-derived 23.17 ms is wrong by ~1.4 ms at 48 kHz. Binding form: measure at
each rate, pin, select by `ctx.sampleRate`. Dissent stands until the 48 kHz render.

**D6 — 590 writes/s.** Routed to Stage 3 with an explicit term; fix the README double-count
(verifier: `scoreEngine.ts:825-832` is the largest site). "Roughly 1140" was 2276; say so.

**D7 — dedupe wording.** The `(id, frame)` phrase is in the treatment and README only, not the
contract: documentation, no amendment. I record that keying `queuedThisFrame` to the frame
clock is a two-line change that honours the signed intent; HD-09 defers it.

**Inherited: 0.51 step at 20.013 s (mining-burst).** Forty same-seed chips at
`STRESS_MINING_BURST_AT_S 20` sum coherently in the offline rim; live collapses them to one.
Per-chip onset ≈0.013 is a Stage 4 recipe question (Score). 
**Inherited: 6.3 kHz "brick wall" (oxygen-dive).** Not edge-triggering in the music path:
`setMusicSubmerged` slews 0.42/0.65 s. The stress script steps `submergence` 0→0.85 at 8 s and
back at 54 s (`excerpts.ts:1515`) where live play is continuous; the SFX muffle is edge-snapped
by design (`SFX_SUBMERGE_EDGE 0.5`, 80 ms). "6.3 kHz" is where the 12 dB/oct roll-off from
~930 Hz crosses the spectrogram floor. Lane: Integration (script authoring); Score confirms the
dive gesture at audition.

**Duck-attack 0.34 ms margin.** A 5 ms-bin artefact: raw full depth lies in (45, 50] ms, so the
true margin is 0.3–5.3 ms. The term's 40 ms equals the row's attack constant — met and marginal
by construction. Subtracting the shared 10.34 ms is legitimate. Integration: 1 ms traces; contract:
"inside the row's attack time from the audible impact".

**Metronome.** "Unchanged result" is literally false (suppressed/3 s 5→0) and correctly so;
name the fields. The probe's own PASS criterion is unmet before and after (`activeMine=0s`,
`cycles=0`): the sandbox-no-op instrument cannot engage mining. Pre-existing, Integration,
close before Stage 4.

**Stage 3 parallel start.** Acceptable in effect, not in principle. No file under `main/src`
changed after 07:05, so nothing was contaminated. Conditions: no `bundleAt` latency or
SFX-forward code until C6 draft-v4 is tri-signed; no edit to `audioCore.ts` or `mix/**`;
Stage 3 `before/` pins Stage 2 `after/`.

## 6. Dissent preserved

D-2 stands, ruled for Cinematography pending measurement. Blind "mixed vs orchestrated" vs
builder "in the music, given room" — owner's ear. Auditor taste risks 1–5 carried.

## 7. Draft-v4 amendment — exact paths

1. `evidence.acceptanceCriteria[5]`: no-makeup sentence; BLOOM term out to Stage 5;
   −18 ±1.5 recorded, re-asserted at Stage 4; writes/s 2276→590 recorded, Stage 3 term;
   metronome named fields; duck-attack wording; latency as three per-rate constants.
2. `evidence.acceptanceCriteria[6]`: "No makeup gain exists anywhere" → HD-08 wording.
3. `score.mixIntent`: tail order (glue → safety → join → limiter → ceiling); no-makeup sentence;
   delete "opened by that retune and by nothing upstream"; "bounded ceiling, margin ≥0.5 dB at
   +12 dBFS" (HD-09); name `TAIL_REFERENCE_GAIN_DB`; label voice/lifecycleCue/station/
   roomPresetId inert this run.
4. `score.cues[0..9].mixIntent`: the same no-makeup sentence, ten times.
5. `performance.measurementPlan`: "roughly 1140"; "SFX join post-tail… about 12 ms" is false.
6. Stage 3 criterion: `applyRails` dirty-checked, <60 writes/s; SFX forward-scheduling at five
   bundle members with both onset lines in the overlay.
7. Stage 4 criterion: −18 ±1.5 with stated SFX density. Stage 5 criterion: BLOOM rail,
   S-max −14 ±1 while bed I −20.5 ±1 and TP ≤ −1 on four beds, owner A/B.
8. `cinematography-contract-signoff.json` C6 → `c6-amendment.md` text; three re-signatures.
9. `human-decision.json`: bind the sha; HD-08(1) into `acceptedExceptions`; HD-09 recorded.

Code (Integration, bounded): per-rate latency table + 48 kHz `audio:check`; 1 ms duck traces
plus an `oxygenCritical` trace (blind saw −3.1 dB over ~10 s, unmeasured); `composedSpread`;
dive-script ramp; lean tier and cost probe through the new tail. Documentation: treatment §2
dedupe; README deviation 11 arithmetic, deviation 5 census.

## 8. Protected strengths

One `createMixTail`; subtract-only tail, every makeup cancelled by a measured trim; story-lead
cap; ui/voice dry; music never re-levelled by a snapshot; start-anchored ducks; combined-bus
evidence; the honest limiter write-up.

## 9. Minimal next loop

Triad signs draft-v4 → Integration lands the code list → verifier re-measures (48 kHz,
1 ms traces, lean/cost) → re-judge → owner audition. Stage 3 continues under §5.

`route_repair`. Not a publish approval; not a taste approval.
