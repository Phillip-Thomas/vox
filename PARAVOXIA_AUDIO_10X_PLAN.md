# PARAVOXIA AUDIO 10× PLAN — staged step changes (score-director, 2026-09-04)

Status: PLANNING DOCUMENT. Nothing here is implemented. Evidence base: the two
independent opus audits (`audit-1-music.md`, `audit-2-plumbing.md`, scratchpad
`audio-review/`, 2026-09), `PARAVOXIA_SCORE.md` §§1–10, and feasibility
spot-checks of `bedEngine.ts`, `audioCore.ts`, `sfxEngine.ts`,
`AudioDirector.tsx`, `offlineRender.ts`, `soak.ts`. The brief this plan serves
is unchanged: award-caliber procedural score, live from world metrics,
Zimmer/Interstellar gravity × ODESZA/Plume space-bass, never the same passage
twice, never a wrong note, never out of sync, era ladder as narrative, and the
hidden AI-narrator pillar. The plan makes that idea *audible*; it does not
replace it.

---

## 1. Where we are

**In a composer's ears.** The grammar is real and the sound is not yet. Put on
headphones at `alive` and you hear: correct chords, minimal-motion voicings,
a planet-specific tune, ticks and blooms that land on the grid — played by a
small 1990s subtractive synth at bedroom level, through a spray-can reverb, in
a room with no bass, while every sound effect arrives dead-centre, dry, at the
same volume whether the stone is under your boot or forty metres away. Then a
story beat begins and the music jumps to A regardless of the planet's key,
chords swap without voice-leading, and eleven shipped hits fire whenever the
director happens to call them. Over half an hour, the bed states its tune
17–22 times and repeats a bar-level fingerprint half the time. There is no
voice anywhere in the game.

**In numbers** (audit 1 §0, §1; audit 2 §1, §6):

- 32-min soak, seeds 5/8/10: `barNovelty 0.495 / 0.313 / 0.441`,
  `distinctChords 21 / 17 / 14`, `melodyStatements 17 / 22 / 17`,
  `tabuBypasses 16 / 100 / 20`. Seed 8 sat in lydian 886 of 1056 bars.
- Zero `createWaveShaper` in the music path; one shared pad lowpass Q 0.6
  (`bedEngine.ts:519-800`); `BED_PAD_LEVEL 0.085`, `BED_MASTER_GAIN 0.85`
  (`tuning.ts:574-584`); the only dynamics is the safety compressor
  (`audioCore.ts:322`). Composed-mix peak `0.558`, no loudness target.
- Sidechain ducks pads/shimmer on the beat (`bedEngine.ts:512, 1176-1193`)
  against a 0.05-level noise tick — pumping without a kick.
- `scheduleHit` has zero callers outside `src/audio` and tests; all eleven
  story hits are reactive `scoreHit` at `ctx.currentTime` (audit 1 §5).
- SFX joins post-compressor with no limiter on the sum (`audioCore.ts:374-377`,
  `sfxEngine.ts:263-268`); 20 recipes with zero per-trigger variation
  (`sfxEngine.ts:81-166`), no panner of any kind, `Math.random` noise
  (`sfxEngine.ts:394-404`), fresh buffer allocated per trigger.
- No combined music+SFX render exists; `audioAnalysis.ts` measures peak, RMS,
  NaN, clip count, silence, smoothness — no LUFS, no true-peak, no
  correlation. `npm run verify` has no audio step.
- ~1140 AudioParam timeline mutations/s from unconditional per-frame
  `setLayerTargets`/`setProceduralTargets` (`AudioDirector.tsx:236-244`).

**What must be preserved** (merged protect lists). Pure-core/thin-rim split
and `tuning.ts` constant discipline; the harmony brain's legality model
(displacement bounds, common-tone rule, `HELD_RELAX_BARS`); the soak's
independent recomputation and red-tests; the SYMPHONY LAW start-anchored slew
and smoothness battery (§8.6 thresholds may only tighten); era ladder as
narrative (PSG → NES trio → paradox fold-back); world-clock tick (own timeline,
≥2 s glides, golden-ratio paradox split); ch10 carrier-degree design;
`audioCore` music topology and ramp semantics; iOS route + `interrupted`
handling; `gameAudio` armed-until-confirmed unlock; `sfxRateLimiter` loop-guard
thresholds (tuned against `mining-metronome-probe.mjs`); oxygen body-clock
non-quantization and reduced-motion softening; the frozen story contracts
(`setScoreBeat`/`setScoreIntensity`/`scoreHit`/`unlockStoryScore`, `MOODS`
authorship in `storyScore.ts`); zero new save fields; 60 fps with the score
running. The SFX recipes at `sfxEngine.ts:81-166` are byte-identical *by
policy* — Stages 4–5 ask the owner to lift that policy explicitly (§6).

---

## 2. The 10× thesis

"10× better" is not ten features. It is the distance between a system a
reviewer can *describe* as Zimmer × ODESZA and one a player *hears* as it,
measured in the order a listener notices. Each rung keeps the brief's idea and
gives it a body.

1. **First four seconds: timbre.** Harmonic density, unison width, low-end
   weight, a real space. Zimmer's ostinato only becomes enormous when the
   voices have drive and air; ODESZA's pads only breathe when there is a
   kick to breathe against. The grammar already writes the right notes; the
   instrument must stop under-selling them.
2. **A real game mix.** One limiter, category buses, ducking, a loudness
   target. "Never sounds bad" is currently proven only for music alone.
3. **Space and position.** Diegetic sound that is *where the thing is* and
   *in the room the player is in*. The world is the composer — that has to
   include the room.
