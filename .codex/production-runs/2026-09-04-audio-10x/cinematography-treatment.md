# cinematography-treatment.md — audio-10x run (Stage 2, independent)

Author: Cinematography Director. Status: first-wave treatment, no code. Read:
story-intent.md; `PARAVOXIA_AUDIO_10X_PLAN.md` §2, Stage 3/4/6, §6;
`main/CINEMATOGRAPHY.md`; `main/src/story/ux/README.md`. Score treatment not
read (by commission). Line numbers are the live working tree.

## 0. Visual thesis

The image already climbs the ladder; sound is now asked to climb it beside the
eye. My one rule for the whole run: **the eye and the ear change in the same
frame, and neither gets a fidelity the other has not earned.** Practically:

- Where the intent says a presentation bundle chases `audioTime`, the bundle
  is *one object* — the visual members already fire on the same tick as the
  hit in every one of the eleven sites, so we move the whole tick, never a
  member.
- Room (Stage 4) is atmosphere. It follows the same signals the fog, grade and
  medium blend already read, and it changes on the same curve.
- Captions for sound are HUD, not cinema. They inherit the mono HUD voice, sit
  in a registered surface, and never touch the caption or marker layers.

Protected and unchanged: the look (grade + Sobel outline + N8AO + ACES; painterly
OFF); every camera authority (`LensRig`, `feedCamera`, `cinematicLook`,
player camera); every FOV, rig, letterbox and reset already in
`storyDirector.ts`; the post-A3 long take; the un-stung first direction at the
Maw (`signedSceneAvRuntime.ts:433-438`).

Rejected alternative: "audio-reactive image" (bloom/exposure keyed to the hit
bus envelope). It adds a per-frame uniform on the render thread, gives a
high-tier-only meaning, and makes the picture *annotate* the score. Effects are
verbs; a swell that says "the music got loud" says nothing.

## 1. Stage 3 — the eleven bundles chase `audioTime`

### 1.1 Current-cut evidence map (what fires with each hit today)

| # | Site | Visual members fired on the same tick | Chase class |
|---|---|---|---|
| 1 | `storyDirector.ts:846` ch1-track entry | `playSfx('storyAwaken')`; work order swap; `r.cinematic` letterbox envelope starts at `beatClock=0` (`:1381`); the 6.5 s rig blend starts from beat entry | **timeline-origin** |
| 2 | `:1233` a1 → color | `setVoxelRealityStage('color')`, `clearVoxelRealityOverrides()`, `r.desat=0`, `r.glitch=0` (`:1227-1231`), then `advanceToBeat` | **stage-cut bundle** |
| 3 | `:1292` a2 liberation start | `storyAwaken`; FOV 50→75 ease begins (`:1298`), `r.treatment` decay, `setStoryMoveScale` unfreeze (`:1306`) | **timeline-origin** |
| 4 | `:1314` a2 → ch3-gather | `setStoryLookMode('free')`, `setStoryTargetDpr(null)`, `r.treatment=0` (`:1310-1312`) | **stage-cut bundle** |
| 5 | `:1362-1363` descent impact | `r.flash=1`, `r.glitch=1`, `r.scanRoll=0.8`, `shipCrash` (`:1358-1361`) | **flash bundle** |
| 6 | `:1434` lift DPR snap | `setStoryTargetDpr(null)`, `r.glitch=0.8`, `r.scanRoll=0.5`, `storyGlitch` (`:1430-1433`) | **masked-snap bundle** (indivisible) |
| 7 | `:1741` a3 first blade | wave front `setLifeReveal(radius>0)` begins at `waveStart` (`:1729,:1745`) | **timeline-origin** (hold) |
| 8 | `:1760` a3 → material | `setVoxelRealityStage('material')`, `clearVoxelRealityOverrides()`, `clearLifeReveal()` (`:1756-1758`) | **stage-cut bundle** |
| 9 | `signedSceneAvRuntime.ts:445` Maw commit | intensity step (`:441-443`); receipt visuals are the anchor's own cue rail | **receipt answer** |
| 10 | `emergentStoryDirector.ts:941` a4 life front | `storyAwaken`, caption `(the world exhales…)` (`:945`), `lifeProgress` origin at `elapsed-1.75` (`:950`), organic/detail/atmosphere override (`:951-955`) | **timeline-origin** |

Strongest existing image: the a3 wave (`:1743-1745`), because the hold before
it is authored. Weakest: the a1 landing — the stage cut is exact but the bloom
is reflex, so image leads sound by whatever the scheduler slop is.

### 1.2 Mechanism (proposal for the integrator; no new camera authority)

`scheduleHit` already returns the onset in audio-context time
(`scoreEngine.ts:1533`). The director already runs on `d.beatClock`. The
integrator adds one director-local helper, not a new system:

