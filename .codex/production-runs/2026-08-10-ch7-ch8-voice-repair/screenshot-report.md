# Screenshot Report

Status: complete

Run: `2026-08-10-ch7-ch8-voice-repair` · Contract `draft-v2`
(`aa7ea1ac3f60ad2c130e3eaa07c45b204be4a27f6ab2897e2035aeb9552aca8a`) ·
Source revision `03e975a666767dd3d75fc339a3b3d61dfa755c4c`

All frames were captured against the canonical preview `http://localhost:5176`
with headless Chromium (`--enable-unsafe-swiftshader --use-gl=angle`) at the LOW
quality tier, except the POTATO variant set. 292 PNGs, all under
`evidence/verification/`.

## Capture method

Frames are anchored to the beat-runtime window origin, not to a probe wall
clock. The probe subscribes to the live story-text store, waits for the origin
emission (`UNSCHEDULED HULL · SITE 7C-θ · INTEREST RAISED` for ch7, the L4
caption for ch8), then opens each shutter against the game's own `storyNow()`
clock. A fixed +0.12 s shutter bias is applied because a latch fires on the
first director tick at or after its constant, so a shutter opened exactly on the
nominal offset can close before the emission; the bias stays well inside the
contract's 0.2 s tolerance and every frame records its measured offset in the
sidecar JSON. Each frame carries the live beat, the store caption, the store
audit line with its header, the active objective, the DOM rectangles for
caption/audit/HUD, `data-caption-placement`, and the viewport.

## ch8 hold cadence — `cap.ch8.hold-cadence`

Directory: `evidence/verification/ch8-captures-desktop/`
Sidecar: `evidence/verification/ch8-captures-desktop.json`

| Nominal | Measured | Frame | Beat | Regulation band | Awakening caption |
| --- | --- | --- | --- | --- | --- |
| +0.0 | +0.119 | `off_0p0s_ch8-launch.png` | ch8-launch | empty | L4 revealing |
| +1.2 | +1.316 | `off_1p2s_ch8-launch.png` | ch8-launch | empty | L4 fully revealed |
| +2.0 | +2.120 | `off_2p0s_ch8-launch.png` | ch8-launch | AUDIT NETWORK · stack row 1 | L4 |
| +4.0 | +4.115 | `off_4p0s_ch8-launch.png` | ch8-launch | AUDIT NETWORK · stack row 2 | L4 |
| +6.0 | +6.114 | `off_6p0s_ch8-launch.png` | ch8-launch | AUDIT NETWORK · stack row 3 | expired |
| +8.5 | +8.617 | `off_8p5s_ch8-launch.png` | ch8-launch | AUDIT NETWORK · CONTACT LOGGED. | empty |
| +9.7 | +9.814 | `off_9p7s_ch8-launch.png` | ch8-launch | CONTACT LOGGED. fully revealed | empty |
| +11.5 | +11.617 | `off_11p5s_ch8-launch.png` | ch8-launch | CONTACT LOGGED. | designation revealing |
| +12.7 | +12.819 | `off_12p7s_ch8-launch.png` | ch8-launch | CONTACT LOGGED. | designation fully revealed |
| +14.0 | +14.119 | `off_14p0s_ch8-launch.png` | ch8-launch | CONTACT LOGGED. | L6 revealing |
| +15.2 | +15.318 | `off_15p2s_ch8-launch.png` | ch8-launch | **visibly empty** (faded to zero opacity) | L6 |
| +17.0 | +17.119 | `off_17p0s_ch8-launch.png` | ch8-crossing | empty | ch8-crossing entry caption |
| +18.0 | +18.119 | `off_18p0s_ch8-crossing.png` | ch8-crossing | empty | entry caption, SIBLING WORLD objective, marker resolved |

Read result: no blank or black frame, no era pop, no letterbox or scanline
artifact, no missing HUD element that a caption references. The +15.2 s frame is
the contract's "regulation band visibly empty from +15.0 s" proof: the audit
pill's own fade reaches zero opacity at exactly +15.0 s and the frame shows an
empty band with L6 revealing beneath. The +18.0 s frame is the advance seam:
ch8-crossing entered, objective card reads SIBLING WORLD, the sibling-world
marker is on screen at 6159 m, nothing from the previous beat leaks.

## ch7 exit cadence — `cap.ch7.exit-window`

Directory: `evidence/verification/ch7-captures-desktop/`
Sidecar: `evidence/verification/ch7-captures-desktop.json`

