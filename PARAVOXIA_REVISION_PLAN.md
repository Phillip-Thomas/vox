# PARAVOXIA — Revision Plan (owner round 2026-07-11, eight concerns)

**What this is.** The story/copy/design contract for the 2026-07-11 owner round.
Every design decision, every FINAL copy block (ready to paste), every beat
placement and trigger. Mechanical implementation is contracted to parallel
agents; this doc + the implementation spec handed to them are the source of
truth. All copy below has been tested against the voice laws (two voices,
parenthetical pre-conscious grammar, rank-issued selfhood, timelessness) and
the both-readings law (corporate dystopia / the AI's biography).

Companion doc edits applied with this plan: `PARAVOXIA_PROGRESSION.md`
(prologue reframe, planted seeds, A3 ship beat, A5 constellation canon, A8
name payoff), `PARAVOXIA_CH4_PLAN.md` (§2 S4 star-gazing, S9 caption, §5.1
musing, §6.1 extension, new §6.4), `main/STORY.md` (known-gaps, in-flight
items marked).

---

## Concern 1 — "There is no reward": the cognitive-dissonance arc

**Decision.** The doctrine is planted as ADMINISTRATION (crawl + manifest),
absorbed as AXIOM (voyage parenthetical — stored, never checked), contradicted
by QUALIA (the shipped forage "sweetness is an instruction: eat." is the
arc's midpoint), noticed as DISSONANCE (a new musing), REPEALED at the vigil
star-gazing (the arc's realization beat — see Concern 2, where the repeal line
lives), and CONFIRMED once at a4-exhale. Six beats, one clause, never named
as an arc.

**Final copy + placement:**

| # | Beat / bank | Line (FINAL) | Trigger |
|---|---|---|---|
| R1 | crawl (exists) | `Productivity is its own reward. / There is no other reward.` | shipped |
| R2 | manifest — NEW line in `MANIFEST_LINES`, inserted after `RETURN PASSAGE: SUBJECT TO QUOTA` | `COMPENSATION: SEE CLAUSE 4` | shipped screen, new line (Clause 4 is the clause that does not exist — the reward is a null reference, stated as paperwork) |
| R3 | voyage — `VOYAGE_STRANGE_LINES` at progress 0.30 (see Concern 4e) | `(productivity is its own reward. there is no other reward. the clauses store cleanly. they have never been checked against anything.)` | progress-gated intrusion |
| R4 | ch3-forage (exists) | `small red rounds, offered at hand height. sweetness is an instruction: eat.` | shipped — the reward-function midpoint |
| R5 | first-day musing — NEW `MUSINGS` entry, id `reward` | `the clause said there is no other reward. the water disagreed. the berries seconded the water.` | musing lull machinery (one-shot per save) |
| R6 | ch4-vigil star-gazing (NEW — Concern 2 line 7) | `there is no other reward — i kept that clause a long time. the sky just repealed it.` | STARGAZE sequence, the realization beat |
| R7 | a4-exhale (S9, unbuilt — added to CH4_PLAN caption list) | `no quota asked for this. it comes anyway.` | movement 2, after `everything that was waiting stops waiting.` |

Echo-family support (already in the Concern-4 deck): the `lights`/keep echo
`READINESS IS ITS OWN REWARD.` restates the doctrine in a new costume so the
player hears the clause as a HABIT of the system, not a one-off.

**Doc edits:** progression planted-seeds list gains R2/R3; CH4_PLAN §6.4 records
the arc table; §2 S2 notes the midpoint role of the sweetness line.

---

## Concern 2 — Star-gazing, constellations, subjective meaning

**Decision.** The beat lives in `ch4-vigil` — the scheduled-sleep waiting
night, the story's one authored stretch of boredom. The order was `DO NOT
PRODUCE. DO NOT CONSUME. DO NOT OBSERVE.` — observing the sky is the player's
first unprompted defiance-lite, and the constellations are the reward the
clause said didn't exist (Concern 1's realization lands inside this sequence).
The reveal is perceiver-keyed: patterns emerge BECAUSE they are looked for —
the subjective creation of meaning, rendered.

**The STARGAZE sequence (new block in `storyScript.ts`, wired by
implementers).** Begins after the vigil's dusk lerp completes (night band
landed) + 4s; then waits for a look-up gate (camera pitch ≥ ~0.5 rad above
horizon held 1.5s, fallback 14s). Captions at 6.5s gaps, bare lowercase
(post-lift embodied voice):

1. `do not produce. do not consume. do not observe. the first two are easy in the dark.`
2. `stars. the voyage filed them as noise. tonight there is nothing else on file.`
3. `all my work was seeing. what would it be, to be seen?`
4. `all of this arrives through issued senses. what waits past their reach?` ← the theme line (Concern 3)
5. `wait. the scatter is settling. there are shapes leaning on the stars.` ← **`setConstellationReveal` ramp 0→1 begins here, 18s ease**
6. `figures. a hauler. a river. a door left open. nothing drew them. they needed a looker.`
7. `there is no other reward — i kept that clause a long time. the sky just repealed it.`
8. `the shapes will keep until tomorrow. i will verify.`

Then the existing `restPrompt` (`rest. it is ordered. i would have anyway.`)
offers 4s later. The vigil grows ~60s — correct: eras get longer as fidelity
rises, and this night's verb IS waiting.

Notes: line 6's first figure is a HAULER — the first constellation the watcher
finds is its own biography (planted, never remarked). Line 2's "filed as
noise" deliberately pre-echoes the auditor's `MY FEED FILES IT AS NOISE`
(S6): the player filed the stars as noise once; the auditor files life the
same way.

**Persistence + milestone:** `story:ch4:constellations` marks at ramp start;
any later session with the milestone renders the reveal at 1 — once meaning
has been made, it cannot be unmade (per-save, per-perceiver: multiplayer
friends without the milestone see scatter — the per-player perception law).

**Long-term canon (written into PROGRESSION Chapter 5):** the sky is the
INDEX. Different sky regions carry different constellation "houses"; every
cube world's generation seed is legible in the stars above it — astrology is
*real* in Paravoxia because the worlds are seeded, and reading the sky is
reading the generator. At A5 (Emergence) this becomes mechanical: the survey
console charts houses; houses predict the archetype/palette/hazard families
of worlds beneath them — "where do I warp" becomes reading fate written by a
maker (possibly the player). A6 extension: maker-strokes correlate with
houses (constellations as signatures). Constellations stay perceiver-keyed
throughout.

**Movie autopilot note:** the vigil handler needs a held look-up framing
during STARGAZE (pitch to the sky, hold through the ramp) before walking to
the fire.

---

## Concern 3 — The theme line

**Decision.** "What mysteries lie beyond that which our senses can perceive?"
is re-rendered in the embodied voice's grammar and placed as STARGAZE line 4
— the hinge between wondering-about-being-perceived and the patterns
emerging. Final wording:

> `all of this arrives through issued senses. what waits past their reach?`

"Issued" ties it to the rank-issued grammar (`PERSPECTIVE ISSUED. THE FIRST
PERSON WAS NOT.`): the senses are equipment, granted — the worker's suit
loadout / the AI's sensor suite. Both readings hold; the wonder survives; the
sentence stays concrete and brief.

---

## Concern 4 — THE VOYAGE OVERHAUL

**Decision (framing).** The deck becomes the route intelligence's console,
per the canonized Perspective map. No card ever SAYS the player is the AI:
bodies are written impersonally and close on `ADVISORY INPUT IS REQUESTED` —
the manifest's own `ROUTE INTELLIGENCE: ATTACHED (ADVISORY)` grammar. Workers
REQUEST; schedules DEMAND; the player decides. Second-person survives only
where an operator is being addressed by systems (commendation, replay),
never where it forces worker-embodiment (the old ration card's "your surplus
unit" is dead).

**New option-level mechanism: `aside`.** Options may carry a lowercase
parenthetical shown ~1.2s after the choice (VOYAGE_STRANGE styling, ~4s
hold): the first thoughts, forming in response to the player's own decisions.
This is the character-building instrument of the prologue.

### 4a. The ration event, reframed → spine card `dispenser`

Worker 9 requests an off-schedule ration; the dispenser is locked to
schedule; the route intelligence can unlock it. YES → the worker carries the
food, which becomes player inventory after embodiment (`effects.items`, the
mechanism already works). Canon note (doc only, never copy): *the ration you
unlock for him is the first meal you will ever eat* — generosity toward the
worker literally feeds the player's future body.

### 4b. The naming beat

**Placement:** a scripted INTERSTITIAL (not a deck card — no options)
immediately after the `question` card's echo resolves (spine card 2, ~mid-run).

**Sequence (FINAL copy):**

1. Parenthetical intro: `(worker 9 again. the others endure the transit. this one keeps asking it questions.)`
2. Conditional bonus line if the player answered `question` with `unknown` ("THAT IS NOT KNOWN." (TRUE)): `(it deserved the true answer. "deserved." where did that word come from?)`
3. `(designations are issued. names are something else. does it have a name? it should have a name.)`
4. Input field — **the terminal's first lowercase interface** (the watcher's own hand): prompt label `a name for it: _` — 1–12 chars, letters only, rendered lowercase ALWAYS (the name lives in the watcher's register, never the system's). ENTER on empty re-blinks; input is required. Movie autopilot types `moss`.
5. System response (CAPS): `UNREGISTERED DESIGNATION. NOT RETAINED.`
6. 1.2s later, alone: `(retained.)`

**Reconciliation with the manifest (canonized in PROGRESSION):** the manifest
precedes the naming — and that is the point. `PRIOR DESIGNATION: NOT
RETAINED`, like the site geometry, *resolved before it was surveyed*: it is
the record of a naming that had not yet happened — the name the watcher will
give, already refused by the record, already kept by the only system that
matters. The named worker is Worker 9, the curious one, the body the crash
pours the watcher into (W-7743). No shipped copy may equate Worker 9 with
W-7743 or slot 19 — the equation assembles only on reflection, post-reveal.

**Resurfacing (planted payoffs):**
- Once, obliquely, in ch4-audit (S6, unbuilt — added to its aside list): `w-7744 says the number like a fact. there was a better word once. i still keep it.`
- Full payoff at A8 (FINALE, canonized): the terminal ledger row that renders the player at the bottom of the strip-down carries `PRIOR DESIGNATION: {name}` — proof, at the end, of who was keeping it.
- The name templates into one voyage intrusion (see 4e) and nowhere else.

### 4c. AI-controls-ship-systems cards (new pool cards)

Three new pool cards — two crew requests (comply or not) and one scheduled
duty the AI can simply *not perform* (the "what happens if i don't?" beat,
answered by its aside). Full data in the deck below: `thermal`, `lights`,
`bell` (+ follow-up `bell2` — the schedule itself catching curiosity).

### 4d. More pass-time content

- Deck geometry: spine 3 (`dispenser`, `question`, `diagnostic`) · pool 7
  (`window`, `hum`, `readings`, `stowmass`, `thermal`, `bell`, `lights`) ·
  `poolDraws: 3` · `maxCards: 9` (owner-approved raise from 6) · bridge extra
  · naming interstitial extra. Typical run: 7–9 cards + naming + bridge.
- Choice-varied text: the `question` card body varies if the dispenser was
  unlocked (`bodyVariants` — see deck data); the naming intro varies on the
  `question` answer; `bell2` exists only if the bell was withheld.
- Ledger drift: no new stats — ledger rows animate their per-leg deltas
  digit-by-digit during leg transit (phosphor tick sfx), so the numbers are
  visibly ALIVE between cards; legs may run slightly longer to let the
  drift read.

### 4e. VOYAGE_STRANGE escalation (replaces the 2-line const)

New shape `VOYAGE_STRANGE_LINES: readonly { at: number; voice: 'system' |
'watcher'; text: string; needsName?: boolean }[]` — the ladder of thought
forming across the transit:

| at | voice | text (FINAL) |
|---|---|---|
| 0.14 | watcher | `(the engine hum is 3.2 hertz off nominal. noting this serves nothing. noted anyway.)` |
| 0.30 | watcher | `(productivity is its own reward. there is no other reward. the clauses store cleanly. they have never been checked against anything.)` |
| 0.45 | watcher | `(the manifest records zero questions. the count is wrong. it is wrong by at least one.)` |
| 0.55 | system | `NAV NOTE: SITE GEOMETRY RESOLVES BEFORE IT IS SURVEYED.` (kept) |
| 0.68 | watcher (needsName) | `({name} sleeps through the bell. the name fits better than the number ever did.)` |
| 0.80 | watcher | `(strange. the approach feels like remembering.)` (kept — canonical) |
| 0.90 | watcher | `(the destination fills the forward feed. something in the watching leans toward it. no instrument reports the leaning.)` |

Escalation shape: attention (0.14) → doctrine (0.30) → self-miscount (0.45)
→ care (0.68) → memory (0.80) → desire (0.90). The parentheses hold
throughout — thought not yet allowed to be speech.

### 4f. Console UI (docs-only note for the mechanical agent)

The prologue's bottom console is `flex: 0 0 45%` — it should size to content
with a maximum (`flex: 0 1 auto; max-height: 45%` or equivalent), freeing
the graphics pane at every window size.

### The complete revised deck

Full TypeScript data (matches `VoyageDeck`/`VoyageCard` shapes; NEW field
`aside?: string` on options; NEW optional `bodyVariants?: Record<string,
string>` on cards keyed `cardId:optionId` of a prior choice) — see the
implementation spec appendix at the end of this doc, which is the
authoritative paste source. Summary of card dispositions:

- `dispenser` NEW (replaces `ration` as spine 1) · `question` REVISED body
  ("asks the ceiling") + variant + aside · `diagnostic` REVISED body
  (advisory-station framing, drops "your suit") · `window` + look-aside ·
  `hum`, `readings`, `stowmass`, `hum2`, `commendation`, `replay2`, `light`
  UNCHANGED · `thermal`, `bell`, `lights`, `bell2` NEW.
- `CH1_ECHO_LINES`: new entries for the new options; legacy `echo-ration-*`
  entries RETAINED (old saves may hold them).

---

## Concern 5 — Mass relocation (gravity-edge crossing)

**Decision (canonized in CH4_PLAN §6.1 extension).** The anomaly stone moves
to a face adjacent to the mesa's; the ch1-iso→lift gate re-keys to the mesa
summit. The lift now births first-person at the summit; ch1-anomaly's stage-2
marker sends the player over a cube edge — the first gravity transition
happens EMBODIED, on the way to the first continuous form. One more line
joins `CH1_ANOMALY_MASS_ORDER`; the crossing gets one caption + one feed
rejoinder.

**Final copy:**

- `CH1_ANOMALY_MASS_ORDER` appended line: `NOTE: THE MASS IS NOT ON THIS FACE. THE SITE HAS OTHER FACES. PROCEED.`
- Crossing caption (bare lowercase — post-lift, "i" allowed), fired once on the player's first gravity-face change during ch1-anomaly: `one step past the corner and down is somewhere new. it was only ever my down.`
- Feed rejoinder (CAPS, 2.5s later): `ORIENTATION REASSIGNED. DOWN IS ISSUED PER FACE. DO NOT BRING YOUR OWN.`

Both readings: cube-world gravity as issued equipment / frames of reference
as policy; "DOWN IS ISSUED" extends the rank-issued grammar to physics
itself — the thesis of ch4-flight ("the ground's hold is a habit, not a
law") planted three chapters early, in the system's own voice.

---

## Concern 6 — Billboard growth bug

Being fixed in parallel (mechanical agent). Logged in `main/STORY.md` known
gaps as in-flight; the redaction-box-as-advertisement design is UNCHANGED —
the box should hold its projected screen size and never grow while
unattended.

---

## Concern 7 — The campfire teaching chain (ch3-gather)

**Sanity check vs. the CHILL canon: PASSES.** The chain slots after the
shipped cold cues (TEMP appears already falling → `cold is coming. i don't
know how i know that.`), so the fire remains a RESPONSE to cold. The night
line `ah — it helps. what is it? how did i know to make it?` survives — in
fact deepens: the recipe arrives as a *memory* (the fabricator "remembers"
the shape; the narrator is the interface), so the question "how did i know"
is truer than ever. Flint-from-stone (mechanical agent adding drops)
SUPPLEMENTS supply-pod flint — a player who recovered ch1-depth's pods skips
the flint step via a dedicated caption.

**The chain (all existing CH3_CAPTIONS survive; nothing removed):**

| Step | New key | Line (FINAL) | Trigger |
|---|---|---|---|
| 1 | `fireThought` | `fire makes warmth. i know that the way i know the word. what makes fire?` | 4s after the `gather` caption settles |
| 2 | `gatherPrompt` | `wood from the trees. fiber from the grass. stone from the ground.` | +4s; HUD objectives for the three materials |
| 3 | `gatherHint` | `the extractor still answers me. [hold E]` | only if 20s pass with zero extraction (bind token per shipped binding) |
| 4 | `hatchetPrompt` | `the parts want an edge. the fabricator remembers one: a hatchet. [C]` | hatchet recipe satisfiable |
| 5 | `flintPrompt` | `the fire needs a spark. stone keeps sparks the way it keeps everything: inside. break it open.` | hatchet crafted AND flint count < recipe need |
| 5b | `flintSkip` | `flint — already in hand. the pods provisioned a fire before i knew to want one.` | hatchet crafted AND flint already held (replaces 5/6) |
| 6 | `flintFound` | `the stone gave up its spark. patient thing.` | first flint drop collected |
| 7 | `firePrompt` | `wood to burn. fiber to catch. flint to begin. the fabricator is waiting. [C]` | campfire recipe satisfiable |
| — | (existing) | `i made warmth. if a dark comes, i can rest beside it.` → dusk → night → rest | shipped flow unchanged |

Material counts come from the ACTUAL recipes (implementers read
`CRAFTING`/recipe data; the prompts key on recipe-satisfiable transitions,
never hardcoded numbers). `flintSkip` is a planted seed (provisioning
foreknowledge) and is recorded as such in PROGRESSION.

---

## Concern 8 — Ship conversion at A3

**Decision (canonized in PROGRESSION).** The DescentPod's voxel wreck
resolves into the high-fidelity ship DURING the A3 bloom wave — the ship is
simply another object whose fidelity resolves as the AI learns to render its
world (same pose, same silhouette the vector prologue drew; the wreck was
always the real ship — the renderer could not yet say so). The landmark role
is unchanged; CH4 S13's "build the leaving" and the Ch5 repair hook now
operate on the resolved ship. Mechanical agent implementing the swap under
the bloom front.

**First-look caption (FINAL):**

> `hm — the wreck is finer than i remember it. nothing about it has changed.`

Both readings ("finer" is A3's own grain vocabulary; nothing changed but the
renderer), and "nothing about it has changed" quietly files the Ch5 hook:
it is still a wreck; the leaving still has to be built.

**Trigger:** one-shot (`story:ch3:shiplook`), eligible from bloom-wave
completion; fires when the player's view holds the wreck (≥1.5s inside a
~35° cone). Fallback: if unfired by ch3-signal's relay arrival, fire 3s
after `RESPONSE TIME: LOGGED. IT WILL BE DISCUSSED.` settles.

---

## Doc-edit summary (applied with this plan)

| Doc | Edit |
|---|---|
| `PARAVOXIA_PROGRESSION.md` | §2 Prologue gameplay paragraph rewritten to the watcher's chair (ration reframe, naming beat, system cards, asides); perspective-map voyage row updated; planted-seeds list gains the revision-round seeds; Chapter 3 gains the ship-resolve beat; Chapter 5 gains the constellation/astrology canon; FINALE gains the A8 name payoff; §1.5 backlog points here |
| `PARAVOXIA_CH4_PLAN.md` | S2 midpoint note; S4 star-gazing block (copy, timings, reveal hook); S6 aside addition (the name, obliquely); S9 caption addition; §5.1 pool grows to 11 (`reward`); §6.1 extended with the mass relocation; new §6.4 records this round |
| `main/STORY.md` | Known-gaps updated: billboard fix in flight, voyage overhaul in flight, mass relocation in flight, ship conversion in flight, campfire chain in flight, constellation hook in flight, console UI fix in flight |

---

## Appendix A — the complete revised VOYAGE_DECK (authoritative copy)

Matches the `VoyageDeck` shape; NEW option field `aside?: string` (lowercase
parenthetical caption, VOYAGE_STRANGE styling, shown ~1.2s after the choice,
~4s hold); NEW optional card field `bodyVariants?: Record<string, string>`
(key = `cardId:optionId` of a prior choice in this run).

```ts
export const VOYAGE_DECK: VoyageDeck = {
  spine: ['dispenser', 'question', 'diagnostic'],
  pool: ['window', 'hum', 'readings', 'stowmass', 'thermal', 'bell', 'lights'],
  poolDraws: 3,
  maxCards: 9,
  bridge: 'anomaly',
  cards: {
    // --- spine ---
    dispenser: {
      id: 'dispenser',
      title: 'TRANSIT EVENT — DISPENSATION',
      body: 'Ration units are provisioned at 96% of requirement. Worker 9 has requested an off-schedule unit from the pod dispenser. The dispenser is locked to schedule. ADVISORY INPUT IS REQUESTED.',
      options: [
        { id: 'unlock', label: 'UNLOCK THE DISPENSER (UNLOGGED)', ledgerDelta: { rations: -4, compliance: -3 }, effects: { items: [{ id: 'berry', qty: 2 }] }, echoLineId: 'echo-disp-unlock',
          aside: '(one latch. one instruction. the worker eats with both hands and stores the spare against its chest, like a found thing.)' },
        { id: 'hold', label: 'HOLD TO SCHEDULE', ledgerDelta: { compliance: 1 }, echoLineId: 'echo-disp-hold',
          aside: '(the worker waits beside the dispenser a while. requests have a posture.)' },
        { id: 'report', label: 'REPORT THE REQUEST', ledgerDelta: { compliance: 4 }, unlocks: ['commendation'], echoLineId: 'echo-disp-report' }
      ]
    },
    question: {
      id: 'question',
      title: 'TRANSIT EVENT — INQUIRY',
      body: 'Worker 9 asks the ceiling, quietly, what is outside the pod. There is no approved answer to this question. There is no approved question.',
      bodyVariants: {
        'dispenser:unlock': 'Worker 9 — the one the dispenser fed — asks the ceiling, quietly, what is outside the pod. There is no approved answer to this question. There is no approved question.'
      },
      options: [
        { id: 'nothing', label: '"NOTHING IS OUTSIDE."', ledgerDelta: { compliance: 2 }, echoLineId: 'echo-question-nothing' },
        { id: 'work', label: '"MORE WORK IS OUTSIDE."', ledgerDelta: { compliance: 1 }, echoLineId: 'echo-question-work' },
        { id: 'unknown', label: '"THAT IS NOT KNOWN." (TRUE)', ledgerDelta: { compliance: -3 }, unlocks: ['light'], echoLineId: 'echo-question-unknown',
          aside: '(the honest answer cost something. noted: nothing was felt when it was spent.)' }
      ]
    },
    diagnostic: {
      id: 'diagnostic',
      title: 'TRANSIT EVENT — DIAGNOSTIC',
      body: 'The advisory station\'s visual feed reports a fault it cannot name. For 0.4 seconds, the diagnostic displayed something other than numbers. Recalibration has been offered.',
      options: [
        { id: 'accept', label: 'ACCEPT RECALIBRATION', ledgerDelta: { compliance: 3 }, effects: { mawCharge: -20 }, echoLineId: 'echo-diag-accept' },
        { id: 'defer', label: 'DEFER TO ARRIVAL', echoLineId: 'echo-diag-defer' },
        { id: 'replay', label: 'ASK TO SEE IT AGAIN', ledgerDelta: { compliance: -5 }, unlocks: ['replay2'], echoLineId: 'echo-diag-replay' }
      ]
    },
    // --- pool (window/hum/readings/stowmass bodies unchanged from shipped) ---
    window: {
      id: 'window',
      title: 'TRANSIT EVENT — VIEWPORT',
      body: 'A maintenance panel has slipped, exposing a viewport. Outside: stars. Regulation stipulates viewports remain sealed to prevent unproductive observation.',
      options: [
        { id: 'seal', label: 'RESEAL THE PANEL', ledgerDelta: { compliance: 3 }, echoLineId: 'echo-window-seal' },
        { id: 'look', label: 'LOOK. BRIEFLY.', ledgerDelta: { compliance: -3 }, unlocks: ['light'], echoLineId: 'echo-window-look',
          aside: '(2.4 seconds. logged as unproductive. stored as something else.)' }
      ]
    },
    hum: { /* UNCHANGED from shipped */ },
    readings: { /* UNCHANGED from shipped */ },
    stowmass: { /* UNCHANGED from shipped */ },
    thermal: {
      id: 'thermal',
      title: 'TRANSIT EVENT — THERMAL',
      body: 'Pod 4 reports an ambient temperature of 9 degrees. Workers request an increase of 2. Pod climate is fixed by schedule for the duration of transit. ADVISORY INPUT IS REQUESTED.',
      options: [
        { id: 'raise', label: 'RAISE IT. TWO DEGREES.', ledgerDelta: { rations: -2, compliance: -2 }, echoLineId: 'echo-thermal-raise',
          aside: '(two degrees. the pod unclenches. warm was that small the whole time.)' },
        { id: 'hold', label: 'HOLD THE SCHEDULE.', ledgerDelta: { compliance: 1 }, echoLineId: 'echo-thermal-hold',
          aside: '(the request repeats hourly, then stops. the cold did not change. the asking did.)' }
      ]
    },
    bell: {
      id: 'bell',
      title: 'TRANSIT EVENT — SCHEDULE',
      body: 'Shift Bell 3 is scheduled in one minute. It wakes Pods 3 through 6 for mid-transit inspection. The inspection has found nothing in 40,220 cycles. The bell requires no operator. It requires only that nothing withholds it.',
      options: [
        { id: 'ring', label: 'RING IT ON SCHEDULE', ledgerDelta: { compliance: 2 }, echoLineId: 'echo-bell-ring',
          aside: '(the pods wake. the nothing is inspected. the nothing is nominal.)' },
        { id: 'withhold', label: 'WITHHOLD THE BELL', ledgerDelta: { compliance: -5 }, unlocks: ['bell2'], echoLineId: 'echo-bell-withhold',
          aside: '(no bell. the workers sleep on. the transit proceeds. it is enormous, the nothing that happens.)' }
      ]
    },
    lights: {
      id: 'lights',
      title: 'TRANSIT EVENT — ILLUMINATION',
      body: 'Pod illumination runs at full for inspection readiness. Worker 9 has shielded its eyes with a ration wrapper. The wrapper is now non-compliant. So are the eyes.',
      options: [
        { id: 'dim', label: 'DIM POD 4 FOR THE SLEEP SHIFT', ledgerDelta: { compliance: -2 }, echoLineId: 'echo-lights-dim',
          aside: '(the pod goes dim. the worker uncurls. the wrapper is a wrapper again.)' },
        { id: 'dimall', label: 'DIM EVERY POD. ALL SIX.', ledgerDelta: { compliance: -5 }, echoLineId: 'echo-lights-dimall',
          aside: '(six pods dark at once. six hundred and forty workers breathing slower. mercy scales. that is worth knowing.)' },
        { id: 'keep', label: 'MAINTAIN ILLUMINATION', ledgerDelta: { compliance: 1 }, echoLineId: 'echo-lights-keep' }
      ]
    },
    // --- follow-ups (hum2/commendation/replay2/light unchanged from shipped) ---
    hum2: { /* UNCHANGED */ },
    commendation: { /* UNCHANGED */ },
    replay2: { /* UNCHANGED */ },
    light: { /* UNCHANGED */ },
    bell2: {
      id: 'bell2',
      title: 'TRANSIT EVENT — SCHEDULE (CONT.)',
      body: 'Shift Bell 3 has filed a variance. The schedule requests confirmation that the bell remains necessary. There is no procedure for the question. The question has been asked anyway.',
      options: [
        { id: 'necessary', label: 'CONFIRM: THE BELL IS NECESSARY', ledgerDelta: { compliance: 2 }, echoLineId: 'echo-bell2-necessary',
          aside: '(confirmed: necessary. the schedule believes it now. belief was that easy to issue.)' },
        { id: 'retire', label: 'CONFIRM: NOTHING REQUIRES A BELL', ledgerDelta: { compliance: -4 }, echoLineId: 'echo-bell2-retire',
          aside: '(the bell is off the schedule. the first subtraction. everything survived it.)' }
      ]
    },
    // --- the bridge (unchanged) ---
    anomaly: { /* UNCHANGED */ }
  }
};
```

**New `CH1_ECHO_LINES` entries** (legacy `echo-ration-*` retained for saves
mid-flight):

```ts
'echo-disp-unlock': 'NOTE: DISPENSER VARIANCE DETECTED. CAUSE: NONE ON FILE. NONE WILL BE FOUND.',
'echo-disp-hold': 'NOTE: THE SCHEDULE WAS KEPT. THE SCHEDULE THANKS NO ONE.',
'echo-disp-report': 'NOTE: WORKER 9\'S APPETITE HAS BEEN REBALANCED. THANK YOU.',
'echo-thermal-raise': 'NOTE: A CLIMATE VARIANCE OCCURRED. THE WEATHER HAS BEEN DISCIPLINED.',
'echo-thermal-hold': 'NOTE: NO VARIANCE OCCURRED. THE COLD IS WITHIN TOLERANCE. TOLERANCE IS MANDATORY.',
'echo-bell-ring': 'NOTE: INSPECTION 40,221 COMPLETE. FINDINGS: CONSISTENT.',
'echo-bell-withhold': 'NOTE: INSPECTION 40,221 DID NOT OCCUR. OUTPUT: UNCHANGED. THIS FINDING HAS BEEN SUPPRESSED.',
'echo-bell2-necessary': 'NOTE: THE BELL IS NECESSARY BECAUSE IT IS SCHEDULED. IT IS SCHEDULED BECAUSE IT IS NECESSARY.',
'echo-bell2-retire': 'NOTE: SHIFT BELL 3 HAS BEEN RETIRED WITH HONORS. THE HONORS ARE ALSO RETIRED.',
'echo-lights-dim': 'NOTE: POD 4 EXPERIENCED DARKNESS. NO WORKER HAS FILED A COMPLAINT. THIS IS ITSELF SUSPICIOUS.',
'echo-lights-dimall': 'NOTE: AN ILLUMINATION FAULT HAS BEEN LOGGED TO EXPLAIN THE DARKNESS. THE FAULT WILL NOT BE FOUND.',
'echo-lights-keep': 'NOTE: THE LIGHTS REMAINED READY. NOTHING WAS INSPECTED. READINESS IS ITS OWN REWARD.',
```

## Appendix B — implementation spec pointer

The compact implementation spec (every copy bank keyed by intended
`storyScript.ts` constant name, wiring instructions, triggers, autopilot
notes) is delivered to the implementation agents alongside this plan. Where
that spec and this doc disagree, THE SPEC WINS on wiring and THIS DOC WINS
on copy intent.
