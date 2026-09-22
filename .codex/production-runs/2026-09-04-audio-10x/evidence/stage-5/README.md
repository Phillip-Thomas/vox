# Stage 5 — long form: section planner, whole-bar law, the pulse, the BLOOM rail

Contract: `scene-contract.json` draft-v4, SHA-256
`672de45a0c8257d334d052cbedf4247fd09b0f1dba385cc5fb9d06e04459d41d`, terms
`acceptanceCriteria[14]`, `[15]`, `[16]` and the amended `[6]` BLOOM term. Score Director
acting as integration engineer for the score lane, BOUNDED to avoid the live Stage 3 build.
Working tree at capture time carried Stage 3 in flight (scoreEngine/storyScore/harmonyBrain/
audioCore/soak/** modified, untouched here); `before/` is that tree with none of the Stage 5
files changed, captured first.

## What changed (files for `implementation.diff` — Stage 3 owns the diff; not regenerated here)

New: `main/src/audio/generative/sectionPlanner.ts` (+ `.test.ts`), `main/src/audio/generative/pulse.ts`
(+ `.test.ts`), `main/src/audio/generative/bedConductor.stage5.test.ts`,
`main/tools/score-stage5-soak-stats.ts`, `main/tools/audio-stage5-compare.mjs`.
Edited: `main/src/audio/generative/arrangement.ts` (+test), `phraseMemory.ts` (+test), `soak.ts`
(+test), `worldSignals.ts` (+test), `bedConductor.ts` (bed-led paths only), `tuning.ts`
(append-only block "Stage 5 long form"), `main/src/audio/bedEngine.ts` (pulse voice nodes in
`buildBedGraph`, per-bar rim: pulse onsets, breath keyed to the pulse, multi-phrase riser target,
hand-back note on the resume edge, debug snapshot fields), `PARAVOXIA_AUDIO_10X_PLAN.md` §7 rows.
NOT touched: harmonyBrain.ts, theory.ts, bedConductor mood paths, scoreEngine.ts, storyScore.ts,
storyDirector.ts, audioCore.ts, mix/**, sfxEngine.ts, soak/** (excerpts/offlineRender/soakPage).

## The mechanism

1. **Section planner** (`sectionPlanner.ts`, pure). `planSection(seed, sectionIndex, startPhrase,
   signals, history)` emits a 4–8-phrase intention: `statementSchedule`, `registerArc`
   (rise/fall/arch/plateau, ±5 st), `densityArc`, `withheldLayer` (shimmer/percussion/lead/
   ostinato), `bloomBudget`, `buildPhrase`, `buildSpanPhrases` 1–3, `bloomPhrases` 1–2,
   `recapPhrase`. Seeded on `(planetSeed, sectionIndex, try)`; the (schedule, arc) pair is
   never reused in a run (re-draw, then deterministic nudge). The opening section always blooms
   with a one-phrase build on phrase 2–3 (the planet introduces itself); ≤ 2 dry sections in a
   row; a section planned after a story hand-back carries `bloomBudget 0` and plateau|fall and
   releases any gesture in flight (`noteStoryHandBack`, called by the rim on the yield→resume
   edge, live and offline).
2. **Arrangement intent** (`arrangement.ts`). The machine keeps its states, era caps, dwell bounds
   and forced gestures; with an `intent` it no longer draws BED→BUILD, starts the BUILD where the
   planner said, spans `buildSpan` phrases and blooms for exactly `bloomPhrases`. Forced (warp/
   launch) builds keep the shipped one-phrase span and are flagged `forcedBuild`.
3. **Whole-bar law** (`phraseMemory.hashBar`, `BAR_TABU 32`). Fingerprint = chord + pad voicing +
   arrangement + statement chain + ostinato `slot:semis` + percussion onsets + layer levels
   quantized to `BAR_LEVEL_QUANTUM 0.05`. On a collision the conductor applies operators in cost
   order (percussion rotation → ostinato ornament flip → cell length ±1 → percussion k+1 /
   octave → drop last note → octave down) and re-checks; `BAR_TABU_BYPASS_BUDGET 4 / 1056 bars`
   is the audited exception. REST is composed stillness (sub + one soft pad on a held chord,
   owner ruling #4): REST bars are recorded but never varied or counted as bypasses; they still
   count against `barNovelty`.
4. **Variation the law rides on**: density arc → ostinato cell length (2..contour) and percussion
   k; reality `detail` mixes into density (`DETAIL_DENSITY_FLOOR 0.5`); per-bar seeded ornament
   (`OST_ORNAMENT_P 0.3`, last note up an octave); phrase fill (`PERC_FILL_K 2` on bar 8);
   per-phrase percussion rotation swing on top of the region turn; REST sub-swell with a seeded
   peak bar; register arc added to the drift clocks' `registerShift`.
5. **The pulse** (`pulse.ts` + `bedEngine.pulseHit`). Root-tuned: click (2 ms noise, HP 2 kHz) +
   sine body 80 Hz → chord-root sub folded into [40, 80) Hz over 120 ms + tail (60 ms noise, BP
   200 Hz). Body into the designed sub path (drive/LP/mono-below), click+tail dry. Level
   `PULSE_LEVEL_BUILD 0.5` half-time (beats 0,2 in 4/4; beat 0 in 6/8), `PULSE_LEVEL_BLOOM 1`
   every felt beat, × the era sidechain gate (material+); body × the alive fade (contract [16]:
   click + tail alone at material). `sidechainDepth = SIDECHAIN_DEPTH × PULSE_BREATH_SCALE 0.6 ×
   pulse.level`; the breath dips are scheduled on the pulse onsets and nowhere else. Both
   envelopes are slewed per bar (`LIFT_BAR_SLEW 0.5`): a forced EBB releases over ≤ 2 bars
   instead of cliffing; the final BLOOM phrase pre-releases over its last 2 bars.
6. **BLOOM rail** (arrangement-level, in `bedConductor` on `plan.levels`; no bus, no tail).
   BUILD rises to `BUILD_LIFT_CAP 0.2`; the crest (`BLOOM_CREST_BARS 2`) is 1.0; then
   `BLOOM_LIFT_SUSTAIN 0.15`. Per-family dB at full lift: pad/texture `BLOOM_RAIL_DB 10`,
   percussion 7, ostinato 5, lead 3, sub 4.5 — the swell is the pads', the tune never shouts,
   short voices lift less so note offsets at the crest never step the programme.
7. **Dead mappings**: `oxygen` → `resolveOxygenControls` (strain under water as oxygen falls
   below 0.5: sub-motif/ostinato density thins, pad brightness rolls off; identity at oxygen 1
   or on dry land, so every existing render is unchanged); `detail` → ostinato/percussion
   density. `biomeWeights` is NOT a BedSignals field and its only musical home is the mode
   weights in harmonyBrain (out of bounds) — deferred with the chord pool, see deviations.

Era law: the long-form layer arms at material (`era ≥ ERA_MATERIAL` and not bare). Below it the
shipped one-phrase machine, statement draws, 3-note cell and percussion stand untouched, so the
bare and colour renders are fingerprint-identical by construction — the chip eras loop the way
chip music did; composing across phrases is a fidelity rung the awakening earns.

## Evidence

### Pure soak, 32 min fullSoak, seeds 5 / 8 / 10 (`before/pure-soak/`, `after/pure-soak/`)

| metric | before (5 / 8 / 10) | after (5 / 8 / 10) | term |
|---|---|---|---|
| barNovelty | 0.495 / 0.313 / 0.441 | **0.966 / 0.868 / 0.928** | ≥ 0.85 — met |
| whole-bar tabu bypasses | (no law) | **0 / 0 / 0** | ≤ 4 — met |
| harmony chord-tabu bypasses (`tabuBypasses`) | 16 / 100 / 20 | 13 / 100 / 16 | ≤ 4 — **deferred** (harmonyBrain) |
| distinctChords | 21 / 17 / 14 | 22 / 16 / 15 | ≥ 30 — **deferred** (chord pool) |
| melodyStatements | 17 / 22 / 17 | 17 / 30 / 21 (all planner-scheduled) | — |
| sections | — | 12 / 21 / 13, repeated (schedule, arc) pairs 0 | met |
| BLOOM episodes (lengths in phrases) | 7 [1,1,1,1,2,1,1] / 7 [2,1,1,2,2,2,2] / 6 [1,1,2,2,1,2] | 10 [2,2,1,2,2,1,2,2,1,1] / 9 / 8 | — |
| BUILD spans (phrases) | always 1 | 1–3 (e.g. seed 10: [1,1,1,3,1,2,3,3]) | — |
| bloom-paid / bloom-budget audits | (none) | PASS / PASS, every planned bloom paid by a withhold | red test in soak.test.ts |
| worst normalized bar step | 0.626 / 0.688 / 0.633 | 0.626 / 0.688 / 0.633 (bloomLift, pulseLevel now audited too) | ≤ 0.7 — met |
| legality / mediant / mode-drift / deadlock | PASS | PASS (unchanged grammar) | met |
| arrangement histogram (seed 5) | BED 328 BUILD 56 BLOOM 64 EBB 72 REST 104 | BED 224 BUILD 112 BLOOM 128 EBB 96 REST 64 | — |

Replay determinism and seed divergence: `npm run score:soak:pure` (see `after/pure-soak.log`).

### The four beds, 210 s, shipped tail (`before/beds`, `after/beds`; A/B in `after/ab/ab-results.md`)

| render | I before → after | S-max before → after | TP after | smoothness |
|---|---|---|---|---|
| bed-sandbox-day | −20.36 → **−20.10** | −17.90 → **−14.83** (78.3 s) | −5.11 | 0 |
| bed-sandbox-night | −20.39 → **−20.27** | −18.04 → **−14.70** (77.7 s) | −5.89 | 0 |
| bed-contrast-A | −20.39 → **−19.97** | −16.59 → **−14.06** (45.0 s) | −4.87 | 0 |
| bed-contrast-B | −20.96 → **−19.57** | −18.79 → **−14.80** (72.4 s) | −5.30 | 0 |

All four: S-max −14 ±1 met, bed-alone I −20.5 ±1 met, TP ≤ −1 met, smoothness 0. The named
`composedSpread` (pre-tail S-max − pre-tail I, `before/beds-pretail`, `after/beds-pretail`) is
published per bed in `after/ab/ab-results.json` / `.md`: **2.72 → 7.35, 2.71 → 7.53, 4.39 → 8.43,
2.29 → 6.94 LU** — every bed now composes more than the 6.5 LU the window requires (Stage 2 measured
2.5). LRA 3.7/3.4/3.8/5.3 → 7.8/8.1/5.4/4.0. Bare/colour: fingerprint identical before/after
(`0249349aa58b…`, `6a81f0012185…`); the raw float pcm hash differs between two renders of the SAME
tree (stage-2/after vs stage-5/before), so the fingerprint is the pinned identity and pcm is
informational.

Tuning iterations kept for the record: `after/beds` (first pass, rail 4.5 dB: S-max −15.8…−14.9,
day I −19.36, night 1 smoothness violation from a lifted lead note offset), `after/iter1`
(8 dB, 2-bar crest: S-max met, day I −19.31), `after/iter2` (per-family rail: I met, S-max
−15.6…−15.8), `after/iter3` = final constants.

### Other checks

| check | result | log |
|---|---|---|
| `npm run audio:check` | 13/13 PASS, wall 27.9 s / 40 s (replay fingerprint dbf9f25b0046fedf; smoothness 0, max 3.07 dB; TP −8.79) | `after/audio-check.log` |
| `npm run score:fps` | SwiftShader gate PASS: median 60.39, p10 60.38, ratio 1.000, worst frame 16.80 ms (score leading, material, era 1) | `after/fps.log` |
| pure soak stats tool (32 min × 3 seeds, replay-deterministic logs) | PASS all audits (bar-tabu, bloom-paid, bloom-budget, section-pairs added) | `after/pure-soak/pure-soak-stats.{txt,json}`, `soak-log-seed*.json` |
| targeted vitest `src/audio/generative` (21 files) | 280 / 280 passed — new: sectionPlanner (10), pulse (6), bedConductor.stage5 (10), bar-law (3), intent (5), oxygen (1), Stage 5 red tests (5) | run inline; see below for the offline soak / verify rows |
| real OfflineAudioContext soak (`node score-soak-probe.mjs soak 32`) | see `after/offline-soak.log` (row appended below when the run ends) | `after/offline-soak.log` |

## Deviations and open items

1. **distinctChords ≥ 30 and harmony `tabuBypasses` ≤ 4 are NOT met** — both live in
   `harmonyBrain.ts` / `theory.ts` (chord-pool widening: 7th-degree, quartal, sus voicings), out
   of this commission's file boundary while Stage 3 is live. Deferred to the Stage 5 second pass;
   the soak now reports `barTabuBypasses` (the new law) beside the unchanged `tabuBypasses`.
2. **`biomeWeights`** is not a BedSignals field; the plan's "blend into mode weights" is a
   harmonyBrain change — deferred with (1). `oxygen` and `detail` are consumed.
3. **REST exempt from the bar tabu.** A held chord under sub + one soft pad recurring is stillness,
   not a loop; REST bars still count against `barNovelty` (seed 8's 0.868 is the REST-heavy frozen
   planet). Contract [14] wording ("no section repeating…", barNovelty ≥ 0.85) is met.
4. **Pulse body band [40, 80) Hz, not 40–60.** A 40–60 Hz band is narrower than an octave and
   cannot hold every root's pitch class; the body stays root-tuned (one harmonic truth) rather than
   clamped off-pitch.
5. **Release tail.** After a forced EBB (warp exit) the pulse/breath decay over ≤ 2 bars
   (`LIFT_BAR_SLEW`), so the breath still follows the pulse and the smoothness law holds; planned
   blooms pre-release inside their last phrase instead.
6. **Hand-back is generic.** BedSignals carries no beat id; the rim marks every story→bed
   hand-back, so the restrained section follows ANY story lead, a superset of ch4-defy / seam-ebb
   / the 'no.'.
7. **Long form arms at material.** Bare/colour keep the shipped grammar (renders identical); the
   contract's barNovelty term is measured at era 1 (fullSoak), where it holds.
8. **Blind two-excerpt check (contract [15])** needs 3-minute excerpts 20 minutes apart from one
   seed; excerpt specs live in `soak/excerpts.ts` (Stage 3's file) — not rendered here, routed to
   the verifier/naive viewer once Stage 3 lands.
9. `pcmSha256` is not a stable baseline (see above); `fingerprintSha256` is.
10. Score-treatment §5 said "subMotif" as a withheld layer; shipped as `ostinato` (the sub motif
    is the ostinato's underwater crossfade, not a separate layer).
