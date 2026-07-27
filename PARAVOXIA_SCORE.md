# PARAVOXIA SCORE — consolidated architecture + the procedural-score plan

Owner brief: an award-caliber procedural score — music generated live from the
same metrics that drive rendering, Zimmer/Interstellar gravity × ODESZA/Plume
space-bass, never the same passage twice, never a wrong note, never out of
sync. The commissioned agent is `.claude/agents/score-director.md` (creative
laws, genre vocabulary, and research mandate live THERE; this doc is the
repo-truth and the build plan).

## 1. What the consolidation shipped (2026-07-11)

One AudioContext, one output chain, one instrument. Layout:

- `main/src/audio/audioCore.ts` — NEW. The single context and shared music
  bus: `engines → musicBus (volume·mute) → submerge lowpass → visibility duck
  → compressor → destination`. Exports `getAudioContext`, `getMusicBus`,
  `unlockAudio`, `setMusicOutput`, `setMusicSubmerged`,
  `setMusicVisibilityDucked`, `isMusicMuted`, `rampParam`, `makeNoiseBuffer`.
- `main/src/audio/scoreEngine.ts` — NEW (moved from `story/storyScore.ts`).
  The instrument: pad/sub/ostinato/melody/riser voices, the 60 ms lookahead
  scheduler, `ScoreMood`, the celestial idle bed, `setScoreMood(mood|null)`,
  `setScoreIntensity`, `scoreHit('braam'|'bloom'|'boom')`, `unlockScore`.
  Story-agnostic. Publishes the harmonic center (`setMusicChord`) and the
  tension/energy rails while a mood leads.
