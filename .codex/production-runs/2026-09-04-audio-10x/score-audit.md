# Score audit — Stage 1 (bed timbre + mastering)

Reviewer: score-continuity-auditor (opus), read-only, independent of the builder; report filed verbatim by the orchestrator (the auditor role cannot write). Contract draft-v2 sha 384120dc…9a6d.

# Verdict: PASS-WITH-DEFECTS

Contract `draft-v2 frozen`, sha256 `384120dc…9a6d` — matches the sha the evidence README pins. Six of eight Stage 1 acceptance terms are met with real measurements; two are not, and three contract-level claims are asserted rather than measured. Nothing here is a musical regression; the instrument is legitimate and the era law holds where it was tested.

## Contract fidelity (shipped graph vs contracted graph)

Built and verified in live source, not just the diff:
- 5-voice / 6-saw supersaw, lean 3/3 — `bedEngine.ts:659-703`; symmetric cents `[-17,-9,-3,3,9,17]` (`bedEngine.ts:1035`, tested).
- Seeded phase jitter inside one period — `bedEngine.ts:701`.
- Per-voice lowpass + seeded wander LFO — `bedEngine.ts:664-676`, `1199-1200`.
- Era-gated attack breath, bounded lifetime, `disconnect` on ended — `bedEngine.ts:1226-1228` and the `padBreath` helper.
- Parallel tanh drive per family with era/thermal wet — pad `bedEngine.ts:638-652` + `1213-1218`; sub `:804-828` + `1235-1240`; lead `:1241`.
- Designed sub + LR4 mono-below-120 blended against an exact bypass — `bedEngine.ts:558-589`, `789-828`.
- Shared impulse generator incl. stereo story convolver — `timbre.ts:makeImpulseResponse`, `bedEngine.ts:makeImpulse`, `scoreEngine.ts:981-996`.
- Glue `−18 / 2.5:1 / 30 ms / 250 ms / knee 12` → `−4.27 dB` trim → soft clip `k1.4` @ `2x`, inserted between `visibilityGain` and the untouched safety compressor (`audioCore.ts:347-353` + `createMusicGlueStage`); safety compressor still `−20 / 8:1` (`audioCore.ts:40-41,334-335`).
- Colour tones to index 5 — `bedEngine.ts:1160` `tones.slice(1, 1 + padVoices.length)`.

Three graph deviations from the signed treatment, all documented in the evidence README but never folded back into the treatment text: two side panners per voice instead of per-osc panning; `oversample = 'none'` on the family drives instead of `'2x'`; mono-below/sub-design gated by `padChoir` (material) rather than `gates.sub` (colour). The first two are performance repairs I judge sound (the drive inputs are lowpassed well under Nyquist; dropping the resampler also removed a comb against the dry path). The third is *stricter* than contracted and is what makes the colour-era proof hold — but it means the "designed sub at colour" intent silently did not ship.

## Harmony and motif continuity

Harmonic authority is untouched by construction: the diff touches no `harmonyBrain.ts`, `arrangement.ts`, `moods`/`storyScore.ts`, `bedConductor.ts` or `transport.ts`, and `tuning.ts` is a pure append after line 605 (no existing constant edited). Voice leading is unchanged: retune-not-swap glide is preserved (`bedEngine.ts:1182,1193-1194`), and unmapped voices ramp to 0 through a named slew (`:1197`), so no voice enters or leaves as a step. What changed is *which published tones sound*, not what is published — voices 4 and 5 now render partials the brain always emitted. The colour tones do not alter the chord; they realise it.

## SYMPHONY LAW

Clean. Every new continuous rail is a named `rampParamAt` slew: `UNISON_PAN_SLEW_S` (`:1186-1191`), `PAD_VOICE_LP_SLEW_S` (`:1199-1200`), `PAD_VOICE_GAIN_SLEW_S` (`:1197,1201`), `DRIVE_WET_SLEW_S` (`:1213,1235,1241`), `XOVER_BLEND_SLEW_S` (`:1230-1232`), `SUB_DESIGN_SLEW_S` (`:1233-1234`), `BED_ALIVE_LIFT_SLEW_S` (`:1520`). `rampParamAt` is `cancelAndHold` + `setTargetAtTime` (`audioCore.ts:585-598`) — start-anchored, no step. The only `setValueAtTime` in new code is `padBreath`'s one-shot transient envelope from 0, which is the shipped one-shot idiom, not a rail. No per-frame writes were added; all Stage 1 automation is inside `scheduleBar` at `barTime`.

