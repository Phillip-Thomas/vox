# Screenshot Report — ch10 station introduction, draft-v9 final capture pass

Contract: `scene-contract.json` draft-v9,
sha `0336a4f28bfaa874fffc300f02999e329dbed86d3cdcd53cf7ce3261c48639b1`.

Frames read by the verifier. Mechanical defects only — black or torn frames,
missing HUD, corrupt or unreadable output, and instrument/pixel disagreement.
Composition, occupancy and staging verdicts live in `verification-report.json`
and in the cinematography and naive-viewer reports; they are not repeated here.

## What was captured this pass

| Still | Tier | Shutter fact | Page errors | Scene pair |
| --- | --- | --- | --- | --- |
| `still-seam-of-light.png` | HIGH | latched at range 5154, render fov 70 | 0 | `still-seam-of-light-scene.png` |
| `still-seam-of-light-low.png` | LOW | latched at range 5168, render fov 70 | 0 | `still-seam-of-light-low-scene.png` |
| `still-station-resolved.png` | HIGH | cut line at range 1421, render fov 70 | 0 | `still-station-resolved-scene.png` |
| `still-st0-sighting.png` | HIGH | night, hearth core at 6.8 m, render fov 75 | 0 | `still-st0-sighting-scene.png` |

Each `-scene` file is the same frame re-shot with the HUD layer suppressed
(`uiHidden` 6 on the seam pair, 6 on the cut line, 6 on the ST-0 still); the
measurement passes in `evidence/verification/ch10-v9-frames.json` run on the
`-scene` bytes, not on the delivered frame.

No frame strip was regenerated in this pass. Strips on disk and carried
unchanged: `strip-cold-a`, `strip-cold-b`, `strip-ask-a`, `strip-ask-b`,
`strip-transit-a`, `strip-transit-b`, `strip-rm-transit`, `strip-st0-crossing`,
`strip-st0-nightdwell`, and `lens-divergence`.

## Defects

**S-1 · the LOW seam still delivers the cockpit rig inset inside the frame; the
HIGH still of the same anchor does not.** Both stills are the declared tier pair
for `anc.ch10.seam-of-light`, both latched inside the 5100–5200 range spec, both
at render camera fov 70. The 2 px border ring of the delivered frame reads peak
luminance 19.6 on `still-seam-of-light.png` and 114.7 on
`still-seam-of-light-low.png` (`ch10-v9-frames.json` → `borderRing`). Read as
pixels: on the LOW frame the canopy structure stops short of the frame edge and
open scene is visible past its left, right and top outer edges; on the HIGH
frame the rig reaches the frame edge. Same anchor, same declared fov, different
delivered framing between tiers.

- inset: `evidence/capture/still-seam-of-light-low.png`,
  `evidence/capture/still-seam-of-light-low-scene.png`
- seated: `evidence/capture/still-seam-of-light.png`,
  `evidence/capture/still-station-resolved.png`

**S-2 · instrument and pixels disagree about a bright lit disc inside the canopy
aperture.** `still-seam-of-light.png` and `still-station-resolved.png` both
carry a bright, soft-edged disc at approximately (900, 440), and the LOW pair
carries the same feature at approximately (940, 410). At the same instant
`ch10-v9-cutline.json` → `still` reports `galaxyInFrame: 0` and
`companionsInFrame: 0`. The two readings cannot both be describing the frame;
attribution of the source is unresolved by any trace in this run.

## Explicitly checked and clean

- All 118 PNGs in `evidence/` decode under ffprobe and none is a black or
  near-black frame (per-frame `YMAX` 232–253 on the four draft-v9 stills; no
  frame in the run scores `YMAX < 32` or mean luminance `< 1.0`).
- All eight draft-v9 stills are `png_pipe` / `png` / 1280x720 / `rgb24`, byte
  sizes 219 824–1 078 086, no truncation or partial write.
- Zero page errors across all six draft-v9 browser traces
  (`ch10-v9-{cutline,e2e,gaze,seam,st0still,transit}.json`).
