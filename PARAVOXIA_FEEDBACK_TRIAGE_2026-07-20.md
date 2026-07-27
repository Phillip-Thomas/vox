# Paravoxia owner-feedback triage — 2026-07-20

Scope: ten owner feedback items received 2026-07-20. This document records the
scouted root cause, the workflow lane per the handoff chooser
(`CLAUDE_FABLE_HANDOFF_2026-07-20.md` §4.6), and the bounded fix plan for each.
Scouting was read-only (three opus Explore agents). No code has been changed.

Standing rules for every batch below:

- Preserve the dirty worktree; no resets/cleans; evidence binds to new run
  directories, never edits to frozen production locks.
- Guided-play changes require verifier lifecycle evidence **and** a fresh
  read-only `player-experience-auditor` report.
- Close each batch with full `npm --prefix main run verify` (and server verify
  if shared behavior changes), not just focused tests.
- Nothing here grants creative acceptance or publish authority.

---

## Item-by-item findings and fixes

### 1. No mobile joystick in early 2D chapters — **root cause found**

`TouchControls` mounts only when
`!storyHudTakeover(story) || storyUsesEmbodiedGuidanceHud(story)`
(`main/src/App.tsx:1631-1640`). `storyHudTakeover` is true for all of ch1/ch2
(`main/src/story/storyState.ts:737-740`) and `storyUsesEmbodiedGuidanceHud`
only turns on at `ch1-anomaly` (`storyState.ts:749-753`). So every embodied
beat before `ch1-anomaly` (`ch1-fixed` harvest, `ch1-raster` debris, etc.) has
**zero movement control on mobile**. Prologue overlays are separate keydown-owned
screens and correctly need no joystick.

