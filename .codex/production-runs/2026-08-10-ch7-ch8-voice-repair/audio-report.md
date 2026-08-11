# Audio Report

Status: complete

Run: `2026-08-10-ch7-ch8-voice-repair` · Contract revision: `draft-v2` ·
Source revision `03e975a666767dd3d75fc339a3b3d61dfa755c4c`

## Authority and change disposition

- Audio mutation authorized: `no`
- Audio changed: `no`
- Protected paths checked: `main/public/audio/`, `main/src/audio/`,
  `main/src/components/audio/`, `main/src/story/emergentScoreDirector.ts`,
  `main/src/story/voyageDeck.ts`, `main/src/story/signedSceneAvRuntime.ts`,
  `main/src/story/generatedSceneAvRuntime.json` — every one clean in
  `git status --porcelain`; the run's only changed files are
  `main/src/story/emergentStoryDirector.ts`,
  `main/src/story/emergentStoryDirector.test.ts` and the new
  `main/src/story/storyText.test.ts`.
- If unchanged/protected, regression proof: the Stage 2 combined music-bus
  offline renders were repeated post-implementation and reproduce the shipped
  measurement to within 1e-8 dB at every case
  (`evidence/verification/score-ch8-window-verify-analysis.json`).

The shipped audio state of the ch8 exit window is therefore exactly as measured
in Stage 2 and recorded in `evidence/score-ch8-window-analysis.json`
(dissent-01). Stage 2 WAV hashes, preserved for provenance:

| Case | Stage 2 WAV | sha256 |
| --- | --- | --- |
| `ch8-hold-contact-logged` | `evidence/score-ch8-window_ch8-hold-contact-logged.wav` | see `evidence/score-ch8-window-analysis.json` `.cases[0].wavSha256` |
| `ch8-liftoff-state` | `evidence/score-ch8-window_ch8-liftoff-state.wav` | `.cases[1].wavSha256` |
| `ch8-crossing-seam` | `evidence/score-ch8-window_ch8-crossing-seam.wav` | `.cases[2].wavSha256` |
| `near-silence-ref-defy` | `evidence/score-ch8-window_near-silence-ref-defy.wav` | `.cases[3].wavSha256` |

## Cue and sync evidence

| Cue | Start/end anchors | Phrase/bar observation | Mix observation | Artifact | Status |
| --- | --- | --- | --- | --- | --- |
| `sc.launch.ground-relents` | `anc.launch.atmosphere-exit` -> `anchor.ch8.advance` | Holds unbroken for the entire 17.07 s window. 77 live samples over the implemented hold record the same cueRef set, the same signed intensity 0.5000 and `score.hit: null` throughout; no cue starts, ends or re-stamps inside the window. | Combined music-bus render at that exact state measures **-19.93 dBFS** overall RMS, **3.90 dB above** the ch4-defy composed yardstick at **-23.83 dBFS**. Peak 0.363. | `evidence/verification/ch8-window-av-score-trace.json`, `evidence/verification/score-ch8-window-verify-analysis.json` | `pass` |
| `sc.launch.ground-relents` (liftoff state) | `anc.launch.liftoff` | Shipped generic-ramp value 0.4375, unchanged. | -20.11 dBFS, 3.72 dB above the yardstick. | `evidence/verification/score-ch8-window-verify-analysis.json` | `pass` |
| `sc.crossing.distance` (seam) | `anchor.ch8.advance` -> `anc.crossing.sibling-targeted` | Signed intensity steps 0.5 -> 0.42 -> 0.35 across the advance, matching the shipped seam. | -20.92 dBFS, 2.91 dB above the yardstick. | `evidence/verification/ch8-window-av-score-trace.json` | `pass` |
| `CONTACT LOGGED.` slot (+8.5 s) | `anchor.ch8.contact-logged` | No score event stamps it. `score.hit` is `null` at every sample of the window and the cueRef set does not change; this run adds none and the contract forbids adding one. | The air under it is the held `sc.launch.ground-relents` bed at -19.93 dBFS, 3.90 dB above the composed yardstick. | `evidence/verification/ch8-window-av-score-trace.json` | `pass` |
| `terminalAdvance` (objective-enter SFX) | `+1.765 s` into the hold | The single presentation cue for the restored `ch8:launch:orbital-handoff` objective publish, 1 triggered / 0 suppressed at the rate limiter. | Shipped one-shot UX cue; no loop, no retrigger, no suppression. | `evidence/verification/audio-window-census.json` | `pass` |

