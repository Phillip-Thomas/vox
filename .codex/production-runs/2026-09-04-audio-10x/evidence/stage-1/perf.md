# Stage 1 audio cost — D3 measurement (repair loop, 2026-09-05)

Contract draft-v2 terms (`performance.measurementPlan`, `score.performancePlan`,
`evidence.captures[5]`): audio main-thread cost ≤ 1.5 ms/frame full and ≤ 3 ms/frame
lean, on the SwiftShader gate with the CPU throttled 4× for lean; `score:fps` median ≥ 60.
Tool: `main/tools/audio-thread-cost-probe.mjs` (new, in `main/tools/`; the shipped
`fps-score-probe.mjs` lives outside the locked allowed paths and was not edited).
Raw JSON per run in `perf/`.

## 1. Audio-thread DSP cost — offline real-time factor per tier

Method: wall time to render the 210 s `bed-sandbox-day` excerpt on the score-soak
harness (OfflineAudioContext + the harness's loudness/health analysis, so an upper
bound on DSP), best of two runs. Before = a git worktree of `b631a52` (the pre-Stage-1
tree; single tier, `renderExcerpt`) sharing this machine's `node_modules`; after = the
working tree via `renderStageEvidence`. Real-time factor r means the audio thread spends
r × 16.67 ms per 16.67 ms of audio.

| tree | tier | wall (best) | real-time factor | ≈ DSP ms per 16.67 ms frame | vs before |
|---|---|---|---|---|---|
| before `b631a52` | single | 14.05 s | 0.0669 | ≤ 1.115 ms | — |
| after Stage 1 | full | 24.85 s | 0.1184 | ≤ 1.973 ms | 1.77× |
| after Stage 1 | lean | 20.60 s | 0.0981 | ≤ 1.635 ms | 1.47× |

The README's "~1.7× slower offline" estimate is confirmed (1.77×). The audio thread has
~8× real-time headroom at full, ~10× at lean, on this machine's single core; at a 4×
CPU slowdown that is still ~2× / ~2.5× real time, i.e. no dropout margin issue at either
tier. This is the audio thread — it is not the budgeted main thread.

## 2. Audio MAIN-thread cost — timer ms/frame under the score (SwiftShader gate)

Method: `audio-thread-cost-probe.mjs main`. Same harness as `score:fps` (forced
SwiftShader WebGL clear at 640×360, `material` stage, era 1). Before any module loads,
`window.setInterval`/`setTimeout` are wrapped so every timer callback is timed; the
bed and score lookahead schedulers are the only main-thread audio work (rAF writes
intent only). Figure = summed callback ms ÷ rAF frames, median of 5 × 3 s windows;
an upper bound (every timer on the page is counted). Phases: baseline (no audio),
bed-led (home planet sandbox-day script at era 1, bed graph built live, bars planned),
story-led (`a3-dawn` at intensity 1 over the bed — the `score:fps` stress state).
Verdict on the worse phase. 4× = CDP `Emulation.setCPUThrottlingRate` (DevTools "4×").
Lean forced via the live tier resolver's own inputs (`navigator.hardwareConcurrency 2`,
`deviceMemory 2`); the bed snapshot confirms `tier=lean`.

| tier | throttle | bed-led ms/frame | story-led ms/frame | worst | budget | longest callback | timer calls/s | fps median (baseline → story-led) | verdict |
|---|---|---|---|---|---|---|---|---|---|
| full | 1× | 0.012 | 0.025 | 0.025 | 1.5 | 1.3 ms | 33.4 | 60.39 → 60.39 | PASS |
| full | 4× | 0.027 | 0.058 | 0.058 | 1.5 | 2.7 ms | 33.5 | 60.42 → 60.40 | PASS |
| lean | 4× | 0.023 | 0.067 | 0.067 | 3.0 | 4.2 ms | 33.3 | 60.41 → 60.39 | PASS |

Reading: the main-thread audio cost is ~0.03 ms/frame at 1× and ~0.06–0.07 ms/frame at
4× throttle — 2–4 % of the contracted budget; the two 60 ms schedulers together fire
~33 times a second and the longest single callback (a bar plan + schedule at 4×
throttle, lean) is 4.2 ms, inside one frame. Frame rate is vsync-capped and unchanged.
Stage 1's 1.7× DSP cost lives entirely on the audio thread; the main thread saw no
per-frame node churn (the pad ensemble is persistent voices with parameter automation).

## 3. Caveats, honestly

- Offline wall time includes the harness analysis pass (ebur128, smoothness, hashing),
  so the DSP figures are upper bounds; the before/after ratio is fair because both trees
  run the same analysis.
- The timer wrap counts every timer on the page, not only audio; the baseline phase
  measures 0 timer calls/s, so on this harness the figure is the audio schedulers alone.
- The main-thread numbers are for the soak harness, not the full voxel scene; the
  contract's term is a delta over the shipped runtime, and this probe measures exactly
  that delta (audio schedulers) in isolation, as `score:fps` does.
- The story-led phase is heavier than the bed-led phase because two schedulers run;
  the bed yields musically but keeps planning bars so hand-back is gapless.
- The pre-Stage-1 worktree has no lean tier (one tier existed), so "before lean" is n/a.

## 4. Files

`perf/offline-before-b631a52.{json,log}`, `perf/offline-after-full.{json,log}`,
`perf/offline-after-lean.{json,log}`, `perf/main-full-1x.{json,log}`,
`perf/main-full-4x.{json,log}`, `perf/main-lean-4x.{json,log}`.
