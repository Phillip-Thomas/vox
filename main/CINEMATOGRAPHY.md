# Paravoxia Cinematography Bible

Status: shipped-visual continuity authority
Version: v1
Date: 2026-07-13

## Purpose

This document gives the Cinematography Director one grounded view of the
visual story that already exists. It does not replace executable truth. When a
claim differs, current runtime and captured evidence win, and this bible must
be repaired.

Paravoxia's visual thesis is unusually literal: **the camera and rendering
pipeline are the protagonist's changing capacity to perceive**. Composition,
lens, palette, resolution, motion, lighting, and post effects are story events,
not a beauty layer pasted on after narrative work.

The ambition is cinematic authorship with browser-native means: procedural
worlds shaped into memorable focal images, severe constraints that become
style, exact camera hand-offs, restrained grading, bespoke shader events, and
performance discipline strong enough that the illusion never apologizes for
being Three.js.

## Authority precedence

This is precedence when sources disagree, not merely a suggested reading order:

1. Reachable runtime, current captures, and `STORY.md` — shipped behavior and
   player-visible visual truth. Its detailed live authorities include
   `src/story/storyState.ts`, `storyDirector.ts`, `storyScript.ts`,
   `storyInputPolicy.ts`, `sideLens.ts`, `feedCamera.ts`, `cinematicLook.ts`,
   and `feedRuntime.ts`; plus `src/game/systems/realityRenderSystem.ts`,
   `src/utils/planetArtDirection.ts`, `planetVisualProfile.ts`,
   `src/components/effects/PostFX.tsx`, and `src/config/graphicsSettings.ts`.
2. `../PARAVOXIA_DEMO_FOUNDATION_PLAN.md` — what work is currently allowed.
3. `PARAVOXIA_STORY_BIBLE.md` — canon, reveal discipline, and protected open
   questions.
4. Owner-approved scene contracts — bounded authored visual detail.
5. `PARAVOXIA_STORY_EXECUTION_PLAN.md` — future gates and sequencing.
6. `../.codex/design-runs/2026-06-28-cinematic-render-polish/` and the latest
   relevant screenshot reports — visual decisions and evidence, never a
   substitute for a current capture.
7. `../PARAVOXIA_PROGRESSION.md`, `../PARAVOXIA_CH4_PLAN.md`, and
   `../PARAVOXIA_REVISION_PLAN.md` — visual/design lineage, never automatic
   production authority.

Future plans do not authorize implementation. Current code does not by itself
prove taste. Both distinctions must remain explicit.

## The shipped visual arc

| Beat/sequence | Camera and cut language | Palette/render state | Focal promise |
| --- | --- | --- | --- |
| `crawl` | locked terminal field; stars drift behind an 84s regulation crawl | phosphor `#7dfca5` on near-black `#020604` | words feel like an operating system writing the player into existence |
| `manifest` | one persistent vector layer; hauler enters and holds at the dock gantry | same phosphor world, increasing vector detail | the ship is the first authored silhouette, not a UI decoration |
| `voyage` | aligned formation, growing cube destination, detail resolves with transit | phosphor hierarchy with restrained warning amber `#ffd28a` | choices and the approaching world share one frame |
| dive / `deflect` | ship banks and dives; camera chase; planet consumes frame; image collapses to one CRT scanline and re-expands into the court | phosphor → oscilloscope monochrome without a frame swap | the world becomes the screen that will judge the player |
| `crash` → `descent` | corruption, brace white-out, then ground-watched raster crash; ~8.5s with impact at ~4.5s | regulation monochrome; white `#eef3ee` impact; glitch/scan roll | falling pod becomes the persistent wreck landmark |
| `ch1-fixed` | bolted 24-unit site-camera cells; crossing an edge is an authored hard cut/static blip | bare reality, desaturated feed | the frame refuses to follow the worker |
| `ch1-track` | 6.5s rig blend; quantized anchor becomes continuous follow; ~7s letterbox | same palette; change is motion/attention, not new color | the camera choosing to keep watching is the awakening |
| `ch1-raster` | continuous side profile | bare/monochrome | the work strip reads laterally and the wreck remains a navigational memory |
| `ch1-depth` | same camera family, distance 18, bounded depth band; 2.5s hand-off | bare/monochrome | depth appears as navigable clearance, not a decorative parallax trick |
| `ch1-nav` | one rig moves to straight-down over 5s, distance 34 | bare/monochrome + grid/navigation chrome | authored world geometry becomes information |
| `ch1-iso` | rig settles near 34° elevation / 45° azimuth over 5s, distance 26; DPR snap masked by glitch | bare/monochrome | height becomes legible and the signal mesa owns the frame |
| `ch1-lift` | ~7s letterboxed physical traverse from ISO into the worker's eyes; profile-to-first-person blend; one masked DPR snap | bare feed; glitch at perspective issue | the geometry of seeing becomes embodiment |
| `ch1-anomaly` | first-person CCTV pan/tilt; compass-snapped yaw and bounded tilt | bare feed, anomaly stone deliberately the first continuous form | calibration, then the deviation; one goal at a time |
| `a1-ramp` | held first-person subject framing; no arbitrary cut | eight-second seeded chroma instability | color is acquired, unreliable, and emotionally synchronized with score |
| `ch2-color` / `ch2-approach` | freed-neck first person inside surviving feed chrome | color but intentionally flat; hero tree is the saturated violation | the tree attracts attention without a quest-marker composition takeover |
| `a2-awakening` | violation flood → HUD death → six-second liberation; FOV 50→75; treatment and resolution release | feed treatment dissolves into free, color reality | the cage dies around the player's own view |
| `ch3-gather` | embodied first-person; camera belongs to the player | color stage, frozen noon | hands, body, inventory, cold, and fire become the composition |
| `ch3-dusk` | ~8s letterbox and eased look toward setting sun inside the longer dusk transition | fire/night grammar, warm horizon against cooling world | light leaving makes shelter emotionally necessary |
| `ch3-await-rest` | player-owned night observation | cool environment with ember/fire answer | rest is chosen in a world that now has time |
| `a3-dawn` | sleep fade/black/hold/wake; rising-sun look; 12s material ramp and 16s radial life front | dawn gold, material detail, organic reveal | grass and trees grow outward from the player's rest point |
| `ch3-thirst` → `ch4-vigil` | **continuous embodied long take**; no external coverage, no casual letterbox | material world follows daylight/night; audit language enters the world rather than reclaiming the screen | perception remains the player's while senses and purpose form |
| `ch4-arrival` | ~45s sleep/fade; letterbox returns with W-7744; camera tracks his ridge-to-relay walk and releases after speech | material dawn + regulation ember `#ff5a3c`; two-frame bare blink | the system is now another body in the same world |
| `done` | player camera fully restored; W-7744, wreck, relay, mesa, stone, and tree persist | settled material world | the shot leaves consequences, not a reset stage |

