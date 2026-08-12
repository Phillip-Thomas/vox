# Screenshot report

Stamp pass, 2026-08-12. Contract draft-v6, sha
`4202e38b3a595cae5b39bf65cf6ec0603892bf4046a420db0d96362eeb883c94`.

Scanned 75 PNGs (64 LOW strip frames across 8 strips, 3 HIGH stills, 8 Stage-1
baseline frames) for blank/black frames, flat no-contrast frames, no-variation
frames and missing HUD. Scan output:
`evidence/verification/frame-defect-scan.json`.

Unambiguous defects only. Composition, pacing and beauty are not judged here.

## Signal-level defects

- None. No blank, black, flat or no-variation frame across all 75 PNGs. Every
  frame carries its HUD and carries an objective card wherever the trace says
  one was standing. Zero page errors during any capture in this pass.

## Unambiguous content defects

- **None outstanding.** The previous round's one content defect — 24 stale
  transit frames naming states that were not in them — is closed. All three
  strips were recaptured from post-fix flights this pass and every stale hash
  is purged from `evidence-registry.json`.

## Frames recaptured this pass

### `evidence/capture/strip-transit-a/` — 8 of 8, all triggers hit

Event-triggered off anchor history and flight facts, with a rolling previous
frame so `-before` is the last frame that existed before the predicate flipped.
Phase and station range are recorded per frame, so a grounded frame can no
longer be filed under an airborne label.

| frame | phase | station range |
| --- | --- | --- |
| `00_transit-ignite-before` | surface | 6,637 |
| `01_transit-ignite-at` | descent | 6,630 |
| `02_transit-ignite-after` | deep_space | 6,187 |
| `03_T2-hold-marker` | deep_space | 6,140 |
| `04_seam-before` | deep_space | 5,260 |
| `05_seam-at` | deep_space | 5,153 |
| `06_seam-after` | deep_space | 4,284 |
| `07_galaxy-absence-check` | deep_space | 3,155 |

Read by eye: `00` is the grounded cockpit with the T1 card standing verbatim
(`KESTREL FLIGHT CONTROLS · IGNITE` / `BRING THE KESTREL ONLINE.` / `HOLD
[SPACE] TO IGNITE AND LIFT.`) — correctly grounded under a `-before` label.
`02` is airborne in deep space with the marker chrome reading `issued bearing ·
hold · 6182m` against the HUD's `ISSUED BEARING · HOLD`: exact label parity.
`05` carries the amber seam whole at first appearance in the canopy aperture,
with the T3 card `ISSUING STATION · RESOLVING` / `THE SOURCE IS RESOLVING.` /
`HOLD.` and no marker chrome, which is correct for a `requiresMarker: false`
rung.

### `evidence/capture/strip-transit-b/` — 8 of 8, all triggers hit

`00_station-resolved-before` 1,526 → `07_threshold-handback-after` 971, all
`deep_space`. `01_station-resolved-at` at 1,426 shows the station spine in the
aperture with K11 beginning to paint. `05_work-order-cleared` (beat `done`) is
the cut-line state at LOW: K11 painted lower-center, no objective card, and the
free-flight HUD returned (`ORBITAL SCAN`, `MODE LOCAL SPACE`, `VELOCITY 61 U/S`,
`THRUST +0%`) — the control hand-back is visible in the frame, not just the
trace. The beat stamp flips to `done` from `03` onward, which is the hand-back
and is stamped honestly.

### `evidence/capture/strip-rm-transit/` — 8 of 8, all triggers hit

Reduced motion, same lane: seam before/at/after, resolve, hold mid, hold
release, hand-back at and after. `03_station-resolved` at 1,475 is frame-for-
frame comparable with the non-reduced-motion strip's `01` at 1,426; the station
is framed identically, which is the visible half of the FOV-70 parity the traces
measure.

### `evidence/capture/still-station-resolved.png` — re-staged at the draft-v6 cut line

Real HIGH, 17.4 s of HIGH warm before the shutter. Armed in page on rAF and shot
on the first frame after `anc.ch10.threshold-handback` with K11 painted and the
work order cleared; 11 frames and 14 units of closure between arm and shutter.

- range at shutter **1,084** against the 1,000–1,300 term — in spec
- camera FOV **70.0002** against the FOV 70 term — in spec
- K11 painted, work order cleared, `objectiveId` null — in spec
- no GalaxyImpostor in the aperture, zero companion-body meshes in frustum

Two terms miss, both measured:

1. **Spine width.** Hull pixel extent runs x=415 to x=775 of 1280: 28.1% of
   frame width horizontally, 31.8% along the on-screen spine, against a 38–47%
   term. At FOV 70 and 16:9 an 830-unit spine subtends at most 30.8% of frame
   width at range 1,084 and at most 33.3% at the 1,000 floor, so the range term
   and the spine term cannot both be met without a lens or range change.
2. **A lit spherical body** renders at roughly (905, 390), luma up to 247.9,
   against "no galaxy, planet or home fire in frame". No companion-body mesh is
   in frustum, so this body is drawn by the sky layer rather than by
   `SystemCompanionBodies`.

### `evidence/capture/still-st0-sighting.png` — re-staged with the yaw locked

Real HIGH, 33.8 s of HIGH warm, deep night (daylight 0), ST-0 at full opacity,
shutter on the crossing maximum (altitude 16.021° against a tracked peak of
16.321°). The aim is an in-page rAF closed loop on the shipped look handler,
throttled to one damped step per 100 ms and still running at the shutter.

- yaw error at the shutter **0.293°** against a ±2° term (4.637° last round)
- yaw offset applied **10°**, at the limit of the ≤±10° moon-exclusion envelope
- pitch error **+0.283°** against `peak − 15°`
- FOV **75**
- ST-0 on the upper-third line to **4.72%** of frame height, against ±5%
- ST-0 renders at the predicted pixel (519, 206) as a single amber point, local
  max luma 130.7 against a surrounding sky max of 63.6: sub-moon, above the
  brightest star, not a disc
- the one companion body in frustum sits **6.1° below the horizon** and its
  screen position lands on terrain pixels (RGB 133,164,121), so it is occluded
  and not visible; the in-frustum flag is a frustum test, not a visibility test

Two terms miss, both measured:

1. **A sky-drawn celestial disc** near the top of frame at roughly +35°
   altitude, luma up to 207.2 — brighter than ST-0's 130.7. It is not a
   companion-body mesh and not ST-0.
2. **Camera standpoint.** The camera stands at the Kestrel rather than outdoors
   at the hearth, so terrain occupies about the bottom third of frame rather
   than the bottom 20%.

## Frames carried unchanged

`strip-cold-a`, `strip-cold-b`, `strip-ask-a`, `strip-ask-b`,
`strip-st0-crossing` and `still-seam-of-light.png` were not in this pass's
scope. `still-seam-of-light.png` carries forward its known deviation: a real
HIGH airborne cockpit frame with no galaxy in the aperture, but the 30 s HIGH
settle let the flight run past the seam, so the frame shows the resolved station
rather than the seam at anchor+0.

## Evidence budget

64 LOW strip frames against a cap of 64; 3 HIGH stills against a cap of 3; zero
movie renders of any kind. The movie lane is proven by autopilot state traces at
LOW: one end-to-end cold run, four marker-invariant cold paths, three strip
flights and two of the four variant profiles, with zero timeout rescues in any
of them.
