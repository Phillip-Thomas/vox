# Shipped Reference Map — audio 10x

Status: authored from `PARAVOXIA_AUDIO_10X_PLAN.md` sections 1 and 3 at run
open. Every row records shipped behavior as shipped; the line anchors are the
plan's own, taken at source revision `b631a52065a1a69fecac0331e69515c306408641`
and to be re-confirmed by the Stage 0 evidence floor before any stage contract
is signed against them.

## Shipped reference

| ID | Status | Stage / beat | Runtime authority | Score or plan authority | Evidence | What must continue |
| --- | --- | --- | --- | --- | --- | --- |
| `ref-01` | `shipped` | `audio-stage-1-bed-timbre-mastering` | `main/src/audio/bedEngine.ts` bed graph construction, `buildBedGraph` at lines 470-800; one shared pad lowpass at Q 0.6 across lines 519-800 | plan section 3 Stage 1 Scope | Stage 0 combined render, pending | The pure-core and thin-rim split; no new save fields |
| `ref-02` | `shipped` | `audio-stage-1-bed-timbre-mastering` | `main/src/audio/bedEngine.ts` per-bar rim, lines 900-1200; partial slice at line 920 currently `slice(1,4)`; lines 940 and 985 | plan section 3 Stage 1 Design | Stage 0 combined render, pending | Only three of five colour partials sound today; the fix must not change harmony |
| `ref-03` | `shipped` | `audio-stage-1-bed-timbre-mastering` | `main/src/audio/generative/tuning.ts` level constants, lines 574-584: `BED_PAD_LEVEL` 0.085, `BED_MASTER_GAIN` 0.85 | plan section 1 numbers | Composed-mix peak 0.558, no loudness target | Constant discipline: no magic numbers outside `tuning.ts` |
| `ref-04` | `shipped` | `audio-stage-1-bed-timbre-mastering` | `main/src/audio/audioCore.ts` music bus tail; the safety compressor at line 322 is the only dynamics stage in the game today | plan section 3 Stage 1 Scope and Does-not | Zero `createWaveShaper` in the music path | The safety compressor's parameters are not touched by Stage 1 |
| `ref-05` | `shipped` | `audio-stage-1-bed-timbre-mastering` | `main/src/audio/scoreEngine.ts` reverb impulse at line 822; story convolver at line 973, mono today | plan section 3 Stage 1 Scope | Stage 0 A/B render set, pending | Impulse only; no change to the score's scheduling or harmony |
| `ref-06` | `shipped` | `audio-stage-2-game-mix-buses` | `main/src/audio/audioCore.ts` lines 332-377: SFX joins post-compressor with no limiter on the sum | plan section 1 and Stage 2 Scope | Stage 0 combined render, pending | The music topology and ramp semantics survive the re-bus |
| `ref-07` | `shipped` | `audio-stage-2-game-mix-buses` | `main/src/audio/sfxEngine.ts` output, lines 263-268 | plan section 3 Stage 2 Scope | `main/mining-metronome-probe.mjs` result must be unchanged | The loop-guard behavior proved by that probe |
| `ref-08` | `shipped` | `audio-stage-2-game-mix-buses` | `main/src/components/audio/AudioDirector.tsx` lines 236-244: unconditional per-frame `setLayerTargets` and `setProceduralTargets`, roughly 1140 AudioParam timeline mutations per second | plan section 1 and section 7 scorecard | FPS probe, pending | Steady-state automation must fall under 60 writes per second without changing what the player hears |
| `ref-09` | `shipped` | `audio-stage-3-composed-sync` | `main/src/story/storyDirector.ts`: eleven reactive `scoreHit` call sites firing at `ctx.currentTime`; `scheduleHit` has zero callers outside `main/src/audio` and its tests | plan section 1 and Stage 3 Scope | Stage 0 hit-onset trace, pending | The frozen story audio contracts `setScoreBeat`, `setScoreIntensity`, `scoreHit`, `unlockStoryScore` |
| `ref-10` | `shipped` | `audio-stage-3-composed-sync` | `main/src/story/signedSceneAvRuntime.ts` line 445 and `main/src/story/emergentStoryDirector.ts` line 941, audio-cue lines only | plan section 3 Stage 3 Scope | Signed AV rail regression, pending | Beat logic, ordering and copy in both files are protected |
| `ref-11` | `shipped` | `audio-stage-3-composed-sync` | `main/src/audio/scoreEngine.ts` mood harmony path, lines 1060-1075 and line 1362; `ROOT_HZ` 55 | plan section 3 Stage 3 Scope | Legality and voice-leading sweep over every mood, pending | Story beats currently jump to A regardless of the planet's key; the fix must keep every mood entry byte-identical in schema |
| `ref-12` | `shipped` | `audio-stage-3-composed-sync` | `main/src/story/storyScore.ts` mood authorship: interpretation changes, schema does not | plan section 3 Stage 3 Scope and section 5 | Mood render sweep, pending | Chapter-director authorship of the moods; only who voices the chords changes |
| `ref-13` | `shipped` | `audio-stage-4-spatial-sfx` | `main/src/audio/sfxEngine.ts` lines 81-166: twenty recipes with zero per-trigger variation, no panner; `Math.random` noise at lines 394-404; fresh buffer per trigger | plan section 1 and Stage 4 Scope | Spectral fingerprint per event from the Stage 0 combined render | Recipe-identical protection replaces byte-identical: synthesis shape, filter path, envelope shape and nominal centres are fixed |
| `ref-14` | `shipped` | `audio-stage-4-spatial-sfx` | SFX call sites that gain position parameters only: `main/src/components/EfficientPlayer.tsx`, `main/src/components/ShipController.tsx`, `main/src/components/ForageField.tsx`, `main/src/components/LooseStoneField.tsx`, `main/src/components/miningTrigger.model.ts`, `main/src/story/supplyPods.ts`, `main/src/story/debrisSalvage.ts`, `main/src/story/navWaypoints.ts`, `main/src/story/world/HifiWreck.tsx`, `main/src/story/world/EmergentAuditSites.tsx`, and the prologue screens under `main/src/story/prologue/` | plan section 3 Stage 4 Scope | Moving-listener combined render, pending | Only the argument lists change; no gameplay, timing or copy at any call site |
| `ref-15` | `shipped` | `audio-stage-4-spatial-sfx` | `main/src/story/ux/feedbackCues.ts`: emits `objective-enter` only today | plan section 3 Stage 4 Design; `main/src/story/ux/README.md` | Objective lifecycle trace plus a fresh read-only player-experience-auditor report | One-shot emission per objective ID; no stale or targetless mandatory state |
| `ref-16` | `shipped` | `audio-stage-5-long-form` | `main/src/audio/generative/arrangement.ts`, `main/src/audio/generative/phraseMemory.ts`, `main/src/audio/generative/bedConductor.ts`, `main/src/audio/generative/theory.ts` chord pool, `main/src/audio/generative/soak.ts` bar fingerprint at line 724 with `BAR_TABU` 32 | plan section 3 Stage 5 Scope | 32-minute pure soak, seeds 5, 8 and 10: barNovelty 0.495, 0.313, 0.441; distinctChords 21, 17, 14; melodyStatements 17, 22, 17; tabuBypasses 16, 100, 20; seed 8 sat in lydian for 886 of 1056 bars | The soak's independent recomputation and its red tests; the planner sits above `arrangement.ts` and does not replace it |
| `ref-17` | `shipped` | `audio-stage-5-long-form` | `main/src/audio/bedEngine.ts` sidechain at line 512 and lines 1176-1193: ducks pads and shimmer on the beat against a 0.05-level noise tick | plan section 1 and section 5 | Stage 0 combined render, pending | Pumping without a kick is the defect; the pulse voice becomes the source, and below BUILD the pads hold still |
| `ref-18` | `shipped` | `audio-stage-6-voice-bus` | No voice exists anywhere in the game today. Story text surfaces that will subscribe: `main/src/story/prologue/TerminalPrologue.tsx` and the station text surfaces | plan section 3 Stage 6 Scope | Stage 6 intelligibility and blind-viewer evidence, pending | The voice is a fidelity of the terminal, not a character. Stage 6 authors no words and changes no story timing |
| `ref-19` | `shipped` | all stages | `main/src/audio/soak/audioAnalysis.ts` measures peak, RMS, NaN, clip count, silence and smoothness; no LUFS, no true-peak, no correlation. `npm --prefix main run verify` has no audio step. No combined music-plus-SFX render exists | plan section 1 and Stage 0 | The Stage 0 agent's output, pending | Stage 0 is additive and outside this lock; every stage gate here consumes its combined render and its baselines |
| `ref-20` | `shipped` | all stages | Smoothness battery and the start-anchored slew law; era ladder as narrative; world-clock tick on its own timeline with glides of two seconds or more; the iOS route and interruption handling; the armed-until-confirmed unlock in `main/src/audio/gameAudio.ts`; `main/src/audio/sfxRateLimiter.ts` loop-guard thresholds; `main/src/audio/oxygenAudio.ts` non-quantized body clock | `PARAVOXIA_SCORE.md` section 8.6; plan section 1 preserve list | Existing test suites | Thresholds may only tighten, never loosen. 60 fps with the score running |

