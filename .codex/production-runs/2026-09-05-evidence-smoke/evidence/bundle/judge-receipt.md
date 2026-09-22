# JUDGE — ch10@movie (paravoxia-chapter-v1)

- schema: visual-judge-verdict-v1
- subject: ch10@movie
- rubric: paravoxia-chapter-v1
- rubricSha256: e26aeb49b759b9bb3b657f0f6a528c9eaa7cbc88b7f03fb4e344cb7507355592
- bundleSha256: e61b4fa963c3f8c3f014ba22ccccffbe3921e23dfef394c4198ff645392f90a8
- verdictSha256: 26428e30e37c1777ad1338db5e954ea41b0db06e850927dc259249fad8867b00
- transport: commission
- captureTier: hardware-high
- judgedAt: 2026-09-05T13:44:12.200Z
- judge: visual-judge
- gateResult: compileOk=true runtimeOk=true blankRatio=0.000 frozen=false distinctImages=23 clamp=none
- quality: 0.4605
- reward: 0.3223
- absoluteReward: -0.0790
- pairwise: 0.4561 over 1 opponent(s)

## Gates
Deterministic tier-0 result: compileOk=true runtimeOk=true blankRatio=0.000 frozen=false distinctImages=23 clamp=none.
No reward clamps applied.

## Dimensions
weighted (0-5): 2.30
- audiovisual_emotional_alignment: E=1.93 q=0.48 conf=medium
- narrative_and_player_causality: E=1.82 q=0.46 conf=medium
- cinematic_composition_and_lens: E=1.53 q=0.38 conf=high
- score_coherence_and_sync: E=2.03 q=0.51 conf=medium
- palette_light_and_render_cohesion: E=1.82 q=0.46 conf=high
- transition_and_state_integrity: E=1.93 q=0.48 conf=medium
- creative_ambition_and_specificity: E=1.93 q=0.48 conf=medium

