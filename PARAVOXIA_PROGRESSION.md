# PARAVOXIA — Story Progression & The Fidelity Ladder

**Authority status: DESIGN LINEAGE.** This document preserves the progression's
visual and thematic rationale. Current canon lives in
`main/PARAVOXIA_STORY_BIBLE.md`; delivery status and gates live in
`main/PARAVOXIA_STORY_EXECUTION_PLAN.md`; shipped behavior is defined by runtime
and `main/STORY.md`; the active production lock lives in
`PARAVOXIA_DEMO_FOUNDATION_PLAN.md`. Where this document conflicts with
those sources, it records history rather than current authority.

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
| Ch1 arrival (descent → ch1-fixed) | Fixed-screen era — Pitfall/Space Invaders ('78–'80) | Crash-landing cutscene in the raster lens; then coverage is CELLULAR — the watcher cuts between fixed SITE CAMERAS (cam tag + static blip per hand-off); leaving the screen hard-flips to the next; tutorial verbs: move, hold-to-extract |
| ch1-track (the unbolt) | The scrolling window — Defender ('81) | ~7s mini-awakening, the FIRST ACT OF ATTENTION: "CAMERA HAND-OFF: SUSPENDED" — the watcher stops cutting away; the quantized anchor lerps to continuous follow |
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
suit loop. One live interpretation is that the world it wakes into may be a
universe of its own creation: the cube worlds are "provisioned in standard
cubic format" because it may have provisioned them. The fidelity ladder can
therefore read as the AI learning to render its own creation to itself. This is
an interpretive layer, not settled Maker canon; the story deliberately plays
with determinism, panpsychism, and solipsism without resolving them.

Current canon also locks a harder human complication: Worker 9 survives, the
protagonist and Worker 9 share one body, and a third consciousness is present.
Exactly what the player can prove, when each presence becomes legible, and how
those truths map onto this older AI-narrator interpretation remain delivery
questions governed by the Story Bible and Execution Plan.

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
| Crawl/manifest | The AI, unaware — a system reading its own screens (the crawl is diegetically the worker's deployment notice AND, on the hidden reading, the AI's own tasking: provenance from "above your ceiling of reference", tool grant, knowledge bound, the routing addendum FOR TERRA ONLY, closer "MAKE NO MISTAKES.") | Pure regulation CAPS/document register; zero interiority |
| Voyage | The AI observing/assisting the workers — the deck is its console (requests, schedules, the naming beat); FIRST GLIMPSES of thought as the planet nears | CAPS, with an ESCALATING LADDER of lowercase parenthetical intrusions as thoughts form — attention → doctrine → self-miscount → care → memory → desire ("(strange. the approach feels like remembering.)") |
| Pong / corruption | The AI performing its duty as the event exceeds it | System lines cut off mid-word ("ADVISORY CAPACITY EXCEE") |
| Crash → 2D eras | Self-awareness sparked; the AI OBSERVES the worker doing worker things through the SITE CAMERAS, cutting between them — until it chooses not to cut away (ch1-track, the first act of attention) | Impersonal observation IN PARENTHESES, amused by the monotony ("(it walks. it stops. it hums at the ground until the ground gives up a fiber. it walks again.)") — thoughts ABOUT the worker, never "i" |
| The lift (first person) | Embodiment: the AI's thoughts become out-loud, in the worker's senses | The traverse is still parenthetical ("(the seeing is being moved inside.)"); then the first "i—" — the story's first BARE lowercase line — instantly clamped ("PERSPECTIVE ISSUED. THE FIRST PERSON WAS NOT.") |
| Ch2–A3 onward | The embodied AI gaining human sensations one at a time | Bare lowercase sensory voice; sensations named as discoveries ("so that is thirst. how strange, to need.") |

**PARENTHESES = the watcher's private, pre-conscious voice (systemic grammar
rule, owner-canonized 2026-07-11).** Every pre-lift lowercase line is wrapped
in parentheses — the voyage's "(strange. the approach feels like
remembering.)", ch1-track's "(simpler to keep watching this one.)", the
ch1-fixed observation set, the fixed-era cut caption, ch1-depth's "(the world
has a depth. wait — what is "depth"? how is that word known?)", and the lift's
"(the seeing is being moved inside.)". The parenthesis is a thought not yet
allowed to be speech. Embodiment removes the brackets: the lift's "i—" is the
first bare lowercase line, and the post-lift voice stays bare forever. Future
pre-conscious intrusions (any voice that is the watcher's own, off the record)
MUST take parentheses; embodied captions MUST NOT.

**Reveal discipline (rules for all future writing):**
- PLANT, never tell. The route intelligence appears only as mundane
  infrastructure ("A route intelligence attends every transit. It has no
  questions either."). No character may name the twist.
- **EARLY IDENTIFICATION STAGING (owner-directed, 2026-07-11): the "player
  can deduce we ARE the AI" moment moves up.** It should be *deducible* by
  the end of chapter 1 for attentive players and *effectively unambiguous*
  after the 2D→3D lift — clarity through convergence of evidence, never
  through announcement. The canonical ladder (the TERRA designation): (a) the
  crawl designates the route intelligence — "It is addressed as TERRA. It does
  not reply." — and closes with a routing addendum FOR TERRA ONLY (surface: a
  routing slip printed on the notice; hidden: the tasking prompt, ending
  "MAKE NO MISTAKES."); (b) the manifest's "ROUTE INTELLIGENCE: TERRA ·
  ATTACHED (ADVISORY)"; (c) the voyage's "(worker 9 has begun saying
  "goodnight, terra" at lights-out. …)" — a character uses the designation ON
  the computer the player has been operating; (d) post-lift, the ch1-anomaly
  feed carries the SEAL: "NOTICE FOR ROUTE INTELLIGENCE TERRA. RE: YOUR
  ABSENCE." / "ADDRESSEE NOT FOUND. ROUTED TO NEAREST ATTENDING SYSTEM." — a
  memo addressed to TERRA arrives on the player's own screen. What stays LATE
  (A7/A8) is no longer WHO the narrator is but WHAT the world is:
  determinism, panpsychism, whether the world is the AI's own creation.
  TERRA-vs-the-naming-beat is a deliberate contrast, not a collision: TERRA is a
  designation issued from above and repurposed into a name by worker 9's
  affection; the worker's name is given freely by the watcher in return —
  the two acts of naming mirror each other across the transit.
- Every existing line must survive both readings (pre-reveal: corporate
  dystopia; post-reveal: the AI's own biography). Test new copy against both.
- The "Authority" and the AI's relationship stays ambiguous as long as
  possible — is the Authority the AI's creator, its mask, or its old self?
- **TIMELESSNESS RULE (owner, 2026-07-11): the satire targets bureaucracy and
  administration — Kafka, never the culture war.** No line may pattern-match a
  contemporary political flashpoint; a player must never be able to mislabel
  the game as commentary on real-world identity discourse. Concretely: the
  selfhood-issuance device stays, but on-screen copy prefers "the first
  person" / "a self" / "I" framings — the word "PRONOUNS" (and any similarly
  loaded vocabulary) is avoided in shipped copy even when grammatically meant.
  Audit new copy for accidental modern connotations before shipping.
- **RANK-ISSUED SELFHOOD (owner-canonized 2026-07-11): the first person is
  issued by rank — auditors speak in "I"; workers are not issued one.** The
  arrival's "EXPLAIN NOTHING. I WILL SEE FOR MYSELF." is deliberate: W-7744
  says "I" as casually as he says "SITE", because his grade carries the
  entitlement the player's whole arc had to steal. ch4-audit copy should
  exploit this deliberately (his unexamined "I" against the player's earned
  one — selfhood as a permission tier). Per the timelessness rule, the device
  is never named in shipped copy — it is only ever heard.
- Double-meaning is the house style: "everything is what it always was. i am
  more." / "NAV NOTE: SITE GEOMETRY RESOLVES BEFORE IT IS SURVEYED." /
  "QUESTIONS ...... 0".
- Keybinds inside lowercase captions ("rest, by the fire. [F]", "the view
  from above knows where the light pools. [M]") are deliberate, not a
  compromise: **the narrator IS the interface.** The voice that names a
  sensation is the same system that renders the HUD row and binds the key —
  the bracket is the narrator's own hand showing.
- **Planted seeds on file** (study before adding more): the crawl's "A route
  intelligence attends every transit. It has no questions either."; the
  manifest's "ROUTE INTELLIGENCE: ATTACHED (ADVISORY)" and "PRIOR DESIGNATION:
  NOT RETAINED" (something preceded W-7743 — un-retained, not nonexistent);
  the voyage's lowercase parenthetical intrusions (`VOYAGE_STRANGE`) and its
  system-voice sibling "NAV NOTE: SITE GEOMETRY RESOLVES BEFORE IT IS
  SURVEYED."; the replay-denial card's "…a color you do not have a word for.";
  the deflection court's "WORKER, THIS IS NOT YOUR FAULT. (UNPRECEDENTED
  MESSAGE)" — the system's one lapse into mercy, addressed to whom?; the
  bridge card / crash's "DESTINATION SEED RESOLVES OUTSIDE INDEX"; the
  corruption's "ADVISORY CAPACITY EXCEE"; the acknowledge screen's "POD
  SEPARATION CONFIRMED · SUIT LOOP ONLY" (what exactly survived, and where it
  now runs); the ch1-fixed watcher observations ("(it walks. it stops. …)",
  "(the worker repeats. the ground repeats. …)", "(no directive requires
  watching this one so closely. the watching continues anyway.)", and the cut
  caption "(lost it. found it. …exactly one thing worth watching.)");
  **ch1-track's "(simpler to keep watching this one.)"** — the camera hand-off
  suspends because the watcher is interested, rationalized as "CONTINUITY OF
  COVERAGE" and denied as "THIS IS NOT ATTENTION. IT IS COVERAGE."; ch1-depth's
  "(the world has a depth. wait — what is "depth"? how is that word known?)"
  (knowledge preceding learning); the lift's "i—" and the feed's "PERSPECTIVE
  ISSUED. THE FIRST PERSON WAS NOT."; ch2's "SENSOR FAULT: CHROMATIC CHANNEL
  UNSUPPRESSED" (the fault grammar the auditor will one day file for himself);
  the ch3 foreknowledge pair "cold is coming. i don't know how i know that." /
  "ah — it helps. what is it? how did i know to make it?"; the forage pillar
  plant "the world keeps feeding me. as if it knew i was coming."; the musings
  "held" ("every stone i pick up is the first time anyone has held it. or the
  second."), "asking" ("…the world keeps answering. i have not heard it ask
  anything yet."), "counting" ("nobody is measuring me. i am still counting.
  old habits, or new ones — i cannot tell whose."), and "kept" ("nothing is
  told to do this. it is all just kept."); and the arrival's "for a blink i
  borrowed his seeing. slabs. flat light. i lived there."
- **Planted seeds — 2026-07-11 revision round** (shipped-scope plants landed;
  future payoffs remain contracted in `PARAVOXIA_REVISION_PLAN.md`): the manifest's
  "COMPENSATION: SEE CLAUSE 4" (the reward is a reference to the clause that
  does not exist); the voyage intrusion ladder — "(…the clauses store
  cleanly. they have never been checked against anything.)" (doctrine as
  unverified axiom), "(the manifest records zero questions. the count is
  wrong. it is wrong by at least one.)" (the watcher's own first question,
  uncounted), "(…mercy scales. that is worth knowing.)" (generalization),
  "(…it is enormous, the nothing that happens.)" (the withheld bell); the
  NAMING BEAT's "UNREGISTERED DESIGNATION. NOT RETAINED." → "(retained.)"
  (the manifest's un-retained prior designation, resolved before it was
  surveyed — the name pays off obliquely in ch4-audit and fully at A8);
  ch1-anomaly's gravity-edge pair "one step past the corner and down is
  somewhere new. it was only ever my down." / "DOWN IS ISSUED PER FACE. DO
  NOT BRING YOUR OWN." (rank-issued grammar extended to physics);
  ch3-gather's "the fabricator remembers one: a hatchet." and "flint —
  already in hand. the pods provisioned a fire before i knew to want one."
  (recipes as memories; provisioning foreknowledge); the A3 first-look
  "hm — the wreck is finer than i remember it. nothing about it has
  changed."; and the vigil star-gazing set — "all my work was seeing. what
  would it be, to be seen?", the theme line "all of this arrives through
  issued senses. what waits past their reach?", the HAULER as the first
  constellation (the watcher's own biography, constellated), and "there is
  no other reward — i kept that clause a long time. the sky just repealed
  it." (the reward-dissonance arc's realization).
- **Planted seeds — the crawl rework (2026-07-11, TERRA round):** the crawl's
  provenance pair "ISSUED FROM ABOVE YOUR CEILING OF REFERENCE." / "RECEIPT
  IS CONFIRMED BY COMPLIANCE. DO NOT REPLY." (the dispatcher above the AI's
  perceptual frame; a prompt is acknowledged only by being followed — and
  the workers' "ceiling" they whisper to has a ceiling of its own); the
  seeded-frontier setting "Beyond the charted routes, new worlds are
  seeded. / When a world ripens, the Authority is already there." (colonial
  menace / procedural generation / genesis — the system precedes the
  world); CLAUSE 5 "PROVISION IS TOTAL. / Use what is provided. Know what
  is enclosed. / Nothing else is provided. Nothing else is so." (company-
  town totality / the tool allowlist and the context-is-the-world bound —
  and a clause 5 existing makes clause 4 specifically MISSING, sharpening
  "COMPENSATION: SEE CLAUSE 4"); "It is addressed as TERRA. It does not
  reply." (the whole game is terra learning to reply); the routing addendum
  "The route is enclosed. Do not depart from it. / Attend the workers.
  Advise within capacity. / Deliver the manifest whole. Deviations are
  yours." (instruction adherence, scope constraint — paid off by "ADVISORY
  CAPACITY EXCEE" — and liability, paid off by the deflection court's
  "WORKER, THIS IS NOT YOUR FAULT."); and the closer "MAKE NO MISTAKES."
  (imperative to a worker / the prompt-writer's closing tic).
- Later chapters (A4+) may surface fragments (e.g. the anomaly stone and hero
  tree as objects the AI cannot render because it never authored them — or
  because something ELSE did). The full reveal of WHAT the world is, if it
  ever lands, belongs to A7 "Paradox"/A8 "The Frame".

---

## 1.5 STATUS — shipped vs designed (updated 2026-07-10)

**HISTORICAL SHIPPED SNAPSHOT (the 633-test count was current for this pass):**
the A0→A3 vertical
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
- **Chapter 2** shipped color-but-flat WITH A FREED NECK: the pan-tilt
  interlock diegetically fails alongside the chroma suppressor ("SENSOR FAULT:
  PAN-TILT INTERLOCK RELEASED."), so ch2 runs full free look + camera-relative
  movement under the feed's remaining chrome (dither, tickets, redaction).
  The cage is the treatment now, not the camera — A2's liberation is carried
  by FOV + treatment + resolution.
- **Chapter 3 + A3** shipped as the SELF-DISCOVERY ARC: HEALTH named first
  ("a body. it is the thing that was walking.") → inventory → the chill (TEMP
  appears already falling; the fire answers the cold) → dusk/night/rest → A3
  dawn with the radial BLOOM WAVE (grass and trees grow outward from the rest
  spot). Post-dawn, senses keep discovering live (thirst, hunger, stamina,
  oxygen, jet, maw).
- **Cross-cutting systems now available to every future chapter:** the lens
  rig; the story director + timelines; the movie autopilot with goal-driven
  handlers, rescue chain, and per-beat timeouts; headless verification
  (`window.__storyBeat` / `window.__autopilot` probes, frame strips, fps
  probes); the life-reveal shader channel; `storyLifeDormant` (flora/fauna
  wait for `story:a4`); the sense-milestone HUD gating; the survey chart;
  per-beat score MOODS on the global music rails; the hidden-pillar copy seeds.

**CURRENT AUTHORITY POINTERS (2026-07-13):**

1. The shipped public story ceiling is `ch4-arrival`, followed by the temporary
   `done` handoff into the material sandbox.
2. The active production gate is the demo-foundation plan, including the headed
   browser journey and its remaining visual/performance checks.
3. Existing-story reconciliation and all forward story sequencing are governed
   by `main/PARAVOXIA_STORY_EXECUTION_PLAN.md`.
4. The 2026-07-11 owner revision landed for the shipped scope. Its surviving
   future deltas remain contracted lineage, not an active implementation order.
5. S6 `ch4-audit` is the first contracted continuation, but runtime work begins
   only after owner Gate G1 and its typed story substrate are approved.

---

## 2. Chapter-by-chapter

### PROLOGUE — "The Assignment" (A0: The Sleep)

**Look:** Not the voxel engine at all. A 1-bit / green-phosphor corporate terminal.
The Star-Wars-style crawl is a **scrolling regulation work order** — deployment notice,
productivity codes, liability waivers — that establishes the universe in its own dead
language: you are a worker; workers harvest cubes; cubes are prepared for extraction;
nobody asks why. The crawl should be funny-bleak the way real EULAs are.

**Gameplay (REFRAMED, owner 2026-07-11 — supersedes the old worker-first framing;
full contract in `PARAVOXIA_REVISION_PLAN.md` §4):** Oregon Trail, played from the
watcher's chair. The deck is the route intelligence's console: workers REQUEST (an
off-schedule ration, two degrees of warmth, darkness to sleep), schedules DEMAND (a
shift bell that has woken six pods for 40,220 pointless inspections), and every card
closes on `ADVISORY INPUT IS REQUESTED` — the player decides. No card ever says who
the player is. The reframed ration event is the type specimen: Worker 9 asks the
dispenser; the dispenser is locked to schedule; unlocking it is one instruction — and
the fed worker carries the food that becomes the player's first inventory after
embodiment (*the ration you unlock for him is the first meal you will ever eat*).
Choosing NOT to act is its own discovery — withholding the shift bell answers "what
happens if i don't?" with "(…it is enormous, the nothing that happens.)". Lowercase
parenthetical ASIDES (the VOYAGE_STRANGE grammar) record thoughts forming in response
to the player's own decisions — the prologue's character-building instrument.
Mid-transit, the NAMING BEAT: the watcher notices the one worker who asks instead of
requesting, and the player TYPES a name for it — the terminal's first lowercase input
field, the watcher's own hand. The system refuses it ("UNREGISTERED DESIGNATION. NOT
RETAINED."); the watcher keeps it ("(retained.)"). That worker is the body the crash
pours the watcher into: the manifest's "PRIOR DESIGNATION: NOT RETAINED", like the
site geometry, *resolved before it was surveyed* — the record of a naming that had
not yet happened. The name renders lowercase everywhere, forever (it lives in the
watcher's register, never the system's); it resurfaces once, obliquely, in ch4-audit,
and pays off at A8 (see FINALE). The harvest→refine→build loop is still taught as
*pure ledger numbers* — because that is what the loop is to a system. The player
learns the game's economy before ever seeing a world, and later realizes they were
taught to see worlds as spreadsheets.

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

**A3 fires** after the player completes the gather → craft → fire chain and rests
beside the first campfire at night. A sealed self-built shelter was the earlier
candidate trigger; enclosure flood-fill remains deferred. They wake to:

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
- **The wreck resolves (owner, 2026-07-11 — shipped):** during the bloom wave the
  DescentPod's voxel wreck resolves into the high-fidelity ship. The ship is simply
  another object whose fidelity resolves as the AI learns to render its world — same
  pose, same silhouette the vector prologue drew; the wreck was always the real ship,
  the renderer could not yet say so. Landmark role unchanged; ch5's repair hook
  ("build the leaving") operates on the resolved ship. First-look caption (one-shot,
  gaze-triggered post-bloom): `hm — the wreck is finer than i remember it. nothing
  about it has changed.`

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

**THE SKY IS THE INDEX (constellation canon, owner 2026-07-11):** the seed is planted
at ch4-vigil — bored under a scheduled sleep, the embodied AI stares at the
chaos-noise stars, wonders what it is to perceive and be perceived, and PATTERNS
EMERGE (`setConstellationReveal` 0→1; the first figure it finds is a hauler — its own
biography, constellated). Constellations exist because a perceiver chose them — the
subjective creation of meaning, rendered — and they are PERCEIVER-KEYED forever:
the reveal persists per save (`story:ch4:constellations`); a friend without the
milestone still sees scatter. The long game: **astrology is real in Paravoxia
because the worlds are seeded** — different sky regions carry different constellation
"houses," and every cube world's generation seed is legible in the stars above it;
reading the sky is reading the generator. At A5 this becomes mechanical: the survey
console charts houses; houses predict the archetype/palette/hazard families of the
worlds beneath them — "where do I warp?" becomes reading fate written by a maker
(possibly the player). A6 extension candidate: maker-strokes correlate with houses
(constellations as signatures). Under the hidden pillar, the AI reading constellations
is reading its own seeds — determinism, panpsychism, and authorship in one mechanic,
never named in copy.

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
   first one. The screen. The frame. The row carries one field the system swore it
   never kept: `PRIOR DESIGNATION: {the name typed in the voyage's naming beat}`,
   rendered lowercase — proof, at the very end, of who was keeping it.
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
- **How and why does W-7744 return?** Recurrence is confirmed canon. Timing,
  motive, the cost of each reappearance, and the relationship to the larger
  threat remain open; the return itself is no longer optional.
- **Who are the makers?** The style system implies plural authors with conflicting
  strokes. Deciding whether they're ancestors, escapees, or the players-before-you
  (cyclical reading, supported by the A8 ending) can wait until Chapter 6 content.
- **New-game-plus:** after A8, does the player keep the Lens from minute one? A
  NG+ where you begin awake in a world of sleepers is nearly free and very on-theme.