The table is a contact-sheet index, not proof. Every changed scene must cite a
current frame strip or live screening.

## Visual laws

### 1. Fidelity is causality

The reality stages `bare → color → material → alive → paradox` are earned
narrative capacities. A scene cannot borrow texture, vegetation, atmospheric
depth, painterly treatment, or other later language before it is earned.

Device quality and narrative fidelity are separate. LOW/POTATO may simplify
AO, grade, outline, particles, or sampling, but it cannot reveal or remove a
story fact, change the focal subject, or make an awakening semantically weaker.

### 2. One camera lineage

Use the existing authorities:

- `LensRig` for external profile/fixed/depth/top-down/isometric frames;
- `feedCamera` for CCTV pan/tilt;
- `cinematicLook` for authored first-person attention that hands control back;
- the player's camera for embodied long takes;
- prologue vector composition for terminal-space scenes.

Extend these before inventing a parallel camera. A second unsynchronized
camera state machine is a continuity defect.

### 3. Every frame has one subject

Each shot declares:

- the first thing the eye should find;
- the second piece of context;
- what may remain ambiguous;
- subject occupancy and horizon/negative-space intent;
- caption/HUD safe area on desktop and mobile;
- the hand-back to the player.

Procedural generation is not permission to accept accidental composition.
Use deterministic anchors, blocking, look targets, landmark relationships,
camera-relative safe bands, and seeded selection to author the focal image.

### 4. A cut is a statement

Hard cuts are rare and declared: the site-camera cell hand-off is a cut because
surveillance refuses continuity. Most era changes become each other through
one physical camera lineage, a treatment collapse, an occlusion, a flash, a
sleep fade, or a diegetic screen transition.

Any persistent value—FOV, rig, grade, exposure, look pull, shake, distortion,
letterbox, reality override—uses named easing and a defined reset. No hidden
snap survives beat exit, deep link, replay, pause/quit, or completion.

### 5. Agency is part of the shot

Forced looks and movement freezes must be short, motivated, and written into
the scene contract. Mouse input may continue underneath a look pull so the
player's hand wins back the camera without a snap. The contract defines:

- when control narrows;
- what subject earns it;
- when movement and look return;
- how reduced motion behaves;
- what happens on pause, focus loss, replay, and mobile touch.

The first-day stretch after A3 is deliberately an unforced first-person long
take. Do not “improve” it with omniscient coverage. Cinema returning with
W-7744 is narrative grammar.

### 6. Effects are verbs

