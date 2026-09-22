# Score audit — Stage 3 (composed sync, one tonic, MOODS-as-constraints)

Reviewer: score-continuity-auditor (opus), read-only, independent; filed verbatim by the orchestrator. Contract draft-v4 sha 672de45a…d41d.

## Verdict

**PASS WITH DEFECTS — no blocking musical defect; three contract-text amendments and two latent-robustness repairs required before Stage 3 can be called closed.** The grid law, cap ladder, tonic-chain machinery, constraint layer and bundle wiring are implemented as designed, evidenced against the real engines, and the live sync numbers are genuinely good (30/30 within cap, 29/30 within −1/+2 frames, state ≤ image 0 violations). What is not yet true is that the contract text and the shipped mechanism say the same thing, and two silent-fallback paths in the harmonic authority are unmeasured.

## Findings by audit item

1. **Grid law — satisfied.** `scheduleHit` routes to `scheduleOnStoryGrid` (`main/src/audio/scoreEngine.ts:1907-1946`), whose `stepSeconds = 60/leading.tempo/2` and `{currentStep: patternStep, stepTime: base}` are literally the audible scheduler's own counters (`:1182-1243`) — "beat means the mood's own tempo" is exact, not approximated. All 30 live firings report `path: "story-grid"` (`evidence/stage-3/sync/*.json`), including `ch5-maw`, so the bed grid never contended with a mood clock at any published anchor. No hand-back disagreement is possible while a mood leads, because `bedEngine.ts:1218-1226` freezes the planner and publishes nothing under a story lead.
2. **Caps fit at every published tempo** (72/96/132/84/88/70/66 BPM), verified by hand against `hitSchedule.ts:144-162` and the pinned rungs. Degrade ladder is correct and `fitsCap:false` surfaces rather than silently falling to immediate (`hitSchedule.ts:129-131`). `NEVER_QUANTIZE_KINDS` throws by name (`scoreEngine.ts:1836`). `impact` renders boom+braam from one `now` (`:1983-1984`). Cancel grace 0.05 s only drops not-yet-sounding hits — no click path.
3. **Tonic chains — mechanism sound.** `readLiveBedTonic` is gated on `idle && bedLead` (`scoreEngine.ts:1579`), so a live-then-seed read only happens when the bed genuinely leads; the value read is the same `tonicPc` the bed will resume on, and the planner is frozen in between. A live-then-seed re-derivation is therefore **not** an audible pitch jump in the shipped flow. `planetHomeRoot = derivePlanetKey(seed).tonicPc` and `createHarmonyBrain` uses the same draw; `derivePlanetKey` computes `tonicPc` before archetype is consulted (`harmonyBrain.ts:236-240`), so the archetype cannot desync it. Hand-back shares root **by construction, conditionally** — see D3. `CH10_CARRIER_HZ` is pure (`storyScore.ts:631`), seed never consulted (`deriveChainTonic` case `'absolute'`). Chain membership matches the contract enumeration beat-for-beat.
4. **MOODS-as-constraints.** Voice 0 literal root, full authored stack published with the tail appended untouched (`moodConstraint.ts:221-224, 269`), tight intervals asserted *equal* not merely present (`:193-198`), ceiling = the composer's own written jump with the literal always a candidate (`:251-253, 263-264`), and the gain guard demotes on either failure (`:152-167`). Forecast/live agreement is real: `voiceMoodChord(c, k, prev)` is walked identically from `(0, null)` in both the pad loop (`scoreEngine.ts:1188-1193`, seeded at `:1691`) and `resolveMoodVoicingAt`. 62 entries, 29 brain-voiced, **only 9 audibly changed**; `ch7-reconstruct/route` and `/calibration` are demoted `no-gain`, so the two-note skeleton is untouched; every ch10 mood literal; `a4-exhale` ordered.
5. **applyRails dirty check** is a deadband against the last *written* value (`scoreEngine.ts:1354-1361`), so error cannot accumulate — steady-state ceiling 0.4 % (≈0.035 dB). Cache dropped on retune/crossfade (`:1658, 1693, 2179, 2268`). `AUTOMATION_CADENCE_S 2` only delays sub-epsilon (0.004) legacy lane re-issues; no keep-alive ramp depends on it. 27.6 writes/s median is real.
6. **SFX forward-scheduling** correct: one helper each in `storyDirector.ts:879-882` and `emergentStoryDirector.ts:980-983`, five bundles; `resolveSfxStartTime(currentTime, undefined) === currentTime` (`sfxEngine.ts:641-643`) proves unbundled `playSfx` unshifted.
7. **a3 `notBefore` (D-S3-1): the deviation is right, the contract text is wrong.** See D1.
8. **Two-clock guard (D-S3-6): sound.** The beat clock can only lag the audio clock, both targets are fixed at the same arming tick, so the guard can never fire early and cannot shorten the a3 hold. Measured improvement (+5.9 → +0.87 frames) is the correct fix, not a patch over a symptom.
9. **S2-D10**: documented in `mix/duckMatrix.ts:11-24`, pinned by two tests. The `oxygenCritical` exemption is logically valid — depth == cap means resolution time cannot change the applied depth.
10. **Determinism**: pure soak PASS incl. bit-identical seed-10 replay and seed divergence; 131 files/1184 tests green; fps 60.39 median, ratio 1.000.

