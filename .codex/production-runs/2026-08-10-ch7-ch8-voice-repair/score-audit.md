# Score Continuity Audit

Reviewer: score-continuity-auditor (Opus 5), independent Stage 7 first wave
Status: complete — DELTA mode (no score code changed this run)
Contract revision: `draft-v5`, sha256 `36a7cb4f2bf9cc8d24d2413579225dcb50a4436b37a20fb762d79fec6cb4ecdb`
Audit performed against: `draft-v4`, sha256 `df544b130773c3ba9ab4f0132f0223616db5767bbda7e9e6dd59bf8ab3a1f1e3`
(each re-verified against the file on disk at the time of reading; see the
dated ADDENDUM at the end for the v5 revalidation)

## Independence and authorities

- First report completed before reading peer conclusions: yes. No Stage 7
  review file was opened (`story-audit.md`, `naive-audience-report.md`,
  `ux-audit.md`, `cinematography-audit.md`, `cohesion-judge.md`). Triad
  artifacts read as permitted: `scene-contract.json`, `score-treatment.md`,
  `dissent-register.md`, `audio-report.md`, `score-contract-signoff.json`,
  `production-lock.md`, `story-intent.md`, `defects.json`.
- Score bible/runtime/cue references inspected, all at `03e975a` (HEAD, and
  `git status --porcelain` shows every protected audio path clean):
  `main/src/story/emergentScoreDirector.ts:58` (`OWNED_BEATS`), `:77`
  (variant resolver), `:266` (`applyReconstructionVariant` change guard);
  `main/src/story/storyScore.ts:82,94,98,101` (MOODS rows), `:132-190`
  (`CH7_RECONSTRUCTION_MOODS`), `:254` (`setStoryScoreMoodOverride`);
  `main/src/story/signedSceneAvRuntime.ts:349-364` (`scoreIntensityFor`),
  `:367-372` (`scoreHitFor`), `:209-220` (`SYMBOLIC_BEAT_BOUNDARY_ANCHORS`);
  `main/src/audio/scoreEngine.ts:335-338,1063,1078,1304,1480,1502`;
  `main/src/audio/soak/audioAnalysis.ts:17,34,36,180-197`;
  `main/src/story/generatedSceneAvRuntime.json` (anchor/cue vocabulary);
  `main/src/story/reconstructionCalibration.ts:10`.
- Audio, trace, frame, and performance evidence inspected:
  `evidence/score-ch8-window-analysis.json` and its four WAVs;
  `evidence/verification/score-ch8-window-verify-analysis.json` and its four
  WAVs; `evidence/verification/ch8-window-av-score-trace.json` (77 samples);
  `evidence/verification/ch7-window-av-score-trace.json` (36 samples);
  `evidence/verification/audio-window-census.json`;
  `evidence/verification/fps-verification.json`; `verification-report.json`;
  `implementation.diff`.
- Independent derivations performed (not taken from any peer artifact): the
  ch7/ch8 bar and progression-field clocks from `STEPS_PER_BAR`/
  `STEPS_PER_CHORD` and each mood's tempo; the generic-ramp values from the
  shipped anchor counts; Stage 2 vs Stage 6 measurement deltas recomputed
  from the two analysis JSONs; `audioHealthPass` re-evaluated over the
  recorded analysis fields.

## Findings

- **Harmonic authority and motif continuity:** one authority throughout, and
  it holds. ch7 runs a single accretive instrument on an unchanging tempo
  (64), wave (triangle) and octave (12) across all eight variants and into
  `ch7-board.outside` — no era or register escalation anywhere in the
  chapter. Voice leading is minimal-motion and prepared: `[0,7,14]` holds
  through diagnosis/bench/frame; `hull` moves one voice (`7`→`5`, adding `9`)
  while `0` and `14` are common tones; `lift` moves `5`→`7` to reach
  `[0,7,9,14]`, which is then the settled chord for `hover`, `route`,
  `calibration` and `ch7-board.outside`. The chapter's harmonic arrival is
  therefore at **M5**, and M6/M7 are density/colour moves over a settled
  chord — which is independent support for the Score Director's reading of
  the M6 swell as commitment rather than arrival. The `calibration` added
  semitone is a prepared dissonance (`14` has been a chord member since
  diagnosis; `14`→`15` is a semitone) and it is *released* at the ch7-board
  seam, where `outside` returns progression field 2 to `[0,5,9,14]` and drops
  `15` from the melody scale. No illegal pitch found; `hull`'s retained
  ostinato `7` over `[0,5,9,14]` is a scale-legal pedal/suspension
  (`storyScore.ts:170` melody scale contains 7), not an accident.