## Evidence
- audiovisual_emotional_alignment [0,2,3]: ch10-ask (t=4.80-13.40s): a dark cockpit with a tiny green cube growing in the window; the approach is legible as 'something is coming' but the cube reads as a placeholder marker, not an object with emotional weight. In frame 3 it has become a flat pixel map that fills a third of the window without any sense of scale or atmosphere.
- audiovisual_emotional_alignment [4]: The landfall objective (t=14.40s) is carried by the picture: the window fills with voxel terrain under a pale sky, luma steps 0.225 to 0.461. This is the one frame where image and story turn agree.
- audiovisual_emotional_alignment [5,6,7,8]: The bearing-claim beat (t=25.80s) arrives as a bright meadow with grey deer and palms (bright 0.877), a pastoral relief after the dark approach; but frames 5 and 6 between are an incoherent jumble of rock texture, voxel wall and clipping tree trunk, so the arrival is a lurch rather than a build.
- audiovisual_emotional_alignment [22]: Transit (t=61.10s): back in the dark cockpit with a small capsule drifting in the starfield. Reads as departure/withholding, but the 25 s of transit from 36.7 to 61.1 s sits at a flat luma of ~0.07 with no visible turn at the 52.90 s resolve.
- narrative_and_player_causality [0,4,7]: Digest chain: crossing (4.80s) -> landfall (14.40s) -> bearing-claim (25.80s) -> transit:hold (30.20s) -> transit:resolve (52.90s). Objectives do change on a timeline and frame 4 confirms landfall shows a planet surface, frame 7 confirms the claim is made on the ground.
- narrative_and_player_causality [7,8]: Caption text from the digest is delivered as fragments: '(i' at 25.80s then '(issued, not of' at 26.20s, completing only at 30.20s; the opening caption at 4.80s is an unclosed parenthesis. The captions read as a typing effect caught mid-word rather than a finished line at the latch.
- narrative_and_player_causality [7]: The frame at bearing-claim shows a grey signpost/cross pole centred in a meadow with deer; nothing in the picture visibly marks what 'bearing' was claimed or what the player did to claim it. The digest also states the exit milestone ch10-fabrication-refused was NOT reached, so the chain is left open.
- cinematic_composition_and_lens [0]: Opening-2.0s hero still: cockpit furniture occupies roughly 60% of the frame and the ostensible subject is a small green cube at dead centre with a few gold dots around it. A stranger would name 'cockpit' before 'cube'. Centred small nothing; does not hold up alone.
- cinematic_composition_and_lens [4]: Best-composed frame: the octagonal window frames a voxel planet edge-to-edge with the pale sky as negative space; one subject, one frame.
- cinematic_composition_and_lens [7,8]: Anchor hero still (bearing-claimed): the camera is now outside the hull. A grey pole is centred in the foreground, deer sit at the horizon line, a grey rock blob intrudes bottom-right and a blue strut fragment intrudes at left. Cluttered, no focal hierarchy, horizon exactly at mid-height.
- cinematic_composition_and_lens [5,6]: Frame 5 has no nameable subject (rock texture beside a voxel cliff); frame 6 has a tree trunk covering the left 12% of the image inside the cockpit.
- cinematic_composition_and_lens [22]: Transit frame: small capsule centred in a starfield, cockpit furniture again dominant. Legible but flat.
- score_coherence_and_sync [7]: anc.ch10.bearing-claimed at 25.80s lands exactly on the objective change to station:bearing-claim and the caption-first event; the picture turns there too (bright 0.517 at 21.70s to 0.877 at 25.80s).
- score_coherence_and_sync [8]: anc.ch10.transit-ignite at 30.20s lands exactly on the ch10-transit beat boundary, the objective change to transit:hold and the caption completion; the picture drops from 0.875 to 0.473 between 26.20 and 30.20s, so the anchor sits at a visible turn.
- score_coherence_and_sync [22]: anc.ch10.seam-of-light at 52.90s coincides with objective transit:resolve, but telemetry shows no picture turn: bright 0.183-0.184 and colorful 0.66 at 48.90, 52.90 and 57.00s. The third anchor is authored to the timeline but the image does not answer it.
- palette_light_and_render_cohesion [0,2,22]: Cockpit frames hold a coherent deep-blue/violet palette with orange and blue console accents, warm gold orbs against cool starfield; consistent grade across the ask and transit beats.
- palette_light_and_render_cohesion [3]: The approaching world is a flat, low-resolution green/blue/brown pixel plane with a hard rectangular edge; it reads as a billboard texture rather than an object in the same render as the cockpit.
- palette_light_and_render_cohesion [4,5,6,7,8]: The surface beats switch to a pale greenish-white sky that is near-clipping (maxLuma 0.95-0.97, bright up to 0.877) and reads as grey-green mush with no light direction; the cockpit trim also shifts hue from blue/orange to cyan between frames 3 and 4.
- palette_light_and_render_cohesion [6,7,8]: Render seams: a tree trunk penetrates the cockpit interior in frame 6; in frames 7-8 a rock and a strut fragment intersect the camera. Capture is hardware-high, so these are not tier artifacts.
- transition_and_state_integrity []: Burst @30.60s (frames 10-15): meanAdjDelta 0.0023, netPerFrame 0.0009, flickerRatio 2.6, signFlips 0.75, changed 0.01, pops 0. The oscillation signature is present (ratio > 2 with high sign flips) but the amplitude is a fraction of a percent of luma over 1% of pixels, so it is a measurement-level flicker, not a perceptible one. 0 blank frames, 23/23 distinct, not frozen.
- transition_and_state_integrity [6,7]: Between 21.70s and 25.80s the camera goes from inside the cockpit to outside on the ground and luma jumps 0.517 to 0.877; no burst covers this boundary, so whether it is a cut, a snap or a transition is unmeasured.
- transition_and_state_integrity [8]: The ch10-transit beat boundary at 30.20s (luma 0.875 to 0.473) is likewise not bracketed by consecutive frames; the burst begins 0.4 s after the boundary and shows an already-settled scene.
- transition_and_state_integrity [22]: From 36.70 to 61.10s the scene sits at meanLuma 0.0688-0.0709 with identical bright/contrast/colorful scalars; frames are distinct, so it is not frozen, but the transit hold is nearly static for 25 s.
- creative_ambition_and_specificity [7,8]: A voxel world with palms, grey deer, a pond and a grey signpost is a particular place; it is more than a generic space scene.
- creative_ambition_and_specificity [0,22]: The cockpit, starfield, gold orbs and drifting capsule are generic spaceflight furniture that could belong to any chapter.
- creative_ambition_and_specificity [3,4]: The planet as a flat pixel map that then becomes voxel terrain is a distinctive idea, but the billboard stage undercuts it.

## Severe issues
- (major) [6,7,8]: Geometry interpenetration: a tree trunk fills the left edge of the cockpit interior in frame 6, and in frames 7-8 (the bearing-claimed anchor still) the camera sits outside the hull with a rock and a strut fragment intersecting the view. The anchor hero frame is corrupted by clipping.
- (minor) [3]: The approaching world renders as a hard-edged flat pixel billboard in the window before becoming 3D terrain in frame 4; reads as a popping placeholder.

## What I could not check
Nothing.

VERDICT: REJECT
