# Paravoxia feedback triage — 2026-07-26 (wave 4: the looping SFX + audio consolidation)

Owner feedback: "Sound effects that occur when picking up a material, or
captions pop up, just keep RE-FIRING until I press a button, and then it
stops... I think we have legacy sound systems leading to colliding webaudio
logic... we need to consolidate the audio, clean up any legacy mess or dead
code or colliding audio, and be absolutely certain this ugly sound does not
persist."

Predecessors: `PARAVOXIA_FEEDBACK_TRIAGE_2026-07-21.md` (wave 3),
`PARAVOXIA_FEEDBACK_TRIAGE_2026-07-20.md` (waves 1–2). Worktree and
release-gate rules from `CLAUDE_FABLE_HANDOFF_2026-07-20.md` remain binding.
All lanes mechanical opus; zero fable spend.

## Diagnosis (two read-only audits, exhaustive)

**The symptom was a LEVEL-TRIGGERED call site, not a rate problem and not a
WebAudio collision.** The wave-3 rate limiter bounds how fast an event can
fire, but a call site that re-triggers every frame from a standing condition
just becomes a steady metronome at the floor (~9/s). "Stops when I press a
button" is the fingerprint: input changes the standing condition.

- **Primary (confirmed): the hold-to-mine "target acquired" chip**
  (`EfficientPlayer.tsx` `updateMining`, chip at old ~:1001): fired on any
  target-identity CHANGE (`ms.key !== key`), not on acquisition. Holding
  EXTRACT on a voxel boundary → physics micro-jitter flips the
  `Math.round`-resolved voxel per frame → chip at the limiter floor forever
  AND `ms.elapsed = 0` per flip → **extraction could never complete there**
  (the loop was also a silent gameplay bug). Any movement input shifts off
  the boundary → stops. Exactly matches "picking up a material… until I
  press a button."
- **Secondary: the objective-enter chirp** (`terminalAdvance`, deliberately
  un-rate-limited in wave 3): all early-chapter guidance ids are latched
  (verified one by one), but the ch8 flight-state ids derive from per-frame
  flight snapshots and can flap at envelope/surface boundaries → chirp +
  objective-card re-pop per frame. This is the "captions pop up" half
  (objective card = caption to a player).
- **Latent: `VoyageLedger` digit-drift** — `Math.sign` stepping would
  oscillate forever on any future fractional ledger value (all current
  values integer).
- **Exonerated:** the wave-3 pickup coalescing (verified accepted-only via
  `git diff`; idle re-collection is impossible — collected-Set guards hold);
  StoryCaptions (make no sound at all); and — for THIS symptom — the
  "colliding legacy systems" hypothesis (all SFX flow through one engine
  choke point). A complete edge-vs-level table of every `playSfx` call site
  was produced; all other sites are edge/milestone/counter-gated.
- **Census verdict on the hypothesis overall:** partly right. The one real
  legacy seam was the **dual AudioContext** (SFX private context separate
  from the shared music/score/bed context) — architectural debt (and the
  reason offline renders never captured SFX), though not the loop's cause.
  Legacy musicEngine is NOT dead/colliding (story scenes duck it since wave
  2; its streamed layers are intentional and era-gated); schedulers are
  self-gating singletons; no stray oscillators/audio elements exist outside
  `main/src/audio/`; essentially no true dead code beyond
  `MusicEngine.preload()`.

## Fixes (Lane RT — retrigger; Lane CON — consolidation; disjoint files)

**Lane RT:**
- `miningTrigger.model.ts` (new, pure, 13 tests) wired into `updateMining`
  for both 3D and side paths: chip ONLY on null→target acquisition;
  target→target′ and brief-null changes debounced `RETARGET_DEBOUNCE_FRAMES
  = 5` (~83 ms); flicker back to incumbent cancels pending retarget and
  KEEPS the charge; commits are silent; charge freezes (never accumulates
  wrong-voxel) on mismatch frames. `MINE_TICK_MS = 260` cadence,
  completion/pickup chips untouched. Fixes both the metronome and the
  boundary-extraction failure.
- `flightGuidanceDwell.model.ts` (new, 8 tests) in `emergentStoryDirector`:
  ch8 launch/crossing/landfall ids need 1.75 s stable state before changing
  (first sample latches immediately; reset at beat entry).
