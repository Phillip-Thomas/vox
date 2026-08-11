# Score Treatment — ch7/ch8 voice repair (RULING-ONLY lane)

Author: Score Director
Status: ready_for_reconciliation
Prepared independently from the Cinematography Director's treatment: **yes**
(no cinematography treatment or notes were read).

Story-intent revision: `ch7-ch8-voice-repair` **draft-v2**
(`contractChangeRequired: true` acknowledged).
Lock acknowledged: this run's score lane is **ruling-only** — no score code,
asset, engine, or mix mutation anywhere. Everything below is a ruling on
shipped material plus, where a finding requires mutation, the named bounded
scope of a **separately-routed score packet**. Nothing in this document is
represented as shipped unless cited to source at `03e975a`.

## Grounding and thesis

- Shipped references verified at `03e975a`:
  - `main/src/story/emergentScoreDirector.ts:58` — `OWNED_BEATS =
    ['ch7-reconstruct', 'ch7-board']`. **ch8-launch is not owned.**
  - `main/src/story/emergentScoreDirector.ts:77-100` —
    `resolveChapter7ReconstructionScoreVariant`: pure stage→variant map
    (`diagnosis|bench|frame|hull|lift|hover|route|calibration`).
  - `main/src/story/storyScore.ts:132-190` — `CH7_RECONSTRUCTION_MOODS`, the
    actual musical material each variant resolves to (analyzed per stage
    below); `:94` the ch7 steady default; `:98` the `ch8-launch` MOODS entry;
    `:101` `ch8-crossing`.
  - `main/src/story/signedSceneAvRuntime.ts:349-363` — `scoreIntensityFor`:
    returns `null` for `ch7-reconstruct`/`ch7-board` by name (the signed
    score-intensity exclusion is real and respected); every other beat runs
    the generic ramp `mood.baseline * (0.75 + progress * 0.25)` over the
    beat's anchor index.
  - `main/src/story/generatedSceneAvRuntime.json` — `sc.reconstruct.
    one-instrument` on all eight `anc.reconstruct.*` anchors;
    `sc.launch.ground-relents` on all three `anc.launch.*` anchors (cue refs
    gate whether the generic ramp applies at all; both rails are live).
  - `main/src/audio/scoreEngine.ts:1484` — `setScoreMood` resets
    `intensity = mood.baseline`; `:1502` `setScoreIntensity` clamps and
    drives tension/energy; `:1078` pattern-note drops only occur at
    `intensity < 0.45`; `:1304` riser gain = `mood.riser * intensity²`.
- Emotional-musical thesis: **the chapter's dread is being indexed, not
  scored-at** — ch7's accretive one-instrument variants already embody this;
  ch8's generic ramp does not know the stack exists and plays its fullest
  state exactly where the intent wants the emptiest air.
- Why this belongs to Paravoxia: the ruling defends the shipped grammar
  (variants derived from committed gameplay facts, silence as composed
  output) instead of asking for a timeline cue.

---

## 1. ch7 variant fit ruling — per stage

The new captions latch on the **same stage edges the score already hears**
(`tickReconstruction` → `syncChapter7ReconstructionScore`, per-frame). Each
variant change is a local phrase retune through `setStoryScoreMoodOverride`
(no hit, no stinger), and each variant's `baseline` becomes the resting
intensity via `setScoreMood` — so the ch7 score remains fully player-driven,
exactly as the signed score-intensity exclusion intends. Ruling per moment,
against the actual mood table (`storyScore.ts:132-190`):

