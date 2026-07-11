# Paravoxia — Story Mode (Prologue → Chapter 4's arrival)

**What this is.** The playable first act of the fidelity-ladder narrative
(design: `../PARAVOXIA_PROGRESSION.md`; chapter-4 contract:
`../PARAVOXIA_CH4_PLAN.md`). Rendering fidelity IS the story: the game opens as
a 1-bit terminal, becomes a monochrome CCTV "Regulation Feed," gains color at
A1, depth/freedom at A2, texture + time at A3 — then plays THE FIRST DAY ALIVE
(thirst → forage → the klaxon → the scheduled sleep) and ends, for now, on
chapter 4's arrival: the other worker, W-7744. TEMPORARY TERMINAL: the arrival
completes the story (sandbox at `material`); `ch4-audit` continues from there
(see the plan doc §2 S6 and the marked hand-off in `storyDirector.ts`).

## Playing it

- **Menu → "◈ Story"** (next to Play; label becomes "Continue Story" mid-run).
- Dev deep links: `?story=1` (full run from the terminal prologue) and
  `?story=<beat>` for EVERY beat (`crawl|manifest|voyage|deflect|crash|descent|
  ch1-fixed|ch1-track|ch1-raster|ch1-depth|ch1-nav|ch1-iso|ch1-lift|
  ch1-anomaly|a1-ramp|ch2-color|ch2-approach|a2-awakening|ch3-gather|ch3-dusk|
  ch3-await-rest|a3-dawn|ch3-thirst|ch3-forage|ch3-signal|ch4-vigil|
  ch4-arrival|done`) — before/plays/after coverage of every awakening, with
  milestone/item/campfire/stage seeding per beat. Short aliases
  (`ch1|a1|ch2|a2|ch3|a3|day|ch4`) work (`day` = the first-day tail, `ch4` =
  the vigil). `?voxelStage=` stays independent.
- **Story debug panel** (any `?story=` session or `?debug=1`): a "⛿ STORY" chip
  on the left edge — beat teleporter (navigates by URL+reload so state is always
  fresh), plus "▶ movie run", "sandbox menu", and "wipe save".
- **Pristine dev worlds**: any `?story=` session clears the story world's
  persisted terrain edits AND its saved player pose at boot
  (`clearVoxelEditsForWorld` + `clearPlayerPoseForWorld`) — debug runs no
  longer inherit each other's strip-mining, and a pose saved in a mined pit
  can't resurrect inside the restored terrain. The menu path (Continue Story)
  keeps both.
- **Spawn discipline**: the monochrome ladder ANCHORS to the deterministic
  arrival site — while prologue/ch1 run, saved poses never override the spawn
  (`storyAnchoredSpawn`), so the 2D eras always start ON the work row, never
  off-row or in the pond. And the world must EXIST before anything acts: the
  spawn-settle guard (`game/spawnSettle.ts` + EfficientPlayer) pins the body at
  its spawn until ground colliders stream in under it (probe or 8s cap), the
  descent cutscene holds at t=0 behind the BRACE white-out on the same signal,
  and the movie autopilot won't push (or rescue-nudge) an unsettled player —
  no more falling through a still-loading planet, camera and all.
- **Survey chart** (`[M]`): a live straight-down overhead of the current face —
  the nav era's vantage retained as a tool (grid chrome, `hud/MapOverlay.tsx`,
  camera via `applyOverheadCameraTransform`). Story saves unlock it by
  completing `ch1-nav`; pure sandbox saves always have it. Free-look, free-move
  beats only; extraction is disabled while the chart is open.
