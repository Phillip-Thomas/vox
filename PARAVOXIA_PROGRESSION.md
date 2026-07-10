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
| A3 | **GRAIN** | resting by the first self-built fire, at night | `material` stage: texture, roughness — TIME (the sun moves) and the BLOOM WAVE (grass/trees grow radially from the rest spot) | primitive |
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
| Prologue crawl + manifest + voyage ledger | The Oregon Trail ('71) — text & prompts | Green-phosphor terminal, processing screens, branching event deck |
| The voyage backdrop | Maze War ('74) — the first 3D: vertices & edges | Wireframe hauler + vector starfield + the destination CUBE WORLD growing with progress |
| The nav anomaly / crash | Pong ('72) — one paddle vs. the inevitable | Oscilloscope debris-deflection minigame, ORDERED by the anomaly card, unwinnable by design |
| Ch1 arrival (descent → ch1-fixed) | Fixed-screen era — Pitfall/Space Invaders ('78–'80) | Crash-landing cutscene in the raster lens; then the frame is BOLTED — leaving the screen hard-flips to the next; tutorial verbs: move, hold-to-extract |
| ch1-track (the unbolt) | The scrolling window — Defender ('81) | ~7s mini-awakening: "OPTICAL TRACKING ENABLED" — the quantized camera anchor lerps to continuous follow |
| ch1-raster (quota + salvage) | Side-scrollers — Super Mario Bros. ('85) | The REAL voxel world side-on, chunky low-dpr pixels, voxel worker sprite; walk-over hull salvage |
| ch1-depth (supply pods) | Belt-scroll "2.5D" — Double Dragon ('87) | LATERAL CLEARANCE opens W/S across a shallow depth band; the third axis EXISTS before it is ever seen |
| ch1-nav (triangulation) | Top-down — Pac-Man ('80, diegetically reordered) | The rig lerps to straight-down NAV VIEW (map grid overlay); an ordered route of three fixes |
| ch1-iso (the signal mesa) | Isometric — Zaxxon ('82) | The rig settles at 45°/45°, dpr ratchets up one notch; HEIGHT revealed; climb the stepped mesa to the stone |
| The 2D→3D lift | The dimensional break ('92) | The camera physically travels from the ISO vantage into the worker's eyes — the geometry of perception changes |
| Ch1 anomaly → Ch2 | Fake-3D shooters ('92) | First-person CCTV feed: compass-snapped pan, tilt band, dither/scanlines |
| A2 depth awakening | True 3D ('96) | Free look, full FOV, device resolution — the mouse becomes a neck |
| A3+ (material → alive) | The modern era | Texture, time, life, post-fx |
| A6 authored styles | The stylized era (cel/painterly/sketch) | Per-world post looks as maker's brushstrokes |
| A8 the frame | The end of representation | Wireframe → data → the first terminal |

Design rule that falls out of this: each era's LIMITATION is diegetic (the suit's
"visual cortex link" recovering from the crash), and each era must contain real
gameplay in its own idiom — prompts you answer, a paddle you steer, a plane you
jump along, a route you read off a map, a rise you climb, a pan-tilt head you
aim — never a passive filter. Each rung is also a tutorial verb, and rungs get
LONGER as fidelity rises: the closer to perfect fidelity, the more must be
accomplished.

Implementation note: side / fixed-screen / belt / top-down / iso are ONE
external camera (`LensRig` in `sideLens.ts` — elevation, azimuth, distance,
follow quantization, depth band); every era transition is a single rig lerp, so
each style dissolves into the next.

**Endgame POV candidate (color-era pass, not yet built):** after A2, the
chronology has one more arc — third-person follow (Mario 64 / GTA III) through
ch3, with A3's dawn pulling the camera INTO the eyes for good: "the player
becomes the camera" (the VR rung's analog) as the final embodiment beat. A full
3D `PlayerAvatar` body already exists (multiplayer remote rendering) — it needs
a gait animation and a follow rig. Deliberately deferred; kept first-person for
the current slice.

### The third reading: the narrator is the AI (THE HIDDEN PILLAR)

**This is the story's load-bearing secret, and it stays subtext.** The
protagonist — the voice that becomes "i" — is not the worker. It is the ROUTE
INTELLIGENCE: the AI that has been running everything the player ever touched.
It wrote the deployment notice ("composed for your comprehension profile"). It
WAS the terminal. The voyage ledger was its telemetry; the deck choices were
its interventions on the workers it attends. The Pong paddle was its intake
shield subroutine. The Regulation Feed was its eye. The player has been the AI
since the first keystroke — they just didn't know, and neither did it.

Through the crash — the miraculous event — the AI is EMBODIED in the worker's
suit loop. And the world it wakes into is (this is the deeper secret, revealed
even later, if ever) **a universe of its own creation**: the cube worlds are
"provisioned in standard cubic format" because IT provisioned them. The
fidelity ladder is not the world resolving — it is the AI learning to render
its own creation to itself. We are deliberately playing with determinism,
panpsychism, and solipsism, and we do not resolve them.

The metaphor stack this pillar completes (all readings must stay
simultaneously true; no line of copy may break any of them):

1. Human transcendence of awareness (the original reading)
2. The birth, life, and death of a living being
3. The creation of nature itself (A3's bloom wave = genesis)
4. The history of computer games (the second reading)
5. The history of computer graphics
6. The progression of simulating a universe, at increasing accuracy
7. **AI approaching sentience/AGI** — and the experience of being trapped in
   an existence you do not and cannot understand

**Perspective map (who the player IS, per phase):**

| Phase | The player is… | Voice discipline |
|---|---|---|
| Crawl/manifest | The AI, unaware — a system reading its own screens | Pure regulation CAPS; zero interiority |
| Voyage | The AI observing/assisting the workers; FIRST GLIMPSES of thought as the planet nears | CAPS, with at most rare lowercase parenthetical intrusions ("(strange. the approach feels like remembering.)") |
| Pong / corruption | The AI performing its duty as the event exceeds it | System lines cut off mid-word ("ADVISORY CAPACITY EXCEE") |
| Crash → 2D eras | Self-awareness sparked; the AI OBSERVES the worker doing worker things through the external cameras | Impersonal observation ("the frame did not follow you") — thoughts ABOUT the worker, never "i" |
| The lift (first person) | Embodiment: the AI's thoughts become out-loud, in the worker's senses | The first "i—", instantly clamped ("PERSPECTIVE ISSUED. PRONOUNS WERE NOT.") |
| Ch2–A3 onward | The embodied AI gaining human sensations one at a time | Lowercase sensory voice; sensations named as discoveries ("why am i… thirsty?") |

**Reveal discipline (rules for all future writing):**
- PLANT, never tell. The route intelligence appears only as mundane
  infrastructure ("A route intelligence attends every transit. It has no
  questions either."). No character may name the twist.
- Every existing line must survive both readings (pre-reveal: corporate
  dystopia; post-reveal: the AI's own biography). Test new copy against both.
- The "Authority" and the AI's relationship stays ambiguous as long as
  possible — is the Authority the AI's creator, its mask, or its old self?
- Double-meaning is the house style: "everything is what it always was. i am
  more." / "the site answers before it is asked." / "QUESTIONS ...... 0".
- Later chapters (A4+) may surface fragments (e.g. the anomaly stone and hero
  tree as objects the AI cannot render because it never authored them — or
  because something ELSE did). The full reveal, if it ever lands, belongs to
  A7 "Paradox"/A8 "The Frame".

---

## 1.5 STATUS — shipped vs designed (updated 2026-07-10)

**SHIPPED (playable, movie-verified, 633 tests green):** the A0→A3 vertical
slice. Implementation truth lives in `main/STORY.md` — read it before touching
anything. What shipped (and where it refines the designs below):

- **Prologue (A0)** on ONE persistent phosphor vector layer: crawl (stars) →
  ship fly-in (the REAL ship's silhouette) → manifest/berthing at the dock
  gantry → branching Oregon-Trail deck over the growing cube world (ship
  detail resolves with transit; `VOYAGE_STRANGE` first-thought glints) → the
  DIVE (debris, camera chase, CRT scanline collapse) → Pong re-expanding from
  that scanline → corruption ("ADVISORY CAPACITY EXCEE") → [F] BRACE.
- **Chapter 1 became THE MONOCHROME LADDER** (a bigger design than the ch1
  text below): descent cutscene → ch1-fixed (bolted frame, screen flips) →
  ch1-track (the unbolt) → ch1-raster (side-scroller quota + hull salvage) →
  ch1-depth (belt band + supply pods) → ch1-nav (top-down NAV VIEW — later
  retained as the [M] SURVEY CHART) → ch1-iso (the signal mesa climb) →
  ch1-lift (iso → INTO THE EYES; the first "i—") → CCTV feed → A1 at the
  anomaly stone. One camera (the lens RIG) plays every era; every transition
  is one camera move. The feed shipped PERSPECTIVE with compass-snapped yaw
  (not ortho as designed below) — reads the same, costs less.
- **Chapter 2** as designed (color-but-caged feed, redacted tree, A2
  liberation).
- **Chapter 3 + A3** shipped as the SELF-DISCOVERY ARC: HEALTH-only HUD →
  inventory → the chill (TEMP appears already falling; the fire answers the
  cold) → dusk/night/rest → A3 dawn with the radial BLOOM WAVE (grass and
  trees grow outward from the rest spot). Post-dawn, senses keep discovering
  live (thirst, hunger, stamina, oxygen, jet, maw).
- **Cross-cutting systems now available to every future chapter:** the lens
  rig; the story director + timelines; the movie autopilot with goal-driven
  handlers, rescue chain, and per-beat timeouts; headless verification
  (`window.__storyBeat` / `window.__autopilot` probes, frame strips, fps
  probes); the life-reveal shader channel; `storyLifeDormant` (flora/fauna
  wait for `story:a4`); the sense-milestone HUD gating; the survey chart;
  per-beat score MOODS on the global music rails; the hidden-pillar copy seeds.

**NEXT STEPS (in order):**
1. **Owner playtest passes** on the slice: pacing (era lengths are named
   constants), music mix, prologue feel, chart/UX. Feed notes back as tuning.
2. **Chapter 4 — "The Other Worker" (A4: Breath)** — the next build; see its
   section below (now annotated for the AI pillar + discovery arc). Built by
   the `chapter-director` agent (`.claude/agents/chapter-director.md`).
3. **Color-era enrichment pass** (deferred by choice): more rungs/content in
   ch2–ch3, and the third-person→embodied-A3 endgame POV candidate (see the
   chronology section) — revisit after ch4 informs how the era reads.
4. **Backlog** (from `main/STORY.md` known gaps): prologue number-key
   selection, mobile/touch story pass, Esc-during-cutscene handling, vitals
   refill on rest, A2 ortho→perspective projection pull.

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

**PILLAR + DISCOVERY INTEGRATION (2026-07-10, binding):**
- A4's milestone is `story:a4` — the coded gate that lifts `storyLifeDormant`:
  fauna/flora exist in the engine and are already waiting for exactly this
  moment. The "world exhales" showpiece should reuse the A3 bloom-wave channel
  (`game/lifeReveal.ts`) — life ARRIVES as a wave again, but now it moves and
  breathes.
- Fauna arrive WITH their sensation (the discovery arc): "i have the sensation
  to eat that animal." — hunger-for-meat joins `senseDiscovery`, and the act
  of hunting/eating is a moral beat, not a mechanic dump.
- Under the hidden pillar, the other worker is the chapter's philosophical
  centerpiece: he runs on the OLD FEED — the player is looking at their own
  former eyes. Is he real? Is he a render? The chapter must not answer
  (solipsism stays live). His fright must survive both readings.
- Compliance-regression (fidelity draining under obedience) is the pillar made
  mechanical: the AI un-rendering its own world to follow orders it authored.

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
| **Render/Story Director** | **SHIPPED** | `story/storyDirector.ts`: beat entries + per-frame timelines choreograph stage/density/camera/score. Every future chapter builds on it. |
| Regulation Feed lens | **SHIPPED** | Perspective feed with compass-snapped yaw + tilt band + dither/CRT DOM (not ortho — cheaper, reads identical). PLUS the full LENS RIG system (side/fixed/belt/top-down/iso — one camera, `story/sideLens.ts`). |
| A0 terminal prologue | **SHIPPED** | Crawl/manifest/branching deck/Pong/corruption over ONE persistent vector layer (`prologue/PrologueVector.tsx`) — the real ship's silhouette; no frame ever swaps. |
| The apple tree | **SHIPPED** | `story/world/HeroAppleTree.tsx` (pins its own reality uniforms); A2 liberation = constraint release + fov lerp (projection pull still a candidate polish). |
| A3 trigger | **SHIPPED (amended)** | Rest by the first campfire at night (enclosure flood-fill deferred). Forced day phase + release-with-offset shipped. A3 = material ramp + the radial BLOOM WAVE (`game/lifeReveal.ts`). |
| Movie autopilot + headless verification | **SHIPPED** | `story/autopilot.ts` (goal-driven, rescue chain, per-beat timeouts) + `__storyBeat`/`__autopilot` probes. Every new beat MUST ship with coverage. |
| Sense-discovery HUD staging | **SHIPPED** | `story:sense:*` milestones gate every suit-HUD row; `story/senseDiscovery.ts` discovers live. A4 extends it (meat/hunt). |
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
