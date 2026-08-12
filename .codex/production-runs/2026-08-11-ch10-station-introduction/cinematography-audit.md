# Cinematography Continuity Audit — ch10 station introduction

Reviewer: cinematography-continuity-auditor (opus), fresh, 2026-08-12
Authority: scene-contract.json draft-v6 `4202e38b…`; main/CINEMATOGRAPHY.md
Recorded verbatim by the orchestrator from the auditor's return.

## VERDICT: fail (blocking evidence-integrity; staging otherwise close)

## Defects (severity · category · owner)

**D-A1 · critical · lens identity · Integration.** The ch10 flight LOW strips
and the HIGH stills are not the same lens. Cockpit aperture: 705px wide in the
HIGH stills and in the shipped ch8 reference; **300px** in strip-transit-a/03,
05, strip-transit-b/01, strip-ask-a/04, strip-rm-transit/*. Moon disc ≥148px vs
54px. The whole render scales together ≈2.3–2.8×, so the cockpit rig is not
holding screen anchors — `flight.fov` and the render camera disagree, or the
rig is parented to a non-rendering camera. At LOW the seam, the resolve and the
cut line all play at less than half intended size inside a small floating
shell. Every aperture/seam-px/spine-% term was measured across both families.
The stamp pass's "FOV parity" read `appliedFovDeg` (asserted), which cannot see
this. Probe: log `camera.fov`, `getShipFlightFeedback().fov`, `gl.getSize()`,
`getPixelRatio()` per strip frame per profile.

**D-A2 · critical · shot grammar · Cinematography.** `still-seam-of-light.png`
is not the seam. `ch10-transit-captures.json`: range **955**, speed 0.1,
beat "done", seamPassed && stationResolved already true. It is a second resolve
frame — station fully bodied, moon + nebula in the aperture. The three-distance
thesis (dot→line→place) has **no line**. It carries no acceptance criterion in
verification-report.json. Re-shoot at the latch (~5,150).

**D-A3 · high · ST-0 evidence · Cinematography.** `ch10-gap-strip-st0.json`:
ST-0 `inFrustum:false` on 7 of 8 strip frames (arc-b-true-bearing ndc
[3.714,−3.437]; next-rise [297,−275]). Only 01_rise images it. inFrustumSamples
7/432. Canon item 26's repair lane (movie-only gaze bias) is triggered and
unimplemented; the strip proves the state machine, not the crossing.

**D-A4 · high · focal hierarchy · Cinematography.** ST-0 still: measured 136px
brighter than ST-0's 141.6 peak inside its own quadrant (max 217) — "above the
brightest star" is false as rendered. A large warm orange disc crowns the
frame, same hue family, ~50× the area. Camera at the Kestrel: no hearth, so
"dot and home in one frame" is absent; the [F] Enter Ship pill, objective card,
waypoint chip and SUIT HUD crowd it. (Note: the draft-v5 staging says camera at
the hearth — the capture violated its own spec.)

**D-A5 · high · color script · Cinematography.** Cut line: brightest values are
the moon (238) and three sky discs (248), not the amber rows; purple nebula
fills the right aperture (galaxyInFrame:false is a name test, not perceptual);
a **cyan hexagonal berth ring** sits below the dock against "no dock offer
geometry".

**D-A6 · medium · agency · Integration.** The 2.5s "thrust-cold hold" is
`setStoryMoveScale(0)` (emergentStoryDirector.ts:2022). Nothing in
ShipController.tsx reads `moveSpeedScale`; in manual flight nothing is
withheld. Movie-lane decel is the autopilot's `controls.forward=!atStandoff`.

**D-A7 · medium · doc drift · Cinematography.** shots[11] says spine ≈31%;
evidence.captures[10] says 38–47% — same contract. Shot blocking says "outside
CORRIDOR_RANGE 1,400" while its evidence term shoots at 1,000–1,300 (inside).
`arrivalStandoff()` is cited as staging and never called by ch10.

**D-A8 · medium · occlusion · Integration.** ST-0 quad: depthTest false,
depthWrite false, frustumCulled false, renderOrder 2, gated only on the
analytic horizon — it draws through ridges/shelter between that and the ~7°
terrain horizon. `st0ClampedPixels(ST0_MIN_PIXELS)` pins 2.4 forever;
ST0_MAX_PIXELS is dead.

## The two stamp-pass deviations weighed

- **Spine 31.8%:** the frame works, and 31.8% IS the contract's own shot term
  (~31%). The 38–47% evidence criterion is the error; honest replacement:
  *spine 28–34% of frame width at range 1,000–1,300, FOV 70*. Repair the term,
  not the staging — but only after D-A1, since the measurement's lens is
  unproven.
- **ST-0 still:** does NOT read. The bottom-third terrain is forgivable; the
  missing hearth and a bigger, warmer, brighter disc are not. Re-shoot, don't
  re-word.

## Continuity matrix (ch9-hearth → ch10 → done)

Lens: 75/70 declared coherently in the rail; broken in frames (D-A1). Palette:
fire-night → station amber consistent; focal accent not scarce (D-A5, D-A4).
Light/fog: one atmosphere. Screen direction: coherent; contract says spine
"upper-left→center-right", frame reads lower-left→upper-right. Focal subject:
legible at HIGH, not at LOW. Agency: no cuts, no forced looks — clean, except
D-A6. Score: anchors named, not seconds. Effect reset: reset-camera/grade/
lighting across eight triggers, resetAtHandback "completion" on all four
profiles.

## Protected strengths (do not "fix")

No cut and no letterbox anywhere; corridor instrument silence proven at 949
(canDock:false, 2 KeyF, zero advisory) and visible at 1,084; ST-0
anchorless/cueless/scoreless; the anchorless hero still; +1 draw call, 0 new
programs; the mandatory hand-back to a frame with no annotation.

## Evidence gaps

Player-driven transit capture (all flight evidence is movie=1); render-camera
FOV per strip frame; a seam frame at 5,150 at LOW and HIGH; ST-0 in-frustum arc
frames; ST-0-vs-brightest-star at LOW; isolated ST-0 FPS delta (57.3 vs 60.1
conflates night/noon).

## Single highest-leverage repair

Close **D-A1** first: instrument the render camera on every ch10 flight frame
at all four profiles. Until the LOW and HIGH families share one lens, every
composition verdict in verification-report.json — including the 31.8%
deviation — is unfounded.
