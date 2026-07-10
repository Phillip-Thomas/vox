# PARAVOXIA — Story Progression & The Fidelity Ladder

**Thesis:** The rendering pipeline IS the narrative. Every awakening in the story is a
rendering technique switching on. The player doesn't watch transcendence — they *see
more* every time they transcend. Fidelity = consciousness.

This doc merges the synopsis (`PARAVOXIA_SYNOPSIS.txt`), the "random thought timeline"
at the bottom of it, the three-era crafting spine (`main/CRAFTING.md`), and the engine's
actual capabilities into one progression. It supersedes the timeline scribbles.

---

## 0. The core design law

> **The world never changes. Only the player's ability to perceive it changes.**

This is the load-bearing rule, and the engine already agrees with it: the reality-stage
system (`game/systems/realityRenderSystem.ts`, stages `bare → color → material → alive
→ paradox`) changes *appearance* without touching the world data. The tree was always
there. The color was always there. The grass, the wind, the fauna — always there. The
regulation suit, the training, the quota — those are the renderers of a lesser world.

Consequences the whole design hangs off of:

- **Never build a second game for the early chapters.** The "2D black-and-white" opening
  is the real 3D voxel engine viewed through a *lens* (ortho camera + monochrome +
  dither + locked input), not a separate 2D codebase. When the lens shatters, the player
  retroactively understands the world was always whole. (Engineering detail in §4.)
- **Awakenings are earned by acts, not cutscenes.** Each fidelity unlock triggers off a
  player action that embodies its theme (eat the fruit → depth; build with your hands →
  texture; defy the directive → life). Milestone ids in `progressionSystem.ts` are the
  trigger mechanism — they already exist, persist, and are per-player.
- **Per-player perception.** Progression is already actor-keyed (`PROGRESSION_OWNERSHIP`
  in `progressionSystem.ts`, confirmed in `MULTIPLAYER.md`). In multiplayer, a friend
  at a lower awakening literally sees the lesser world while standing next to you. This
  is not a compromise — it's the single best expression of the theme the game has.
  NPCs work the same way: other workers are *blind* to what the player sees.
