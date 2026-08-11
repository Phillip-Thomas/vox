# Cinematography Treatment — ch7/ch8 voice repair (ruling/verification lane)

Author: Cinematography Director
Status: ready_for_cross_notes
Prepared independently from the Score Director's treatment: **yes** — no score
treatment, score notes, or score audit was read for this document.
Commission source: `story-intent.md` (draft-v2), `production-lock.md` including
the Orchestrator rulings addendum (R1, R2), `shipped-visual-baseline.json`,
`shipped-ux-baseline.json`, `shipped-reference-map.md`, and the baseline frames
under `evidence/` and `evidence-hires/` at source revision `03e975a`.

Lane constraint honored throughout: **no camera, shot, render, PostFX, or
signed-AV mutation is proposed for this run.** Every finding below is a ruling,
a cadence/copy note back to the Chapter Director, a verification requirement,
or a separately-routed packet definition. `signedSceneAvRuntime.ts` and
`generatedSceneAvRuntime.json` are observed only.

---

## 1. Current-cut audit (what the camera actually does)

### 1.1 Evidence map

| Question | Evidence |
| --- | --- |
| ch7 nine-shot declaration, 8 anchors, PostFX | `shipped-visual-baseline.json` → `cameraStates.declaredContract['ch7-reconstruct']`, `reconstructionAnchors` |
| ch7 observed camera per stage | `shipped-visual-baseline.json` → `cameraStates.observed[0]` (17 samples); `evidence-hires/av-state-trace.json` |
| ch7 stage-edge frames | `evidence-hires/ch7-reconstruct/000–007` (2 s density), `evidence/ch7-reconstruct/000–006` (4 s) |
| Manual-pace ch7 frame with caption + marker + prompt | `evidence/ch7-reconstruct/001_005s_ch7-reconstruct.png`, `evidence/ch6-dive/007_029s_ch7-reconstruct.png` |
| Exterior-reveal window | trace samples t=15.87→16.28 (`cin.reconstruct.09-one-exterior-reveal`, `cinematic-look`, appliedFovDeg 52), beat change at t=16.69 |
| ch7-board seam / caption overwrite | `evidence/ch7-board-entry/000_000s_ch7-board.png` (black boarding frame, `(the` mid-typewriter), `evidence-hires/ch7-reconstruct/008_017s_ch7-board.png` |
| ch8 launch shots | `evidence-hires/ch8-launch/000–002`, `evidence/ch8-launch/000–001`, `evidence/ch7-reconstruct/005_021s_ch8-launch.png` |
| ch8 exit → crossing seam and deep-space look | `evidence-hires/ch8-launch/003_007s`–`007_015s`, `evidence/ch8-launch/002_009s_ch8-crossing.png` |
| FPS baseline | `evidence-hires/fps-baseline.json` — LOW 1280×720, median 60.1 across ch7-reconstruct / ch7-board / ch8-launch |

### 1.2 Shot ledger — ch7-reconstruct (what is actually on screen)

Shots 01–08 are declared and observed `player-camera` at 75° with per-stage
PostFX ids swapping on each `anc.reconstruct.*` activation
(`fx.reconstruct.02…08` observed live in the trace; `activePostFx` follows the
anchor within one sample). There is no camera motion authored anywhere in the
build loop: the "shots" are anchor-scoped treatment windows on the player's own
first-person camera. Composition during M1–M6 is therefore whatever the player
(or the movie autopilot) is looking at — in the movie path that is the bench /
ship cluster at close range (`evidence-hires/ch7-reconstruct/003–006`).

The chapter's only authored camera moment is
`cin.reconstruct.09-one-exterior-reveal` (`cinematic-look`, 52°, 350 ms
occlusion transition, focus "restored spine and surviving scar"), parked at
`anc.reconstruct.calibration`. Two observed facts about it that the whole run
must reckon with:

1. **The reveal currently has ≈0.8 s of screen life.** `cinematic-look` at 52°
   is first observed at t=15.87 (calibration completes), and the beat changes
   to ch7-board at t=16.69 (the shipped 0.65 s exit hold plus a tick). The
   `storyInputPolicyTargetFov` already eases toward 52 during the 8 s
   calibration wait (observed from t=7.81), but the applied cinematic frame
   exists for under a second.