4. **Composed sync.** Every visual-sync moment on the grid ahead of time, one
   harmonic centre across the story/sandbox boundary, moods played through
   the brain. "Never out of sync" and "one harmonic truth" made literal.
5. **Long form.** A planner that intends across phrases and a phrase memory
   that hashes the whole bar, so "never the same passage twice" survives a
   32-minute soak and not only a melody-statement count.
6. **Voice.** The narrator pillar and every terminal are silent. A voice bus
   with a zero-asset granular baseline lets the hidden narrator *speak* in
   the era's fidelity — the ladder applied to speech.

---

## 3. Staged step changes

Ordering rule: evidence before contracted mutation; additive rims before
shipped-path changes; the loudest audible win first among the mutations.
Every stage lands green on `npm run verify` plus the new audio step, and is
independently shippable. "Contracted" = changes a shipped audio path and needs
a creative-triad contract (`PARAVOXIA_CREATIVE_COUNCIL.md`) before code.

### Stage 0 — Evidence floor (additive; not contracted)

**Goal.** Every later claim rests on a render of the mix the player hears.
Player hears nothing new.

**Scope.** `src/audio/soak/offlineRender.ts`, `audioAnalysis.ts`,
`excerpts.ts`, `sfxEngine.ts` (constructor injection only), `audioCore.ts`
(offline chain gains an SFX join mirror), `tools/`, `package.json`.

**Design.**
- `sfxEngine` gets an offline rim: `beginSfxOffline(ctx: BaseAudioContext,
  join: AudioNode, seed)` building the same `outputGain → submergeFilter →
  join` chain; `play`/`playOxygenPulse`/loops accept an explicit `at` time
  (default `currentTime`) so a scripted cue list renders sample-exactly. Live
  behaviour unchanged.
- `renderCombinedOffline({bed|story scenario, sfxScript: [{t, event,
  params}], seed})` — extends the existing suspend/resume driver at
  `offlineRender.ts:85`; `createOfflineMusicRuntimeChain` gains a
  post-compressor unity master the SFX mirror joins, replicating
  `audioCore.ts:332-377` exactly.
- Seeded SFX noise: swap `sfxEngine.makeNoiseBuffer` for a seeded xorshift
  **with the SFX curve constants kept** (`0.97 / 0.03 / 2.4`), seed from
  `fnv1a32(event, triggerIndex)`. This is the one shipped-path touch in Stage
  0; it is a determinism repair, not a design change, and cannot be
  byte-identical because `Math.random` never was. Recipe-identical is the
  honest claim; record it as such.
- `audioAnalysis.ts` adds: BS.1770-4 K-weighting (two biquads, coefficients
  named), gated integrated LUFS, short-term/momentary LUFS, loudness range,
  4× oversampled true-peak, inter-channel correlation, and a windowed
  spectral centroid series (cheap FFT-free proxy: zero-crossing + band
  energies through 4 biquads) for later timbre A/B.
- `npm run verify` gains `audio:check`: a 90-s combined render (bed + a
  20-cue SFX script + one `a3-dawn` handoff) asserting no NaN, true-peak
  `≤ −1 dBTP`, smoothness battery green, longest silence bound, bit-identical
  replay hash. Budget ≤ 25 s wall.
- No-watch soak runner: `score:soak:pure` runs under `PROBE_NO_HMR=1` /
  `vite-node --no-watch`-equivalent so it works under the ENOSPC watcher
  limit (audit 1 §7).

**Does not.** Change any level, curve, or node the player hears (except the
noise RNG source).

**Evidence gate.** Combined render reproducible across two runs (SHA-256 of
PCM); LUFS/true-peak values of the *current* floor recorded as baseline in
this doc's scorecard; `verify` green with the new step.

**Size / tier.** 3–4 days. Opus (`story-verifier` or general-purpose) for
analysis code, runners, and baselines; fable only to review the SFX script
that represents "typical play".

### Stage 1 — Bed timbre and mastering pass (contracted: music path)

**Goal.** The first four seconds. Same notes, same grammar; the instrument
gains weight, width, air, and a floor the ear trusts.

**Scope.** `bedEngine.ts` graph construction (`buildBedGraph`, :470-800) and
per-bar rim (:900-1200); `tuning.ts` level constants; `audioCore.ts` music
bus tail (glue stage before the safety compressor); `scoreEngine.ts:822`
reverb impulse only.

**Design.**
- *Pad choir → supersaw ensemble.* Per voice: 6 saws at named detune spread
  (±3/±9/±17 c), per-osc pan spread ±0.6·width, per-osc phase offset via
  seeded start-time jitter, +1 octave-doubling saw at −12 dB, sine organ kept.
  Per-voice lowpass (replaces the one shared filter) with slow seeded cutoff
  wander (0.03–0.07 Hz LFOs, deterministic phase). Attack breath: a 60-ms
  filtered-noise puff on every retune, era-gated (material+).
- *Sound the colour tones.* 5 pad voices; feed `publish.tones` up to index 5
  (`bedEngine.ts:920` currently `slice(1,4)`). add9/maj7 become audible, as
  the brain already wrote them.
- *Drive.* One `WaveShaperNode` per family (pad, sub-motif, lead) with a
  named tanh curve (`DRIVE_PAD_K 1.8`, `DRIVE_SUB_K 1.2`), 2× oversample,
  pre-gain `+6 dB`, wet blend by era (`0` bare → `0.45` alive) and thermal
  (`+0.2`). "Thermal drive" finally is drive, not a level lift
  (`bedEngine.ts:940, 985`).
