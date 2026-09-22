# Stage 2 evidence — the game mix (buses, tail, ducking, snapshots, event queue)

Contract draft-v3 (sha256 776d676b90cc9c1007694b26f0000cfc61ecf85c256c81a72a0cdd324ea26ba1) for every
measurement below; the run re-signed to **draft-v4** (sha256
672de45a0c8257d334d052cbedf4247fd09b0f1dba385cc5fb9d06e04459d41d, tri-signed 2026-09-05T07:44) after the
Stage 2 judgement, and the repair loop at the end of this file is measured against that.
source revision b631a52 working tree (Stage 0 + Stage 1 + Stage 2 uncommitted). Every render
comes from the real engines on the score-soak harness through
`main/tools/audio-stage-evidence-probe.mjs`; `before/` was captured before any Stage 2 instrument
edit (the Stage 1 tail, verified against the pinned `stage-1/after` set: fingerprints identical
on 6 of 8 shared renders, the other two within the renderer's run-to-run float floor — 4 LSB at
−78 dBFS on `bed-sandbox-day`, 3 LSB on `era-transition`, identical loudness to 0.01 LU).
`after/` is the shipped Stage 2 chain. `before-pretail/` and `after-pretail/` tap the music path
BEFORE the mastering tail. `ab-results.{json,md}` is produced by
`main/tools/audio-stage2-compare.mjs` — one verdict per contracted term.

## What ships (the graph, honestly)

```
music engines → musicBus → submerge lowpass → sceneEnvelope → visibility
  → [Stage 1 glue: compressor −18/2.5/knee 12 → trim −4.27 → tanh soft clip 2×]
  → [Stage 2 safety: compressor −6/20:1/knee 3/attack 3 ms/release 0.1 s → trim (−2.91 + 1.99)]
  → musicDuck → masterOutput
SFX voice → category bus [gain (snapshot) → duck] ─ world/player/ship → SFX muffle ─┐
                                                   └ ui/voice (dry) ────────────────┴→ sfxOutput → masterOutput
masterOutput → [Stage 2 limiter: compressor −1/20:1/knee 0/attack 1 ms/release 80 ms → trim −0.57
              → ceiling WaveShaper 4× (asymptote −1 dBTP)] → output route
```

The offline mirror (`createOfflineMusicRuntimeChain`) builds the identical tail through the same
`createMixTail` function; `tail: 'pre-tail'` taps before it and `tail: 'pre-stage-2'` rebuilds the
Stage 1 tail (legacy safety compressor, no limiter) for old-versus-new comparisons.

**Limiter design, stated honestly.** There is no AudioWorklet. The "true-peak limiter" is Chrome's
`DynamicsCompressor` at 20:1 with a hard knee, 1 ms attack and 80 ms release at the −1 dB target
(the node carries a fixed pre-delay, so it behaves as a look-ahead limiter), its baked makeup
cancelled by `LIM_MAKEUP_COMP_DB`, followed by a 4×-oversampled WaveShaper ceiling
y = x / (1 + |x/c|^6)^(1/6) with c = −1 dBTP (unity slope, < 0.02 dB at −9 dBFS). The compressor
does the programme-level protection; the ceiling bounds what its attack lets through. Measured
with the 4× oversampled analyser on sine bursts into the SFX path: −6 dBFS → −6.03 dBTP (transparent),
0 dBFS → −1.87, +6 dBFS → −1.62, +12 dBFS → −1.58 dBTP. Inter-sample overshoot over the sample peak
is under 0.01 dB. The ceiling holds −1 dBTP with 0.58 dB to spare on a +12 dBFS input.

## Acceptance terms (contract acceptanceCriteria[5], [6]; full per-term table in `ab-results.md`)

