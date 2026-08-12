# Screenshot Report — ch10 station introduction, draft-v7 final evidence pass

Contract: `scene-contract.json` draft-v7,
sha `32122245bf6b6630c4228da65204db2c6422e9ddb3a446c63ee6990986626860`.
Frames read by the verifier. Unambiguous defects only; composition band misses
are recorded in `verification-report.json`, not here.

## What was regenerated this pass

| Strip | Frames | Triggers hit | Page errors | Source |
| --- | --- | --- | --- | --- |
| `strip-transit-a` | 8 | 4/4 | 0 | fresh post-fix flight |
| `strip-transit-b` | 8 | 6/6 | 0 | fresh post-fix flight |
| `strip-rm-transit` | 8 | 5/5 | 0 | fresh post-fix flight, reduced motion |
| `still-seam-of-light.png` | 1 | latch-armed | 0 | fresh, HIGH |
| `still-seam-of-light-low.png` | 1 | latch-armed | 0 | fresh, LOW pair |
| `still-station-resolved.png` | 1 | handback-armed | 0 | fresh, HIGH |

Carried unchanged from draft-v6: `strip-cold-a`, `strip-cold-b`, `strip-ask-a`,
`strip-ask-b`, `strip-st0-crossing`, `still-st0-sighting.png`.

## Defects

**S-1 · cockpit rig recedes at closing speed · every fresh transit strip.**
At closing speeds above roughly 190 u/s the delivered frame shows the cockpit
shell floating inside the viewport with open starfield visible past its left and
right outer edges, at roughly 45 % of its seated width. It returns to seated as
the ship decelerates. This is a delivered-frame defect only: measured inside the
same instant, the render camera's fov equals the flight-feedback fov exactly
(max divergence 0.0000 deg over 24 frames), the cockpit shell carries the exact
reciprocal scale (1.17727 at fov 79, 1.03761 at fov 72, 1.00000 at fov 70), and
the geometric aperture is 613–789 px — the seated value. Reproduced in fresh
post-fix flights, so it is not a stale artifact.

- receded: `evidence/capture/strip-transit-a/05_seam-at_ch10-transit.png`
  (290 u/s), `strip-transit-a/03_T2-hold-marker_ch10-transit.png`,
  `strip-rm-transit/01_seam-at_ch10-transit.png` (reduced motion, fov 72 — so
  the boost fov alone does not explain it)
- seated: `evidence/capture/strip-transit-b/07_threshold-handback-after_done.png`
  (7 u/s), `still-station-resolved.png`, `still-seam-of-light.png`

**S-2 · a bright lit disc sits inside the canopy aperture on both fresh hero
stills.** `still-seam-of-light.png` at approximately (875, 400) and
`still-station-resolved.png` at approximately (905, 390). The name-projection
test reports zero named companions in frame on both, so the two readings
disagree; the pixels are what the audience sees. No `GalaxyImpostor` is in
either aperture.

**S-3 · `still-st0-sighting.png` is unchanged and still stages at the Kestrel.**
No hearth in frame, `[F] Enter Ship` pill, objective card, waypoint chip and
SUIT HUD all present. Not re-shot this pass.

## Anchor coverage

Every frame in the three regenerated strips is event-triggered off anchor
history or a flight fact, never off a fixed wait. Anchors imaged this pass:
`anc.ch10.transit-ignite` (before, at, after), `anc.ch10.seam-of-light`
(before, at, after, and both hero stills at the latch),
`anc.ch10.station-resolved` (before, at), `anc.ch10.threshold-handback`
(at, after, plus the cut-line hero still on the first frame after it). The
carried strips cover `anc.ch10.cold-noticed`, `anc.ch10.fault-read`,
`anc.ch10.fabrication-refused`, `anc.ch10.relay-ask`, `anc.ch10.relay-answer`
and `anc.ch10.bearing-claimed`.

## Desktop, mobile, reduced motion and quality tiers

- Desktop 1280x720 DPR 1: all 24 regenerated frames and all three hero stills.
- Reduced motion: `strip-rm-transit` regenerated in full at LOW; the same eight
  states, the same anchor order, render camera fov 72 rather than 79 at the
  seam and 70 at the cut line, exactly as the reduced-motion fov cap declares.
  Defect S-1 appears in reduced motion too, so it is not a boost-fov artifact.
- Mobile 390x844 POTATO: state traces only, per the evidence budget. Raw
  measurement, reported without a band because Cinematography has flagged the
  mobile occupancy figure as needing re-derivation: the cockpit rig occupies
  43.58 % of frame area at `ch10-ask` and 38.83 % at `ch10-transit`.
- Quality tiers: HIGH, MEDIUM with reduced motion, LOW and mobile POTATO all
  reach the ch10-transit rung with the same marker label and the same
  applied fov 70; frame strips remain LOW only, per the locked budget.

## Explicitly checked and clean

- No blank, black or torn frames in any of the 24 regenerated frames.
- No letterbox and no scanline artifact anywhere.
- No one-frame glimpse of a wrong era.
- No cyan hexagonal berth ring in `still-station-resolved.png` or in any
  transit strip frame; the dock's own jamb, lit mouth and inner glow are intact.
- The cut-line frame carries K11 lower-centre with the objective card gone:
  `still-station-resolved.png`, `strip-transit-b/05_work-order-cleared_done.png`.
- Every HUD element the captions and work orders reference is present in its
  frame: `ISSUING STATION · RESOLVING` with `THE SOURCE IS RESOLVING. / HOLD.`,
  `KESTREL HATCH · REBOARD` with `RETURN TO THE KESTREL. / FOLLOW THE HATCH
  MARKER AND [F] BOARD.`
- Beat labels in filenames match the live `window.__storyBeat` at capture on all
  24 frames, and every frame's flight facts were recorded with it, so a grounded
  frame cannot be filed under an airborne label.