2. **No baseline frame captured it.** Both the 2 s hires strip
   (007_015s → 008_017s) and the 4 s LOW strip straddle the 0.8 s window. The
   chapter's flagship image exists only in the state trace. That is itself the
   measurement: at shipped timing the authored exterior reveal is subliminal.

Seam behavior: the caption slot is not cleared at beat exit. The shipped exit
caption `(the scar remains. now it can carry you.)` was observed overwritten
mid-typewriter 0.2 s into ch7-board (`evidence/ch7-board-entry/000` shows the
board parenthetical typing over a black boarding-occlusion frame). Confirmed
independent of this run's copy: `evidence/ch7-reconstruct/005_021s` shows
ch7-board's caption still on screen inside ch8-launch, ~4 s later.

### 1.3 Shot ledger — ch8-launch (what is actually on screen)

All three launch shots declare `cameraAuthority: "lens-rig"`;
`numericLensAuthorized()` refuses their declared FOVs and `appliedFovDeg` is
`null` at every launch sample — flight feedback owns FOV, as the intent states.
The camera is the cockpit first-person rig throughout; PostFX ids follow the
anchors.

- `cin.launch.01-engine-finds-weight` (ignition): never isolated in a 200 ms
  sample (ignition and liftoff are both active by the first post-ignition
  sample — `openCaptureGaps[1]`). On-pad frame
  `evidence-hires/ch8-launch/001_003s`: cockpit interior, night terrain, pond,
  fauna — and the red-fruited hero tree visible at far frame-left through the
  canopy.