## Ranked defects

| # | Sev | Category | Evidence | Repair | Route |
|---|---|---|---|---|---|
| D1 | High | contract↔impl | `anc.a3.first-blade.acceptanceCriterion` demands `wakeAt + last A3_CAPTIONS.atSeconds + one 8th` (23.34 s); shipped is the last caption *before* the wave (`storyDirector.ts:1121-1127`), 9.84 s, which never binds | Amend to draft-v5: "the last caption authored before the wave"; note the guard is currently inert and only protects a future retune | Chapter + Cinematography (contractChangeRequired) |
| D2 | High | contract↔impl | Contract says "all 55 moods" and "render-hash identical"; inventory is 62 and the harness floor (1 LSB, −121 dBFS) makes PCM hash unattainable. Also `sc.chain.tonic-authority` calls `refused`/`seam-ebb` both `subtractive` and `literal` | Amend to 62 entries, fingerprint identity, and state the ch10 beat rule's precedence over the subtractive naming | Score → triad |
| D3 | Med | harmonic authority | `retargetHarmonyKey` mutates `harmony.tonicPc` (`bedConductor.ts:738`). Every seed-policy chain (prologue always; any live chain whose read fails) then sounds in `planetHomeRoot` while the bed can resume in a retargeted key. No test covers a retargeted bed at hand-back | Add a hand-back test with a retargeted bed; either re-key the bed at chain exit or document the exposure | Score |
| D4 | Med | harmonic authority | `resolveScorePlanetHomeRoot()` returns **0 (reference A)** when no planet genome is configured (`scoreEngine.ts:1597-1600`) — silently defeating "the prologue sounds in the planet's key before the planet is seen" if `crawl` is entered before `configureBedPlanet` (`AudioDirector.tsx:140`) | Name the fallback in the hit trace and add one live `?story=crawl` probe asserting the chain tonic == `planetHomeRoot(terrainSeed)` | Score + verifier |
| D5 | Med | node lifetime | `pendingHits` is pruned only inside `cancelPendingScheduledHits` and teardown (`scoreEngine.ts:1794-1802, 2266`); the bed-led paths push on every punctuation (`:1642, 1882`). A sandbox session that never exits a chain retains GainNode records without bound; pure soak measures the planner only, not nodes | Reap entries with `audioTime < now − 1` on each push | Score |
| D6 | Low | grid law (latent) | The bed-grid branch (`scoreEngine.ts:1854-1880`) ignores `desired`, `notBefore`, `floorRung` and `mayLead` and does an ad-hoc single bar→beat degrade; `bedQuantize` takes no `fromTime`. Unexercised today (all 30 firings story-grid) but a future anchor placed in bed-led play would silently breach a `notBefore` floor | Route the bed path through `resolveHitQuantum` with a bed `StepGrid`, or assert at the façade that no anchor with `notBefore` may schedule bed-led | Score |
| D7 | Low | mechanism/doc | `'subtractive'` and `'ordered'` are behaviourally identical to `'literal'` in `voiceMoodChord:223`; `CH10_SUBTRACTIVE_VARIANTS` is referenced only by its own test | Say so in the header, or drop the aliases | Score |
| D8 | Low | gate | `npm run verify` exits 2 on `src/audio/voice/voiceBus.ts(146,3)` (untracked Stage 6 file) | Fix or land that file; verify is red for everyone until then | Integration/Stage 6 |
| D9 | Info | zero margin | `anc.a2.*` and `anc.a4.life-front` fit their caps **exactly** (beat period == cap) | Keep the fit test; treat any tempo/quantum edit on those rows as a contract change | Score |