| Moment | Stage → variant | Shipped musical material | Ruling |
| --- | --- | --- | --- |
| **M1** diagnosis (`brackets fall`) | `wrecked` → `diagnosis` | sparsest state of the chapter: bare fifth+ninth [0,7,14], 1.5-note pattern, pad 0.04, baseline 0.26 | **Serves.** The bare voice's first line lands in the chapter's barest air. The one-instrument register is the right floor for the bracket-fall; no acknowledgement cue is wanted and none exists. |
| **M2** `bench_online` (`allowed to be heavy`) | → `bench` | ostinato doubles (0.015→0.028), sub 0.06→0.07, baseline 0.30 | **Coexists.** The line promises weight; the mood adds only a whisper of it (sub +0.01). Not a defect — the accretion arc needs headroom for five more stages — but the line is doing the lifting here, not the score. Recorded as a taste note, no action. |
| **M3** `frame_restored` (`remembers a straight line`) | → `frame` | pattern straightens into strict alternation [0,·,7,·,0,·,14,·], ost 0.045, sub 0.10 | **Serves.** The pattern literally becomes a straight line the instrument "goes back to without being told." Happy alignment, but real and audible. |
| **M4** `hull_sealed` (`something started listening`) | → `hull` | first harmonic change of the chapter ([0,7,14]→[0,5,9,14]) and the **first melody voice** enters at density 0.12; pad doubles 0.06→0.12 | **Serves — the strongest fit in the chapter.** At the exact edge where the copy says something inside started listening, the score grows its first listening voice: a sparse melodic presence that was not there before. This is sharpening (new color, new attention), not swelling (tempo, wave, and register unchanged). |
| **M5** `lift_online` (capability gain, `ground's hold is a habit`) | → `lift` | sub reaches its chapter max 0.14, melody 0.12→0.18, baseline 0.48 | **Serves.** The capability gain is expressed as low-end weight arriving as the ground's claim weakens — sub-bass as untethering, in the ODESZA half of the vocabulary. Sharpens: same chord family, one parameter deepens. |
| **M6** `flight_ready` (`i put it in anyway`, the turn) | → `route` | first two-chord progression [[0,7,9,14],[0,5,9,14]], melody density leaps 0.18→0.52, riser 0.09→0.18, baseline 0.56 (chapter max) | **Coexists, deliberately tolerable.** This is the chapter's one genuine swell, landing on the moment whose copy is about surveillance. The swell reads as *commitment* (the act chosen despite the cost) rather than *watchedness*; the watched reading is answered 8 s later by calibration's semitone (below). I do not route a packet for this: the intent asked `hull|lift|calibration` to sharpen, and they do. Cross-note to Chapter in Stage 3 so the choice is on the record, not discovered. |
| **M7** calibration receipt (`INTEREST RAISED`) | `flight_ready` + calibration → `calibration` | keeps every earned layer but the second progression field lands on an **added semitone** ([0,5,9,**15**] against the 14 it earned) — "leaves the calibration image on an added semitone rather than claiming arrival" (shipped comment, `storyScore.ts:182-184`) | **Serves.** The unresolved semitone under the chapter's only `cinematic-look` exterior reveal is precisely "nothing has asked yet. something has started paying attention" — prepared tension, not a sting. The AUDIT NETWORK line needs no score acknowledgement and must not get one. |
| **Exit** (`the scar remains. now it can carry me.`) | `calibration` (unchanged) | steady calibration state through the hold, then ch7-board entry retunes to boarding `outside` — which is note-identical in level/family to `route` (baseline 0.56) | **Serves; and I sign the D9 hold extension.** Extending the named hold at `emergentStoryDirector.ts:592` from 0.65 s to ≈5 s has **zero score cost**: the calibration mood simply holds longer, and the seam into ch7-board `outside` is a same-family, same-baseline retune. No phrase is cut by the extension; the current 0.85 s screen life truncates a *caption*, not a phrase. Score signs the extension as a contract term. |

**Summary ruling:** the shipped eight-variant instrument already sharpens
rather than swells at `hull`, `lift`, and `calibration` — the three stages
the intent named — and it does so by construction (new color/voice, deepened
sub, unresolved semitone; never tempo/wave escalation). `bench` and the
`route` swell at M6 merely coexist with their lines; both are acceptable and
recorded. **No ch7 score packet is required.** The signed score-intensity
exclusion (`scoreIntensityFor` → `null`, `signedSceneAvRuntime.ts:349-353`)
is a protected strength and stays untouched; the `sc.reconstruct.
one-instrument` cue refs on the signed rail remain labels of this shipped
behavior, not unrealized asks.

## 2. ch8 ramp ruling — does the generic ramp give `CONTACT LOGGED.` near-silence?

**No. Measured and deterministic: the generic ramp delivers the beat's
loudest, fullest state across the entire hold window, and the measured
0.4375→0.42→0.35 descent happens only *after* the window ends.**

The mechanism (all shipped, deterministic):

1. `ch8-launch` is not in `OWNED_BEATS`, so its score is the MOODS table
   entry (`storyScore.ts:98`): **sawtooth**, tempo 72, melody density 0.4,
   pad 0.15, sub 0.15, riser 0.28, baseline 0.5 — one of the densest entries
   in the table (deliberately: the climb is the player physically steering an
   engine rhythm).
2. The generic ramp (`signedSceneAvRuntime.ts:349-363`) is **rising** by
   anchor order: `0.5 × (0.75 + 0.25 × progress)` → ignition **0.375**,
   liftoff **0.4375**, atmosphere-exit **0.5**.