- `cin.launch.02-world-below` (liftoff): declared focus "ground physically
  receding." **Observed frames deliver sky only.** `evidence-hires/ch8-launch/
  002_005s` (liftoff anchor active t=3.56–4.79) and `evidence/ch8-launch/
  001_004s` and `evidence/ch7-reconstruct/005_021s` all show the nose pitched
  up: green starfield sky fills the canopy, zero ground, zero tree. The shot's
  declared focal subject is not on screen in any captured liftoff frame.
- `cin.launch.03-boundary-without-warp` (atmosphere exit): fires in the same
  synchronous moment the beat-exit predicate becomes true; as shipped the shot
  and the beat evaporate together (first deep-space sample is already
  ch8-crossing). The deep-space look the exit hold would inherit is captured in
  the crossing frames: dark cockpit frame, starfield with faint violet nebula,
  motion streaks while drifting, cyan holo ring bottom-center
  (`evidence-hires/ch8-launch/003–004`).

### 1.4 Color script (palette, grade, and reality continuity — observed, unchanged by this run)

Adjacent-scene continuity, palette, reality stage: `alive` on every sample; no
grade preset and no lighting override declared on any ch7/ch8 shot; signed
score intensity seam 0.4375 → 0.42 → 0.35 across launch-exit → crossing entry.
Nothing in this run's copy changes any of that.

### 1.5 Band geometry (the surfaces the new copy lands on)

- **Audit band** (`AuditBand.tsx`): fixed top 13.5% (below the 11 vh letterbox
  line — survives cutscene treatment by design), centered, max-width
  min(84 vw, 720 px), self-backed dark pill `rgba(4,10,8,0.42)`, 10 px
  small-caps header + 13 px body, 22 ms/char typewriter, TTL 6500 ms, fade in
  the last 600 ms. Legible over any sky by construction.
- **Caption band** (`StoryCaptions.tsx`): bottom, safe-area- and
  objective-card-aware via `solveStoryHudLayout` (observed anchored right of
  center at ≈x 828/1280 while the objective card occupies lower-left), 15 px
  mono, **no backing plate** — text-shadow only, 34 ms/char, TTL 5200 ms.
- Both slots are single-slot with instant overwrite and no scheduler; neither
  clears at beat boundaries (observed both directions).

---

## 2. Text-over-image legibility rulings

### 2.1 Ruling A — M7/calibration receipt over `cin.reconstruct.09-one-exterior-reveal`

**Ruling: the two-row audit receipt does not fight the reveal spatially; the
fight is temporal, and at shipped timing both parties lose before either is
seen. The placement is APPROVED conditional on D9 plus a frozen ch7 exit
cadence.**

Spatial: the audit pill sits top-center over sky, small (two rows, ≈500 px wide
for the M7 body at 13 px), 42%-alpha dark pill; the reveal's focal subject —
restored spine and scar — occupies center frame at 52°; the caption sits
bottom, layout-solved clear of the objective card. First read stays the ship;
second read is the stamp above it; the caption is the answering voice below.
That is exactly the focal hierarchy the moment wants: regulation above,
subject center, interior voice below. No letterbox conflict (band is below the
bar line by design).

Temporal, two measured problems:

1. The reveal lives ≈0.8 s as shipped (§1.2). An audit body of ~46 characters
   needs ≈1.0 s just to finish its 22 ms/char reveal; the M7 caption needs
   ≈1.6 s. Under the shipped hold, the receipt would be cut off mid-stamp and
   the reveal it sits on was never even captured at 2 s density.
2. **M7 and the exit latch fire on the same predicate in the same tick.** M7's
   edge is `hasReconstructionCalibrationReceipt` false→true; the shipped
   `once('calibration-complete')` latch tests the same receipt in the same
   `tickReconstruction` pass. Implemented naively, the exit caption overwrites
   the M7 caption **in the same frame** — M7's caption has zero effective
   screen life. The intent's §3 lists M7 and Exit as separate moments but
   freezes no offsets between them (unlike ch8's §6 cadence table).

Condition for my signature (routed to Chapter as a cadence note, not a visual
mutation): the contract must freeze a ch7 exit mini-cadence in the same named-
constant style as §6, inside the D9 window. My recommended values, tuned to the
band reveal speeds and the 350 ms occlusion transition into the reveal:

| Offset from calibration receipt | Fires |
| --- | --- |
| `+0.0 s` | M7 audit line (`AUDIT NETWORK · UNSCHEDULED HULL …`) |
| `+0.6 s` | M7 caption (`nothing has asked yet. …`) — audit stamps first, voice answers, per the intent's own ordering law |
| `+2.6 s` | exit caption (`the scar remains. now it can carry me.`) |
| `+5.0 s` | advance to ch7-board (D9 value) |

Accepted side effect to record so no reviewer flags it as a leak: with the M7
audit TTL of 6.5 s, the `AUDIT NETWORK` pill will persist ~1.5 s into
ch7-board's black boarding frame. The band is designed to survive cutscenes,
and tonally the index following the worker into the cockpit is correct.
Intended-accept, not a defect.

### 2.2 Ruling B — the L4–L6 cadence during the ch8 exit hold

**Ruling: the frame holds. This is the best text-legibility surface in the
entire two-chapter span, and the stamping cadence itself is the visual rhythm
of the window. APPROVED with one cadence reservation (L6 tail).**

What is on screen for the ~17 s (from captured deep-space frames, which the
held ch8-launch inherits — same rig, same world state, minus crossing HUD):

- Dark cockpit frame filling the frame edges; starfield with faint violet
  nebula through the canopy; motion streaks while the ship drifts; cyan holo
  ring bottom-center. Near-black ground under both text bands — maximum
  contrast anywhere in the run.
- Objective card lower-left: variant D (`DEEP SPACE · HANDOFF`, "ATMOSPHERIC
  EXIT IS COMPLETE. / LET THE SYSTEM RESOLVE."), publishing ~1.75 s into the
  hold per D7. `requiresMarker: false` — **no mid-frame marker exists during
  the hold**, so the canopy starfield stays clean for the stamps. The card's
  own copy is a tonal gift to the window: the standing order on screen while
  the registry stamps is literally "LET THE SYSTEM RESOLVE."
- Audit pill stamping top-center at 2.5 s intervals; captions bottom. Each
  stack line is replaced at 2.5 s, well before its 5.9 s fade start — no fade
  flicker between rows; the band cuts row-to-row like a printer. Correct for
  the register.
- Agency: live stick throughout, no letterbox, no forced look — consistent
  with visual law 6 and the intent's "held, player-controlled drift." A player
  who noses anywhere still faces starfield; the frame cannot go empty-black.

Attention over 17 s: the risk of a held near-static frame is real, but this
window is not static — drift streaks give continuous motion, and a new
regulation row lands every 2.5 s, which is a metronome of attention in itself.
The two-word finale `CONTACT LOGGED.` landing in a near-empty band after three
longer rows is the compositional punch. I endorse the structure as staged.

One reservation, routed to Chapter: **L6 gets 2.0 s** (fires +15.0, advance
+17.0), of which ≈1.4 s is its own typewriter reveal — ≈0.6 s fully revealed
before ch8-crossing's entry parenthetical overwrites it mid-fade (the third
mid-typewriter seam overwrite this baseline documents). The final authored line
of the commission deserves better than the defect this run exists to fix.
Recommend within R2's bound: L6 at `+14.0 s` with advance at `+17.0 s` (3.0 s
tail), or advance at `+18.0 s` if the ~15–17 s language is read as elastic. The
relationships stay identical; only one interval value moves.

### 2.3 Ruling C — caption/marker/HUD focal competition at ch7 repair-stage edges

**Ruling: no blocking competition; one legibility watch item; one pre-existing
UX defect correctly routed already.**

- Vertical stack observed in manual-pace frames (`evidence/ch7-reconstruct/
  001_005s`, `evidence/ch6-dive/007_029s`): interaction prompt ≈58% height,
  marker chip ≈65%, caption ≈86% (layout-solved right of the objective card),
  objective card lower-left, suit HUD upper-left. Four text surfaces plus the
  new audit pill top-center at M1/M4/M5/M7 — five simultaneous registers is a
  lot, but they occupy five distinct screen regions and the audit pill is the
  only addition this run makes. Acceptable; verify on mobile where the solver
  compresses.
- **Watch item — caption ink over daylight terrain:** the caption has no
  backing plate; white 15 px mono over sunlit green grass and pale haze
  (001_005s: "is not" crosses the haze) is marginal at LOW with no AA. M1–M6
  land exactly there in manual play. Not a mutation ask this run — the
  text-shadow carries desktop LOW — but mobile-parity captures must
  specifically prove M2/M3/M6 (caption-only moments, no pill) against bright
  terrain. If mobile fails, the fix is a caption scrim in the UX-owned
  renderer: follow-on packet, not this run.
- Movie mode compresses M1–M6 into ~4 s of mutual overwrite on the single
  slot; the intent already declares manual pace the design target and movie
  a flow proof. Concur — capture spec below samples accordingly.
- The stale `RECOVER WRECK SALVAGE` label (D11) sits beside M2; recorded,
  routed, out of scope. M2's caption latches on the stage edge and is
  unaffected. Concur with the routing.

---

## 3. The liftoff tree ruling

Line at `anc.launch.liftoff` (shot `cin.launch.02-world-below`):
`the site gets small. the tree does not. i keep finding it.`

**Ruling: on the evidence, the tree is NOT findable in frame at the liftoff
anchor. As staged, the line is unsupported by the image on the only path the
baseline can prove, and contradicted on the movie path.**

Evidence:

- `evidence-hires/ch8-launch/002_005s` — liftoff anchor active (trace t=3.56
  and 4.79): nose-up, canopy full of green starfield sky, no ground, no site,
  no tree.
- `evidence/ch8-launch/001_004s` and `evidence/ch7-reconstruct/005_021s`
  (continuous chain, liftoff anchor active): same sky-only framing.
- The shot's declared focus "ground physically receding" is not delivered in
  any captured frame; lens-rig keeps FOV, the cockpit rig faces where the nose
  points, and the climb points the nose at sky. Downward view is occluded by
  the hull. No headed/manual capture exists to prove a player can find the
  tree by free look during the climb (`openCaptureGaps[4]`).
- The tree itself is real and provably visible from the cockpit **on the pad**:
  `evidence-hires/ch8-launch/001_003s` shows the red-fruited tree at far
  frame-left through the canopy at ignition; `evidence/ch6-dive/007_029s`
  shows it standing at the horizon of the wreck site.

Per my commission I do not mutate the shot. I route **both** options with a
recommendation:

- **(i) Chapter note (fallback):** if no camera packet is approved, the line
  cannot claim the frame shows the tree. Either retime the tree clause to a
  moment the tree is provably in frame (ignition, on the pad — though "the
  site gets small" loses its altitude meaning there) or reword L3 to something
  the sky-frame supports. The Chapter Director froze the text deliberately;
  I am not proposing replacement copy in their lane.
- **(ii) Separately-routed camera packet (my recommendation, since the payoff
  "the refusal seen from the air" is story truth):** bounded scope —
  `cin.launch.02-world-below` only; blocking/attitude guidance so that the
  site and hero tree hold in the lower canopy view for the first seconds of
  physical departure (launch-sequence attitude or a bounded rear-quarter
  glance), hand-back unchanged at `anc.launch.atmosphere-exit`; **no FOV/lens
  change** (lens-rig retains FOV authority exactly as shipped), no signed-AV
  contract mutation if achievable in the launch-sequence attitude authoring;
  if it does require touching signed shot metadata, the packet reopens the
  contract per protocol. Movie autopilot must inherit the same attitude so
  the movie path stops contradicting the line.
- Until one of these lands, the line's on-screen truth status is **open** and
  must be tracked in the dissent register — the copy may freeze in the
  contract, but the contract should carry a note that L3's image support is
  pending packet or reword.

---

## 4. ch7 exit-hold extension — open decision D9

**Ruling: SUPPORT. I will sign D9 at ≈5 s, and my Ruling A signature is
conditional on it.** The measured case is stronger than the intent states —
the extension is load-bearing for three things, only one of which is the
owner-approved string:

1. **The approved exit string.** ≈0.85 s of screen life (measured) defeats a
   string the owner explicitly approved; 34 ms/char needs ≈1.4 s just to
   finish revealing it. At the recommended `+2.6 s` slot inside a 5 s hold it
   gets ≈2.4 s of held life — reveal plus a beat of read time.
2. **M7's caption existing at all.** Same-tick collision with the exit latch
   (§2.1). Without D9 there is no window in which both lines can be seen; the
   commission's calibration-receipt moment is structurally unrealizable.
3. **The chapter's only authored camera moment.** The 52° exterior reveal
   currently lives ≈0.8 s and was never captured by either strip. The hold —
   time-in-beat, anchor still parked, no camera code touched — gives the
   reveal ≈5 s of actual life. A copy-pacing constant incidentally rescues the
   flagship image of the chapter. That is the cheapest visual win available
   anywhere in this run.

What the frame holds on: the calibration vantage tightened to 52° with
`fx.reconstruct.09-one-exterior-reveal` live — subject "restored spine and
surviving scar." Composed enough to carry a held line **in manual play**, where
the player stands where they walked. One honest caveat: in the movie path the
autopilot finishes calibration parked against the pad geometry
(`evidence-hires/ch7-reconstruct/007_015s` is nearly nose-to-hull), so the
5 s movie reveal may hold on a degenerate close-up. That is a pre-existing
property of an unwitnessed shot, not a reason to withhold D9 — but the capture
spec below must image the reveal on both paths, and if the movie-path frame is
degenerate I will route it as a shot defect for a separate packet rather than
fold it into this run.

Is 5 s a pacing risk? No: the player has just spent 8 s in an enforced
calibration wait; 5 s more, now with the exterior image, three cadenced lines,
and the chapter's turn completing, is earned stillness — the same doctrine as
the shipped 0.65 s hold, scaled to the copy it must carry. Agency is untouched
(movement/look/interaction remain player throughout; the reveal is
`cinematic-look`, not a control seizure).

D9 requires triad signature; count mine as **yes** at ≈5 s with the §2.1
cadence frozen alongside it.

---

## 5. Variants — reduced-motion, mobile, low-tier obligations

No reduced-motion or mobile baseline was captured (`openCaptureGaps[3]`), so
these are stated as post-implementation evidence obligations, not assumptions:

- **Reduced motion.** The new copy is text with TTLs; the cadence is clock-
  based, not animation-based, so structure must be identical under
  `prefers-reduced-motion`. Neither band renderer branches on reduced motion
  today (typewriter reveal is a text update, not a transform — acceptable),
  but the lock requires the variant recorded as evidence: one full ch7 + ch8
  movie pass under emulated reduced motion proving identical line sequence,
  offsets, and no motion-dependent legibility loss.
- **Mobile safe area.** The caption solver is safe-area- and objective-card-
  aware; the audit pill is fixed top 13.5% centered (max 84 vw) — below any
  notch at that height, but never yet photographed on a phone. Required:
  landscape (844×390) and portrait (390×844) captures at (a) the ch7 exit
  window with all three text surfaces plus objective card and touch controls
  mounted, and (b) the ch8 hold at stack rows 1 and 4. Prove no
  band/touch-control overlap and no caption/card collision
  (`data-caption-placement` recorded per frame).
- **Low tier / legibility.** All strips are LOW already; POTATO must be
  spot-checked at the two worst text moments: M2/M3 caption-only over bright
  daylight terrain (no pill — the §2.3 watch item) and the ch8 hold (dark
  ground — expected trivially legible). The audit pill's 42%-alpha backing is
  tier-independent; captions are the only tier-sensitive surface.
- **Meaning parity.** Nothing in this run may read differently by tier: copy
  and cadence are identical everywhere by construction; the only tier risk is
  contrast, covered above.

---

## 6. Capture specification (for the story-verifier, post-implementation)

Environment: canonical preview `http://localhost:5176` only (5173/5174 are the
sibling Paraform project); chromium from `~/.cache/ms-playwright` with the
swiftshader flag set per repo convention; LOW strips + state traces (headless
HIGH renders ~0.3 fps — no HIGH strips); every trace sample must include
`captionText`, `auditText` (header + body), `objectiveId`, `markerLabel`,
`anchorId`, `shotId`, `appliedFovDeg`, `activePostFx`, `beat`, `t`.