- `armBundle(id, quantize)` at the bundle's *arming* tick: calls
  `scheduleHit`, converts the returned `audioTime` to a beat-clock target
  (`target = beatClock + (audioTime - ctx.currentTime)`), clamps it to the
  intent's stretch bound, stores `d.bundleAt[id]`. Null return → target =
  arming time (today's behaviour, exactly).
- For **timeline-origin** classes (#1, #3, #7, #10) the stored target replaces
  the constant the timeline reads (`waveStart`, `deathEnd`, the a4 `1.75`),
  so every downstream envelope stretches with it — "composed to the bar".
- For **stage-cut** classes (#2, #4, #8) the `t >= 1` / `t >= end` test
  becomes `t >= max(end, bundleAt)`; nothing else moves. The `advanceToBeat`
  follows the cut as today — state is not delayed in any user-visible sense
  because the milestone (`markMilestone`) fires at the arming tick, before the
  wait.
- For the **flash** (#5) and **masked-snap** (#6) bundles, the `if (t >= X)`
  guard reads the stored target. Nothing inside the block is split. The
  descent bound is one-sided (later only) per intent.
- #9: `applyScore` (`signedSceneAvRuntime.ts:440-446`) stores the returned
  time; the anchor's visual "answer" cue reads it. The receipt itself is
  untouched.

Image-lead/lag budget (image relative to audible onset): **≤ 1 rendered frame
early, ≤ 2 frames late** at 60 Hz (−16 ms / +33 ms). The director tick is the
render tick, so the achievable resolution is one frame; the audio side is
±1 ms by the plan's own gate. Dropped frame: the guard is `>=`, so a hitch
makes the image *late* by the hitch, never early, and never skips a member.
Late is the correct failure mode — an early flash before the boom reads as a
mistake; a late one reads as impact latency.

Shared anchors (names, not seconds): `track.unbolt`, `a1.color-stabilizes`,
`a2.feed-wall-falls`, `a2.hand-back`, `descent.impact`,
`lift.perspective-issued`, `a3.first-blade`, `a3.material-lands`,
`maw.repair-answer`, `a4.life-front`. Each has `audioTime`, `frameTime` and
`slackMs` recorded in the contract.

Answers to Chapter's questions: **all eleven chase**, because in every site the
visual members are already on the hit's tick; leaving any one un-chased would
be the only place image and score separate. The a3 bar-stretch (≤ 2.75 s) is
acceptable **as a hold on `waveStart` only**: `bloomWaveDelaySeconds` is 4 s
(`storyScript.ts:675`) and the grain captions are keyed to `wakeAt` not
`waveStart` (`storyDirector.ts:1748-1749`), so a longer hold cannot make a
caption late — the reveal stays armed at radius 0 (`:1737`), which is a
still image, not a pop. Verify in capture that the last grain caption's
`atSeconds` lands before the *stretched* wave, or the bound shrinks.

## 2. Stage 4 — room presets agree with the seen environment

Mapping (visual state → preset → the visual signal Score should read):

| Seen | Preset | Driving signal (already exists) | Visual transition it must match |
|---|---|---|---|
| open plain, any sky | `plain` | default | none; this is the resting state |
| cave / overhang | `cave` | **no signal exists** — `worldSignals.ts:59-83` has no enclosure field | see below |
| submerged | `underwater` | `getCameraSubmergence()` (`playerSubmersion.ts:83`), the same value PostFX reads (`PostFX.tsx:174`) and audioCore's `submergeFilter` (`audioCore.ts:19,345`) | continuous medium blend; the `>0.5` threshold at `PostFX.tsx:175` is the crossing |
| ship interior | `interior` | `ev.board.camera-owner-vehicle` → `ev.board.cockpit-sealed` (`physicalBoarding.ts:290,298`) | the camera-owner transfer, then the seal |
| station corridor / hall | `station` | station scene mount; `spaceStationTypes.ts:26,34` zones | the dock hatch iris (`spaceStationDock.ts:220`) |

Timing rule: the send crossfade (plan: 1.2 s) must follow the *visual*
transition's own curve, not a fixed constant:

- Underwater: drive the send from the same smoothed submergence the post pass
  uses, so ear and eye cross 0.5 in the same frame. No separate 1.2 s.
- Interior: start the crossfade at `camera-owner-vehicle`, finish at
  `cockpit-sealed`; the seal is when the room closes in both senses.
- Station: crossfade tied to the iris open fraction (0 sealed → 1 open) so the
  hall's reverb arrives as the aperture reveals it.
- Cave: I do **not** ask for a new world signal this run. There is no visual
  cave language shipped (no overhead-occlusion fog or grade), so a cave reverb
  would be a sound the eye cannot confirm — an unearned effect. Ship `plain`
  under overhangs; register `cave` as a preset with no driver, for the run
  that gives overhangs a visual signature.

Reality-ceiling agreement (Chapter's question): yes, `bare` shows no room —
the ch1 feed is a flat desaturated raster with no atmospheric depth (bible
table, `ch1-*`), so mono/dry is the honest match; `colour` (ch2) adds hue but
keeps flat material, so pan-only is right; `material` adds depth and the
distance filter belongs there; `alive` is the first stage with atmosphere the
eye can read as a volume, so room belongs at alive. The station reads as
keyless in image: FogExp2 `#0a0f16` (`SpaceStationSandbox.tsx:353`), no
daylight, no planet palette — a place without a sun is a place without a key.
The `lean` tier's two rooms should be `plain` and `underwater` (the two the
demo surface can reach).

## 3. Stage 6 + accessibility — captions for sound, and the oxygen body-clock

### 3.1 Same-frame parity of existing cues (confirmed / gaps)

- `storyGlitch` at the lift snap: same tick as `r.glitch=0.8` (`:1431-1433`). Confirmed.
- `storyAwaken` at #1/#3/#10: same tick as the letterbox / FOV / caption. Confirmed.
- `shipCrash`: same tick as `r.flash=1` (`:1358-1361`). Confirmed.
- `terminalAlarm` in the a2 flood: same tick as `pushViolation` (`:1263-1264`) — the violation line *is* the flash. Confirmed.
- **Gap:** the three ch3-signal klaxons (`:1879-1882`) have no visual member; the audit-band carrier line arrives later (`:1884`). Repair: a one-frame `audit-band` ember pulse (`#ff5a3c`, the audit family) per klaxon, in the band's own surface. No new surface, no screen flash — a klaxon from a wreck should not white the world.
- **Gap:** oxygen pulse has parity only below 25 % (`OxygenMeter.tsx:7,47`), so the pulse's *cadence* (the body clock) is inaudible-invisible above that. See 3.3.
- Hatch iris: the iris fraction is the visual; no addition.

### 3.2 The sound-caption surface

One new registered surface, `sound-caption`, layer `informational`
(`hudSurfaces.ts:23-36`) — deliberately **not** `caption`, so the sweep
forbids it from ever sitting under `story-caption` or `audit-band`. Placement:
top-right on desktop, below `vitals-meter`'s band; on touch, above the
`touch-action-cluster` clearance from `readTouchControlClearance()`, never
bottom-centre (that is the captions' home, `StoryCaptions.tsx:118-119`).
Typography inherits `theme.font.mono` at 12 px / `0.14em` — the audit band's
values (`AuditBand.tsx:114-115`), not the lowercase caption's 15 px / `0.06em`
(`StoryCaptions.tsx:124-125`).

Two-register rule, made visual: bracketed cue captions are institutional and
render **UPPERCASE** in the audit band's tracking; they may name a *sound*,
never a speaker (`[ALARM]`, `[GLITCH]`, `[IMPACT]`, `[HATCH]`). Voiced
narrator lines get no cue caption: the line already on screen is the
caption. Lowercase story captions are never bracketed and never enter this
surface. This keeps "who is speaking" unwritten, per the both-readings law.

Timing: appear on the cue's tick, hold 1.2 s, fade 300 ms; one caption per cue
kind at a time (a second klaxon restarts the hold, it does not stack). Under
reduced motion: no fade, hard show/hide; never a pulse.

Lifecycle cues (`objective-enter/progress/complete/fail`, `marker-acquired`,
intent §3): no sound caption. Parity is intrinsic — the guidance card's
work-order text, count and strike are the visual (`StoryGuidanceHud.tsx`), and
`FreeMarker` appearance is `marker-acquired`. I will confirm each is same-tick
with the `feedbackCues.ts` emit in the lifecycle trace; adding a second
visual would compete with the card.

### 3.3 Oxygen body-clock for deaf players

The pulse is protected as shipped, so parity must ride the existing meter:
a per-pulse 1-frame brightness tick on the `OxygenMeter` fill, driven by the
same `oxygenAudio.ts` clock, at every level — not only below 25 %. Below 25 %
the shipped red pulse continues unchanged. Under reduced motion the tick
becomes a static fill-edge marker that advances per pulse (position, not
motion). No new surface; `vitals-meter` already registers it. When
submerged, the meter is the only body readout; it must survive the underwater
accessibility policy (`PostFX.tsx:178-188`) at full contrast.

## 4. Positional cues — what the screen does and does not add

No on-screen spatial indicator for off-screen positional SFX, with one
exception. Reasons: the pillar (intent §3: spatializing guidance would claim
the world speaks); the marker language is single (`ux/README.md`, "do not
introduce a competing marker language"); and `mine`/pickup/`blocked` sounds
are positioned *at the player's own action*, so they are never off-screen.

The exception is the ch3-signal klaxon "from the wreck" (`storyDirector.ts:1878`).
It is the one authored world sound whose source may be behind the player.
No arrow: the wreck already persists as a landmark (bible, `descent` row) and
the audit band names the signal. The ember pulse in 3.1 is the visual; the
player turns because the band says to, not because a HUD points.

Agency: nothing here takes or biases the camera. Positional audio is
listener-relative to the *camera* (plan Stage 4), so during `cinematicLook`
pulls the pan follows the pulled camera — correct, the look is the player's
attention — and hands back with it. No new hold, no new release.

## 5. Variants, performance, capture

- **Desktop / mobile:** identical bundle timing; the sound-caption surface
  relocates per touch clearance. Mobile's `lean` mix tier changes nothing on
  screen — a quieter room is not a different image.
- **Reduced motion:** bundles still chase (timing is not motion); the flash,
  glitch and letterbox variants already fall to their existing reduced forms;
  sound captions hard-cut; oxygen tick is positional.
- **Lean / low tier:** parity carriers are DOM (band, meter, caption), so they
  survive tiers that drop the post chain. No high-tier-only meaning.
- **Performance:** nothing new per frame on the render thread. The bundle
  targets are read by existing `>=` guards; the audio send follows signals the
  frame already computes; the caption surface is change-gated DOM. Anchor-window
  invariant (bible law 7) holds: no first-use shader/material in ±2 s of any of
  the ten anchors.

Capture spec (evidence route): for each anchor, a headed real-GPU run in
`?story=BEAT&movie=1` recording (a) per-frame screenshots at 120 Hz-equivalent
(2× rAF via `PROBE`-side dedup) from −0.5 s to +1.0 s around `bundleAt`,
(b) the combined-bus render, (c) a burned-in overlay of `audioTime`,
`ctx.currentTime` and `beatClock` per frame. Deliverable per anchor: a strip of
frames −3/−2/−1/0/+1/+2/+3 with the audio onset marker drawn as a vertical
line on the waveform beneath; pass = image member visible at frame 0 or +1,
never −1. Repeat for desktop, mobile viewport, reduced motion, low tier, and
the player path (manual arrival) for #1, #7, #9, #10. Room presets: strips
across the underwater 0.5 crossing, boarding seal and hatch iris with RT60
annotated per frame. Sweep `npm run story:hud:sweep` with `sound-caption`
registered, across the six beats where cue captions fire.

## 6. Notes to peers, dissent, taste questions

**To Score.** (1) Publish `audioTime` per hit *and* the quantum you actually
landed on, so the contract can record slack. (2) Is the `hitBus` onset the
transient or the envelope start? The frame test needs the audible onset.
(3) Underwater room: please read the same smoothed submergence PostFX reads,
not a threshold; a discrete 1.2 s crossfade will fight a continuous medium.
(4) Descent: I need the boom+braam as one onset or the flash has two masters.

**To Chapter.** (1) Cue-caption vocabulary needs your both-readings ruling on
the four words above. (2) The ch3 klaxon ember pulse is a *new visual member*
on a shipped beat — it is parity, not story, but it touches `AuditBand`;
please confirm it is inside the lock. (3) No cave preset ships until an
overhang has a visual signature; do you want that on the backlog or is
`plain`-under-rock acceptable canon for now?

**Dissent held.** The plan's default quanta (`'phrase'` for blooms, Stage 3)
are too coarse for the four stage cuts; the intent's `'beat'` for #2/#4 is
right and I sign that, not the plan.

**Owner taste.** Should the sound-caption surface exist in movie mode at all,
or only when the setting is on? I recommend setting-only; the movie is the
picture's evidence, not the caption's.

`contractChangeRequired: true` — shared anchors gain `audioTime`/`slackMs`,
one HUD surface is added, and one shipped beat gains a visual member.

## 7. Color script and shot ledger (index)

Color script. This run authors no new palette. The colour script is the shipped
one: the flat desaturated raster of the ch1 feed at `bare`, hue without
material at `colour` (ch2), depth and material at `material`, atmosphere at
`alive`, and the station's sunless `FogExp2 #0a0f16`. The single colour value
this run introduces is the audit family ember `#ff5a3c` used for the one-frame
klaxon pulse inside the audit band (§3.1), and the sound-caption surface, which
inherits the audit band's mono type and carries no colour of its own (§3.2).

Shot ledger. This run authors no new shot. The ledger is the ten existing
shipped shots at the ten frozen anchors, enumerated with their visual members
in the current-cut evidence map at §1.1 and re-timed — not re-framed — by the
bundle mechanism at §1.2. Camera authority, FOV, rig, letterbox, transition and
reset at every one of the ten are unchanged; what moves is the tick the whole
bundle lands on. The capture spec for the ledger is §5.