| term | required | measured | verdict |
|---|---|---|---|
| stress scripts true peak (5 of 5) | ≤ −1 dBTP | worst −4.92 dBTP (40-node same-frame mining burst); others −8.9 … −9.5 | met |
| stress scripts integrated | −18 ±1.5 LU | −20.39 / −20.45 / −21.69 / −20.38 / −20.67 LUFS | **not met** — deviation 3 |
| duck depth vs matrix | within 1 dB | shipCrash −6.0 (table −6), terminalCorrupt −4.0 (table −4), shipLand −6.0, terminalAlarm −4.0; under story lead −3.0 (cap) | met |
| −6 dB on music within 40 ms of a ship impact | ≤ 40 ms | **re-measured at 1 ms** (S2-J3, repair loop): within 1 dB of depth at **+34.7 ms** from the audible onset (5.3 ms of margin); full depth at **+40.7 ms** (raw +45.0 / +51.0 ms, less the 10.34 ms post-join latency both the impact and the ducked music share) | met on "within 1 dB"; **the literal "full depth" reading is unmeetable** — the row's ramp ends at the attack constant. Owner wording, S2-J3 |
| steady-state AudioParam writes/s | < 60 (from ~1140) | before **2275.9/s** median (AudioDirector's unconditional per-frame `setLayerTargets`/`setProceduralTargets`: ~1690/s, plus the score scheduler); after **590.4/s** median (588.3 on the traced re-run). AudioDirector's contribution is gone (dirty-checked, 4 writes/s per lane at the 250 ms keep-alive); the residual is `scoreEngine.applyRails` — ~32 `setTargetAtTime` per 60 ms scheduler tick (528/s) — and one `rampParamAt` per frame (60/s cancelAndHold + setTarget) from the score/bed schedulers, both outside the Stage 2 lane | **not met** — deviation 11 |
| mining-metronome-probe unchanged | unchanged result | before (this run; files D15): loop guard never engaged, max admit 1.33/s, max suppressed/3 s 5, 0 errors, inventory grows every stance; after: loop guard never engaged, max admit 1.33/s, **max suppressed/3 s 0** (the queue's held-level law now absorbs what the rate limiter used to suppress), 0 errors, inventory grows every stance | met (the verifier notes `activeMine=0s`/`cycles=0` on every stance before AND after — the probe's mining readout never engages, so it exercises the admit path only through the pickups it reports; pre-existing) |
| BLOOM short-term max, bed-sandbox-day | −14 ±1 LU | **−17.90** (before −18.12) | **not met** — deviation 2 |
| BLOOM short-term max, shipCrash-over-BLOOM | −14 ±1 LU | **−18.08** (the impact ducks the bloom −6 dB; the loudest window moves to 145 s) | **not met** — deviation 2 |
| bed at alive still −20.5 ±1 alone | −20.5 ±1 | day −20.36, night −20.39, contrast A −20.39, contrast B −20.96 | met |
| safety compressor retune | −6 / 20 / knee 0–3 / attack ≤ 3 ms / release 0.1 | `SAFETY_THRESH_DB −6, SAFETY_RATIO 20, SAFETY_KNEE_DB 3, SAFETY_ATTACK_S 0.003, SAFETY_RELEASE_S 0.1` (topology test) | met |
| SAFETY_MAKEUP_COMP_DB measured like GLUE's | −30 dBFS probe with/without stage | baked +2.9054 dB → `SAFETY_MAKEUP_COMP_DB −2.91`; stage static gain after trim −0.005 dB | met |
| limiter makeup cancelled | named measured trim | baked +0.5699 dB → `LIM_MAKEUP_COMP_DB −0.57`; stage + ceiling static gain −0.0001 dB | met |
| tail static gain unchanged at bare/colour | within 0.1 dB | shipped tail vs pre-Stage-2 tail −0.007 dB at −30 dBFS; bare-bed ΔI −0.01, color-bed ΔI 0.00 | met — but see deviation 1 |
| re-baseline (a) pre-tail tap | fingerprint identical, ≤ 2 LSB | bare-bed, bare-story-ch1-fixed, color-bed: fingerprint identical, max 1 LSB (−90.3 dBFS) | met |
| re-baseline (b) through the tail | I within 0.3 LU, S every 3 s window within 1 LU, TP within 0.5 dB | ΔI −0.008 / +0.016 / 0.000 LU; max ΔS 0.05 / 0.09 / 0.04 LU; ΔTP −0.007 dB on all three | met |
| re-baseline (c) owner A/B at bare/colour | hears no change | **pending owner audition**: `before/bare-bed.wav` vs `after/bare-bed.wav`, `before/color-bed.wav` vs `after/color-bed.wav` | pending |
| story-floor check (ch4-defy, refused, seam-ebb) | within 0.25 LU | ΔI −0.008 / −0.008 / +0.010 LU | met |
| floor law [6]: S after ≤ before + 0.5 | | ch4-defy −32.88 → −32.88, refused −26.69 → −26.71, seam-ebb −22.88 → −22.87 | met |
| tail latency measured after the limiter, published | published per rate | **44.1 kHz: music 25.215 ms / SFX 10.340 ms** (before 14.875 ms); **48 kHz: music 24.667 ms / SFX 10.000 ms** — each its own measurement (`TAIL_LATENCY_BY_RATE_S`, S2-D4). Music lags SFX by 14.875 / 14.667 ms, inside one 60 Hz frame at both rates; the live path selects on `ctx.sampleRate` | met — see deviation 5 and the C6 note |
| smoothness battery | 0 violations | sandbox 0, era-build 0, story-handoff 0 (`after-sweeps/`) | met |
| every after render true peak | ≤ −1 dBTP | worst −4.92 dBTP | met |

## Before → after loudness table (combined tail)

| render | s | I before | I after | ΔI | S-max before | S-max after | TP before | TP after |
|---|---|---|---|---|---|---|---|---|
| bed-sandbox-day | 210 | −20.48 | −20.36 | +0.13 | −18.12 | −17.90 | −9.37 | −9.02 |
| bed-sandbox-night | 210 | −20.51 | −20.39 | +0.12 | −18.25 | −18.04 | −8.43 | −8.03 |
| bed-contrast-A | 210 | −20.53 | −20.39 | +0.14 | −16.88 | −16.59 | −8.65 | −8.22 |
| bed-contrast-B | 210 | −21.07 | −20.96 | +0.11 | −18.94 | −18.79 | −9.47 | −9.13 |
| story-beat (a3-dawn) | 90 | −20.18 | −20.09 | +0.08 | −18.28 | −18.12 | −9.64 | −9.31 |
| era-transition | 120 | −22.58 | −22.45 | +0.13 | −18.94 | −18.78 | −9.03 | −8.66 |
| bare-bed | 48 | −34.53 | −34.54 | −0.01 | −34.17 | −34.18 | −25.17 | −25.17 |
| bare-story-ch1-fixed | 60 | −35.95 | −35.93 | +0.02 | −34.17 | −34.18 | −25.30 | −25.31 |
| color-bed (era 0.35) | 48 | −27.28 | −27.28 | 0.00 | −26.58 | −26.59 | −19.21 | −19.22 |
| bed-check (90 s) | 90 | −20.41 | −20.29 | +0.12 | −18.75 | −18.59 | −9.15 | −8.79 |
| combined-check (90 s) | 90 | −20.40 | −20.37 | +0.03 | −18.75 | −18.58 | −9.15 | −8.79 |
| stress-shipcrash-bloom | 210 | −20.48 | −20.39 | +0.10 | −18.11 | −18.08 | −9.37 | −9.02 |
| stress-mining-burst | 60 | −20.57 | −20.45 | +0.11 | −19.00 | −18.85 | −4.86 | −4.92 |
| stress-oxygen-dive | 60 | −21.45 | −21.69 | −0.24 | −19.05 | −18.92 | −9.23 | −8.86 |
| stress-terminal-storylead | 60 | −20.39 | −20.38 | 0.00 | −19.01 | −18.87 | −9.81 | −9.49 |
| stress-jetpack-splash | 60 | −20.74 | −20.67 | +0.07 | −18.99 | −18.84 | −9.80 | −9.53 |
| floor-ch4-defy | 60 | −33.10 | −33.11 | −0.01 | −32.88 | −32.88 | −24.01 | −24.02 |
| floor-refused | 60 | −26.93 | −26.94 | −0.01 | −26.69 | −26.71 | −14.97 | −14.94 |
| floor-seam-ebb | 60 | −23.20 | −23.19 | +0.01 | −22.88 | −22.87 | −12.49 | −12.38 |

The alive renders rise 0.1 LU integrated and 0.15–0.3 LU short-term: that is exactly the
programme compression the old safety device (−20 dB / 8:1 / 30 dB knee) was applying to peaks at
−9 dBFS and no longer does. Bare, colour and every story floor are unchanged within 0.02 LU.
Stress scripts add −0.24 … +0.11 LU on top of the bed; the mining burst's integrated is dominated by
the bed because forty chips are 90 ms long.

## Duck traces (`after/summary.json#duckTraces`, `after-duck-storylead/`)

Two 16 s renders of the same bed, one with the cue at 8 s and the SFX sub-master muted, one with
no cue; window RMS ratio. Times are relative to the audible onset (raw trace minus the 10.34 ms
post-join latency shared by the impact and the ducked music).

**Superseded by the 1 ms re-run** (`repair/duck-1ms/`, S2-J3) — the 5 ms table below is kept for
the audit trail; read the repair table in "Repair loop" for the numbers that stand.

| edge | table | measured min | reached within 1 dB at | full depth at | back within 1 dB of unity at |
|---|---|---|---|---|---|
| shipCrash (sandbox) | music −6 dB / 40 ms / hold 100 ms / 900 ms | −6.0 dB | +35 ms | +40 ms | +840 ms |
| shipLand | −6 / 40 / 100 / 900 | −6.0 dB | +35 ms | +40 ms | +840 ms |
| terminalCorrupt | −4 / 30 / 150 / 700 | −4.0 dB | +25 ms | +35 ms | +670 ms |
| terminalAlarm | −4 / 30 / 150 / 700 | −4.0 dB | +25 ms | +35 ms | +670 ms |
| shipCrash under story lead | cap −3 dB | −3.0 dB | +30 ms | +40 ms | +700 ms |
| terminalCorrupt under story lead | cap −3 dB | −3.0 dB | +20 ms | +30 ms | +630 ms |

## Deviations and notes for the triad / owner

1. **The tail carries a named +1.99 dB reference gain (`TAIL_REFERENCE_GAIN_DB`), and the contract's
   two sentences cannot both hold.** Measured with the contract's own method (−30 dBFS probe tone,
   pre-tail tap vs the pre-Stage-2 tail), the shipped Stage 1 safety compressor was applying
   **+1.9929 dB of baked makeup gain** at bare and colour level. Every Stage 1 level — the bed at
   −20.5 LUFS, the story floors, the bare/colour re-baseline hashes — was measured through it.
   A literal "no makeup anywhere" tail would lower everything the player hears by 2 dB, break the
   −20.5 term, the floor comparisons and the re-baseline (b) tolerance, and leave the mix quieter
   without an owner decision. Stage 2 therefore cancels every compressor's own makeup exactly
   (safety −2.91, limiter −0.57, glue −4.27; each re-measured ≤ 0.005 dB by `audio:check`) and keeps
   the pre-existing level as ONE visible constant on the safety trim, so the tail's static gain is
   unchanged within 0.007 dB. This is a wording defect in acceptanceCriteria[5]/mixIntent, routed to
   the owner: either accept the named reference gain as the level architecture, or authorise a
   2 dB upstream re-level (protected paths) and re-baseline every level term.