- **Two orthogonal axes, never merged.** Device quality (`config/graphicsSettings.ts`,
  ULTRA→POTATO) answers "what can this machine draw." Narrative stage answers "what is
  this soul allowed to perceive." Effective fidelity = `min(narrativeCeiling,
  deviceProfile)`. The codebase already keeps these separate on purpose — keep it that way.
- **Regression is allowed.** Because reality effects are continuous 0–1.5 uniforms
  (`overrideVoxelRealityEffects`), conformity/trauma/exhaustion can *drain* fidelity
  temporarily. Chroma dipping when you obey a directive or when vitals bottom out is
  cheap to implement and devastating to feel.

---

## 1. The ladder at a glance

Nine awakenings across three eras. Era = crafting regime (already built/designed);
awakening = rendering regime.

| # | Awakening | Trigger (player act) | Rendering shift | Era |
|---|-----------|----------------------|-----------------|-----|
| A0 | **THE SLEEP** (prologue) | none — this is the floor | 1-bit terminal 2D, Oregon-Trail voyage | pre-game |
| A1 | **HUE** | touching the first anomaly | monochrome → color (still flat regulation feed) | primitive |
| A2 | **DEPTH** | eating the apple | 2D feed shatters → free 3D, `color` stage, bare world | primitive |
| A3 | **GRAIN** | first night in a self-built shelter | `material` stage: texture, roughness, ore veins — and TIME (the sun moves) | primitive |
| A4 | **BREATH** | defying the sterilization directive | `alive` stage: grass, trees, fauna, flora, wind, animated water | primitive → emergent bridge |
| A5 | **LIGHT** | first warp | post-fx composer: bloom, AO, color grade; space, stars, nebulae | emergent |
| A6 | **THE HAND** | reading the first Maker fragment | per-world authored styles: painterly, toon/outline, sketch | emergent |
| A7 | **PARADOX** | crossing a void rift on the Anomaly | effects >1.0, sub-voxel resolution, wrong physics, non-cubic worlds | paravox machina |
| A8 | **THE FRAME** | activating the Paradox Machina | fidelity strips DOWN — wireframe → data → the terminal → beyond | paravox machina |

The shape is deliberate: fidelity climbs A0→A7, then the finale *inverts* — the highest
transcendence renders as the simplest representation, because the last box to see is
the renderer itself.

### The second reading: gaming through the decades

The fidelity ladder is ALSO a history of video games — every awakening is a
generation of play, so a player who grew up on games feels the transcendence in
their hands before they can articulate it:

| Story moment | Gaming era | In-game rendering |
|---|---|---|
| Prologue crawl + voyage ledger | The Oregon Trail ('71) — text & prompts | Green-phosphor terminal, ledger stats, event cards |
| The nav anomaly / crash | Pong ('72) — one paddle vs. the inevitable | Oscilloscope debris-deflection minigame, unwinnable by design |
| Ch1 arrival (quota) | Side-scrollers ('85) | The REAL voxel world through a side-on locked-plane lens, chunky low-dpr pixels, voxel worker sprite |
| Ch1 anomaly → Ch2 | Fake-3D shooters ('92) | First-person CCTV feed: compass-snapped pan, tilt band, dither/scanlines |
| A2 depth awakening | True 3D ('96) | Free look, full FOV, device resolution — the mouse becomes a neck |
| A3+ (material → alive) | The modern era | Texture, time, life, post-fx |
| A6 authored styles | The stylized era (cel/painterly/sketch) | Per-world post looks as maker's brushstrokes |
| A8 the frame | The end of representation | Wireframe → data → the first terminal |

Design rule that falls out of this: each era's LIMITATION is diegetic (the suit's
"visual cortex link" recovering from the crash), and each era must contain real
gameplay in its own idiom — prompts you answer, a paddle you steer, a plane you
jump along, a pan-tilt head you aim — never a passive filter.

---

## 2. Chapter-by-chapter

### PROLOGUE — "The Assignment" (A0: The Sleep)

**Look:** Not the voxel engine at all. A 1-bit / green-phosphor corporate terminal.
The Star-Wars-style crawl is a **scrolling regulation work order** — deployment notice,
productivity codes, liability waivers — that establishes the universe in its own dead
language: you are a worker; workers harvest cubes; cubes are prepared for extraction;
nobody asks why. The crawl should be funny-bleak the way real EULAs are.

**Gameplay:** Oregon Trail, played straight. You manage the crew hauler's voyage to
Cube Site 7C-θ: ration biofuel, allocate crew shifts, resolve event cards
("Worker 4 exhibited curiosity. Worker 4 was recalibrated. Morale nominal."). The
harvest→refine→build loop is taught here as *pure ledger numbers* — because that is
what the loop is to a sleeper. The player learns the game's economy before ever seeing
a world, and later realizes they were taught to see worlds as spreadsheets.

**The mishap:** the nav system begins rejecting the destination — coordinates that
"do not resolve." Event cards degrade into corrupted text. The crash is rendered as
the *terminal itself failing*: tearing, dropped scanlines, the ledger numbers bleeding.
Hard cut.

**Engineering:** a DOM/canvas scene entirely outside the R3F canvas. Text-crawl
component, event-card system, a ledger store. Deliberately cheap — reuse the HUD/theme
stack (`ui/theme.ts`). The corrupted-crash shader is the one bespoke piece.

---

### CHAPTER 1 — "Regulation" (A1: Hue)

**Look:** The player now walks the crash planet — but through the **Regulation Feed**:
the suit's compliance display. Under the hood this is the full 3D engine at reality
stage `bare` (all effect families zeroed — the stage's own docs call it the
"early black-and-white / unresolved reality beat") rendered through a feed lens:
orthographic camera, fixed compass-locked facing, grid-stepped movement, 1-bit ordered
dither, scanlines, CCTV vignette, a frame counter. It *reads* as old-school 2D. It is
not. That's the point.

**Gameplay:** Work orders. Harvest quota (grass→biofiber, loose stones — the existing
walk-near pickup loop is perfect for a numbed worker: resources just *accrue*). The
suit only permits regulation actions; the crafting menu shows a single approved recipe
(biofuel). Vitals are shown as ledger rows, not meters. The player should feel the
loop's competence and its deadness simultaneously.

**The first glitch:** at the edge of the survey zone the feed stutters — two frames of
full color, then back. Later, color bleeds persistently at the screen edges wherever
the player looks toward one specific direction. The suit logs it as SENSOR FAULT and
files repair tickets that never resolve. Following the bleed is optional but
irresistible — this is the game teaching curiosity as a verb.

**A1 fires** when the player touches the first anomaly (a smooth, non-cubic stone —
the first continuous form). Chroma animates 0→1 with glitch flicker
(`overrideVoxelRealityEffects` interpolating over ~8 seconds of stutter). The world is
now **color, but still flat** — the feed lens (ortho, dither-lite, locked facing)
remains. Color inside a cage is more unsettling than monochrome. The suit begins
flagging the player's own telemetry as anomalous.

---

### CHAPTER 2 — "The Tree" (A2: Depth)

**Story:** In the colored-but-flat world, one thing is *impossibly* saturated: a red
so bright the feed can't quantize it. The apple tree — the synopsis's forbidden
continuous living thing, now literalized. The Regulation Feed cannot render it: it
draws a **redaction box** over the tree (`[UNRESOLVED OBJECT — DO NOT APPROACH]`).
The player is drawn to the one thing the system refuses to show them. The redaction
box IS the advertisement.

Up close, the feed fails — the tree tears through the dither in full mesh fidelity,
the only high-fidelity object in a flat world. The apple is an interaction prompt
(the existing context-interaction system: `[F] Eat`). No tutorial. The player knows
exactly what this is. Eden, played as a rendering bug.

**A2 — the showpiece transition.** He eats, and believes he is losing his mind:

1. Audio detunes; the HUD floods with REGULATION VIOLATION notices, then dies.
2. The ortho camera **pulls into perspective** — the world rotates into depth around
   the tree as pivot (a dolly from flat to full perspective projection is a genuinely
   novel transition; prototype it early, it carries the whole game's promise).
3. Dither dissolves; scanlines burn off; pointer-lock and free-look are granted for
   the first time. Movement unclamps from the grid.
4. The player falls to their knees (camera pitch script), looks at their hands.

**After:** full 3D, reality stage `color`, ecology density at the POTATO floor — flat
bright voxels, **no** grass/trees/fauna/flora/surface effects, static noon sun, dead-
still water, no post pass. Exactly your "we don't have the cool stuff yet" state, and
the engine produces it today with `?voxelStage=color` + a density override.

**Gameplay:** the Primitive era proper (all BUILT): hold-to-mine, wood/stone/biofiber,
stone tools, torch, campfire, forage, vitals. Crucially the fiction reframes crafting:
**creation outside the approved workflow is the transgression.** Every recipe crafted
is another bite of the apple. First firelight in a colored world should be a held,
quiet moment — light the player *made*.

---

### CHAPTER 3 — "Grain" (A3: Texture & Time)

**Story:** Survival deepens. The player builds — the shelter system (build mode B,
panels, enclosure) is the chapter's spine. The thesis beat: attention is a form of
devotion. The worker harvested this world by the ton and saw slabs; the survivor who
planes one board begins to see *grain*.

**A3 fires** the first night the player sleeps inside a sealed self-built shelter
(the S3 enclosure flood-fill check is the literal trigger condition — a lovely case
of a planned mechanic becoming a story beat). They wake to:

- **`material` stage:** triplanar detail, bark, wood grain, stone roughness, ore veins
  glinting in rock faces (`voxelMaterial.ts` authored detail). Resources become
  *legible in the world* rather than only in the scanner — texture as information.
- **Time begins.** Until now the sun was frozen at regulation noon (fits the fiction:
  constructs run standard illumination). The day/night cycle (`dayNight.ts`,
  `SkyController`) starts with this dawn — the player's **first sunrise**, followed
  that evening by the first sunset and first true night. Night gives the already-built
  torch/campfire lighting its teeth, and sets up the TODO's night-cold survival work.
- Hazard phenomena become visible as material effects (frost wisps, dust, ash — the
  `material` stage already partially reveals these): the world starts telling the
  truth about what can hurt you.

**Gameplay:** shelter → enclosure → warmth; food/water satisfiers; the exposure/comfort
survival layer from `CRAFTING.md` §6. The chapter ends with a working homestead — and
a radio crackle. The workforce network has found the crash site.

---

### CHAPTER 4 — "The Other Worker" (A4: Breath)

**Story:** Contact. Another worker arrives (or a relay reconnects — cheaper). The
scene the whole game pivots on: **the worker walks through the player's world and sees
none of it.** He stands in front of the shelter, the fire, the textured timber, and
his feed shows bare monochrome slabs plus unresolved objects. "What is all this?
Who authorized these constructions? None of this is regulation." He is not evil. He is
asleep, and he is *frightened* — the synopsis's "why does every inhabitant seem content
never to ask," answered: contentment is a rendering setting.

The network issues the directive: sterilize the anomaly site, restore quota. And here
the game does its cruelest, cheapest trick — **compliance regresses fidelity.** If the
player follows orders (a short forced-compliance sequence: dismantle a wall, burn the
forage stores), chroma and detail visibly drain frame by frame. Obedience is shown as
the color literally leaving the world. Continuous override uniforms make this nearly
free to implement.

**A4 fires on defiance** — the player refuses a final order (concretely: replants a
sapling / shields the tree / smashes the relay). The world **exhales**:

- **`alive` stage** — the full current production look, arriving all at once as the
  chapter's showpiece: grass swaying in (`GrassField`), the treeline fading up
  (`TreeField` — "the north star"), flora, fauna herds cresting the hill
  (`FaunaField` gait/herding/flee), pollen and dust motes (`SurfaceEffectField`),
  wind, and water waking up (Gerstner waves, Fresnel, glints). Densities ramp from
  the floor to the device profile over ~30 seconds while the player stands in it.
- The other worker sees the player standing rapt in an empty field, and flees.

**Era bridge (already designed):** the departure/flight leaves salvage — the Maw
Repair Kit path. Repairing the Maw (`repairMaw()`: faulty→iron, era→emergent) and
building the Smelter/Assembler/Survey Console flips the crafting regime. The
terrain-gun beat from the timeline notes lands here: the repaired Maw's terrain
generation is a *regulated* technique — the player now wields the system's own
authorized power alongside their forbidden knowledge. Ship repair becomes the goal.

---

### CHAPTER 5 — "Emergence" (A5: Light)

**Story:** The ship flies. The first warp is the first time the player leaves the
cube — and discovers the synopsis's central dread: beyond the cube is *another cube*.
A whole sky of them. The liberation IS the larger prison, and the game should let the
awe and the horror land in that order.

**A5 fires inside the first warp.** The existing warp white-out midpoint
(`WarpOverlay` hides the world swap) is a ready-made baptism: the player enters the
tunnel in the pre-post-fx world and **emerges with the composer on** — bloom blooming
off the star, contact AO seating every cube in soft shadow, the color grade giving the
new world a *mood*. Space itself gets the full `SpaceSky` starfield/nebula treatment.
Light stops being illumination and becomes *quality* of light.

**Gameplay (emergent era, all designed/partly built):** the planet-hop loop —
survey lenses raise scanLevel, Carapace suits answer hazards, warp range gates reach.
Tier 1–2 archetypes open up: arid mesas, frozen ridges, volcanic basalt, oceanic
isles, fungal blooms. Each planet's palette family and art direction
(`planetArtDirection.ts` — 10 palette families, per-planet shape/ecology/phenomena)
now visibly differentiates worlds: "where do I warp?" becomes an aesthetic decision
as much as an economic one, exactly what the planet-system handoff doc wanted.

**Sub-beat — the Deep (underwater awakening):** on an oceanic world, the first real
dive brings the built underwater suite online as a discovered rendering layer:
submergence fog, caustics, godrays, marine snow, the Snell window overhead — and the
oxygen vital. Beneath the surface of a construct, the player finds the first object
that predates the cube: a **Paradox fragment**, humming, un-scannable. The
investigation begins.

---

### CHAPTER 6 — "The Hand" (A6: Style)

**Story:** The fragments accumulate into the game's biggest mid-game idea. Studying
them (Survey Console questline across tier 2–3 worlds) teaches the player to perceive
**authorship**. These worlds were not generated. They were *made* — and makers leave
strokes.

**A6 fires** when the first Maker fragment is deciphered, and from then on **each
world reveals an authored style** — the per-planet post-fx looks:

| Archetype | Authored look | Engine pieces |
|---|---|---|
| verdant | warm filmic, gentle grade | ColorGrade (built) |
| oceanic | watercolor / painterly wash | PainterlyEffect (Kuwahara, built) |
| fungal | bioglow painterly, bloom-heavy | Painterly + Bloom (built) |
| frozen | high-key minimal, thin outlines | OutlineEffect (built) |
| crystal | full toon/cel: outline + posterized grade | Outline + grade LUT (small lift) |
| arid | sun-bleached pencil **sketch** | new: hatching/sketch pass (the one genuinely new post shader) |
| volcanic | charcoal & ember, crushed blacks | grade preset (cheap) |
| metallic | harsh industrial mono-accent | grade preset + `monochrome-accent` palette family (exists) |
| anomaly | *unstable — cycles styles* | style interpolation (see A7) |

This is your "some worlds cartoon, others sketch" — with a narrative justification
that transforms it from a gimmick into the plot: **style is evidence.** Perceiving a
world's style is perceiving its maker. Different strokes → different makers → factions
of makers → why do makers *harvest their own works?* The question that pulls the
player to tier 3 and 4.

**Engineering:** ~80% exists. Painterly, outline, grade, bloom, AO are in the composer
today; the work is per-archetype presets, a style-crossfade for landings, and one new
sketch/hatching effect. The `qualityHints` budget system already handles per-device
scaling of all of it.

---

### CHAPTER 7 — "Paradox" (A7: The Crack)

**Story:** Tier 3 worlds (Crystal Wastes, Metallic Moon) are extraction country —
hollowed cubes, silent crews, machinery feeding *something*. The investigation
converges on the tier-4 **Exotic Anomaly** — whose archetype traits are literally
already "reality distortion, void rifts." Here the player finds technologies that
disobey the worlds that contain them, and the era flips to **paravox machina**.

**A7 fires** when the player steps through a void rift. Rendering goes *past* real:

- **`paradox` stage** — the reality-effect families pushed **beyond 1.0** (the preset
  exists for exactly this): over-saturated chroma, impossible material responses,
  light that arrives before its source, bloom that bleeds across the Snell window.
- **Resolution of reality increases:** sub-voxel terrain — the grid refines
  (VOXEL_SCALE halves on paradox-touched worlds). Your timeline's "vibrant mesh and
  small voxel" beat: transcendence literally raises the world's sample rate.
- **Mesh–voxel inversion:** meshes where voxels should be, voxels where meshes should
  be — trees of cubes, boulders of continuous glass. The apple tree's rendering
  language, everywhere, wrongly.
- **The construct stops holding shape:** "various voxel planet shapes" — the first
  non-cubic worlds. A spherical planet is, in Paravoxia, a *scandal*. Then a torus.
  Then terrain with no closed form at all. (Honest engineering note: the cube-planet
  assumption runs deep — gravity faces, chunking, the water flood fill. Scope one
  non-cubic showcase world, not a generalized system.)
- **Perception becomes a verb:** the player gains the **Paradox Lens** — the ability
  to *choose* their rendering stage at will (mechanically: player-facing
  `setVoxelRealityStage`). See as the workers see to walk unnoticed through a manned
  facility (you render as compliant telemetry); drop to `bare` to reveal load-bearing
  structure a maker hid under style; push to `paradox` to see rifts. Every fidelity
  tier the player earned becomes a tool. This retroactively makes the whole ladder a
  *mechanic*, not a spectacle.

**Gameplay:** rift tooling, exotic matter, void-tier Maw line (arc→void, already in
the recipe graph), and assembling the **Paradox Machina** — the machine that is not
of the system.

---

### FINALE — "The Frame" (A8: No More Boxes)

**The inversion.** Every awakening added fidelity. The last one takes it away —
because the final cube is the renderer itself.

The player activates the Paradox Machina, and the world begins to **strip**:

1. Post-fx unmounts, live, effect by effect — the grade dies, bloom collapses,
   the style flattens. (The composer disassembling itself.)
2. `alive` → `material` → `color` fade in reverse. Fauna stop mid-gait and derez.
   The grass sinks back into the data.
3. Geometry goes **wireframe**, then greybox, then raw chunk boundaries — the player
   walks through the honest machinery of the construct, seeing the game as what it is.
4. And at the bottom of the strip-down: the green-phosphor terminal from A0, rendering
   the player as a ledger row. They have reached the outermost box and it was the
   first one. The screen. The frame.
5. One thing refuses to derez: **the tree** — full mesh, full color, continuous, alive,
   standing in the wireframe void. The answer to "what remains when there are no more
   boxes": the question itself. Curiosity survives every renderer.

The player walks to the tree. `[F] Eat`. Cut to a new worker's terminal booting up —
somewhere in *their* feed, two frames of color flicker. The player's transcendence is
the next sleeper's first glitch. (Long-term multiplayer dream: an ascended player's
presence literally *is* an anomaly source in other players' early-game worlds — the
per-player perception architecture already permits it.)

---

## 3. Era ↔ awakening alignment (crafting doc stays true)

Nothing in `CRAFTING.md` moves; the awakenings snap onto its existing gates:

- **Primitive era = A1–A4.** Deliberately long, as the crafting doc already commits
  to ("staying in Primitive for a good while"). Its planned work IS the chapter
  content: shelter (A3's trigger), light-hazard survival (Ch3), food/water, night-cold.
- **Era bridge (Maw repair + devices) = the A4→A5 seam.** Directive/defiance gives the
  bridge the narrative weight it currently lacks.
- **Emergent era = A5–A6.** Warp/scanner/suit gates carry the planet-hop chapters;
  the Paradox-fragment questline gives the Survey Console a reason to exist.
- **Paravox machina era = A7–A8.** The designed-only tier gets its content definition:
  rift tooling, the Lens, the Machina, the strip-down.
- Progression stays per-player (multiplayer-safe) and persists via the existing
  milestone store — an awakening is just a milestone id the render director reads.

## 4. Engineering shift list (build order)

Existing = works today; **Build** = new work, roughly ordered by when the story needs it.

| Piece | Status | Notes |
|---|---|---|
| Reality stages bare→paradox wired into every field + grade | **Exists** | `realityRenderSystem.ts`; `?voxelStage=` debug already in App |
| Milestone/era store, per-player, persisted | **Exists** | `progressionSystem.ts` |
| Density/quality override API | **Exists** | `overrideGraphicsQuality` — narrative floor composes with device profile |
| **Render Director** | **Build (first)** | The one new core system: listens to milestones, choreographs stage + density + camera + audio transitions over time (each awakening is a scripted sequence, not a snap). All chapters depend on it. |
| Regulation Feed lens | **Build** | Ortho camera mode, 1-bit dither/CRT post pass, locked facing, grid-step input, redaction-box HUD. Chapters 1–2 live inside it. |
| A0 terminal prologue | **Build** | DOM scene: crawl, ledger, event cards, crash-corruption shader. Fully outside R3F. |
| The apple tree | **Build** | One bespoke high-fidelity mesh object + interaction + the ortho→perspective transition (prototype this early — it's the trailer shot). |
| A3 trigger: sleep-in-enclosure | **Depends** | Needs planned S3 enclosure flood-fill (already on the shelter roadmap). Frozen-noon sun until A3 = freeze the day phase (the tidally-locked TODO is the same mechanism). |
| Compliance-regression sequences | **Build (cheap)** | Animate reality uniforms downward; also tie a small chroma dip to bottomed-out vitals. |
| A5 warp = composer unlock | **Build (small)** | Gate PostFX mount on milestone; the warp white-out already hides the seam. |
| Per-archetype style presets + crossfade | **Build (medium)** | Painterly/outline/grade exist; add presets per archetype, style lerp on landing, one new sketch/hatching effect. |
| Paradox Lens (player stage-switching) | **Build (medium)** | Player-facing wrapper over existing stage API + puzzle/stealth consumers. |
| Sub-voxel worlds, mesh/voxel inversion | **Build (large)** | Scoped to paradox-touched worlds only. |
| Non-cubic showcase world(s) | **Build (largest, riskiest)** | Gravity/chunking/water assume the cube. Scope: one sphere, hand-tuned, late. |
| A8 strip-down (wireframe/greybox pass, live composer teardown) | **Build (medium)** | Mostly reuse: it's the Render Director running the ladder in reverse + a wireframe material swap. |

## 5. Open questions (deliberately unresolved)

- **How player-authored is the pace?** Awakenings-by-act (above) vs. any purely
  time/exploration-based triggers. Recommendation: acts only — the theme demands
  transcendence be *chosen*.
- **Does the other worker return?** A recurring NPC who awakens slowly (the player
  watching someone else's chroma come in) could be the emotional B-plot of the
  emergent era.
- **Who are the makers?** The style system implies plural authors with conflicting
  strokes. Deciding whether they're ancestors, escapees, or the players-before-you
  (cyclical reading, supported by the A8 ending) can wait until Chapter 6 content.
- **New-game-plus:** after A8, does the player keep the Lens from minute one? A
  NG+ where you begin awake in a world of sleepers is nearly free and very on-theme.
