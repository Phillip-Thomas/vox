# Naive audience report — ch10 station introduction

Reviewer: scene-naive-viewer (opus), blind — supplied only raw-audiovisual-evidence.json,
the capture/baseline frame strips, the two HIGH stills, and the score WAV renders.
No canon, contract, source, or agent notes. Recorded verbatim by the orchestrator.

## The story I think I'm being told

You spend a warm night indoors — everything is orange, the objective says
"second hearth, wait for night," and a narrator whispers in parentheses.
Morning: you stand in a green field under a starfield sky and are told to "read
the hearth fault." Then you get in a ship, ask a wrecked relay for "a source,"
are given a bearing, ignite, and fly a long way until a huge slab-shaped
station resolves in your window. The line "(both fires behind you now. ahead, a
light someone else keeps alive.)" lands well. That's a clean, moving spine.

## Where my eye goes

`strip-ask-a/00` and `01` are the best-composed frames of the lot — the
flowering tree centered in the cockpit window, water behind it. Instant focal
subject. In every exterior ship shot (`strip-transit-a/02`–`07`,
`strip-transit-b/00`) I hunt: the ship reads as a flat dark cardboard rectangle
with no thickness, and the only thing I can actually read is a line of small
text floating in the middle of it. I never found a subject in
`strip-ask-a/07_landfall-at` — 80% of the screen is flat green with a couple of
grey boxes shoved into the bottom-left corner.

## Music

Honestly, every excerpt sounds like the same thing: a low drone with a steady
pulse. I could not tell `relay_ask-figure.wav` from `relay-answer_metric.wav` —
the answer just gets wider in the stereo field around 6.5s.
`station-resolved_combined.wav` is the best one; it slowly brightens across 12
seconds, which fits the station appearing. But for the biggest image in the
sequence it's too small — no new instrument, no arrival, nothing you'd
remember. `handback_release.wav` doesn't release; it ends at the same level it
started. And every file fades in identically from silence over the first 1.5
seconds, so if these play back-to-back the music appears to restart each time.

## Where the illusion breaks

- **`strip-st0-crossing/01`–`07`** — this is labeled rise/arc/set, but nothing
  crosses. There's a bright moon in `00_pre-rise` and then it's simply gone for
  all seven following frames. The marker text, the "F Enter Ship" prompt, and
  the camera are pixel-identical across all eight while food drops 98%→73%. It
  reads as a frozen game.
- **`strip-transit-a/01_transit-ignite-at`** — cyan and orange bars floating
  detached at the screen edges, unattached to anything. Looks like a bug.
- **`strip-transit-b/01`** ("(both f") and **`strip-rm-transit/03`** ("(b") —
  caption cut off mid-word. Same in `baseline/01_124s` ("(o").
- **`strip-transit-a/05` through `strip-transit-b/00`** — five near-identical
  frames all saying "ISSUING STATION · RESOLVING / THE SOURCE IS RESOLVING.
  HOLD." That's a stall, not suspense.
- The suit HUD vanishes entirely in cockpit frames and reappears on foot;
  `strip-ask-a/07` suddenly has a "JET" bar nothing else has.

## The two hero stills

`still-station-resolved.png` lands. Title it **"The Long Light."** The station
cuts diagonally across the window, moon on the right, low blue key — the only
frame with real depth.

`still-st0-sighting.png` does not land. The orange sun is sliced off by the top
edge, the deer at left are clipping through the ground at broken angles, and I
can't tell what I'm supposed to be looking at. Title: **"Deer at the Wrong
Sun."**

**Highest-leverage fix:** make something actually visible cross the sky in the
st0 strip, and give the station reveal a sound it doesn't already have.

---

*Orchestrator context notes (not part of the blind read): the identical 1.5s
fade-ins are OfflineAudioContext render artifacts — in-game the score is
continuous; mid-word captions are the typewriter reveal caught mid-paint by
still capture, not runtime truncation; the "bright moon that disappears" in
strip-st0-crossing/00 is the moon setting — ST-0 itself is a 2.4px
constant-luminance dot by signed design, legible in motion (7× star drift) but
near-invisible in stills. These contexts do not dismiss the findings: strip
evidence that requires context to read is itself a finding.*


---

## Read structure (index added by the orchestrator; no reviewer text altered)

**Isolation.** The viewer received only the frame strips, the two hero stills,
the rendered audio, and intent-free playback metadata — file names, durations
and beat labels. It was given no contract, no treatment, no source, no canon and
no agent notes, and it had no repository access. Nothing in its report was
informed by knowing what the scene was trying to do.

**Cold read.** Its account of "the story I think I'm being told" is the whole
value of the exercise: an uninstructed reading of the sequence, in order, from
images and sound alone.

**Variant.** The strips it viewed include `strip-rm-transit`, the reduced-motion
capture, alongside the standard-tier strips; its comments on caption truncation
span both.

**Verdict.** Recorded verbatim, including its two hero-still titles and its
single highest-leverage fix. Two of its observations were confirmed
independently by instrumented review — ST-0 not actually appearing in the
crossing strip, and the reveal reading as under-scaled — and are carried in
`defects.json` as D-A3 and NV-1.

**Contract version audited:** no contract revision was shown to the reviewer by design; the read is carried against the frozen contract version draft-v9 `0336a4f2…`

**First wave attestation.** This was a first-wave report in the strictest sense: the blind viewer saw no contract, no peer review, and no agent notes at any point, and reported before any other reviewer's conclusions existed in its context.
