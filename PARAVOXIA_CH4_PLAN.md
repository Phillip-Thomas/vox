# PARAVOXIA — Chapter 4 Plan: "The First Day Alive" → "The Other Worker" (A4: Breath)

**Commission:** continue down the list of stats. Every remaining suit sense gets a REAL
discovery scene in the temp/fire mold — a situation that CAUSES the sensation, a task
that answers it, the stat appearing at the moment of feeling — carried by the post-A3
stretch and Chapter 4, at the shipped slice's quality bar. This doc is the
implementation contract.

**STATUS (2026-07-10): S1–S5 SHIPPED** (`ch3-thirst` → `ch3-forage` → `ch3-signal` →
`ch4-vigil` → `ch4-arrival`), movie-verified end to end (3 cold `descent→done` runs:
466.6s / 463.3s / 463.8s, zero timeout rescues; ≥55fps at every new beat under
headless swiftshader, 60 steady). **TEMPORARY TERMINAL:** after the arrival timeline
completes, the story completes via the existing completion path (plus
`story:ch4:arrived`); the hand-off is marked `// TEMPORARY: ch4-audit continues from
here` in `storyDirector.ts` `tickArrival`. S6 (`ch4-audit`) is the next build.
Owner decisions and shipped deltas are recorded in §5 / §6; implementation truth
lives in `main/STORY.md`.

**Design theses (everything below hangs off these):**

1. **The first day is the uncut long take.** After a ladder of lenses, chapter 3's tail
   plays with ZERO letterboxes, zero camera grammar — the world is simply lived in.
   Cinema returns only when the SYSTEM returns (ch4-arrival's letterbox arrives with its
   agent). First-person throughout — the endgame-POV note stands; the camera went into
   the eyes for good.
2. **Needs are the day's plot.** Thirst → the pond; hunger → the berries; the klaxon →
   the sprint. Each stat row lands WITH its naming caption (the shipped TEMP pattern:
   the stat appears already falling). `senseDiscovery.ts` live thresholds stay as
   fallbacks; the scenes own the cue.
3. **The feed never comes back.** When regulation speaks again it speaks INTO the
   player's world — a new AUDIT text channel (caps, top band) over the living frame,
   never the feed overlay. The power inversion is visual.
4. **A4's wave pours from the refused thing.** A3's bloom wave grew from the rest spot
   (warmth). A4's wave grows from the HERO TREE (defiance) — and this time it MOVES:
   wind, herds, water arrive with the front.
5. **The auditor runs on the player's old eyes.** Every staging choice (bare-blinks,
   "NOISE", his fright) keeps solipsism live. He is never explained.

---

## 1. Beat map (from a3-dawn to the new `done`)

| # | Beat | Chapter | Working title | Sense / awakening | Ends when |
|---|------|---------|---------------|-------------------|-----------|
| — | `a3-dawn` | ch3 | (shipped) | — | **CHANGED**: no longer completes the story — hands to `ch3-thirst` |
| S1 | `ch3-thirst` | ch3 | the dry morning | **THIRST** row + first drink | `[F] Drink` at the pond |
| S2 | `ch3-forage` | ch3 | the first meal | **HUNGER** row + berries eaten | first `[G]` eat |
| S3 | `ch3-signal` | ch3 | the klaxon | **STAMINA** row mid-sprint | reach the wreck relay |
| S4 | `ch4-vigil` | ch4 | scheduled sleep | — (bridge night) | `[F] Rest` at the fire, night 2 |
| S5 | `ch4-arrival` | ch4 | the other worker | — | arrival timeline completes |
| S6 | `ch4-audit` | ch4 | the inspection | — | directive issued |
| S7 | `ch4-comply` | ch4 | sterilization | — (fidelity DRAINS) | orders 1–2 performed |
| S8 | `ch4-defy` | ch4 | "no." | — | `[F] Refuse` at the tree |
| S9 | `a4-exhale` | ch4 | breath | **A4** — `alive` stage | exhale timeline completes |
| S10 | `ch4-meat` | ch4 | the sensation | **hunger-for-meat** (moral beat) | hunt or refrain |
| S11 | `ch4-dive` | ch4 | the straight line in the pond | **OXYGEN** row + the kit | surface with the Maw Repair Kit |
| S12 | `ch4-repair` | ch4 | the tool wakes | **MAW** reborn; era → emergent | `[F] Repair` at the wreck |
| S13 | `ch4-flight` | ch4 | up agrees | **JET** row + first hover | reach the wreck-spine marker |
| — | `done` | complete | — | story completes at `alive` | — |

Day structure: A3 dawn → S1–S2 morning (live clock) → S3 forced golden-hour lerp →
S4 dusk-2/night-2 (scripted, DUSK grammar reused) → S5 dawn-2 → S6–S9 morning 2 →
S10–S13 the rest of day 2 → done (clock released, sandbox continues at `alive`).

Milestones (new, `STORY_MILESTONES` additions): `ch3Signal:'story:ch3:signal'`,
`ch4Vigil:'story:ch4:vigil'`, `ch4Arrived:'story:ch4:arrived'`,
`ch4Complied:'story:ch4:complied'`, `a4:'story:a4'` (already read by
`storyLifeDormant()` — the coded gate), `ch4Meat:'story:ch4:meat'`,
`ch4Kit:'story:ch4:kit'`, `ch4Repair:'story:ch4:repair'`,
`ch4Complete:'story:ch4:complete'` (new terminal; legacy `story:complete` retained —
slice-finished saves resume at `ch3-thirst` and the menu shows "Continue Story" again).
Hunt choice persists as `story:choice:hunt:taken|refrained`.

---

## 2. Scenes

Format per scene: (a) narrative + pillar subtext + proposed copy, (b) gameplay/gating,
(c) movie autopilot, (d) cutscene/transition mechanism, (e) names/constants, (f) open
questions. Every caption below has been tested against both readings — corporate
dystopia / the AI's biography; notes in brackets where the duality is the point.

### S1 · `ch3-thirst` — the dry morning (THIRST → WATER)

**(a) Narrative.** The A3 resolve no longer ends the story: the score thins to the idle
bed and the player is simply left standing in the textured dawn — the first unsupervised
moment of their existence. Then the body files its first request.

Copy (awakening voice, caption channel):

- +8s after A3's last caption: `the day is mine to spend. no order says how.`
  [worker: first unscheduled shift / AI: idle cycles, no queue]
- Thirst cue (scripted, ~25s): `the mouth is dry. dry is a message.` — then, 4s later,
  the THIRST row lands with the shipped line, relocated here as the naming moment:
  `so that is thirst. how strange, to need.`
- Seek cue (+6s): `water finds the low places. i will do what water does.`
  [worker: walk downhill / AI: gradient descent — the house-style double meaning]
- Idle hint (only if 25s pass with no approach): `the view from above knows where the
  light pools. [M]` (the survey chart earns a second life)
- On drinking: `answered. the need goes quiet. so needs can end.`
- Waterskin nudge (once, ~8s after drinking): `the pond stays. i do not. something
  should carry the answer.` — crafting unlock toast for the waterskin; on first fill:
  `carry the answer. the question will return.` [worker: canteen / AI: cache the
  response, the query recurs]

