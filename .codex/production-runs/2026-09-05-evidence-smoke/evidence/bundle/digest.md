# digest — ch10@movie

All timing, order, frequency and causality questions are answered HERE; frames are for shape, color, composition, light.

Capture: hardware-high (ANGLE (NVIDIA Corporation, NVIDIA GB10/PCIe, OpenGL 4.5.0)), headed, 1280x720, clock=autopilot-beat-clock, build=b631a52

## Beat timeline (story clock, seconds)
- t=4.80s beat=ch10-ask (frame 0)
- t=30.20s beat=ch10-transit (frame 9)

## Objective / caption changes
- t=4.80s objective=station:return:crossing (frame 0)
- t=4.80s caption="(the channel at the wreck never closed. asking is still a thing that can be done" (frame 0)
- t=14.40s objective=station:return:landfall (frame 4)
- t=25.80s objective=station:bearing-claim (frame 7)
- t=25.80s caption="(i" (frame 7)
- t=26.20s caption="(issued, not of" (frame 8)
- t=30.20s objective=station:transit:hold (frame 9)
- t=30.20s caption="(issued, not offered. the going is still yours.)" (frame 9)
- t=52.90s objective=station:transit:resolve (frame 20)

## Signed-AV anchors
- t=25.80s anchor=anc.ch10.bearing-claimed (frame 7)
- t=30.20s anchor=anc.ch10.transit-ignite (frame 9)
- t=52.90s anchor=anc.ch10.seam-of-light (frame 20)

## Frames: 23 (0 blank)
Captured-frame telemetry (idx | t | role | label | beat | meanLuma | blank):
  0 | 4.80 | still | opening-2.0s | ch10-ask | 0.0639 | false
  1 | 5.20 | burst | burst-entry | ch10-ask | 0.0631 | false
  2 | 9.40 | temporal | strip | ch10-ask | 0.0645 | false
  3 | 13.40 | temporal | strip | ch10-ask | 0.0948 | false
  4 | 14.40 | trigger | objective-change | ch10-ask | 0.217 | false
  5 | 17.60 | temporal | strip | ch10-ask | 0.1652 | false
  6 | 21.70 | temporal | strip | ch10-ask | 0.2334 | false
  7 | 25.80 | trigger | caption-first | ch10-ask | 0.4824 | false
  8 | 26.20 | temporal | strip | ch10-ask | 0.4779 | false
  9 | 30.20 | temporal | strip | ch10-transit | 0.3024 | false
  10 | 30.60 | burst | burst-entry | ch10-transit | 0.302 | false
  11 | 30.90 | burst | burst-entry | ch10-transit | 0.3012 | false
  12 | 31.40 | burst | burst-entry | ch10-transit | 0.3011 | false
  13 | 31.80 | burst | burst-entry | ch10-transit | 0.3013 | false
  14 | 32.20 | burst | burst-entry | ch10-transit | 0.3016 | false
  15 | 32.60 | burst | burst-entry | ch10-transit | 0.3021 | false
  16 | 36.70 | temporal | strip | ch10-transit | 0.0705 | false
  17 | 40.80 | temporal | strip | ch10-transit | 0.0709 | false
  18 | 44.80 | temporal | strip | ch10-transit | 0.0704 | false
  19 | 48.90 | temporal | strip | ch10-transit | 0.0704 | false
  20 | 52.90 | temporal | strip | ch10-transit | 0.0698 | false
  21 | 57.00 | temporal | strip | ch10-transit | 0.0695 | false
  22 | 61.10 | temporal | strip | ch10-transit | 0.0688 | false

## Adjacent-frame bursts (consecutive frames at the capture cadence, at declared hotspots)
Smooth motion: adjacent delta ~ net drift per frame (flickerRatio near 1). Oscillation/flicker: large adjacent deltas that cancel (high ratio + high signFlips).
BURST @t=30.60s (frames 10-15, 527ms apart): meanAdjDelta=0.0023 netPerFrame=0.0009 flickerRatio=2.6 signFlips=0.75 changed=0.01 pops=0 → FLICKER

## ch10-cold
23 frames, 1 bursts, exit milestone story:ch10-fabrication-refused NOT reached; page errors: 0