2. **BLOOM short-term −14 ±1 LU is NOT reached and cannot be reached by the tail.** The Stage 1
   hypothesis (D1) was that the −20 dB / 8:1 / 30 dB-knee safety compressor was eating the BLOOM's
   spread. Measured: removing that squash (the safety device now sits at −6 dB and the bed peaks at
   −9 dBTP, so it never engages) raises S-max by **0.21 LU** (−18.12 → −17.90) and the integrated bed
   by 0.13. The bed's composed spread above its integrated level is 2.5 LU; a −14 window needs 6.5 LU
   of spread the arrangement does not write. The contract binds Stage 2 to open the window "by the
   mastering tail and never by an arrangement or story floor" — with no makeup and a subtract-only
   limiter, the tail has no mechanism left. Options for the owner/triad: retune `BLOOM_ST_LUFS` to the
   composed spread (≈ −18) as a Stage 2 acceptance, or authorise a BLOOM-only level rail in Stage 5
   (the arrangement stage) so the bloom gains, not the tail. No arrangement level was touched here.
3. **Stress scripts integrate at −20.4 … −21.7 LUFS, not −18 ±1.5.** The bed alone is contracted at
   −20.5; the −18 sum requires world/player SFX energy that these five scripts (and the shipped SFX
   recipes, at 0.012–0.09 linear gain) do not carry — even forty simultaneous mining chips peak at
   −4.9 dBTP and add 0.1 LU over 60 s. Nothing here may re-level SFX recipes (Stage 4) or the bed
   (Stage 1 term). Reported as measured; routed with deviation 2 to the loudness-architecture
   decision.
