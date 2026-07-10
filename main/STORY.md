# Paravoxia — Story Mode (vertical slice: Prologue → Chapter 3)

**What this is.** The playable first act of the fidelity-ladder narrative
(design: `../PARAVOXIA_PROGRESSION.md`, plan: A0→A3). Rendering fidelity IS the
story: the game opens as a 1-bit terminal, becomes a monochrome CCTV "Regulation
Feed," gains color at A1, depth/freedom at A2, and texture + time at A3, then
hands off to the sandbox at reality stage `material`.

## Playing it

- **Menu → "◈ Story"** (next to Play; label becomes "Continue Story" mid-run).
- Dev deep links: `?story=1` (full run from the terminal prologue) and
  `?story=<beat>` for EVERY beat (`crawl|voyage|deflect|crash|ch1-raster|
  ch1-anomaly|a1-ramp|ch2-color|ch2-approach|a2-awakening|ch3-gather|ch3-dusk|
  ch3-await-rest|a3-dawn|done`) — before/plays/after coverage of every
  awakening, with milestone/item/campfire/stage seeding per beat. Legacy short
  aliases (`ch1|a1|ch2|a2|ch3|a3`) still work. `?voxelStage=` stays independent.
- **Story debug panel** (any `?story=` session or `?debug=1`): a "⛿ STORY" chip
  on the left edge — beat teleporter (navigates by URL+reload so state is always
  fresh), plus "▶ movie run", "sandbox menu", and "wipe save".
- **Movie mode** (`&movie=1`, or the panel's ▶ button): a story autopilot
  (`story/autopilot.ts`) screens the whole arc unattended — auto-answers the
  voyage cards, plays a competent-but-doomed Pong paddle, paces the raster strip
  holding EXTRACT, walks to the stone/tree/fire via the cinematic look-pull and
  pulses [F], skips UI-driven crafting by placing the fire directly, and every
  beat has a TIMEOUT that force-advances — nothing can stall the screening.
  Watch it like a film; critique the cut.

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
2D frame, white-flash impact, smoking wreck persists as a landmark) → **Ch1
raster**: side-scroller quota (fiber/stone) + **hull-debris salvage** (walk-over
pickups granting the campfire chain's wood/flint) → completion triggers the
**2D→3D LIFT**: a ~7s letterboxed cutscene where the camera physically travels
from the side vantage INTO the worker's eyes (sprite dissolves, one masked
resolution snap) → **CCTV feed** (pan-tilt: compass-snapped yaw + tilt band) →
`[F] Touch` the anomaly stone → **A1** 8s chroma ramp → **Ch2** color-but-flat
feed, the redacted apple tree (`[F] Eat` up close) → **A2** violation flood,
HUD death, 12s liberation into free 3D at frozen noon → **Ch3** craft the
campfire chain (whitelisted Fabricator), first-dusk cutscene, `[F] Rest` at the
fire at night → **A3** dawn material ramp → story completes, sandbox continues.
Pre-A2 chapters render NOTHING smooth: cube pebbles, voxel pod/debris, no ship,
no berries — the anomaly stone is the deliberate first continuous form.

## Architecture (all story code in `src/story/`)

| Piece | File | Role |
|---|---|---|
| State | `storyState.ts` | Chapter/beat store (appState pattern); checkpoints persist as `story:*` milestones in the existing global save; `?story=` parsing; `stageForStoryPoint` (resume → reality stage) |
| Director | `storyDirector.ts` | Beat entry side-effects + per-frame timelines (flash scheduler, A1/A2/A3, Ch3 sun); owns the forced day phase until completion |
| Driver | `StoryDirectorDriver.tsx` | In-Canvas `useFrame` tick (shader + DOM values land same frame); FOV easing; redaction projection |
| Input policy | `storyInputPolicy.ts` | THE sandbox gate: frozen allow-all `SANDBOX_POLICY` when inactive; per-beat move/jump/sprint/build/craft/recipe/interaction/look constraints; director live-mutation hooks |
| Feed camera | `feedCamera.ts` | Compass-snapped yaw + CCTV tilt band ([−0.55, +0.35] rad) on the same refs as free look; `feedBlend` opens it during A2 |
| Side lens | `sideLens.ts` + `world/SideWorkerAvatar.tsx` | Raster era: side camera (parent-inverse math), plane lock + facing, adjacency harvest probes, voxel worker sprite; plane defined in `storyWorld.getStorySidePlane` |
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
- The raster quota→CCTV upgrade is a hard cut with a glitch pulse; a short
  camera swing from side view into first person would be a worthy polish beat.