## Motif / harmony continuity

One authority per beat: the chain tonic is a single module variable (`storyScore.ts:637`), member→member holds it *and* its pending hits, chain→chain and chain→unchained cancel and re-derive — matching `reset-score` including the pause/focus-loss no-op. Interval identity inside every chain is exact by construction. Prologue is seed-unconditional; ch10 absolute at offset 0. Voice leading is minimal-motion with the literal always admissible: total inner motion 1291 → 958, max single move 11 → 9, never worse per change, all pitch-class sets/bass roots/tight intervals kept (`mood-voicing.json`).

## Cue-alignment matrix (live, 3 cold runs each)

| anchor | landed | slack (cap) ms | image−onset frames | state ≤ image |
|---|---|---|---|---|
| descent.impact | beat/step | 232–243 (400) | 0.43–1.23 | ✓ |
| track.unbolt | beat | 97–295 (450) | 0.22–0.43 | ✓ |
| lift.perspective | beat (lead) | −260…−305 (400) | 0.53–0.85 | ✓ |
| a1.color-stabilizes | beat | 122–326 (400) | 0.14–0.27 | ✓ |
| a2.feed-wall-falls | beat | 20–422 (455) | 0.57–1.21 | n/a |
| a2.hand-back | beat | 299 (455) | 0.19–0.44 | ✓ |
| a3.first-blade | bar | 541–573 (2750) | 0.24–0.56 | n/a |
| a3.material-lands | bar | 1526–1542 (2750) | 0.07–0.87 | ✓ |
| a4.life-front | beat | 715–743 (909) | 0.08–**2.32** | ✓ |
| maw.repair-answer | beat | 203–245 (450) | 0.17–0.81 | ✓ |

Objective mix/soak: onset vs `audioTime` max 0.045 ms over 30 rows; dirty-check delta ≤ −80.9 dBFS residual, |ΔRMS| ≤ 0.0072 dB; brain re-voicing ≤ 0.076 dB RMS on 5 audible rows; writes/s median 27.6 (max window 63.2); audio:check 13/13; fps 60.39 median; pure soak PASS ×2 seeds ×32 min.

## Taste risks (audition, not defects)

- **Pad inversions.** Brain voicings place inner voices below the literal root (e.g. `voyage` root 8 with an upper at 3). The published root and the sub are unchanged, but the pad's *bottom sounding note* is no longer the root in 9 moods. Smoother, less planted. Owner's ear.
- **`a3-dawn` is the only awakening re-voiced** — the peak of chapter 3. Consistent with its chain-mate `ch3-dusk`, which is good, but it is the one dramaturgical row worth A/B-ing (`wav/A-dirty` vs `wav/B-brain`).
- **`ch1-raster` change 5→6 shows no gain** (literalMax 5 / brainMax 5, total 10/10) yet the mood is brain-voiced overall — one change in a re-voiced mood carries the brain's *earlier* displaced voicing without buying anything there.
- **Hidden-tab return**: the image bundle fires on the audio-clock target the instant a tick resumes, i.e. after the hit already sounded. Not covered by any capture (headless only). Owner call whether that path needs a re-arm like pause has.
- S2-D10 (d), terminal typing over story lead, remains delegated taste.

## Protected strengths (do not regress)

The pure/impure split (`hitSchedule.ts`, `moodConstraint.ts` know no engine state); the gain guard demoting to literal rather than trusting the brain; `fitsCap:false` surfacing instead of falling to immediate; the two-clock guard; caps written as `{beats:1}` expressions; state members never waiting for sound; unbundled `playSfx` provably unshifted; `NEVER_QUANTIZE` enforced by throw.

## Single highest-leverage repair

**Close the two silent fallbacks in the tonic authority (D4, then D3).** Everything else in this stage is either paperwork or latent, but a `planetHomeRoot` that quietly returns reference A — or a bed that resumes in a key it retargeted away from — breaks the one thing Stage 3 exists to guarantee, produces no error, and is currently proven by no test or probe. Name the fallback in the hit trace and pin the prologue's plant with one live `?story=crawl` assertion that the chain tonic equals `planetHomeRoot(terrainSeed)`.