## Combined-bus render taken during the implemented window

The verification render is a combined music-bus render — score plus the legacy
`deepSpace` procedural voices driven alongside it — not a score-only render, so
stacked engines are represented. Offline the streamed stems are silent, so live
loudness is greater than or equal to the measured value. Cases and results:

| Case | Beat | Intensity | Overall RMS | vs. ch4-defy yardstick |
| --- | --- | --- | --- | --- |
| `ch8-hold-contact-logged` | `ch8-launch` | 0.5000 | -19.928312 dBFS | +3.90 dB |
| `ch8-liftoff-state` | `ch8-launch` | 0.4375 | -20.110469 dBFS | +3.72 dB |
| `ch8-crossing-seam` | `ch8-crossing` | 0.3500 | -20.916565 dBFS | +2.91 dB |
| `near-silence-ref-defy` | `ch4-defy` | 0.1000 | -23.831419 dBFS | 0.00 dB |

Provenance note: the WAV byte hashes of the verification renders differ from the
Stage 2 hashes because `OfflineAudioContext` scheduling is not bit-deterministic
on this machine. Every measured quantity matches to within 1e-8 dB RMS and 1e-7
peak, so the equivalence is asserted by measurement, not by hash. Both WAV sets
are retained.

Verification renders:
`evidence/verification/score-ch8-window-verify_ch8-hold-contact-logged.wav`,
`..._ch8-liftoff-state.wav`, `..._ch8-crossing-seam.wav`,
`..._near-silence-ref-defy.wav`.

## Do the new text emissions add or remove audio events?

No. A live census across the implemented window records every story UX feedback
cue and samples the SFX rate limiter's own per-event counter twice a second:

- `showCaption` and `showAuditLine` emit nothing on any audio bus. The eight new
  ch8 emissions and the twelve new ch7 emissions produced zero SFX events and
  zero score events.
- Inside the hold, exactly one SFX fires: `terminalAdvance` at +1.765 s, the
  shipped `objective-enter` presentation cue for `ch8:launch:orbital-handoff`.
  That objective could not publish before this run, so this cue is the run's only
  audio delta, and it is the shipped one-shot cue for any objective publish, not
  a new sound.
- From +2.0 s through the +17.0 s advance the census reads
  `sfx-rate: quiet (last 3s)` — no SFX under any stack row, none under
  `CONTACT LOGGED.`, none under the designation caption, none under L6.
- `score.hit` is `null` for the full window across 77 samples.

Evidence: `evidence/verification/audio-window-census.json`,
`evidence/verification/ch8-window-av-score-trace.json`.

## Soak, variants, and performance

- Pure/OfflineAudioContext soak: not re-run — no audio code changed. The
  shipped soak result stands; the offline render mirror
  (`src/audio/soak/offlineRender.ts`) was exercised four times in this stage
  without error.
- Runtime soak: the ch8 window ran to completion 12 times across cold runs,
  variants, captures and reset probes with zero page errors and zero audio
  exceptions.
- Mobile/small-speaker intelligibility: not measured. No audio changed and no
  new cue exists to be intelligible; the mobile check this run owed was
  caption and audit-line legibility, which is in `screenshot-report.md`.
- Headphones/stereo image: not measured — no audio changed.
- Reduced sensory intensity: the reduced-motion pass produced an identical line
  sequence and identical offsets, and adds no audio.
- Score FPS/CPU/voice/node measurements: the implemented ch8 hold window itself
  holds a median 60.06 fps over five 3 s samples (minimum 60.03) at 1280x720
  LOW, and the three baseline beats measure 60.09 / 60.09 / 60.06 against
  baseline medians of 60.12 / 60.11 / 60.08. Evidence:
  `evidence/verification/fps-verification.json`.