- **Arrangement, timbre, rhythm, and era fidelity:** era-correct and
  unchanged. The square wave — the shipped timbre for "the system speaking"
  (`ch4-arrival`/`ch4-audit`/`ch4-comply`, `storyScore.ts:73-79`) — is
  correctly absent from every ch7 and ch8 mood, so the regulation band gets
  no timbral acknowledgement anywhere, exactly as contracted. The
  triangle→sawtooth move at `ch8-launch` (tempo 72, ost 0.075, the highest
  ostinato gain in the whole table) is the private-labour-to-engine
  transition and is coherent. No new instrument, asset or fidelity rung was
  added or required. **New rhythmic fact nobody recorded:** every variant
  change routes through `setStoryScoreMoodOverride` → `setScoreMood`, which
  resets `patternStep = 0`, `chordIndex = 0` and `melodyDegree = 4`
  (`scoreEngine.ts:1480-1497`). Each repair commit therefore restarts the bar
  and the progression on the player's action — defensible and arguably good
  (the commit becomes the downbeat), but it makes the contract's phrase
  language imprecise (defect `sa-05`).
- **Authored silence and restraint:** the restraint is real and verified.
  `scoreHitFor` (`signedSceneAvRuntime.ts:367-372`) returns `bloom` only at
  `anc.maw.repair-committed`, so **no hit exists anywhere in ch7 or ch8**;
  the live trace confirms `score.hit: null` at all 77 ch8-window samples and
  all 36 ch7-window samples. The census confirms `showCaption`/
  `showAuditLine` emit nothing on any audio bus. L6's window has nothing
  added: no score event, no SFX from +5.76 s to the advance, no cue change.
  Both `type: "silence"` cues are intact and carry the UNMET-BY-SHIPPED
  record plus the no-fill law. **Binding constraint the packet inherits and
  no artifact states:** the shipped quiet-bed law forbids actual silence —
  `MAX_LONGEST_SILENCE_S = 0` with `SILENCE_RMS = 1e-4`
  (`audioAnalysis.ts:12-17`), and all four renders measure
  `longestSilenceS: 0`. The commissioned "near-silence" must be composed
  near-silence at or above the defy floor, never a gap.
- **Cue-to-anchor synchronization:** every contracted offset lands. Measured
  against the census, contract tolerance 0.2 s: ch8 stack rows +2.015/+4.032/
  +6.032, `CONTACT LOGGED.` +8.548, designation +11.565, L6 +14.064, advance
  +17.081; ch7 M7 caption +0.604, exit line +3.021, advance +5.021. All
  within 0.09 s. **However, three of eighteen contracted cue *relations* are
  not true of the shipped code** (defects `sa-02`, `sa-03`) — an invented cue
  id, a ch7 cue bound to a ch6 anchor, and the seam value attributed to the
  wrong anchor.