1. **ch7 latch ladder (movie).** `?story=ch7-reconstruct&movie=1&profile=LOW`,
   200 ms trace over t=0–20 s asserting: M1–M6 each fire exactly once, in
   order, audit-before-caption at M1/M4/M5; frames at 500 ms over t=3–10 s
   (movie compression window). Movie proves flow, not pacing — record that in
   the report so no reviewer scores overwrite speed here.
2. **ch7 exit window (the money capture).** Frames at calibration receipt
   +0.0 / +0.4 / +0.8 / +1.5 / +2.4 / +2.8 / +3.5 / +4.8 / +5.2 / +6.5 s.
   Must show: M7 audit pill stamping over the 52° exterior reveal (first
   actual frames of `cin.reconstruct.09` ever captured — verify
   `appliedFovDeg: 52`, `cameraAuthority: cinematic-look`, `fx.reconstruct.09`
   in the same samples), M7 caption at +0.6, exit caption `the scar remains.
   now it can carry me.` fully revealed before advance, ch7-board overwrite
   after +5.0, audit-pill persistence over the black boarding frame (+5.2,
   +6.5). Also one standalone `?story=ch7-board` deep link proving no ch7 line
   replays (latch seeding).
3. **Reveal composition check.** In addition to the movie-path reveal frames
   (item 2), one deep-link run pausing input at calibration start from a
   stepped-back vantage if the probe harness permits repositioning; flag to me
   if the movie-path reveal frame is a degenerate close-up (§4 caveat). Taste
   judgment on those frames is mine, not the verifier's.