**Fix:** mount a movement-only touch control (joystick, no look/action cluster
if the fixed-camera era doesn't need them) during external-camera ch1 beats
that require player locomotion. Gate on "beat requires embodied locomotion"
rather than the anomaly boundary. Verify the authored fixed-camera input
takeover still wins for the pure-overlay beats.
**Lane:** Batch B (mobile/HUD design run) — guided-play affecting, so verifier
+ UX audit required.

### 2. Early ch1 pickups have no directional indicators — **intentional gap, now a design decision**

Two mechanisms suppress markers before `ch1-depth`: the objective resolvers set
`requiresMarker=false` for `ch1-fixed`/`ch1-track`/`ch1-raster`/`ch1-lift`
(`main/src/story/storyObjectiveGuidance.ts:122-170`), and
`surveyMarkerTarget()` has no case for them
(`main/src/story/StoryDirectorDriver.tsx:73-112`). `descent` has no objective
at all. First marker appears at `ch1-depth`. These are the fixed-camera/CCTV
2D-era beats, so the omission was authored, not a regression. The journey
contract lists these as objective beats but does not require markers for them.

**Fix:** Creative Triad **delta**: Chapter Director decides the in-fiction
presentation (likely a screen-space CCTV-style target highlight rather than the
3D diamond, honoring the era's visual grammar), Cinematography owns visible
routing/occlusion in the fixed-camera frame, Integration wires it, UX audits
it. Score stays closed. Update `requiresMarker`, add `surveyMarkerTarget`
cases (or an era-specific highlight channel), and extend the journey contract
so calibration/pickup beats now require an indicator.
**Lane:** Batch C — Creative Triad delta.

### 3. ch1-nav autopilot strands the player in water — **root cause found**

The ch1-nav case uses `walkTowardLens()` (`main/src/story/autopilot.ts:1207`),
which calls the dry-route planner but **never sets `controls.jump`** — unlike
`walkToward()` (`autopilot.ts:785`), so a planned jetpack water crossing can be
computed but not executed; the pilot steers into the shoreline until the stuck
watchdog hops it. Secondary gaps: nav beacons are seeded without a dry-route
guarantee (`main/src/story/world/NavBeacons.tsx:43`), the planner degrades to a
straight walk when terrain is unavailable (`autopilot.ts:485-497`), and
shoreline local minima outside the two egress route reasons never replan
(`autopilot.ts:500-505`). The journey contract already promises "a dry or
intelligent jetpack route" (`main/chapter-journey-contract.json:247`) — the
executor just can't fly.

**Fix:** propagate `step.action === 'jetpack'` into `walkTowardLens` (mirror
`walkToward`), add dry-route validation to ch1-nav beacon placement, add a
water-strand replan for non-egress local minima, and add a ch1-nav
escaped-defect scenario to the journey contract (do this alongside the
handoff's pending ch1 cross-face scenario, §8 step 4). Prove with a continuous
trusted-input trace, not direct entry.
**Lane:** Batch A — system-orchestrator pattern.

### 4. Music silent on mobile — **three candidate causes; touches protected audio paths**

The unlock chain is wired correctly for touch
(`installGameAudioUnlockOnFirstTrustedGesture` listens to `touchstart`,
`main/src/audio/gameAudio.ts:43-64`), but three silent paths exist:

1. **iOS mute switch** — the entire mix is WebAudio direct to
   `ctx.destination` with no `<audio>` element / `playsinline` route, which
   iOS silences under the ringer switch.
2. **One-shot unlock installer** — the gesture listener removes itself after
   the first trusted gesture even if `resume()` didn't stick
   (`gameAudio.ts:54-58`); deep-link `?story=` entries have no LandingMenu
   fallback, leaving the context permanently suspended.
3. **iOS `interrupted` state** — `unlockAudio()` only resumes when state is
   `'suspended'` (`main/src/audio/audioCore.ts:119-122`); an `interrupted`
   context is never retried.

**Fix (defensive, covers all three):** re-arm the unlock listener until a
resume verifiably sticks (`context.state === 'running'` after settle); treat
`interrupted` like `suspended`; add the silent-switch-safe playback route for
iOS; add a lightweight on-device audio-state debug readout to confirm which
path fired. **Owner input wanted:** device/OS/browser where music is silent,
and whether SFX are also silent (distinguishes cause 1 from 2/3).
**Authority note:** `main/src/audio/` is a protected path. This is a bounded
*mechanical playback* lane opened by this owner request — no score/mix intent
changes, Score Director stays closed, and the lane is recorded in the batch's
run notes.
**Lane:** Batch A — system-orchestrator pattern.

### 5. HUD should hide during letterboxed cinematics — **signal exists, nobody subscribes**

`CinematicFrame` draws the bars from `getFeedRuntime().cinematic` (0..1)
(`main/src/story/transitions/CinematicFrame.tsx:26-41`), set by the story and
emergent directors. No HUD component subscribes to it; HUD hiding today is a
side-effect of the ch1/ch2 `storyHudTakeover` gate, so any post-ch2 cinematic
letterboxes over a fully visible sandbox HUD (corner actions, minimap, vitals).

**Fix:** have the HUD root (`main/src/App.tsx:1588-1626` block and
`TouchControls` mount) subscribe to `feedRuntime.cinematic` and fade/unmount
chrome above a small threshold, restoring on scene end. Keep critical safety
warnings exempt per the mobile-HUD-declutter contract.
**Lane:** Batch B — mobile/HUD design run (shared files with items 1 and 7).

### 6. Rest opens too long after sunset; "night" is fragmented — **root cause found**

Two independent clocks disagree: rest gates on the scalar `dayPhase`
(`isHabitatNight` = 0.55–0.95, `main/src/story/tidegardenSettlement.ts:867`;
`DUSK.nightStart 0.55` with sunset at 0.5, `main/src/story/storyScript.ts:623-630`
→ ~12 s of post-sunset lockout at `DAY_LENGTH_SECONDS = 240`), while visual
darkness and temperature run on sun-elevation `daylight`
(`main/src/utils/dayNight.ts:23-25`; `atNight` = `daylight < 0.2`,
`main/src/game/systems/survivalVitals.ts:137`). The screen can be dark before
`dayPhase` says night.

**Fix:** introduce one shared `isNight` predicate derived from the
sun-elevation `daylight` signal (threshold tuned so rest opens ~5 s after
visible dark), and route `isHabitatNight`, the ch3/ch4 `DUSK` rest/vigil
gates, and `survivalVitals.atNight` through it. Re-verify the ch3/ch4
wait-for-night and Tidegarden safe-rest journey scenarios — these are
story-lifecycle-affecting, so verifier + UX audit apply.
**Lane:** Batch A — system-orchestrator pattern.

### 7. Chapter-select button unorganized — **dev panel outside the layout solver**

`StoryDebugPanel` is pinned at `position: fixed; left: 12; top: 38%` at toast
z-index (`main/src/story/StoryDebugPanel.tsx:113-125`), bypassing
`storyHudLayout.ts` and `hudChrome.ts`, so it can overlap left-edge story HUD
and the mobile joystick region.

**Fix:** rehome it in the governed chrome — either as a fifth disclosure owner
on the Quiet Field Rail (Journal/Suit/Pack/Systems/…) or inside the Systems
disclosure, styled with `hudChrome` primitives and placed via the layout
solver's occlusion rules. Keep it dev/story-gated as today.
**Lane:** Batch B — mobile/HUD design run.

### 8. Ch4 audit copy "I borrowed his eyes, I was there" — **story clarity question, not scouted yet**

Owner cannot tell whose eyes were borrowed or whether the line pays off later.
Given the hidden-narrator pillar, the line is plausibly the narrator claiming
presence through the worker's/CCTV viewpoint — but the both-readings copy law
requires it to earn its ambiguity, not confuse.

**Fix (docs/copy lane):** (a) `story-canon-auditor` (opus) traces the exact
line, its intended referent, and any planned payoff in the Bible / execution
plan / emergent batch plan; (b) `story-naive-reader` (opus) perception check on
the surrounding ch4-audit copy; (c) report both to the owner — if a payoff
exists, explain it; if not, Chapter Director tightens the line under the
both-readings law. **Caution:** ch4-audit is inside the public demo ceiling,
so any copy change goes through the story-review process and fresh naive-read.
**Lane:** Batch D — story-review (audit first, patch only if warranted).

### 9. Constellation graphics — **shader constants + seam gating, not frustum culling**

Constellations are drawn procedurally in the sky-dome fragment shader
(`main/src/utils/spaceSky.ts`); there is no Points/Line geometry and the dome
has `frustumCulled={false}`. The complaints map to:

- blobs → analytic Gaussian nodes at `CONST_NODE_SIZE 1200`
  (`spaceSky.ts:197,235`) — larger constant = smaller/sharper;
- faint lines → `CONST_LINE_WIDTH 0.010` + `CONST_LINE_GAIN 0.16`
  (`spaceSky.ts:198-199`) and `lineRamp` only reaching full strength at
  reveal≈1 (`spaceSky.ts:225`);
- "culling" → figures confined to a single drifting lattice cell wink in/out
  at cell seams (`spaceSky.ts:214,232,467`) plus reveal gating and daylight
  knockdown — no actual frustum culling involved.

**Fix:** Cinematography Director authors new node sharpness, line width/gain,
and ramp values; fix the seam winking (neighbor-cell lookup or keep figures
clear of seams); acceptance requires headed real-GPU captures (headless cannot
judge this). Add constellation coverage to `spaceSky.test.ts` for the
deterministic parts.
**Lane:** Batch E — Creative Triad delta, Cinematography lead, Score closed.

### 10. Sibling planets look stationary from the surface — **working as coded, below perception threshold**

The ephemeris IS applied on the surface (motion weight is 1 below
`spaceBlend 0.15`; no surface disable —
`main/src/components/SystemCompanionBodies.tsx:855-913`,
`systemCompanionBodiesModel.ts:180-190`). But peak drift is ~0.016–0.044 deg/s
(3–5° over 12–20 min, sinusoidal), below human motion-detection threshold
without a fixed reference; axial spin (0.375–0.75 deg/s) acts on a tiny
low-detail disk because the exact-terrain shell only activates in deep space.

**Fix:** retune for perceptibility, staying presentation-only: raise drift
amplitude/shorten periods to a target apparent rate (~0.1–0.3 deg/s so motion
is visible against a horizon/tree reference within ~30 s), consider making
spin legible (stronger surface albedo contrast on the far-body low-poly
shell). Preserve the bounded apparent-center guidance ray, pairwise
separation/reciprocity, and deep-space canonical convergence — the existing
model tests pin all of these. Headed visual confirmation from a planet
surface closes it.
**Lane:** Batch A — system-orchestrator pattern (model/params + tests), with a
quick Cinematography taste check on the chosen rate.

---

## Execution batches and order

| Batch | Items | Lane | Why grouped |
| --- | --- | --- | --- |
| **A — mechanical systems** | 3 (autopilot), 6 (night), 10 (ephemeris), 4 (audio unlock) | system-orchestrator pattern | Deterministic fixes with existing tests/contracts; no creative reopen. Opus does the mechanical work. |
| **B — HUD/chrome design run** | 1 (joystick), 5 (cinematic HUD hide), 7 (chapter select) | design-orchestrator sequence (like 2026-07-19 declutter) | All three touch the same chrome/layout files; one screenshot-evidenced run beats three overlapping patches. |
| **C — early-ch1 guidance** | 2 (indicators) | Creative Triad **delta** | Presentation decision in the CCTV era belongs to Chapter + Cinematography; Score closed. |
| **D — story clarity** | 8 (borrowed-eyes line) | story-review (audit → conditional patch) | Public-demo copy; perception evidence before any tightening. |
| **E — sky polish** | 9 (constellations) | Creative Triad delta, Cinema lead | Taste-critical shader look; needs headed real-GPU acceptance. |

Suggested order: **A → B → C → E → D** (D's audit can run in parallel with A
since it's read-only). Within A, do item 3 first — it shares the journey
contract scenario work the handoff already queues (§8 step 4).

Each batch: new dated run directory, evidence bound to an exact candidate
revision, full verify at close, `/clear` between batches per `CLAUDE.md`.

Owner answers (2026-07-20): iOS Safari, all sound silent; early beats get a
chapter-themed monochrome D-PAD (not the analog joystick); sibling motion
should match the galaxy env-map drift pace for cohesion.

---

## Status appendix — implementation wave closed 2026-07-20

All lanes executed same day; full `npm --prefix main run verify` green after
merge: 254 test files / 1,835 tests, typecheck, catalog, journey contract,
story authority, production build. Server untouched (no shared/protocol
changes), so server verify was not required.

- **Item 1 DONE** — `TouchDPad.tsx` (+model/tests), mounts on
  `ch1-fixed/raster/depth/nav/iso` only via `storyUsesEarlyTouchDpad`;
  regulation-feed monochrome ink theme; EXTRACT hold-button on the two
  harvest beats; mutually exclusive with TouchControls by predicate.
- **Item 2 OPEN** — early-ch1 directional indicators still deferred to a
  Creative Triad delta; presentation should share the d-pad's CCTV-era
  theming decision.
- **Item 3 DONE** — jetpack execution in `walkTowardLens` was already fixed
  in commit 3d68948 (scout was stale); real fixes: dry-landing nudge for nav
  beacons (`storyWorld.ts` via `findValidSpawnSite`), bounded shoreline
  replan (`shouldReplanDryWaterContact`, 8-frame wet threshold), and
  `ch1-nav-water-strand` escaped-defect entry in the journey contract +
  gate. Live pond-escape movie probe not yet run.
- **Item 4 DONE (device proof pending)** — iOS-only media-element output
  route (silent-switch immune) for BOTH music and SFX contexts; unlock
  listener re-arms until routes confirmed running; `interrupted` state +
  visibility/focus resume. Diagnostic: `window.__voxAudioDiag()`. Audio
  suite 259/259.
- **Item 5 DONE** — `CinematicHudVeil` + `useCinematicHudHidden()` fade the
  HUD (260 ms, React `inert`) when `feedRuntime.cinematic > 0.05`;
  CrashFlash/LavaHeatVignette stay outside the veil.
- **Item 6 DONE** — shared `main/src/utils/nightState.ts`
  (threshold daylight < 0.2, `NIGHT_START_PHASE ≈ 0.5054`, dawn 0.95, 5 s
  live dwell); habitat rest, ch3/ch4 dusk gates, and warmth drain unified.
  Rest opens ~1.3 s after sunset. Open taste call: ch3 sense captions can
  now be skipped by resting immediately.
- **Item 7 DONE** — StoryDebugPanel rehomed as a top-right `⛿` chip +
  disclosure in hudChrome primitives, in the mobile mutual-exclusivity set.
- **Item 8 CLOSED, no change** — canon trace: "his" = W-7744; line inverts
  the ch1 chroma-stutter and has two contracted release-gated payoffs (A4
  fault, Borrow verb). Bible refs :138, :500-502, :724-726.
- **Item 9 DONE (taste open)** — `CONSTELLATION_TUNING` in `spaceSky.ts`:
  node core 14000 + halo 1800/0.3, line core 0.0035/width 0.014/gain 0.34,
  line reveal completes at 0.7. Seam pop root-caused (volumetric lattice
  radial mismatch) and fixed exactly via cube-face 2D lattice, ~same ALU.
  Headed check URL: `?sky=constellation&dayphase=0.75&profile=low`.
- **Item 10 DONE (taste open)** — apparent drift pinned to 0.8× the sky's
  0.573 deg/s for every seed (period 150–240 s, amp ~10.9–17.5°); invariants
  preserved. Follow-ups: axial-spin legibility needs surface contrast
  (cinematography); sky freezes on non-animated profiles while bodies drift
  (pre-existing asymmetry).

- **Item 11 (added 2026-07-20, owner: "abrasive constant super low tone,
  beeping way too fast — make early music a smooth creamy build") DONE
  (owner ears open)** — Score Director recomposition of the chip era only:
  culprits were the continuous 110 Hz square pad-chip drone, high early
  `mood.sub` values (ch2-approach's triangle bass measured 7× ch1 RMS), and
  all-steps-filled square 8th-note ostinato at ~4 notes/sec. Changes:
  chip pad gain 0.08→0.05 and moved +1 octave; sub chip level 1→0.7;
  early mood.sub trimmed to 0.07–0.10; tempos eased (nav 120→104,
  raster 112→100, deflect 126→112); rests composed into patterns
  (~2 notes/sec); chip attack 0.008→0.024 s; new era-crossfaded darker
  ostinato filter curve. Awakening ramps + era ≥ material proven bit-exact
  untouched by new tests. Evidence: A/B WAVs + levels at
  `main/captures/score-early-rework/` (low end −6 dB where it dominated,
  brightness −10 dB on groove beats). story-verifier regression: audition +
  32-min soak all PASS (0 NaN/clip/silence, all handoff sweeps green);
  full verify green. Owner audition of after/ WAVs (esp. ch1-raster,
  ch2-approach) is the remaining gate.
  **Second commission (same day):** owner still heard the constant low tone
  at the intro — proven to be the LEGACY procedural music engine's authored
  storyTerminal "transit drone" (36 Hz sawtooth `rumble` 0.05 + ~34 Hz sine
  `pulse` 0.03, `musicDirector.ts` baseMixForScene), stacked ungated under
  the score for all of prologue+ch1 at ~12× the score's RMS; the first
  rework's score-only renders could not see it. Not a WebAudio bug (no
  double-start/unramped gains). Fix: storyTerminal procedural lanes zeroed;
  new `storyScoreLeads` duck in `resolveMusicMix` zeroes the seven ambient
  drone lanes whenever `isScoreMoodLeading()` (symmetric with the bed's
  duck; `ship`/`warp` exempt; sandbox/menu mixes untouched). Combined-bus
  proof: intro low<150 Hz −32.6→−59.2 dB (crawl), −33.9→−56.7 dB (raster);
  after-render bit-identical to score-only levels. 95/95 focused tests,
  full verify green, audition + 32-min soak + intro-combined battery all
  PASS, deterministic re-render bit-identical. Evidence:
  `main/captures/score-early-rework/intro-combined-{before,after}/`.
  Open owner taste call: keep the quiet streamed deepSpace texture at the
  intro, or open in pure score silence.

Headed/device checklist for the owner: iPhone silent-switch + deep-link +
interruption audio tests (see audio lane steps); d-pad look/feel across the
five beats; cinematic HUD fade during ch3-dusk/a3-dawn/ch1-lift; rehomed
chapter-select overlap check; constellation taste; sibling-drift cohesion
from a surface + ascent convergence glide.