- Replay, quit, focus, completion reset: the story-text and objective stores
  clear on quit-to-sandbox (audit null, caption null, objective null, zero
  emissions over 20 s), replay publishes a fresh beat with no window line
  replayed, a real pause freezes the story clock with zero drift and preserves
  every beat-runtime offset, and completion clears anchors with
  `lastResetReason` `beat-exit`. Evidence:
  `evidence/verification/quit-replay-trace.json`,
  `evidence/verification/pause-window-trace.json`,
  `evidence/verification/resets-trace.json`.

## Blocking gaps

- `none` for audio. Mobile small-speaker and stereo-image measurements were not
  taken because nothing on the audio path changed; recorded as deliberate
  non-measurement, not as an untested claim.

Overall status: `passed`

## M6/M7 owner-audition set — ch7 reconstruction variants (Score Director, 2026-08-11, sa-10)

Appended after the score audit's sa-10 finding (evidence asymmetry: the ch8
rulings carried four hashed WAVs while the ch7 rulings — including the open
M6 commitment-vs-watchedness owner taste question — had zero renders to
listen to). Read-only, additive evidence; no audio path touched.

Method: the shipped offline mirror (`renderStoryBeatOffline`) with the
`surface` legacy scene driven alongside the score (combined music bus;
streamed stems silent offline, so live loudness ≥ measured), era 1
(emergent/alive — what the player hears in ch7). Each variant is applied
through the exact shipped authority surface
(`setStoryScoreMoodOverride('ch7-reconstruct', getChapter7ReconstructionScoreMood(v))`)
and rests at its own gameplay-derived baseline — no synthetic intensity ramp,
because signed score intensity is excluded for ch7 by name. 24 s per variant.
Probe: `score-ch7-variants-probe.mjs` (run folder); analysis:
`evidence/score-ch7-variants-analysis.json`
(sha256 `a335735a3ad181c44ee124656731805a06af892693491fb18a42f31309977feb`).

| Variant | File | RMS dBFS | Peak | SHA-256 |
| --- | --- | --- | --- | --- |
| diagnosis | `evidence/score-ch7-variant_diagnosis.wav` | −32.41 | 0.074 | `6cf9fcffebc2b309ff5a4957e350e8c9effe5c1c3de05fee6b807611b3a68566` |
| bench | `evidence/score-ch7-variant_bench.wav` | −30.74 | 0.093 | `b4b4f91fd605307463023857c80a0964b51658a75d2fb9affe600a12f5733038` |
| frame | `evidence/score-ch7-variant_frame.wav` | −27.51 | 0.130 | `fa7d00d5052cfb95101fc9aa971010f9ddaac25f305b898d406d13ce5ef1c4a4` |
| hull | `evidence/score-ch7-variant_hull.wav` | −25.41 | 0.208 | `b8d80716a56933541cc9216e92a058bf26339640418df06b4b6f630ed91f3b96` |
| lift | `evidence/score-ch7-variant_lift.wav` | −23.03 | 0.253 | `80066574acae8bd16e4bb667dc60e99da003b8fa2be71f54f42d1f223d75abb0` |
| hover | `evidence/score-ch7-variant_hover.wav` | −22.92 | 0.257 | `5962821d44e5d6d9df71ed938692d1adac7e2c7c626d0fde5822a2c5bd704984` |
| route (M6) | `evidence/score-ch7-variant_route.wav` | −21.98 | 0.312 | `ee04579e533d33e2607f6085fa4a78f1ae344c3d474af94826ddbe792ef07a11` |
| calibration (M7) | `evidence/score-ch7-variant_calibration.wav` | −21.99 | 0.312 | `d6f93c85c5147bd7b08fc5cf03528089180705e356488973975d7f62cbcc24ce` |

Health: all eight renders finite and unclipped (`clipCount: 0`,
`nanCount: 0`). The measured ladder is itself audition guidance: a monotonic
accretion from −32.41 (diagnosis — the bare state under the bracket-fall) to
−21.98 (route — the chapter's one genuine swell, the M6 taste question), with
route and calibration level-matched at −21.98/−21.99 dBFS — calibration
changes color (the unresolved added-semitone field under M7), not weight,
exactly as the treatment ruled. For the M6 question, listen to `lift` → `route`
back-to-back (the swell as commitment) and then `route` → `calibration` (the
watchedness answer arriving as harmony, not level). All nine files are
registered in `evidence-registry.json`.