- *Sub design.* Sub bus: sine fundamental + tri at −8 dB + saturated 2nd
  harmonic; highpass 28 Hz; `StereoPanner` pinned centre; lowpass 120 Hz on
  the sub path so unison detune never reaches it. Mono below 120 Hz for the
  whole bed via a 2-band split on `bedBus` (LR4 crossover, sum low band).
- *Space.* Replace white-noise × exp-decay impulses with early-reflections
  (8 seeded taps, 8–60 ms) + late tail with HF damping (per-sample lowpass
  in the impulse generator, `REVERB_HF_DAMP_HZ 3200`) and a pre-delay
  (`22 ms`). Both bed spaces and the story convolver (`scoreEngine.ts:973`,
  now stereo) use the same generator.
- *Glue and mastering.* On the music bus before the safety compressor: a
  glue `DynamicsCompressor` (`−18 dB`, `2.5:1`, `attack 30 ms`, `release
  250 ms`, `knee 12`) + a soft-clip `WaveShaper` (tanh, `k 1.4`) at unity.
  Levels re-balanced to an integrated target of `−18 LUFS` for the bed at
  `alive`, BLOOM (`−14`), with the loudness target a named constant pending
  the owner's answer (§6).

**Does not.** Add percussion sources, change harmony, arrangement, ladder
thresholds, or SFX; touch the safety compressor's parameters.

**Risks / protections.** SYMPHONY LAW: every new gain/cutoff/blend is a
named slew through `rampParamAt`; the smoothness battery runs on the new
graph before merge. Era ladder: drive/unison/space are gated by the same
`eraGates` so bare and colour stay PSG/NES (audit 1 protect). CPU: +~30
persistent oscillators; measured by `score:fps`. The main-thread budget is
respected because nothing here is per-frame.

**Evidence gate.** A/B renders of the six owner excerpts (`excerpts.ts:286`)
old vs new: spectral-centroid and band-energy deltas documented; integrated
LUFS within `±1 LU` of target; true-peak `≤ −1 dBTP` on the combined
render; smoothness `0 violations`; `score:fps` median `≥ 60`. Owner
audition (taste) is the acceptance.

**Size / tier.** 4–5 days. Fable (score-director) for voice design and
listening; opus for A/B renders, FPS, soak reruns.

### Stage 2 — The game mix: buses, limiter, ducking, snapshots (contracted: audioCore + sfxEngine)

**Goal.** Music and SFX become one soundtrack. Nothing can clip; impacts read
against the bed; the mix state follows the game state.

**Scope.** `audioCore.ts` bus topology; `sfxEngine.ts` output; new pure
`audio/mix/mixSnapshot.ts` + `duckMatrix.ts` (tested); `musicDirector.ts`
gains SFX-awareness; `AudioDirector.tsx` writes snapshot intent.

**Design.**
- *Category buses.* `music`, `world` (fauna, wind, water lapping, pickups),
  `player` (jump/land/mine/jetpack), `ui` (terminal keys, menu),
  `diegetic-ship`, `voice` (Stage 6), each a `GainNode` → shared
  `masterOutput`. `playSfx` keeps its signature; `SFX_CATEGORY[event]` maps
  each event (SFX join stays post-music-compressor as today).
- *True-peak limiter.* After `masterOutput`: `DynamicsCompressor`
  (`threshold −3 dB`, `ratio 20:1`, `attack 1 ms`, `release 80 ms`, `knee 0`)
  followed by a hard ceiling `WaveShaper` at `−0.5 dBFS`. Justification for
  no AudioWorklet: measured need first; the built-in compressor at 20:1 plus
  ceiling curve holds `−1 dBTP` in the Stage 0 harness or we revisit.
- *Duck matrix.* Pure table `duck[category][scoreState]` in dB with attack/
  release: e.g. `ship impact → music −6 dB / 40 ms / 900 ms`,
  `voice → music −9 dB, world −4 dB`. Driven by *events* (edge), applied as
  start-anchored slews on the category gains; never per-frame.
- *Snapshot mixer.* Pure `resolveMixSnapshot(scene, storyLead, submerged,
  station)` → per-bus gains, submerge cutoffs, reverb send preset id. States:
  `menu / sandbox / story-lead / dive / station`. The dual submerge
  thresholds (audit 2 D14) are unified under one documented pair of named
  constants per bus.
- *Dirty-check automation.* `setLayerTargets`/`setProceduralTargets` write
  only when the resolved target changes by `> AUTOMATION_EPSILON` or on a
  named cadence (250 ms); BedSignals literal becomes a reused mutable
  struct. Perf-only; measured.
- *Per-frame event queue.* `postAudioEvent({id, category, priority,
  position?, params?})` collects during a frame and flushes once, deduped
  by `(id, frame)`. Fixes level-vs-edge structurally (audit 2 D9); the
  loop-guard stays as backstop with unchanged thresholds.

**Does not.** Change SFX recipes, add spatialization, or alter music-internal
topology.

**Risks / protections.** Music topology inside `musicBus → … →
compressor` is untouched; the limiter is *after* the point both paths already
share, so the music-only path is byte-identical up to the limiter. iOS route
and unlock untouched. `sfxRateLimiter` thresholds untouched.

**Evidence gate.** Combined renders of five stress scripts (shipCrash over
BLOOM, 40-node mining burst, oxygen pulses under dive, terminal typing over
story lead, jetpack loop + splash): true-peak `≤ −1 dBTP`, integrated LUFS
within target `±1.5 LU`, duck depth measured in the render matching the
table `±1 dB`; `mining-metronome-probe.mjs` unchanged result; FPS probe
shows automation writes `< 60/s` steady-state.