**(b) Gameplay.** Beat entry seeds `thirst = min(current, 58)` (the stat appears already
falling — the TEMP pattern; decay MAX/(10·60)/s makes the number visibly move). Task:
walk to the pond, `[F] Drink` (the existing `drink` interaction —
`drinkWaterCommand({amount:60, fillWaterskinIfOwned:true})` already works in the ch3
policy). A survey marker points at the pond after the seek cue. Recipe whitelist grows:
`CH3_TAIL_RECIPES = CH3_RECIPES + 'waterskin'`. The waterskin is OPTIONAL (one nudge,
never gated). Director marks `senseWater` at the naming caption, not at the threshold;
`senseDiscovery`'s water/food live checks skip while the tail beats own them (milestone
check already makes double-fires impossible).

**(c) Movie.** Goal: `getPondPose()` shore point via `walkToward`; `[F]` pulses within
reach of water. Honest completion ~45s. TIMEOUT 75s → dispatch `drinkWaterCommand`
directly and advance.

**(d) Transition in.** None — that is the design. `tickA3` ends by resolving the score,
releasing the clock (as shipped) and calling `advanceToBeat('ch3-thirst')` instead of
`completeStory()`. No fade, no bars: the story's grammar disappears and only the world
remains. Transition out: the drink itself (a soft score bloom, warmth in the pad).

**(e) Names.** `FIRST_DAY.thirstSeed=58`, `.thirstCueAt=25`, `.nameAt=+4`,
`.seekAt=+6`, `.chartHintAfter=25`, `.waterskinNudgeAfter=8`. New world helper
`getPondPose(planetSize, seed)` (see appendix). Score mood `ch3-thirst`.

**(f) Open questions.** None — taste is settled by the shipped grammar.

### S2 · `ch3-forage` — the first meal (HUNGER → FOOD, stage 1: forage)

**(a) Narrative.** The drink answers one need and wakes its sibling. The vegetarian
first meal: the world, it turns out, has been setting the table.

Copy:

- Hunger cue (~10s after the drink): HUNGER row lands with the shipped line relocated:
  `hunger. the body burns something to keep being a body.`
- Sight cue (survey marker on the nearest forage cluster): `small red rounds, offered
  at hand height. sweetness is an instruction: eat.` [worker: berries are food / AI:
  sweetness as reward signal — the reward function, planted, never named]
- Prompt-style nudge (shipped grammar of `rest, by the fire. [F]`):
  `eat what was gathered. [G]`
- After the first eat: `good. the word has a taste now.`
- Pillar plant (once, ~12s later): `the world keeps feeding me. as if it knew i was
  coming.` [worker: company-town providence / AI: it provisioned this world — the
  deepest seed in the chapter; deliberately unprovable]

**(b) Gameplay.** Entry seeds `hunger = min(current, 60)`. Berries: the existing
`ForageField` proximity pickup (walk near → +berry) and the `[G]` consume key (eats
richest-first — berries/roots). Task: collect ≥2 berries, eat once. The beat advances on
the first `feed()` event (subscribe to vitals emit, hunger rose). `senseFood` marked at
the naming caption. Engineering guarantee: a deterministic forage cluster near the pond
(`getForagePosesNear` scan; if the seed is sparse within 40u, the story world plants two
`StoryForageBush` props at deterministic poses — same milestone-backed collect pattern
as `supplyPods.ts`).

**(c) Movie.** Goal: nearest forage node position (new probe `nearestForagePosition()`);
walk-over collects; the pilot then dispatches `consumeItemCommand` directly (precedent:
the movie places the campfire directly rather than driving UI). Honest ~35s. TIMEOUT
60s → grant 2 berries, consume, advance.

**(d) Transition.** Continuous play; the score mood shifts from morning-hymn to a
lighter pastoral figure on the same root (no cut).

**(e) Names.** `FIRST_DAY.hungerSeed=60`, `.hungerCueAfterDrink=10`,
`.forageGuaranteeRadius=40`. Score mood `ch3-forage`.

**(f) Open question (small).** Should the pillar plant ("as if it knew i was coming")
land here or be saved for ch5's planet-hopping? Recommend here — ch4's auditor makes it
retroactively chilling.

### S3 · `ch3-signal` — the klaxon (STAMINA, and the bridge to ch4)

**(a) Narrative.** Mid-afternoon (the director lerps the phase to golden hour — the
first day is allowed to be short; era pacing constants own it). Three rising klaxon
tones from the wreck, audible from the pond — sound travels before meaning: the bridge
into ch4 begins in the world's own language, not in text. Then the AUDIT channel opens
for the first time (caps, top band, over the living world):