Glitch means the system cannot reconcile a change. Chroma dropout means color
is unstable. DPR snaps are hidden by corruption because reallocating perception
is violent. Letterbox means authored attention has re-entered. The bare blink
means seeing through another being. Bloom is a material/event response, not a
default glow treatment.

Every new effect answers: what changed in perception, why now, what is the
focal subject, how does it clear, what does reduced motion do, and how does the
lowest tier preserve meaning?

### 7. Browser performance is invisible craft

Prefer uniform animation, persistent objects, bounded shader work, deterministic
instancing, change-gated DOM writes, and masked discrete reallocations. A
cinematic frame that hitches at its emotional turn fails, even if the still is
beautiful. Budget and measure CPU, GPU, draw calls, shader programs, memory,
DPR, and effect fallbacks before approval.

Critical anchors have a stricter invariant: the two-second window on either
side of a player verb or story handback may reveal prewarmed objects and change
uniforms, intensity, opacity, scale, or visibility, but it may not change scene
light cardinality or first-use a shader program, geometry, material, texture, or
render target. Practical glow at an anchor uses prewarmed additive/emissive
geometry; persistent lights vary intensity without mounting or unmounting. Cold
HIGH and lowest-tier browser evidence must show zero context loss, zero graphics
diagnostics, no new shader programs in the anchor window, and no frame over the
chapter's cold-activation budget.

## Lens and camera grammar

Current perspective anchors:

- feed/CCTV FOV: 50°;
- free embodied FOV: 75°;
- the current A2 liberation eases between those values;
- navigation/isometric policy targets currently use narrower authored framing
  in `storyInputPolicy.ts`; inspect the live values before authoring changes;
- the classic external side rig is distance 16, lift 3.0, focus lift 1.4;
- ISO is elevation 0.6 rad, azimuth π/4, distance 26, lift 2.4, focus lift 1.2;
- top-down is elevation π/2, distance 34.

FOV is the current executable lens control. A scene treatment may record
physical-lens intent—focal length character, filmback assumption, focus
distance, depth-of-field intent, shutter/motion language—but must distinguish
aspiration from shipped capability. Do not fake physical terminology without a
verified mapping to the actual perspective camera.

Lens changes must be narratively motivated:

- narrower views surveil, flatten, isolate, or make a system feel present;
- widening views grant embodiment, peripheral agency, scale, or breath;
- external rigs describe a being observed;
- first person describes the observer becoming the being;
- player-owned long takes protect presence;
- camera motion should reveal new spatial knowledge, not merely add movement.

For each shot, record start/end FOV, duration, easing, target, roll policy,
camera authority, player-input blend, collision/occlusion risk, mobile crop,
and exact reset.

## Color script

Paravoxia uses semantic palette roles, not isolated scene swatches. The world
palette authority is `planetArtDirection.ts` and `planetVisualProfile.ts`; the
unified grade derives from the planet, daylight, and reality effects.

Canonical story families:

| Family | Anchors | Use |
| --- | --- | --- |
| phosphor transit | `#020604`, `#7dfca5`, `#eafff0`, warning `#ffd28a` | prologue, vector ship, ledger, terminal corruption |
| regulation mono | near-black/grey-green, impact `#eef3ee`, continuous-form stone `#e8ecef` | crash, bare ladder, CCTV authority |
| chroma breach | planet-derived roles entering through seeded dropout | A1 and color-but-flat chapter 2 |
| embodied noon | planet palette with restrained saturation and flat material response | A2 hand-off and ch3 gathering |
| fire/night | cool world shadows, warm fire/horizon, readable skin/HUD values | first dusk, cold, rest, vigil |
| material dawn | golden sun (`#ff9c4a` family), verdant organic roles, preserved cool shadow | A3 and first day alive |
| audit return | settled material dawn plus relay/visor ember `#ff5a3c`; two-frame bare interruption | W-7744 arrival |

Palette continuity rules:

- cite semantic roles and the palette source, not only hex values;
- keep the focal accent scarce enough to remain a focal accent;
- preserve skin/subject/environment separation at every tier and color-vision
  condition;
- grade the composed frame once; do not stack arbitrary component filters;
- sunlight, fog, sky, terrain, water, vegetation, and post grade must describe
  the same atmosphere;
- a deliberate anomaly records the broken rule and its story reason;
- recapture adjacent beats when a grade changes so continuity is judged across
  the cut, not on one attractive frame.

## Render stack and ownership

The current high-tier post chain is:

1. N8AO/contact grounding;
2. selective bloom;
3. silhouette outline;
4. optional painterly Kuwahara;
5. unified planet/time/reality color grade;
6. flight motion;
7. underwater medium;
8. death decompile;
9. final ACES tone mapping.

The Cinematography Director may propose changes to ordering or parameters only
with before/after HDR reasoning, effect interaction proof, quality-tier
fallbacks, and performance evidence. It must not use the painterly pass to hide
weak composition or turn restrained “Soft Cinematic Resolve” into an unrelated
style.