3. As shipped, the atmosphere-exit anchor's `setScoreIntensity(0.5)` races
   the same-tick beat exit (intent D1) — which is why the baseline traces
   recorded 0.4375 as the last stable launch value. **Under the R2 hold, that
   race is gone: the anchor's 0.5 — the beat maximum — lands and persists for
   the full ~17 s window.** The hold, which the copy commission needs, makes
   the score *louder* at `CONTACT LOGGED.` than anything the player heard
   during the climb.
4. At intensity 0.5 the engine's quieting behaviors are all off: pattern-note
   drops require `intensity < 0.45` (`scoreEngine.ts:1078`); the riser sits
   at `0.28 × 0.25` gain; the pad filter is half-open (`:1294`). Tension and
   energy primitives are driven to 0.5/0.425 (`:1502-1504`).
5. The measured seam (0.4375 → 0.42 → 0.35) is: liftoff value → crossing
   MOODS baseline applied by `setScoreMood` at beat change
   (`scoreEngine.ts:1484`) → crossing's entry anchor ramp value. All of it
   occurs at or after the **+17.0 s advance** — i.e. after `CONTACT LOGGED.`
   (+10.0 s), after the designation caption (+12.5 s), and after L6
   (+15.0 s). The "emptiest air" the shipped material ever offers arrives two
   words too late, in the next beat, under the next beat's caption.

**Combined-bus evidence** (per lock: rendered because this ruling makes a
loudness claim; multiple engines stack on the music bus, so score-only
renders are inadmissible). Rendered through the shipped offline mirror
(`renderStoryBeatOffline`, real scheduler, real master chain) with the legacy
`deepSpace` scene driven alongside the score; offline the streamed
deepSpace/shimmer stems are silent, so **live loudness ≥ measured** — the
conservative direction for this ruling. 20 s each, era 1:

| Render | State | Overall RMS | vs. composed-near-silence reference |
| --- | --- | --- | --- |
| `ch8-hold-contact-logged` | ch8-launch mood @ **0.5** (the hold-window state at `CONTACT LOGGED.` +10.0 s) | **−19.93 dBFS** | **+3.9 dB** |
| `ch8-liftoff-state` | ch8-launch mood @ 0.4375 (measured shipped liftoff value) | −20.11 dBFS | +3.7 dB |
| `ch8-crossing-seam` | ch8-crossing mood @ 0.35 (what plays only after +17 s) | −20.92 dBFS | +2.9 dB |
| `near-silence-ref-defy` | ch4-defy mood @ 0.10 (the refusal — the score's canonical composed near-silence yardstick) | −23.83 dBFS | reference |

The RMS deltas are compressed by the shared legacy floor common to all four
renders; the texture difference is the sharper fact: at +10.0 s the player is
under a sawtooth progression with a 0.4-density melody, an active ostinato
(no note-drops), and an engaged riser — a *departure* texture, not empty air.
The refusal reference is a bare triangle fifth at density 0.04 with almost no
accompaniment. `CONTACT LOGGED.` currently lands mid-anthem.

**Ruling:** the generic ramp plus the measured intensity seam does **not**
give `CONTACT LOGGED.` the asked-for near-silence; it gives it the beat's
peak. The shipped score *coexists* with the stack (nothing breaks, no
masking of text, loudness is sane) — but the dramatic ask of the commission
is unmet by construction, and no configuration of the copy cadence can fix
it, because the score state is anchored to anchor order, not to the stack.
This requires score mutation and therefore a **separately-routed packet**
(scope in §5). The copy run proceeds regardless: at −20 dBFS the music
masks no text band, and every latch/cadence in §6 of the intent works
identically with or without the packet.

## 3. Cue ledger — silence and sync intent, cue relations to freeze in the contract

Relationships, not timestamps. These are the relations the contract should
record for cue purposes; items marked *(packet)* describe intended behavior
only if the §5 packet is later approved — they are **not** shipped behavior
and the contract must not imply they are.

| Anchor | Shipped score relation (freeze as-is) | Packet intent *(only if routed packet lands)* |
| --- | --- | --- |
| `anchor.ch7.brackets-fall` (M1) | `diagnosis` variant already resting; no cue, no hit, no intensity event. The bare voice owns the moment. | none — frozen |
| ch7 stage edges M2–M5 | variant retune on the same committed fact the caption latches on; audit→caption ordering has no score dependency | none — frozen |
| `anchor.ch7.anyway` (M6) | `route` variant retune IS the score's whole acknowledgement; explicitly **no hit** (`scoreHitFor` blooms only at `anc.maw.repair-committed`) | none — frozen; the swell/sharpen choice is recorded in §1 |
| M7 + exterior reveal | `calibration` variant's unresolved semitone under the reveal; no added cue | none — frozen |
| ch7 exit hold (D9, ≈5 s) | calibration mood holds; seam into ch7-board `outside` is same-family/same-baseline; **signed** | none |
| `anc.launch.ignition` (L2) | generic ramp applies 0.375; no hit | *(packet)* unchanged — the climb keeps its engine anthem |
| `anc.launch.liftoff` (L3) | generic ramp applies 0.4375; no hit | *(packet)* unchanged |
| `anc.launch.atmosphere-exit` (L4) | generic ramp applies **0.5 for the whole R2 hold window** — ruled against in §2 | *(packet)* the exit begins a committed **decay**, not a peak: the engine's reason to sing ends when the atmosphere does |
| `anchor.ch8.contact-logged` (+10.0 s) | no score event exists; state is the held 0.5 | *(packet)* the two words land in near-silence comparable to the defy floor; the score does NOT stamp them — silence is the cue |
| `anchor.ch8.open-query` (L6, +15.0 s) | no score event; held 0.5 texture continues | *(packet)* **absence staged as content — do not fill.** No resolution, no cadence, no drone swell; the query stays harmonically open exactly as it stays procedurally open |
| advance to `ch8-crossing` (+17.0 s) | `setScoreMood` resets to crossing baseline 0.42, entry anchor applies 0.35 | *(packet)* crossing entry becomes a **rise from silence** instead of a step down from 0.5 — the same measured seam values, reached from below. No crossing-side change needed in either case |

Binding silence law restated for the contract: L6's emptiness is composed
output, not a mix accident. Whatever happens to the packet, **no one may
"fix" the open query by adding material under it.**

## 4. Era/instrumentation continuity

No obligation the shipped material cannot meet, in either register:

- **Bare first person (captions):** ch7's one-instrument triangle-wave
  accretion is the era-correct voice for private labor at full reality
  (emergent era, alive stage) — polyphony and color are earned per committed
  stage, which is the era ladder's second reading working as designed. The
  brackets falling is a *text* event; the score's job is to not flinch, and
  it doesn't (no retune coincides with M1's caption — the diagnosis variant
  is already resting).
