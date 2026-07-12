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
noise helpers. `sfxEngine.ts` still owns a separate context — adopting
audioCore is future work (low priority, note when touching sfx).

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

**P4 — Verification harness.** OfflineAudioContext soak (30+ min renders:
no clipping/NaN, phrase-hash novelty across the window, seed determinism);
FPS probe with score running; WAV excerpt renders for owner audition
(sandbox day/night, two contrasting seeds, one story beat, one era
transition). Mechanical runs go to `story-verifier`. Soak also asserts
(folded from §10.4, owner-approved): zero phrase-tabu violations; the
mediant ration (≤ 1/phrase) and mode-drift step size (≤ 1 accidental)
audited across the render; legality of every logged chord transition.

**P5 — Era ladder + story integration polish.** Period-authentic sandbox
music per fidelity stage (PSG limits early, hybrid full score at 'alive'+);
awakening moments get bespoke musical mechanisms; existing story moods
re-auditioned through the richer engine. Story moods generalize by treating
`melody.scale` as a FILTER over the planet motif genome (§8.5 note) — no
`MOODS` schema change required (folded from §10.5, owner-approved).

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
  one awe-chord instead of a journey.

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