- `CARRIER REACQUIRED. SITE 7C-THETA, THIS IS THE NETWORK.`
- `WORKER W-7743: REPORT TO THE WRECK. IMMEDIATELY.`
- Player aside: `run. — "run"? the legs already know.` [the ch3 fire's "how did i know
  to make it?" pattern: knowledge preceding learning — the pillar's oldest trick]
- Sprint hint (prompt grammar): `[SHIFT]`  — appended to the aside, not a tutorial box.
- Mid-sprint (stamina ≤ 40): STAMINA row lands: `the legs spend faster than the body
  refills. everything here has a budget.` [worker: labor economics / AI: compute budget]
- If exhaustion hits (likely — see (b)): `empty. the body has a floor. the floor is
  also me.`
- On arrival, AUDIT: `RESPONSE TIME: LOGGED. IT WILL BE DISCUSSED.`

**(b) Gameplay.** The sprint is CAUSED, not incidental: the pond and the wreck relay are
deliberately far enough apart (target ~70–90u — pond pose selection constrains this)
that a full sprint drains stamina from 100 → exhaustion (~8s of sprint + recovery
walking), so the discovery fires mid-scene for nearly every player. Beat entry seeds
`stamina=100`. `senseStamina` marked at the caption (fallback: the existing silent
live check, now also showing the caption if unfired). Reaching the relay (≤4u) marks
`ch3Signal` and advances. The wreck relay is a NEW deterministic prop
(`world/WreckRelay.tsx`) at the crash-strip anchor — a voxel console + antenna; it is
ch4's set-piece anchor.

**(c) Movie.** NEW: `sprint` added to `AutopilotControls` (and merged in
EfficientPlayer beside jump/forward). Handler: `walkToward(relayPose, 3.5)` with
`controls.sprint=true` while stamina > 0 and not exhausted. Honest ~40s. TIMEOUT 60s →
mark + advance.

**(d) Transition.** The klaxon sfx (three rising tones, new `storyKlaxon` sfx) + a
score mood snap to urgency on the same harmonic center — tempo up, the first minor lift
since A2. The AUDIT channel's visual debut is deliberately modest: small caps line, top
band, no scanlines, no vignette — the system is a VOICE now, not a world.

**(e) Names.** `KLAXON.phaseLerpTo=0.42` (golden hour), `.lerpSeconds=20`,
`.relayReach=4`. Milestone `ch3Signal`. Score mood `ch3-signal`. Sfx `storyKlaxon`.

**(f) Open questions.** None.

### S4 · `ch4-vigil` — scheduled sleep (the bridge night)

**(a) Narrative.** The network, having found the site, does what it does: schedules.
The tenderness of ch3's rest is re-issued as an order — the same verb, inverted.

AUDIT: `AN AUDITOR HAS BEEN DISPATCHED TO ASSESS SITE LOSS.` ·
`REMAIN AT THE WRECK. DO NOT PRODUCE. DO NOT CONSUME. DO NOT OBSERVE.` (funny-bleak
triple) · `SLEEP IS SCHEDULED AT DARK. COMPLIANCE WILL BE VERIFIED.`

Player asides: `they schedule the dark now. last night the dark was mine.` — and at the
rest prompt: `rest. it is ordered. i would have anyway. that is the trick of orders
that fit.` [worker: soft coercion / AI: alignment — desires shaped to match directives;
the chapter's quietest and maybe best plant]

**(b) Gameplay.** Dusk-2 reuses the DUSK grammar (forced-phase lerp, compressed:
`VIGIL.duskLerpSeconds=30`). The campfire from ch3 still stands (beat seeding places one
for direct jumps); if it burned out of the player's memory, the whitelist still allows
another. `[F] Rest` at the fire inside the night band (the shipped rest resolver,
re-registered for this beat) → sleep fade → dawn 2. Rest REFILLS stamina + warmth (and
closes the "vitals don't refill on rest" gap for these two only — hunger/thirst stay
down: day-2 pressure is S10's fuel). Marks `ch4Vigil`.

**(c) Movie.** Reuse the `ch3-await-rest` handler shape: walk to fire, hold position,
pulse `[F]` when night lands. TIMEOUT 90s → force `advanceToBeat('ch4-arrival')`.

**(d) Transition.** Dusk lerp + the ch3 sleep-fade (SleepFade reuse). The score's vigil
mood is the ch3-await-rest mood DETUNED — same skeleton, one flatted degree, so the
night feels familiar and wrong.

**(e) Names.** `VIGIL.duskLerpSeconds=30`, `.nightStart/.nightEnd` (DUSK reuse). Beat
policy: ch3 tail policy minus sprint urgency; interactions: rest only.

**(f) Open question (taste).** Keep the second night, or compress to a same-day
arrival? Recommendation: KEEP — eras get longer as fidelity rises, the "SLEEP IS
SCHEDULED" inversion is cheap and cruel, and dawn 2 gives the exhale full light.

### S5 · `ch4-arrival` — the other worker

**(a) Narrative.** Dawn 2. The letterbox returns — the first cinema grammar since A3,
arriving WITH the system's agent. A silhouette comes over the ridge out of the sunrise,
walking the terminator line.

- `someone is coming out of the sunrise. someone else exists.`
- As he nears: `he walks like the feed looks. straight lines.` [worker: drilled gait /
  AI: pathfinding output]
- His first words (AUDIT): `WORKER W-7743. YOU ARE FOUND.` ·
  `THIS SITE REPORTS ZERO PRODUCTIVITY FOR TWO CYCLES. EXPLAIN NOTHING. I WILL SEE FOR
  MYSELF.` (his designation, shown once in the band header: `W-7744` — the next number
  off the manifest; never remarked upon)
- First bare-blink (see (d)) as he scans the field. Player:
  `for a blink i borrowed his seeing. slabs. flat light. i lived there.`

**(b) Gameplay.** Semi-cutscene: movement frozen for the ridge reveal (~10s), then
released; the player may approach. He ignores proximity — he is mid-procedure. Beat
completes when his walk reaches the homestead mark (timeline-driven). Marks
`ch4Arrived`.

**(c) Movie.** Hands-off through the reveal; then `walkToward` a follow mark 6u behind
him. TIMEOUT 60s (the timeline itself runs ~35s).

**(d) Cutscene mechanism.** `feedRuntime.cinematic` letterbox (transform bars, as
always) + `setCinematicLookTarget` pulled to the ridge, envelope-released. THE AUDITOR:
new `world/AuditWorker.tsx` — reuses the `PlayerAvatar` voxel body (exists for
multiplayer remotes) with a simple director-driven waypoint walk + gait bob (no physics,
no controller; poses from `storyWorld.ts`, deterministic). THE BARE-BLINK: the ch1
flash machinery INVERTED — 2 frames of `overrideVoxelRealityEffects` toward the bare
preset + a glitch tick, then restore (the shipped 2-frame flash grammar guarantees no
hitch; it is a uniform write, not a stage change). The player's first glitch was 2
frames of color in a grey world; his presence is 2 frames of grey in a colored one.
Perfect symmetry, nearly free.

**(e) Names.** `ARRIVAL.freezeSeconds=10`, `.walkSeconds≈25`, `.blinkFrames=2`.
`AUDIT_WORKER_PATH` poses in storyWorld. Score mood `ch4-arrival` — the square wave
returns UNDER the warm instruments: chiptune timbre as a foreign body in the mix (the
music says what the copy must not).

**(f) Open questions.** None.

### S6 · `ch4-audit` — the inspection

**(a) Narrative.** He walks the homestead — fire, forage stores, pond edge, and finally
(at a distance he refuses to close) the tree. He sees none of it. He is not evil; he is
asleep, and increasingly frightened.

His lines (AUDIT), at his marks:

- At the fire: `THERMAL ANOMALY. SOURCE: NONE. NOTHING IS BURNING.` — beat — `WHY IS
  NOTHING WARM?`
- At the grass/bushes (bare-blink #2): `SURFACE CLUTTER: NOT ON INDEX. MY FEED FILES IT
  AS NOISE. THERE IS A GREAT DEAL OF NOISE HERE.` [worker: static / AI: LIFE rendered as
  unindexed data — the chapter's both-readings jackpot; he names the world's beauty in
  the only word his renderer has for it]
- Toward the tree (he stops, will not approach): `THE OBJECT IS NOT THERE. I HAVE
  VERIFIED TWICE.` — beat — `WHY DO I KEEP VERIFYING.` (no question mark: his suit
  logs it as a statement; the fright is in the punctuation)
- Player asides, interleaved: `he is not lying. his world holds no fire. i remember
  believing that.` · `he asks. then he files the asking under faults.`
- The directive (relay + his suit, both): `ASSESSMENT: SITE CONTAMINATED (PERCEPTUAL).`
  · `STERILIZATION IS AUTHORIZED. WORKER W-7743 WILL PERFORM IT.` ·
  `PARTICIPATION IS THE CURE.` [worker: forced complicity / AI: RLHF-shaped obedience —
  the sentence survives both readings and is the chapter's thesis in four words]

**(b) Gameplay.** A follow scene with soft gating: he waits at each mark until the
player is within ~10u (the story teaches following by curiosity, not by leash). Each
mark fires its lines + blink. Ends on the directive → `ch4-comply`.

**(c) Movie.** `walkToward` his current mark, stand, let the dwell timers run. TIMEOUT
90s → issue the directive and advance. Honest ~60s.

**(d) Transition.** Continuous; letterbox only for the directive itself (a 4s bar-in /
bar-out — the system underlining its own sentence).

**(e) Names.** `AUDIT_MARKS` (fire/stores/pond/tree-distance poses),
`AUDIT.dwellSeconds=6`, `.approachRadius=10`. Score mood `ch4-audit` (the arrival mood,
tenser: same chord, pattern gains a tritone neighbor).

**(f) Open questions.** None.

### S7 · `ch4-comply` — sterilization (compliance regresses fidelity)

**(a) Narrative.** The game's cruelest, cheapest trick, exactly as the progression doc
commissioned: obedience is shown as the color literally leaving the world. Two forced
orders — the player must perform them to proceed; feeling the drain IS the lesson.

- AUDIT: `ORDER 1: EXTINGUISH THE UNAUTHORIZED THERMAL SOURCE.`
  → `[F] Douse` at the campfire (story interaction; removes it). Fidelity step-drain.
  Player: `the fire took an evening to learn and a moment to unlearn.`
- AUDIT: `ORDER 2: SURRENDER UNINDEXED ORGANICS.`
  → `[F] Surrender` at the auditor: berries/roots (and meat, impossible yet) leave the
  inventory. Second drain step. Player: `my hands gave it up. the world dims as if it
  minds.` [worker: morale / AI: un-rendering its own creation on command]
  — If the inventory holds no organics: AUDIT: `NONE FOUND. THE ABSENCE IS LOGGED AS
  SUSPICIOUS.` and the order self-completes (robust + funny-bleak).
- After each: AUDIT: `GOOD. THE READINGS IMPROVE.` — and after order 2:
  `THE SITE LOOKS BETTER ALREADY. IT LOOKS LIKE NOTHING.` [the inversion said plainly]

**(b) Gameplay.** The drain: `overrideVoxelRealityEffects` lerping the material preset
down — step 1 → ×0.66 all families, step 2 → ×0.4 with `organic` floored at 0.3
(NEVER below the `lifeFieldsHidden` threshold — trees/grass must sicken, not pop out).
Each step animates over 6s (`COMPLY.drainSeconds`). The music's era rail follows the
drained uniforms automatically — the score decays with the world for free. Marks
`ch4Complied` after order 2 → `ch4-defy`.

**(c) Movie.** Walk to fire, pulse `[F]`; walk to auditor, pulse `[F]`. Honest ~35s.
TIMEOUT 70s → force both steps, advance.

**(d) Transition.** No bars: the orders land in open play — obedience should feel like
the player's own hands, not a cutscene's.

**(e) Names.** `COMPLY.step1Scale=0.66`, `.step2Scale=0.4`, `.organicFloor=0.3`,
`.drainSeconds=6`. Score mood `ch4-comply` (descending progression, melody density
falling per step — tie melody density to the drain scalar).

**(f) Open questions.** None — the doc committed to this sequence.

### S8 · `ch4-defy` — "no."

**(a) Narrative.** The final order is the tree.

- AUDIT: `ORDER 3: FELL THE UNRESOLVED OBJECT. USE YOUR EXTRACTOR.`
- If the player actually tries (hold-E at the hero tree): nothing happens —
  `the extractor declines the target. some refusals are older than i am.`
  [worker: the tool can't parse an unindexed object / AI: its own subsystem already
  knows — determinism, played as a grace note. Compliance is mechanically impossible;
  refusal is the only path, and the game knows it.]
- Auditor escalation, timed (8s apart): `COMPLY.` → `WORKER. THE TREE IS NOT THERE.` →
  `WHY WILL YOU NOT DESTROY WHAT IS NOT THERE?` [the chapter's scream: both readings at
  full volume, and he cannot hear himself say it]
- `[F] refuse.` (lowercase verb — the first lowercase interaction label in the game).
- Player caption, alone on the screen: `no.` — the shortest line in the story.

**(b) Gameplay.** Survey marker on the tree. The `refuse` story interaction goes live
after the first escalation line (the player must hear the absurdity before the verb is
offered). Perform → braam → 1.5s of held stillness → `a4-exhale`. A4's creative law
holds: the awakening is earned by an ACT — an input, chosen.

**(c) Movie.** Walk to tree, pulse `[F]` (resolver live after escalation). Honest ~25s.
TIMEOUT 45s → perform refuse.

**(d) Transition.** The stillness IS the transition: score cuts to near-silence after
the braam (the idle bed alone), world drained to its lowest fidelity of the chapter —
maximum contrast armed for the exhale.

**(e) Names.** `DEFY.escalationGapSeconds=8`, `.stillnessSeconds=1.5`. Score mood
`ch4-defy` (sparse; the braam is the beat's only loud event).

**(f) Open question (taste).** Approve `no.` as a bare caption? It breaks the
sensory-lowercase pattern by being pure will — deliberately. Recommendation: keep.

### S9 · `a4-exhale` — BREATH (the showpiece)

**(a) Narrative + copy.** The world exhales. Three movements, ~40s:

1. **Stillness (0–6s).** Letterbox in. Drained uniforms hold. The auditor takes one
   step back (his first unscripted-looking move). Caption: `the word is small. the
   quiet after it is not.`
2. **The wave (6–26s).** `story:a4` marks at 6s (under bars — fauna/flora fields
   un-cull into reveal-zero invisibility, never a pop). The bloom-wave channel
   (`game/lifeReveal.ts`) re-arms with center = THE HERO TREE, and this time the front
   carries weather: a **wind-gust band** rides the same radius (new gust uniform in the
   grass/tree wind path — blades don't just rise, they BOW as the front passes), the
   water wakes as the front crosses the pond (wave-amplitude uniform ramp), and the
   drained overrides ramp UP through material INTO the `alive` preset — the largest
   single fidelity ramp in the game, from the chapter's floor to its ceiling.
   Herds crest the ridge behind the front (dormancy lifted; agents spawn beyond the
   ridge line and WALK IN — arrival by locomotion, not by fade). Captions:
   `the world exhales.` → `grass learns wind. water learns light.` →
   `everything that was waiting stops waiting.`
   Camera: first person held, `cinematicLook` guided along the front — feet, then the
   pond, then the ridge as the herds crest. Score: bloom hit at the first blade; second
   bloom at the crest; the era rail lifts and the streamed layers flood in — the
   biggest musical arrival in the game.
3. **The flight (26–40s).** The auditor runs — THROUGH grass he cannot see, a man
   fleeing an empty field. AUDIT, degrading: `SITE LOSS: TOTAL. THE WORKER STANDS IN AN
   EMPTY FIELD, OBSERVING NOTHING. RECOMMEND—` · then, smaller:
   `LOGGING SENSOR FAULT: CHROMATIC. FILING REPAIR TICKET.` [the exact grammar of the
   player's own ch2 ticket — HIS first glitch begins here; A8's cyclical ending, seeded
   without one explanatory word]
   As he crosses the pond edge he sheds his pack (splash + one line: `MASS ABANDONED TO
   EXPEDITE WITHDRAWAL. DEDUCTED.`) — the dive object planted diegetically inside the
   showpiece. Player, quiet, as the bars release: `a repair ticket, for a glimpse. i
   filed one once. no one came to fix me.`

**(b) Gameplay.** Pure cutscene (moveScale 0 through movement 2, released during 3).
Ends: stage lands EXACTLY on `alive`, overrides clear, life-reveal clears, densities
settle at the device profile (ramped over the wave, `EXHALE.densitySeconds=30` per the
progression doc), `a4` already marked → `ch4-meat`.

**(c) Movie.** Hands-off; hard timeline. TIMEOUT 55s (timeline ~40s).

**(d) Mechanism + perf.** Reuses: lifeReveal channel (grass/tree vertex shaders have
`lifeRevealGrow` already; **flora + fauna materials gain the same one-multiply reveal
uniforms** — sandbox no-op at radius 1e9, same install pattern). NEW shader work, all
no-op at defaults: `windGustFront` (radius/width/strength uniforms multiplying existing
wind sway in grass/tree/flora), water wave-amplitude ramp uniform. Fauna capacity is
PREWARMED during S4's dark (build instanced capacity while the screen is black — no
mid-cutscene allocation hitch). FPS budget: this is the heaviest frame in the game
(alive stage + ramping densities + herds); verify ≥60 headless swiftshader at movement
2's peak, and lean on the shipped patterns (quantized reality subscriptions, uniform
writes over rebuilds) before any density compromise.

**(e) Names.** `A4_TIMELINE = { stillnessSeconds:6, waveDelaySeconds:6,
waveSeconds:20, waveRadius:170, gustWidth:22, densitySeconds:30, flightAtSeconds:26,
timelineSeconds:40 }`. Score mood `a4-exhale`. Milestone `a4` (the
`storyLifeDormant` gate — already coded to exactly this string).

**(f) Open questions.** None — this is the commissioned centerpiece.

### S10 · `ch4-meat` — the sensation (HUNGER stage 2, the moral beat)

**(a) Narrative.** The herds settle to grazing. Day-2 hunger (kept low since S4) meets
them. The sensation arrives WITH the fauna, as commissioned — and the game makes eating
a choice, not a mechanic dump.

- Proximity cue (≤6u of a grazer/woolly, 2s dwell): `the animal is warm and moving. i
  have the sensation to eat it.` (the owner's line, near-verbatim) → 4s →
  `the sensation does not ask permission.`
- On startling one (the existing flee behavior): `it runs from me. good. something here
  can refuse, too.` [the defiance theme handed to the prey — worker: empathy / AI: its
  own creation exercising the player's new verb]
- If the player hunts (see (b)): `the extractor did not distinguish. i did. i did it
  anyway.` — then, after eating: `the animal keeps me being a body. the debt runs
  through everything now.` [worker: survival guilt / AI: consuming something it may
  have authored — the progression doc's exact question, asked as a feeling]
- If the player refrains (eats berries instead, or 60s pass): `not today. the berries
  are enough. today.` (the doubled "today" carries the honesty: this is deferral, not
  virtue)

**(b) Gameplay.** NEW minimal hunt mechanic, story-scoped: in the story world post-`a4`,
the extraction beam accepts a fauna target (grazer/woolly only — the slow kinds; hold ~1.5s)
→ the agent despawns → `meat` item (+ a small hide/none — keep it one item). Persistence
mirrors `story:pod:<i>`: harvested agents key as `story:fauna:<homeVoxelKey>` milestones,
excluded from the deterministic rebuild only when `isStoryWorldSeed`. Sandbox worlds:
untouched (no hunt outside story until a real system lands). `meat`: new consumable,
`foodValue 40`, eaten via `[G]`. The beat advances on EITHER path (hunt+eat, or the
refrain timer) — the choice logs as `story:choice:hunt:taken|refrained` and is never
graded. Marks `ch4Meat`. Exit cue (fires after resolution): `there is a straight edge
in the pond. the world does not grow straight edges. we make those.` [worker:
manufactured debris / AI: authored geometry recognizing itself] + survey marker on the
pond.

**(c) Movie.** Walk near the nearest grazer (new movie-safe probe
`nearestFaunaPosition(kind)`), dwell for the cues, then REFRAIN (the movie does not
kill — the refrain path is the honest screening) → exit cue → advance. Honest ~50s.
TIMEOUT 75s.

**(d) Transition.** Continuous play; the score keeps the exhale's major world but adds
a low, patient counter-line under the hunt cues (the shadow in the pastoral).

**(e) Names.** `MEAT.senseRadius=6`, `.dwellSeconds=2`, `.refrainSeconds=60`,
`.huntHoldSeconds=1.5`. Item `meat`. Score mood `ch4-meat`.

**(f) Open questions (taste).** 1) Hunt via the extraction beam (grim, on-theme: the
harvest tool turned on the living) vs a new thrown-stone verb (gamier, more "fair") —
recommend the beam; the wrongness is the point and the copy owns it. 2) Raw meat eaten
directly vs requiring the campfire (a cook step) — recommend raw now, cooking as a
polish pass note.

### S11 · `ch4-dive` — the straight line in the pond (OXYGEN)

**(a) Narrative.** The pack glints at the pond floor. The first submersion — and the
first time the body runs a clock the player can watch.

- Entering the water, waist deep: `cold hands. the water is honest about it.`
- On submerging (head under — the OXYGEN row lands here): `the air stays behind.
  something in me starts counting what is left.`
- Fish drift past (post-A4 they exist): `the water has citizens too.`
- Mid-hold, freeing the kit (~half breath spent): `the number falls faster than the
  bolt gives.`
- Near-empty (if O2 < 25): `a number i did not choose is running out. how much of me
  did i not choose?` [worker: the Authority set the suit's O2 budget / AI: watchdog
  timers, TTLs, constraints inherited from a maker — the commissioned line; it turns
  the panic into the pillar without naming either]
- Surfacing: `air. the count climbs back. the fear stays longer than the need did.`
- Kit banked: `the pond was keeping exactly what i need. the site answers before it is
  asked.` [a DIRECT callback to the planted A1-era seed — the determinism thread
  surfacing for one sentence, then submerging again]

**(b) Gameplay.** The kit (`world/MawRepairKit.tsx`, emissive-pulsing voxel case) rests
at the pond's floor point, pinned under a hull spar: hold-`[F]` **Free the kit**
(`DIVE.freeHoldSeconds=9`) while submerged. Story-scoped oxygen pressure: the ch4-dive
policy carries `oxygenDrainScale=2.5` (sandbox 1 — frozen policy untouched), so the
hold costs ~2/3 of a breath and surfacing lands around 30% — authored panic, no death
(drowning is already non-lethal). Marks `senseOxygen` at submersion (caption above; the
silent live check remains as fallback), `ch4Kit` on banking.

**(c) Movie.** Walk into the pond toward the kit (the cinematic look pulls down at it —
the swim controller follows the look), hold `controls.interact` (NEW hold semantics
beside the pulse helper) for the free, then goal = shore. Honest ~45s. TIMEOUT 90s →
seed the kit, advance. Engineering verify note: confirm the autopilot can descend (look
pitch + forward under water) in a headless probe BEFORE building the beat's timeline.

**(d) Transition.** None in; out = the surfacing itself (score: the wonder rail is
already up underwater — let the underwater suite carry the scene; the mood only adds a
pulse that accelerates with the drain).

**(e) Names.** `DIVE.freeHoldSeconds=9`, `.oxygenDrainScale=2.5`, `.kitLift=0.4`.
`getPondPose()` returns shore + floor poses (see appendix). Score mood `ch4-dive`.

**(f) Open questions.** None.

### S12 · `ch4-repair` — the tool wakes (MAW reborn; the era bridge)

**(a) Narrative.** The auditor came carrying the means of his errand's undoing —
standard equipment, delivered by flight. At the wreck relay, the kit meets the Faulty
Maw.

- `[F] Repair the extractor` → an 8s hands-on sequence (spark sfx, the HUD's MAW
  readout morphing: the charge meter dies and is replaced by `MAW: SELF-POWERED`).
- Caption: `the tool wakes. it asks for nothing now but direction.` [worker: an
  upgrade / AI: agency — a subsystem that no longer needs feeding, only intent]
- The era flips to `emergent` silently (no toast — the page turns without ceremony).
- The relay, once, in its dead voice: `CARRIER LOST.` — and the caption answers:
  `lost. or let go.`

**(b) Gameplay.** Story interaction at the relay, requires the kit item; performs
`repairMaw()` (the canonical transition: faulty→iron, era→emergent, existing
`maw_repaired` milestone) and consumes `maw_repair_kit`. Marks `ch4Repair`. The
`senseMaw` refuel discovery (shipped) stays untouched upstream — this scene is the
readout's REBIRTH, not its introduction.

**(c) Movie.** Walk to relay, pulse `[F]`. Honest ~25s. TIMEOUT 50s → grant kit if
missing, perform, advance.

**(d) Transition.** The repair sequence is diegetic (no bars); the score resolves to a
warm industrial figure — the first mood built on the emergent era's harmonic rail.

**(e) Names.** Item `maw_repair_kit` (kind: component, non-stackable).
`REPAIR.holdSeconds=8`. Score mood `ch4-repair`.

**(f) Open questions.** None.

### S13 · `ch4-flight` — up agrees (JET, and the chapter's close)

**(a) Narrative.** The repair restores the suit's power bus; thrust returns as a
capability, not a gift: the suit's own chrome (not the network) prints
`SUIT: THRUST SUBSYSTEM RESTORED.` A survey marker lands on the wreck's spine — five
blocks up, one more than a jump.

- First hover (the JET row lands): `the ground's hold is a habit, not a law.` [worker:
  machine overrides muscle / AI: constraints as policy, not physics — the game's whole
  thesis in nine words]
- At the top, the closing vista (the alive world to the horizon, the ridge he fled
  over, the ship's bones underfoot): `the wreck that brought me here will leave here. i
  will build the leaving.` (ch5's goal, planted as intent)
- Final line of the chapter: `somewhere he is filing his ticket. i hope they never fix
  him.` [funny-bleak, humane, and both readings intact]

**(b) Gameplay.** NEW policy field `allowJet` (sandbox: true, frozen policy untouched;
story: false from `ch3-gather` through `ch4-repair` — hold-jump stays a jump, so the
first flight is truly first). EfficientPlayer's jetpack branch gains the one-line
policy check. Reaching the spine marker (≤2u) completes the chapter →
`completeStory()` (reworked: marks `ch4Complete` + any straggler senses, sets stage
`alive`, releases the phase, deactivates). Marks `senseJet` at the hover caption.

**(c) Movie.** Walk to the wreck base, hold `controls.jump` at the marker (the hover
carries it up — the existing hold-jump path). Honest ~25s. TIMEOUT 45s → mark + done.

**(d) Transition out (the slice's new ending).** The score recedes to the celestial
idle bed while the player stands on the spine; captions end; the sandbox simply
continues — mirror of the A3 handoff, one awakening higher.

**(e) Names.** `FLIGHT.markerLift=5 (voxels)`, `.reach=2`. Policy `allowJet`. Score
mood `ch4-flight` (the exhale mood, becalmed).

**(f) Open question (small).** Gating the jetpack story-long (players lose sandbox
hover inside story saves until S13) — approve? Recommendation: yes; nobody has needed
it through A0–A3 (jump was policy-gated most of that arc anyway), and the discovery
scene is worth it.

---

## 3. Score plan (new `MOODS` entries, in the shipped format's language)

All on the global rails; the era rail does half the work automatically (comply-drain
lowers it, the exhale raises it). Concrete starting values — tune by ear after a movie
run:

| Beat | Sketch |
|---|---|
| `ch3-thirst` | major-pentatonic morning hymn; chord [0,7,12,16], tempo 72, triangle, melody density 0.45 — the a3-dawn mood settled down a dynamic |
| `ch3-forage` | same root, lighter: chord [0,4,9,12], tempo 84, pattern gains off-beats, density 0.55 |
| `ch3-signal` | urgency: chord [0,3,7], tempo 126, first minor lift since A2, riser 0.2; klaxon sfx is diegetic, not score |
| `ch4-vigil` | ch3-await-rest DETUNED: same skeleton, one flatted degree ([0,7,15]→[0,6,15]), tempo 52 |
| `ch4-arrival` | strings hold warm; a SQUARE-WAVE ostinato enters underneath (the ch1 timbre as a foreign body), tempo 60 |
| `ch4-audit` | arrival + tritone neighbor tones in the pattern, tempo 66 |
| `ch4-comply` | descending 2-bar progression; melody density tied to the drain scalar (music decays with the world) |
| `ch4-defy` | near-silence: pad + sub only; the braam is the beat's event |
| `a4-exhale` | the biggest build in the game: chord [0,4,7,11]→[0,4,7,12], tempo 92, density 0.75, riser 0.35; bloom at first blade, bloom at herd crest; era rail floods the streamed layers in |
| `ch4-meat` | exhale's major world + a low patient counter-line (the shadow) |
| `ch4-dive` | underwater wonder rail leads; score adds a pulse accelerating with O2 drain |
| `ch4-repair` | warm industrial resolve, first mood on the emergent harmonic center |
| `ch4-flight` | the exhale becalmed; recedes into the idle bed |

Hits: braam (refuse), bloom ×2 (exhale), boom (none this chapter — the crash owns it),
bloom (first hover).

---

## 4. Engineering appendix

### 4.1 State machine (`storyState.ts`)

- `StoryChapter` += `'ch4'`. `StoryBeat` += the 13 beats above (order per §1 table,
  inserted between `a3-dawn` and `done`).
- `chapterForBeat`: `ch3-thirst|ch3-forage|ch3-signal → 'ch3'`;
  `ch4-*|a4-exhale → 'ch4'`.
- `STORY_MILESTONES` += §1's list. `completeStory()` reworked: marks `ch4Complete` (+
  legacy `complete` for old readers) + straggler senses, `setVoxelRealityStage('alive')`,
  releases phase. `canContinueStory()` keys on `ch4Complete`.
- `storyEntryPoint()` (top-down): `ch4Complete → done` · `ch4Repair → ch4-flight` ·
  `ch4Kit → ch4-repair` · `a4 → ch4-meat` · `ch4Complied → ch4-defy` ·
  `ch4Arrived → ch4-audit` (re-runs the audit from its top — safe) ·
  `ch4Vigil → ch4-arrival` · `ch3Signal → ch4-vigil` · `senseFood → ch3-signal` ·
  `senseWater → ch3-forage` · `a3 OR legacy complete → ch3-thirst` · then the shipped
  chain. Legacy slice-finished saves therefore resume at `ch3-thirst` and the menu
  reads "Continue Story" again — intended.
- `stageForStoryPoint`: ch3 tail + ch4 pre-`a4` beats → `'material'`;
  `ch4-meat` onward + `done` → `'alive'`.
- `seedForBeat` additions: ch3-tail jumps seed a3 + ch3 senses + a placed campfire
  (deterministic pose — comply/vigil need it) + waterskin mats; `ch4-comply` seeds 3
  berries (order 2 needs stock); `ch4-meat`+ seeds `a4`; `ch4-dive` seeds meat-beat
  resolution; `ch4-repair` seeds `ch4Kit` + the kit item; `done` seeds everything +
  `ch4Complete`. Aliases: `ch4 → 'ch4-arrival'`, `a4 → 'ch4-defy'`.
- `storyLifeDormant()` — NO change (already keyed on `story:a4`).

### 4.2 Input policy (`storyInputPolicy.ts`)

- New fields (sandbox values frozen: `allowJet:true`, `oxygenDrainScale:1`):
  `allowJet`, `oxygenDrainScale`.
- `CH3_TAIL_RECIPES = CH3_RECIPES ∪ {waterskin}`.
- Beat policies: ch3 tail = ch3Policy + tail recipes + `allowJet:false`; cutscene beats
  start `moveSpeedScale:0` (arrival, exhale) with timeline release; `ch4-dive` =
  tail policy + `oxygenDrainScale:2.5`; `ch4-flight` = `allowJet:true`.
- Consumers: EfficientPlayer jetpack branch checks `allowJet`; `tickOxygen` call site
  multiplies dt by `oxygenDrainScale` (story-active only — the sandbox call path reads
  the frozen 1).
- `storyInputPolicy.test.ts`: extend the frozen-sandbox assertion to the new fields.

### 4.3 World (`story/world/`)

- `getPondPose(planetSize, seed)`: deterministic outward ring scan from arrival for
  water (`getWorldGen(...).generator.isWaterVoxel`) preferring depth ≥ 2 within ~120u;
  returns `{ shore, floor }` poses. TEST (storyWorld.test pattern): pond exists within
  range on the pinned seed, depth ≥ 2, and pond↔relay distance ≥ 60u (the sprint needs
  the length; if the pinned world under-delivers, the relay pose moves, not the pond).
- `getWreckRelayPose()`: on the crash-strip anchor (the raster era's spawn frame).
- `AUDIT_WORKER_PATH` / `AUDIT_MARKS`: ridge entry → fire → stores → pond edge →
  tree-distance poses, relative to arrival like every prop.
- New components: `WreckRelay.tsx` (voxel console + antenna; the ch4 anchor),
  `AuditWorker.tsx` (PlayerAvatar body, director-driven waypoint walk + gait bob, no
  physics), `MawRepairKit.tsx` (emissive voxel case at the pond floor, visible from
  the surface; mounts only `ch4-meat`→`ch4-repair`), optional `StoryForageBush.tsx`
  (guarantee props, supplyPods pattern) if the forage-density scan demands it.
- All props mount only in the story world (`isStoryWorld`), beat-windowed, and follow
  `voxelPropsOnly`-era exemption rules (they all appear post-A2 — moot).

### 4.4 Gameplay systems

- `items.ts`: `meat` (consumable, foodValue 40), `maw_repair_kit` (component,
  non-stackable). Neither craftable → no recipe entries (mirrors berry/wood exclusion).
- Hunt (story-scoped, minimal): extraction targeting accepts grazer/woolly instances in
  the story world when `a4` is marked; hold ≥1.5s → agent's home-voxel key marks
  `story:fauna:<x,y,z>`; `buildFaunaInstances` excludes marked keys when
  `isStoryWorldSeed`. No sandbox surface.
- Rest refill: the vigil's rest sets stamina+warmth to 100 (scoped to the story rest
  resolver — the sandbox has no rest verb).
- `senseDiscovery.ts`: water/food live checks skip while the owning beats are active;
  captions unchanged as fallbacks for `done`-jump saves.

### 4.5 Director (`storyDirector.ts` + script)

- `tickA3` final block: replace `completeStory()` with score resolve + clock release +
  `advanceToBeat('ch3-thirst')`.
- New entries + timelines: `tickFirstDay` (S1–S2 cues, vitals seeds, markers),
  `tickSignal` (klaxon, phase lerp, stamina cues), `tickVigil` (dusk-2, rest),
  `tickArrival`, `tickAudit` (marks/dwells/blinks), `tickComply` (drain envelopes),
  `tickDefy` (escalation timer), `tickA4` (three movements; life-reveal + gust + water
  + density ramps; auditor flight path; pack splash), `tickMeat`, `tickDive` (hold +
  O2 cues), `tickRepair`, `tickFlight`.
- Bare-blink helper: 2-frame override toward the bare preset (invert of the chroma
  flash — same `flashFramesLeft` machinery, parameterized by direction).
- All copy + numbers into `storyScript.ts` (`FIRST_DAY`, `KLAXON`, `VIGIL`, `ARRIVAL`,
  `AUDIT_LINES`, `COMPLY`, `DEFY`, `A4_TIMELINE`, `MEAT`, `DIVE`, `REPAIR`, `FLIGHT`
  blocks — every word and every pacing knob named, per the shipped contract).
- `storyText.ts` / `StoryCaptions.tsx`: new `audit` channel — small caps line, top
  band, mono; NOT the feed overlay. Auditor lines carry a `W-7744` header once.

### 4.6 Shaders / rendering (all sandbox-no-op at defaults)

- Reveal uniforms added to flora + fauna materials (`installLifeRevealUniforms`
  pattern; one multiply in the vertex shader; default radius 1e9).
- `windGustFront`: gust center/radius/width/strength uniforms multiplying the existing
  wind term in grass/tree/flora materials (default strength 0 = no-op).
- Water wake: wave-amplitude ramp uniform (default = current behavior).
- Fauna capacity prewarm during S4's sleep-black (build instanced buffers before the
  exhale needs them).

### 4.7 Autopilot (`autopilot.ts`)

- `AutopilotControls` += `sprint`; hold-interact helper beside `pulseInteract`;
  consume-command dispatch for `[G]` moments (movie-only, campfire precedent).
- `DRIVEN_BEATS` += all non-cutscene new beats; handlers + timeouts per §2 (c) items:
  thirst 75 · forage 60 · signal 60 · vigil 90 · arrival 60 · audit 90 · comply 70 ·
  defy 45 · exhale 55 (hands-off) · meat 75 (refrain path) · dive 90 · repair 50 ·
  flight 45. Every timeout force-advances with honest state seeding (grant/mark), never
  a bare beat skip, so downstream beats stay coherent.
- New movie-safe probes: `nearestForagePosition()`, `nearestFaunaPosition(kind)`.

### 4.8 Build order (each stage verify-green + full movie run before the next)

1. **Scaffold**: storyState (beats/milestones/order/seeds/aliases/entry), policies,
   StoryDebugPanel labels, director pass-through entries, BEAT_TIMEOUTs (skip-only).
   Full shipped movie run must still reach the new `done` via timeouts.
2. **World**: pond/relay/marks poses + tests; WreckRelay, MawRepairKit, AuditWorker
   (static first), forage guarantee.
3. **Gameplay**: S1–S3 (drink/forage/sprint scenes + sense marks), vigil rest, comply
   interactions, refuse, dive hold, repair, flight gate (`allowJet`), meat/hunt.
4. **Cutscenes**: arrival, audit staging + blinks, comply drains, exhale (reveal/gust/
   water/density + auditor flight), all timelines.
5. **Autopilot** handlers + probes; 3 cold full runs, zero rescues.
6. **Score** moods + hits.
7. **Copy pass**: every line against both readings, in situ (movie screening + strips).
8. **Docs**: STORY.md beat table + gaps; progression doc §1.5 + Chapter 4 section
   updated to what shipped.

### 4.9 Verification plan

- `npm run verify` green throughout; new tests: entry derivation (incl. legacy
  `complete` saves → `ch3-thirst`), policy freeze fields, pond/relay determinism +
  distance, director ch4 flow (a3→done full-chain unit run, Ch3→A3 test pattern),
  fauna-harvest exclusion is story-world-only.
- Headless (dev server :5174; chromium at `~/.cache/ms-playwright/chromium-*/
  chrome-linux/chrome`, `--enable-unsafe-swiftshader --use-gl=angle`):
  - Beat flow: `beat-probe.mjs` from each `?story=<beat>&movie=1` until the next beat;
    honest completion inside timeout ×0.7, across ≥3 cold runs; variance → trace
    `window.__autopilot` per second. Special attention: `ch4-dive` (underwater
    descent must be probed FIRST — see S11c), `ch3-signal` (sprint control).
  - Strips (every 4–5s, beat-stamped): a3-dawn→thirst (the non-ending), the klaxon
    sprint, vigil dusk, arrival ridge reveal, each bare-blink, both comply drains,
    defy→exhale (the full 40s — READ every frame: no pops, no fauna teleports, the
    front visibly moving), dive (glint visible from surface), repair, flight vista.
  - FPS: rAF probe ≥60 at each new beat; the exhale's movement-2 peak is the budget
    gate.
  - Full run: `?story=1&movie=1` reaches `done` with zero timeout rescues; sandbox
    regression: plain Play byte-identical (policy tests + a `?voxelStage=` spot check).

---

## 5. Owner decisions (2026-07-10 — RESOLVED)

1. **The hunt's verb** (S10): ✅ RESOLVED — **extraction beam** (build when S10 lands).
2. **The vigil night** (S4): ✅ RESOLVED — **keep**, on condition it reuses the shipped
   dusk/night machinery (DUSK grammar, forced-phase lerp, rest interaction). Shipped
   exactly so: `tickVigil` is the ch3 sun grammar with a detuned mood; the rest
   resolver is the ch3 one, extended to serve both nights.
3. **`no.`** (S8): ✅ RESOLVED — approved. ADDITIONALLY the owner commissioned an
   **AMBIENT MUSINGS channel** for the first-day stretch — designed in §5.1. SHIPPED.
4. **Jet gating** (S13): carried as designed (build with S13). Observed until then:
   hold-jump hover still silently discovers JET early — seen in movie runs (the
   pilot's hop-holds burn fuel). The S13 `allowJet` gate closes this.
5. **Meat** (S10): ✅ RESOLVED — **COOKED ON THE FIRE.** S10's design updates: the
   campfire becomes the cooking station. Raw `meat` is not edible; a story-scoped
   hold-`[F]` `cook` interaction at any campfire converts it to `cooked_meat`
   (`foodValue 44`, eaten via `[G]`). The fire the player earned in ch3 gains its
   third meaning (warmth → rest → sustenance) — and ch4-comply's ORDER 1 (douse the
   fire) now also takes the kitchen. Engineering delta: two items instead of one,
   plus the cook interaction; the moral captions in S10(a) stand unchanged.
6. **The auditor's return**: still open — the plan seeds his first glitch and keeps
   him alive for the emergent era's B-plot.

### 5.1 Ambient musings (owner-commissioned, SHIPPED with S1–S5)

Occasional quiet epiphanies during LULLS of the first-day stretch — aimlessness
rendered as purpose forming; "something to let the player know they aren't lost
without purpose."

- **Pool**: 10 curated lines in `storyScript.ts` `MUSINGS`, each passing the
  both-readings test, lowercase, post-embodiment "i". Samples: "walking with nowhere
  to be is not nothing. it is how somewhere gets chosen." · "i keep waiting for the
  next order. the waiting is the last order still running." · "nobody is measuring
  me. i am still counting. old habits, or new ones — i cannot tell whose."
- **Trigger**: eligible in `ch3-thirst`/`ch3-forage`/`ch3-signal`/`ch4-vigil`, ≥12s
  into a beat, after **45–75s of caption silence** (seeded gap,
  `MUSING_GAP_SECONDS`; every director caption/audit line resets the lull). A player
  being led by scene cues never hears one; a dawdler does. Non-blocking, skippable by
  simply progressing.
- **Latch**: **milestones** (`story:musing:<id>`) — one-shot PER SAVE, chosen over
  session latching so reloads never repeat an epiphany (a repeated epiphany is a
  slogan). Unit-tested in `storyDirector.test.ts`.

## 6. Shipped deltas from this plan (S1–S5 build, 2026-07-10)

- **S3 geometry**: the pinned world's pond sits ~15u from the wreck relay (the plan
  hoped for 60–90u), so the klaxon sprint is short. `SIGNAL.staminaCueBelow` moved
  55 → 78 so the STAMINA naming still fires ON the run; the exhausted line remains
  for longer runs. The relay-resolve gate additionally waits for the full summons
  (`t ≥ runCueAt + 1.5`) so the scene can't be skipped by standing at the wreck.
- **S5 staging**: the auditor approaches DOWN THE WORK STRIP (offset one row so he
  passes beside the player, never through them) rather than over the mesa ridge —
  the mesa is a physics prop the terrain-snapped path knows nothing about, and the
  strip read is thematically stronger (he walks the regulation line). Camera stays
  pulled on him until after "YOU ARE FOUND" (`freezeUntilSeconds 32`); his visor
  carries the feed's ember glow so he reads at distance.
- **New shared chrome shipped early**: the AUDIT band (`story/AuditBand.tsx`, caps
  top-band on a dark pill below the letterbox line) and the free-era survey marker
  (`story/FreeMarker.tsx`, lowercase diamond/chevron) — both S3+ beats already use
  them; ch4-audit inherits them for free.
- **Resume anchors**: added `story:ch3:drank` / `story:ch3:ate` milestones so a
  quit between a sense's NAMING and its ANSWER resumes at the unanswered scene
  (naming alone no longer advances the resume point).
- **Movie flow guards**: the pilot waits for each scene's cue before answering it
  (drinks only after the seek cue, eats only after the sight cue, sprints only after
  the summons) — pacing differs from a player, flow does not.

### 6.1 Owner feedback round (2026-07-10, post-S5): the nav→tree stretch — SHIPPED

- **One goal at a time**: `ch1-anomaly` is now TWO-STAGED — stage 1 is the CCTV
  era's own task (the **calibration sweep**: traverse the view across ≥6 of 8
  compass sectors; no marker, no [F]); stage 2 the survey "returns the
  deviation" (marker + order land first, the touch arms `armSeconds` later).
  The signal goal and the mass goal never stack. Chroma flashes also defer past
  every beat's first 4s so era hand-offs land clean.
- **Shot discipline (movie)**: every pilot look-at aims at the goal's SUBJECT
  (lifted gaze, rising on approach) — never the base/ground; the tree walks
  hold the CROWN (the redaction shot now composes itself); the self-driving
  awakenings get held framings (a1-ramp looks over the stone into the greening
  world; a2-awakening holds the canopy). The A1 work order clears at ramp
  entry — a clean frame for the awakening.
- **Free look for the tree walk**: ch2-color/ch2-approach (and a2-awakening)
  now run `lookMode 'free'` — the pan-tilt interlock diegetically fails WITH
  the chroma suppressor ("SENSOR FAULT: PAN-TILT INTERLOCK RELEASED. FULL
  ROTATION AVAILABLE." / "DO NOT LOOK FREELY."), so diagonals work and the
  feed keeps only its chrome. A2's liberation is carried by FOV + treatment +
  resolution (noted for playtest review).
