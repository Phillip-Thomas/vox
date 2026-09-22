# score-treatment.md — Paravoxia audio overhaul (run 2026-09-04-audio-10x)

Author: Score Director. Status: Stage 2 independent treatment, written before
reading any Cinematography treatment. Binding inputs: `story-intent.md`
(all eleven rulings, pitch-locked chains, lifecycle contract, voice rules,
"sound is rendering"), `PARAVOXIA_AUDIO_10X_PLAN.md` §6 owner decisions
(granular voice, −18 LUFS / −1 dBTP, recipe-identical SFX, `full`/`lean`),
both audits. Nothing here is shipped; the lock decides what may be built.
Stage 0 (combined render, LUFS/true-peak, seeded SFX noise) is assumed as
the evidence harness; its rims already exist in the tree
(`sfxEngine.ts:58,81-88,652`, `offlineRender.ts:291`).

## 0. Thesis in one paragraph

Same notes, same grammar, a body. The harmony brain, motif engine, transport,
era gates and calm laws are the floor. Every stage below is either an
instrument change under those notes (1, 5, 6), plumbing that lets the notes be
heard against the world (2, 4), or the story finally *playing through* the
system instead of beside it (3). Two laws are held everywhere: the era ladder
is the only gate (`resolveEraGates(era, stage)`, `worldSignals.ts:349-369`,
consumed by the bed at `bedConductor.ts:531`) — no beat id ever unlocks
fidelity; and no stage may raise a floor the composer lowered (`ch4-defy`
baseline 0.1 `storyScore.ts:82`, `refused`/`seam-ebb` `:177,:241`, the
`setScoreIntensity(0)` "no.", the musing lulls).

## 1. Stage 1 — the instrument (bed timbre + music-bus glue)

**Intent.** Harmony and arrangement unchanged. The pad choir becomes an
ensemble, the colour tones sound, drive is drive, the sub is designed, the
room is a room. All of it inaudible at `bare`/`colour` by construction.

**Graph (replaces `bedEngine.ts:519-532` pad block; sub block `:575-600`;
spaces `:486-499`; nothing else moves).**

Per pad voice ×5 (was 3):
`saw×6 (detune ±PAD_UNISON_CENTS [3, 9, 17]) → per-osc StereoPanner (pan =
±PAD_UNISON_PAN_SPREAD 0.6 × gates.stereoWidth × slot) → voiceLowpass
(PAD_VOICE_LP_MIN_HZ 520, PAD_VOICE_LP_SPAN_HZ 2400, wander LFO 0.03–0.07 Hz,
seeded phase) → voiceGain` plus `octaveSaw (+12 st, PAD_OCTAVE_LEVEL −12 dB)`
and the existing sine organ. Voices feed `padDrive: WaveShaper(tanh,
DRIVE_PAD_K 1.8, oversample '2x', pre-gain DRIVE_PAD_PRE_DB +6)` in parallel
with a dry path; `padDriveWet` gain = `DRIVE_PAD_WET_ALIVE 0.45 × gates.padChoir
× (0.8 + 0.2·thermal)`. Attack breath: 60 ms filtered-noise puff on retune,
gain `PAD_BREATH_LEVEL 0.012 × gates.padChoir`. Colour tones: feed
`plan.publish.tones.slice(1, 6)` (was `slice(1, 4)`, `bedEngine.ts:920`).
Unison count is `PAD_UNISON_FULL 6` / `PAD_UNISON_LEAN 3` by quality tier.

Sub bus: `sine(root −24) + tri(−8 dB) + sine 2nd harmonic → subDrive
(WaveShaper tanh DRIVE_SUB_K 1.2) → highpass SUB_HP_HZ 28 → lowpass
SUB_LP_HZ 120 → StereoPanner pan 0 → bedBus`. Whole-bed mono-below: a
Linkwitz–Riley 4th-order split on `bedBus` (`BED_XOVER_HZ 120`), low band
summed to mono. The "thermal drive" level lifts at `bedEngine.ts:940,985`
become drive-wet lifts (`+0.2`), not gain.

Spaces: `makeImpulse` (`bedEngine.ts:794`) and `makeScoreImpulse`
(`scoreEngine.ts:973-980`, currently mono white noise × power decay) share one
generator: `REVERB_PREDELAY_MS 22`, 8 seeded early taps 8–60 ms, late tail
with per-sample one-pole `REVERB_HF_DAMP_HZ 3200`, stereo decorrelated by
seed. Node count unchanged (two bed convolvers, one story convolver).

Music-bus glue, inserted between `visibilityGain` and the safety compressor
(`audioCore.ts:341-345`): `glue: DynamicsCompressor(GLUE_THRESH_DB −18,
GLUE_RATIO 2.5, GLUE_ATTACK_S 0.03, GLUE_RELEASE_S 0.25, GLUE_KNEE 12) →
softClip: WaveShaper(tanh SOFTCLIP_K 1.4, unity)`. The safety compressor's
parameters are untouched.

