# Paravoxia — Story Mode (vertical slice: Prologue → Chapter 3)

**What this is.** The playable first act of the fidelity-ladder narrative
(design: `../PARAVOXIA_PROGRESSION.md`, plan: A0→A3). Rendering fidelity IS the
story: the game opens as a 1-bit terminal, becomes a monochrome CCTV "Regulation
Feed," gains color at A1, depth/freedom at A2, and texture + time at A3, then
hands off to the sandbox at reality stage `material`.

## Playing it

- **Menu → "◈ Story"** (next to Play; label becomes "Continue Story" mid-run).
- Dev deep links: `?story=1` (full run from the terminal prologue) and
  `?story=ch1|a1|ch2|a2|ch3|a3` (jump to a checkpoint; ch3-family jumps seed
  campfire materials). `?voxelStage=` still works independently for lookdev.

The slice (a history of games — see PARAVOXIA_PROGRESSION.md "gaming through the
decades"): regulation crawl → Oregon-Trail voyage (pace/ration prompts + 5
choice cards; choices echo in Ch1's work order) → **debris-deflection Pong**
(unwinnable as the nav anomaly hits) → terminal-corruption crash → **Ch1
raster**: a 2D SIDE-SCROLLER lens on the real voxel world (A/D + Space, chunky
low-dpr pixels, voxel worker sprite, adjacent-block harvest with hold-E, voxel
pebbles) — owns the fiber/stone quota → quota met restores the **CCTV feed**
(pan-tilt: compass-snapped yaw + tilt band) → `[F] Touch` the anomaly stone →
**A1** 8s chroma ramp → **Ch2** color-but-flat feed, the redacted apple tree
(`[F] Eat` up close) → **A2** violation flood, HUD death, 12s liberation into
free 3D at frozen noon (FOV + resolution + treatment all open) → **Ch3** craft
the campfire chain (whitelisted Fabricator), first scripted dusk, `[F] Rest` at
the fire at night → **A3** dawn material ramp → story completes, sandbox
continues. Pre-A2 chapters render NOTHING smooth: cube pebbles, no ship, no
berries — the anomaly stone is the deliberate first continuous form.

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
- The raster quota→CCTV upgrade is a hard cut with a glitch pulse; a short
  camera swing from side view into first person would be a worthy polish beat.