4. **ch8 hold cadence.** Standalone `?story=ch8-launch&movie=1&profile=LOW`
   AND the continuous chain from ch7. Frames at atmosphere exit +0.0 / +2.5 /
   +5.0 / +7.5 / +10.0 / +12.5 / +14–15 (L6 per signed value) / +17.0 /
   +18.0 s; trace asserting each stack row's exact text at its offset ±0.2 s,
   `CONTACT LOGGED.` holding its full slot, variant D
   (`ch8:launch:orbital-handoff`) publishing ~1.75 s into the hold across
   ≥3 cold runs, honest completion inside `BEAT_TIMEOUT` with zero timeout
   rescues, and `lastResetReason: beat-exit` with anchors cleared at advance.
5. **L2/L3 anchors.** Frames at ignition −0.5 / +0.2 / +0.7 and liftoff −0.5 /
   +0.2 / +0.7 / +1.5 s with caption text asserted in-trace (ignition's window
   may still be sub-sample per `openCaptureGaps[1]` — the trace, not the strip,
   is the proof there). Liftoff frames double as the tree-findability record
   for the routed §3 decision.
6. **Seam continuity.** ch6-dive exit → ch7 entry; ch7 exit → ch7-board (in
   item 2); ch8 hold → ch8-crossing entry (does the crossing parenthetical
   overwrite L6 mid-fade at the signed offsets? capture +16.5–18.5 s at
   500 ms); ch8-landfall → ch9 entry untouched-check (one strip, no text
   changes expected).