**Slews.** Every new gain, cutoff and wet blend is written only through
`rampParamAt` (`audioCore.ts:566-584`) with a named settle time
(`DRIVE_WET_SLEW_S 1.2`, `PAD_VOICE_LP_SLEW_S 0.9`, `UNISON_PAN_SLEW_S 1.5`),
anchored at `barTime` like the existing pad automation.

**Era gating.** Unison detune, per-osc pan, octave saw, drive wet and
attack breath scale by `gates.padChoir` (rises at `material`, ERA_MATERIAL
0.5, `tuning.ts:333`); early reflections and late tail by `gates.reverb`
(half at material, full at alive); mono-below and sub drive by `gates.sub`
(colour) but the sub *level* stays under the calm law (≤ 0.10 before A2,
`storyScore.ts:16-24`). At `bare` the chip voices are the only sounding
family (`gates.chip = 1 − material`) so the new graph is silent there; at
`colour` the NES trio plays through the glue stage only, which at −18 dB
threshold and 2.5:1 is below its level — measured, not asserted.

**Retirements.** Streamed stems and the drone bank (`musicEngine.ts`) are
retired at the Stage 1 owner audition, as the plan decided: a fixed-key loop
under a key-drifting bed is a wrong note by construction.

**Evidence.** A/B of the six owner excerpts; band-energy and centroid deltas;
bed at `alive` integrated −20.5 ±1 LU alone (leaves room for SFX to reach
−18 on the sum); BLOOM short-term −14 ±1; true-peak ≤ −1 dBTP; smoothness
battery 0 violations; `score:fps` median ≥ 60; a *bare-era regression*: a
`crawl`→`ch1-fixed` render hashes identical before/after Stage 1 except the
glue stage (proves "inaudible at bare"). Owner audition is the acceptance.

## 2. Stage 2 — the game mix

**Bus graph.** Music path `musicBus → submerge → sceneEnvelope → visibility →
[glue → softClip] → compressor → masterOutput` (`audioCore.ts:322-356`) is
untouched above `masterOutput`. New below it: `masterOutput → limiter:
DynamicsCompressor(LIM_THRESH_DB −3, LIM_RATIO 20, LIM_ATTACK_S 0.001,
LIM_RELEASE_S 0.08, LIM_KNEE 0) → ceiling: WaveShaper(hard tanh knee at
CEILING_DBFS −1.0) → route`. No makeup gain anywhere: the limiter can only
subtract, so authored quiets survive it. If the Stage 0 4× oversampled
true-peak shows inter-sample overshoot above −1 dBTP, `CEILING_DBFS` drops
to −1.5 before any AudioWorklet is considered.

SFX categories: `world`, `player`, `ui`, `ship`, `voice`, each a `GainNode`.
`world`/`player`/`ship` → existing SFX submerge filter → `sfxOutput` (the
volume slider) → `masterOutput` (join at `audioCore.ts:374-377` kept);
`ui`/`voice` bypass the submerge filter (REGULATION is not underwater) and
meet at `sfxOutput`. `SFX_CATEGORY`, a Record keyed by SfxEvent to Category, is a table;
`playSfx(event)` keeps its signature.

**Duck matrix (pure `duckMatrix.ts`, dB, attack/release seconds).**

| edge (source) | music | world | player |
|---|---|---|---|
| `ship impact` (shipCrash/shipLand) | −6 / 0.04 / 0.9 | −3 / 0.04 / 0.6 | 0 |
| `voice utterance` | −9 / 0.08 / 1.2 | −4 / 0.08 / 1.0 | −2 |
| `terminalAlarm` | −4 / 0.03 / 0.7 | −6 / 0.03 / 0.7 | 0 |
| `oxygen critical` | −3 / 0.2 / 2.0 | −6 / 0.2 / 2.0 | 0 |
| `lifecycle cue` | −2 / 0.05 / 0.6 | −2 | 0 |

Applied as `rampParamAt` on category gains from *events* only; never per
frame. Under a story lead the music column is capped at −3 dB
(`DUCK_STORY_LEAD_CAP_DB`) — the score holds authority while a beat is active.

**Snapshot mixer.** `resolveMixSnapshot(scene, storyLead, submerged, station,
quality) → {busGains, submergeCutoffs, roomPresetId, quality}` with states
`menu / sandbox / story-lead / dive / station` and one documented submerge
constant pair per bus (unifies audit-2 D14). The snapshot never sets a music
gain above 1 and never touches `setScoreIntensity`.

**Per-frame hygiene.** `postAudioEvent` queue flushed once per frame; an id is
**deduped per flush within a frame, and held-level across frames** — two posts
of one id inside a single microtask flush sound once, and an id still posted in
the next frame does not retrigger while it is held. (Shipped as
`audioEventBus.ts:54-58` / `audioEventQueue.ts:53`: the dedupe key is the flush,
not the frame clock, so two posts of one id in the same frame from different
tasks both sound. Keying `queuedThisFrame` to the frame clock is deferred by
HD-09; S2-D7 records the wording rather than the code change.)
`setLayerTargets`/`setProceduralTargets` write only on
`|Δ| > AUTOMATION_EPSILON 0.004` or the `AUTOMATION_CADENCE_S 0.25` tick;
BedSignals becomes a reused struct.