- HUD elements the copy references are present in each delivered frame:
  - `still-seam-of-light.png` and `still-seam-of-light-low.png` carry the
    objective card `CURRENT OBJECTIVE / ISSUING STATION · RESOLVING / THE SOURCE
    IS RESOLVING. / HOLD.`
  - `still-station-resolved.png` carries the caption `(both fires behind you
    now. ahead, a light someone else keeps alive.)`, the orbital-scan panel and
    the flight readout (`MODE LOCAL SPACE`, `VELOCITY 13 U/S`, `THRUST +0%`,
    `DRIVE NOMINAL`), with the objective card correctly gone at
    `resetReason: completion` and `objectiveId: null`.
  - `still-st0-sighting.png` carries `CURRENT OBJECTIVE / HABITAT CORE · READ
    THE FAULT / STAND AT THE SECOND HEARTH CORE. / [F] READ THE HEARTH FAULT.`,
    the waypoint chip `habitat core · read the fault · 45m`, the SUIT HUD and
    the inventory pill. No `[F] Enter Ship` prompt
    (`interactionPromptActive: false`).
- No letterbox band and no scanline artifact on any of the eight stills.
- No one-frame glimpse of a wrong era: the seam and cut-line stills are shot on
  separate flights (seam Z 5164, cut line Z 1426) yet three warm clusters are
  pixel-identical across them (`cameraRigid: true` on all three pairs), so the
  two frames share one camera and one era.
- No cyan hexagonal berth ring in `still-station-resolved.png`.
- Beat labels agree with the live state read at the shutter: `ch10-transit` for
  the seam pair, `done` for the cut line, `ch10-cold` for the ST-0 still.

## Anchor, viewport, reduced motion and quality tier coverage

Anchors imaged by the draft-v9 stills: `anc.ch10.seam-of-light` (HIGH and LOW
pair, both latched inside the declared 5100–5200 range), `anc.ch10.station-resolved`
and `anc.ch10.threshold-handback` (the cut-line still on the first frame after
the handback, `resetReason: completion`), and `anc.ch10.cold-noticed` /
`anc.ch10.fault-read` (the ST-0 still at the hearth core with the fault-read
objective live). The remaining anchors — `anc.ch10.fabrication-refused`,
`anc.ch10.relay-ask`, `anc.ch10.relay-answer`, `anc.ch10.bearing-claimed`,
`anc.ch10.transit-ignite` — are imaged only by the carried strips
(`strip-cold-a`, `strip-cold-b`, `strip-ask-a`, `strip-ask-b`,
`strip-transit-a`, `strip-transit-b`), not re-shot this pass.

- Desktop: all eight draft-v9 stills are 1280x720 at DPR 1. No other viewport
  was captured as pixels in this pass.
- Mobile: no mobile frame was captured in the draft-v9 pass. The mobile
  evidence in this run is the carried POTATO state trace in
  `evidence/verification/ch10-v7-variants.json`, plus
  `evidence/capture/lens-divergence/potato_*.png`; both predate draft-v9.
- Reduced motion: no reduced-motion frame was captured in the draft-v9 pass.
  The carried reduced-motion strip is `evidence/capture/strip-rm-transit`
  (8 frames, LOW) with `evidence/capture/lens-divergence/medium-rm_*.png`.
- Quality tiers: the seam anchor is the only draft-v9 anchor with a tier pair
  (HIGH and LOW), and the two frames diverge — see defect S-1. The cut-line and
  ST-0 stills were captured at HIGH only. The four-tier ladder
  (HIGH / MEDIUM+reduced-motion / LOW / POTATO) exists only in the carried
  `lens-divergence` set and in `ch10-v7-variants.json`.

## Not read in this pass

`evidence/capture/strip-st0-nightdwell/*.png` and
`evidence/verification/ch10-v9-nightdwell.json` exist on disk from an earlier
leg of the draft-v9 sequence and are outside this bounded stamp; they are not
registered in `evidence-registry.json`.