- **Regulation receipts (audit band):** `WRECK RELAY` / `AUDIT NETWORK`
  lines carry no first person and get no score acknowledgement anywhere in
  the shipped material — correct, and must stay so. The register the stack
  speaks (`QUESTIONS ....... 0`) has one shipped timbral cognate: the square
  wave as foreign body (`ch4-arrival`, `storyScore.ts:73-75`). A packet MAY
  consider letting the emptied exit window expose a single cold square
  element as the stack files its rows — it is the one instrument the game
  has taught the player to hear as *the system speaking* — but this is
  creative option, not obligation, and belongs entirely to the packet's
  audition cycle.
- No new instrument, asset, or fidelity rung is required by any line in §3
  of the intent. Reality-stage ceiling unchanged; era mappings untouched.
- Guided-play law check (my lane's corner of it): the restored Variant D
  publish inside the hold window (`ch8:launch:orbital-handoff`) receives
  whatever entry acknowledgement the shipped objective system already gives
  it — once, per the shipped lifecycle. No score-side acknowledgement exists
  or is proposed; the score cannot become objective feedback here, and the
  packet must preserve that.

## 5. Verdict

**(c) — requires a separately-routed score packet, for ch8-launch only; the
run proceeds on copy without waiting.** Precisely:

- **ch7-reconstruct: serves as-is.** No packet, no reservation that blocks
  signature. Taste notes (M2 weight, M6 swell-vs-sharpen) recorded in §1 and
  routed as Stage 3 cross-notes, not defects.
- **ch7 exit-hold extension (D9): signed** as a contract term from the score
  side (zero musical cost, seam verified same-family).
- **ch8-launch: packet required** to honor the commissioned near-silence at
  `anchor.ch8.contact-logged` and the composed emptiness at
  `anchor.ch8.open-query`. The shipped generic ramp coexists (nothing
  breaks; text legibility is unaffected) but cannot deliver the dramatic
  ask, deterministically (§2).

**Named bounded packet scope** (routes to the owner separately; NOT this
run): *"ch8-launch atmosphere-exit window score authority."* Add
`ch8-launch` to the emergent score director's owned beats with a small
gameplay-derived variant set (e.g. `climb` — current MOODS behavior
unchanged; `exit-decay` — entered on the same durable `deep_space` fact the
hold observes, a committed ramp-down toward a defy-floor texture;
`open-query` — the held near-silence L6 sits in), mirroring the shipped ch7
variant pattern: pure resolution from committed facts, no timeline cues, no
new save fields, `setStoryScoreMoodOverride` as the only authority surface.
Files: `main/src/story/emergentScoreDirector.ts`,
`main/src/story/storyScore.ts` (variant table), tests, plus soak/handoff/
combined-render evidence and owner audition. Explicitly out of packet scope:
the three signed launch anchors, `generatedSceneAvRuntime.json`, the generic
ramp's behavior for every other beat, crossing/landfall moods, and any hit at
any launch anchor. `contractChangeRequired: true` when the packet lands
(cue relations at two shared anchors change meaning); this run's contract
freezes only the shipped relations in §3.

If the owner declines the packet, the recorded fallback is honest: the stack
plays over the departure anthem at −20 dBFS — legible, sane, dramatically
flattened; the dissent stays in the register.

## 6. Performance, mix, and evidence

Probe (read-only, run-folder-resident, shipped offline mirror via the
canonical preview at `http://localhost:5176` — never 5173/5174):
`score-ch8-window-probe.mjs` (this run folder). Outputs in `evidence/`:

| File | SHA-256 |
| --- | --- |
| `evidence/score-ch8-window_ch8-hold-contact-logged.wav` | `1352eab5964293c6b5dd148f44d2fee30c004fa3f473e9c8313880d36465459e` |
| `evidence/score-ch8-window_ch8-liftoff-state.wav` | `68d47e1884ab4d3139ba1396ff5ab687d729c09a7545bb05b1d6209626b45033` |
| `evidence/score-ch8-window_ch8-crossing-seam.wav` | `cb3909952ad018fe1c5ce36737cbf9d6dd833911781c3f80eaae7cb425e6d6d3` |
| `evidence/score-ch8-window_near-silence-ref-defy.wav` | `4559d24bcf28a371e5a33a41e899d3f99da2b9b76903cfda7cf7dd6c8cf46603` |
| `evidence/score-ch8-window-analysis.json` | `9db5b037d4d861aa47c11c54eafe42c247c6532c41827538fe8e78c61e242235` |

All renders finite, unclipped (peaks ≤ 0.363), health-pass; determinism
follows from the shipped offline mirror (seeded engines, scripted intensity).
Static rulings (§1, §2 mechanism) cite exact shipped symbols and need no
render. The four WAVs double as owner-audition material for the packet
decision.

## Stage 3 cross-notes I will raise

- **To Chapter:** (1) M6's `route` variant is the chapter's one swell and it
  lands on "i am being watched now" — I read the swell as *commitment* and
  rule it tolerable; if you want watchedness instead, that is packet
  territory, say so now. (2) M2's line promises more weight than the `bench`
  mood grants; consider whether the line's "allowed to be heavy" carries
  alone (I believe it does). (3) The §2 finding strengthens your R2 case:
  the hold is load-bearing for copy AND is what finally exposes the score
  defect the same-tick exit was hiding.
- **To Cinematography:** the score has no lens/FOV interaction anywhere in
  scope (`appliedFovDeg` null at all launch anchors; ch7's exterior reveal
  carries no score event beyond the resting calibration semitone). If your
  liftoff-tree ruling routes a camera packet, it has no score coupling and
  the two packets can proceed independently.
- **To the orchestrator/owner:** the ch8 packet decision does not gate this
  run's copy; it gates whether `CONTACT LOGGED.` lands as commissioned or as
  coexistence. Recorded in the dissent register if the contract signs
  without it.

---

## Errata (2026-08-11, authorized; per score-audit.md sa-02/sa-13)

Where §2 item 5 and the §3 advance row attribute the measured 0.35 to "the
crossing entry anchor": ch8-crossing has no symbolic entry anchor in the
shipped runtime — the seam is route-dependent, and 0.35 is the ramp value of
the SECOND crossing anchor `anc.crossing.sibling-targeted`
(`0.42 × (0.75 + 0.25 × 1/3)`), the first to fire on the common route; if the
optional player-action anchor `anc.crossing.origin-lookback` fires first the
value is 0.315 (`0.42 × 0.75`). The correct statement — advance applies the
0.42 crossing baseline via `setScoreMood`, then the first crossing anchor that
fires applies its ramp value (0.35 common route / 0.315 lookback branch) — is
frozen in contract draft-v5 `cue.ch8.advance`; the event-anchored seam ruling
and all loudness findings are unaffected. Root cause: §2/§3 were verified
against contract capture, not against `generatedSceneAvRuntime.json`.