## Adjacent-scene continuity

- **Incoming state.** The overhaul has no scene boundary; its adjacency is the
  whole shipped soundtrack. Every beat from the prologue through the current
  story ceiling enters this run with its shipped cue timing, mood assignment and
  SFX inventory intact, and must leave with the same *semantics* even where the
  realization changes.
- **Outgoing state.** After the last stage, the same cues fire at the same
  narrative moments; what changes is that they are grid-aligned, transposed to
  the live tonic, ducked against a limited sum, positioned in space, and varied
  per trigger. No beat gains, loses or reorders a cue.
- **Cross-stage seams.** Stage 2 must land before Stage 3, and Stage 3 before
  Stage 4, per plan section 4. Stage 1's level constants are consumed by Stage
  2's limiter; Stage 2's bus topology is consumed by Stage 4's rooms and Stage
  6's voice duck row. A stage that lands out of order invalidates the downstream
  stage's measured baseline.
- **Reset, replay and deep-link behavior.** The sandbox no-op law applies
  unchanged: nothing this run adds may be audible in the sandbox path, and every
  new node must tear down on reset. The `?story=` deep-link flows must produce
  the same cue ladder as a cold traversal.
- **Known defects versus intentional limitations.** The pumping sidechain, the
  unprepared tonic jump, the dead-centre dry SFX, the single pad lowpass and the
  1140-writes-per-second automation are recorded here as **defects**. The
  composed silence, the REST state, the era ladder's deliberate low fidelity at
  `bare`, and the tick's non-quantized world clock are **intentional** and are
  protected strengths.

## Unverified assumptions

- Every line anchor in the table above is the plan's, not an independent
  reading. Verification route: the Stage 0 agent's evidence floor, or a
  read-only opus grep pass, before the parent contract freezes.
- The claim that `scheduleHit` has zero callers outside `main/src/audio` and its
  tests is the plan's audit finding. Verification route: a repository-wide
  search recorded in `check-results.json`.
- The eleven `scoreHit` call sites in `main/src/story/storyDirector.ts` are
  asserted, not enumerated, in the plan. Verification route: the Stage 3 child
  contract must list all eleven by symbol and line before it is signed.
- The station text surfaces named by Stage 6 are not enumerated in the plan.
  Verification route: the Chapter Director names them in the Stage 6 child
  contract; until then Stage 6's story-surface scope is unbounded and cannot be
  signed.
- The Stage 0 baseline numbers for integrated LUFS and true peak do not exist
  yet. Verification route: the separate Stage 0 run writes them into the plan's
  section 7 scorecard, and this run copies them into `run-summary.md`. No stage
  contract may be signed against an unmeasured baseline.
- Whether `main/public/audio/music` still carries streamed loops that Stage 1
  retires is unconfirmed. That directory is a protected path in this lock;
  retiring a loop is a lock revision, not an incidental change.