**Size / tier.** 5–6 days. Fable designs the duck matrix and snapshot
values; opus builds buses/limiter/queue and runs evidence.

### Stage 3 — Composed sync and one harmonic truth (contracted: story call sites + scoreEngine mood path)

**Goal.** Every hit lands on the grid; story and sandbox share one tonic; the
moods play through the brain. "Never out of sync" and "one harmonic truth"
become literal.

**Scope.** `storyDirector.ts` (11 call sites), `signedSceneAvRuntime.ts:445`,
`emergentStoryDirector.ts:941`, `scoreEngine.ts` mood harmony path
(:1060-1075, :1362), `storyScore.ts` MOODS *interpretation* (schema
unchanged), new pure `generative/moodConstraint.ts`.

**Design.**
- *`scheduleHit` adoption.* Each `scoreHit(kind)` call becomes
  `scheduleHit(kind, quantize)` with the quantum named in the scene contract
  (`'beat'` for stingers, `'bar'` for braams, `'phrase'` for blooms); the
  returned `audioTime` is published to the AV runtime so camera/flash
  *chase* audio. Fallback: when no transport leads (menu), `scheduleHit`
  already returns null → `scoreHit` fires as today. Frozen signature kept;
  the call site changes, not the API.
- *Story transposition.* `ROOT_HZ 55` stays the reference, but the mood
  path reads `getMusicChord().root` at beat entry and pins the beat's tonic
  to the live centre (`hzForSemis(semis + liveRoot)`), moving only through
  the §8.4 sensibility guard (a mood may declare `tonicPolicy:
  'live' | 'absolute'`; default live; ch10 carrier design may pin absolute).
  The hand-back is then a prepared pivot, not a jump.
- *MOODS as constraints.* `moodConstraint.ts` derives from an existing
  `ScoreMood` a `HarmonyConstraint {mode, degreePool, tempo, registerBand,
  tensionCurve}`; the harmony brain advances *under* that constraint while
  the mood leads, so voicings come from `voiceLeading.ts` rather than
  literal semitone stacks (`[[0,3,7],[8,12,15]]`). Progression order is kept
  as a preference weight, not a hard swap. Result must contain every mood
  chord's pitch-class set — asserted.
- *Grid under story lead.* The bed's transport keeps running (silent) while
  a mood leads, so the grid exists; mood pattern clocks re-anchor to it.

**Does not.** Change any MOODS entry, dialogue timing, or camera event
without the triad; the audioTime publish is offered to Cinematography, who
decide what chases.

**Risks / protections.** Frozen contracts intact (signatures unchanged).
`STORY_AUTHORITY_CROSSFADE_S` and handoff smoothness sweep must stay
`0 violations`. Ch10 carrier-degree design protected via `tonicPolicy`.
Anchors: every quantize choice is tied to a named scene-contract anchor, not
a timestamp.