**Evidence.** Five stress scripts through the combined render (shipCrash over
BLOOM, 40-node mining burst, oxygen under dive, typewriter over story lead,
jetpack + splash): true-peak ≤ −1 dBTP; integrated −18 ±1.5 LU; measured
duck depth within ±1 dB of table; `ch4-defy` and `seam-ebb` renders show
short-term LUFS after ≤ before + 0.5 LU (floor never raised);
`mining-metronome-probe.mjs` unchanged; automation writes < 60/s.

## 3. Stage 3 — composed sync, one tonic, MOODS through the brain

### 3.1 The grid under story lead

While a mood leads, `scoreEngine`'s 8th-note step grid is the grid
(`scheduleHit` already quantizes on it, `scoreEngine.ts:1533+`, via
`nextGridStep`, `transport.ts:180`). At hand-back the bed transport syncs
its next bar line to the story grid's next bar (`syncTransportTo`,
`transport.ts:86`) so the tempo change lands on a bar boundary — one clock
with a handoff at a bar, satisfying "beat means the mood's own tempo".

### 3.2 Pre-scheduling and the stretch cap

Additive extension, frozen `scoreHit` untouched: `scheduleHit(kind, quantize,
opts?: {notBefore?: number, capMs?: number, mayLead?: boolean})`. The caller
computes `desired = beatEntryAudioTime + TIMELINE_CONST`; the quantizer
returns the first quantum ≥ `desired` (`nextQuantumTime` already takes
`fromTime`, `transport.ts:141`). If `q − desired > capMs` the quantum
degrades one rung (`bar → beat → step`) and re-tries; a step (8th) is ≤ 450
ms for every mood tempo ≥ 67 BPM, so every ruling's cap is satisfiable
on-grid. `mayLead` permits the nearer earlier quantum (the ±400 ms lift
ruling). New `kind: 'impact'` renders boom + braam at one onset time for
`descent` — the double hit survives as one scheduled onset (answering
Chapter's Q3). Fallback when there is no transport: `null` → `scoreHit` as
today.

### 3.3 The eleven rulings as anchors

Anchor names are proposals for the contract; Cinematography and Chapter name
the final ids. `→` = what chases the returned `audioTime` as one bundle.

| Anchor (proposed) | Site | Quantize / cap | Chain |
|---|---|---|---|
| `anc.ch1-track.unbolt` | `storyDirector.ts:846` | beat@72, +450 → step if needed; camera unbolt chases | crawl…a1 |
| `anc.a1.chroma-landing` | `:1233` | beat@96, +400, pre-sched at a1 entry; `A1_RAMP_SECONDS` stretches; desat=0 + stage cut chase | crawl…a1 (exit) |
| `anc.a2.liberation` | `:1292` | beat@132 braam, +450, pre-sched at a2 entry; `notBefore` = HUD-death time (k>0.55) so it never falls early | ch2…a2 |
| `anc.a2.handoff` | `:1314` | beat, +450; handoff bundle chases as one unit | ch2…a2 (exit) |
| `anc.descent.impact` | `:1362-1363` | `'impact'` one onset; `DESCENT_IMPACT_AT` +≤400 never earlier | — |
| `anc.ch1-lift.perspective` | `:1434` | beat@84, ±400 (`mayLead`); glitch + `storyGlitch` + dpr snap + braam simultaneous, chase together | — |
| `anc.a3.first-blade` | `:1741` | bar@88 ≤ 2.75 s; `bloomWaveDelaySeconds` stretches, never shrinks | ch3-dusk…a3 |
| `anc.a3.material` | `:1760` | bar ≤ 2.75 s; stage cut + `clearLifeReveal()` chase together | ch3-dusk…a3 (exit) |
| `anc.maw.repair-committed` | `signedSceneAvRuntime.ts:445` | beat@70, +450; commit immediate; no hit at `:435-440` | — |
| `anc.a4.life-front` | `emergentStoryDirector.ts:941` | beat@66 bloom, +900; `commitA4Alive` immediate; awaken + caption + `lifeProgress` chase | ch4-vigil…a4 |

Never quantized: oxygen pulses, `terminalAlarm`, violation floods, player
input acknowledgements — enforced by a `NEVER_QUANTIZE` set the scheduler
rejects with a test.

### 3.4 One tonic, pitch-locked chains

`tonicPolicy: 'live' | 'absolute'` and `tonicChain?: string` live in a
separate `MOOD_TONIC_CHAINS` table (a partial Record keyed by StoryBeat to string) in
`storyScore.ts`, so the 55 MOODS literals are not edited. Chains per the
intent: `prologue` (crawl…a1-ramp), `colour` (ch2-color…a2-awakening),
`dusk` (ch3-dusk/ch3-await-rest/a3-dawn), `vigil` (ch4-vigil…a4-exhale),
`reconstruct` (ch7-reconstruct/ch7-board), `ch10` (absolute). Mood path:
`hzForSemis(semis + chainTonic)` replaces bare `hzForSemis(semis)`
(`scoreEngine.ts:341`, `ROOT_HZ 55` stays the reference).

Chain tonic derivation, zero save fields (Chapter's Q2): at chain entry,
`chainTonic = bedHasPublishedWithin(TONIC_LIVE_WINDOW_BARS 8) ?
getMusicChord().root : planetHomeRoot(seed)`; held in a module variable
keyed by chain id until the chain exits to bed-led play. A mid-chain reload
has no live bed, so it re-derives `planetHomeRoot(seed)` deterministically;
interval identity inside the chain is preserved either way (the whole chain
re-transposes together), and absolute pitch across a reload is, per the
intent, not protected. Hand-back: the brain receives `chainTonic` as its
current centre and walks home through its own mediant ration — a prepared
pivot, never a jump; `ch8-crossing`'s held-origin-then-walk
(`storyScore.ts:101`) is the same mechanism with `targetTonic = sibling`.

ch10: tonic read once at `ch10-cold`; from `relay-answer` the carrier
(`CH10_CARRIER_DEGREE 17`, `:279`) is pinned as an absolute Hz that survives
variants and reload; the octave-double filter (`:289-313`) is untouched.

### 3.5 MOODS as constraints

Pure `moodConstraint.ts`: `deriveMoodConstraint(mood: ScoreMood, chainTonic)
→ HarmonyConstraint`:

```
{ tonicSemis, pitchClassSet (union of chord + progression pcs — must be
  present in output), chordSequence (progression as ordered preference,
  weight MOOD_SEQ_WEIGHT 0.8), bassPolicy: 'root' (bass = chord root at each
  change), maxVoices (= longest chord length), registerBand (from octave),
  tempo, ostinatoCell (pattern, verbatim), voicingPolicy: 'literal' |
  'brain' | 'subtractive' | 'ordered', tensionCurve (dissonance of each
  progression step → tension rail values) }
```

The brain advances *under* the constraint: candidate chords are those whose
pcs ⊆ `pitchClassSet`; sequence order is a preference weight; voicing comes
from `voiceLeading.ts` (VL_TOTAL_MAX / VL_VOICE_MAX) instead of the literal
two-bar swap at `scoreEngine.ts:1069-1075`; publication at `:1362` is
unchanged. `voicingPolicy` per entry from `MOOD_VOICING_OVERRIDES`:
`subtractive` = literal for `ch4-comply [[0,6],[0,1]]` (`:80`), `refused`,
`seam-ebb`; `ordered` for `a4-exhale` (`:85`, one member at a time, order
kept); everything else `brain`.

Mechanical migration in two commits: (A) all 55 entries derived with
`voicingPolicy: 'literal'` — a render-hash test proves every mood is
sample-identical to today, so the constraint layer is proven inert before it
is proven better; (B) flip the default to `brain` with the override table.
Heard character is preserved by construction: same pcs, same bass roots,
same tempo and cell, same levels; only inner voices move by minimal motion.
Tests: pcs superset per entry; zero illegal transitions; bass = root at every
change; `ordered` opening sequence asserted; dramatic anchors re-voiced not
re-meant (the unresolved semitone in `ch1-anomaly`/`crash`/`descent`/
`ch4-audit` must remain a semitone in the output; ch10's whole-step floor
must never become a semitone — both asserted as interval invariants).

**Evidence.** Hit onset within ±1 ms of returned `audioTime` in an offline
render for each of the eleven; handoff sweep 0 violations; published-root
continuity test across story→bed; per-mood legality battery.

## 4. Stage 4 — SFX: position, variation, room, lifecycle

**Event bus.** `postAudioEvent({ id: SfxEvent, category: 'world'|'player'|
'ui'|'ship'|'voice', position?: [x,y,z], priority?: 0..3, params?:
{ material?, velocity?, surface? } })`; flushed once per frame, deduped by
`(id, frame)`; `sfxRateLimiter` thresholds untouched as backstop.

**Position.** Listener = camera. `pan = sin(azimuth) × SFX_PAN_MAX 0.85 ×
gates.stereoWidth`; `gain = 1 / (1 + ROLLOFF 1.2 × max(0, d − REF_DIST 4) /
REF_DIST)` clamped at `MAX_DIST 48`; distance lowpass `20 kHz → 2.5 kHz`
scaled by `gates.padChoir`. Era law answered (Chapter's Q1): no second gate
system — `stereoWidth` (0 at bare, 0.5 material, 1 alive) gives mono →
pan; `padChoir` gates the distance filter (material); `reverb` gates the
room (alive). `StereoPanner`, not `PannerNode`; HRTF opt-in flag.

**Variation (pure `sfxVariation.ts`).** `varyRecipe(recipe, seed)` with
`seed = fnv1a32(event, planetSeed, triggerIndex)`: pitch ±4 %, gain ±15 %,
duration ±10 %, filter ±6 %; round-robin siblings (3) for `mine`/`land`/
`blocked`. Recipe shape (`sfxRecipe`, `sfxEngine.ts:122-175`) is preserved;
the Stage 0 spectral fingerprint per event is the regression. `variation:
'none'` for the REGULATION set (`terminalKey/Advance/Alarm/Corrupt`,
`storyGlitch/Awaken/Sleep`) — uniform velocity, zero drop; `storyAwaken`
evolves by era only. Body sounds (steps, jump, land, jetpack, oxygen) are
never positioned.

**Room.** One `roomSend` gain from `world`/`player`/`ship` → five convolvers
built once from the Stage 1 generator (`plain` RT 0.6 s, `cave` 2.4 s,
`interior` 0.9 s, `underwater` 1.6 s HF-damped 800 Hz, `station` 1.3 s
metallic ER-dense); per-preset wet gains crossfade over `ROOM_XFADE_S 1.2`;
target preset from the Stage 2 snapshot. Station room is non-tonal by
design (no resonant comb); any tonal hatch component sits on the carrier
pitch class. `lean` tier: two feedback-delay rooms (`plain`, `interior`).

**Coverage.** Footsteps material-keyed (voxel type → noise band + body tone),
identical on every surface until `gates.padChoir > 0`, none before
`ch1-lift`; forage/pickup warmer than `mine` (triangle body, +1 octave);
`blocked` at the blocked face; hatch/door, station hum, water lapping, UI
hover/click/back/error. Each recipe a data descriptor.

**Lifecycle cues (ui bus, centred, dry, once per objective ID, no
variation).** All five are distinct by contour so they are never confused:

- `objective-enter` — existing `terminalAdvance` figure (rising square pair);
  re-voiced by era through the Stage 6 radio comb at material+, same figure.
- `objective-progress` — one square tick, `LIFECYCLE_PROGRESS_LEVEL` −6 dB
  below enter, 40 ms, fixed pitch; monotone with count.
- `objective-complete` — the enter figure inverted and resolved (falling
  pair landing a fifth below, 180 ms decay): a promise kept, still REGULATION.
- `objective-fail` — low square + downward noise burst, single, 260 ms;
  distinct from `terminalAlarm` (which repeats). Only authored failures.
- `marker-acquired` — soft triangle blip + highpass noise tick, quiet,
  centred; the guidance surface, not the world.

Masking: cues wait for the next typewriter gap (≤ `LIFECYCLE_KEY_GAP_MS 120`,
REGULATION cadence, never the music grid), sit −6 LU below the typewriter
peak, and never trigger the duck matrix beyond −2 dB. Once-per-ID is a
session `Set` in `feedbackCues.ts` (`:1-24`); no milestone write.

**Evidence.** Moving-listener render: pan/gain track position within ±0.05
pan / ±1 dB; 200 `mine` triggers → ≥ 190 distinct PCM hashes with peak
spread ±15 %; per-event fingerprint within tolerance; RT60 distinct per
preset; lifecycle trace shows each cue once per ID and none on
reconstruction/jump/resume; fresh `player-experience-auditor` report.

## 5. Stage 5 — long form and the heartbeat

**Section planner (pure, above `arrangement.ts`).** State:

```
SectionPlan { sectionIndex, lengthPhrases (4–8), phraseInSection,
  statementSchedule: phraseIdx[], registerArc: 'rise'|'fall'|'arch'|
  'plateau' + [bandStart, bandEnd], densityArc: [start, end],
  withheldLayer: 'shimmer'|'percussion'|'lead'|'subMotif'|null,
  bloomBudget: 0|1, recapAllowed: boolean, buildSpanPhrases: 1–3 }
```

`planSection(seed, sectionIndex, signals)` seeded from
`fnv1a32(planetSeed, sectionIndex)`. Horizon: one section (≈ 45 s – 2 min at
66–88 BPM, `tuning.ts:233-234`). It drives `advanceArrangementPhrase`
(`arrangement.ts:67-136`) through new `ArrangementInputs` fields:
`bloomAllowed = bloomBudget > 0 && withheldLayerSpent`, `buildSpan`,
`restBias`; BUILD may now span 1–3 phrases and a BLOOM is paid for by a
prior withhold. It drives the motif layer through `statementSchedule`
(melody density gated to scheduled phrases) and `registerArc` (band
endpoints). Recapitulation: once per section, the first statement's
operator chain re-enters transposed to the brain's current centre. Drift
clocks stay as weather beneath.

**Whole-bar fingerprint law.** `hashBar({chordId, voicingShape (interval
vector), ostinatoCell rotation + subdivision, percRotation, registerBand,
layerMask})` recorded every bar; `BAR_TABU 32` bars; on collision the
conductor applies operators in fixed cost order (rotation → subdivision flip
→ register shift → voicing re-draw) and re-checks; `BAR_TABU_BYPASS_BUDGET
4 / 32 min` is an audited exception. `phraseMemory.ts:13-28,51-61` keeps
its statement hash; the bar hash is added beside it.

**Vocabulary.** 7th-degree, quartal and sus voicings first-class in the
per-mode pool with VL legality; mediant ration untouched.

**The pulse (sidechain source).** Only at BUILD/BLOOM, era ≥ material
(`gates.sidechain`): `pulseBody sine PULSE_BODY_HZ_FROM 80 → rootSubHz
(clamped 40–60) over PULSE_BODY_DECAY_S 0.12` + `click (2 ms noise, highpass
2 kHz)` + `tail (bandpass 200 Hz, 60 ms)` → `subDrive` → sub bus. Beats 1
and 3 in BUILD (half-time weight), all four in BLOOM; `PULSE_LEVEL_BUILD 0.5`,
`PULSE_LEVEL_BLOOM 1.0`. The `breathGain` dips (`bedEngine.ts:1177-1193`)
key off pulse onsets only; below BUILD `sidechainDepth = 0` and the pads
hold still. The body ends on the chord root: one harmonic truth.

**Dead mappings.** `oxygen` → sub-motif density and pad HF roll-off in dive;
`biomeWeights` blended into mode weights; `detail` → ostinato density.

**Evidence.** 32-min pure soak ×3 seeds: `barNovelty ≥ 0.85`,
`tabuBypasses ≤ 4`, `distinctChords ≥ 30`, no section repeats its
`(statementSchedule, registerArc)`; red-test: a doctored log with an unpaid
bloom fails; smoothness at every section boundary; blind two-excerpt
"different passage" check.

## 6. Stage 6 — the narrator's fidelity

**Chain (per utterance slot, 2 slots for the relay overlap).**
`grainSource → formantBank (3 bandpass, F1/F2/F3 from a seeded table per
character, Q VOICE_FORMANT_Q 8) → bandpass VOICE_BP_LO 300 / VOICE_BP_HI 3400
→ WaveShaper(tanh VOICE_SAT_K 1.6) → comb (DelayNode VOICE_COMB_S 1/1100,
feedback VOICE_COMB_FB 0.35) → + seeded noise floor VOICE_FLOOR_DB −48 →
voice bus`. Source is square-derived at every rung.

Era ladder (by `resolveEraGates`, never beat): `bare` — one PSG blip per
character, no formants (`gates.chip`); `colour` — two-pulse formant pairs
(`gates.chipHarmony`); `material` — granular grains 20–40 ms from a seeded
square buffer through the formant bank (`gates.padChoir`); `alive` — smooth
grains, full comb, floor (`gates.reverb`). Fidelity rises; warmth does not
(no vibrato, no breath, no prosody). Grain pitch snaps to the published
chord's pitch classes one octave above the pad register; in ch10 the relay
voice may land on the carrier pitch class.

Cadence rides the typewriter (`terminalKey`) per character, never the
transport. The relay-answer overlap survives (Chapter's Q5): the answer's
first grain is scheduled at `askLastKeyTime − RELAY_ANSWER_LEAD_S`, on its
own typewriter cadence in slot 2. Surfaces are an allowlist by surface id
(REGULATION register only); lowercase captions, intrusions, musings and
"i—" are refused at the bus with a test. Prohibited beats (`ch4-defy`,
`seam-ebb`, awakening ramps, under oxygen) are a `VOICE_SILENT_BEATS` set.
`utter(text, surfaceId, speakerTable)` and TTS-ready `speak(buffer)`.

On the a2 violation flood (Chapter's Q4): I can voice it as formant garble
with no character mapping decaying into the noise floor, as a re-voicing of
`terminalCorrupt` through this chain — an SFX texture, not an utterance, so
it does not speak during a ramp. Whether that is "a new surface" is
Chapter's call; see §9.

**Evidence.** Band-energy intelligibility proxy per rung; duck depth on
music −9 ±1 dB; caption parity once per line; narration over BLOOM holds
−1 dBTP; blind viewer reports "the terminal", not "a person".

## 7. Mix and loudness plan

Named constants, summed bus: `TARGET_LUFS_I −18`, `TARGET_TP_DBTP −1`,
`BED_ALIVE_ST_LUFS −20.5`, `BLOOM_ST_LUFS −14`, `VOICE_ST_LUFS −16`,
`SFX_TRANSIENT_HEADROOM_DB 3.5`, `UI_LUFS −22`. Bed alone sits 2–3 LU under
target so world and player transients complete it rather than fight it;
the duck matrix therefore stays subtle. `bare`/`colour` beds are quieter by
their calm-law levels; the target is measured at `alive`. Authored quiets
are excluded from the integrated gate (gated LUFS ignores them by design)
and separately asserted never to rise.

## 8. Performance plan

`quality: 'full' | 'lean'` in the mix snapshot. `full`: 5 pad voices × 7
oscs + organ, 3 drive stages, 5 convolvers, 2 voice slots. `lean`: 3 voices ×
3 oscs, 1 shared drive, 2 delay rooms, 1 voice slot, 4 statement voices.
Budgets: ≤ 1.5 ms/frame audio main-thread `full`, ≤ 3 ms `lean` (CPU ×4
throttled on the SwiftShader gate). Nothing per-frame allocates or creates
nodes; oscillator lifetimes bounded; automation writes < 60/s. No
AudioWorklet unless the limiter fails −1 dBTP in the harness.

## 9. Questions/constraints for Cinematography

1. Which bundles chase `audioTime`: I offer all ten sites in §3.3; each
   returns one `audioTime`. Proposal: `audioCore.audioTimeToPerformanceNow(t)`
   (via `getOutputTimestamp`) publishes `{anchorId, audioTime, perfTime}` so
   your rigs can schedule against `perfTime`. Confirm the consumption shape
   and that the whole bundle moves as one unit per ruling.
2. a3: is a ≤ 2.75 s stretch of `bloomWaveDelaySeconds` acceptable to the
   grain captions' landing? The captions must land first; the bar only
   pushes the wave later.
3. Caption presentation: every voiced line is already on screen; the "sound
   captions" HUD surface (bracketed, UI vocabulary, owner decision) needs a
   registered surface in `hudSurfaces.ts` inside the overlap invariant. Do
   you want cue captions to appear at the *audio* onset or the visual event?
4. Room presets vs visual environments: I need an enclosure signal for
   `cave` (currently none exists) — can you expose one from the render/
   occlusion side? Confirm `bare` truly shows no room (no AO/shadow depth)
   so a dry `bare` is honest; confirm the station reads keyless in image.
5. Same-frame parity for `terminalAlarm` flash, `storyGlitch/Awaken/Sleep`,
   `shipCrash` flash, hatch iris, ch6 breath indicator, and all five
   lifecycle cues.

## 10. Questions for Chapter (only where the intent is ambiguous)

1. At 72 BPM one beat is 833 ms, above the +450 ms cap. I propose the cap
   wins and the quantizer degrades to the 8th-note step (still on grid).
   Confirm cap-over-quantum for every row in §2 of the intent.
2. The a2 garble (§6): SFX texture through the voice chain with no character
   mapping — acceptable as a re-voicing of `terminalCorrupt`, or a new
   surface requiring copy review?
3. Voice allowlist: by surface id (my proposal) rather than by text case?
4. `marker-acquired`: neutral UI timbre (my design) or the REGULATION
   family? The intent says UI/centred but not whose voice it is.

## 11. Anti-repetition, determinism, accessibility, dissent

Every stochastic choice is seeded (`fnv1a32`/`musicUnit`) from planet seed,
position, bar or trigger index; the combined render replays bit-identically
(Stage 0 hash). Anti-repetition is asserted by the whole-bar fingerprint law
(§5), not by ear. No information exists only in audio (§4, §6 parity). I
dissent from nothing in the intent; I record one position: if the owner
shortens the road, ship 1–2–3 and stop — that is most of the audible
distance, and Stage 5 is better designed after hearing Stage 1.

## 12. Grounding and cue ledger (index)

Grounding. Every proposal above is anchored to shipped code: the bed graph
(`bedEngine.ts`), the music bus tail (`audioCore.ts`), the scheduler and its
grid (`scoreEngine.ts`, `generative/transport.ts`), the recipes
(`sfxEngine.ts`), the generative grammar (`generative/arrangement.ts`,
`phraseMemory.ts`, `soak.ts`), the era gates (`generative/worldSignals.ts`) and
the level constants (`generative/tuning.ts`). §0 states the two laws the
shipped system already enforces and this treatment does not relax.

Cue ledger. The score's cue inventory for this run is §3.3 — the ten shared
anchors with their site, requested quantum, per-hit cap and pitch-locked chain
— plus §4's five lifecycle cues (`objective-enter`, `objective-progress`,
`objective-complete`, `objective-fail`, `marker-acquired`) on the ui bus, and
§6's voice utterances. No cue is added at a narrative moment that has none
today, and no cue is removed; the ledger changes realization, not membership.


## 13. Stage 1 reconciliation note (repair loop, 2026-09-05; Score Director)

The signed treatment (§1) and the shipped Stage 1 graph differ in three places.
None was folded back into §1 before the review; they are recorded here, in the
treatment, so the contract gate and the auditor read one truth. The contract text
is frozen at draft-v2 — this note does not amend it; the draft-v3 proposal in
`score-repair-direction.json` carries the wording that must move.

1. **Unison panning: two side panners per voice, not one per saw.** §1 says
   "per-osc StereoPanner". Shipped: each voice's saws are split into two banks
   feeding a left and a right `StereoPanner` at ±`PAD_UNISON_PAN_SPREAD 0.6` ×
   `stereoWidth` (`UNISON_PAN_SLEW_S`), with the seeded phase jitter and cents
   spread per saw kept. Reason: throughput — 30 panners became 10 with no
   audible loss of width (day correlation 0.962 → 0.936, still mono-compatible).
   Sound, kept.
2. **Family drives at `oversample 'none'`, not `'2x'`.** §1 says 2× on the pad,
   sub and lead drives. Shipped: `'none'` on all three; the glue soft clip keeps
   `'2x'`. Reason: every family drive input is lowpassed well under Nyquist (pad
   ≤ ~3.6 kHz, sub ≤ 200 Hz, lead ≤ 2.2 kHz), so a k 1.8 tanh keeps its harmonics
   in band; the resampler halved offline throughput and its latency combed
   against the dry parallel path. Sound, kept.
3. **Mono-below crossover and designed sub gated by `padChoir` (material), not
   `gates.sub` (colour).** §1 says "mono-below and sub drive by `gates.sub`".
   Shipped: both blends are 1 − padChoir / padChoir against exact bypasses.
   Consequence, stated plainly: the *designed* sub (drive, 28 Hz floor, 120 Hz
   ceiling, centre) does not sound at colour — colour keeps the NES triangle
   bass unchanged. This is stricter than contracted, it is what makes the
   colour-era proof hold, and the calm law caps sub level before A2 regardless.
   The judge keeps the stricter shipped gate; I concur and withdraw the
   `gates.sub` intent from §1.

Two evidence wordings are corrected at the same time:

- **"Inaudible at colour"** is proven at era 0.35 and holds by construction to
  era 0.38 (`padChoir = eraFade(era, 0.5)`, `ERA_FADE_WIDTH 0.12`), not to 0.5.
- **Bare-era regression** reads: *windowed fingerprint identical and max |Δ| ≤ 2
  LSB (≤ −84 dBFS) with the glue bypassed*. The renderer is not bit-deterministic
  at the float floor across runs (1–2 LSB on unchanged code; 3 LSB at alive
  level), so a differing-sample count is an observation, never a bound. The
  comparer now asserts fingerprint parity plus the LSB ceiling.

Repair-loop additions that are *inside* the signed terms (no contract change):
`BED_NIGHT_TRIM_DB −2.0` / `BED_NIGHT_TRIM_DAYLIGHT_ONSET 0.5` on the same
padChoir-gated bed-bus rail as `BED_ALIVE_LIFT` (night bed −18.99 → −20.51 LUFS;
day, contrast and lean-day renders unchanged); `resolveStage1Rails` as the one
pure resolver of every Stage 1 rail, tested exactly 0/1 at padChoir 0; the
audioCore topology test; `glue-gain` in `audio:check`.

## 14. Stage 3 build note (2026-09-05; Score Director as integration engineer, draft-v4)

**Shipped grid law (contract answer).** While a story mood leads, the mood's own
8th-note step grid IS the grid and the bed yields: `scheduleHit(kind, quantize,
opts)` quantizes on `patternStep`/`nextNoteAt` at the mood's tempo ("beat means
the mood's own tempo"), degrading bar → beat → 8th under the anchor's cap
(`generative/hitSchedule.ts`). While the bed leads the sandbox its transport
owns the grid; with no transport the return is `null`, logged `'immediate'`,
and the site fires today's reflex `scoreHit`. The mood pattern clock is not
re-anchored to the bed transport (the plan's alternative) — the contracted
intent names the mood tempo, and the bed is silent under a lead anyway.

**Story→bed tonic.** `planetHomeRoot(seed)` is `derivePlanetKey(seed).tonicPc`
— the very draw the bed's harmony brain is born on — so a story chain pinned to
it and the bed resuming after it share one key by construction. No bed re-key
was needed for the hand-back; the prepared pivot is the shared root.

**S2-D10 (schedule-time story-lead cap), accept-and-document, executed.**
The cap resolves once at schedule time (`sfxEngine` `scoreState()`/`stateAt()`)
and is never re-resolved on story-lead onset; documented in
`mix/duckMatrix.ts`'s header and pinned by two tests in `duckMatrix.test.ts`:
(b) a duck scheduled with `storyLead:false` whose lead flips later keeps its
envelope points; (c) every cap-AFFECTED music row (depth below the cap)
completes inside `STORY_AUTHORITY_CROSSFADE_S / 2`. Refinement recorded as the
Score Director's own ruling: the literal (c) fails today on `oxygenCritical`
(0.2 + 0.4 + 2.0 = 2.6 s > 2.25 s), but that row sits exactly AT the −3 dB cap on
its music column, so the resolution time cannot change it; the test pins that
exemption explicitly (depth == cap) so it reopens if the row ever deepens. The
terminal-typing-over-story-lead audition (d) remains delegated taste for the
owner's Stage 3 listening pass.

**MOODS-as-constraints, the gain guard.** Beyond the treatment's §3.5: a mood
is brain-voiced only where the brain is strictly better — over two cycles of
its progression no voice moves further than the composer's written jump for
that change (wrap included) and the total inner-voice motion strictly drops;
otherwise the entry stays literal with a recorded reason (`brainGuard`). Nine
of the 29 brain-requested progression moods qualify (voyage, ch1-raster,
ch1-depth, ch3-dusk, a3-dawn, ch3-forage, ch8-crossing, ch9-settle, ch9-hearth);
the rest are heard exactly as written. Tight intervals (a written semitone or
whole step) are preserved EXACTLY — none lost, none added — and the pad's
voice 0 stays the literal root (the sub carries the bass).