The current continuity risk is that MEDIUM and lower tiers omit much of the
post chain. A scene contract must name the semantic fallback for focal contrast,
atmosphere, anomaly visibility, and authored transitions rather than assuming
the high-tier grade is present.

## Scene and shot contract

The portable schema lives at
`../docs/architecture/workflow-orchestration/schemas/paravoxia-scene-contract.schema.json`.
The production template lives in `../.codex/production-runs/_template/`.

Every scene declares:

- stable scene/shot IDs and revision;
- shipped references and prior-frame evidence;
- story purpose and emotional turn;
- reality stage/effect ceiling;
- palette family, semantic roles, and continuity links;
- score mood and shared sync anchors;
- player agency windows;
- shots with focal subject, camera authority, framing, blocking, screen
  direction, FOV/lens intent, easing, transition, grade/effects, and reset;
- desktop/mobile/reduced-motion/quality variants;
- performance budget and evidence plan.

Shared anchors are named events, not duplicated seconds. Examples:

- `lift.perspective-issued`
- `a1.color-stabilizes`
- `a2.feed-wall-falls`
- `a3.life-front-crosses-player`
- `arrival.worker-enters-frame`
- `arrival.bare-blink`

Story, score, and cinematography may each express an offset relative to the
same anchor. Timing changes therefore preserve intent instead of silently
desynchronizing three independent tables.

## Evidence and review

No screenshot, no visual approval. No single happy-path wide frame, either.

For each changed scene capture:

- establishing, turn, climax, hand-back, and exit frames;
- every declared hard cut;
- dense frames around flashes, DPR changes, short effects, and the two-frame
  bare blink when relevant;
- desktop, mobile, and any safe-area stress case;
- reduced-motion and low-tier semantic variants;
- player-controlled approach and movie-mode framing;
- previous and next beat for palette/lens continuity;
- FPS/frame-time and relevant memory/program counts.

Use `?story=<beat>&movie=1`, `story-strip.mjs`, exact-anchor probe additions,
deterministic vantages, and headed real-GPU screening. Four-second strips are
useful for long rhythm and insufficient for short cuts.

The blind `scene-naive-viewer` sees only the finished audiovisual capture and
reports what the eye followed, what changed emotionally, where control felt
stolen, and where the browser illusion broke. The canon-aware auditor then
checks the same evidence against this bible and executable truth. They file
independently before the Cohesion Judge compares them.

## Quality bar

A scene fails when it is merely competent, technically impressive but
unfocused, beautiful only at one tier, emotionally off-beat from the score,
generic “cinematic” coverage, over-filtered, compositionally accidental, or
dependent on the director explaining what the viewer should have seen.

Approval asks:

- Is the intended subject the first read without a debug marker?
- Does the camera reveal the story's new spatial or perceptual fact?
- Does the lens feel motivated and continuous with the adjacent scene?
- Does palette progression express earned fidelity?
- Do light, fog, world materials, and grade belong to one atmosphere?
- Does the score breathe with rather than annotate the image?
- Does the player understand when and why control changes?
- Does mobile/reduced motion/low tier preserve the scene's meaning?
- Does the emotional turn land without a hitch, pop, blank frame, or late cue?
- Is the moment specific enough that it could only be Paravoxia?

## Known visual debt

- There is no committed full cutscene contact sheet; current screenshot
  evidence is strongest for sandbox/reality-stage views.
- Shot IDs, cue sheets, blocking, safe areas, physical-lens metadata, grade
  preset IDs, and exact-frame probes are not yet runtime primitives.
- Current `cinematicLook` is only a global weight and target.
- Prologue timing is component-local while later choreography is imperative in
  `storyDirector.ts`.
- A1 framing can read sky-heavy from the mesa in movie mode.
- A2 liberation is presently carried by FOV/treatment/resolution rather than a
  full projection transition.
- The arrival's two-frame blink is intentionally invisible to coarse strips.
- Lower graphics tiers do not receive the complete high-tier cohesion stack.
- Terminal corruption still contains nondeterministic visual noise that can
  weaken repeatable comparison.
- Headed taste, pointer-lock feel, touch/mobile story, and complete current-cut
  screening remain real gates.

These are not blanket authorization to modify runtime. Record them as defects
or proposals under the active production lock, then implement only when the
scene's scope is explicitly allowed.

Until the full contact sheet exists, every visual production run must capture
and hash the affected **pre-change** cut, adjacent entry/exit frames, lens/FOV
state, palette family, reality stage, and source revision before proposing a
replacement. Record those files in the run's shipped-reference map and raw
evidence manifest. A director may cite this table to locate the cut; it may not
use the table as a substitute for seeing the current cut.