4. **Graph order versus mixIntent wording.** mixIntent names the tail "glue, true-peak limiter,
   safety device"; the plan (§3 Stage 2) and the treatment (§2) put the limiter after `masterOutput`.
   Only the post-join position can protect the SUM (the stress-script true-peak term is measured on
   the combined render), so the shipped order is glue → safety → musicDuck → masterOutput (SFX joins)
   → limiter → ceiling → route. The safety device acts on the music path only and only above −6 dB;
   the limiter owns protection for everything. Recorded as a wording deviation, not a design one.
5. **Latency for Stage 3 / C6 — now measured per sample rate (S2-D4, repair loop).** The tail's
   latency is not one number and not a fixed sample count: Chromium's `DynamicsCompressor` carries a
   pre-delay specified in TIME (rate-invariant) while the oversampled `WaveShaper`'s resampler is
   specified in SAMPLES (rate-dependent). `mixTuning.TAIL_LATENCY_BY_RATE_S` therefore carries one
   measurement per rate, each taken by `measureTailLatencyS` in an `OfflineAudioContext` **at that
   rate**, and the live path selects with `tailLatencyForSampleRate(ctx.sampleRate)` (nearest pinned
   rate).

   | rate | music path | SFX path | music − SFX | samples |
   |---|---|---|---|---|
   | 44 100 Hz (evidence render rate) | **25.215 ms** | **10.340 ms** | 14.875 ms (0.89 frame) | 1112 / 456 |
   | 48 000 Hz (common device rate) | **24.667 ms** | **10.000 ms** | 14.667 ms (0.88 frame) | 1184 / 480 |

   Dissent D-2 is resolved by measurement, in Cinematography's favour: deriving 48 kHz from the
   44.1 kHz sample count gives 23.167 ms, and the measurement is 24.667 ms — **1.5 ms of error
   avoided**. Both rates keep the music-versus-SFX offset inside one 60 Hz frame. Stage 3 sums device
   latency + the selected `musicPathS` for image members; the **five** `playSfx` bundle members
   (census corrected here from "three" — the count is the C6 amendment's, `c6-amendment.md`) may
   schedule their SFX forward by the selected `musicVsSfxS` to land on the audible music onset, per
   C6's stated option. `audio:check` re-measures **every pinned entry** each run (tolerance 0.5 ms);
   `mix/mixTuning.test.ts` pins the table and asserts it is not the 44.1 kHz figure rescaled.
6. **The 40-node mining burst is unlimited by design in the render, and its chips sum COHERENTLY.**
   The offline rim has no rate limiter and no frame queue, so the render measures the raw sum a call
   site could produce (worst TP −4.92 dBTP — the ceiling never engages on shipped material). Live, the
   per-frame queue collapses forty same-frame posts to one chip and the rate limiter/loop guard remain
   the backstop.

   Naming what that sum does (S2-J1): all forty chips at `STRESS_MINING_BURST_AT_S 20` are scheduled
   at **exactly the same instant** from one rim seed, so their attack transients coincide sample for
   sample and add **coherently** rather than as forty independently-timed chips would. That coherent
   onset is the **0.51 sample step at 20.013 s** the blind listener heard — identical before and after
   (inherited, not a Stage 2 effect), and the reason this script and no other approaches the ceiling
   (TP −4.92 dBTP). It is a property of the evidence script, not of the game: live, the frame queue
   collapses the forty posts and one chip sounds. The per-chip onset (~0.013 s into the recipe) is a
   Stage 4 recipe question, routed there under the spectral-fingerprint regression; Score owns it.
7. **Held-level law is a behaviour change at 16 ms granularity — deduped per flush within a frame;
   held-level across frames (corrected wording, S2-D7).** An SFX id posted in two consecutive
   animation frames sounds only on the first (`audioEventQueue.ts`); for the gated events the
   rate limiter already dropped such retriggers, and for one-shots a 16 ms double-trigger is the
   defect signature, not a design. `terminalKey` at the ledger's ~70 ms cadence (every 4 frames) is
   unaffected.

   This entry and `score-treatment.md` §2 previously said "deduped by `(id, frame)`". That is not what
   ships: the dedupe key is the **microtask flush** (`audioEventBus.ts:54-58`, `audioEventQueue.ts:53`),
   so two posts of one id in the same frame from **different tasks** both sound. The phrase is not in
   the contract, so this is a documentation correction and not a draft-v4 amendment. Keying
   `queuedThisFrame` to the frame clock is a two-line change that would honour the signed intent;
   HD-09 defers it.
8. **Snapshot mixer values.** Sandbox and menu are unity on every bus by law; story-lead steps the
   world bus −2 dB, dive −1.5 dB; station is registered with no live driver. `ui`/`voice` bypass the
   SFX muffle (contract mixIntent). The music bus is never re-levelled by a snapshot.
9. **Fingerprint stability.** Two renders of unchanged code differ at the renderer's float floor
   (1–4 LSB); the coarse windowed fingerprint can flip a quantisation bucket on alive-level material
   (`bed-sandbox-day` did between the Stage 1 `after` run and this `before` run at identical loudness).
   The bare/colour identity term is asserted on the pre-tail taps where it is stable (1 LSB).
10. **`sfxEngine` lost its own sub-master and muffle.** They live in audioCore's category buses now;
    recipes, seeds and the oxygen clock's direct (unqueued, unquantised) path are untouched. The SFX
    volume slider ramps through audioCore's `setTargetAtTime` slew instead of the old linear ramp —
    inaudible, only reachable by moving the slider.

11. **AudioParam writes/s: 2276 → 590, target < 60 not reached inside the Stage 2 lane.** The
    contract's "roughly 1140" was AudioDirector's per-frame legacy-engine automation
    (shipped-reference-map ref-08); that is eliminated (dirty check + 250 ms keep-alive, tested in
    `mix/automationDirty.test.ts`). The traced residual (`after-param-writes-trace.log`) is
    `scoreEngine.applyRails`, which re-issues ~32 idempotent `setTargetAtTime` targets every 60 ms
    scheduler tick while a story mood leads (528/s), plus one per-frame `rampParamAt` (60/s) from the
    score/bed schedulers. `scoreEngine.ts` is Stage 3's contracted surface (MOODS voicing through the
    brain rewrites `applyRails`' inputs) and is not in the Stage 2 lane, so the same dirty-check is
    routed to Stage 3 rather than applied here. Perf effect today: `score:fps` median 60.39 (gate
    PASS); the writes are cheap but the term stands unmet.

## Gate logs (mechanical verifier, 2026-09-05)

| step | exit | result |
|---|---|---|
| `node tools/audio-param-writes-probe.mjs ch4-vigil 8 3` | 0 | median 590.4/s (see deviation 11); `after-param-writes.{log,json}`, traced re-run `after-param-writes-trace.{log,json}` |
| `mining-metronome-probe.mjs ch1-fixed` on the restarted 5212 server | 0 | loop guard never engaged, max admit 1.33/s, max suppressed/3 s 0, 0/0 errors; `after-metronome.log`, `after-metronome/summary.json` |
| `npm run audio:check` | 0 | 13/13 PASS (adds safety-gain, limiter-gain, tail-reference, tail-latency, ceiling-tp), wall 27.3 s / 40 s; `audio-check.log` |
| `npm run score:fps` | 0 | median 60.39, p10 60.39, ratio 1.000 PASS; `fps.log` |
| `npm run score:soak:pure` | 0 | PURE SOAK PASS; `pure-soak.log` |
| `npm run verify` | 0 | 304 test files passed / 1 skipped, 2460 tests passed / 5 todo; audio:check wall 27.2 s; build ok; `verify.log` |

## Files

- `before/`, `after/` — 19 renders each (six owner excerpts, bare/colour/crawl, bed-check, combined
  90 s, five stress scripts, three story floors), `summary.json` with loudness (incl. the new
  `shortTermMaxAtS` and 1 s `shortTermSeriesLufs`), smoothness, PCM sha256 and windowed fingerprint;
  `after/summary.json` also carries `tailStageGains`, `duckTraces`, `ceiling`, `tailLatency`.
- `before-pretail/`, `after-pretail/` — the same bare/colour/floor renders tapped before the tail.
- `after-sweeps/` — smoothness battery. `after-duck-storylead/` — duck traces under a story lead.
- `before-param-writes.*`, `before-metronome*` — the live-app before column (D15 filed here).
- `ab-results.{json,md}` — per-term verdicts; `*-probe.log` — probe transcripts.
- Tests: `main/src/audio/audioCore.topology.test.ts` (Stage 2 graph law, live + mirror),
  `main/src/audio/mix/*.test.ts` (duck matrix, snapshot, event queue, event bus, ceiling curve,
  dirty-check, pinned constants), `main/src/audio/sfxEngine.test.ts` (bus join).

## Implementation-phase gate

`node tools/creative-triad-gate.mjs --run … --phase implementation`: every check passes except three
authority/baseline hash pins that only the orchestrator re-pins (as after Stage 1, production-lock.md
amendment log): `PARAVOXIA_AUDIO_10X_PLAN.md` now
63dfe93b126390b0042b0a2d2d3c65fb69a9e2f742c8c5a5a51175bf6975dd5b (Stage 2 §7 cells filled),
`PARAVOXIA_SCORE.md` now 9150dd276e75601f5aecc410ce4ae78f222287cb62765f0ee30b79cc7b0e9f68 (§1 signal
chain updated to what ships), and the UX baseline's `main/src/audio/sfxEngine.ts` source pin, now
360a05ef032b001ab71e33695770505b2b29c09cb17be30d21a3b7128d03013f (the SFX engine plays through the
category buses; recipes unchanged).

## Repair loop (Stage 2, post-judge — integration lane)

Judge `cohesion-judge-stage-2.md` routed `route_repair`. This section records the integration-owned
items that needed **no contract change and no signature**; every draft-v4 amendment, every
`defects.json` / `human-decision.json` / signoff edit and the `composedSpread` publication stay with
their owners. Source: same working tree as `after/`, plus the changes listed under "What changed".
Machine: one heavy process at a time, no dev server left running.

| defect | owner | what was done | status |
|---|---|---|---|
| **S2-D4** per-rate latency | integration | `TAIL_LATENCY_BY_RATE_S` measured at 44 100 and 48 000 Hz; `tailLatencyForSampleRate(ctx.sampleRate)`; `audio:check` pins both; test asserts it is not a rescaled sample count | **closed in code** (draft-v4 still carries the C6 sentence) |
| **S2-D7** dedupe wording | integration | `score-treatment.md` §2 and deviation 7 now read "deduped per flush within a frame; held-level across frames" | **closed** (documentation; HD-09 keeps the code deferred) |
| **S2-D11** two muffle doors | integration | single-authority comment on `sfxEngine.setSubmerged` / `setSubmergedSfx`: `setMixSnapshot` is the live authority, the scalar door is the offline rim's, both write one `sfxSubmergedEdge` flag, no third writer | **closed** |
| **S2-J1** mining-burst step | score (doc by integration) | deviation 6 names the coherent sum as the cause of the 0.51 step at 20.013 s | **documented**; Stage 4 recipe check still Score's |
| **S2-J2** dive lowpass edge | integration | dive script ramps submergence over 1.5 s in and out (`diveSubmergence`, tested); 0.1 s-resolution band-edge measurement and spectrograms for both versions | **closed**; owner still auditions the 80 ms SFX snap |
| **S2-J3** duck-attack margin | integration | duck traces re-run at **1 ms** resolution with raw and onset-adjusted times published | **closed**; draft-v4 wording still owed |
| **S2-J5** oxygenCritical untraced | integration | `oxygenCritical` added to the trace probe as a source-only target (raised by the body clock's critical breath) and measured | **closed**; Score still confirms the gesture |
| **S2-J7** lean/cost not re-measured | integration | `bed-sandbox-day` + `story-beat` rendered at quality **lean** through the new tail; `audio-thread-cost-probe main` run at lean/4×, full/1×, full/4× | **closed — all PASS** |
| S2-J4 metronome, S2-J6, S2-J8 | integration | **not touched here.** J6/J8 bind to draft-v4 and are being prepared elsewhere; J4's probe change is Stage 4-facing | open |

### S2-D4 — per-rate latency, measured

`repair/…` and the deviation-5 table above. `audio:check` now reads:

```
[PASS] tail-latency 44100 Hz: music 25.215 ms (pinned 25.215), sfx 10.340 ms (pinned 10.340);
                    48000 Hz: music 24.667 ms (pinned 24.667), sfx 10.000 ms (pinned 10.000),
                    tolerance 0.5 ms (TAIL_LATENCY_BY_RATE_S)
```

13/13 PASS, wall 27.3 s of a 40 s budget (`repair/audio-check.log`). Dissent D-2 resolves for
Cinematography: the samples-derived 48 kHz figure (23.167 ms) is **1.5 ms wrong**; the rate-invariant
figure (25.215 ms) is 0.55 ms wrong; only the measurement is right.

### S2-J3 / S2-J5 — duck traces at 1 ms, from the audible onset

`repair/duck-1ms/summary.json`, `repair/duck-1ms-storylead/summary.json`. Same two-render method;
`DUCK_TRACE_WINDOW_S` is now 0.001 s and every result carries `onsetLatencyS` (10.34 ms, the
post-join latency the impact and the ducked music both pass) and an `onsetAdjusted` block.

| edge | table (music) | measured min | within 1 dB of depth | full depth | back within 1 dB of unity |
|---|---|---|---|---|---|
| shipCrash / shipLand | −6 dB / 40 ms / hold 100 / rel 900 | −6.0 dB | **+34.7 ms** (raw 45.0) | +40.7 ms (raw 51.0) | +844.7 ms (raw 855.0) |
| terminalCorrupt / terminalAlarm | −4 / 30 / 150 / 700 | −4.0 dB | **+23.7 ms** (raw 34.0) | +30.7 ms (raw 41.0) | +674.7 ms (raw 685.0) |
| **oxygenCritical** (new) | −3 / 200 / 400 / 2000 | −3.0 dB | **+140.7 ms** (raw 151.0) | +199.7 ms (raw 210.0) | +1855.7 ms (raw 1866.0) |
| shipCrash under story lead | cap −3 | −3.0 dB | +28.7 ms (raw 39.0) | +40.7 ms (raw 51.0) | +704.7 ms (raw 715.0) |
| terminalCorrupt under story lead | cap −3 | −3.0 dB | +20.7 ms (raw 31.0) | +30.7 ms (raw 41.0) | +619.7 ms (raw 630.0) |

The judge's prediction is confirmed exactly. The old "passes with 0.34 ms margin" was a 5 ms-bin
artefact; at 1 ms the term separates into two honest numbers:

- **within 1 dB of table depth: 34.7 ms from the audible onset — 5.3 ms inside the row's 40 ms
  attack.** This is the judge's proposed draft-v4 wording, and it is met with real margin.
- **full depth: 40.7 ms — 0.7 ms PAST the attack constant.** Read literally ("−6 dB on music within
  40 ms"), the current criterion is missed by 0.7 ms, and it always would be: the row's ramp *ends*
  at the attack constant, so a windowed RMS cannot show full depth before it. The term is unmeetable
  as written, not marginally met. Every row shows the same 0.7 ms, which is the measurement, not the
  mix. Routed to the owner with S2-J3; nothing in the mix was changed to chase it.

**oxygenCritical (S2-J5).** The one active row that had no trace now has one, and it is the table:
−3.0 dB reached within 1 dB at 140.7 ms, full depth at 199.7 ms (inside the 200 ms attack), released
to within 1 dB of unity at 1.856 s. The blind listener's "−3.1 dB mood dip fading over ~4.9 s and
releasing over 5.7 s" is this row **re-triggered by successive critical breaths** — each pulse
re-arms a 2 s release — not a longer envelope. Score still confirms the sustained shape is the
intended dive gesture; the single-edge shape is now measured rather than asserted.

### S2-J2 — the dive edge is a slew, not a brick wall

The blind heard "a brick-wall ~6.3 kHz lowpass switching in at 8.5 s". Measured with
`main/tools/audio-band-edge-probe.mjs` (4096-sample / 93 ms analysis window, stepped every **0.1 s**,
2–8 kHz band), on `after/stress-oxygen-dive.wav` — the render that was heard:

| t | 8.3 s | 8.4 | 8.5 | 8.6 | 8.7 | 8.8 | 8.9 | 9.0 |
|---|---|---|---|---|---|---|---|---|
| 2–8 kHz, dB | 22.1 | 22.0 | 14.1 | 10.4 | 6.6 | 6.5 | 5.2 | 4.7 |

The band falls 16.7 dB across **five 0.1 s steps**, i.e. ≈0.5 s — the music path's
`MUSIC_SUBMERGE_ENTER_SLEW_S 0.42` plus the analysis window. A switch would fall inside one step.
The "brick wall" was the *script* stepping `submergence` 0 → 0.85 at 8 s, not the mix switching.

Fixed at the source (`excerpts.ts` `diveSubmergence`, `soak/diveScript.test.ts`): the dive script now
**ramps over `DIVE_RAMP_S` 1.5 s** in and out, longer than either music slew, which is what a swim
does. Re-rendered as `repair/after-dive-ramp/stress-oxygen-dive.wav`:

| t | 9.2 s | 9.3 | 9.4 | 9.5 | 9.6 | 9.7 | 9.8 | 9.9 |
|---|---|---|---|---|---|---|---|---|
| 2–8 kHz, dB | 22.8 | 18.5 | 16.8 | 12.3 | 9.1 | 6.4 | 7.2 | 4.9 |

The same 16.8 dB now takes ≈0.7 s and starts later (the cutoff mapping puts most of its travel at the
end of the ramp). Loudness is unmoved — I −21.686 vs −21.689, S-max −18.92 vs −18.92, TP −8.855 vs
−8.855, smoothness violations 10 in both (they come from the scripted SFX cues, not the edge; the
`before` render carried 9). PCM sha256 changes, so **`after/stress-oxygen-dive.wav` was rendered with
the stepped script and `repair/after-dive-ramp/` is the shipped script's render** — Stage 3's
`before/` pin for this one render should be the repair render, not `after/`. Every other render in
`after/` is unaffected: no other stress script touches `submergence` this way.

Spectrograms across the 7–12 s edge, 5 ms per column (20 columns per 0.1 s):
`repair/dive-edge-stepped.png`, `repair/dive-edge-ramped.png`. Row data:
`repair/dive-edge-stepped.json`, `repair/dive-edge-ramped.json`. **Owner still listens to the 80 ms
SFX muffle snap** (`SFX_SUBMERGE_EDGE 0.5`) — it is edge-snapped by design and was not changed.

### S2-J7 — lean tier and audio-thread cost through the new tail

Stage 2 adds five buses, a limiter and a 4× shaper to *every* tier, so the lean tier gets its own
evidence. Renders: `repair/after-lean/` (`--quality lean`, shipped tail).

| render | tier | I | S-max | LRA | TP | smoothness |
|---|---|---|---|---|---|---|
| bed-sandbox-day | lean | −19.71 | −17.48 | 3.20 | −9.20 dBTP | 0 |
| bed-sandbox-day | full (`after/`) | −20.36 | −17.90 | 3.19 | −9.02 dBTP | 0 |
| story-beat (a3-dawn) | lean | −19.46 | −17.57 | 2.37 | −8.90 dBTP | 0 |
| story-beat | full (`after/`) | −20.09 | −18.12 | — | −9.31 dBTP | 0 |

Lean sits **0.6–0.65 LU louder** than full (fewer layers, less mutual masking through the glue
compressor), still inside the bed's −20.5 ±1 LU term, still far under the −1 dBTP ceiling, and still
at zero smoothness violations. The tail behaves identically on both tiers.

`node main/tools/audio-thread-cost-probe.mjs main …` on the SwiftShader gate, worst phase story-led:

| run | budget | measured | fps median (bed-led / story-led) | verdict |
|---|---|---|---|---|
| `--tier lean --throttle 4` | 3 ms/frame | **0.044 ms/frame** | 60.42 / 60.40 | PASS |
| `--tier full --throttle 1` | 1.5 ms/frame | **0.020 ms/frame** | 60.39 / 60.38 | PASS |
| `--tier full --throttle 4` | 1.5 ms/frame | **0.046 ms/frame** | 60.40 / 60.40 | PASS |

Logs and JSON: `repair/cost-main-lean-4x.{log,json}`, `repair/cost-main-full-1x.{log,json}`,
`repair/cost-main-full-4x.{log,json}`. Stage 2 is independently shippable on the lean tier: the
audio main-thread cost is **1.5 % of the lean budget** at 4× CPU throttle, and the longest single
scheduler callback is 3.3 ms (lean/4×) against a 16.7 ms frame.

### What changed in the tree (integration lane only)

- `main/src/audio/mix/mixTuning.ts` — `TAIL_LATENCY_BY_RATE_S`, `LATENCY_COMP_PINNED_RATES`,
  `tailLatencyForSampleRate()`; the old constants are now aliases of the 44.1 kHz entry.
- `main/src/audio/mix/mixTuning.test.ts` — per-rate pins, the "not a rescaled sample count" assertion,
  and the nearest-rate selection law.
- `main/src/audio/soak/excerpts.ts` — `measureTailLatencyS({ sampleRate })`; `audio:check` measures
  every pinned rate; duck traces at 1 ms with `onsetAdjusted` and `fullDepthAtS`; `oxygenCritical` as
  a source-only duck target; `diveSubmergence()` ramp.
- `main/src/audio/soak/soakPage.ts` — the two widened harness signatures.
- `main/src/audio/soak/diveScript.test.ts` — new; the ramp's laws.
- `main/src/audio/sfxEngine.ts` — **comment only**: the muffle's single-authority note (S2-D11).
- `main/tools/audio-stage-evidence-probe.mjs` — `--latency` measures every pinned rate,
  `--latency-rates`, duck logging prints raw and onset-adjusted times, `--duck oxygenCritical`.
- `main/tools/audio-band-edge-probe.mjs` — new; band energy over time across an edge (S2-J2).
- `score-treatment.md` §2 and this README (deviations 5, 6, 7; duck table; this section).

Untouched by design: `scoreEngine.ts`, `storyScore.ts`, `storyDirector.ts`, `signedSceneAvRuntime.ts`,
`emergentStoryDirector.ts`, `bedEngine.ts` (Stage 3's surface), `audioCore.ts`, and every contract,
signoff, decision and lock artefact.

### Gate logs (repair loop)

| step | exit | result |
|---|---|---|
| `npx vitest run src/audio` | 0 | 43 files / 380 tests passed; `repair/vitest-audio.log` |
| `npm --prefix main run audio:check` | 0 | 13/13 PASS incl. per-rate `tail-latency`; wall 27.3 s / 40 s; `repair/audio-check.log` |
| `audio-stage-evidence-probe --only '' --duck …` ×2 | 0 | five 1 ms traces + two story-lead; `repair/duck-1ms*/` |
| `audio-stage-evidence-probe --only bed-sandbox-day,story-beat --quality lean` | 0 | `repair/after-lean/` |
| `audio-stage-evidence-probe --only stress-oxygen-dive` | 0 | `repair/after-dive-ramp/` |
| `audio-thread-cost-probe main` ×3 | 0 | lean/4× 0.044, full/1× 0.020, full/4× 0.046 ms/frame — PASS |
| `audio-band-edge-probe` ×2 | 0 | `repair/dive-edge-{stepped,ramped}.{json,png}` |