## Era gates

`padChoir = eraFade(era, 0.5)` with `ERA_FADE_WIDTH 0.12` (`worldSignals.ts:357`, `tuning.ts:333-336`) — exactly 0 for era ≤ 0.38. Every Stage 1 rail multiplies `g.padChoir`, and the crossover/sub-design blends are against exact bypasses, so bare/colour are sample-identical by construction; the renders confirm it (fingerprint-identical, max Δ 1 LSB at −90 dBFS). The story convolver change is likewise era-safe because `scoreReverbWet` scales by `richness = f(material, alive)` (`scoreEngine.ts:1283,1297-1303`) — 0 at bare/colour. The "only the glue's fixed look-ahead shifts samples" claim is **correct** and well-evidenced.

Caveat: the proof samples era 0 and 0.35 only. `padChoir` becomes non-zero at era 0.38, i.e. *inside the colour band* (colour = [0.25, 0.5)). This is shipped gate behaviour, not new, and the 80 s era-build smoothness sweep crosses it with 0 violations — but "inaudible at colour" is true only up to 0.38 and should be stated that way.

## Determinism

No `Math.random` anywhere in the changed audio modules. Impulse seeds are xorshift from named constants; wander rates and phase jitter derive from `seededUnit(PAD_WANDER_SEED, …)`. `endOfflineScoreRender` now resets `intensity`/`currentChord`/`storyAuthorityCrossfade` — a genuine determinism repair. `pure-soak.log`: replay bit-identical, seed-divergence pass; `audio:check` replay Δ 3.05e-5, inside the 1e-4 float floor the contract set.

## Defects (ranked)