- `main/src/story/storyScore.ts` — now a story façade: the per-beat `MOODS`
  table (story content, chapter-director's law "every beat gets a MOODS entry
  in storyScore.ts" still holds) + `setScoreBeat` + re-exports of
  `setScoreIntensity`/`scoreHit` + `unlockStoryScore`. Director contracts
  unchanged.
- `main/src/audio/musicEngine.ts` — streamed loop layers, fixed drone bank,
  transition cues. Slimmed: its private context/submerge/visibility/volume
  plumbing is gone; it outputs into the shared bus.
- Unchanged: `musicPrimitives.ts` (rails + harmonic center),
  `musicDirector.ts` (pure scene/mix resolvers, unit-tested),
  `AudioDirector.tsx` (rAF conductor — now writes volume/submerge/visibility
  once via audioCore).

Wins baked in: one clock for all scheduling; the score now ducks/muffles/
compresses with the rest of the mix; one unlock/volume path; shared ramp and
noise helpers. (2026-07-26: `sfxEngine.ts` adopted audioCore's shared context
too — it joins at a post-compressor unity master with its own sub-master and
submerge filter, deliberately outside the music compressor/scene envelope so
SFX stays byte-identical. Its local ramp/noise helpers are intentionally NOT
shared: different curve shapes/noise generators; deduping would change SFX
timbre. One context, one `game:` output route, one unlock authority; the
visibility duck now lives in audioCore, not AudioDirector.)

## 2. Inventory — what's good, what's a defect (be honest about the floor)

GOOD (build on): the lookahead scheduler; retune-not-swap voice design; the
mood grammar (chord/progression/pattern/melody/tempo/wave + era-staged
timbres); the rails vocabulary; the harmonic center; hit vocabulary; pure
resolver pattern of `musicDirector.ts`; era-ducking of streamed layers.

DEFECTS (the procedural system replaces or fixes):
1. Sandbox music = five looping buffers. A loop is a defect (owner law).
2. The drone bank plays FIXED pitches (life 174.61/220 Hz, glass E5/B5,
   night E2/B2, ship 64 Hz) that ignore the harmonic center — latent clashes
   with any A-rooted chord the score publishes.
3. Every stochastic choice is bare `Math.random()` — unseeded, unreproducible,
   unconstrained beyond the mood's own sets.
4. Melody is a naive ±1 random walk; no motif identity, no development, no
   phrase memory. Patterns are single 8-step cells per mood.
5. Chord changes are hard swaps every 2 bars round-robin — no voice-leading
   choice, no functional/PLR movement, no long-form drift.
6. Mono everything: no panning/width, no reverb (one delay on melody), no
   percussion/transient family, no sidechain breathing.
7. Planet identity only reweights loop gains (`resolvePlanetMusicMood`) —
   two planets never differ in KEY, MODE, MOTIF, or rhythm.
8. Idle bed is intentionally buried (`0.32 ×` wonder scale) because it can't
   carry interest — the generative system should EARN the foreground.
9. Zero tests on stateful engines (scheduler, voices, hits).

## 3. The build plan (phases; each lands green and auditioned)

**P0 — Research + grammar design (no code).** The score-director's mandated
research pass, then extend THIS DOC with: the harmonic grammar (mode palettes,
PLR/voice-leading rules, tension curves), motif-DNA scheme (seed → intervals/
rhythm cells → development operators), rhythm system (transport, Euclidean/
pattern generators, half-time drops), arrangement curves, the signal→music map
(every world input from the list below, with its musical meaning), and the
era instrumentation ladder. Owner reviews the grammar BEFORE implementation.
**DELIVERED 2026-07-11 — see §6–§10 below.**

**P1 — The harmony brain (pure, tested).** `audio/generative/` pure modules:
key/mode state, chord graph + minimal-motion voice-leading, legality checks,
seeded choice (use `seededUnit`/`fnv1a32` — planet seed + musical-time salts).
INCLUDES tension-CURVE scheduling (§6.5 ARCH/PLATEAU/RISE/FALL per phrase) —
chord choice is argmin against the scheduled curve, so the brain cannot be
built or tested without it (folded from §10.1, owner-approved).
Publishes through `setMusicChord`. Unit tests: legality, determinism,
voice-leading distance bounds, no-repeat windows, curve shapes.
LANDED 2026-07-11: `main/src/audio/generative/` — tuning.ts (all §6 constants,
owner-retunable) + theory.ts (modes/degree sets/PLR/Tonnetz/mediants) +
voiceLeading.ts (3!-brute minimal motion + legality) + tension.ts (Farbood
scorer + ARCH/PLATEAU/RISE/FALL planner) + seededMusic.ts (purpose salts) +
harmonyBrain.ts (createHarmonyBrain/advanceHarmonyBar/publishHarmony); 44
unit tests green; `fnv1a32` now exported from worldCoordinates.ts; not yet
wired to AudioDirector (P3) — scoreEngine still publishes the center.

**P2 — Motif + rhythm engines (pure, tested).** Motif DNA from planet seed;
development operators (transpose/invert/augment/fragment); phrase memory
(tabu against recent hashes); transport with bar/beat grid and scheduled-ahead
sync points for visual hits. ADDS the `scheduleHit(type, quantize:
'beat'|'bar'|'phrase') → audioTime` API (additive; `scoreHit` unchanged) —
a drop that lands off-grid is a defect, and visuals must be able to chase
audio (folded from §10.2, owner-approved).
LANDED 2026-07-11: generative/motif.ts (genome incl. per-planet tempo/meter, §7.2 operator chains + legality + doc-notation serialization, mode-free render with anchor/landing snap) + rhythm.ts (§7.1 cell library, Euclidean E(k,n) + rotation, seeded humanize) + phraseMemory.ts (§7.3 dual tabu) + transport.ts (bar/beat/sixteenth grid, pending tempo/meter applied only at bar lines, nextQuantumTime sync points) + `scheduleHit(kind, quantize) → audioTime|null` on scoreEngine (renders via the shared hit path at the returned grid time; quantizes to the shipped scheduler's step grid until P3 hands the clock to the transport); all §7/§8 constants named in tuning.ts (incl. P3's tick/sidechain/drift knobs); 49 new tests, full suite 105 files/767 green, both tsconfigs clean.

**P3 — The generative bed replaces the floor.** New voices on scoreEngine's
rim (width/pan, reverb send, sidechain-style breathing, percussion/texture
family — era-gated). The bed becomes the sandbox foreground: planet seed →
mode/motif/palette, daylight → brightness/register, reality stage → voice
unlocks, submergence/wind → texture. Streamed loops demoted to optional
texture stems and then RETIRED once the bed outclasses them. Drone bank:
retune to harmonic center or fold into the bed (kill fixed pitches).
Story `MOODS` keep authority when a beat leads: the bed yields (tension rail
already pulls ambient down) and the mood plays through the same voices.
Named bespoke mechanisms (folded from §10.3, owner-approved): (a) the
approach-scene destination-key modulation with the §8.4 sensibility guard
and landing-pivot fallback ("the approach IS the modulation"); (b) the
surfaceShip hum retuned to the chord root as the drone-bank kill path;
(c) the dynamic world-clock tick voice (§8.1, owner-directed redesign).
LANDED 2026-07-11: pure core — generative/worldSignals.ts (BedSignals snapshot, world-clock-tick resolver, §8.5 era gates w/ paradox fold-back, §7.3 co-prime macro-drift clocks) + arrangement.ts (§8.3 REST⇄BED⇄BUILD→BLOOM→EBB w/ dwell bounds, era caps, warp force-build/ebb) + approachModulation.ts (§8.4 cost/budget guard, brightness-chain + tonnetzPath pivot walk, landing-pivot fallback) + bedConductor.ts (one seeded plan per bar: harmony advance w/ arrangement-forced curve shapes, motif ostinato w/ ODESZA subdivision flip, tabu-filtered melody statements, region-salted Euclid percussion, underwater sub-takes-motif, tick, sidechain depth); harmonyBrain gained registerShift + gliding/containing register band (fixes a latent band-jump deadlock), retargetHarmonyKey, forceLandingPivot, exported harmonyBarsFor; theory gained tonnetzPath. Rim — audio/bedEngine.ts (pad choir w/ width+detune, tuned sub + chip-drone floor, ostinato/lead transients + dotted-8th delay, shimmer+wash w/ gust LFOs, Euclid percussion, riser landing exactly on the bloom downbeat, deterministic-impulse convolver reverb, beat-scheduled sidechain dips, out-of-grid tick voice w/ ≥2s glides + bar-line presence fades; yields to story moods and resumes). scoreEngine additive: setGenerativeBedLead/isScoreMoodLeading/registerBedQuantizer (scheduleHit rides the bed transport in sandbox; hits moved to a fixed-gain hitBus). musicEngine.retuneDronesToChordRoot kills every fixed drone pitch (ship/pulse/rumble/life/glass/night fold onto the published root), edge-driven from AudioDirector. musicDirector demotes streamed loops to texture stems (STREAM_STEM_LEVEL 0.4, primitives path only) — assets NOT retired; retirement awaits owner audition of the bed vs stems. AudioDirector feeds the full §8.4 signal set (incl. wind profile, golden window, region salt, destination seed/archetype). All new grammar knobs named in tuning.ts. +47 unit tests (worldSignals/arrangement/approachModulation/bedConductor), full suite 110 files/818 green, both tsconfigs clean, build clean; frozen contracts untouched.

**P4 — Verification harness.** OfflineAudioContext soak (30+ min renders:
no clipping/NaN, phrase-hash novelty across the window, seed determinism);
FPS probe with score running; WAV excerpt renders for owner audition
(sandbox day/night, two contrasting seeds, one story beat, one era
transition). Mechanical runs go to `story-verifier`. Soak also asserts
(folded from §10.4, owner-approved): zero phrase-tabu violations; the
mediant ration (≤ 1/phrase) and mode-drift step size (≤ 1 accidental)
audited across the render; legality of every logged chord transition.
LANDED 2026-07-11: pure core — generative/soak.ts (deterministic scenario
scripts sandboxDay/sandboxNight/eraLadder/fullSoak incl. warp/submergence/
approach segments; per-bar collector snapshotting the harmony brain; the
§10.4 audit battery with INDEPENDENT recomputation — legality re-derived
from raw voicings, statements re-hashed — plus finiteness, no-deadlock, and
novelty/occupancy stats; runPureSoak = 30 musical minutes in ~10 ms) +
audio/soak/audioAnalysis.ts (NaN/clip/silence scan + WAV PCM16 encoder).
Offline rims: bedEngine + scoreEngine gained begin/step/end offline entries
driving the SAME graph builders and lookahead cores on an OfflineAudioContext
(suspend/resume checkpoints at the live 60 ms cadence; guarded against the
live engines; renderHitInto exported for offline hit routing; audioCore
gained createOfflineMusicChain — the volume+compressor mirror of the live
output). Runners: `npx vite-node tools/score-soak-cli.ts` (pure 32-min
battery ×3 reference planets + replay-determinism + seed-divergence),
`node score-soak-probe.mjs soak 32` (real 32-min OfflineAudioContext render:
zero NaN/clip, never-silent, all musical audits green, ~57 s wall),
`node score-soak-probe.mjs excerpts` (six audition WAVs → main/renders/,
self-describing names: bed day/night on seed5-verdant Ds-dorian-78, contrast
seed8-frozen F-lydian-66-6/8 vs seed10-volcanic Gs-aeolian-83, story beat
a3-dawn build w/ braam+bloom, era ladder bare→alive w/ blooms at the rungs),
`node fps-score-probe.mjs` (60 fps headless-swiftshader WITH the bed leading
and publishing; runs its own fresh dev server — HMR-stale servers split the
module registry for probe imports). npm scripts: score:soak:pure /
score:soak / score:audition / score:fps. THE SOAK ALREADY EARNED ITS KEEP:
it caught a real harmony freeze (frozen seed 8: Lydian II:maj has one
common-tone neighbor; a drifted register band priced it out → 94 held bars)
— fixed by the HELD_RELAX_BARS (2) escape hatch in harmonyBrain: after 2
failed change attempts the common-tone rule is bypassed for the retry
(displacement bounds never relax; event flags commonToneRelaxed; audited).
+19 tests (soak audits incl. doctored-log red-tests, full 33-min pure runs
×3 planets, wav/analysis), full suite green (114 files/860 at landing, incl.
a concurrent session's multi-planet additions), verify green.

**P5 — Era ladder + story integration polish.** Period-authentic sandbox
music per fidelity stage (PSG limits early, hybrid full score at 'alive'+);
awakening moments get bespoke musical mechanisms; existing story moods
re-auditioned through the richer engine. Story moods generalize by treating
`melody.scale` as a FILTER over the planet motif genome (§8.5 note) — no
`MOODS` schema change required (folded from §10.5, owner-approved).
LANDED 2026-07-11: period-authentic rungs — bare is MONOPHONIC (melody
suppressed; the ostinato becomes planChipArp, a lone chip arp of CHORD tones
on the rhythm gene; the pulse drone yields via CHIP_MONO_DUCK while the arp
speaks); color is the NES trio (square chip lead + CHIP_VIBRATO pitch LFO +
second pulse a chord tone below at CHIP_HARMONY_LEVEL, fading out by
material; lead delay era-gated — bare dry, color single slapback via zeroed
feedback, material+ full); material gains the §8.5 FM-bell shimmer floor
(SHIMMER_MATERIAL_PORTION); paradox widens the mediant ration
(PARADOX_MEDIANT_RATION 2, audit-aware) and SPLITS the world-clock tick
(splitHz = hz × PARADOX_TICK_RATIO 0.618 golden conjugate, second rim
timeline at PARADOX_TICK2_LEVEL). Stage transitions are EVENTS (§8.4 row):
bedConductor tracks prevStage; an upward rung schedules a grid bloom
(plan.stageBloom → scheduleHit/offline sink) and reaching alive+ promises a
mediant on the next phrase boundary (AdvanceOptions.forceMediant — change
forced due, mediant pool draw skipped, candidate set restricted to legal
mediants, displacement law never relaxed; mediantUsedThisPhrase became the
counter mediantsThisPhrase); story authority swallows the edge (rim keeps
prevStage current while yielding). Story moods generalized per §10.5:
audio/generative/moodMelody.ts renders the planet's developed motif
(seeded MELODY_CHAIN_POOL chains) onto the mood's melody.scale as an
octave-periodic degree lattice — every pitch chordRoot + a mood scale tone
by construction; scoreEngine gained additive setScorePlanetGenome (pushed by
configureBedPlanet) and a fully seeded scheduleGenomePhrase replacing the
Math.random walk whenever a genome is known (walk survives as fallback);
era-transition audition excerpt now relies on the native mechanism (manual
cues removed) and the story-beat excerpt renders with the home-planet
genome. Soak: SoakBarRecord gained stageBloom/paradox; the mediant audit is
paradox-aware; red-test proves it. +24 tests (185 in audio/generative);
full suite 122 files/919 green; tsconfig.node clean; app tsconfig clean
except a CONCURRENT session's in-progress worldGenCache.ts (not score
code); build clean; pure 32-min battery, 8-min OfflineAudioContext soak,
six audition WAVs, and the 60fps probe all PASS.
VERIFICATION FIX (2026-07-12): a full-run screening stalled silently for 410s
at ch3-gather with BOTH story clocks frozen (director's 180s fallback never
fired) — the useFrame loop itself died; no in-page rescue can run then. Root
causes were environmental, not score code (the movie probe runs with the
AudioContext locked — no unlock gesture — so its fps numbers measure the
world render alone; the score's own 60fps proof is fps-score-probe with the
bed leading). Fixes: full-run-probe.mjs now ALWAYS runs its own fresh dev
server with HMR fully off (PROBE_NO_HMR=1 in vite.config.ts — a shared
long-running server lets concurrent sessions push HMR mid-screening), plus a
240s stall watchdog that fails fast with diagnostics (independent rAF
heartbeat, reload marker, WebGL context-loss count, console tail,
screenshot) and an optional PROBE_AUDIO=1 mode that unlocks the score for
the whole screening; autopilot ch3-gather gained its missing BEAT_TIMEOUT
rescue (the one driven beat that never consulted its entry); ch2-color's
timeout recalibrated 34→45 (two consecutive healthy walks measured 34.3s and
38.9s — the old value truncated natural completions, the same defect its own
comment recorded at 20). Verified: full screening under the isolated probe =
PASS, 793.9s, done reached, ZERO rescues (ch1-nav 12.6s, ch3-gather 20.8s);
123 files/925 tests green; both tsconfigs and the production build clean.

**POLISH & UPSCALE LANDED 2026-07-12:** the SYMPHONY LAW is now structural,
not an audition-time promise. Diagnosis used continuous day→night→day and
focused control-only renders. The moon-overhead hypothesis was falsified: the
zenith crossing is continuous and produced no edge. The shipped jump was the
era-changing BUILD→BLOOM riser cleanup: it cancelled the in-flight rise and
reset its actual gain of about `0.027` to the newly evaluated era-gated target
of about `0.16` (about `15.5 dB` in the reproduced passage; its worst
floor-to-target case was `0.0001→0.16`, `1600×` / about `64.1 dB`). The
fix holds the value actually sounding and releases it through the named
`RISER_CUT_S (2 s)`. During hardening, the new handoff audit also caught a
distinct Chromium automation hazard: a linear ramp endpoint without a start anchor could interpolate from an
older event, retroactively span rendered time, and present as an instantaneous
story/bed cut. Persistent automation now uses start-anchored target slews with
the named three-time-constant convention (§8.6), including the complementary
`STORY_AUTHORITY_CROSSFADE_S (4.5 s)`. Fresh focused continuous-control
sweeps: day→night→day `0.83 dB / 0 violations`; the diagnosed BUILD→BLOOM
case `0.64 dB / 0`; story yield→scene-change→resume `3.92 dB / 0`.

World/audio coupling is now owner-auditionable as eight controlled A/B pairs
in `main/renders/` (§8.7) and inspectable live with `?scoredebug=1`. The same
planet palette/celestial resolvers drive live and offline paths. Material and
above gained the intended upscale: detuned stereo pad stacks with warm organ
sustain and slow spectral motion, sine/triangle/harmonic sub layers plus a
polyphonic tuned-sub motif handoff, FM shimmer, transient-shaped percussion,
deterministic short and wide bloom convolution spaces, and wider bloom
imaging. Bare and color deliberately remain period-authentic chip rungs —
monophonic PSG/noise at bare, NES pulse/pulse/triangle/noise at color — and
streamed loop assets remain present but demoted.

Final release evidence on the landed tree: both tsconfigs clean; `129` vitest
files / `985` tests green; production build green; the three-planet `32 min`
pure battery green with bit-identical replays; and the real browser `32 min`
soak green. In that browser soak the complete composed mix peaked at `0.558`
with zero NaNs, clips, or silent windows, while its separate full-duration
persistent-control mirror measured `3.72 dB / 0 violations`. All six owner
excerpts and all sixteen controlled A/B WAVs were regenerated and passed (A/B
delta RMS range `0.00412..0.09743`). The default FPS gate uses an actual
SwiftShader WebGL renderer and the live material-era `a3-dawn` score at full
intensity: median `60.39 fps`, p10 `60.36 fps`, score/baseline `1.000`, audio
context running, score authority confirmed.

## 4. Contracts that must not break

- `setScoreBeat`/`setScoreIntensity`/`scoreHit`/`unlockStoryScore` signatures
  and semantics (storyDirector.ts + TerminalPrologue.tsx + LandingMenu.tsx).
- `MOODS` stays in `story/storyScore.ts`, authored per beat by the
  chapter-director.
- `musicPrimitives` rails vocabulary and `musicDirector`/`musicPrimitives`
  unit tests stay green.
- Zero new save fields; sandbox gating through existing predicates; 60fps
  under headless swiftshader; main-thread, no per-frame node churn.

## 5. World signals available to compose from

`subscribeVoxelReality`/`getVoxelRealityEffects` (stage + 7 effect uniforms),
`buildPlanetProfile(seed)` (archetype, biomeWeights, palette),
`localSunElevation`/`localDaylight`/`localGolden` (dayNight.ts),
`getPlayerSubmergence`, `windProfile.ts`, `getWarp()`, scene from
`resolveMusicScene`, seeded hashes `seededUnit`/`fnv1a32`/`seededVoxelUnit`.

Grounded specifics (verified in source, 2026-07-11): stages are
`bare|color|material|alive|paradox`; effect uniforms are `chroma, detail,
organic, atmosphere, thermal, crystalline, metal` (all 0..1); planet
archetypes are `verdant|arid|frozen|volcanic|oceanic|crystal|metallic|fungal|
anomaly` (PlanetMusicMood carries a weight per archetype); scenes are
`menu|surface|surfaceShip|launch|deepSpace|approach|descent|storyTerminal`;
`WindProfile` fields are `direction, strength, gustStrength, gustScale,
gustSpeed, turbulence, veer, offset`; harmonic center is root in semitones
from A + chord tones in semitones (ROOT_HZ 55 = A1).

---

# P0 DELIVERABLE — the musical grammar (score-director, 2026-07-11)

Everything below is the design the engine phases (P1–P5) implement. The
governing aesthetic law, restated once: **complexity in texture, simplicity
in harmony** — few chords, immaculate voice-leading, many voices, restraint
(down to the quiet-bed floor, §8.3) as a composed output. Every constant
written `LIKE_THIS` becomes a named tuning constant in code, grouped for
owner retuning after listening.

### OWNER RULINGS (2026-07-11) — taste feedback, first-class artifact

The owner ruled on the five P0 taste decisions. The grammar below reflects
these rulings; each is also marked inline where it applies.

1. **Approach modulation: APPROVED with a sensibility guard** — "definitely
   modulate when it makes sense." Modulation to the destination key is the
   default; the guard defining when it does NOT make sense, and the
   landing-pivot fallback, live in §8.4 (after the signal table).
2. **The tick: DYNAMIC, not a fixed 1 Hz** — "maybe the tick can be dynamic
   based on other things." Redesigned as the signal-driven WORLD-CLOCK TICK
   (§8.1): rate/presence/intensity driven by world signals, still never
   quantized to the musical grid — the world-clock-vs-music-clock device
   survives, now breathing with the world.
3. **Major earned: APPROVED** — Ionian never a home mode; reachable only
   through warmth drift or at blooms (§6.2, as designed).
4. **True silence: REJECTED — always a quiet bed.** The sandbox keeps a
   minimal ambient layer that never fully drops out. The SILENCE arrangement
   state is removed; REST is redefined as the quiet-bed floor (§8.3). The
   sub-swell survives as the gesture that lifts out of REST.
5. **Paradox fold-back: APPROVED** — chip voices return as texture inside
   the hybrid score (§8.5, as designed).

## 6. Harmonic grammar

### 6.1 The harmony brain's state

One pure module owns: `tonic` (pitch class, semitones from A), `mode`,
`currentChord` (root pc + quality + color tones + voicing), `phrasePos`
(bar within the 8-bar phrase), and the scheduled `tensionCurve` for the
current phrase. It is the ONLY publisher of `setMusicChord`. All voices —
generative bed, story moods when they generalize (P5), retuned drones —
derive pitches from it.

### 6.2 Mode palette and the brightness chain

Modes live on the standard brightness chain, each neighbor ONE accidental
apart:

```
Phrygian < Aeolian < Dorian < Mixolydian < Ionian < Lydian
 (darkest)                                          (brightest)
```

- **Home modes** (a planet is born in one): Aeolian (the Zimmer gravity
  default), Dorian (hopeful minor — the Inception "Time" ambiguity, ODESZA's
  favorite), Mixolydian (warm, earthbound), Lydian (awe, floating ♯4).
- **Ionian** is never a home mode — it is EARNED, reached only by brightness
  drift at high warmth or at bloom peaks. Major as event, not wallpaper.
- **Phrygian** is never a home mode — its ♭2 appears only as an inflection
  under `tension > TENSION_PHRYGIAN_GATE (0.7)`.
- **Mode drift is single-accidental.** The mode may only step to a chain
  neighbor, at phrase boundaries, at most once per `MODE_DRIFT_MIN_PHRASES
  (4)`. Direction biased by warmth (bright) and tension (dark). Result: mode
  change is never audible as an event, only as weather.

### 6.3 Chord vocabulary

- Chords are triads with optional color tones. Per-mode degree sets favor
  modal (plagal) motion and EXCLUDE functional dominants and diminished
  triads (film-modal language, not common-practice):
  - Aeolian: i, ♭III, ♭VI, ♭VII, iv, v
  - Dorian: i, IV (the Dorian sunbeam), ♭III, ♭VII, v
  - Mixolydian: I, ♭VII, IV, v, ii
  - Lydian: I, II (the Lydian lift), iii, vi
  - Ionian (visited): I, IV, vi, iii, V *as triad color only, never V7*
- Color tones by `chroma` and warmth: add9, add6, sus2/sus4, m7/maj7 as pad
  extensions. Probability scales `chroma` 0 → plain triads, 1 → colored.
  Never a tritone-bearing dominant 7th; ♭9/♯11 colors only above
  `TENSION_COLOR_GATE (0.6)`.
- **Chromatic mediants** — the Zimmer awe move: mode-preserving third-related
  chords (roots ±3 or ±4 semitones, same quality; e.g. Am→Fm, C→E). Reached
  as PL/LP/RP-style transform chains of length ≤ 2. RATIONED: at most one
  per phrase (`MEDIANT_RATION 1`), only at phrase boundaries or at a
  scheduled hit/bloom, probability boosted in the golden-hour window (§8.4).
  This is the reserved jaw-drop gesture; rationing is what keeps it one.
  The ration is ABSOLUTE per phrase, whatever mechanism takes the mediant:
  the §8.4 landing pivot spends the SAME ration (and is refused when it is
  already spent), so no phrase can ever carry two awe chords under the base
  ration. Paradox widens the ration for every mechanism alike (§8.5).

### 6.4 Voice-leading law (how "never a wrong note" is engineered)

- Voicing: bass = chord root (sub register); THREE upper voices confined to
  a register band (center moves with daylight/era, §8). Chord-to-chord, the
  next voicing is chosen by minimal total displacement over all voice
  assignments (3! brute force — trivial).
- A transition is LEGAL iff: total displacement ≤ `VL_TOTAL_MAX (6)`
  semitones; no single voice moves more than `VL_VOICE_MAX (4)`; and when
  `tension < 0.4`, at least one common tone is held. High tension relaxes
  the common-tone rule — that widening IS the audible strain.
- The neo-Riemannian P/L/R transforms (parallel, leading-tone, relative —
  each moves exactly one voice by 1–2 semitones) are automatically the
  cheapest edges in this graph; the grammar gets Zimmer's chromatic-mediant
  language for free as short PLR chains, with legality enforced by the same
  displacement bound. No special-casing.

### 6.5 Progression engine — a tension-steered walk, not a loop

- **Harmonic rhythm is slow**: one chord per `HARMONY_BARS` bars, where
  HARMONY_BARS ∈ {4 at rest, 2 default, 1 at energy > 0.7}. Changes only on
  bar lines.
- Each chord candidate gets a computed **tension score**
  `T = w1·tonnetzDistanceFromTonic + w2·colorDissonance + w3·nonDiatonicPenalty
  + w4·registerExtremity` (weights are tuning constants; the model follows
  Farbood's perceptual-tension findings — see §9 research notes).
- The phrase planner schedules a **target tension curve** over the 8-bar
  phrase from the tension rail: shapes ARCH (rise to bar 6, release 7–8),
  PLATEAU, RISE (into a build), FALL (after a bloom). Chord choice =
  argmin |T(candidate) − target(bar)| over LEGAL candidates, tie-broken by
  seeded hash. Dissonance is therefore always *asked for* by the curve,
  and release is always *reachable* because legality guarantees a short
  voice-leading path home.
- Phrase-final bias: bars 7–8 weight toward tonic or its plagal neighbors
  unless the curve says RISE. Cadence is a probability, not a law — Zimmer
  loops resist the full stop.

## 7. Motif DNA

### 7.1 The genome (planet seed → identity)

Drawn once per planet via `seededUnit(terrainSeed, MOTIF_SALT_*)`:

- **Contour gene**: 3–5 intervals in SCALE STEPS from a weighted set
  (±1 step p=.4, ±2 p=.3, ±3 p=.15, ±4/±5 p=.15; at most one leap ≥ 4).
  Stored mode-free — the current mode/chord renders it, so the same tune
  survives mode drift and era change.
- **Rhythm gene**: one cell id from the curated library `RHYTHM_CELLS`:
  `CELL_TIME` (4 even quarters — Inception), `CELL_DAYONE` (dotted
  long-short-short-long — Interstellar), `CELL_TRESILLO` E(3,8),
  `CELL_CINQUILLO` E(5,8), `CELL_EIGHTS` (even 8ths), `CELL_HALF` (2 half
  notes), `CELL_OFFBEAT` (offbeat 8ths — ODESZA), `CELL_GALLOP`
  (8th + two 16ths — chip-era friendly).
- **Anchor gene**: start chord-tone (5th 50% / root 30% / 3rd 20%) and
  landing tone (root 80% / 5th 20%). Start-on-5-land-on-root is the
  Interstellar yearning shape.
- Plus per-planet: tonic pc, home mode (archetype-weighted, §8.3), base
  tempo, meter. Two planets are different musical PLACES by construction:
  different key, mode, tune, rhythm cell, tempo, texture defaults.

### 7.2 Development operators (variation without amnesia)

The phrase planner never regenerates the motif; it DEVELOPS it: `transpose`
(diatonic, to current chord root — free), `invert` (contour × −1),
`augment`/`diminish` (rhythm ×2 / ×0.5 — also the era/energy axis),
`fragment(n)` (first n notes → the ostinato cell), `extend` (append one
gene-consistent interval), `octaveShift`, `retrograde` (rare, wonder-gated).
An operator CHAIN (e.g. `fragment(3)+diminish` = a Zimmer ostinato of the
planet's own tune) is the unit of variation. The ostinato voice is always
`fragment(motif)`; the melody voice states full developed phrases, sparsely
— most phrases the melody is SILENT (C418 law: the tune's entrances carry
emotion because they are rare).

### 7.3 Phrase memory — anti-repetition you can measure

- Every rendered phrase hashes via `fnv1a32(chordIds, operatorChain,
  rhythmMask, registerBand)`. A tabu list forbids the last
  `PHRASE_TABU (16)` exact hashes (~8–12 min); a coarser operator-chain-only
  hash has a short tabu (`GESTURE_TABU 4`) against gesture-level ruts.
  The P4 soak asserts zero tabu violations across a 30-min render.
  `chordIds` is the CAUSAL phrase window (P5 polish): the chords sounded
  across the just-completed phrase plus the chord under the statement's
  first bar, in order with consecutive holds collapsed — the rest of the
  new phrase is undrawn when the fingerprint is taken, and the check-and-
  record stays atomic at statement time.
- **Macro-drift** (the hour-scale weather): three independent drift clocks
  with CO-PRIME periods — `DRIFT_MODE_MIN (17 min)`, `DRIFT_REGISTER_MIN
  (23 min)`, `DRIFT_TEXTURE_MIN (11 min)` — phase-seeded per planet. Eno's
  incommensurable-loop principle applied at the macro scale: the three
  never re-phase, so the combined state effectively never repeats. Mode
  drift obeys §6.2; register drift moves the voicing band ± a fourth;
  texture drift reweights the texture family.

## 8. Rhythm, transport, arrangement, and the signal→music map

### 8.1 Transport (one clock)

- One transport: `(barIndex, beat, sixteenth)` derived from
  `ctx.currentTime`, scheduled via the shipped lookahead pattern (60 ms
  tick / 180 ms horizon). rAF writes rail targets only; NOTHING schedules
  audio from rAF.
- Tempo: per-planet base from the archetype band (global sandbox range
  `TEMPO_MIN 66`–`TEMPO_MAX 88` bpm, half-time feel). Tempo changes apply
  ONLY at bar lines. Energy does not push bpm — it pushes SUBDIVISION
  (half-time weight below, double-time sparkle above: the ODESZA law).
  Story moods keep their authored tempi untouched.
- Meter: 4/4 default; 6/8 as a seeded minority (p=.25, wonder-leaning
  archetypes). Nothing else — meter is not where the complexity budget goes.
- **Grid-synced hits**: phrase plans are computed one phrase ahead, so
  blooms/drops always land on a known future grid time. New additive API
  (P2 proposal, §10): `scheduleHit(type, quantize: 'beat'|'bar'|'phrase') →
  audioTime` — the director asks for a hit, gets back the exact time, and
  the VISUALS sync to the audio. Immediate `scoreHit` stays for legacy
  reflex moments.
- **The WORLD-CLOCK TICK (dynamic — owner ruling #2)**: a clock voice whose
  rate comes from world signals, never from the musical tempo — out-of-tempo
  BY CONSTRUCTION, so the world's clock keeps running against the music's
  clock (the Interstellar device), but the clock itself now breathes with
  the world. Spec:
  - Rate: `TICK_HZ_BASE (1.0)` — one tick per real second at rest — scaled
    by a **clock-pressure** scalar and clamped to `TICK_HZ_MIN (0.5)`–
    `TICK_HZ_MAX (2.5)`. Clock pressure is composed from: `descent` scene
    progress (accelerates toward the ceiling as the ground nears — a radar
    altimeter's urgency); `getWarp()` (×2 while warping — time compressing);
    `getPlayerSubmergence` (slows toward the floor and softens — depth
    dilates time). Tension does NOT drive rate.
  - Presence: audible when `tension > TICK_GATE (0.55)` OR scene `descent`
    OR warp active; fades in/out over whole bars, never mid-gesture.
  - Intensity: `tension × clockPressure` sets loudness/attack; `metal`
    colors the timbre (woodblock at 0 → col-legno metallic at 1).
  - Rate changes GLIDE over ≥ `TICK_GLIDE_S (2)` seconds so acceleration
    reads as pressure, never as a tempo change. Scheduled on the same
    lookahead, never reactive. Never quantized to the grid — that rule is
    the device. (Paradox-era split into two clocks, §8.5, stands.)

### 8.2 Rhythm generators

- Percussion/texture pulses come from Euclidean patterns `E(k, 16)` per
  voice; `k` scales with energy × `detail`; the ROTATION is the variation
  operator, salted by quantized world position (`seededVoxelUnit` region
  hash) — walking somewhere new literally turns the rhythm.
- Sidechain breathing is not a compressor: a transport-keyed scheduled gain
  dip on pads/shimmer (duck at depth `SIDECHAIN_DEPTH (0.35) × energy`,
  release over a dotted-8th) — sample-accurate pumping, cheap, era-gated
  (unlocks at `material`).
- Humanization: micro-timing jitter up to `HUMAN_JITTER_MS (12) × organic`,
  seeded (reproducible). At `organic 0` the grid is machine-perfect — the
  chip eras are SUPPOSED to feel quantized.

### 8.3 Arrangement — the state machine that breathes

Layer stack (bottom→top): tuned sub (root drone / sub-melody) → pad choir
(3–4 voices, §6.4 voicing) → ostinato cell → texture family (granular
shimmer, noise wash, Euclidean ticks) → lead motif statements → percussion
(era-gated) → risers/hits.

Arrangement is a slow state machine over PHRASES (8 bars). Owner ruling #4:
there is NO full-silence state — the score never fully drops out in the
sandbox. REST is the floor:

```
REST(quiet-bed floor) ⇄ BED ⇄ SWELL(BUILD) → BLOOM → EBB → (REST|BED)
```

- REST — **the quiet-bed floor**: the tuned sub plus one soft pad voice at
  low gain (`REST_FLOOR_GAIN`), always breathing, never nothing. After long
  BLOOM/BED dwell the machine sinks here with rising probability and may
  thin to the sub alone — but the sub stays. The restraint principle
  (C418's lesson) is expressed as this floor plus rare melody entrances,
  not as absence. The **sub swell** survives as the rising gesture that
  lifts REST back into BED or BUILD.
- BED: pad + ostinato + texture — the default. BUILD: one phrase, riser +
  ostinato densification + filter opening, ALWAYS landing its target
  downbeat on the next phrase boundary (build→bloom, ODESZA). BLOOM:
  everything, widest, melody statement guaranteed, mediant move permitted.
  EBB: layers peel off over 1–2 phrases.
- Dwell bounds per state (`DWELL_MIN/MAX`, in phrases) make the arc breathe
  at the 1–3 minute scale; transition probabilities are driven by
  energy/tension/wonder + seeded hash. Era caps the reachable states
  (`bare` can only REST/BED).
- Register curve: daylight lifts the voicing band up to a fifth; night
  sinks the band, deepens the sub, raises the shimmer — scooped mids read
  as space.

### 8.4 The full signal→music map (every §5 signal, no orphans)

| Signal | Musical meaning |
|---|---|
| reality **stage** | Era rung: instrumentation ladder (§8.5), polyphony cap, stereo width, reverb depth, arrangement states reachable. A stage TRANSITION is an event: scheduled bloom + (at `alive`) a mediant move on the next phrase boundary. |
| effect `chroma` | Harmonic color richness: color-tone probability (plain triads → add9/6/maj7), pad detune/chorus width. |
| effect `detail` | Subdivision density: Euclidean `k`, ostinato note density, hat sparkle. |
| effect `organic` | Humanization: timing jitter, envelope softness, breath noise in pads. 0 = machine-quantized chip feel. |
| effect `atmosphere` | Reverb send + air band. 0 = bone dry. |
| effect `thermal` | Low-mid warmth: gentle drive on sub/pad, slow warm detune drift. |
| effect `crystalline` | Shimmer family voice: bell/FM partials, glassy delay regeneration. |
| effect `metal` | Inharmonicity: metallic partials in percussion/texture; braam color darkens. |
| `buildPlanetProfile` **seed** | The planet's musical identity: tonic pc, home mode, motif genome, rhythm cell, base tempo, meter, macro-drift phases. |
| **archetype** / `biomeWeights` | Mode weighting + texture bias, blended continuously by weights: verdant→Dorian/Mixolydian, warm plucks · oceanic→Lydian, slow harmonic rhythm, deep sub · arid→Aeolian, dry, sparse, open fifths · frozen→Lydian, icy high shimmer, slowest tempo band · volcanic→Aeolian w/ Phrygian tolerance, low drive, tick density · crystal→Lydian + bell partials, crystalline floor raised · metallic→Aeolian, inharmonic percussion · fungal→Dorian, woody plucks, irregular Euclidean rotations · anomaly→the only archetype allowed non-diatonic pad color (hexatonic mediant cycles) and 6/8 bias. |
| **palette** (colors) | Timbre brightness default: palette luminance → filter-cutoff base of pads/plucks. |
| `localSunElevation` | Sign = day/night regime: night sinks register band, deepens sub, sparser melody, shimmer up (wonder). |
| `localDaylight` | Warmth rail (shipped) → brightness-chain drift bias (§6.2), P-transform (minor→major) probability, pad brightness, register lift. |
| `localGolden` | The GOLDEN CADENCE window: mediant-move probability ×3, Mixolydian color bias — dawn/dusk own the score's most Zimmer moments. |
| `getPlayerSubmergence` | Bus lowpass (shipped) + musical response: harmonic rhythm doubles in bars (slower), ostinato yields, the TUNED SUB takes the motif — underwater, the bass sings the tune. |
| wind `strength` | Noise-wash gain + pad tremolo depth. |
| wind `gustScale`/`gustSpeed`/`offset` | The wash/shimmer LFOs SAMPLE THE SAME GUST FIELD at the player position — audio gusts cohere with visual tree-bend. |
| wind `turbulence` | Micro-detune jitter on pads/shimmer. |
| wind `direction`/`veer` | Stereo pan drift of the wash (era-gated width). |
| `getWarp()` | Energy rail (shipped) + arrangement: warp forces BUILD (riser, tick density, half-time→double-time flip); warp EXIT schedules `boom` + EBB on the next downbeat. |
| scene `menu` | BED cap, mid register, no percussion, no melody statements. |
| scene `surface` | Full grammar (the sandbox home). |
| scene `surfaceShip` | Ship hum becomes a TUNED drone on the chord root (kills defect #2's 64 Hz fixed pitch). |
| scene `launch` | Authored BUILD→BLOOM curve, tension arch. |
| scene `deepSpace` | REST-weighted (the quiet-bed floor at its most exposed), slowest harmonic rhythm, widest image, wonder ceiling. |
| scene `approach` | **The approach IS the modulation** (owner-approved with guard, see below): progressive pivot-chord walk from current key toward the DESTINATION planet's tonic/mode, arriving home exactly as you land (bespoke mechanism, P3). |
| scene `descent` | Tension arch + the world-clock tick at maximum clock pressure (§8.1). |
| scene `storyTerminal` | Near-silence: single sub, era floor 0. |
| `seededUnit`/`fnv1a32` | ALL stochastic choice: identity genes salt on planet seed; musical-time choices salt on `(seed, barIndex, voiceSalt)` — any bar is reproducible given the same rail history. |
| `seededVoxelUnit` (position) | Region salt (quantized world position) → Euclidean rotations, texture picks: travel turns the rhythm. |
| elapsed time / day count | Advances the three co-prime macro-drift clocks (§7.3). |

**Approach-modulation guard (owner ruling #1: "modulate when it makes
sense").** Modulation to the destination planet's key is the DEFAULT; it is
skipped only when it cannot be done cleanly:

- **Budget check**: modulation cost = mode-chain steps between current and
  destination mode (§6.2, one accidental per step) + shortest legal
  pivot-chord path between tonics on the voice-leading graph (§6.4).
  Budget = chord slots in the approach window (approach duration ÷ current
  harmonic rhythm). Modulate only if `cost ≤ budget − MODULATE_MARGIN (1)`
  — the arrival chord must land ON the landing, not after it.
- **Minimum window**: no modulation if the approach runs shorter than
  `MODULATE_MIN_BARS (8)` — a sprint approach must not wrench the key.
- **Story authority**: never while a story mood leads (frozen contract).
- **Trivial case**: destination key == current key → nothing to do.
- **Fallback — the LANDING PIVOT**: hold the current key through the
  approach; at the landing bloom, take ONE chromatic-mediant pivot toward
  the destination tonic (consuming that phrase's mediant ration), then let
  single-accidental mode drift (§6.2) settle the remaining distance over
  the first surface phrases. Arrival still sounds like arriving — it spends
  one awe-chord instead of a journey. **Ration clarification (P5 polish)**:
  the pivot both consumes AND obeys the §6.3 ration — with the phrase's
  mediant already spent (or no mediant legal) the key still retargets, just
  without the awe-chord; a pivot landing on a phrase-boundary bar charges
  the NEW phrase's ration and survives its reset. Because the guarantee now
  holds by construction, the soak's mediant audit COUNTS pivot awe-chords
  against the ration instead of exempting pivot phrases.

### 8.5 Era instrumentation ladder (music IS the fidelity narrative)

`era` is continuous 0..1; stage names give the rungs. Voice unlocks gate at
thresholds, but gains/width/reverb FADE with era — the ladder is a ramp,
not a staircase.

- **bare (~0)** — one PSG pulse voice + noise channel, monophonic. The
  motif exists only as a lone chip arp of chord tones. No sub, no reverb,
  no stereo. Long stretches at the quiet-bed floor (a barely-there pulse
  drone — even era 0 never fully drops out, owner ruling #4). 1-bit soul.
- **color (~0.25)** — NES trio: pulse lead (the motif, now a tune), pulse
  harmony a chord tone below, triangle bass on the root an octave down;
  noise channel plays the Euclidean tick. Single slapback echo. Vibrato
  unlocks.
- **material (~0.5)** — 16-bit: detuned-saw pads (lowpassed, 4-voice), FM
  bells, sampled-feeling plucks. STEREO unlocks. First short reverb.
  Sidechain breathing unlocks. Velocity shaping on the ostinato.
- **alive (~0.75–1)** — the full hybrid: wide supersaw/analog pad choir
  with sidechain breathing, organ-ish additive sustains (Interstellar),
  tuned sub-bass melodies, granular shimmer, percussion family, risers,
  full reverb depth, the braam. The complete Zimmer × ODESZA stack.
- **paradox (beyond)** — everything from `alive` PLUS the ladder folding
  back on itself: chip voices RETURN as deliberate texture inside the
  hybrid score (the game remembering its past — hidden-narrator resonance);
  mediant freedom widens; the world-clock tick may split into two clocks.

Story-mood note (P5): when a `MOODS` beat leads it keeps full authority
(frozen contract). As moods generalize, a mood's `melody.scale` becomes a
FILTER over the planet's motif genome rather than a random walk — the
planet's tune haunts the story beats, played in the mood's mode.

### 8.6 The SYMPHONY LAW — no uncomposed discontinuities (binding)

Every persistent audible control — gain/level, filter cutoff, effect send,
wet/dry balance, stereo position/width, sidechain depth, and continuous pitch
or timbre mix — moves only through a NAMED slew or complementary crossfade.
No boolean state, arrangement edge, era/stage gate, golden-hour boundary,
story authority change, drone retune, streamed-stem target, or world-signal
sample may write an audible step. Discrete notes, ticks, and hits remain
designed onsets with authored attack/release envelopes; they do not license a
step on the persistent rail beneath them.

The shared automation primitive is START-ANCHORED at the transition time:
hold the value actually sounding (`cancelAndHoldAtTime`, with the compatible
fallback), then schedule `setTargetAtTime` from that instant. A named slew
duration means **95% settled**, encoded as three time constants
(`AUDIO_PARAM_SLEW_SETTLE_TAU_COUNT (3)`); it is never a bare time constant
and never a ramp endpoint allowed to interpolate from an older event. An
interrupted slew must begin from its held current value. Grammar-scale times
belong in `generative/tuning.ts`; synth-rim times stay named and grouped at the
top of their module. Owner-facing taste anchors include
`STORY_AUTHORITY_CROSSFADE_S (4.5 s)` and `RISER_CUT_S (2 s)`.

Smoothness is a soak assertion over adjacent `SMOOTHNESS_WINDOW_S (0.1 s)`
RMS windows after the normal onset grace, not a subjective pass:

- absolute adjacent-window delta must be `≤ SMOOTHNESS_MAX_DELTA_RMS (0.04)`;
- when both windows are full-level (`RMS ≥ 0.02`), loudness delta must be
  `≤ SMOOTHNESS_MAX_DELTA_DB (4.5 dB)`;
- at the audible quiet-bed floor (either window `RMS ≥ 0.005`), the
  denominator is clamped to `0.001 RMS` and delta must be
  `≤ SMOOTHNESS_MAX_QUIET_DELTA_DB (12 dB)`.

The battery keeps deliberate onsets and continuous controls distinct. The
owner/evidence WAV is the complete composed mix. Its paired audit render
suppresses only scheduled note/hit envelopes while retaining the exact
persistent gain/filter/send/sidechain/story-authority rails; this makes an
illegal control step attributable without misclassifying a legal chip note or
bloom transient. Both paths still retain the no-NaN, no-clip, headroom, and
quiet-bed-floor laws. Red regressions prove the audit can fail: a rendered
full-level gain step fails, a quiet `0.002→0.019` order-of-magnitude step
fails, and the old `0.027→0.16` BUILD→BLOOM riser reset fails. The same quiet
move through its named `1.2 s` slew and the held riser through its named `2 s`
release pass. Smoothness thresholds may only get stricter.

### 8.7 Controlled signal→music evidence pairs

Each pair below renders the same musical-time window and deterministic origin
while varying ONE source concept; live-derived consequences (for example sun
elevation → daylight/warmth/wonder, or reality stage → era gates) travel with
that source exactly as they do in `AudioDirector`. The planet pair varies the
single identity input — terrain seed — so its derived archetype, palette,
key, mode, motif, rhythm, tempo, and meter are expected to change together.
All files are under `main/renders/` and are regenerated from `main/` with
`node score-soak-probe.mjs evidence` (or append one pair name).

- **Daylight/night:**
  `evidence-daylight-night_A-night-sunElevation-1_seed5-verdant_Ds-dorian_78bpm-4-4.wav`
  vs
  `evidence-daylight-night_B-day-sunElevation0.6_seed5-verdant_Ds-dorian_78bpm-4-4.wav`.
- **Golden hour:**
  `evidence-golden-hour_A-golden0_seed7-verdant_As-mixolydian_76bpm-4-4.wav`
  vs
  `evidence-golden-hour_B-golden1_seed7-verdant_As-mixolydian_76bpm-4-4.wav`.
- **Submergence:**
  `evidence-submergence_A-surfaced0_seed5-verdant_Ds-dorian_78bpm-4-4.wav`
  vs
  `evidence-submergence_B-submerged0.85_seed5-verdant_Ds-dorian_78bpm-4-4.wav`.
- **Wind:**
  `evidence-wind_A-windStrength0_seed5-verdant_Ds-dorian_78bpm-4-4.wav`
  vs
  `evidence-wind_B-windStrength1.65_seed5-verdant_Ds-dorian_78bpm-4-4.wav`.
- **Warp:**
  `evidence-warp_A-warp-off_seed5-verdant_Ds-dorian_78bpm-4-4.wav`
  vs
  `evidence-warp_B-warp-active_seed5-verdant_Ds-dorian_78bpm-4-4.wav`.
- **Descent:**
  `evidence-descent_A-scene-surface_seed5-verdant_Ds-dorian_78bpm-4-4.wav`
  vs
  `evidence-descent_B-scene-descent_seed5-verdant_Ds-dorian_78bpm-4-4.wav`.
- **Era/stage:**
  `evidence-era-stage_A-bare-era0_seed5-verdant_Ds-dorian_78bpm-4-4.wav`
  vs
  `evidence-era-stage_B-alive-era1_seed5-verdant_Ds-dorian_78bpm-4-4.wav`.
- **Planet seed:**
  `evidence-planet-seed_A-seed8-anomaly_seed8-anomaly_F-lydian_67bpm-6-8.wav`
  vs
  `evidence-planet-seed_B-seed10-metallic_seed10-metallic_Gs-dorian_83bpm-4-4.wav`.

In a development build, append `?scoredebug=1` to expose a throttled overlay,
periodic `console.table`, and `window.__scoreDebug`. It displays the exact
live signal snapshot beside its resolved chord, era gates, world-clock rate,
shared gust-field drive/pan, macro drift, streamed/procedural mix targets, and
current bed levels. With the flag absent, the normal rAF pays only the guard;
no snapshot cloning, DOM writes, or console work runs.

## 9. Distilled research notes (do not re-research; method only)

- **Eno / Music for Airports**: overlapping loops with INCOMMENSURABLE
  (co-prime) periods never re-phase → endless non-repetition from tiny
  material. We apply it at two scales: texture LFO periods and the three
  macro-drift clocks (§7.3). Also Eno's framing: design a SYSTEM and let it
  play; curate the rules, not the notes.
- **Paul Weir / No Man's Sky "Pulse"**: "generative = randomized within
  rules"; soundscape sets are hand-CURATED sound pools recombined by simple
  logic driven by game state. Lesson: the win is curating the palette hard
  and generating the ARRANGEMENT; pure synthesis-from-nothing is not the
  goal. Our motif genes and rhythm cells are the curated pool.
- **C418 / Minecraft**: programmed silence is the frame that gives entries
  their emotional weight; ask how FEW notes still move. Owner ruled against
  full silence (ruling #4), so the lesson ships as RESTRAINT: the quiet-bed
  REST floor, sparse melody statements, and a bed that knows when to thin
  to almost nothing.
- **Disasterpeace / Mini Metro**: serialism + sonification — game data
  mapped to musical parameter series; audio doubles as information about
  system state. Lesson: every mapping in §8.4 should be READABLE by an
  attentive player (wind you can hear, reality stage you can hear).
- **Ape Out / rhythm games generally**: action-triggered hits QUANTIZE to
  the grid and feel intentional; reactive-late hits feel broken. Hence
  `scheduleHit` returning the audio time so visuals chase audio.
- **Wwise/FMOD grammar**: vertical layering (add/remove stems) ×
  horizontal re-sequencing (reorder segments). Our arrangement state
  machine IS vertical layering; the phrase planner IS horizontal
  re-sequencing — the generative system subsumes both.
- **Zimmer / Interstellar**: ~3 chords total in the signature cues
  (Cornfield Chase: F–G6/Em7–Am flavor); layered ostinato ACCRETION does
  the building; the 60 bpm literal clock tick (woodblocks, col legno) as
  narrative time-pressure; the pipe organ as breathing sustain machine.
  Simplicity is what makes it enormous.
- **Zimmer / Inception "Time"**: ONE four-chord loop (Am–Em–G–D, G major
  never emphasized as home) for the entire cue; the whole emotional arc is
  ARRANGEMENT — layer accretion, register, dynamics. Proof that our
  arrangement state machine carries more emotional load than harmonic
  novelty ever will.
- **Chromatic mediants / neo-Riemannian**: P/L/R transforms are the
  minimal voice-leading moves between triads (one voice, 1–2 semitones);
  chromatic mediants (the film-score awe move) = short PLR chains. Treating
  the chord graph as displacement-bounded (Tymoczko: efficient voice
  leading between near-even chords) yields this language without
  special-casing.
- **Tension modeling (Farbood)**: perceived tension tracks a weighted blend
  of dissonance, register extremity, loudness, tempo/density, and harmonic
  distance from tonic — and follows SCHEDULED curves well. Hence the
  tension-scored chord walk (§6.5): schedule the curve, pick chords to fit.
- **Euclidean rhythms (Toussaint)**: E(k,n) evenly distributes k onsets in
  n slots and reproduces a huge family of world-music patterns (E(3,8)
  tresillo, E(5,8) cinquillo). One integer + rotation = a controllable,
  seedable groove space.
- **ODESZA (genre analysis)**: transport-locked sidechain "breathing" on
  pads; half-time low end under double-time sparkle; build→bloom releases
  landing exactly on phrase boundaries; tuned SUB-BASS carrying melody;
  wide detuned stacks with the mids scooped for air. All encoded in §8.

## 10. P0 proposals for P1–P5 (owner-APPROVED; folded into §3, 2026-07-11 — kept for rationale)

1. **P1 scope**: move tension-CURVE scheduling from P2 into P1 — chord
   choice (§6.5) is argmin against the scheduled curve, so the harmony
   brain cannot be built or tested without it.
2. **P2 addition**: the `scheduleHit(type, quantize) → audioTime` API
   (additive; `scoreHit` unchanged) — "a drop that lands off-grid is a
   defect" needs an API, and visuals must be able to chase audio.
3. **P3 named mechanisms**: (a) approach-scene destination-key modulation
   with the §8.4 sensibility guard and landing-pivot fallback ("the
   approach IS the modulation" — owner-approved); (b) surfaceShip hum
   retuned to the chord root as the drone-bank kill path; (c) the dynamic
   world-clock tick voice (§8.1 — owner-directed redesign).
4. **P4 soak additions**: assert zero phrase-tabu violations; audit the
   mediant ration (≤1/phrase) and mode-drift step size (≤1 accidental)
   across the render; assert legality of every logged chord transition.
5. **P5 note**: story moods generalize by treating `melody.scale` as a
   filter over the planet motif genome (§8.5 note) — no `MOODS` schema
   change required.
