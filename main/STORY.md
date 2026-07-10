# Paravoxia — Story Mode (vertical slice: Prologue → Chapter 3)

**What this is.** The playable first act of the fidelity-ladder narrative
(design: `../PARAVOXIA_PROGRESSION.md`, plan: A0→A3). Rendering fidelity IS the
story: the game opens as a 1-bit terminal, becomes a monochrome CCTV "Regulation
Feed," gains color at A1, depth/freedom at A2, and texture + time at A3, then
hands off to the sandbox at reality stage `material`.

## Playing it

- **Menu → "◈ Story"** (next to Play; label becomes "Continue Story" mid-run).
- Dev deep links: `?story=1` (full run from the terminal prologue) and
  `?story=<beat>` for EVERY beat (`crawl|manifest|voyage|deflect|crash|descent|
  ch1-fixed|ch1-track|ch1-raster|ch1-depth|ch1-nav|ch1-iso|ch1-lift|
  ch1-anomaly|a1-ramp|ch2-color|ch2-approach|a2-awakening|ch3-gather|ch3-dusk|
  ch3-await-rest|a3-dawn|done`) — before/plays/after coverage of every
  awakening, with milestone/item/campfire/stage seeding per beat. Legacy short
  aliases (`ch1|a1|ch2|a2|ch3|a3`) still work. `?voxelStage=` stays independent.
- **Story debug panel** (any `?story=` session or `?debug=1`): a "⛿ STORY" chip
  on the left edge — beat teleporter (navigates by URL+reload so state is always
  fresh), plus "▶ movie run", "sandbox menu", and "wipe save".
- **Pristine dev worlds**: any `?story=` session clears the story world's
  persisted terrain edits at boot (`clearVoxelEditsForWorld`) — debug runs no
  longer inherit each other's strip-mining. The menu path (Continue Story)
  keeps the player's real edits.
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
  Headless validation: `window.__storyBeat` + `window.__autopilot` (beat,
  goal, keys, drift) — scratchpad `beat-probe.mjs` / `pilot-trace.mjs` /
  `ladder-strip.mjs`.

The slice (a history of games — see PARAVOXIA_PROGRESSION.md "gaming through the
decades"): regulation crawl → **MANIFEST** (berthing/processing: the notice
becomes YOUR ticket) → Oregon-Trail voyage: a **BRANCHING DECK** (3 spine cards
+ 2 pool draws + choice-unlocked follow-ups, capped at 6) over a **Maze-War
wireframe** (vector hauler + starfield + the destination cube world growing
with progress); choices carry real consequences (items / vitals / harvester
cell) and echo in Ch1's paperwork; the final ledger becomes the crash (hull →
debris count, rations → arrival hunger, compliance → tone) → the **nav-anomaly
bridge card ORDERS you to the intake shield** → debris-deflection Pong
(unwinnable as the anomaly multiplies) → terminal corruption → `[F] BRACE` →
**DESCENT**: the crash landing played IN the raster lens (pod streaks down the
2D frame, white-flash impact, smoking wreck persists as a landmark) → **THE
MONOCHROME LADDER** — chapter 1 climbs the real history of game perspectives,
one era per rung, every transition a single camera move (the lens RIG lerp):
**ch1-fixed** (Pitfall/Space Invaders: the frame is BOLTED — walking off the
edge hard-flips the screen; tutorial: move + hold-to-extract, 3 fiber + cross 2
screens) → **ch1-track** (~7s mini-awakening: "OPTICAL TRACKING ENABLED" — the
quantized anchor lerps to continuous follow; the frame unbolts and catches up
to the worker) → **ch1-raster** (Mario/Defender: side-scroller quota
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
Wolfenstein's rung) →
`[F] Touch` the anomaly stone → **A1** 8s chroma ramp → **Ch2** color-but-flat
feed, the redacted apple tree (`[F] Eat` up close) → **A2** violation flood,
HUD death, 12s liberation into free 3D at frozen noon → **Ch3** craft the
campfire chain (whitelisted Fabricator), first-dusk cutscene, `[F] Rest` at the
fire at night → **A3** dawn material ramp → story completes, sandbox continues.
Pre-A2 chapters render NOTHING smooth: cube pebbles, voxel pod/debris, no ship,
no berries — the anomaly stone is the deliberate first continuous form.

**Consciousness staging:** the external-camera eras are PRE-conscious — the
captions there are impersonal ("the frame did not follow you", "how is that
word known?"). The 2D→3D lift is the birth of sentience: "the seeing is being
moved inside." → "i—", the story's first pronoun (the feed answers:
"PERSPECTIVE ISSUED. PRONOUNS WERE NOT."). Survival senses are INTRODUCED one
by one in ch3 ("things can be held", "why am i… thirsty?") — the inventory and
vitals HUD appear WITH their captions (`storyHudHideVitals/Inventory`,
milestone-gated; pure sandbox saves unaffected). The post-A3 `done` world is
the pinned story world at `material`: trees + grass only — flora and fauna
stay dormant for a later awakening (A4 "Breath"), via the milestone-driven
`storyLifeDormant()` (never stage-driven — cutscene effect ramps can't flash a
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