- `VoyageLedger`: integer-rounded drift targets (zero visual change today).
- **Loop guard in `sfxRateLimiter.ts`** (the "absolutely certain" backstop):
  sustained suppression (≥24 suppressed spanning ≥350 ms in a 2 s window —
  the fingerprint of a per-frame caller being clipped) engages escalating
  intervals (×4, cap 1.6 s), one `console.warn` per event per session
  naming the event, full reset after 800 ms quiet. Numerically verified: a
  60 fps loop engages at ~0.43 s and collapses to ~5 blips total; dense
  same-frame pickup bursts and the ledger typewriter can never engage it.
  New floors: `terminalAdvance` 150 ms (call-site audit proved no legit
  sub-150 ms double-fire), `blocked` 110 ms. `storyGlitch` left ungated
  (intentional cadence not provably safe to clip).
- Field diagnosis: `window.__voxSfxDiag()` now also prints
  `loop-guard: <event> ENGAGED×n` + lifetime engage counts.

**Lane CON (owner-mandated consolidation; plumbing only, recipes
byte-identical):**
- **One AudioContext**: SfxEngine now uses the shared context, joining at a
  new post-compressor unity `masterOutput`; keeps its own sub-master +
  submerge filter. Deliberate: SFX stays OUTSIDE the music compressor and
  scene envelope and un-ducked on tab-hide, because that is today's audible
  behavior (each is a one-line re-point if the owner ever wants it).
- **One output route** (`game:`; `window.__voxAudioDiag()` reflects it),
  one unlock authority (`AudioControls` → `unlockGameAudio()`; SFX unlock
  delegates to audioCore; all wave-2 iOS invariants preserved — media
  element route, interrupted-state resume, re-arming installer), one
  visibility listener (duck 0.18 / 0.35 s / 0.45 s semantics preserved,
  moved into audioCore; small widening: menu music now also ducks on
  tab-hide, previously in-game only).
- Dead code: `MusicEngine.preload()` deleted (zero production callers).
- NOT deduped, on purpose: sfxEngine's local `rampParam`/`makeNoiseBuffer` —
  the census called them duplicates but they differ (linear vs exponential
  ramps, different noise generators); sharing them would change SFX timbre.
- Stale docs fixed: `PARAVOXIA_SCORE.md` (separate-context "future work"
  note → done), `main/UNDERWATER.md` (two-contexts note → intentional
  split-filter voicing on one context).

## Verification

- Full `npm --prefix main run verify`: **260 files / 1930 tests green**,
  build clean.
- Scoped: miningTrigger 13, flightGuidanceDwell 8, limiter 14 (incl. 5-test
  loop-guard suite), full src/audio 278, src/components 132, new
  sfxEngine single-context graph tests.
- Live story-verifier battery: **VERDICT PASS** (all four probes, real
  pointer-lock + synthetic KeyE holds on the actual `pickSideTarget` path):
  - **Metronome probe**: 8 still-hold stances (sub-voxel offsets straddling
    boundaries, ch1-fixed + ch1-raster) plus two 45 s walk+extract trench
    runs crossing ~14 voxel boundaries each. `mine` admit rate peaked
    **4.67/s** (legit ticks; a metronome would pin ~9/s at the floor);
    suppression bounded; **loop-guard engaged ZERO times in every run**.
  - **Extraction completes on boundaries** (old bug refuted): 10–17 items
    per still stance, 34/30 items in the trench runs; HUD ledgers filled
    (`CALIBRATION · FIBER 3/3`, `QUOTA · FIBER 6/6`).
  - **Plumbing**: exactly one `game: direct (running)` route, stable over a
    2-min session exercising 6 SFX + score onset; **0 post-unlock WebAudio
    errors** (menu-gated entry: 0 warnings entirely; `?story=` deep-link
    pre-unlock autoplay warnings are a dev-only artifact).
  - **ch1 ladder regression**: honest end-to-end in 108.4 s, every beat
    3–4× under its ceiling, zero timeout rescues, zero loop-guard engages
    across the full autopilot extraction run, zero page errors.
  - New reusable probe: `main/mining-metronome-probe.mjs` (untracked).
    All probe servers confirmed killed.

## Owner-gated follow-ups

1. Reproduce your scenario on device: hold EXTRACT standing still where it
   used to machine-gun. Expect: one chip, 260 ms progress ticks, completed
   extraction. If ANY looping sound ever returns: open the console, run
   `window.__voxSfxDiag()` — it names the guilty event and shows
   `loop-guard … ENGAGED`; report that string and the fix is a one-site
   edge repair.
2. Discriminator if unsure what you heard: looping sound WITHOUT the
   "+N ITEM" toast re-showing = sound-only trigger (this fixed class);
   toast re-showing in lockstep = re-collection (different bug, none known).
3. Taste calls now available as one-liners: SFX through the compressor?
   SFX ducked on tab-hide? (Both currently match pre-consolidation
   behavior.)
4. The worktree now carries FOUR green-verified uncommitted waves — commit
   in coherent batches before any new feature work.
