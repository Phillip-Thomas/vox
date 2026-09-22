# Stage 3 evidence — composed sync and one harmonic truth

Contract draft-v4 (sha256 672de45a0c8257d334d052cbedf4247fd09b0f1dba385cc5fb9d06e04459d41d), superseding
draft-v3 (776d676b…) under which this stage was commissioned; source revision b631a52 working tree
(Stages 0–3 uncommitted). Integration engineer: the Score Director. Every offline render comes from the
real engines on the score-soak harness; every live trace comes from the real app on an ephemeral
HMR-off vite server (`?story=<start>&movie=1`, audio unlocked by dynamic import as fps-score-probe does).

## What shipped (the mechanism, honestly)

**1. `scheduleHit(kind, quantize, opts?) : HitSchedule | null`** (`scoreEngine.ts`). Frozen return type
`{kind, audioTime, armedAt, perfTime, quantumLanded: 'bar'|'beat'|'step', slackMs, onsetAttackMs}`;
`audioTime` is the envelope start on the audio clock, `perfTime` its projection onto `performance.now()` at
arming, `slackMs` the signed move from the caller's desired time. `opts = {desired, notBefore, capMs,
mayLead, floorRung, anchorId}`. **Grid law (the contract's answer):** while a story mood leads, the mood's
own 8th-note step grid is the grid — hits quantize to the mood's step clock (`patternStep`/`nextNoteAt` at
the mood tempo; "beat means the mood's own tempo"); the bed's transport owns the grid only while the bed
leads the sandbox; with no transport the return is `null`, logged `'immediate'`, and the site fires the
shipped reflex `scoreHit`. The mood pattern clock was NOT re-anchored to the bed transport (the plan's
alternative): the contracted intent names the mood tempo and the bed is silent under a lead. The quantum
law is pure (`generative/hitSchedule.ts`): prefer the written quantum, degrade bar → beat → 8th until the
cap fits, `mayLead` admits the nearer earlier quantum, `notBefore` is a hard floor, and when even the
floor rung cannot fit the runtime still lands on the grid with `fitsCap:false` — the fit TEST refuses the
design, the runtime never silently falls to immediate. New kind `impact` renders boom + braam at ONE
onset (the descent). A scheduled hit is rendered at arming into its future onset and registered;
`cancelPendingScheduledHits()` drops every pending hit further out than `HIT_CANCEL_GRACE_S` 0.05 s (a hit
about to sound is committed — the hand-back bloom fires on the very tick that exits its chain). The
scheduler refuses `NEVER_QUANTIZE_KINDS` (oxygen pulse, terminalAlarm, klaxons, violation floods, input
acknowledgements) by name.

**HIT_CAP_MS / STORY_HIT_ANCHORS** (`story/storyScore.ts`): the ten scene-contract anchors with kind,
written quantum, cap (`{ms}` literal or `{beats: 1}` = `beatMs(MOODS[beat].tempo)`, an expression), `mayLead`
(lift), `floorRung: 'beat'` (a2 ×2, a4: never degrade to the step), and the SFX member. The fit test
asserts, at every published tempo, that some rung fits (`quantumFitsCapAtTempo`), and pins the expected
landing rung per row (8th where the beat exceeds the cap; beat where the cap IS a beat; bar for a3).

**applyRails dirty check** (`railTarget`, `RAILS_DIRTY_REL 0.004`, `RAILS_DIRTY_ABS 1e-4`,
`RAILS_DIRTY_ENABLED`): a smoothed rail is re-issued only when its target moved; the cache drops on every
retune and on the authority crossfade. The legacy engine's keep-alive cadence `AUTOMATION_CADENCE_S`
moved 0.25 → 2 s (it alone re-issued ~112 idempotent writes/s across ~14 procedural lanes).

**2. One tonic.** `MOOD_TONIC_CHAINS` by beat id (prologue crawl…a1-ramp; colour ch2-color…a2-awakening;
dusk ch3-dusk/ch3-await-rest/a3-dawn; vigil ch4-vigil…a4-exhale incl. ch4-arrival/audit/comply/defy;
reconstruct ch7-reconstruct/ch7-board; ch10 ch10-cold/ask/transit), `TONIC_CHAIN_POLICY` (prologue
`seed` UNCONDITIONALLY, ch10 `absolute` at offset 0 — the seed is never consulted, the carrier
`CH10_CARRIER_HZ` is a pure function of the shipped relay-answer entry — the rest `live`-then-seed within
`TONIC_LIVE_WINDOW_BARS` 8 of the bed's last publish). `planetHomeRoot(seed)` (`harmonyBrain.ts`) IS
`derivePlanetKey(seed).tonicPc`, the draw the bed's own brain is born on — so the prologue sounds in the
planet's key before the planet is seen and the hand-back to the bed is a shared root by construction; no
bed re-key was needed. The chain tonic is one module variable held across member beats (`resolveBeatTonic`);
member → member keeps tonic and pending hits; a chain exit, deep-link, replay, quit, completion or sandbox
cancels pending hits and drops the chain; pause and focus-loss touch nothing (the context suspends). A
mid-chain reload re-derives `planetHomeRoot(seed)`: interval identity kept, absolute pitch not protected
(tested). Unchained beats hold the current tonic (no jump) and adopt the bed's centre when the bed leads
at entry. The bed registers `registerBedTonicResolver` (harmony tonic, last publish time, bar length).

**3. MOODS as constraints** (`generative/moodConstraint.ts`). `deriveMoodConstraint(mood, tonic, policy)`
→ `{tonicSemis, pitchClassSet, chordSequence, bassPolicy:'root', maxVoices 4, registerBand (from the
authored uppers), tempo, ostinatoCell, voicingPolicy, requestedPolicy, brainGuard, tensionCurve}`.
Policies: `literal` / `subtractive` (ch4-comply; refused and seam-ebb render literal under the ch10 beat
rule) / `ordered` (a4-exhale) = the authored stack plus the chain tonic only; `brain` = voice 0 stays the
literal root (the sub is the bass), the inner pad voices take the in-band instance nearest their previous
pitch over all voice assignments, the written tight intervals (semitone, whole step — the dread, the ch10
floor) are preserved EXACTLY (none lost, none added), no voice ever moves further than the composer's
written jump for that change (wrap included), and the literal stack is always a candidate. **Gain guard:**
a mood is brain-voiced only if, over two cycles, no change exceeds a written jump and the total inner-voice
motion strictly drops; otherwise it stays literal with `brainGuard` recording why. The published chord
keeps every authored tone (a 5-tone stack still publishes five). The voicing at absolute chord index k is
the walk from the literal opening with wrap — the same recursion the live scheduler runs — so a hit
forecast at chord k equals what the pad plays at chord k on any cycle. `tensionCurve` is derived and NOT
written to the rails (constraint-derived tension only lowers or holds; here it holds). Every ch10 mood is
`literal` (`MOOD_VOICING_OVERRIDES`), `MOOD_DEFAULT_VOICING` is `brain`.

**4. The eleven sites.** `armStoryHit(anchorId, {beatClock, desiredDelayS?, notBefore­DelayS?})` returns
`bundleDelayS` (image members chase `audioTime − armedAt + latencyComp`), `sfxArmDelayS`/`sfxAudioTime`
(SFX members are POSTED `SFX_BUNDLE_ARM_LEAD_S` 0.08 s before their target and SCHEDULED to
`audioTime + musicVsSfxS` through `playSfx(id, {atAudioTime})`), the latency terms, and `fallback`.
`latencyComp = clamp(device + tailLatencyForSampleRate(ctx.sampleRate).musicPathS, 0, LATENCY_COMP_MAX_S
0.25)` with device = `ctx.outputLatency` if finite and positive else `ctx.baseLatency` if finite else 0,
sampled once at arming, the per-rate table selected by nearest pinned key (44100 / 48000, both measured —
Stage 2 repair S2-D4). Every guard is `>=` (late on a hitch, never early). State never waits:
`STORY_BUNDLE_MEMBERS` records per anchor which members are state / image / SFX, and the live trace
records `stateAt` (the tick the state members ran) against `fired` (the presentation tick).

| # | anchor | site (live line) | armed at | state (immediate) | image members chase | SFX member (forward) |
|---|---|---|---|---|---|---|
| 1 | anc.track.unbolt | storyDirector.ts ch1-track entry (942) + tickTrackUnlock (1520) | beat entry | setWorkOrder(track) | setLensRig(ch1-track) start, letterbox origin, TRACK timeline origin | storyAwaken |
| 2 | anc.a1.color-stabilizes | a1-ramp entry (1007) + tickA1Ramp (1360) | beat entry, desired A1_RAMP_SECONDS | setVoxelRealityStage(color), markMilestone(a1), advanceToBeat — all on the composed landing tick | clearOverrides, desat 0, glitch 0 (landing fires at max(ramp end, bundleAt)) | — |
| 3 | anc.a2.feed-wall-falls | a2 entry (1041) + tickA2 (1397/1427) | beat entry, desired floodEnd+hudDeath, notBefore = HUD-death k>0.55 tick | — | liberation origin (FOV, treatment, unfreeze) | storyAwaken |
| 4 | anc.a2.hand-back | a2 entry (1048) + tickA2 (1444) | beat entry, desired liberation.at + 6 s | markMilestone(a2), advanceToBeat(ch3-gather) on the composed tick | look free, DPR null, treatment 0 | — |
| 5 | anc.descent.impact | tickDescent (1490–1496) | first LIVE tick (world settled), desired DESCENT_IMPACT_AT − t, later only | descentImpacted | flash 1, glitch 1, scanRoll 0.8, descent curve origin | shipCrash |
| 6 | anc.lift.perspective-issued | ch1-lift entry (997) + tickCh1Lift (1575) | beat entry, desired LIFT_SNAP_AT 3.45 s, ±cap mayLead | liftSnapped | setStoryTargetDpr(null), glitch 0.8, scanRoll 0.5 (indivisible) | storyGlitch |
| 7 | anc.a3.first-blade | a3 entry (1098) + tickA3 (1889) | beat entry, desired waveStart, notBefore = last caption authored BEFORE the wave + one 8th | — | setLifeReveal wave origin | — |
| 8 | anc.a3.material-lands | a3 entry (1102) + tickA3 (1903) | beat entry, desired max(rampEnd+4, blade.at+16+1.5) | setVoxelRealityStage(material), markMilestone(a3), advanceToBeat(ch3-thirst) on the composed tick | clearOverrides, clearLifeReveal (same tick, no pop) | — |
| 9 | anc.maw.repair-answer | signedSceneAvRuntime.ts applyScore + tickPendingScoreAnswer | anchor activation (the commit tick) | receipt, commit, anchor activation | intensity step, activeScoreHit 'bloom', the anchor's entry post-effects | — |
| 10 | anc.a4.life-front | emergentStoryDirector.ts tickA4 | commit tick (elapsed ≥ 1.75) | commitA4Alive, setScoreIntensity(0.8) | caption, lifeProgress origin | storyAwaken |

The un-stung first direction (`anc.maw.direction-*`) still carries no hit. Every copy string is
byte-identical (the a4 caption moved inside its site, same bytes; the a2 `'a2-awaken-sfx'` latch key was
a code latch, not copy). Chapter's NEW 6 is pinned two ways: the census test (no state member listed as
image/SFX; commitA4Alive, the receipt/commit and every advanceToBeat/stage set are state) and the live
trace's `stateAt ≤ fired` at every anchor.

## Acceptance terms

| term | required | measured | verdict |
|---|---|---|---|
| hit onset vs returned audioTime (offline, silent mood, pre-tail tap) | within 1 ms | **30/30 rows, max 0.045 ms** (2 samples at 44.1 kHz), pre-roll digital silence at every row | met |
| every slack ≤ cap (check-scheduler-cap-fit) | ≤ cap | worst slack sits **20.5 ms under** its cap; fit test green at every published tempo; expected rungs: 8th for track/a1/descent/maw, beat for a2 ×2/a4/lift (lead ≤ 351 ms), bar for a3 ×2 | met |
| impact = one onset | boom + braam same audioTime | `impact` renders both from one `now` (`renderHitInto`), 3/3 phases | met |
| never-quantize | scheduler rejects machine time | `NEVER_QUANTIZE_KINDS` throws; only anchor ids reach `armStoryHit` | met |
| MOODS commit A render-identity (all literal) | identical | **fingerprint identical 62/62** vs the pre-Stage-3 render with the dirty check off; the harness is not bit-deterministic run to run (same code twice: max 1 LSB, residual −121 dBFS), so PCM hash identity is unattainable for ANY change and the fingerprint is the harness's stability measure (as at Stage 2) | met (fingerprint) — see deviation 2 |
| no MOODS literal changed | table untouched | 62-entry inventory fingerprint pinned in `storyScore.stage3.test.ts` | met |
| MOODS commit B (brain) | VL applies; heard character preserved | 9 moods re-voiced (guard), pcs/root/tight intervals kept for all 62, max move 11 → 9, total motion 1291 → 958; 57/62 renders within the 1-LSB floor of commit A, the 5 audible re-voicings change RMS by ≤ 0.076 dB (inner voices only) | met |
| AudioParam writes/s steady state (ch4-vigil) | < 60 | **27.6 median**, max window 63.2 (a rails burst); 590.4 at Stage 2 | met (median) — see deviation 3 |
| dirty check inaudible | — | vs dirty-off: max 26 LSB, residual ≤ −80.9 dBFS, \|ΔRMS\| ≤ 0.0072 dB across 62 moods; fingerprint flips 56/62 (bucket boundaries) | reported |
| chain tonic hold / reload / ch10 absolute / prologue seed-unconditional / reset semantics | tests | `storyScore.stage3.test.ts` (39 tests) | met |
| BEAT_TIMEOUT margin cap + 0.25 s | no anchor beat times out inside it | test: no anchor beat carries a timeout | met (vacuously) |
| S2-D10 (schedule-time cap) | doc + 2 tests | `duckMatrix.ts` header; `duckMatrix.test.ts` pins (b) and (c) — see deviation 5 | met |
| C6 per-rate latency + SFX forward at five bundles + unbundled unshifted | — | `resolveBundleLatency` selects by `ctx.sampleRate` (48000 test), five `bundleSfx`/a4 members scheduled to `audioTime + musicVsSfxS`, `resolveSfxStartTime` law tested | met |
| audio:check | 13/13 | 13/13 PASS, wall 26.9 s (tail-latency both rates pinned) | met |
| score:fps | ≥ 60 median | 60.39 median, p10 60.38, ratio 1.000 | met |
| pure soak | PASS | PURE SOAK PASS (2 seeds × 32 min) | met |
| targeted vitest (story + audio) | green | 125 files / 1105 tests before the final probe edits; re-run recorded below | met |
| live per-hit trace (3 cold runs, movie lane) | ≤ cap, quantumLanded, image −1/+2 fr | `sync/<beat>.json` + strips — table below | see below |

## Live sync runs (`sync/`)

Each target beat is entered from its predecessor in the movie lane (`--start`), so the arming tick sees
an assembled world and a steady frame loop (a deep link straight into the target arms during boot, when
the beat clock stalls while the audio clock runs — recorded in `sync/a1-ramp.validate.log`: 3.9 s of
image lag that is a boot artefact, not a sync property). Per firing: `imageVsOnsetMs` is measured on the
AUDIO clock (`fired.audioTime − (audioTime + latencyComp)`), `fireLatenessBeatClockMs` is the guard's
lateness on the beat clock, `anchorWindow` is the frame cadence ±2 s around the fire, `stateAt ≤ fired`
is Chapter's NEW 6, `sfxScheduledAhead` is how far ahead of its target the SFX member was posted. Strips
(`f-3…f+3.jpg`, 640×360 JPEG from the CDP screencast) carry the burned overlay (audioTime, armedAt,
bundleAt, latencyCompMs = device + music-path @ key, beatClock≈, sfxAudioTime + forward offset, state@,
fired@, sfx@, ctx.currentTime, perf).

| anchor | start → beat | runs | landed | slack ms (cap) | fire lateness ms (beat clock) | image − onset ms (audio clock) | frames | state ≤ image | SFX posted ahead ms | window fps / max gap | key |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anc.descent.impact | descent → descent | 3 | beat/step | 232 / 243 / 238 (400) | -48.8 / -13.5 / -12.0 | 9.8 / 7.1 / 20.5 | 0.59 / 0.43 / 1.23 | true / true / true | 60 / 71 / 71 | 60/16.8 / 60/16.8 / 60/16.8 | 48000 |
| anc.track.unbolt | ch1-fixed → ch1-track | 3 | beat | 206 / 97 / 295 (450) | 3.3 / 3.7 / 5.8 | 4.8 / 7.1 / 3.7 | 0.29 / 0.43 / 0.22 | true / true / true | 89 / 92 / 98 | 58.7/66.6 / 59/66.7 / 58.5/83.3 | 48000 |
| anc.lift.perspective-issued | ch1-iso → ch1-lift | 3 | beat | -260 / -292 / -305 (400) | 3.0 / 1.3 / -2.2 | 14.2 / 11.5 / 8.9 | 0.85 / 0.69 / 0.53 | true / true / true | 69 / 69 / 77 | 60/16.8 / 60/16.8 / 60/16.8 | 48000 |
| anc.a1.color-stabilizes | ch1-anomaly → a1-ramp | 3 | beat | 122 / 262 / 326 (400) | -20.5 / -19.5 / -14.3 | 2.3 / 3.9 / 4.4 | 0.14 / 0.23 / 0.27 | true / true / true | — / — / — | 58.4/83.3 / 58.4/83.3 / 58.8/66.7 | 48000 |
| anc.a2.feed-wall-falls | ch2-approach → a2-awakening | 3 | beat | 63 / 422 / 20 (455) | 10.6 / 0.6 / -6.4 | 20.2 / 13.6 / 9.5 | 1.21 / 0.82 / 0.57 | n/a / n/a / n/a | 79 / 75 / 79 | 60/16.8 / 60/16.8 / 60/16.8 | 48000 |
| anc.a2.hand-back | ch2-approach → a2-awakening | 3 | beat | 299 / 299 / 299 (455) | -28.4 / -23.8 / -29.4 | 3.2 / 7.3 / 3.2 | 0.19 / 0.44 / 0.19 | true / true / true | — / — / — | 58.8/50.1 / 59.2/33.4 / 58.8/66.7 | 48000 |
| anc.a3.first-blade | ch3-await-rest → a3-dawn | 3 | bar | 541 / 573 / 573 (2750) | -38.9 / -38.4 / -31.9 | 4.0 / 9.4 / 9.4 | 0.24 / 0.56 / 0.56 | n/a / n/a / n/a | — / — / — | 54.5/100.1 / 60/16.8 / 58/100 | 48000 |
| anc.a3.material-lands | ch3-await-rest → a3-dawn | 3 | bar | 1542 / 1526 / 1526 (2750) | -141.4 / -146.4 / -119.3 | 14.4 / 1.1 / 1.1 | 0.87 / 0.07 / 0.07 | true / true / true | — / — / — | 54.9/133.2 / 58.4/83.3 / 50.3/133.3 | 48000 |
| anc.a4.life-front | ch4-defy → a4-exhale | 3 | beat | 743 / 715 / 716 (909) | 43.6 / 1.3 / 1.1 | 38.7 / 2.5 / 1.3 | 2.32 / 0.15 / 0.08 | true / true / true | 93 / 86 / 77 | 54.5/133.3 / 58/66.7 / 57.5/100 | 48000 |
| anc.maw.repair-answer | ch5-maw → ch5-maw | 3 | beat | 221 / 245 / 203 (450) | 13.7 / 5.1 / 13.7 | 13.4 / 2.8 / 13.4 | 0.81 / 0.17 / 0.81 | true / true / true | — / — / — | 58.2/66.6 / 58.5/50 / 58.2/66.7 | 48000 |

firings 30; every slack within cap: true; worst image−onset 2.32 frames (anc.a4.life-front run1); within −1/+2 frames: 29/30; state≤image violations: 0; SFX posted late: 0

Before the two-clock guard (`sync/before-two-clock/`, beat-clock-only guards as first wired): the same
30 firings held every cap and every state≤image, but the long pre-scheduled bundles drifted — a3 landing
+5.8…+5.9 frames on all three runs, a3 first blade +2.5, a4 run1 +3.0, a2 hand-back up to +2.4, and the
descent's cold run +39.8 frames with its SFX posted 577 ms late. Cause: the director's beat clock loses
time on dropped SwiftShader frames (dt is clamped) while the audio clock is the onset itself, so a
beat-clock-only target lags by the accumulated loss over the pre-schedule distance (~90–160 ms over the
a3 ramp's 28 s). The final wiring fixes BOTH targets at arming and fires on whichever clock reaches its
target first (`bundleAudioClockDue`, `bundleTargetAt`); every member snaps to that one tick. After: worst
+2.32 frames (a4 run1, inside a 133 ms frame gap), 29/30 within −1/+2, a3 landing +0.07…+0.87.

## Deviations and notes for the triad / owner

1. **The a3 first-blade `notBefore` cannot be the literal "last A3_CAPTIONS atSeconds".** The last grain
   caption is authored at wakeAt + 18.5 s = 23.0 s; the wave starts at 10.5 s (rampStart + 4). A hold to
   23.34 s would move the first blade 12.8 s, break the 2.75 s cap and the "hold, never a shrink; the
   timeline's named constants bend to the grid" terms, and the "captions land first" premise both peers
   wrote is only true of the FIRST caption (9.5 s). Shipped: `notBefore` = the last caption authored
   BEFORE the wave (9.5 s) + one 8th step at 88 BPM (0.341 s) = 9.84 s, which is below waveStart and so
   never holds. Cinematography's own fallback ("or the bound shrinks") is taken; routed to Chapter and
   Cinematography — `contractChangeRequired: true` if the literal is wanted.
2. **Render-identity is proven by fingerprint, not PCM hash.** The soak harness renders the same code to
   different PCM on consecutive runs (1 LSB, −121 dBFS floor; already noted at Stage 2), so "rendered hash
   identical" is unattainable for any change. Commit A is fingerprint-identical 62/62 and the constraint
   layer alone leaves the render at the harness floor. The contract's "55 moods" is an undercount: the
   authored inventory is 62 (40 MOODS beats + 8 ch7 reconstruction + 4 ch7 boarding + 10 ch10 variants).
3. **The dirty check is not identity.** Skipping an unchanged `setTargetAtTime` re-issue changes the
   automation at the float floor and lets 0.4 %-tolerance targets settle differently: −81 dBFS residual,
   ≤ 0.007 dB RMS, inaudible by every measure, but 56/62 coarse fingerprints flip. It is therefore
   evidenced as a measured delta against a dirty-off baseline (`A-nodirty-vs-A-dirty.json`), with
   `RAILS_DIRTY_ENABLED` as the named switch. The writes/s term is met on the median (27.6); one 5 s
   window hit 63.2 during a rails move — the term says "steady state".
4. **The under-60 target needed the legacy keep-alive too.** `applyRails` fell to ≈ 29/s, but the Stage 2
   dirty check's 0.25 s keep-alive across ~14 legacy procedural lanes was itself ≈ 112/s.
   `AUTOMATION_CADENCE_S` is now 2 s (mix/mixTuning.ts; the Stage 2 test derives from the constant). A
   missed write still re-issues within 2 s.
5. **S2-D10 (c) as written fails on `oxygenCritical`** (0.2 + 0.4 + 2.0 = 2.6 s > 2.25 s). That row sits
   exactly at the −3 dB story-lead cap on its music column, so resolution time cannot change it; the
   Score Director's ruling applies the guard to cap-AFFECTED rows and pins the exemption (depth == cap) so
   it reopens if the row ever deepens. (d) — the terminal-typing-over-story-lead listen — stays owner taste.
6. **Concurrent lanes touched shared files during this stage.** `mix/mixTuning.ts` gained the per-rate
   `TAIL_LATENCY_BY_RATE_S` / `tailLatencyForSampleRate` (Stage 2 repair S2-D4, 48 kHz measured 24.667 /
   10.000 ms) which this stage consumes rather than duplicates; `soak/excerpts.ts` gained the
   `sampleRate` option the 48 kHz measurement needed. An untracked Stage 6 file `src/audio/voice/voiceBus.ts`
   carries a `Float32Array<ArrayBufferLike>` type error at the time of writing — not this stage's file;
   if it persists it fails `npm run verify`'s typecheck for everyone (recorded in check-results).
6b. **Two-clock guard (mechanism refinement, inside "fixed at arming").** Cinematography's derivation
   fixes bundleAt on the beat clock at arming; measured live, the beat clock alone drifted the a3 landing
   to +5.9 frames under SwiftShader frame drops (table above). The audible onset on the AUDIO clock
   (`audioTime + latencyComp`) is fixed at the same arming tick and the guard takes the earlier of the
   two; since the beat clock can only lag the audio clock, this never fires early and cannot alter the
   a3 notBefore hold or the stage-cut stretch. Routed to Cinematography as a derivation note — the
   contract text names the beat-clock form; if the triad wants the audio-clock term written in,
   `contractChangeRequired: true` for that wording only.
7. **Live evidence is the movie lane on headless SwiftShader**, per-anchor from a natural predecessor
   entry; the manual player path, mobile viewport, reduced-motion and low-tier variants named by
   `cap-anchor-bundle-strips` are not separately captured here — the wiring has no branch on any of them
   (reduced motion never enters `armStoryHit`/`bundleFires`; quality tiers change the room, never the
   tick), and the verifier can run `tools/hit-sync-probe.mjs` with those flags. No live waveform capture
   exists in headless; the ±1 ms audio claim is the offline onset proof, the live strips prove the image
   frame against the audio-clock onset.
8. **Judge hold observed, then lifted.** The bundleAt/SFX-forward wiring was held per the Stage 2 cohesion
   ruling until draft-v4 was tri-signed, then landed against the amended C6 (per-rate table, five SFX
   members, unbundled `playSfx` unshifted).

## Gate logs

| step | exit | result |
|---|---|---|
| `npx vitest run src/story src/audio` | 0 | 131 files / 1184 tests (`vitest.log`) |
| `npm run verify` | **2** | fails at `typecheck` on ONE error outside this stage: `src/audio/voice/voiceBus.ts(146,3)` (untracked concurrent Stage 6 file, `Float32Array<ArrayBufferLike>`); every Stage 3 file typechecks (0 other errors). The remaining steps were run individually (`verify-tail.log`): `story:authority` exit 0, `npm run test` 318 files / 2644 tests exit 0, `npm run build` exit 0 (5.57 s). Verify goes green when that file is fixed. |
| `npm run audio:check` | 0 | 13/13 PASS, wall 26.9 s (`audio-check.log`) |
| `npm run score:fps` | 0 | median 60.39, p10 60.38, ratio 1.000 PASS (`fps.log`) |
| `npm run score:soak:pure` | 0 | PURE SOAK PASS (`pure-soak.log`) |
| `node tools/audio-param-writes-probe.mjs ch4-vigil 8 3 --trace` | 0 | median 27.6/s, max 63.2/s (`after-param-writes.log`) |
| `node tools/audio-hit-onset-probe.mjs` | 0 | 30/30, max 0.045 ms (`hit-onset.log`) |
| `node tools/hit-sync-probe.mjs` ×8 beats ×3 runs | 0 | 30 firings, 30 within cap, 29/30 within −1/+2 frames (`sync/`) |
| `node tools/creative-triad-gate.mjs --phase implementation` | 1 | remaining failures are orchestrator actions plus the two honest fails above: authority re-pins `PARAVOXIA_AUDIO_10X_PLAN.md` 2ba8f22b3d10c913e4eacb8e9146ea58d5cf36a11e602f04a77a1572b48ac246 (§7 Stage 3 cells), `PARAVOXIA_SCORE.md` 695b02454f24ab62ce46dac7477e1dc2f8749de65193de227b733136f5762795 (§4 Stage 3 note), `PARAVOXIA_CREATIVE_COUNCIL.md` 61c06f6ae50b3b870b09764b0ffadf02be2a8e7682946889addca240dd97bcde (changed by a concurrent session — not this stage); UX-baseline source pin `main/src/audio/sfxEngine.ts` af3140c4a4ba05645ca620343723f9df1ffb35911bfe5858d47b32caca6113a6 (contracted C6 `playSfx` option); allowed-paths amendment for the three test files `main/src/story/storyScore.test.ts`, `main/src/story/storyScore.stage3.test.ts`, `main/src/story/signedSceneAvRuntime.test.ts`; `brief.exists` (decision-brief.json) is a run-level artifact this stage never touched; `checks.required typecheck` / `checks.commands` mirror the voiceBus.ts verify result (`gate.log`). |

## Files

- `moods-before.json/.log` — 62 mood identity hashes on the untouched instrument (before any Stage 3 edit).
- `moods-A-nodirty.*`, `wav/A-nodirty/` — constraint layer, all literal, dirty check OFF (commit A).
- `moods-floor.*`, `wav/floor/`, `floor-vs-A-nodirty.json` — same-code replay floor (1 LSB).
- `moods-A-dirty.*`, `wav/A-dirty/`, `A-nodirty-vs-A-dirty.json` — dirty check ON, measured delta.
- `moods-B-brain.*`, `wav/B-brain/`, `A-dirty-vs-B-brain.json` — commit B (brain default), per-mood delta.
- `mood-voicing.json` — pure per-mood voicing evidence (literal vs brain, per-change displacement, guard).
- `hit-onset.json/.log` — offline onset proof, ten anchors × three grid phases.
- `after-param-writes*.{json,log}` — writes/s after (median 27.6) with site attribution.
- `audio-check.log`, `fps.log`, `pure-soak.log`, `vitest.log`, `verify.log`.
- `sync/` — live per-hit traces and frame strips per beat.
- Tests: `generative/hitSchedule.test.ts`, `generative/moodConstraint.test.ts`, `story/storyScore.stage3.test.ts`,
  `mix/duckMatrix.test.ts` (S2-D10), `sfxEngine.test.ts` (C6 unshifted law), `mix/automationDirty.test.ts`.
- Tools: `tools/audio-mood-identity-probe.mjs`, `tools/audio-hit-onset-probe.mjs`, `tools/hit-sync-probe.mjs`,
  `tools/mood-voicing-evidence.ts`.