| # | Sev | Category | Evidence | Repair / route |
|---|---|---|---|---|
| D1 | **Major** | Acceptance unmet + mis-routed | BLOOM short-term −14 ±1: measured −16.88…−18.94 (`ab-results.md`). Builder's attribution to the safety compressor (−20 dB, 8:1, default 30 dB knee ⇒ knee spans −35…−5 dBFS) is **mechanically correct** and corroborated by LRA 6.88→3.26. But the proposed route is not: the Stage 2 treatment leaves the safety compressor *in the music path* (`score-treatment.md` §2, "untouched above masterOutput") and adds only a post-master limiter that "can only subtract". A limiter cannot open a 6.5 LU window. | Owner decision, not Stage 2 hand-wave. Either (a) retune/replace the safety compressor — a protected-path change needing an explicit contracted grant, or (b) re-target `BLOOM_ST_LUFS` for Stage 1 and move the window to an arrangement-level BLOOM lift (Score Director + Chapter, out of current scope). **This is the highest-leverage repair.** |
| D2 | **Major** | Tier parity unaudited | Every WAV is `"quality":"full"` (`after/summary.json`). No lean render, no lean listen. And lean sounds `tones.slice(1,4)` — mobile loses two *published chord tones*, while `variants.mobile.effectChanges` says "None… changes what is heard and nothing that is seen". | Render the six excerpts at `quality:'lean'` and A/B them. Route: Integration for renders; the "colour partials are inaudible on mobile" question is a taste risk for the owner audition. |
| D3 | **Major** | Performance evidence | Contract names 1.5 ms/frame full, 3 ms/frame lean at 4× throttle. Evidence has neither: `fps.txt` is vsync-capped (60.40 baseline vs 60.38 with score — ratio 1.000 proves no regression *below vsync*, not headroom), against a measured 1.7× audio DSP cost. | Measure audio-thread ms/frame; run the lean tier on the SwiftShader gate at 4× CPU throttle. Route: Integration. |
| D4 | Medium | Acceptance partially unmet | Alive bed −20.5 ±1 alone: night measures −18.99, outside the band. README grades itself "met on the daylight reference" — a narrowing of a term the contract states unconditionally. | Either an era-gated night trim (Score Director, cheap) or an owner amendment naming daylight as the reference point. |
| D5 | Medium | Calm-law evidence gap | Bed is +4 LU at alive. No `ch4-defy` / `refused` / `seam-ebb` before/after render exists at Stage 1 (that check is only listed under Stage 2). Mitigating: story score levels are untouched (story-beat ΔI −0.23) and floors live in `storyScore.ts`, unmodified. | Run the two floor renders now — the harness exists. Route: Integration. |
| D6 | Medium | Test coverage | The era-gate law — the run's most load-bearing law — is protected only by rendered hashes of two excerpts. No unit test asserts the Stage 1 rails resolve to exactly 0 at `padChoir = 0`, nor that the glue sits between `visibilityGain` and the safety compressor with the compressor's params unchanged (`audioCore.test.ts` mentions the soft clip once, line 67). | Extract a pure rail resolver and assert zero at padChoir 0; add a topology test. Route: Score Director. |
| D7 | Low | Portability | `GLUE_MAKEUP_COMP_DB = -4.27` (`tuning.ts:677`) is a one-time Chrome measurement hard-coded into the shipped path; `measureGlueStaticGainDb` exists only on the soak page and is not a gate. Spec'd makeup formula mitigates cross-browser risk, but nothing catches drift. | Assert unity static gain in `audio:check`. Route: Integration. |
| D8 | Low | Doc disagreement | README deviation 4 says `BED_ALIVE_LIFT 1.2`; code is 1.1 (`tuning.ts:689`). Formula matches. | Correct the README. |
| D9 | Low | Contract/treatment drift | The three graph deviations above were never reconciled into `score-treatment.md`; the contract is frozen at draft-v2. | Reconciliation note. Route: Score Director. |
| D10 | Low | Forward risk | Glue latency is stated as ~6 ms, but the music path already carried the safety compressor's look-ahead — cumulative music-vs-SFX offset is ~12 ms (SFX joins at `masterOutput`, post-compressor). Stage 3's ±1 ms grid claims and Stage 4's layered boom+braam must compensate the total, not the glue alone. Below the ~20 ms perceptual threshold, so not a Stage 1 audibility defect. | Define `LATENCY_COMP` as the measured full-path figure. |
| D11 | Low | Record hygiene | `score-audit.md` is an unfilled template. Story convolver reshapes the room for *every* material+ story mood but was auditioned on one excerpt (`story-beat_a3-dawn`). | Fill the record; add one more story-mood A/B. |

## Cue-alignment matrix

Not applicable this stage — Stage 1 implements no anchors, cues or hit scheduling; `syncAnchors` and the ten `criticalAnchors` are Stage 3 work and no `scheduleHit` signature changed. The only forward cue risk is D10.

## Objective measurements

Integrated (before→after): day −24.55→−20.48; night −22.93→−18.99; contrast-A −25.02→−20.53; contrast-B −25.29→−21.07; story-beat −19.95→−20.18; era-transition −26.10→−22.58. Worst true peak −7.28 dBTP (target ≤ −1) — large headroom, consistent with Stage 2 owning final level. Smoothness battery 0/0/0 before and after; no NaN, no clip, no silence in any sweep. Correlation 0.962→0.936 (day) — wider, still mono-compatible. `verify` EXIT=0.

## Taste risks (owner audition, not defects)

1. Bed at alive is +4 LU and 200–800 Hz gains 3–5 points: the awakening is materially heavier. Verify it still reads as *warmth* and not as *loud*.
2. `era-transition` LRA widens 11.17→15.18 LU. That is the awakening earning its weight, or a lurch. Ears only.
3. Mobile lean hears a three-tone chord where desktop hears five (D2).
4. Streamed loops and the drone bank were not retired — the stated audition decision is still open.

## Protected strengths (do not regress)

The exact-bypass blend topology for the crossover and sub design; `richness`-gating that makes the story convolver change era-safe; the unity-slope tanh curve (drive adds harmonics, never gain); `endOfflineScoreRender`'s determinism reset; the honest, self-incriminating deviation log in `evidence/stage-1/README.md`.

**Single highest-leverage repair: D1** — resolve the BLOOM window at the owner level before Stage 2 is designed around a limiter that provably cannot deliver it.