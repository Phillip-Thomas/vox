# Stage 1 evidence — bed timbre and mastering pass

Contract draft-v2 (sha256 384120dc02b2ea46d855c4d0a360fbd31a93eb47624c00d954eaac7f494a9a6d),
source revision b631a52 working tree. All renders come from the real engines on the
score-soak harness via `main/tools/audio-stage-evidence-probe.mjs`; `before/` was
captured before any instrument edit, `after/` after, `after-noglue/` after with the
glue stage bypassed (`musicBusGlue:false`). `ab-results.{json,md}` is produced by
`main/tools/audio-stage-ab-compare.mjs`.

## Acceptance terms (contract evidence line for Stage 1)

| term | required | measured | verdict |
|---|---|---|---|
| colour partials sounding | 5 of 5 | 5 upper voices fed from `publish.tones.slice(1, 6)` (`PAD_VOICES_FULL 5`) | met |
| WaveShaper stages in music path | 3 + soft clip | pad, sub, lead drive (tanh, unity slope) + glue soft clip | met |
| bed at alive, integrated, alone | −20.5 ±1 LU | home planet day −20.48, contrast A −20.53, contrast B −21.07, **home planet night −20.51** (repair loop, D4: `BED_NIGHT_TRIM_DB −2.0` × dusk depth × padChoir on the same bed-bus rail as `BED_ALIVE_LIFT`; before the trim night measured −18.99 because the shipped night sub/shimmer lifts also lifted level); lean tier day −19.85 / night −19.87 | met (day, night, both contrast planets, both tiers) |
| BLOOM short-term | −14 ±1 LU | S-max −18.12 / −16.95 / −16.88 / −18.94 (excerpts), −18.75 (bed-check) | **not met** — see deviation 1 |
| true peak | ≤ −1 dBTP | worst −7.28 dBTP (night); combined-check −9.15 | met |
| smoothness battery | 0 violations | sandbox 0 (max 0.99 dB), era-build 0 (1.43 dB), story-handoff 0 (4.22 dB); before 0/0/0; audio:check smoothness 0 violations, max 1.39 dB | met |
| score:fps median (SwiftShader gate) | ≥ 60 | median 60.38, p10 60.37, baseline 60.40, ratio 1.000 → PASS (bed scheduler alive under the a3-dawn stress mood) | met |
| bare-era regression | crawl→ch1-fixed hash identical except glue | `bare-bed`, `bare-story-ch1-fixed` (bed at era 0 then real `ch1-fixed` story handoff at 24 s) and `color-bed` (era 0.35): after-with-glue-bypassed vs before → **windowed fingerprint identical and max \|Δ\| ≤ 2 LSB (≤ −84 dBFS)** — the renderer is not bit-deterministic at the float floor across runs (builder run: 1 LSB; verifier's independent re-render: 2 LSB on `bare-story-ch1-fixed`; unchanged code re-rendered twice at alive level differs by 3 LSB at −80.8 dBFS), so the differing-sample count is a per-run observation, not a bound, and `audio-stage-ab-compare.mjs` now asserts fingerprint parity plus the 2 LSB ceiling; after-with-glue → ΔI 0.00/+0.01/−0.01 LU, TP within 0.04 dB; the only sample-wise difference is the glue compressor's fixed look-ahead latency (see deviation 2). "Inaudible at colour" is proven to era 0.35 and holds by construction to 0.38 (`padChoir` onset), not to 0.5 | met |
| pure soak | green | `pure-soak.log`: PURE SOAK PASS, replay-determinism bit-identical, seed-divergence pass | met |

## A/B summary (full table in `ab-results.md`)

Six owner excerpts, integrated LUFS before → after: sandbox-day −24.55 → −20.48;
sandbox-night −22.93 → −18.99; contrast-A −25.02 → −20.53; contrast-B −25.29 → −21.07;
story-beat −19.95 → −20.18 (story score is NOT re-levelled in Stage 1; the glue at unity
static gain leaves it within 0.25 LU); era-transition −26.10 → −22.58. Correlation moves
0.962 → 0.936 (day) — wider by side-panned unison, still mono-compatible; the 200–800 Hz
band gains +3 to +5 points (drive harmonics, colour tones) while zero-crossing rate falls
(per-voice lowpass + HF-damped room). Sub band fraction falls 2–5 points (mono-below
crossover + 28 Hz floor). Loudness range on the 90 s bed-check falls 6.88 → 3.26 LU.
audio:check (combined, rendered twice): −20.40 LUFS, TP −9.15 dBTP, replay Δ 3.05e-5,
all checks PASS; wall 25.5 s against the Stage 0 advisory 25 s budget, raised to 40 s
(the instrument renders ~1.7× slower offline — see deviation 8).

## Deviations and notes for the triad / owner

1. **BLOOM short-term −14 not reached.** With the bed at −20.5 integrated, the short-term
   maximum sits 2.3–3.4 LU above it. The safety compressor (threshold −20 dB, ratio 8,
   default 30 dB knee — protected in Stage 1) compresses everything above about −35 dBFS;
   raising input by 1 dB raises output by only ~0.4–0.8 dB in this range, so the BLOOM
   cannot open a 6.5 LU window while it stands. Arrangement levels are out of Stage 1
   scope by contract. Route: Stage 2 (limiter replaces the safety compressor's role) or
   an owner decision to retune the BLOOM target for Stage 1.
2. **Glue latency.** Chrome's DynamicsCompressor carries a fixed look-ahead (~6 ms). The
   glue adds one more such stage to the music path only; SFX join post-compressor. Stage 3's
   grid claims (±1 ms) and Stage 2's duck timing must account for it (`LATENCY_COMP`).
3. **Glue static gain.** Chrome bakes a makeup gain into DynamicsCompressor; measured
   +4.27 dB for the glue settings (`measureGlueStaticGainDb`). `GLUE_MAKEUP_COMP_DB −4.27`
   cancels it (re-measured 0.002 dB), so the glue stage has unity static gain and the
   bare/colour eras and every authored quiet pass it unchanged. The safety compressor's
   own baked makeup is pre-existing and untouched.
4. **Level rebalance is era-gated.** `BED_MASTER_GAIN` stays 0.85 (it also scales the
   chip eras). The alive target is reached with `BED_ALIVE_LIFT 1.1` (README previously
   said 1.2 — D8 corrected; the code was always 1.1) applied to the bed bus and both room
   returns as 1 − (1 − LIFT·nightTrim)·padChoir, so bare/colour are untouched by
   construction and the awakening earns its weight. Repair loop (D4): `nightTrim` =
   10^(`BED_NIGHT_TRIM_DB −2.0` × depth / 20), depth = smoothstep over daylight below
   `BED_NIGHT_TRIM_DAYLIGHT_ONSET 0.5` — exactly 1 for every daylight ≥ 0.5 render, so
   the day/contrast renders are unchanged (fingerprint identical; PCM within the
   renderer's 3 LSB run-to-run floor) and only the night bed moves (−18.99 → −20.51).
   All Stage 1 rails now resolve through one pure function, `resolveStage1Rails`
   (`bedEngine.ts`), unit-tested to be exactly 0/1 at padChoir 0 (D6).
5. **Streamed loops / drone bank not retired.** The contract's Stage 1 text does not
   include the retirement; the plan (§4) and treatment tie it to the Stage 1 owner
   audition. Left for that audition — no `musicEngine.ts` change in this diff.
6. **Story score level untouched.** `scoreEngine.ts` was changed for the reverb impulse
   only (now stereo, shared generator). Story moods pass the glue at unity static gain.
8. **Audio-thread cost.** Measured in the repair loop — see `perf.md` (offline
   throughput before/after per tier via `tools/audio-thread-cost-probe.mjs offline`, and
   main-thread timer cost under the score at 1× and 4× CPU throttle on the SwiftShader
   gate via `... main`). Offline renders run ~1.7× slower than before (210 s excerpt
   15 s → 26 s): 5 voices × (6 saws + octave + organ), per-voice filters and wander LFOs,
   three drives, the LR4 crossover and stereo rooms. Main-thread `score:fps` is unaffected
   (audio renders on its own thread). Per-saw panners were collapsed to two side panners
   per voice and the lowpassed family drives dropped oversampling (which also removed a
   resampler-latency comb against the dry path) to claw back throughput; the `lean` tier
   (3 voices × 3 saws, no lead drive) is the mobile budget.
7. **Bare-era smoothness counts** (51 → 54 on `bare-bed`) are the chip arp transients the
   excerpt-level metric already counted before Stage 1; the battery (three sweeps and
   audio:check) is 0 before and after. `era-transition` keeps its 12 (stage-bloom
   gestures, audited separately through the continuous-control mirror as before).

## Files

- `before/`, `after/`, `after-noglue/` — WAVs (16-bit) + `summary.json` (loudness, spectral
  proxy, smoothness, PCM sha256, windowed fingerprint sha256) + probe logs.
- `ab-results.json`, `ab-results.md` — per-excerpt deltas and the bare-era comparison
  (verdict = fingerprint identical AND max |Δ| ≤ 2 LSB).
- `after-d4/`, `after-d4-lean/`, `after-d4-repeat/` — repair-loop renders: night + day at
  full and lean tiers with the night trim; `after-d4-repeat/` is a second render of the
  same code (the run-to-run LSB floor baseline). `after/` is refreshed from the same code
  at the end of the loop so it can be pinned as Stage 2's `before/`.
- `perf/`, `perf.md` — D3 audio-thread and main-thread cost measurements.
- `topology` and rail law: `main/src/audio/audioCore.topology.test.ts`,
  `main/src/audio/generative/tuning.stage1.test.ts` (D6); glue static gain asserted in
  `audio:check` as `glue-gain` (D7).
- `pure-soak.log`, `verify.log` — gate logs. `fps.txt` — score:fps RESULT line.