7. **Variants.** The §5 mobile (two viewports), reduced-motion (one full
   pass), and POTATO spot-checks.
8. **Performance.** Re-run the fps probe at the same three beats/viewport/
   tier; no regression vs. `evidence-hires/fps-baseline.json` (median 60.1).
   Copy-only surface — any regression is a red flag on something else.
9. **Sandbox no-op.** One sandbox (story-inactive) trace proving zero new
   strings render and the audit slot stays null.

---

## 7. Verdict

**(b) Sound with reservations — sign-ready once the reservations are absorbed
as contract terms; one item routes outside the run.**

1. **M7 over the reveal:** approved conditional on D9 **plus** a frozen ch7
   exit mini-cadence (§2.1 table). Without the cadence, M7's caption is
   structurally unrealizable (same-tick overwrite).
2. **ch8 exit hold:** approved as staged; strongest text surface in the run;
   stamping cadence is the window's visual rhythm. Reservation: give L6 a
   ≥3 s tail (L6 +14.0 or advance +18.0).
3. **Liftoff tree:** not findable in frame on the evidence; the line is
   currently unsupported on screen. Routed: bounded camera packet on
   `cin.launch.02-world-below` (recommended) or Chapter reword/retime
   (fallback). Not a blocker to contract signature provided the contract
   carries the open-support note in the dissent register.