- **Movie mode** (`&movie=1`, or the panel's ▶ button): a story autopilot
  (`story/autopilot.ts`) screens the whole arc unattended — auto-answers the
  voyage cards, plays a competent-but-doomed Pong paddle, paces the raster strip
  holding EXTRACT, walks to the stone/tree/fire via the cinematic look-pull and
  pulses [F], skips UI-driven crafting by placing the fire directly, and every
  beat has a TIMEOUT that force-advances — nothing can stall the screening.
  Watch it like a film; critique the cut. Pilot guarantees: extraction only
  chews quota-feeding blocks and never the block underfoot (the movie cannot
  dig itself into a pit); goals are COMMITTED (no flip-flopping) with deferral
  when one keeps eating rescues; gait distance is horizontal+climb (never
  strands "close" to elevated goals); the stuck watchdog measures HORIZONTAL
  stillness (jump-bounce reads as stuck) and escalates hop → reverse →
  teleport-nudge toward the goal; an arrived-but-inert goal gets a gentle shove.
  The first-day beats add FLOW guards: the pilot answers each sensation only
  after its cue has landed (drinks after the seek cue, eats after the sight
  cue, sprints after the summons) — pacing may differ from a player, flow may
  not. SHOT DISCIPLINE: every pilot look-at aims at the SUBJECT (goal + lift,
  rising as the walk closes) so arrivals and the cutscenes they trigger never
  fire while staring at the ground; the self-driving awakenings get held
  movie framings (a1-ramp looks over the stone into the greening world,
  a2-awakening holds the tree's crown); chroma flashes defer past each beat's
  opening 4s so era hand-offs land clean. Headless validation: `window.__storyBeat` + `window.__autopilot` +
  `window.__auditWorker` — in-repo `story-probe.mjs` (beat flow + per-beat fps)
  and `story-strip.mjs` (beat-stamped frame strips), both Linux-pathed
  (playwright chromium + swiftshader).

The slice (a history of games — see PARAVOXIA_PROGRESSION.md "gaming through the
decades"): regulation crawl (stars drifting behind the text) → as the last words fade the
**HAULER FLIES INTO FRAME** — the real ship's own silhouette (hull stations,
delta wings, wingtip fins, tail fin from `utils/shipDesign.ts`) on ONE
persistent phosphor vector layer (`prologue/PrologueVector.tsx`) that every
terminal phase plays inside — **MANIFEST** (berthing: the ship holds at a dock
gantry while your designation is issued) → Oregon-Trail voyage: the ship
ALIGNS into formation; a **BRANCHING DECK** (3 spine cards + 2 pool draws +
choice-unlocked follow-ups, capped at 6) while the destination cube world
grows and the ship RESOLVES more edges with transit (detail layers — the
fidelity ladder in miniature); choices carry real consequences (items / vitals / harvester
cell) and echo in Ch1's paperwork; the final ledger becomes the crash (hull →
debris count, rations → arrival hunger, compliance → tone) → the **nav-anomaly
bridge card ORDERS you to the intake shield** → **THE DIVE** (~3.6s): debris
streams off the planet, the ship banks and runs for it, the camera chases as
the cube swallows the frame, and the picture collapses to a CRT scanline —
which the oscilloscope court RE-EXPANDS from (no frame ever swaps) →
debris-deflection Pong
(unwinnable as the anomaly multiplies) → terminal corruption → `[F] BRACE` →
**DESCENT**: the crash landing played IN the raster lens (pod streaks down the
2D frame, white-flash impact, smoking wreck persists as a landmark) → **THE
MONOCHROME LADDER** — chapter 1 climbs the real history of game perspectives,
one era per rung, every transition a single camera move (the lens RIG lerp):
**ch1-fixed** (Pitfall/Space Invaders — diegetically the watcher CUTTING
BETWEEN FIXED SITE CAMERAS: "COVERAGE IS CELLULAR. CAMERAS DO NOT MOVE.
WORKERS DO." Walking off the edge hard-flips to the next coverage cell with a
static blip and the HUD's `SITE CAM 04-A → 04-B` tag change; through the beat
the watcher's amused observations of the worker land as captions ("it walks.
it stops. it hums at the ground…"); tutorial: move + hold-to-extract, 3 fiber
+ cross 2 screens) → **ch1-track** (~7s mini-awakening, THE FIRST ACT OF
ATTENTION: "CAMERA HAND-OFF: SUSPENDED. ONE VIEW STAYS WITH YOU." — the
watcher stops cutting away because it is interested; the quantized anchor
lerps to continuous follow while the cam tag reads `· HOLDING` and the truth
peeks through once, lowercase: "(simpler to keep watching this one.)") → **ch1-raster** (Mario/Defender: side-scroller quota
fiber/stone + **hull-debris salvage** walk-over pickups granting wood/flint) →
**ch1-depth** (Double Dragon: "LATERAL CLEARANCE ±3.5m" opens W/S across a
shallow belt-scroll band; recover 3 off-line **supply pods** — biofuel/flint/
wood, the campfire chain earned honestly) → **ch1-nav** (Pac-Man, diegetically
reordered: the rig lerps to straight-down NAV VIEW with a map grid; reach 3
**triangulation fixes** IN ORDER, survey marker guiding) → **ch1-iso** (Zaxxon:
the rig settles at 45°/45°, dpr ratchets 0.4→0.55 under a glitch — HEIGHT
exists now; climb the stepped **signal mesa** to the stone) → the **2D→3D
LIFT**: a ~7s letterboxed cutscene where the camera physically travels from the
ISO vantage INTO the worker's eyes (sprite dissolves, one masked resolution
snap 0.55→0.85) → **CCTV feed** (pan-tilt: compass-snapped yaw + tilt band,
Wolfenstein's rung), staged ONE GOAL AT A TIME: stage 1 the **calibration
sweep** (the era's own verb — traverse the view across ≥6 of 8 compass sectors;
no marker, no [F]) → stage 2 the survey returns the DEVIATION (marker + order
land, the touch arms `ANOMALY_SURVEY.armSeconds` later) →
`[F] Touch` the anomaly stone → **A1** 8s chroma ramp (work order cleared — a
clean frame for the awakening) → **Ch2** color-but-flat feed WITH A FREED NECK
(the pan-tilt interlock fails with the chroma suppressor: full free look +
camera-relative diagonals; the feed keeps only its chrome), the redacted apple
tree (`[F] Eat` up close) → **A2** violation flood,
HUD death, 12s liberation into free 3D at frozen noon → **Ch3** craft the
campfire chain (whitelisted Fabricator), first-dusk cutscene, `[F] Rest` at the
fire at night → **A3** dawn material ramp → **THE FIRST DAY ALIVE** (no cut —
the story simply doesn't end): **ch3-thirst** (THIRST seeded already-falling,
named on cue, answered at the pond's `[F] Drink`; waterskin joins the craft
whitelist) → **ch3-forage** (HUNGER named; berries walked over, eaten `[G]`;
the "as if it knew i was coming" pillar plant) → **ch3-signal** (the klaxon:
the regulation voice RETURNS as the AUDIT band — text over the living world,
never the feed — and the sprint to the wreck names STAMINA mid-run) →
**ch4-vigil** ("SLEEP IS SCHEDULED AT DARK": dusk-2 via the DUSK grammar, the
ordered `[F] Rest`) → **ch4-arrival** (~45s: dawn 2, the letterbox returns
WITH the system's agent — W-7744 walks the work strip past the player to the
wreck relay, "WORKER W-7743. YOU ARE FOUND.", one 2-frame BARE-BLINK of his
seeing) → story completes (TEMPORARY — ch4-audit next), sandbox continues.
AMBIENT MUSINGS: during lulls of the first-day stretch (45–75s of caption
silence), one-shot-per-save epiphany captions fire from a curated pool
(`story:musing:*` milestones) — aimlessness rendered as purpose forming.
Pre-A2 chapters render NOTHING smooth: cube pebbles, voxel pod/debris, no ship,
no berries — the anomaly stone is the deliberate first continuous form.

**THE HIDDEN PILLAR (read PARAVOXIA_PROGRESSION.md § "The third reading"):**
the narrator is the ROUTE INTELLIGENCE — the AI that ran the terminal, the
ledger, the paddle, and the feed — embodied by the crash into the worker's
senses, inside a universe it may itself have provisioned. All copy must
survive both readings (corporate dystopia / the AI's biography); plant, never
tell. The voyage's late-transit lowercase intrusions, "ROUTE INTELLIGENCE:
ATTACHED (ADVISORY)", "ADVISORY CAPACITY EXCEE", and ch1-track's
"(simpler to keep watching this one.)" are the planted seeds.

**Consciousness staging:** the external-camera eras are PRE-conscious — the
captions there are impersonal observations OF the worker, amused by its
monotony ("it walks. it stops. it hums at the ground until the ground gives up
a fiber. it walks again.", "how is that word known?") — never "i". The 2D→3D lift is the birth of sentience: "the seeing is being
moved inside." → "i—", the story's first pronoun (the feed answers:
"PERSPECTIVE ISSUED. THE FIRST PERSON WAS NOT."). Survival senses are a SELF-DISCOVERY
ARC — each suit-HUD stat appears the first time its sensation is felt
(`storyStatVisible` + `story:sense:*` milestones; pure sandbox shows all):
ch3 opens with HEALTH only; "things can be held" brings the inventory; then
the CHILL — a story-scoped temperature model (`tickStoryChill`: warmth drains
in the open, recovers by fire, never lethal) makes TEMP appear ALREADY FALLING
("warmth. i have it. it is leaving.") so the campfire is a response to cold,
never to thirst; by the fire at night: "ah — it helps. what is it? how did i
know to make it?" (the pillar, planted). Post-dawn the first-day SCENES own
the remaining senses (the shipped TEMP pattern, one per scene): ch3-thirst
seeds thirst already-falling and names it on cue; ch3-forage does hunger;
ch3-signal names STAMINA during the klaxon sprint. `senseDiscovery.ts` keeps
the live-threshold checks as fallbacks for the settled world (it skips a sense
while its scene's beat runs); oxygen/jet stay silent-on-first-use and the MAW
readout appears on first refuel until their chapter-4 scenes land (plan §2
S11–S13). The post-arrival `done` world is the pinned story world at
`material`: trees + grass only — flora and fauna stay dormant for A4 "Breath"
(`storyLifeDormant()`, milestone-driven — cutscene effect ramps can't flash a
glimpse).

**The A3 bloom wave** (`game/lifeReveal.ts`): during the dawn's material ramp,
every grass blade and tree carries a radial growth factor in its vertex shader
(`lifeRevealGrow` — one multiply, no-op radius 1e9 in sandbox). The director
arms the reveal at radius 0 the moment the ramp begins (fields un-cull into
invisibility — no pop), lets the grain captions land, then drives the front
outward from the rest spot: blades rise around the feet slowly enough to
watch, then the wave accelerates to the horizon (`radius = R·smoothstep^1.6`,
softness widening with distance) under the score's dawn build. Timing knobs in
`A3_TIMELINE` (bloomWaveDelaySeconds/bloomWaveSeconds/bloomWaveRadius).

## Architecture (all story code in `src/story/`)

| Piece | File | Role |
|---|---|---|
| State | `storyState.ts` | Chapter/beat store (appState pattern); checkpoints persist as `story:*` milestones in the existing global save; `?story=` parsing; `stageForStoryPoint` (resume → reality stage) |
| Director | `storyDirector.ts` | Beat entry side-effects + per-frame timelines (flash scheduler, A1/A2/A3, Ch3 sun); owns the forced day phase until completion |
| Driver | `StoryDirectorDriver.tsx` | In-Canvas `useFrame` tick (shader + DOM values land same frame); FOV easing; redaction projection |
| Input policy | `storyInputPolicy.ts` | THE sandbox gate: frozen allow-all `SANDBOX_POLICY` when inactive; per-beat move/jump/sprint/build/craft/recipe/interaction/look constraints; director live-mutation hooks |
| Feed camera | `feedCamera.ts` | Compass-snapped yaw + CCTV tilt band ([−0.55, +0.35] rad) on the same refs as free look; `feedBlend` opens it during A2 |
| Lens rig | `sideLens.ts` + `world/SideWorkerAvatar.tsx` | The monochrome ladder's ONE external camera: `LensRig` (elevation/azimuth/distance/followQuant/depthBand) — side profile, bolted fixed-screen, belt band, top-down, iso are all rig values; `setLensRig(rig, seconds)` blends whole frames (eye/target/up) so every era hand-off is one camera move; `rigMoveBasis` gives screen-relative movement at any elevation; plane lock / band clamp in EfficientPlayer; harvest probes; worker sprite |
| Feed runtime | `feedRuntime.ts` | Mutable per-frame store (WarpOverlay pattern) for the DOM overlays |
| Overlays | `StoryOverlays.tsx` → `prologue/*`, `feed/*`, `StoryCaptions.tsx`, `transitions/SleepFade.tsx` | All DOM, rAF-driven, zero per-frame React |
| Post-feed chrome | `AuditBand.tsx` (regulation voice AFTER the feed's death: caps top band on a dark pill, below the letterbox line; `storyText` channel `audit`) · `FreeMarker.tsx` (free-era survey designator: lowercase diamond/chevron off the same `feedRuntime.marker` struct the driver projects) | The system speaks INTO the player's world; it no longer owns the screen |
| Ch4 world | `world/WreckRelay.tsx` (the network's console at the crash strip; ember lamp breathes from the klaxon on; `wreckRelayHandle`) · `world/AuditWorker.tsx` (W-7744: director-driven voxel body, metronome gait, ember visor; module pose store + `__auditWorker` probe) · `storyWorld.ts` `getPondPose` (deterministic nearest-water scan, cached, test-pinned) + `getAuditWorkerPath` + `storyAnchors` (pond/path/seed handles set by StoryWorldProps) | The director never learns planetSize; components feed it live anchors |
| Text | `storyScript.ts` (ALL copy + timings) · `storyText.ts` (channels: workorder/violation/caption/system) | Two voices: REGULATION (caps, euphemism) vs awakening (lowercase, sensory) |
| Score | `storyScore.ts` | Fully procedural WebAudio film score: per-beat moods with CHORD PROGRESSIONS (2-bar cycles, ostinato transposes), a generative melody lead through a tempo-synced delay, humanized velocities; `setScoreBeat`/`setScoreIntensity` (the director's own ramps) + `scoreHit('braam'\|'bloom'\|'boom')`. When no beat leads, the CELESTIAL IDLE BED holds a soft consonant pad under the streamed music (the instrument recedes, never leaves) |
| Music primitives | `audio/musicPrimitives.ts` | The GLOBAL rails both engines read: era (reality stage → music fidelity: recorded layers fade in as the world resolves), warmth (daylight), wonder (night/space/underwater), tension/energy (the story's drama rails, warp in sandbox), plus the shared harmonic center (root + chord, published by the leading engine). AudioDirector computes world truths per frame and feeds `resolveMusicMix`; prologue/ch1 keep the streamed layers at the transit bed (lo-fi era), ch2+ blends them back in under the score |
| World | `world/storyWorld.ts` (pinned verdant `STORY_COORDINATE`, deterministic prop poses relative to arrival) · `world/AnomalyStone.tsx` · `world/HeroAppleTree.tsx` | Hero tree pins its own reality uniforms (`organic:1`) so it lives while the world is `bare`/`color` |

**Sandbox safety:** every touched sandbox file (App, EfficientPlayer,
CameraControls, EfficientScene, SkyController, CraftingPanel, HudCornerActions,
interactionSystem, AudioDirector) checks the policy/story state and is a no-op
when story is inactive. `storyInputPolicy.test.ts` asserts the frozen sandbox
policy; `SkyController`'s forced phase is `?dayphase=` ?? story (null outside).

**Day/night during story:** the director owns `setStoryForcedDayPhase`
(regulation noon → scripted dusk lerp → natural night roll → pre-dawn wake) so
the cycle works on every graphics tier; the world clock is released with a
computed offset at completion. Quit-to-menu always clears the forced phase.

## Verification

- `npm run verify` — story tests live in `src/story/*.test.ts`
  (policy no-ops, feed camera math, director beat flows incl. full Ch3→A3 run,
  pinned world stability).
- Visual: `?story=ch1` (mono feed), `?story=ch2` (color feed), `?story=a2`
  (redaction; pair with `&agent=1` + `window.__storyTree` to frame the tree),
  `?story=a3` (night). Sandbox regression: plain Play + `?voxelStage=`.
- Needs a live playtest (agent captures have no player): pointer-lock feel of
  the snap-look, A1/A2 pacing, campfire rest at night, reload-resume at each
  checkpoint.

## Known gaps / next

- Prologue number keys (1/2/3) don't select card options (mouse only).
- Esc during A1/A2 opens the pause menu over the cutscene (director clock keeps
  running; acceptable, revisit).
- Touch/mobile story pass untested.
- A2's camera choreography is FOV+constraint release only — the planned
  ortho→perspective projection pull is a future upgrade.
- Vitals don't refill on rest (candidate: `feed/drink` on A3 wake).
- Side-scroller terrain: the locked plane can meet >1-block walls on rough
  seeds; step-assist + jump handle most of it, but the travel strip deserves a
  flatness assertion after a feel playtest.
- Ch3 timber comes from wreck salvage (granted on ch3-gather entry with a
  caption) because trees are still hidden at the `color` stage — revisit if a
  future pass wants the wood gathered rather than given.
- Perf: life fields (grass/tree/flora/fauna) now fully cull (draw + sim) while
  the reality stage hides them (`lifeFieldsHidden`); the feed overlay's
  backdrop-filter leaves the compositor at identity; A2 snaps dpr once during
  the HUD-death chaos instead of lerping framebuffer sizes through the
  liberation.
- The iso era's "place blocks to climb" build tutorial was cut in favor of the
  jump-climb (no terrain-voxel placement API exists; structure pieces would be
  clunky). First build stays with ch3's campfire. Revisit if terrain placement
  lands.
- In ch1-anomaly the player usually starts ON the mesa beside the stone (the
  lift froze them there) — the feed era is the first-person LOOK, then touch.
  Direct jumps to ch1-anomaly spawn at the strip and must climb the mesa stairs
  (feed policy has no jump; step-assist handles the 1-block treads).
- **Chapter 4 is TEMPORARILY terminal at the arrival** — `tickArrival` ends in
  `completeStory()` behind a marked `// TEMPORARY` comment; `ch4-audit` and the
  rest of the chapter (compliance, defiance, the A4 exhale, meat/dive/repair/
  flight) are contracted in `../PARAVOXIA_CH4_PLAN.md` §2 S6–S13.
- The pinned world's pond↔wreck run is short (~15u), so the klaxon sprint names
  STAMINA early in the run rather than emptying the bar (`SIGNAL.staminaCueBelow
  78`); the exhausted line still exists for longer runs.
- JET still self-discovers silently on any airborne hold-jump (movie hop-holds
  trigger it) — the S13 `allowJet` policy gate will hold it for the first-flight
  scene.
- The arrival's 2-frame bare-blink can't be caught by 4s strip captures (by
  design — it is the shipped flash machinery inverted); verify by eye in a live
  run if it's ever suspected broken.
- Legacy slice-complete saves (`story:complete` without `story:ch4:arrived`)
  resume at `ch3-thirst` and the menu shows "Continue Story" again — intended.
- The movie's a1-ramp framing (look over the stone toward the horizon) still
  reads sky-heavy from the mesa top — composition knobs live in autopilot's
  a1 framing block; retune after an owner screening.
- The spawn-settle hold shows the dark feed chrome (plus the BRACE flash decay)
  for the load beat (~2–4s headless) before the descent begins — if a heavier
  device makes the hold long, consider a diegetic "SIGNAL ACQUIRING…" line on
  the feed during it.
- Ch2's freed look means the A2 liberation is carried by FOV + treatment +
  resolution only (no camera-cage opening) — revisit if the moment reads
  thinner in a playtest.