**Evidence gate.** New test: scheduled hit onset within `±1 ms` of the
returned `audioTime` in an offline render; story→bed hand-back test proving
the published root is continuous (no interval jump > the guard's budget);
legality/VL tests over every MOODS entry rendered through the brain (zero
illegal transitions, pitch-class superset holds); handoff sweep green.

**Size / tier.** 5–7 days. Fable for constraint derivation and per-beat
listening; opus for call-site migration, tests, renders.

### Stage 4 — Spatial, varied, roomed SFX (contracted: sfxEngine recipes; requires owner to lift byte-identical policy)

**Goal.** Diegetic sound is where the thing is, never twice the same, and in
the player's room.

**Scope.** `sfxEngine.ts`, `postAudioEvent` positions from `EfficientPlayer`,
`LooseStoneField`, ship components; `audio/sfx/sfxVariation.ts` (pure);
`audio/sfx/roomPresets.ts`.

**Design.**
- *Position.* `postAudioEvent` carries `position`; the engine computes
  listener-relative azimuth/distance (camera from the existing player-up/
  sun conduction in `AudioDirector`) → `StereoPanner` pan and an
  inverse-distance gain (`REF_DIST 4 m`, `ROLLOFF 1.2`, `MAX 48 m`) plus a
  distance lowpass (`20 kHz → 2.5 kHz` over range). `StereoPanner` not
  `PannerNode` by default: cheaper, deterministic, and adequate for a
  third-person voxel world; HRTF is an option flag for headphones.
- *Variation.* Seeded per trigger from `fnv1a32(event, planetSeed,
  triggerIndex)`: pitch `±4 %`, gain `±15 %`, duration `±10 %`, filter
  `±6 %`; a round-robin of 3 recipe siblings for `mine`/`land`/`blocked`.
  Seeded, hence reproducible in the combined render. This makes the 110-ms
  limiter musical rather than a metronome.
- *Room.* One convolver per environment preset (`plain`, `cave`, `interior`,
  `underwater`, `station`) built once from the Stage 1 impulse generator;
  the `world`/`player` buses have a send whose target preset comes from the
  Stage 2 snapshot; preset changes crossfade sends over `1.2 s`.
- *Coverage.* Footsteps (material-keyed: voxel type → noise band + tone),
  craft/build success distinct from `mine`, UI hover/click/back/error,
  hatch/door, station hum, water lapping. Each recipe a data descriptor, not
  a switch case.
- *Feedback lifecycle.* `feedbackCues.ts` maps `objective-enter` only. Add
  distinct `progress`, `complete`, `fail` semantics, each once per objective
  ID, routed to the `ui` bus, with legibility rules from `story/ux/README.md`.
  Chapter owns meaning; this stage only provides distinct sounds.

**Does not.** Change music, buses, or limiter; change loop-guard thresholds.

**Risks / protections.** Byte-identical policy is *lifted*, not violated —
gate on owner answer (§6). Oxygen pulses remain unquantized and unspatialized
(body sound). Rate limiter preserved; `mining-metronome-probe.mjs` rerun.

**Evidence gate.** Combined render with a moving listener script: pan and
gain follow position within tolerance; 200 `mine` triggers yield ≥ 190
distinct PCM hashes with peak spread inside `±15 %`; each room preset
changes RT60 measurably; feedback cue fires once per objective ID in the
objective lifecycle trace; fresh read-only `player-experience-auditor`
report for the feedback change.

**Size / tier.** 6–8 days. Fable designs recipes and room presets; opus
wires positions, builds descriptors, runs probes.

### Stage 5 — Long form: phrase planner, whole-bar memory, sidechain source (contracted: generative grammar + bed)

**Goal.** Thirty minutes that feel composed: intention across phrases,
withheld layers spent once, a bed that never repeats a bar fingerprint inside
the window, and breathing with a heartbeat under it.

**Scope.** `generative/arrangement.ts` (planner above it, not replacing),
`phraseMemory.ts`, `bedConductor.ts`, `soak.ts` audits, `bedEngine.ts`
(pulse voice), `tuning.ts`.

**Design.**
- *Planner.* `planSection(seed, sectionIndex, signals)` emits an intention
  4–8 phrases ahead: `{statementSchedule, registerArc, densityArc,
  withheldLayer, bloomBudget}`. Arrangement's Markov chain receives the
  intention as biases and caps (BUILD may now span 2–3 phrases; a BLOOM is
  paid for by a prior withhold). Recapitulation rule: a section may quote
  the first statement's development chain once, transposed by the brain's
  current centre. Sections are seeded from `fnv1a32(planetSeed,
  sectionIndex)`; the drift clocks continue underneath as weather.
- *Whole-bar memory.* `phraseMemory` hashes the bar fingerprint the soak
  already computes (`soak.ts:724`) — pads voicing + ostinato cell + perc
  rotation + register — and forbids recurrence inside `BAR_TABU 32`; on
  collision the conductor applies the cheapest legal variation operator
  (rotation, ostinato subdivision flip, register shift) and re-checks.
  Tabu bypass becomes an audited exception with a budget.
- *Vocabulary.* First-class 7th-degree, quartal, and sus voicings in the
  per-mode chord pool (`theory.ts`), each with VL legality; mediant ration
  untouched.
- *Sidechain source.* A designed pulse at BUILD/BLOOM only: sine
  pitch-drop body (`80 → 45 Hz`, 120 ms) + click transient + short noise
  tail through the Stage 1 sub drive, on the transport's beat, level gated
  by energy. The `breathGain` dip keys off *that*. Below BUILD, sidechain
  depth goes to zero — no pumping without a source.
- *Dead mappings.* Consume `oxygen` (dive: sub-motif density and pad HF
  roll-off), blend `biomeWeights` into mode weights, route `detail` to
  ostinato density. Each recorded in §8.4 of `PARAVOXIA_SCORE.md`.

**Does not.** Change ladder thresholds, story moods, or the tick voice.

**Risks / protections.** Legality is still re-derived independently in the
soak; new red-tests for the planner (a doctored log with a bloom not paid
for must fail). Smoothness battery on all section boundaries.

**Evidence gate.** 32-min pure soak ×3 seeds: `barNovelty ≥ 0.85`,
`tabuBypasses ≤ 4`, `distinctChords ≥ 30`, no section repeats its
`(statementSchedule, registerArc)` pair; real OfflineAudioContext soak
green; blind listener check: two 3-min excerpts from the same seed 20 min
apart judged "different passage" by the `scene-naive-viewer` on audio only.

**Size / tier.** 6–8 days. Fable for planner design and vocabulary; opus for
memory hashing, audits, soaks.

### Stage 6 — Voice bus and the narrator's fidelity (additive bus; contracted where it joins story surfaces)

**Goal.** Terminals and the station AI *sound*. The narrator speaks in the
era's fidelity — 1-bit chirps at bare, a filtered radio voice at alive.

**Scope.** New `audio/voice/voiceBus.ts`, `voiceGranular.ts` (pure phoneme
plan), `TerminalPrologue.tsx` / station text surfaces subscribe; Stage 2
`voice` bus and duck row.

**Design.**
- *Chain.* `source → bandpass 300–3400 Hz → tanh saturation → comb
  (radio) → noise floor (seeded) → voice bus`. Era-gated: bare = PSG blips
  per character (Animal-Crossing/LSDj style), colour = two-pulse formant
  pairs, material+ = granular vocoder with formant sweeps drawn from a
  seeded per-character table; alive = optional TTS through the same chain
  (§6). Rhythm of syllables rides the typewriter cadence already in
  `terminalKey`, never the music grid — the narrator is not a musician.
- *Harmonic law.* Formant/pitch centres snap to the published chord's
  pitch-class set an octave above the pad register, so the voice never
  clashes; that is the only musical coupling, and it is deliberate: the
  hidden narrator is in tune with the world without the player knowing why.
- *Accessibility.* Every voice cue has a caption event; `terminalAlarm`,
  `storyGlitch`, oxygen pulse gain visual parity events (Cinematography
  owns the visuals; this stage emits the events).

**Does not.** Author words, reveal ontology, or change story timing. Reveal
discipline: the voice is a *fidelity* of the terminal, not a character,
until Chapter approves otherwise.

**Evidence gate.** Voice intelligibility proxy (band energy ratio) at each
rung; duck depth on music measured; caption events fire once per line;
combined render with narration over BLOOM holds `−1 dBTP`; blind viewer
reports the voice as "the terminal speaking", not "a person".

**Size / tier.** 5–7 days plus owner decision. Fable for design; opus for
chain, captions, evidence.

---

## 4. Stage 0 and Stage 1 are fixed; the rest is a position

Stage 0 is non-negotiable because every audit finding about the mix is
currently an inference. Stage 1 is first among mutations because it is the
gap heard in four seconds and touches one file's graph. My position on the
rest: Stage 2 before Stage 3 because a limiter and buses make every later
listening test honest; Stage 3 before Stage 4 because sync and one tonic are
the brief's own words and are unblocked; Stage 4 waits on the byte-identical
ruling; Stage 5 is the deepest and benefits from hearing Stages 1–2 first
(a richer instrument changes what "repetition" sounds like); Stage 6 waits on
the voice ruling and on Chapter. If the owner wants a shorter road, ship
0–1–2–3 and stop: that alone is most of the audible distance.

---

## 5. Design decisions I am making as composer

- **Sidechain gets a source or goes silent.** Breathing against nothing
  reads as a broken pump. The pulse at BUILD/BLOOM gives the ODESZA breath a
  heartbeat and makes the bloom release mean something; below BUILD the pads
  hold still, which is Zimmer's stillness rather than a defect.
- **MOODS become constraints to the harmony brain.** The chapter-director's
  authorship stays exactly where it is; what changes is who voices the
  chords. Literal semitone stacks in parallel root position are the one
  place a wrong-sounding note can still be written by hand; the brain's
  voice-leading is the law that prevents it.
- **Story score transposes to the live tonic by default.** The planet is the
  key; a story beat is a mood *in* that key. An unprepared jump to A at every
  beat entry is the loudest harmonic discontinuity in the game. `tonicPolicy:
  'absolute'` remains for ch10's carrier degree, where the pitch itself is
  the meaning.
- **Streamed loops retire in Stage 1.** A loop is a defect by owner law, and
  a fixed-key recording under a key-drifting bed is a wrong note by
  construction. Once the bed has drive and space the stems have no argument
  left; the owner audition that gates retirement is the Stage 1 audition.
- **Drone bank folds into the bed.** Its fixed pitches were killed by
  retuning to the root, but a bare fifth pedal against a mediant is still a
  wrong note. The chip-drone floor already in the bed is the same idea done
  by the brain; `musicEngine` becomes menu transitions only.
- **`scheduleHit` is adopted; visuals chase audio.** A drop that lands late
  is a defect. Audio is the only clock that is sample-accurate; letting the
  frame chase the returned time is how film does it.
- **Supersaw with per-voice pan, not more filters on three voices.** Width
  comes from decorrelation, not from a wider stereo pan of mono sources.
  Drive comes from a waveshaper, not gain — harmonics are the weight.
- **Mono below 120 Hz, sub pinned centre.** Detuned lows smear and cancel
  on speakers; the tuned sub melody must be felt as one thing.
- **`StereoPanner` for SFX, HRTF opt-in.** Deterministic, cheap, sufficient
  for a third-person world; spend the CPU on the score.
- **The narrator's voice is a fidelity, not a character.** It rides the era
  ladder and snaps to the chord's pitch classes; that is the hidden pillar
  made audible without a reveal.
- **Silence stays composed.** REST remains a state, the planner may spend
  it, and the limiter never fills it.

---

## 6. Open questions for the owner (each changes the work)

1. **Voice: granular vocoder baseline only, or TTS at `alive`?** Granular
   is zero-asset, deterministic, and era-native; TTS needs an asset/API
   decision, a language plan, and changes Stage 6's size and reveal risk.
2. **Loudness target.** `−18 LUFS` integrated for sandbox bed with BLOOM
   peaks near `−14` (film-like dynamics) versus `−16` (game/streaming
   norm). This sets every level constant in Stages 1–2.
3. **Is the byte-identical SFX policy lifted for Stages 4–5?** Without it,
   Stage 4 can add new events and position only *new* recipes; the twenty
   shipped recipes stay fixed and unvaried. (Stage 0's seeded noise is a
   determinism repair and is proposed regardless — please confirm.)
4. **Mobile CPU budget.** Stage 1 adds ~30 persistent oscillators and three
   waveshapers; Stage 4 adds up to five convolvers. Is the target 60 fps on
   the desktop SwiftShader gate only, or also a named mobile device? A
   `quality` tier in the mix snapshot can drop unison count and room count.

### Decisions taken (2026-09-04, owner delegated to the composer's judgement)

1. **Voice: granular vocoder, no TTS.** The narrator is the hidden pillar;
   a recognisable synthetic *speech* voice would resolve the ambiguity the
   copy law protects, and it would import latency, a network dependency,
   and an asset policy into a system whose whole virtue is that it is
   generated from the same seed as the world. The granular voice climbs the
   era ladder with everything else (PSG buzz → NES formant trio → smooth
   grains at `alive`), snaps to the published chord's pitch classes so it
   can never be a wrong note, and is deterministic under the run seed.
   The bus stays TTS-ready (a `speak(buffer)` input beside `utter(text)`),
   so a later human-voice decision is an asset drop, not a rebuild.
2. **Loudness: −18 LUFS integrated, −1 dBTP true peak, on the summed game
   bus.** This is a slow, atmospheric game whose emotional peaks are
   BLOOMs and dives, not gunfire. Film-like dynamics (bed near −20/−21,
   BLOOM peaks near −14, short-term) leave 3–4 dB for SFX transients to
   sit *on top of* the bed rather than fight it, which is the condition
   for the Stage 2 duck matrix to be subtle. −16 is a streaming/mobile
   norm that would flatten exactly the dynamics the Zimmer half of the
   brief is about. The player's volume slider, not the master, closes the
   gap on quiet devices.
3. **Byte-identical SFX policy is lifted, replaced by recipe-identical.**
   The twenty shipped recipes keep their synthesis shape (oscillator
   types, filter path, envelope shape, nominal centre values); Stage 4 may
   add seeded per-trigger variation, position, and room to them. The
   protection moves from bit equality, which was never true because the
   noise source was `Math.random`, to a spectral-fingerprint regression per
   event in the Stage 0 combined render (centroid, bandwidth, duration,
   peak within tolerance). Stage 0's seeded noise is confirmed.
4. **Mobile is a budget, not a gate.** A `quality` field in the mix
   snapshot: `full` (desktop; 7-osc unison, 3 drive stages, 5 rooms) and
   `lean` (mobile/low tier; 3-osc unison, 1 shared drive, 2 rooms via a
   feedback-delay reverb instead of convolvers). Audio main-thread cost
   target: ≤ 1.5 ms/frame desktop, ≤ 3 ms/frame lean, measured by the
   existing `score:fps` probe. The SwiftShader gate stays the release gate;
   `lean` is proven on it with the CPU throttled 4×.

---

## 7. Scorecard (expected before → after)

| Stage | Metric | Before | After |
|---|---|---|---|
| 0 | Combined music+SFX render exists | no | yes, replay-hash stable |
| 0 | LUFS / true-peak measurable | no | yes; baseline recorded |
| 0 | `verify` audio step | none | ≤ 25 s, gate on TP/NaN/smoothness (Stage 1: 25.5 s measured on the heavier instrument; advisory budget raised to 40 s, binding checks unchanged) |
| 1 | Pad partials sounding (colour tones) | 3 of ≤5 | **5 of 5** (`publish.tones.slice(1, 6)`, `PAD_VOICES_FULL 5`; lean tier 3) |
| 1 | WaveShaper stages in music path | 0 | **3 + soft clip** (pad/sub/lead tanh, unity-slope; glue soft clip k 1.4) |
| 1 | Integrated LUFS (alive bed) | −23.14 LUFS, peak 0.327 (measured) | **−20.48 / −18.99 / −20.53 / −21.07 LUFS** (day / night / contrast A / B, bed alone; target −20.5 ±1; night carries its pre-existing +1.5 LU night lift); bed-check 90 s −20.41; TP −9.37…−7.28 dBTP; BLOOM short-term max −16.9…−18.9 (−14 target NOT reached: the untouched safety compressor, 8:1 with its 30 dB knee, caps the spread — routed to Stage 2) |
| 1 | Owner audition | last passed 2026-07 | pending: A/B WAVs in `.codex/production-runs/2026-09-04-audio-10x/evidence/stage-1/{before,after}/` |
| 2 | True-peak on stress scripts | −9.70 dBTP (measured, ungated) | **≤ −1 dBTP gated**: five stress scripts worst −4.92 dBTP (40-node same-frame mining burst), others −8.9…−9.5; ceiling holds −1.58 dBTP on a +12 dBFS burst (4× oversampled); limiter = DynamicsCompressor −1/20:1/knee 0/1 ms/80 ms + 4× WaveShaper ceiling, post-join, no AudioWorklet |
| 2 | Duck on impact (music) | 0 dB | **−6.0 dB** measured (shipCrash, shipLand), within 1 dB at +35 ms and full depth at +40 ms after the audible onset; terminalAlarm/Corrupt −4.0 dB at +35 ms; −3.0 dB cap under a story lead |
| 2 | AudioParam writes/s steady-state | ~1140 (AudioDirector) + score scheduler = 2276 measured | **590** (AudioDirector's share eliminated by the dirty check; residual = `scoreEngine.applyRails` 528/s + one per-frame ramp 60/s, outside the Stage 2 lane — routed to Stage 3; target < 60 NOT met) |
| 2 | Safety compressor | −20 dB / 8:1 / 30 dB knee, +1.99 dB baked makeup (measured) | −6 / 20:1 / knee 3 / 3 ms / 0.1 s; makeup cancelled (`SAFETY_MAKEUP_COMP_DB −2.91`); the old tail's +1.99 dB kept as the named `TAIL_REFERENCE_GAIN_DB` so bare/colour/floors are unchanged within 0.02 LU (owner decision pending — evidence/stage-2/README.md deviation 1) |
| 2 | BLOOM short-term (bed-sandbox-day / shipCrash-over-BLOOM) | −18.12 / −18.11 | **−17.90 / −18.08** — target −14 ±1 NOT met; removing the programme squash opened 0.21 LU, not 3.6; the tail has no further mechanism (README deviation 2) |
| 2 | Bed alone at alive | −20.48 / −20.51 / −20.53 / −21.07 | −20.36 / −20.39 / −20.39 / −20.96 (still −20.5 ±1) |
| 2 | Re-baseline bare/colour | Stage 1 hashes | pre-tail taps fingerprint-identical, ≤ 1 LSB; through the new tail ΔI ≤ 0.016 LU, ΔS ≤ 0.09 LU per 3 s window, ΔTP 0.007 dB; owner A/B pending |
| 2 | Story floors ch4-defy / refused / seam-ebb | −33.10 / −26.93 / −23.20 | −33.11 / −26.94 / −23.19 (within 0.01 LU; S-max not raised) |
| 2 | LATENCY_COMP_MUSIC_PATH_S | ~12 ms assumed (14.875 ms measured, old tail) | **25.215 ms** measured after the limiter; SFX path 10.340 ms; music lags SFX 14.875 ms (< 1 frame) — Stage 3 sums it into bundleAt (C6) |
| 2 | mining-metronome-probe | loop guard 0×, admit 1.33/s, suppressed/3 s 5 | loop guard 0×, admit 1.33/s, suppressed/3 s 0 (per-frame queue absorbs the retriggers) |
| 3 | Story hits on grid | 0 / 11 | **11 / 11** (ten anchors; the descent's boom+braam is one `impact` onset): offline onset proof 30/30 at three grid phases, max \|onset − audioTime\| **0.045 ms** (target ±1 ms), every slack ≤ cap (worst margin 20.5 ms under the cap); the a2/a4 rows land on the beat, a3 on the bar, the lift leads by ≤ 351 ms; live: see evidence/stage-3/sync (bundleAt fire lateness ≤ one frame, image-vs-onset on the audio clock) |
| 3 | Story↔bed tonic jump | unprepared | **prepared by construction**: prologue = `planetHomeRoot(seed)` = the bed brain's own tonic draw; colour/dusk/vigil/reconstruct read the live bed tonic at entry (else the seed root); ch10 absolute at 0; chain hold + mid-chain reload interval identity tested |
| 3 | MOODS voiced by brain (legal VL) | 0 % | **9 of 29 brain-requested progression moods re-voiced** (voyage, ch1-raster, ch1-depth, ch3-dusk, a3-dawn, ch3-forage, ch8-crossing, ch9-settle, ch9-hearth) under the gain guard; 0 illegal: every pitch-class set, every root and every written tight interval kept exactly, no voice ever moves further than the composer's written jump; total inner-voice motion over two cycles 1291 → 958 semitones, max single move 11 → 9; the other 20 stay literal with a recorded reason (12 ch10/ch4-comply/a4 rows literal by law). Commit A (all literal) fingerprint-identical 62/62 to the pre-Stage-3 render (harness replay floor 1 LSB) |
| 3 | AudioParam writes/s steady-state | 590 (Stage 2) | **27.6 median** (max window 63.2): applyRails dirty check (`RAILS_DIRTY_*`) + legacy keep-alive cadence 0.25 → 2 s; dirty check is inaudible by measure (\|ΔRMS\| ≤ 0.007 dB, residual ≤ −81 dBFS) but not bit-identity (fingerprint flips 56/62), reported as a delta |
| 4 | Distinct `mine` renders / 200 | 1 | ≥ 190 |
| 4 | SFX positional | none | pan/gain follow position |
| 4 | Room presets | 0 | 5, RT60 distinct |
| 4 | Feedback semantics distinct | enter only | enter/progress/complete/fail |
| 5 | barNovelty (32 min, 3 seeds) | 0.31–0.50 (re-measured 0.495 / 0.313 / 0.441 at Stage 5 before) | **0.966 / 0.868 / 0.928** (seeds 5/8/10; target ≥ 0.85 met on all three; the fingerprint now carries voicing + quantized levels and is a LAW — `BAR_TABU 32` through `phraseMemory.hashBar`, REST exempt as composed stillness) |
| 5 | tabuBypasses | 16–100 | **whole-bar tabu bypasses 0 / 0 / 0** (`barTabuBypasses`, budget 4 per 1056 bars); the HARMONY chord-tabu bypasses (`tabuBypasses` 13 / 100 / 16) are unchanged — they live in harmonyBrain.ts, deferred to the Stage 5 second pass with the chord pool |
| 5 | distinctChords | 14–21 | 22 / 16 / 15 — NOT met: needs the wider per-mode chord pool (theory/harmonyBrain), deferred to the Stage 5 second pass after Stage 3 lands |
| 5 | Sidechain with a source | never | **BUILD/BLOOM only** (plus a ≤ 2-bar slewed release): `plan.pulse` is the source (root-tuned click + body + tail, body gated by the alive fade), `sidechainDepth = SIDECHAIN_DEPTH × PULSE_BREATH_SCALE × pulse.level`, breath dips keyed to the pulse onsets alone |
| 5 | BLOOM S-max on the four beds (shipped tail) | −17.90 / −18.04 / −16.59 / −18.79 | **−14.83 / −14.70 / −14.06 / −14.80** (−14 ±1 met) with bed-alone I **−20.10 / −20.27 / −19.97 / −19.57** (−20.5 ±1 met), TP ≤ −4.87 dBTP, smoothness 0 — a BLOOM-only arrangement rail on the layer levels (`BLOOM_RAIL_*_DB`), no tail retune |
| 5 | composedSpread (pre-tail S-max − I) | 2.72 / 2.71 / 4.39 / 2.29 | see evidence/stage-5/after/ab/ab-results.md (rises on all four) |
| 5 | Sections / statements / blooms (32 min) | BLOOM every ~4 min, always a one-phrase BUILD; statements 17 / 22 / 17 | sections 12 / 21 / 13 with no repeated (schedule, arc) pair; BUILD spans 1–3 phrases; blooms 10 / 9 / 8 of 1–2 phrases; statements 17 / 30 / 21, every one scheduled by the planner; every planned bloom paid for by a withheld layer (audited) |
| 6 | Voice-bearing text surfaces | 0 | terminals + station |
| 6 | Cue captions / visual parity | none | all voice + alarm/glitch/oxygen |
| all | FPS with score (SwiftShader gate) | 60.39 median | ≥ 60 median |
| all | Smoothness violations | 0 | 0 (thresholds may only tighten) |