4. **D9:** supported at ≈5 s; my signature is committed. It rescues the
   approved string, makes M7 realizable, and gives the chapter's only
   authored camera moment its first real screen life.

No separately-routed visual packet is required for the commission itself; the
single routed packet is the §3 liftoff item, scope bounded there.

### Owner taste questions

- Movie-path reveal: if the 5 s exterior reveal frames come back as a
  nose-to-hull close-up in movie mode, do we accept an abstract reveal on the
  autopilot path, or route the shot-defect packet before the demo cut?
- Caption ink on daylight terrain at mobile LOW (§2.3 watch item): if the
  captures come back marginal, is a caption scrim (UX renderer follow-on)
  acceptable, or is unplated ink a protected part of the awakening voice's
  look?

### Cross-notes queued for Stage 3

- **To Chapter:** (a) freeze the §2.1 ch7 exit cadence table with D9; (b) L6
  tail ≥3 s within R2's bound; (c) liftoff-tree routing decision per §3 —
  packet vs. reword; (d) intended-accept record for the M7 audit pill
  persisting ~1.5 s into ch7-board's boarding black.
- **To Score:** none binding (their lane is ruling-only too); observation
  offered — the hold window's visual rhythm is the 2.5 s stamp cadence and
  the drift streaks; the frame needs no scoring help to stay alive, so
  silence-forward readings of the window are compatible with the image.
- **To Integration:** the §2.1 and §6 offsets are named constants; the
  contract freezes relationships and values; the M7/exit same-tick hazard
  must be handled by the cadence, not by reordering latch checks.