Frames at the contracted +0.0/+0.4/+0.8/+1.5/+2.4/+2.8/+3.5/+4.8/+5.2/+6.5 s
off the calibration receipt. State measured alongside the strip and constant
across the whole window: shot `cin.reconstruct.09-one-exterior-reveal`,
`cameraAuthority` `cinematic-look`, `appliedFovDeg` 52,
`fx.reconstruct.09-one-exterior-reveal` active, score cue
`sc.reconstruct.one-instrument`, `score.hit` null
(`evidence/verification/ch7-window-av-score-trace.json`). These are the first
frames of `cin.reconstruct.09` captured in this project; composition judgment on
them is the Cinematography Director's, per `cap.ch7.reveal-composition`. The M7 pill is present from +0.0; the M7 caption
appears by +0.8; the exit string `the scar remains. now it can carry me.` is on
screen from +3.5 and fully revealed by +4.8, ahead of the advance; the
ch7-board overwrite `(the wreck is waiting for an owner.)` appears at +5.2,
after the +5.0 s advance; the M7 audit pill persists across the boarding seam
and is still on screen at +6.5.

## ch7 stage ladder — `cap.ch7.latch-ladder`

Directory: `evidence/verification/ch7-captures-desktop/pre-origin/`

A continuous 400 ms strip from beat entry to the calibration receipt, each frame
stamped with its beat, caption and audit line. Every one of M1 through M6
appears in at least one frame, in stage order, with the WRECK RELAY stamps
preceding their captions. Movie mode compresses the stage edges to 0.66-1.30 s
apart, so several captions are truncated mid-typewriter in the strip: this is a
flow proof, not a pacing proof, exactly as the contract requires it to be
stated.

## ch8 ignition and liftoff — `cap.ch8.l2-l3-anchors`

Directories: `evidence/verification/l23-deep-link/`, `evidence/verification/l23-chained/`
Sidecar: `evidence/verification/l23-captures.json`

250 ms strips through the ignition/liftoff window on both routes, each frame
stamped with the live `activatedAnchorIds`. The strips are the rendering record
behind defect `vd-01`: on the deep link the DOM shows only the L3 caption from
the first post-ignition frame onward, and on the chained route it shows only
L1. The trace, not the strip, is the emission proof for ignition, as the
contract anticipated.

## Desktop reference

`variant-desktop`, 1280x720, LOW. This is the reference set for every table
above.

## Mobile

`variant-mobile`. Portrait 390x844:
`evidence/verification/ch8-captures-mobile-portrait/` and
`evidence/verification/ch7-captures-mobile-portrait/`. Landscape 844x390:
`evidence/verification/ch8-captures-mobile-landscape/`.

Measured at stack row 1, portrait: audit pill y 114-160, caption y 606-653 with
`data-caption-placement="center"` wrapping to two lines, touch controls below
y 660, JOURNAL disclosure at the top left. No band, card or control overlap and
no unsafe crop in either orientation. Landscape: audit y 53-99, caption
y 152-199, no collision. One shipped behaviour to note without judging it: on
mobile the objective card is collapsed behind the JOURNAL disclosure, so
`DEEP SPACE · HANDOFF` is not on screen during the hold.

## Reduced motion

`variant-reduced-motion`, `prefers-reduced-motion: reduce`.
`evidence/verification/ch8-captures-reduced-motion/` and
`evidence/verification/ch7-captures-reduced-motion/`. Identical line sequence,
identical offsets, identical layout to desktop. The signed runtime reports
`lens.reducedMotion` false at the launch shot because those shots are lens-rig
and hold no numeric lens authority — shipped behaviour, not a variant defect.

## Quality tiers

`quality-potato`, 1280x720 POTATO:
`evidence/verification/ch8-captures-potato/` and
`evidence/verification/ch7-captures-potato/`. Caption and audit typography,
placement and reveal are unchanged; the text is legible over the bright ch7
terrain moments and over the ch8 hold. LOW is the tier of every other set in
this report.

## Objective visual defects found

None in the frames themselves. No blank frame, no black frame, no visual pop, no
one-frame glimpse of the wrong era, no letterbox or scanline artifact, no
missing HUD element that a caption references, in any of the 292 frames.

The two defects this run records (`vd-01`, `vd-02`) are behavioural and are
evidenced by traces plus the `l23-*` and chain strips, not by a corrupted frame.
