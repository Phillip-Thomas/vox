# Blind read of the final hero stills — 2026-08-12

Reviewer: scene-naive-viewer (opus), fresh instance, blind. Given only the three
final hero stills and the ST-0 night-dwell strip. No contract, no reports, no
source, no canon, no prior review. Commissioned on receipt of the cohesion
judgement to close its finding J-4 — that no independent eye had seen the
current stills, two of which changed materially after every review was filed.

Recorded verbatim by the orchestrator.

## What I see

`still-st0-sighting.png` — first-person night field. Bright green grass,
blue-black trees with pink specks, a herd of brown deer-like animals, purple
nebula sky. HUD: SUIT HUD stats, INV, objective card "HABITAT CORE · READ THE
FAULT", a 45m marker. A teal post is centered.

`still-seam-of-light.png` — cockpit interior, hexagonal window onto starfield.
Small dark wedge with red/white dots upper-center; big white moon lower-right;
cyan ring on console; blue and orange blocky props. Objective: "ISSUING STATION
· RESOLVING / THE SOURCE IS RESOLVING. HOLD."

`still-station-resolved.png` — same cockpit, same camera. The wedge is now a
long grey station with panels. ORBITAL SCAN panel top-right, MODE/VELOCITY bar
bottom, subtitle "(both fires behind you now. ahead, a light someone else keeps
alive.)"

## In order

2→3 is a clear progression: identical frame, object grows and resolves. 1→2 I
can't connect visually; nothing in image 1 reads as the same thing.

## The point of light — I cannot find it

My eye went (a) the lime-green ragged blob at ~x755,y405, (b) the HUD block,
(c) the deer. Measured: brightest sky pixel in the whole frame is the crosshair
(245,245,245); every star tops out ~225–230. No star is distinguished. The
green blob is not a light — it's a flat green ragged patch and reads as broken
art.

## Not a thin line of light

At 5× it's a solid dark-teal quadrilateral with a faint bluish streak and four
red plus two white dots — a small ship or lit hull. It reads as an object
already, which weakens image 3's reveal.

## Weak ending

Brightest thing is the moon, mean luminance 485 vs the station's 60 — roughly
8× brighter than the subject. My eye goes moon, then ORBITAL SCAN box, then the
station. The station is the dimmest large thing in its own final frame, and
gameplay chrome (scan panel, MODE bar) appearing here breaks the held-frame
feeling.

## Nothing moves

Disc centroid is 670.0,88.4 in frame 00 and 669.5,88.7 in frame 07 — sub-pixel
jitter. But its color strobes every other frame: RGB (180,88,30) on 00/02/04/06
and (250,193,111) on 01/03/05/07. That's a flicker, not motion.

## Bugs / unfinished

- `evidence/capture/still-st0-sighting.png` — green blob, ~x748–765/y398–412.
- `strip-st0-nightdwell/00–07_dwell_ch10-cold.png` — alternating-frame disc
  colour strobe.
- `still-station-resolved.png` — detached cyan wireframe brackets floating in
  space (~x600–750/y360–440) read as debug geometry.
- `still-seam-of-light.png` — orange lollipop and blue hammer props read as
  untextured primitives.

---

**Contract revision audited:** none shown to the reviewer, by design; the read
is carried against the frozen contract version draft-v9 `0336a4f2…`.

**First report completed before reading peer conclusions:** `yes`

## Orchestrator note

This read closes the judge's J-4 and independently corroborates its J-2 with
pixel measurements the judge did not have. It also raises four findings no
prior review or probe had produced, and it contradicts two claims the contract
currently makes: that the cut line is a frame with no annotation on it (an
ORBITAL SCAN panel, a MODE/VELOCITY bar and floating wireframe brackets are
present), and that the three-distance thesis reads dot → line → place (the
middle distance already reads as a solid object). The alternating-frame colour
strobe in the night-dwell strip is a rendering defect nobody had seen.

None of this was repaired. The run had already exceeded its repair-loop budget
and the judge had ruled `repair`; these findings are carried into the owner
packet rather than absorbed, because several of them — how bright ST-0 should
be, whether the moon belongs in the final frame at all — are taste decisions
that the Cinematography Director has already ruled on once, and a second ruling
against fresh contrary evidence is the owner's call, not a machine's.