- **Story/image/control alignment:** the ch7 per-stage rulings hold on
  independent reading of the shipped mood table, with two corrections that
  *strengthen* them (M2 also relocates the answering fifth from pattern step
  6 to step 4 — the mid-bar strong position — under "allowed to be heavy", so
  I rule M2 **weakly serves** rather than merely coexists; `calibration`
  does not "keep every earned layer" — melody density drops 0.52→0.46 and the
  pattern's last note moves 14→9, which is *better* for "not claiming
  arrival"). The M7 ruling is true, but it is true by a **0.5 s margin that
  nobody has recorded or tested** (defect `sa-04`). On the ch8 side the
  plateau claim is fully confirmed — but the plateau is only the *intensity*;
  the harmony is not static, and its phase relative to the copy is
  route-random (defect `sa-06`).
- **Mix hierarchy and masking:** the combined-bus method is correct per the
  lock (multiple engines stack on the music bus; score-only renders are
  inadmissible) and the conservative direction is correctly stated (streamed
  stems silent offline → live ≥ measured). Levels are sane and text-safe:
  −19.93 dBFS at the hold, peaks ≤ 0.363, `clipCount: 0`, `nanCount: 0` in
  all eight renders. The −19.93 vs −23.83 comparison is reproduced and I
  concur with it. But the block-level `score.mixIntent` field carries
  governance text rather than any mix hierarchy, and two renders fail the
  repo's own `audioHealthPass` (defects `sa-07`, `sa-08`).
- **Mobile/headphone/reduced-intensity parity:** declared non-measurement
  with a stated reason (no audio path changed, no new cue exists). Accepted
  as honest scoping, not as an untested claim. Reduced-motion produced an
  identical line sequence and adds no audio — verified as consistent with the
  score lane having no reduced-motion surface at all.
- **Soak, performance, replay, focus, quit, and completion reset:** FPS
  evidence checked directly: ch8 hold median 60.06 (min 60.03) over five 3 s
  samples, beats at 60.09/60.09/60.06 vs baselines 60.12/60.11/60.08, all
  `passFloor`/`passCeiling` true at 1280×720 LOW. This is a vsync-capped
  desktop measurement — adequate as a no-regression proof, not a headroom
  probe. No CPU, voice-count or audio-node-lifetime measurement exists
  anywhere in the run; acceptable this run (nothing on the audio path
  changed), but it is a gap the packet must close. Quit/replay/pause/reset
  traces confirm the score store clears with `lastResetReason: 'beat-exit'`.
- **Determinism and anti-repetition:** the method is **sound** — measurement
  equivalence is the right instrument when `OfflineAudioContext` scheduling
  is not bit-deterministic, and byte-hash equality would have been the wrong
  gate. The artifact is in fact *stronger* than the reports claim: each case
  carries 20 windowed RMS values plus peak, RMS, `nanCount`, `clipCount`,
  `longestSilenceS` and the full smoothness block, and two renders taken
  2 h 23 min apart agree on **all** of them. That is a genuine determinism
  proof for the seeded generative bed (`scoreUnit(SALT_*, patternStep)` is a
  pure function of step, so there is no seed state to drift). The stated
  tolerance, however, is wrong in three artifacts (defect `sa-07`).
  Anti-repetition inside the ch8 hold: the ostinato figure (3.333 s) repeats
  ~5.1 times and the 20 s harmonic cycle never closes inside the 17.07 s
  window; the melody is a bounded random walk, so nothing literally loops.
  No repetition defect, but see `sa-06` for the phase consequence.
- **Implementation versus signed contract:** the lane discipline is clean.
  `implementation.diff` touches only `emergentStoryDirector.ts`,
  `emergentStoryDirector.test.ts` and the new `storyText.test.ts`;
  `git status --porcelain` shows every protected audio/score path unmodified
  at `03e975a`. Zero score mutation, as ruled. The SC-N3 term-4 prohibition
  is propagated at exactly 9 occurrences in the contract as the signoff
  claims, and **no run artifact anywhere describes the shipped window as
  near-silent** — every `near-silen*` hit in the contract, the treatment, the
  audio report, the dissent register, the evidence JSONs and the evidence
  registry is either the prohibition itself, the UNMET-BY-SHIPPED record, or
  the `near-silence-ref-defy` case name for the ch4-defy yardstick. The one
  pre-ruling mention (`story-intent.md:538-541`) poses near-silence as the
  commission's ask and an open question, which is correct for that document.
  The packet is recorded intent-only and gates nothing: it appears only in
  `mixIntent`, in `(packet)`-marked phraseIntent clauses, and in the dissent
  register; no acceptance criterion, no `defects.json` entry and no
  verification check depends on it. **Confirmed clean on both dissent-01
  discipline questions.**

## Defects

| ID | Severity | Anchor | Observation | Evidence | Owner | Required verification |
| --- | --- | --- | --- | --- | --- | --- |
| `sa-01` | high | `anchor.ch8.contact-logged` (routed packet scope) | The named packet **cannot deliver its own design as scoped**. It proposes making `ch8-launch` a score-owned beat with `setStoryScoreMoodOverride` as "the only authority surface", and lists only `emergentScoreDirector.ts` + `storyScore.ts`. But the signed rail still calls `setScoreIntensity` at all three launch anchors: `scoreIntensityFor` excludes ch7 **by beat name** (`signedSceneAvRuntime.ts:353`) and there is no ch8 exclusion, so an `exit-decay` mood entered on the `deep_space` fact races the atmosphere-exit anchor's 0.5 in the same tick — the same class of same-tick race intent D1 already found. The ch7 exclusion exists precisely because signed anchors "may not manufacture a second time/index-based intensity progression over the gameplay-derived mix" (shipped comment, `:350-352`). `signedSceneAvRuntime.ts` is a **protected path** (`production-lock.md:44,135`) and "protected-path requirement" is a stop/escalation condition (`:64`), so the packet must request that authority explicitly or the owner's "approve" is unexecutable. | `signedSceneAvRuntime.ts:349-364`; `emergentScoreDirector.ts:58`; `score-treatment.md` §5 file list; `production-lock.md:44,64,135` | score (packet commission) | Amend the packet scope before it routes to the owner: name `signedSceneAvRuntime.ts:scoreIntensityFor` (add the `ch8-launch` exclusion, mirroring ch7) as in-scope, flag the protected-path authority requirement, and state the ordering guarantee. No code change this run. |
| `sa-02` | medium | `anchor.ch8.advance` / `cue.ch8.advance` | The seam cue is doubly mis-specified against shipped reality. (a) `cueRef: "sc.crossing.entry"` **does not exist** — the shipped cue vocabulary has `sc.crossing.distance` on all four ch8-crossing anchors; it is the only invalid identifier among the 18 cues. (b) The phraseIntent attributes the measured 0.35 to "the crossing entry anchor". It is not: ch8-crossing has no symbolic entry anchor, `anc.crossing.origin-lookback` is `player-action` + `:optional` and is skipped on the traced route, and 0.35 = `0.42 × (0.75 + 0.25 × 1/3)` is the **second** anchor `anc.crossing.sibling-targeted`. The entry anchor's value would be 0.315, so the seam is route-dependent and the contract freezes only one branch. Same error in `score-treatment.md` §2 point 5 and §3. | `generatedSceneAvRuntime.json` ch8-crossing anchors; `evidence/verification/ch8-window-av-score-trace.json` (0.35 at `anc.crossing.sibling-targeted`); `signedSceneAvRuntime.ts:358-364` | score | Contract text repair at next revision: `cueRef` → `sc.crossing.distance`; restate as "the first ch8-crossing anchor that fires applies its ramp value — 0.35 at `anc.crossing.sibling-targeted` on the common route, 0.315 if the optional origin lookback is taken". Re-verify against the shipped cue vocabulary, not against prior contract bytes. |
| `sa-03` | medium | `cue.ch7.entry-steady` / `anc.dive.shore-bank` | A ch7 cue is bound to a **ch6-dive** anchor. The contract asserts `cueRef: "sc.reconstruct.one-instrument"` at `anc.dive.shore-bank`; shipped, that anchor is `beat: "ch6-dive"` and carries `sc.dive.two-clocks`, and ch7-reconstruct has no symbolic beat-boundary anchor at all (`signedSceneAvRuntime.ts:209-215`). The cue's prose ("no cue fires at beat entry") is correct; the machine-readable binding is not. Root cause shared with `sa-02`: all three signature cycles verified v4 bytes against the v2 capture, never against `generatedSceneAvRuntime.json`. | `generatedSceneAvRuntime.json`; `scene-contract.json` `.score.cues[0]`, `.syncAnchors[0]`; `score-contract-signoff.json` conditions V3-A | score | Contract text repair: express the ch7 entry relation as the beat-entry mood application (`setScoreMood` at `enterEmergentScoreBeat`), not as a cue on a ch6 anchor. Add a one-line mechanical check that every contracted `cueRef` and shipped-anchor `anchorRef` resolves in `generatedSceneAvRuntime.json`. |
| `sa-04` | medium | `anc.reconstruct.calibration` / M7 | The chapter's signature harmonic claim survives on an **undocumented 0.5 s margin** and has no test. The `calibration` added semitone lives in progression field 2, which begins 16 steps × (60/64/2) = **7.5 s** after the mood change; the mood change happens at calibration *start* (`emergentStoryDirector.ts:690-693` maps `phase === 'running'` → `'active'`, and `resolveChapter7ReconstructionScoreVariant` returns `calibration` for any non-`none` state), and `RECONSTRUCTION_CALIBRATION_SECONDS = 8`. So field 2 opens 0.5 s before the M7 receipt and runs to +7.0 s after it — the semitone genuinely sounds under M7, the exit line and the whole D9 hold. But shorten the calibration procedure below 7.5 s, change the ch7 tempo, or change `STEPS_PER_CHORD`, and the payoff silently vanishes with no failing test and a contract relation that becomes false. | `storyScore.ts:180-190`; `scoreEngine.ts:335-338,1063,1069-1070`; `reconstructionCalibration.ts:10`; `emergentStoryDirector.ts:690-693` | score | Record the coupling as a named invariant in the score contract (`RECONSTRUCTION_CALIBRATION_SECONDS` ≥ ch7 field-2 onset) and add a unit assertion. Read-only this run; no behaviour change. |
| `sa-05` | low | `cue.ch7.exit-hold`, `anchor.ch7.advance` | "No phrase is cut at any frozen offset" is false as literally written, on both sides. ch7: `setScoreMood` resets `patternStep`/`chordIndex` on every variant change, and the +5.0 s advance falls 73% through calibration's field 2. ch8: the +17.07 s advance falls ~85% through progression field 3 of a 20 s cycle that never closes inside the window. The **ruling** (D9 costs the score nothing) is correct and in fact understated — the extension grows the calibration statement from 0.65 s (1.4 eighth-notes) to 5.0 s, and grows the semitone's screen life from ~1.25 s to ~5 s of its 7.5 s field. Only the sentence is wrong. | `scoreEngine.ts:1480-1497`; `storyScore.ts:254-257`, `:180-190`; contract `cue.ch7.exit-hold` | score | Replace with the accurate and stronger claim: "the extension truncates no phrase that was previously complete; it lengthens the calibration field-2 statement from ~23% to ~73% of its length before the seam." |
| `sa-06` | low | `anchor.ch8.stack-one` → `anchor.ch8.advance` | The "flat by mechanism" argument is right about **intensity** and silent about **harmony**. Inside the held window the ch8-launch progression still steps every 6.667 s, so two chord changes land under the seven text events — at a phase set by how long the player took to climb, because `patternStep` runs from beat entry and no anchor resets it. The copy cadence is therefore not merely unsupported by the score; it is crossed by two harmonic moves at a route-random offset. This is a real design fact for the packet: an `exit-decay` variant entered at window start would reset `patternStep = 0` and phase-lock the harmonic rhythm to the window for the first time. | `scoreEngine.ts:335-338,1063,1069-1070`; `storyScore.ts:98`; `evidence/verification/ch8-window-av-score-trace.json` | score | Record in the packet's problem statement. No repair owed this run. |
| `sa-07` | low | run-wide evidence prose | Three precision claims are wrong, in three artifacts. Recomputed from the two analysis JSONs: overall RMS agreement is max **4.96e-8 dB** (not "within 1e-8 dB"), windowed RMS agreement is max **6.97e-7 dB**, and peak agreement is max **1.49e-7** (the ch8-liftoff case exceeds the stated "1e-7 peak"). The conclusion is untouched — every delta is inaudible float-accumulation noise and the equivalence holds — but the tolerance as printed is false by 5× to 70×. | `audio-report.md` lines 22-24 and 60-64; `verification-report.json` (same sentence); recomputation over `evidence/score-ch8-window-analysis.json` vs `evidence/verification/score-ch8-window-verify-analysis.json` | score | Restate as "all measured quantities agree to within 1e-6 dB RMS (overall and per 1 s window) and 2e-7 absolute peak", and cite `windowedRmsDb` — the 20-point-per-case time series is the strong evidence and is currently unmentioned. |
| `sa-08` | low | `ch8-hold-contact-logged`, `ch8-crossing-seam` renders | "health-pass" is asserted for all four renders; by the repo's own `audioHealthPass` (`audioAnalysis.ts:190-197`, which requires `smoothnessViolations === 0`) two of four **fail**: both record `smoothnessViolations: 1`, driven by `maxSmoothnessDeltaRms` 0.040551 and 0.042731 against `SMOOTHNESS_MAX_DELTA_RMS = 0.04` — 1.4% and 6.8% overshoots. The third ch8 case sits at 0.039998, i.e. all three launch/crossing renders live on the threshold while the ch4-defy reference sits an order of magnitude below it at 0.002037. It reproduces identically in Stage 2 and Stage 6, so it is deterministic shipped generative behaviour on a combined bus (not attributable to the score alone), and it is pre-existing, not introduced here. It matters because it is the baseline any packet decay will be auditioned against, and because a mood-swap decay (instant `intensity = mood.baseline` plus `retuneVoices` plus a sawtooth→triangle wave change) is exactly the shape this law polices. | `evidence/score-ch8-window-analysis.json` `.cases[0].analysis`, `.cases[2].analysis`; `evidence/verification/score-ch8-window-verify-analysis.json` same fields; `audioAnalysis.ts:34,36,180-197`; `score-treatment.md` §6 | score | Correct the claim to "finite, unclipped, never silent; two cases carry one marginal pre-existing smoothness violation each". Hand the constraint to the packet: implement the decay as a slewed intensity ramp, not a mood swap, and audition against the smoothness law. |
| `sa-09` | low | `anchor.ch8.stack-one` (+2.0 s) | Two census claims in `audio-report.md` are contradicted by the census itself. "Inside the hold, exactly one SFX fires" — a player-driven `shipBoost` also fires inside the window at ≈+2.3–2.8 s (the trailing-3 s diagnostic still names it at +5.26 and is quiet at +5.76). "From +2.0 s through the +17.0 s advance the census reads quiet" — it reads non-quiet at +2.25, +2.75, +3.25, +3.76, +4.26, +4.76 and +5.26; **quiet begins at +5.76 s**. The load-bearing conclusions all survive: quiet covers `CONTACT LOGGED.` (+8.5), the designation (+11.5) and L6 (+14.0), and the run's copy still adds zero audio events. | `evidence/verification/audio-window-census.json` `.cases[0].sfxRateCensus`; `audio-report.md` lines 80-86 | score | Restate accurately: "the run's copy adds zero audio events; the window carries one shipped `objective-enter` cue at +1.765 s plus player-driven ship SFX to ≈+2.8 s; the census is quiet from +5.76 s through the advance." |
| `sa-10` | low | M6 `anchor.ch7.anyway`; ch7 evidence set | Evidence asymmetry against risk. The ch8 ruling that routes a packet carries four hashed combined-bus WAVs; the ch7 rulings — including the one open taste question the Score Director explicitly routes to the owner ("if you want watchedness instead, that is packet territory, say so now") — rest entirely on source reading, with **zero ch7 renders** in the run. The owner is being asked a musical taste question with nothing to listen to, while the same probe with a two-line case table would have produced eight variant excerpts cheaply. | `evidence/` (no ch7 WAV); `score-treatment.md` §1 and Stage 3 cross-notes; `score-ch8-window-probe.mjs` `CASES` | score | Before the M6 question reaches the owner, render `route` and `calibration` (and optionally all eight) through the existing probe as audition material. Read-only, additive evidence. |
| `sa-11` | info | `anc.launch.ignition` | Of the three contracted ramp values only 0.4375 (`ch7-window-av-score-trace.json`) and 0.5 (77 samples) have live traces; **0.375 is derivation-only**. The derivation is airtight — ch8-launch has exactly three signed anchors, ignition is index 0, `0.5 × 0.75 = 0.375`, and ignition cannot activate cross-beat because ch8-launch has no symbolic boundary anchor — so this is completeness, not doubt. Related latent hazard worth recording: these values are a function of the **signed anchor count**. The six new contract-local ch8 window anchors correctly did **not** enter `generatedSceneAvRuntime.json`, so the denominator is unchanged; promoting any of them later silently re-scales every ch8-launch ramp value. Also: `audio-report.md` row 2 cites the synthetic constant-intensity render as evidence for the live 0.4375 — the actual live proof is in `ch7-window-av-score-trace.json`. | `signedSceneAvRuntime.ts:358-364`; `generatedSceneAvRuntime.json`; `evidence/verification/ch7-window-av-score-trace.json` | score | Record the anchor-count dependency as a packet constraint; re-point the audio-report citation. |
| `sa-12` | info | contract hygiene | `score.mixIntent` carries the shipped-relations/packet/term-4 governance clause rather than any mix hierarchy, and `score.performancePlan` carries the ruling-only lane statement rather than a CPU/voice/node/soak plan — while the actual hierarchy sentence is duplicated verbatim in all 18 cue-level `mixIntent` fields. Separately, `cue.ch8.stack-window` is typed `music` with `cueRef: null` while the two cues describing the identical shipped condition are typed `silence`; the template's own stand-in row pairs `cueRef: null` with `type: "silence"`, so this is a schema-expressiveness limit, not a director error. Noted because `type` is the one machine-readable field a downstream tool could read as "the shipped window is silent" — the prose in every one of those objects correctly prevents that reading. | `scene-contract.json` `.score`; `.codex/production-runs/_template/scene-contract.json` | score | Optional cleanup at the next schema revision. No action this run. |
| `sa-13` | info | documentation agreement | `score-treatment.md` is a draft-v2 document referenced by `treatmentRef` from the frozen draft-v4 contract and still prints the superseded cadence (`CONTACT LOGGED.` +10.0 s, designation +12.5 s, L6 +15.0 s vs the frozen +8.5/+11.5/+14.0). The dissent register carries the mechanism that makes the drift harmless (the plateau is flat, so 10.0 s and 8.5 s sit in the identical measured state) — verified independently: `applyScore` runs only on anchor activation, and the trace holds `anchorId: anc.launch.atmosphere-exit` constant across the whole window. Three smaller prose slips: diagnosis is a **2-note** pattern, not "1.5-note" (0.015 is the ostinato gain); "every other beat runs the generic ramp" omits that `ch4-audit`/`ch4-comply`/`ch4-defy` run *descending* ramps (`signedSceneAvRuntime.ts:359-363`); `lift` is not only "one parameter deepens" (the chord also moves `5`→`7` and the ostinato's third note `14`→`7`) — the sharpens-not-swells ruling survives all three. | `score-treatment.md` §1, §2, §3, §6; `scene-contract.json` `.score.treatmentRef`; `dissent-register.md` mechanism paragraph | score | Add a dated amendment note (the `dissent-02` amendment pattern), do not rewrite the ruling. |

## Motif and harmony continuity summary

One authority, one instrument, monotone accretion, no escalation. `[0,7,14]`
(diagnosis→frame) → `[0,5,9,14]` (hull, first harmonic change + first melody
voice at 0.12) → `[0,7,9,14]` (lift, the settled destination held by hover,
route, calibration and `ch7-board.outside`) → calibration's second field
`[0,5,9,15]`, the prepared semitone, sounding under M7, the exit line and the
whole D9 hold, and released at the boarding seam. Tempo 64, triangle, octave
12 are invariant across all eight variants — every stage sharpens by colour,
density or sub weight, never by tempo, wave or register. Independent per-stage
rulings: M1 serves; **M2 weakly serves** (I disagree upward with "coexists":
the answering fifth relocates from pattern step 6 to step 4, the mid-bar
strong position, under "allowed to be heavy"); M3 serves; M4 serves and is the
strongest fit; M5 serves; M6 coexists (the chapter's one swell, entirely
density/colour over an unchanged chord/tempo/wave — which reads as commitment,
not arrival); M7 serves. ch8-launch is a different instrument by design
(sawtooth, tempo 72, the table's highest ostinato gain) and stays at its beat
maximum across the exit window; the crossing seam steps down only after the
advance.

## Cue-alignment matrix

ch7 exit window, offsets from the M7 audit line (contract tolerance 0.2 s):

| Moment | Contract | Measured | Score state | Score event |
| --- | --- | --- | --- | --- |
| M7 audit `INTEREST RAISED` | +0.0 | +0.000 | `calibration`, field 2 (semitone) sounding since −0.5 s | none; intensity `null` (signed exclusion, live-verified) |
| M7 caption | +0.6 | +0.604 | field 2 | none |
| exit line "the scar remains…" | +3.0 | +3.021 | field 2 | none |
| advance → ch7-board | +5.0 | +5.021 | field 2 cut at 73% | `setScoreMood` → `outside`, baseline 0.56→0.56, semitone released |
| ch7-board parenthetical | — | +5.028 | boarding mood | none |

ch8 exit window, offsets from L4/window origin:

| Moment | Contract | Measured | Score state | Score event |
| --- | --- | --- | --- | --- |
| window start / L4 | +0.0 | +0.000 | 0.5, `sc.launch.ground-relents` | anchor applies 0.5 once; persists |
| objective publish | ≈+1.75 | +1.765 | 0.5 | `terminalAdvance` (shipped `objective-enter`, 1✓/0✗) |
| stack row 1 | +2.0 | +2.015 | 0.5 | none (player `shipBoost` ≈+2.3–2.8) |
| stack row 2 | +4.0 | +4.032 | 0.5 | none |
| stack row 3 | +6.0 | +6.032 | 0.5 | none |
| `CONTACT LOGGED.` | +8.5 | +8.548 | 0.5 | none; census quiet; `score.hit` null |
| designation caption | +11.5 | +11.565 | 0.5 | none; quiet |
| L6 open query | +14.0 | +14.064 | 0.5 | none; quiet; nothing added |
| advance → ch8-crossing | +17.0 | +17.081 | 0.5 → 0.42 → 0.35 | `setScoreMood` (crossing baseline) then `anc.crossing.sibling-targeted` ramp |

Unmodelled by the contract: two ch8-launch progression-field changes
(6.667 s apart) fall inside the window at a route-dependent phase (`sa-06`).

## Objective soak/mix measurements

| Quantity | Value | Source |
| --- | --- | --- |
| Hold-state combined-bus RMS (`CONTACT LOGGED.`) | −19.928312 dBFS | Stage 2 and Stage 6, independently reproduced |
| Liftoff state | −20.110469 dBFS | both stages |
| Crossing seam | −20.916565 dBFS | both stages |
| ch4-defy yardstick | −23.831419 dBFS | both stages |
| Hold above yardstick | **+3.90 dB** | recomputed, concur |
| Peaks | 0.363 / 0.355 / 0.328 / 0.165 | `.analysis.peak`, all cases |
| Clip / NaN / longest silence | 0 / 0 / 0 s in all 8 renders | `.analysis` |
| Smoothness violations | **1** in `ch8-hold-contact-logged` and `ch8-crossing-seam`; 0 in the other two | `.analysis.smoothnessViolations` (`sa-08`) |
| Stage 2 ↔ Stage 6 overall RMS agreement | ≤ 4.96e-8 dB | recomputed (`sa-07`) |
| Stage 2 ↔ Stage 6 windowed RMS agreement | ≤ 6.97e-7 dB, 20 windows × 4 cases | recomputed |
| Stage 2 ↔ Stage 6 peak agreement | ≤ 1.49e-7 absolute | recomputed |
| Live intensity, ch8 window | 0.5 constant, 77/77 samples; `hit` null 77/77 | `ch8-window-av-score-trace.json` |
| Live intensity, ch7 anchors | `null` at `anc.reconstruct.calibration`, `anc.board.*` | `ch7-window-av-score-trace.json` |
| SFX inside ch8 window | 1 shipped `objective-enter` at +1.765 s; player `shipBoost` to ≈+2.8 s; quiet +5.76 s → advance | `audio-window-census.json` |
| FPS, ch8 hold | median 60.06, min 60.03 (5 × 3 s), 1280×720 LOW | `fps-verification.json` |
| FPS, beats vs baseline | 60.09/60.09/60.06 vs 60.12/60.11/60.08 | `fps-verification.json` |
| Bar / field / cycle, ch7 @64 | 3.75 s / 7.5 s / 15.0 s | derived from `scoreEngine.ts:335-338,1063` |
| Bar / field / cycle, ch8 @72 | 3.333 s / 6.667 s / 20.0 s | derived, same source |
| CPU, voice count, node lifetime | **not measured anywhere in this run** | declared non-measurement |

## Taste risks (explicitly labelled as taste, not defects)

1. **M6's swell under "i am being watched now."** I concur with the Score
   Director that it reads as commitment, and I add evidence for that reading
   (the swell is pure density/colour over a chord, tempo, wave and octave
   that do not move; watchedness would need a foreign element, and the
   shipped material correctly withholds the square wave). But this is a taste
   call the owner may reverse, and per `sa-10` the owner currently has no
   audio to reverse it on.
2. **M2's weight.** I rule it weakly serves where the treatment ruled
   coexists. Either reading is defensible; neither routes work.
3. **Whether the ch8 window should be scored at all.** The packet's premise —
   that the departure anthem is dramatically wrong under a regulatory
   printout — is a taste thesis, not a measurement. The measurements
   (−19.93 dBFS, +3.90 dB over the yardstick, a departure texture with an
   engaged riser and no note-drops) establish only that the shipped state is
   *not* near-silence. I find the thesis persuasive and the routing correct,
   and I flag the boundary so the owner is not told that a number decided a
   taste question.
4. **The square-wave option.** Correctly held as option-not-obligation and
   correctly deferred to the packet's audition cycle. My only note is that
   `ch4-arrival`/`ch4-audit` teach the square as *the system arriving*; using
   it while the stack files rows would be the strongest available idea and
   also the easiest to overplay into the stinger constraint (b) forbids.

## Protected strengths (do not repair, do not "improve")

- The signed-rail score-intensity exclusion for ch7
  (`signedSceneAvRuntime.ts:349-353`), live-verified `null` at every ch7
  anchor sampled. It is named as a protected strength in the lock, and it is
  also the executable precedent the ch8 packet must copy (`sa-01`).
- The eight gameplay-derived variants and their pure `facts → variant`
  resolution with the change guard at `emergentScoreDirector.ts:266-276`
  (no per-frame mood churn).
- `scoreHitFor` withholding every hit outside `anc.maw.repair-committed` —
  no stinger anywhere in ch7 or ch8, verified across 113 live samples.
- The calibration added semitone and its release at the boarding seam; and
  the D9 extension, which is worth more to the score than anyone claimed.
- The bilateral silence law and the SC-N3 term-4 prohibition, propagated at
  9 occurrences and honoured by every artifact in the run.
- The ruling-only lane: zero protected-path mutation, verified at `03e975a`.
- The combined-bus evidence method and its conservative direction statement.

## Single highest-leverage repair

**Amend the routed packet's scope to name
`main/src/story/signedSceneAvRuntime.ts:scoreIntensityFor` and its
protected-path authority requirement before the packet reaches the owner
(`sa-01`).** Everything else in this audit is text accuracy or recorded
constraint; this one determines whether an owner "approve" produces the
composed near-silence at `CONTACT LOGGED.` or a decay that the signed ramp
overwrites at the atmosphere-exit anchor. The ch7 exclusion is the shipped
proof that the fix is small, precedented and safe — but it lives in a file the
packet does not currently claim, and protected-path requirement is a stop
condition under this lock.

## Verdict

`repair` — findings routed, **non-blocking for this run**.

Rationale: the score lane's substantive rulings are correct and independently
reproduced. ch7 serves as-is; the eight-variant instrument sharpens rather than
swells at exactly the three stages the intent named, by construction and on
unchanging tempo/wave/register; the D9 extension costs the score nothing and
gains it more than the treatment claimed. The ch8 finding is real, measured,
deterministic and honestly recorded: the shipped generic ramp holds the beat
maximum across the whole exit window, `CONTACT LOGGED.` lands +3.90 dB above
the composed-near-silence yardstick, and the dissent-01 discipline is clean —
the packet is intent-only, it gates nothing, and no artifact in the run
describes the shipped window as near-silent. The combined-bus/measurement-
equivalence method is the right method and its artifact is stronger than its
prose. No protected path was touched. What is defective is the *record*, not
the ruling: one packet scope that cannot execute as written (`sa-01`), three
contracted cue relations that are not true of the shipped code (`sa-02`,
`sa-03`), one undocumented and untested gameplay/music coupling that the
chapter's signature payoff depends on (`sa-04`), and a set of precision and
census claims that overstate their evidence (`sa-07`, `sa-08`, `sa-09`). None
of these change a player-facing behaviour this run, and none of them are
grounds to hold the copy. All route to the score lane as text and scope
repairs plus one additive evidence request.
## ADDENDUM — 2026-08-11: revalidation against frozen `draft-v5`

This audit was performed and written against contract revision `draft-v4`
(sha256 `df544b13…`). The contract has since been frozen at `draft-v5`
(sha256 `36a7cb4f…`, `supersedesVersion: draft-v4`). **The audit above remains
valid in full against `draft-v5`; no finding is withdrawn, added, or
re-severitied.**

Revalidated directly against the v5 bytes and the shipped runtime, not taken
on report:

- The v5 deltas in the score lane are exactly the three cue-table repairs this
  audit routed, plus one context row they required:
  - **`sa-02` repaired.** `cue.ch8.advance` now carries
    `cueRef: "sc.crossing.distance"` — the only shipped ch8-crossing cue id —
    and states the seam route-dependently (0.42 via `setScoreMood`, then
    0.35 at `anc.crossing.sibling-targeted` on the common route or 0.315 at
    `anc.crossing.origin-lookback` on the lookback branch).
  - **`sa-03` repaired.** `cue.ch7.entry-steady` is rebound to the new
    contract-local `anchor.ch7.beat-entry` (`beat: ch7-reconstruct`), and the
    ch6 anchor it vacated is covered by the new context row
    `cue.ch6.dive-handoff` at `anc.dive.shore-bank` with `cueRef: null` and a
    no-cue-fires relation. Cue count 18 → 19; the cue-ref vocabulary now
    contains no identifier absent from `generatedSceneAvRuntime.json`.
  - **`sa-05` repaired.** `cue.ch7.exit-hold` carries the corrected sentence
    this audit supplied verbatim (the extension truncates no previously
    complete phrase; it lengthens the calibration field-2 statement from
    ~23% to ~73% of its length before the seam).
- Everything this audit relied on is unchanged at v5: both `type: "silence"`
  cues, the held-plateau cue, the three launch anchors bound by
  `cue.ch8.ignition` / `cue.ch8.liftoff` / `cue.ch8.atmosphere-exit`, the
  packet-intent-only recording, and the SC-N3 term-4 prohibition.
- The acceptance-criterion [25] restatement is a no-audio-acknowledgement
  condition; it adds no cue, no hit and no score obligation, and therefore
  changes nothing in the cue-alignment matrix or the measurements above.
- Confirmation record: `score-contract-signoff.json`, the Score Director's
  fresh `draft-v5` signature over sha256 `36a7cb4f…`, whose amended condition
  V3-A records the same four corrections and whose V2-C4 records the `sa-01`
  packet-scope amendment (the `scoreIntensityFor` exclusion surface, the
  protected-path authority requirement, the ordering guarantee, and
  constraints `sa-06`/`sa-08`/`sa-11`) as adopted into the packet commission.
- Consequently `sa-02`, `sa-03` and `sa-05` are **repaired-verified** at
  `draft-v5` and `sa-01` is **adopted-into-packet-commission**; the remaining
  findings (`sa-04`, `sa-06` through `sa-13`) stand exactly as written, and
  the verdict, the dissent-01 discipline finding, the protected strengths and
  the single highest-leverage repair are unchanged.
